/**
 * Whiteboard/Board-Router – Excalidraw-ähnlich: flache Boards pro User.
 */

import {
	type Database,
	teamMembers,
	teams,
	users,
	whiteboardCommentMessages,
	whiteboardCommentThreads,
	whiteboardE2eeUpdates,
	whiteboardFolders,
	whiteboardMembers,
	whiteboardRoles,
	whiteboards,
} from "@skedra/db";
import {
	createWhiteboardSchema,
	createWhiteboardWithStateSchema,
	updateWhiteboardSchema,
	whiteboardPresentationAccessModeSchema,
} from "@skedra/shared";
import {
	boardRolePermissionsSchema,
	parseTeamRolePermissions,
} from "@skedra/shared";
import { decryptBytes } from "@skedra/shared/server-crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
	findArchivedBoardsForUser,
	listBoardActivities,
	listRecentActivities,
	logWhiteboardActivity,
} from "../../lib/activity";
import { appErrorCodes, createAppError } from "../../lib/app-errors";
import {
	membershipValuesFromRole,
	requireWhiteboardRole,
} from "../../lib/board-member-access";
import {
	createCollabShareToken,
	createEmbedShareToken,
	getEmbedShareAccess,
	getCollabShareAccess as resolveCollabShareAccess,
} from "../../lib/collab-share";
import { notifyMentionedUsers } from "../../lib/comment-notifications";
import { sendRegistrationInviteEmail } from "../../lib/mail";
import {
	findBoardsForUser,
	getBoardCollaborators,
	requireArchivedBoardOwner,
	requireBoardComment,
	requireBoardInvite,
	requireBoardManageMembers,
	requireBoardManageShare,
	requireBoardMember,
	requireBoardOwner,
	requireBoardResolveComments,
} from "../../lib/permissions";
import {
	createPresentationShareToken,
	getPresentationShareAccess,
	getWhiteboardPresentationShareSettings,
	isPresentationCurrentlyActive,
} from "../../lib/presentation";
import {
	buildRegistrationInviteUrl,
	createRegistrationInvite,
	normalizeInviteEmail,
} from "../../lib/registration-invites";
import { ensureOwnedWorkspace } from "../../lib/workspace";
import { getYjsEncryptionOptions } from "../../lib/yjs-encryption";
import { protectedProcedure, publicProcedure, router } from "../init";

async function requireFolderInOwnedWorkspace(
	ctx: { db: Database; user: { id: string } },
	teamId: string,
	folderId: string | null | undefined,
) {
	if (!folderId) return null;
	const folder = await ctx.db.query.whiteboardFolders.findFirst({
		where: eq(whiteboardFolders.id, folderId),
	});
	if (!folder) {
		throw createAppError({
			code: "NOT_FOUND",
			appErrorCode: appErrorCodes.whiteboardNotFound,
			message: "Ordner nicht gefunden",
		});
	}
	if (folder.teamId !== teamId) {
		throw createAppError({
			code: "FORBIDDEN",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "Ordner gehoert nicht zu diesem Workspace",
		});
	}
	return folder;
}

async function listWorkspaceIdsForUser(
	db: Database,
	userId: string,
): Promise<string[]> {
	const owned = await db.query.teams.findMany({
		where: eq(teams.ownerId, userId),
		columns: { id: true },
	});
	const memberships = await db.query.teamMembers.findMany({
		where: eq(teamMembers.userId, userId),
		columns: { teamId: true },
	});
	return [
		...new Set([
			...owned.map((team) => team.id),
			...memberships.map((m) => m.teamId),
		]),
	];
}

const e2eeAccessInputSchema = z.object({
	whiteboardId: z.string().uuid(),
	presentationShareToken: z.string().min(16).optional(),
	collabShareToken: z.string().min(16).optional(),
	embedShareToken: z.string().min(16).optional(),
});

async function requireE2eeUpdateAccess(
	ctx: {
		db: Database;
		user: { id: string; name: string; email: string } | null;
	},
	input: z.infer<typeof e2eeAccessInputSchema>,
) {
	if (input.collabShareToken) {
		const access = await resolveCollabShareAccess(
			ctx.db,
			input.collabShareToken,
		);
		if (access.whiteboard.id !== input.whiteboardId) {
			throw createAppError({
				code: "FORBIDDEN",
				appErrorCode: appErrorCodes.whiteboardAccessDenied,
				message: "Falscher Kollaborationslink",
			});
		}
		return {
			whiteboard: access.whiteboard,
			canWrite: access.canWrite,
			userId: `guest-${input.collabShareToken.slice(0, 8)}`,
		};
	}

	if (input.presentationShareToken) {
		const access = await getPresentationShareAccess(
			ctx.db,
			input.presentationShareToken,
		);
		if (access.whiteboard.id !== input.whiteboardId) {
			throw createAppError({
				code: "FORBIDDEN",
				appErrorCode: appErrorCodes.whiteboardAccessDenied,
				message: "Falscher Praesentationslink",
			});
		}
		return {
			whiteboard: access.whiteboard,
			canWrite: false,
			userId: `guest-${input.presentationShareToken.slice(0, 8)}`,
		};
	}

	if (input.embedShareToken) {
		const access = await getEmbedShareAccess(ctx.db, input.embedShareToken);
		if (access.whiteboard.id !== input.whiteboardId) {
			throw createAppError({
				code: "FORBIDDEN",
				appErrorCode: appErrorCodes.whiteboardAccessDenied,
				message: "Falscher Embed-Link",
			});
		}
		return {
			whiteboard: access.whiteboard,
			canWrite: false,
			userId: `embed-${input.embedShareToken.slice(0, 8)}`,
		};
	}

	if (!ctx.user) {
		throw createAppError({
			code: "UNAUTHORIZED",
			appErrorCode: appErrorCodes.unauthorized,
			message: "Nicht authentifiziert",
		});
	}

	const access = await requireBoardMember(
		{ db: ctx.db, user: ctx.user },
		input.whiteboardId,
	);
	return {
		whiteboard: access.whiteboard,
		canWrite: access.canWrite,
		userId: ctx.user.id,
	};
}

export const whiteboardRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		return findBoardsForUser(ctx.db, ctx.user.id);
	}),

	listFolders: protectedProcedure.query(async ({ ctx }) => {
		const workspaceIds = await listWorkspaceIdsForUser(ctx.db, ctx.user.id);
		if (workspaceIds.length === 0) return [];

		return ctx.db.query.whiteboardFolders.findMany({
			where: inArray(whiteboardFolders.teamId, workspaceIds),
			orderBy: asc(whiteboardFolders.name),
		});
	}),

	createFolder: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(120),
				parentId: z.string().uuid().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const workspace = await ensureOwnedWorkspace(ctx.db, ctx.user);
			const parent = await requireFolderInOwnedWorkspace(
				ctx,
				workspace.id,
				input.parentId,
			);

			const [created] = await ctx.db
				.insert(whiteboardFolders)
				.values({
					teamId: workspace.id,
					ownerId: ctx.user.id,
					name: input.name.trim(),
					parentId: parent?.id ?? null,
				})
				.returning();

			return created;
		}),

	updateFolder: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				name: z.string().min(1).max(120).optional(),
				parentId: z.string().uuid().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const folder = await ctx.db.query.whiteboardFolders.findFirst({
				where: eq(whiteboardFolders.id, input.id),
			});
			if (!folder || folder.ownerId !== ctx.user.id) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Ordner nicht gefunden",
				});
			}

			const updateData: {
				name?: string;
				parentId?: string | null;
				updatedAt: Date;
			} = { updatedAt: new Date() };
			if (input.name !== undefined) updateData.name = input.name.trim();
			if (input.parentId !== undefined) {
				const parent = await requireFolderInOwnedWorkspace(
					ctx,
					folder.teamId,
					input.parentId,
				);
				if (parent?.id === folder.id) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Ordner kann nicht sein eigener Parent sein",
					});
				}
				updateData.parentId = parent?.id ?? null;
			}

			const [updated] = await ctx.db
				.update(whiteboardFolders)
				.set(updateData)
				.where(eq(whiteboardFolders.id, input.id))
				.returning();

			return updated;
		}),

	deleteFolder: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const folder = await ctx.db.query.whiteboardFolders.findFirst({
				where: eq(whiteboardFolders.id, input.id),
			});
			if (!folder || folder.ownerId !== ctx.user.id) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Ordner nicht gefunden",
				});
			}

			await ctx.db
				.update(whiteboardFolders)
				.set({ parentId: folder.parentId ?? null, updatedAt: new Date() })
				.where(eq(whiteboardFolders.parentId, folder.id));
			await ctx.db
				.delete(whiteboardFolders)
				.where(eq(whiteboardFolders.id, input.id));

			return { success: true };
		}),

	listArchived: protectedProcedure.query(async ({ ctx }) => {
		return findArchivedBoardsForUser(ctx.db, ctx.user.id);
	}),

	/** Y.js-State fuer Library-Thumbnails — einzeln statt in der Liste. */
	getPreviewState: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const access = await requireBoardMember(ctx, input.id);
			if (access.whiteboard.e2eeEnabled) {
				return { yjsState: null as Uint8Array | null, hasState: false };
			}

			const full = await ctx.db.query.whiteboards.findFirst({
				where: eq(whiteboards.id, access.whiteboard.id),
				columns: { yjsState: true },
			});

			if (!full?.yjsState || full.yjsState.length === 0) {
				return { yjsState: null as Uint8Array | null, hasState: false };
			}

			try {
				return {
					yjsState: decryptBytes(full.yjsState, getYjsEncryptionOptions()),
					hasState: true,
				};
			} catch (error) {
				console.error("Failed to decrypt board yjsState for preview", error);
				return { yjsState: null as Uint8Array | null, hasState: true };
			}
		}),

	listActivity: protectedProcedure
		.input(
			z.object({ limit: z.number().min(1).max(100).optional() }).optional(),
		)
		.query(async ({ ctx, input }) => {
			return listRecentActivities(ctx.db, ctx.user.id, input?.limit ?? 30);
		}),

	listBoardActivity: protectedProcedure
		.input(
			z.object({
				whiteboardId: z.string().uuid(),
				limit: z.number().min(1).max(100).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			await requireBoardMember(ctx, input.whiteboardId);
			return listBoardActivities(ctx.db, input.whiteboardId, input.limit ?? 50);
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const access = await requireBoardMember(ctx, input.id);
			return {
				id: access.whiteboard.id,
				name: access.whiteboard.name,
				ownerId: access.whiteboard.ownerId,
				teamId: access.whiteboard.teamId,
				folderId: access.whiteboard.folderId,
				createdAt: access.whiteboard.createdAt,
				updatedAt: access.whiteboard.updatedAt,
				canWrite: access.canWrite,
				canComment: access.canComment,
				canResolveComments: access.canResolveComments,
				canInvite: access.canInvite,
				canManageShare: access.canManageShare,
				canManageMembers: access.canManageMembers,
				canViewActivity: access.canViewActivity,
				canUseAi: access.canUseAi,
				canManage: access.canManage,
				accessLevel: access.accessLevel,
				permissions: access.permissions,
				roleName: access.roleName,
				roleColor: access.roleColor,
				e2eeEnabled: access.whiteboard.e2eeEnabled,
				e2eeKeyHint: access.whiteboard.e2eeKeyHint,
				e2eeCreatedAt: access.whiteboard.e2eeCreatedAt,
			};
		}),

	listInviteRoles: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			await requireBoardMember(ctx, input.id);
			const roles = await ctx.db.query.whiteboardRoles.findMany({
				where: eq(whiteboardRoles.whiteboardId, input.id),
				orderBy: asc(whiteboardRoles.createdAt),
			});
			return roles.map((role) => ({
				id: role.id,
				name: role.name,
				color: role.color,
				permissions: parseTeamRolePermissions(role.permissions),
			}));
		}),

	createBoardRole: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				name: z.string().min(1).max(64),
				color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
				permissions: boardRolePermissionsSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requireBoardOwner(ctx, input.id);
			const [created] = await ctx.db
				.insert(whiteboardRoles)
				.values({
					whiteboardId: input.id,
					name: input.name.trim(),
					color: input.color,
					permissions: JSON.stringify(input.permissions),
				})
				.returning();
			return {
				...created,
				permissions: parseTeamRolePermissions(created.permissions),
			};
		}),

	updateBoardRole: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				roleId: z.string().uuid(),
				name: z.string().min(1).max(64).optional(),
				color: z
					.string()
					.regex(/^#[0-9A-Fa-f]{6}$/)
					.optional(),
				permissions: boardRolePermissionsSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requireBoardOwner(ctx, input.id);
			await requireWhiteboardRole(ctx.db, input.id, input.roleId);

			const updates: { name?: string; color?: string; permissions?: string } =
				{};
			if (input.name) updates.name = input.name.trim();
			if (input.color) updates.color = input.color;

			let parsedPermissions:
				| ReturnType<typeof parseTeamRolePermissions>
				| undefined;
			if (input.permissions) {
				updates.permissions = JSON.stringify(input.permissions);
				parsedPermissions = input.permissions;
			}

			const [role] = await ctx.db
				.update(whiteboardRoles)
				.set(updates)
				.where(
					and(
						eq(whiteboardRoles.id, input.roleId),
						eq(whiteboardRoles.whiteboardId, input.id),
					),
				)
				.returning();

			if (!role) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Rolle nicht gefunden",
				});
			}

			if (parsedPermissions) {
				const memberValues = membershipValuesFromRole(
					role.id,
					parsedPermissions,
				);
				await ctx.db
					.update(whiteboardMembers)
					.set(memberValues)
					.where(
						and(
							eq(whiteboardMembers.whiteboardId, input.id),
							eq(whiteboardMembers.roleId, input.roleId),
						),
					);
			}

			return {
				...role,
				permissions: parseTeamRolePermissions(role.permissions),
			};
		}),

	deleteBoardRole: protectedProcedure
		.input(z.object({ id: z.string().uuid(), roleId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			await requireBoardOwner(ctx, input.id);
			await ctx.db
				.delete(whiteboardRoles)
				.where(
					and(
						eq(whiteboardRoles.id, input.roleId),
						eq(whiteboardRoles.whiteboardId, input.id),
					),
				);
			return { success: true };
		}),

	create: protectedProcedure
		.input(createWhiteboardSchema)
		.mutation(async ({ ctx, input }) => {
			const workspace = await ensureOwnedWorkspace(ctx.db, ctx.user);
			const folder = await requireFolderInOwnedWorkspace(
				ctx,
				workspace.id,
				input.folderId,
			);
			const [created] = await ctx.db
				.insert(whiteboards)
				.values({
					name: input.name,
					ownerId: ctx.user.id,
					teamId: workspace.id,
					folderId: folder?.id ?? null,
					e2eeEnabled: true,
					e2eeCreatedAt: new Date(),
				})
				.returning();

			await logWhiteboardActivity(ctx.db, {
				whiteboardId: created.id,
				userId: ctx.user.id,
				type: "board_created",
				metadata: { name: created.name },
			});

			return created;
		}),

	/** Gast-Canvas: browserseitig verschluesselten Y.js-Stand in die Cloud uebernehmen. */
	createWithState: protectedProcedure
		.input(createWhiteboardWithStateSchema)
		.mutation(async ({ ctx, input }) => {
			const workspace = await ensureOwnedWorkspace(ctx.db, ctx.user);
			const folder = await requireFolderInOwnedWorkspace(
				ctx,
				workspace.id,
				input.folderId,
			);
			const created = await ctx.db.transaction(async (tx) => {
				const [board] = await tx
					.insert(whiteboards)
					.values({
						name: input.name,
						ownerId: ctx.user.id,
						teamId: workspace.id,
						folderId: folder?.id ?? null,
						e2eeEnabled: true,
						e2eeKeyHint: input.e2eeKeyHint?.trim() || null,
						e2eeCreatedAt: new Date(),
						yjsState: null,
					})
					.returning();

				if (!board) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Board konnte nicht erstellt werden",
					});
				}

				await tx.insert(whiteboardE2eeUpdates).values({
					whiteboardId: board.id,
					userId: ctx.user.id,
					clientId: `initial-${Date.now()}`,
					update: input.e2eeInitialUpdate,
				});

				return board;
			});

			await logWhiteboardActivity(ctx.db, {
				whiteboardId: created.id,
				userId: ctx.user.id,
				type: "board_created",
				metadata: { name: created.name },
			});

			return created;
		}),

	update: protectedProcedure
		.input(updateWhiteboardSchema)
		.mutation(async ({ ctx, input }) => {
			const access = await requireBoardOwner(ctx, input.id);

			const updateData: Record<string, unknown> = {};
			if (input.name !== undefined) updateData.name = input.name;
			if (input.folderId !== undefined) {
				const folder = await requireFolderInOwnedWorkspace(
					ctx,
					access.whiteboard.teamId ??
						(await ensureOwnedWorkspace(ctx.db, ctx.user)).id,
					input.folderId,
				);
				updateData.folderId = folder?.id ?? null;
			}

			const [updated] = await ctx.db
				.update(whiteboards)
				.set({ ...updateData, updatedAt: new Date() })
				.where(eq(whiteboards.id, input.id))
				.returning();

			if (!updated) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Board nicht gefunden",
				});
			}

			if (input.name !== undefined && input.name !== access.whiteboard.name) {
				await logWhiteboardActivity(ctx.db, {
					whiteboardId: updated.id,
					userId: ctx.user.id,
					type: "board_renamed",
					metadata: { name: input.name, previousName: access.whiteboard.name },
				});
			}

			return updated;
		}),

	/** Board archivieren (Papierkorb) statt endgueltig loeschen. */
	archive: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const access = await requireBoardOwner(ctx, input.id);

			const [updated] = await ctx.db
				.update(whiteboards)
				.set({ archivedAt: new Date(), updatedAt: new Date() })
				.where(eq(whiteboards.id, input.id))
				.returning();

			await logWhiteboardActivity(ctx.db, {
				whiteboardId: input.id,
				userId: ctx.user.id,
				type: "board_archived",
				metadata: { name: access.whiteboard.name },
			});

			return updated;
		}),

	restore: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const { whiteboard } = await requireArchivedBoardOwner(ctx, input.id);

			const [updated] = await ctx.db
				.update(whiteboards)
				.set({ archivedAt: null, updatedAt: new Date() })
				.where(eq(whiteboards.id, input.id))
				.returning();

			await logWhiteboardActivity(ctx.db, {
				whiteboardId: input.id,
				userId: ctx.user.id,
				type: "board_restored",
				metadata: { name: whiteboard.name },
			});

			return updated;
		}),

	/** Endgueltig loeschen — nur aus dem Papierkorb. */
	permanentDelete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const { whiteboard } = await requireArchivedBoardOwner(ctx, input.id);

			await logWhiteboardActivity(ctx.db, {
				whiteboardId: input.id,
				userId: ctx.user.id,
				type: "board_deleted",
				metadata: { name: whiteboard.name },
			});

			await ctx.db.delete(whiteboards).where(eq(whiteboards.id, input.id));
			return { success: true };
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const access = await requireBoardOwner(ctx, input.id);

			const [updated] = await ctx.db
				.update(whiteboards)
				.set({ archivedAt: new Date(), updatedAt: new Date() })
				.where(eq(whiteboards.id, input.id))
				.returning();

			await logWhiteboardActivity(ctx.db, {
				whiteboardId: input.id,
				userId: ctx.user.id,
				type: "board_archived",
				metadata: { name: access.whiteboard.name },
			});

			return updated;
		}),

	getAssignmentOptions: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			await requireBoardMember(ctx, input.id);
			return getBoardCollaborators(ctx.db, input.id);
		}),

	getPresentationSettings: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const access = await requireBoardManageShare(ctx, input.id);
			const shareSettings = getWhiteboardPresentationShareSettings(
				access.whiteboard,
			);

			return {
				id: access.whiteboard.id,
				name: access.whiteboard.name,
				shareEnabled: shareSettings.enabled,
				shareToken: access.whiteboard.presentationShareToken,
				presenceEnabled: shareSettings.presenceEnabled,
				accessMode: shareSettings.accessMode,
				isPresentationActive: isPresentationCurrentlyActive(
					access.whiteboard.presentationActiveUntil,
				),
				allowPublicPresentationLinks: true,
				presentationModeDefault: "edit" as const,
				publicLinksDisabledBy: null,
			};
		}),

	getPresentationAccess: publicProcedure
		.input(z.object({ shareToken: z.string().min(16) }))
		.query(async ({ ctx, input }) => {
			try {
				const access = await getPresentationShareAccess(
					ctx.db,
					input.shareToken,
				);
				return {
					whiteboardId: access.whiteboard.id,
					whiteboardName: access.whiteboard.name,
					e2eeEnabled: access.whiteboard.e2eeEnabled,
					presentationModeDefault: "edit" as const,
					presenceEnabled: access.shareSettings.presenceEnabled,
					accessMode: access.shareSettings.accessMode,
					isPresentationActive: isPresentationCurrentlyActive(
						access.whiteboard.presentationActiveUntil,
					),
				};
			} catch (error) {
				if (
					error instanceof Error &&
					error.message === "presentation-share-inactive"
				) {
					throw createAppError({
						code: "FORBIDDEN",
						appErrorCode: appErrorCodes.presentationShareInactive,
						message: "Diese Praesentation ist aktuell nicht live.",
					});
				}

				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.presentationShareUnavailable,
					message: "Praesentationslink nicht verfuegbar",
				});
			}
		}),

	updatePresentationShare: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				enabled: z.boolean(),
				presenceEnabled: z.boolean().optional(),
				accessMode: whiteboardPresentationAccessModeSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requireBoardManageShare(ctx, input.id);

			const existing = await ctx.db.query.whiteboards.findFirst({
				where: eq(whiteboards.id, input.id),
				columns: {
					presentationShareEnabled: true,
					presentationSharePresenceEnabled: true,
					presentationShareAccessMode: true,
					presentationShareToken: true,
				},
			});

			const [updated] = await ctx.db
				.update(whiteboards)
				.set({
					presentationShareEnabled: input.enabled,
					presentationSharePresenceEnabled:
						input.presenceEnabled ??
						existing?.presentationSharePresenceEnabled ??
						true,
					presentationShareAccessMode:
						input.accessMode ??
						existing?.presentationShareAccessMode ??
						"always",
					presentationShareToken: input.enabled
						? (existing?.presentationShareToken ??
							createPresentationShareToken())
						: (existing?.presentationShareToken ?? null),
					updatedAt: new Date(),
				})
				.where(eq(whiteboards.id, input.id))
				.returning();

			if (!updated) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Board nicht gefunden",
				});
			}

			if (input.enabled && !existing?.presentationShareEnabled) {
				await logWhiteboardActivity(ctx.db, {
					whiteboardId: input.id,
					userId: ctx.user.id,
					type: "presentation_shared",
					metadata: { name: updated.name },
				});
			}

			return {
				shareEnabled: updated.presentationShareEnabled,
				shareToken: updated.presentationShareToken,
				presenceEnabled: updated.presentationSharePresenceEnabled,
				accessMode: updated.presentationShareAccessMode,
			};
		}),

	getCollabShareSettings: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const access = await requireBoardManageShare(ctx, input.id);
			return {
				enabled: access.whiteboard.collabShareEnabled,
				shareToken: access.whiteboard.collabShareToken,
				accessLevel: access.whiteboard.collabShareAccessLevel,
			};
		}),

	updateCollabShare: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				enabled: z.boolean(),
				accessLevel: z.enum(["view", "edit"]).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requireBoardManageShare(ctx, input.id);

			const existing = await ctx.db.query.whiteboards.findFirst({
				where: eq(whiteboards.id, input.id),
				columns: {
					collabShareEnabled: true,
					collabShareToken: true,
					collabShareAccessLevel: true,
				},
			});

			const [updated] = await ctx.db
				.update(whiteboards)
				.set({
					collabShareEnabled: input.enabled,
					collabShareAccessLevel:
						input.accessLevel ?? existing?.collabShareAccessLevel ?? "edit",
					collabShareToken: input.enabled
						? (existing?.collabShareToken ?? createCollabShareToken())
						: (existing?.collabShareToken ?? null),
					updatedAt: new Date(),
				})
				.where(eq(whiteboards.id, input.id))
				.returning();

			if (!updated) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Board nicht gefunden",
				});
			}

			return {
				enabled: updated.collabShareEnabled,
				shareToken: updated.collabShareToken,
				accessLevel: updated.collabShareAccessLevel,
			};
		}),

	resolveCollabShare: publicProcedure
		.input(z.object({ shareToken: z.string().min(16) }))
		.query(async ({ ctx, input }) => {
			try {
				const access = await resolveCollabShareAccess(ctx.db, input.shareToken);
				return {
					whiteboardId: access.whiteboard.id,
					whiteboardName: access.whiteboard.name,
					canWrite: access.canWrite,
					accessLevel: access.whiteboard.collabShareAccessLevel,
					e2eeEnabled: access.whiteboard.e2eeEnabled,
				};
			} catch {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Kollaborationslink nicht verfügbar",
				});
			}
		}),

	getEmbedShareSettings: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const access = await requireBoardManageShare(ctx, input.id);
			return {
				enabled: access.whiteboard.embedShareEnabled,
				shareToken: access.whiteboard.embedShareToken,
			};
		}),

	getE2eeSettings: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const access = await requireBoardMember(ctx, input.id);
			return {
				enabled: access.whiteboard.e2eeEnabled,
				keyHint: access.whiteboard.e2eeKeyHint,
				createdAt: access.whiteboard.e2eeCreatedAt,
			};
		}),

	enableE2ee: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				keyHint: z.string().max(120).optional(),
				initialUpdate: z.string().min(1).max(4_000_000).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const access = await requireBoardOwner(ctx, input.id);
			if (
				!input.initialUpdate &&
				!access.whiteboard.e2eeEnabled &&
				access.whiteboard.yjsState &&
				access.whiteboard.yjsState.length > 0
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Initiales E2EE-Update fehlt",
				});
			}

			const updated = await ctx.db.transaction(async (tx) => {
				const [board] = await tx
					.update(whiteboards)
					.set({
						e2eeEnabled: true,
						e2eeKeyHint: input.keyHint?.trim() || null,
						e2eeCreatedAt: access.whiteboard.e2eeCreatedAt ?? new Date(),
						yjsState: null,
						updatedAt: new Date(),
					})
					.where(eq(whiteboards.id, input.id))
					.returning({
						enabled: whiteboards.e2eeEnabled,
						keyHint: whiteboards.e2eeKeyHint,
						createdAt: whiteboards.e2eeCreatedAt,
					});

				if (!board) {
					throw createAppError({
						code: "NOT_FOUND",
						appErrorCode: appErrorCodes.whiteboardNotFound,
						message: "Board nicht gefunden",
					});
				}

				if (input.initialUpdate) {
					await tx.insert(whiteboardE2eeUpdates).values({
						whiteboardId: input.id,
						userId: ctx.user.id,
						clientId: `migration-${Date.now()}`,
						update: input.initialUpdate,
					});
				}

				return board;
			});

			return updated;
		}),

	updateEmbedShare: protectedProcedure
		.input(z.object({ id: z.string().uuid(), enabled: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			await requireBoardManageShare(ctx, input.id);

			const existing = await ctx.db.query.whiteboards.findFirst({
				where: eq(whiteboards.id, input.id),
				columns: {
					embedShareEnabled: true,
					embedShareToken: true,
				},
			});

			const [updated] = await ctx.db
				.update(whiteboards)
				.set({
					embedShareEnabled: input.enabled,
					embedShareToken: input.enabled
						? (existing?.embedShareToken ?? createEmbedShareToken())
						: (existing?.embedShareToken ?? null),
					updatedAt: new Date(),
				})
				.where(eq(whiteboards.id, input.id))
				.returning();

			if (!updated) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Board nicht gefunden",
				});
			}

			return {
				enabled: updated.embedShareEnabled,
				shareToken: updated.embedShareToken,
			};
		}),

	resolveEmbedShare: publicProcedure
		.input(z.object({ shareToken: z.string().min(16) }))
		.query(async ({ ctx, input }) => {
			const board = await ctx.db.query.whiteboards.findFirst({
				where: eq(whiteboards.embedShareToken, input.shareToken),
			});
			if (!board || !board.embedShareEnabled || board.archivedAt) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Embed-Link nicht verfuegbar",
				});
			}
			return {
				whiteboardId: board.id,
				whiteboardName: board.name,
				e2eeEnabled: board.e2eeEnabled,
			};
		}),

	listE2eeUpdates: publicProcedure
		.input(
			e2eeAccessInputSchema.extend({
				limit: z.number().min(1).max(2000).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const access = await requireE2eeUpdateAccess(ctx, input);
			if (!access.whiteboard.e2eeEnabled) return [];

			return ctx.db.query.whiteboardE2eeUpdates.findMany({
				where: eq(whiteboardE2eeUpdates.whiteboardId, input.whiteboardId),
				orderBy: asc(whiteboardE2eeUpdates.createdAt),
				...(input.limit ? { limit: input.limit } : {}),
				columns: {
					id: true,
					clientId: true,
					update: true,
					createdAt: true,
				},
			});
		}),

	appendE2eeUpdate: publicProcedure
		.input(
			e2eeAccessInputSchema.extend({
				clientId: z.string().min(8).max(120),
				update: z.string().min(1).max(4_000_000),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const access = await requireE2eeUpdateAccess(ctx, input);
			if (!access.whiteboard.e2eeEnabled) {
				throw createAppError({
					code: "BAD_REQUEST",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "E2EE ist fuer dieses Board nicht aktiviert",
				});
			}
			if (!access.canWrite) {
				throw createAppError({
					code: "FORBIDDEN",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Keine Schreibrechte fuer dieses Board",
				});
			}

			const [created] = await ctx.db
				.insert(whiteboardE2eeUpdates)
				.values({
					whiteboardId: input.whiteboardId,
					userId: access.userId,
					clientId: input.clientId,
					update: input.update,
				})
				.returning({
					id: whiteboardE2eeUpdates.id,
					createdAt: whiteboardE2eeUpdates.createdAt,
				});

			return created;
		}),

	regeneratePresentationShareToken: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			await requireBoardManageShare(ctx, input.id);

			const [updated] = await ctx.db
				.update(whiteboards)
				.set({
					presentationShareEnabled: true,
					presentationShareToken: createPresentationShareToken(),
					updatedAt: new Date(),
				})
				.where(eq(whiteboards.id, input.id))
				.returning();

			if (!updated) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Board nicht gefunden",
				});
			}

			return {
				shareEnabled: updated.presentationShareEnabled,
				shareToken: updated.presentationShareToken,
				presenceEnabled: updated.presentationSharePresenceEnabled,
				accessMode: updated.presentationShareAccessMode,
			};
		}),

	heartbeatPresentationSession: protectedProcedure
		.input(z.object({ id: z.string().uuid(), active: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			await requireBoardMember(ctx, input.id);

			const activeUntil = input.active ? new Date(Date.now() + 90_000) : null;

			const [updated] = await ctx.db
				.update(whiteboards)
				.set({ presentationActiveUntil: activeUntil, updatedAt: new Date() })
				.where(eq(whiteboards.id, input.id))
				.returning({
					id: whiteboards.id,
					presentationActiveUntil: whiteboards.presentationActiveUntil,
				});

			if (!updated) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Board nicht gefunden",
				});
			}

			return {
				id: updated.id,
				isPresentationActive: isPresentationCurrentlyActive(
					updated.presentationActiveUntil,
				),
			};
		}),

	listCommentThreads: protectedProcedure
		.input(z.object({ whiteboardId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			await requireBoardMember(ctx, input.whiteboardId);

			return ctx.db.query.whiteboardCommentThreads.findMany({
				where: eq(whiteboardCommentThreads.whiteboardId, input.whiteboardId),
				orderBy: desc(whiteboardCommentThreads.updatedAt),
				with: {
					createdBy: { columns: { id: true, name: true, image: true } },
					messages: {
						orderBy: asc(whiteboardCommentMessages.createdAt),
						with: {
							author: { columns: { id: true, name: true, image: true } },
						},
					},
				},
			});
		}),

	createCommentThread: protectedProcedure
		.input(
			z.object({
				whiteboardId: z.string().uuid(),
				x: z.number(),
				y: z.number(),
				body: z.string().min(1).max(2000),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requireBoardComment(ctx, input.whiteboardId);

			const now = new Date();
			const [thread] = await ctx.db
				.insert(whiteboardCommentThreads)
				.values({
					whiteboardId: input.whiteboardId,
					x: input.x,
					y: input.y,
					createdById: ctx.user.id,
					createdAt: now,
					updatedAt: now,
				})
				.returning();

			const body = input.body.trim();
			await ctx.db.insert(whiteboardCommentMessages).values({
				threadId: thread.id,
				authorId: ctx.user.id,
				body,
			});

			const board = await ctx.db.query.whiteboards.findFirst({
				where: eq(whiteboards.id, input.whiteboardId),
				columns: { name: true },
			});
			void notifyMentionedUsers(ctx.db, {
				whiteboardId: input.whiteboardId,
				boardName: board?.name ?? "Whiteboard",
				authorId: ctx.user.id,
				authorName: ctx.user.name,
				body,
			});

			return thread;
		}),

	addCommentReply: protectedProcedure
		.input(
			z.object({
				whiteboardId: z.string().uuid(),
				threadId: z.string().uuid(),
				body: z.string().min(1).max(2000),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requireBoardComment(ctx, input.whiteboardId);

			const thread = await ctx.db.query.whiteboardCommentThreads.findFirst({
				where: and(
					eq(whiteboardCommentThreads.id, input.threadId),
					eq(whiteboardCommentThreads.whiteboardId, input.whiteboardId),
				),
			});

			if (!thread) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Kommentar-Thread nicht gefunden",
				});
			}

			const body = input.body.trim();
			const [message] = await ctx.db
				.insert(whiteboardCommentMessages)
				.values({
					threadId: input.threadId,
					authorId: ctx.user.id,
					body,
				})
				.returning();

			await ctx.db
				.update(whiteboardCommentThreads)
				.set({ updatedAt: new Date() })
				.where(eq(whiteboardCommentThreads.id, input.threadId));

			const board = await ctx.db.query.whiteboards.findFirst({
				where: eq(whiteboards.id, input.whiteboardId),
				columns: { name: true },
			});
			void notifyMentionedUsers(ctx.db, {
				whiteboardId: input.whiteboardId,
				boardName: board?.name ?? "Whiteboard",
				authorId: ctx.user.id,
				authorName: ctx.user.name,
				body,
			});

			return message;
		}),

	setCommentThreadResolved: protectedProcedure
		.input(
			z.object({
				whiteboardId: z.string().uuid(),
				threadId: z.string().uuid(),
				resolved: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requireBoardResolveComments(ctx, input.whiteboardId);

			const thread = await ctx.db.query.whiteboardCommentThreads.findFirst({
				where: and(
					eq(whiteboardCommentThreads.id, input.threadId),
					eq(whiteboardCommentThreads.whiteboardId, input.whiteboardId),
				),
			});

			if (!thread) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Kommentar-Thread nicht gefunden",
				});
			}

			await ctx.db
				.update(whiteboardCommentThreads)
				.set({
					resolvedAt: input.resolved ? new Date() : null,
					updatedAt: new Date(),
				})
				.where(eq(whiteboardCommentThreads.id, input.threadId));

			return { success: true };
		}),

	deleteCommentThread: protectedProcedure
		.input(
			z.object({
				whiteboardId: z.string().uuid(),
				threadId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const thread = await ctx.db.query.whiteboardCommentThreads.findFirst({
				where: and(
					eq(whiteboardCommentThreads.id, input.threadId),
					eq(whiteboardCommentThreads.whiteboardId, input.whiteboardId),
				),
			});

			if (!thread) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Kommentar-Thread nicht gefunden",
				});
			}

			await requireBoardMember(ctx, input.whiteboardId);
			if (thread.createdById !== ctx.user.id) {
				await requireBoardResolveComments(ctx, input.whiteboardId);
			}

			await ctx.db
				.delete(whiteboardCommentThreads)
				.where(eq(whiteboardCommentThreads.id, input.threadId));

			return { success: true };
		}),

	deleteCommentMessage: protectedProcedure
		.input(
			z.object({
				whiteboardId: z.string().uuid(),
				messageId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const message = await ctx.db.query.whiteboardCommentMessages.findFirst({
				where: eq(whiteboardCommentMessages.id, input.messageId),
				with: { thread: true },
			});

			if (
				!message?.thread ||
				message.thread.whiteboardId !== input.whiteboardId
			) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Kommentar nicht gefunden",
				});
			}

			await requireBoardMember(ctx, input.whiteboardId);
			if (message.authorId !== ctx.user.id) {
				await requireBoardOwner(ctx, input.whiteboardId);
			}

			await ctx.db
				.delete(whiteboardCommentMessages)
				.where(eq(whiteboardCommentMessages.id, input.messageId));

			await ctx.db
				.update(whiteboardCommentThreads)
				.set({ updatedAt: new Date() })
				.where(eq(whiteboardCommentThreads.id, message.threadId));

			return { success: true };
		}),

	inviteByEmail: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				email: z.string().email(),
				roleId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const access = await requireBoardInvite(ctx, input.id);
			const role = await requireWhiteboardRole(ctx.db, input.id, input.roleId);
			const permissions = parseTeamRolePermissions(role.permissions);
			const memberValues = membershipValuesFromRole(role.id, permissions);

			const email = normalizeInviteEmail(input.email);
			const user = await ctx.db.query.users.findFirst({
				where: eq(users.email, email),
			});

			if (!user) {
				const invite = await createRegistrationInvite(ctx.db, {
					email,
					invitedById: ctx.user.id,
					purpose: "board",
					whiteboardId: input.id,
					whiteboardRoleId: role.id,
					boardAccessLevel: memberValues.accessLevel,
				});
				const inviteUrl = buildRegistrationInviteUrl({
					token: invite.token,
					email,
					redirect: `/board/${input.id}`,
				});
				const delivery = await sendRegistrationInviteEmail(ctx.db, {
					email,
					url: inviteUrl,
					inviterName: ctx.user.name,
					context: access.whiteboard.name,
				});

				await logWhiteboardActivity(ctx.db, {
					whiteboardId: input.id,
					userId: ctx.user.id,
					type: "member_invited",
					metadata: {
						email,
						accessLevel: memberValues.accessLevel,
						roleName: role.name,
						pendingRegistration: true,
					},
				});

				return {
					success: true,
					pendingRegistration: true,
					emailDelivered: delivery.delivered,
					inviteUrl,
				};
			}

			if (user.id === access.whiteboard.ownerId) {
				throw createAppError({
					code: "BAD_REQUEST",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Du bist bereits der Besitzer",
				});
			}

			await ctx.db
				.insert(whiteboardMembers)
				.values({
					whiteboardId: input.id,
					userId: user.id,
					...memberValues,
				})
				.onConflictDoUpdate({
					target: [whiteboardMembers.whiteboardId, whiteboardMembers.userId],
					set: memberValues,
				});

			await logWhiteboardActivity(ctx.db, {
				whiteboardId: input.id,
				userId: ctx.user.id,
				type: "member_invited",
				metadata: {
					email: user.email,
					accessLevel: memberValues.accessLevel,
					roleName: role.name,
				},
			});

			return { success: true, pendingRegistration: false };
		}),

	listMembers: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			await requireBoardMember(ctx, input.id);
			return getBoardCollaborators(ctx.db, input.id);
		}),

	/** Rolle eines Board-Mitglieds ändern (nur Board-Besitzer). */
	updateMemberRole: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				userId: z.string(),
				roleId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const access = await requireBoardManageMembers(ctx, input.id);
			if (input.userId === access.whiteboard.ownerId) {
				throw createAppError({
					code: "BAD_REQUEST",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Der Besitzer kann nicht geändert werden",
				});
			}

			const role = await requireWhiteboardRole(ctx.db, input.id, input.roleId);
			const permissions = parseTeamRolePermissions(role.permissions);
			const memberValues = membershipValuesFromRole(role.id, permissions);

			const [updated] = await ctx.db
				.update(whiteboardMembers)
				.set(memberValues)
				.where(
					and(
						eq(whiteboardMembers.whiteboardId, input.id),
						eq(whiteboardMembers.userId, input.userId),
					),
				)
				.returning();

			if (!updated) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Mitglied nicht gefunden",
				});
			}

			return { success: true };
		}),

	/** Mitglied vom Board entfernen (nur Board-Besitzer). */
	removeMember: protectedProcedure
		.input(z.object({ id: z.string().uuid(), userId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const access = await requireBoardManageMembers(ctx, input.id);
			if (input.userId === access.whiteboard.ownerId) {
				throw createAppError({
					code: "BAD_REQUEST",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Der Besitzer kann nicht entfernt werden",
				});
			}

			await ctx.db
				.delete(whiteboardMembers)
				.where(
					and(
						eq(whiteboardMembers.whiteboardId, input.id),
						eq(whiteboardMembers.userId, input.userId),
					),
				);

			return { success: true };
		}),
});
