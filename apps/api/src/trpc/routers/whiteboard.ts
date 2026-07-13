/**
 * Whiteboard/Board-Router – Excalidraw-ähnlich: flache Boards pro User.
 */

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
	type Database,
	teamMembers,
	teamRoles,
	teams,
	userE2eeIdentities,
	users,
	whiteboardCommentMessages,
	whiteboardCommentThreads,
	whiteboardE2eeUpdates,
	whiteboardFolders,
	whiteboardKeyRecipients,
	whiteboardMembers,
	whiteboardPresenterNotes,
	whiteboardTeamRoleAccess,
	whiteboards,
} from "@skedra/db";
import {
	createWhiteboardSchema,
	createWhiteboardWithStateSchema,
	e2eeKeyHashSchema,
	encryptedBoardKeyEnvelopeSchema,
	updateWhiteboardSchema,
	whiteboardPresentationAccessModeSchema,
} from "@skedra/shared";
import {
	accessLevelFromPermissions,
	parseTeamRolePermissions,
} from "@skedra/shared";
import { decryptText, encryptText } from "@skedra/shared/server-crypto";
import { TRPCError } from "@trpc/server";
import {
	and,
	asc,
	desc,
	eq,
	gt,
	inArray,
	isNull,
	lt,
	lte,
	or,
	sql,
} from "drizzle-orm";
import { z } from "zod";
import { env } from "../../env";
import {
	findArchivedBoardsForUser,
	listBoardActivities,
	listRecentActivities,
	logWhiteboardActivity,
} from "../../lib/activity";
import { appErrorCodes, createAppError } from "../../lib/app-errors";
import {
	deleteAssetObjects,
	deleteWhiteboardAndCollectAssetObjects,
} from "../../lib/assets";
import { userHasProductAccess } from "../../lib/billing-entitlement";
import { publishBoardLive } from "../../lib/board-live-bus";
import { membershipValuesFromTeamRole } from "../../lib/board-member-access";
import {
	createCollabShareToken,
	createEmbedShareToken,
	getEmbedShareAccess,
	getCollabShareAccess as resolveCollabShareAccess,
} from "../../lib/collab-share";
import { notifyMentionedUsers } from "../../lib/comment-notifications";
import {
	assertCanAssignTeamRoleForBoard,
	canGrantTeamRolePermissions,
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
	requireBoardViewActivity,
} from "../../lib/permissions";
import {
	countPresentationAudience,
	createPresentationShareToken,
	endPresentationSession,
	getPresentationShareAccess,
	getWhiteboardPresentationShareSettings,
	isPresentationCurrentlyActive,
} from "../../lib/presentation";
import { publishPresentationLive } from "../../lib/presentation-live-bus";
import {
	buildRegistrationInviteUrl,
	createRegistrationInvite,
	normalizeInviteEmail,
} from "../../lib/registration-invites";
import { requireTeamRole } from "../../lib/team-roles";
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
		throw createAppError({
			code: "FORBIDDEN",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "Praesentationslinks erhalten nur die aktuell publizierte Folie",
		});
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
	if (!(await userHasProductAccess(ctx.db, ctx.user.id))) {
		throw createAppError({
			code: "FORBIDDEN",
			appErrorCode: appErrorCodes.subscriptionRequired,
			message: "Ein aktives Skedra-Cloud-Abo ist erforderlich.",
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

type E2eeUpdateAccess = Awaited<ReturnType<typeof requireE2eeUpdateAccess>>;

function assertBoardEncryptionMode(
	access: E2eeUpdateAccess,
	mode: "server" | "e2ee",
) {
	if (access.whiteboard.encryptionMode !== mode) {
		throw createAppError({
			code: "BAD_REQUEST",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message:
				mode === "e2ee"
					? "Dieses Board verwendet serververwaltete Verschluesselung"
					: "Dieses Board ist Ende-zu-Ende verschluesselt",
		});
	}
}

const serverUpdateSchema = z.string().min(1).max(4_000_000);

function encryptServerUpdate(update: string) {
	return encryptText(update, getYjsEncryptionOptions());
}

function decryptServerUpdate(update: string) {
	return decryptText(update, getYjsEncryptionOptions());
}

/**
 * Vergleicht zwei E2EE-Key-Verifier (SHA-256-Hex, 64 Zeichen) in konstanter Zeit.
 *
 * Der Key-Hash ist der serverseitige Nachweis, dass ein Schreibender den echten
 * E2EE-Schluessel besitzt. Ein normaler String-Vergleich (`===`/`!==`) bricht beim
 * ersten abweichenden Zeichen ab und verraet ueber die Antwortzeit, wie viele
 * Zeichen stimmen (Timing-Seitenkanal). `timingSafeEqual` vergleicht immer die
 * komplette Laenge und schliesst diesen Seitenkanal aus.
 */
function keyHashesEqual(
	a: string | null | undefined,
	b: string | null | undefined,
) {
	// Fehlende Werte oder Laengenunterschiede vorab abfangen – timingSafeEqual
	// wirft bei unterschiedlich langen Buffern und wuerde selbst wieder Timing leaken.
	if (!a || !b || a.length !== b.length) return false;
	return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function assertE2eeKeyHashMatches(
	whiteboard: typeof whiteboards.$inferSelect,
	keyHash: string,
) {
	if (!whiteboard.e2eeKeyHash) {
		throw createAppError({
			code: "BAD_REQUEST",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "E2EE-Key-Verifier fehlt fuer dieses Board",
		});
	}
	if (!keyHashesEqual(keyHash, whiteboard.e2eeKeyHash)) {
		throw createAppError({
			code: "FORBIDDEN",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "E2EE-Key passt nicht zu diesem Board",
		});
	}
}

function assertCanWriteE2eeUpdate(access: E2eeUpdateAccess, keyHash: string) {
	assertE2eeKeyHashMatches(access.whiteboard, keyHash);
	if (!access.canWrite) {
		throw createAppError({
			code: "FORBIDDEN",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "Keine Schreibrechte fuer dieses Board",
		});
	}
}

function createUserE2eePublicKeyHash(publicKey: string) {
	return createHash("sha256").update(publicKey, "utf8").digest("hex");
}

async function requireUserE2eePublicKeyHash(db: Database, userId: string) {
	const identity = await db.query.userE2eeIdentities.findFirst({
		where: eq(userE2eeIdentities.userId, userId),
		columns: { publicKey: true },
	});
	if (!identity) {
		throw createAppError({
			code: "BAD_REQUEST",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "E2EE-Identity fehlt fuer diesen Empfaenger",
		});
	}
	return createUserE2eePublicKeyHash(identity.publicKey);
}

function assertBoardKeyEnvelopeMetadata(
	encryptedBoardKey: string,
	expected: {
		whiteboardId: string;
		userId: string;
		keyHash: string;
		recipientPublicKeyHash: string;
	},
) {
	let parsed: unknown;
	try {
		parsed = JSON.parse(encryptedBoardKey);
	} catch {
		throw createAppError({
			code: "BAD_REQUEST",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "E2EE-Key-Umschlag ist ungueltig",
		});
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw createAppError({
			code: "BAD_REQUEST",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "E2EE-Key-Umschlag ist ungueltig",
		});
	}
	const envelope = parsed as Record<string, unknown>;
	if (
		envelope.v !== 1 ||
		envelope.alg !== "ECDH-P256-AES-GCM-256" ||
		envelope.boardId !== expected.whiteboardId ||
		envelope.recipientUserId !== expected.userId ||
		envelope.keyHash !== expected.keyHash ||
		envelope.recipientPublicKeyHash !== expected.recipientPublicKeyHash ||
		typeof envelope.iv !== "string" ||
		typeof envelope.data !== "string" ||
		!envelope.epk ||
		typeof envelope.epk !== "object" ||
		Array.isArray(envelope.epk)
	) {
		throw createAppError({
			code: "BAD_REQUEST",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "E2EE-Key-Umschlag passt nicht zu Board oder Empfaenger",
		});
	}
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
			await requireBoardViewActivity(ctx, input.whiteboardId);
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
				e2eeKeyHint: access.whiteboard.e2eeKeyHint,
				e2eeHasKeyHash: !!access.whiteboard.e2eeKeyHash,
				e2eeCreatedAt: access.whiteboard.e2eeCreatedAt,
				encryptionMode: access.whiteboard.encryptionMode,
			};
		}),

	listInviteRoles: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const access = await requireBoardMember(ctx, input.id);
			if (!access.whiteboard.teamId) return [];

			const [roles, grants] = await Promise.all([
				ctx.db.query.teamRoles.findMany({
					where: eq(teamRoles.teamId, access.whiteboard.teamId),
					orderBy: asc(teamRoles.createdAt),
				}),
				ctx.db.query.whiteboardTeamRoleAccess.findMany({
					where: eq(whiteboardTeamRoleAccess.whiteboardId, input.id),
					columns: { teamRoleId: true },
				}),
			]);
			const grantedRoleIds = new Set(grants.map((grant) => grant.teamRoleId));
			return roles
				.map((role) => ({
					id: role.id,
					name: role.name,
					color: role.color,
					permissions: parseTeamRolePermissions(role.permissions),
					granted: grantedRoleIds.has(role.id),
				}))
				.filter(
					(role) =>
						role.granted ||
						access.canManage ||
						canGrantTeamRolePermissions(access.permissions, role.permissions),
				);
		}),

	setTeamRoleAccess: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				roleId: z.string().uuid(),
				enabled: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const access = await requireBoardManageMembers(ctx, input.id);
			if (!access.whiteboard.teamId) {
				throw createAppError({
					code: "BAD_REQUEST",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Board gehoert zu keinem Workspace",
				});
			}

			const role = await requireTeamRole(
				ctx.db,
				access.whiteboard.teamId,
				input.roleId,
			);
			if (input.enabled) {
				assertCanAssignTeamRoleForBoard(
					access,
					parseTeamRolePermissions(role.permissions),
				);
			}

			if (input.enabled) {
				await ctx.db
					.insert(whiteboardTeamRoleAccess)
					.values({ whiteboardId: input.id, teamRoleId: input.roleId })
					.onConflictDoNothing();
			} else {
				await ctx.db
					.delete(whiteboardTeamRoleAccess)
					.where(
						and(
							eq(whiteboardTeamRoleAccess.whiteboardId, input.id),
							eq(whiteboardTeamRoleAccess.teamRoleId, input.roleId),
						),
					);
			}

			return { success: true };
		}),

	create: protectedProcedure
		.input(createWhiteboardSchema)
		.mutation(async ({ ctx, input }) => {
			if (
				input.encryptionMode === "e2ee" &&
				input.ownEncryptedBoardKey &&
				!input.id
			) {
				throw createAppError({
					code: "BAD_REQUEST",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Board-ID fehlt fuer gebundenen E2EE-Key-Umschlag",
				});
			}
			if (input.encryptionMode === "e2ee" && input.ownEncryptedBoardKey) {
				const recipientPublicKeyHash = await requireUserE2eePublicKeyHash(
					ctx.db,
					ctx.user.id,
				);
				assertBoardKeyEnvelopeMetadata(input.ownEncryptedBoardKey, {
					whiteboardId: input.id as string,
					userId: ctx.user.id,
					keyHash: input.e2eeKeyHash,
					recipientPublicKeyHash,
				});
			}
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
						...(input.id ? { id: input.id } : {}),
						name: input.name,
						ownerId: ctx.user.id,
						teamId: workspace.id,
						folderId: folder?.id ?? null,
						encryptionMode: input.encryptionMode,
						...(input.encryptionMode === "e2ee"
							? {
									e2eeKeyHash: input.e2eeKeyHash,
									e2eeCreatedAt: new Date(),
								}
							: {}),
					})
					.returning();

				if (!board) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Board konnte nicht erstellt werden",
					});
				}

				if (input.encryptionMode === "e2ee" && input.ownEncryptedBoardKey) {
					await tx.insert(whiteboardKeyRecipients).values({
						whiteboardId: board.id,
						userId: ctx.user.id,
						encryptedBoardKey: input.ownEncryptedBoardKey,
					});
				}

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

	/** Gast-Canvas: browserseitig verschluesselten Y.js-Stand in die Cloud uebernehmen. */
	createWithState: protectedProcedure
		.input(createWhiteboardWithStateSchema)
		.mutation(async ({ ctx, input }) => {
			if (
				input.encryptionMode === "e2ee" &&
				input.ownEncryptedBoardKey &&
				!input.id
			) {
				throw createAppError({
					code: "BAD_REQUEST",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Board-ID fehlt fuer gebundenen E2EE-Key-Umschlag",
				});
			}
			if (input.encryptionMode === "e2ee" && input.ownEncryptedBoardKey) {
				const recipientPublicKeyHash = await requireUserE2eePublicKeyHash(
					ctx.db,
					ctx.user.id,
				);
				assertBoardKeyEnvelopeMetadata(input.ownEncryptedBoardKey, {
					whiteboardId: input.id as string,
					userId: ctx.user.id,
					keyHash: input.e2eeKeyHash,
					recipientPublicKeyHash,
				});
			}
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
						...(input.id ? { id: input.id } : {}),
						name: input.name,
						ownerId: ctx.user.id,
						teamId: workspace.id,
						folderId: folder?.id ?? null,
						encryptionMode: input.encryptionMode,
						...(input.encryptionMode === "e2ee"
							? {
									e2eeKeyHint: input.e2eeKeyHint?.trim() || null,
									e2eeKeyHash: input.e2eeKeyHash,
									e2eeCreatedAt: new Date(),
								}
							: {}),
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
					update:
						input.encryptionMode === "e2ee"
							? input.e2eeInitialUpdate
							: encryptServerUpdate(input.stateBase64),
				});

				if (input.encryptionMode === "e2ee" && input.ownEncryptedBoardKey) {
					await tx.insert(whiteboardKeyRecipients).values({
						whiteboardId: board.id,
						userId: ctx.user.id,
						encryptedBoardKey: input.ownEncryptedBoardKey,
					});
				}

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

			const assetObjects = await deleteWhiteboardAndCollectAssetObjects({
				db: ctx.db,
				whiteboardId: input.id,
			});
			await deleteAssetObjects({
				db: ctx.db,
				objects: assetObjects,
				whiteboardId: input.id,
			});
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
					encryptionMode: access.whiteboard.encryptionMode,
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

	listPresenterNotes: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const access = await requireBoardMember(ctx, input.id);
			if (!access.canWrite) {
				throw createAppError({
					code: "FORBIDDEN",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Keine Leserechte fuer Sprechernotizen",
				});
			}
			return ctx.db.query.whiteboardPresenterNotes.findMany({
				where: eq(whiteboardPresenterNotes.whiteboardId, input.id),
				columns: {
					viewId: true,
					content: true,
					encrypted: true,
					updatedAt: true,
				},
			});
		}),

	updatePresenterNote: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				viewId: z.string().min(1).max(160),
				content: z.string().max(200_000),
				encrypted: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const access = await requireBoardMember(ctx, input.id);
			if (!access.canWrite) {
				throw createAppError({
					code: "FORBIDDEN",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Keine Schreibrechte fuer Sprechernotizen",
				});
			}
			const mustEncrypt = access.whiteboard.encryptionMode === "e2ee";
			if (input.encrypted !== mustEncrypt) {
				throw createAppError({
					code: "BAD_REQUEST",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: mustEncrypt
						? "E2EE-Sprechernotizen muessen clientseitig verschluesselt sein"
						: "Server-Boards erwarten Klartextnotizen im geschuetzten Mitgliederbereich",
				});
			}

			const [note] = await ctx.db
				.insert(whiteboardPresenterNotes)
				.values({
					whiteboardId: input.id,
					viewId: input.viewId,
					content: input.content,
					encrypted: input.encrypted,
					updatedById: ctx.user.id,
				})
				.onConflictDoUpdate({
					target: [
						whiteboardPresenterNotes.whiteboardId,
						whiteboardPresenterNotes.viewId,
					],
					set: {
						content: input.content,
						encrypted: input.encrypted,
						updatedById: ctx.user.id,
						updatedAt: new Date(),
					},
				})
				.returning({
					viewId: whiteboardPresenterNotes.viewId,
					updatedAt: whiteboardPresenterNotes.updatedAt,
				});
			return note;
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
					presentationSessionId: true,
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
					...(input.enabled
						? {}
						: {
								presentationActiveUntil: null,
								presentationSessionId: null,
								presentationPresenterId: null,
								presentationFrameSequence: null,
								presentationFramePayload: null,
								presentationFrameAssetIds: null,
								presentationFrameUpdatedAt: null,
							}),
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
			if (!input.enabled && existing?.presentationShareEnabled) {
				publishPresentationLive({
					type: "revoke",
					whiteboardId: input.id,
					sessionId: existing.presentationSessionId,
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
					encryptionMode: access.whiteboard.encryptionMode,
					canWrite: access.canWrite,
					accessLevel: access.canWrite ? "edit" : "view",
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

	registerE2eeKeyHash: protectedProcedure
		.input(z.object({ id: z.string().uuid(), keyHash: e2eeKeyHashSchema }))
		.mutation(async ({ ctx, input }) => {
			const access = await requireBoardOwner(ctx, input.id);
			if (access.whiteboard.e2eeKeyHash) {
				// Konstanter-Zeit-Vergleich, siehe keyHashesEqual().
				if (keyHashesEqual(access.whiteboard.e2eeKeyHash, input.keyHash)) {
					return { hasKeyHash: true };
				}
				throw createAppError({
					code: "FORBIDDEN",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "E2EE-Key-Verifier ist bereits gesetzt",
				});
			}

			const [updated] = await ctx.db
				.update(whiteboards)
				.set({ e2eeKeyHash: input.keyHash, updatedAt: new Date() })
				.where(
					and(eq(whiteboards.id, input.id), isNull(whiteboards.e2eeKeyHash)),
				)
				.returning({ hasKeyHash: whiteboards.e2eeKeyHash });

			if (!updated) {
				throw createAppError({
					code: "NOT_FOUND",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Board nicht gefunden",
				});
			}

			return { hasKeyHash: !!updated.hasKeyHash };
		}),

	getOwnKeyRecipient: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			await requireBoardMember(ctx, input.id);
			const recipient = await ctx.db.query.whiteboardKeyRecipients.findFirst({
				where: and(
					eq(whiteboardKeyRecipients.whiteboardId, input.id),
					eq(whiteboardKeyRecipients.userId, ctx.user.id),
				),
				columns: {
					encryptedBoardKey: true,
					updatedAt: true,
				},
			});

			return recipient ?? null;
		}),

	upsertOwnKeyRecipient: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				keyHash: e2eeKeyHashSchema,
				encryptedBoardKey: encryptedBoardKeyEnvelopeSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const access = await requireBoardMember(ctx, input.id);
			assertE2eeKeyHashMatches(access.whiteboard, input.keyHash);
			const recipientPublicKeyHash = await requireUserE2eePublicKeyHash(
				ctx.db,
				ctx.user.id,
			);
			assertBoardKeyEnvelopeMetadata(input.encryptedBoardKey, {
				whiteboardId: input.id,
				userId: ctx.user.id,
				keyHash: input.keyHash,
				recipientPublicKeyHash,
			});

			await ctx.db
				.insert(whiteboardKeyRecipients)
				.values({
					whiteboardId: input.id,
					userId: ctx.user.id,
					encryptedBoardKey: input.encryptedBoardKey,
				})
				.onConflictDoUpdate({
					target: [
						whiteboardKeyRecipients.whiteboardId,
						whiteboardKeyRecipients.userId,
					],
					set: {
						encryptedBoardKey: input.encryptedBoardKey,
						updatedAt: new Date(),
					},
				});

			return { success: true };
		}),

	upsertMemberKeyRecipient: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				userId: z.string(),
				keyHash: e2eeKeyHashSchema,
				encryptedBoardKey: encryptedBoardKeyEnvelopeSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const access = await requireBoardInvite(ctx, input.id);
			assertE2eeKeyHashMatches(access.whiteboard, input.keyHash);

			const targetHasBoardAccess =
				input.userId === access.whiteboard.ownerId ||
				!!(await ctx.db.query.whiteboardMembers.findFirst({
					where: and(
						eq(whiteboardMembers.whiteboardId, input.id),
						eq(whiteboardMembers.userId, input.userId),
					),
					columns: { id: true },
				}));

			if (!targetHasBoardAccess) {
				throw createAppError({
					code: "FORBIDDEN",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Empfaenger hat keinen Zugriff auf dieses Board",
				});
			}

			const recipientPublicKeyHash = await requireUserE2eePublicKeyHash(
				ctx.db,
				input.userId,
			);
			assertBoardKeyEnvelopeMetadata(input.encryptedBoardKey, {
				whiteboardId: input.id,
				userId: input.userId,
				keyHash: input.keyHash,
				recipientPublicKeyHash,
			});

			const [created] = await ctx.db
				.insert(whiteboardKeyRecipients)
				.values({
					whiteboardId: input.id,
					userId: input.userId,
					encryptedBoardKey: input.encryptedBoardKey,
				})
				.onConflictDoNothing({
					target: [
						whiteboardKeyRecipients.whiteboardId,
						whiteboardKeyRecipients.userId,
					],
				})
				.returning({
					id: whiteboardKeyRecipients.id,
				});

			return { success: true, stored: !!created };
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
				encryptionMode: board.encryptionMode,
			};
		}),

	listE2eeUpdates: publicProcedure
		.input(
			e2eeAccessInputSchema.extend({
				afterId: z.string().uuid().optional(),
				afterCreatedAt: z.string().datetime().optional(),
				limit: z.number().min(1).max(1000).default(500),
			}),
		)
		.query(async ({ ctx, input }) => {
			const access = await requireE2eeUpdateAccess(ctx, input);
			assertBoardEncryptionMode(access, "e2ee");
			const afterCreatedAt = input.afterCreatedAt
				? new Date(input.afterCreatedAt)
				: null;
			const where =
				afterCreatedAt && input.afterId
					? and(
							eq(whiteboardE2eeUpdates.whiteboardId, input.whiteboardId),
							or(
								gt(whiteboardE2eeUpdates.createdAt, afterCreatedAt),
								and(
									eq(whiteboardE2eeUpdates.createdAt, afterCreatedAt),
									gt(whiteboardE2eeUpdates.id, input.afterId),
								),
							),
						)
					: eq(whiteboardE2eeUpdates.whiteboardId, input.whiteboardId);

			return ctx.db.query.whiteboardE2eeUpdates.findMany({
				where,
				orderBy: [
					asc(whiteboardE2eeUpdates.createdAt),
					asc(whiteboardE2eeUpdates.id),
				],
				limit: input.limit,
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
				keyHash: e2eeKeyHashSchema,
				update: z.string().min(1).max(4_000_000),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const access = await requireE2eeUpdateAccess(ctx, input);
			assertBoardEncryptionMode(access, "e2ee");
			assertCanWriteE2eeUpdate(access, input.keyHash);

			const created = await ctx.db.transaction(async (tx) => {
				// Updating the parent row first serializes append and compaction for
				// this board. Without this lock, a concurrent append could be assigned
				// an older cursor and be skipped or deleted by compaction.
				await tx
					.update(whiteboards)
					.set({ updatedAt: sql`clock_timestamp()` })
					.where(eq(whiteboards.id, input.whiteboardId));

				const [update] = await tx
					.insert(whiteboardE2eeUpdates)
					.values({
						whiteboardId: input.whiteboardId,
						userId: access.userId,
						clientId: input.clientId,
						update: input.update,
						createdAt: sql`clock_timestamp()`,
					})
					.returning({
						id: whiteboardE2eeUpdates.id,
						createdAt: whiteboardE2eeUpdates.createdAt,
					});
				return update;
			});

			// Realtime: verbundene Clients sofort benachrichtigen (nur Metadaten,
			// kein Klartext). Der Ciphertext wird weiter über listE2eeUpdates geholt.
			publishBoardLive({
				type: "update",
				whiteboardId: input.whiteboardId,
				id: created.id,
				createdAt: created.createdAt.toISOString(),
			});

			return created;
		}),

	compactE2eeUpdates: publicProcedure
		.input(
			e2eeAccessInputSchema.extend({
				clientId: z.string().min(8).max(120),
				keyHash: e2eeKeyHashSchema,
				update: z.string().min(1).max(4_000_000),
				upToId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const access = await requireE2eeUpdateAccess(ctx, input);
			assertBoardEncryptionMode(access, "e2ee");
			assertCanWriteE2eeUpdate(access, input.keyHash);

			const created = await ctx.db.transaction(async (tx) => {
				await tx
					.update(whiteboards)
					.set({ updatedAt: sql`clock_timestamp()` })
					.where(eq(whiteboards.id, input.whiteboardId));

				const [cutoff] = await tx
					.select({
						id: whiteboardE2eeUpdates.id,
						createdAt: whiteboardE2eeUpdates.createdAt,
					})
					.from(whiteboardE2eeUpdates)
					.where(
						and(
							eq(whiteboardE2eeUpdates.whiteboardId, input.whiteboardId),
							eq(whiteboardE2eeUpdates.id, input.upToId),
						),
					)
					.limit(1);

				if (!cutoff) {
					throw createAppError({
						code: "BAD_REQUEST",
						appErrorCode: appErrorCodes.whiteboardAccessDenied,
						message: "E2EE-Compaction-Cursor ist ungueltig",
					});
				}

				await tx
					.delete(whiteboardE2eeUpdates)
					.where(
						and(
							eq(whiteboardE2eeUpdates.whiteboardId, input.whiteboardId),
							or(
								lt(whiteboardE2eeUpdates.createdAt, cutoff.createdAt),
								and(
									eq(whiteboardE2eeUpdates.createdAt, cutoff.createdAt),
									lte(whiteboardE2eeUpdates.id, input.upToId),
								),
							),
						),
					);

				const [snapshot] = await tx
					.insert(whiteboardE2eeUpdates)
					.values({
						whiteboardId: input.whiteboardId,
						userId: access.userId,
						clientId: input.clientId,
						update: input.update,
						createdAt: sql`clock_timestamp()`,
					})
					.returning({
						id: whiteboardE2eeUpdates.id,
						createdAt: whiteboardE2eeUpdates.createdAt,
					});
				return snapshot;
			});

			// Realtime: Snapshot/Compaction ebenfalls live signalisieren.
			publishBoardLive({
				type: "compact",
				whiteboardId: input.whiteboardId,
				id: created.id,
				createdAt: created.createdAt.toISOString(),
			});

			return created;
		}),

	listServerUpdates: publicProcedure
		.input(
			e2eeAccessInputSchema.extend({
				afterId: z.string().uuid().optional(),
				afterCreatedAt: z.string().datetime().optional(),
				limit: z.number().min(1).max(1000).default(500),
			}),
		)
		.query(async ({ ctx, input }) => {
			const access = await requireE2eeUpdateAccess(ctx, input);
			assertBoardEncryptionMode(access, "server");
			const afterCreatedAt = input.afterCreatedAt
				? new Date(input.afterCreatedAt)
				: null;
			const where =
				afterCreatedAt && input.afterId
					? and(
							eq(whiteboardE2eeUpdates.whiteboardId, input.whiteboardId),
							or(
								gt(whiteboardE2eeUpdates.createdAt, afterCreatedAt),
								and(
									eq(whiteboardE2eeUpdates.createdAt, afterCreatedAt),
									gt(whiteboardE2eeUpdates.id, input.afterId),
								),
							),
						)
					: eq(whiteboardE2eeUpdates.whiteboardId, input.whiteboardId);

			const rows = await ctx.db.query.whiteboardE2eeUpdates.findMany({
				where,
				orderBy: [
					asc(whiteboardE2eeUpdates.createdAt),
					asc(whiteboardE2eeUpdates.id),
				],
				limit: input.limit,
				columns: {
					id: true,
					clientId: true,
					update: true,
					createdAt: true,
				},
			});

			return rows.map((row) => ({
				...row,
				update: decryptServerUpdate(row.update),
			}));
		}),

	appendServerUpdate: publicProcedure
		.input(
			e2eeAccessInputSchema.extend({
				clientId: z.string().min(8).max(120),
				update: serverUpdateSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const access = await requireE2eeUpdateAccess(ctx, input);
			assertBoardEncryptionMode(access, "server");
			if (!access.canWrite) {
				throw createAppError({
					code: "FORBIDDEN",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Keine Schreibrechte fuer dieses Board",
				});
			}

			const created = await ctx.db.transaction(async (tx) => {
				await tx
					.update(whiteboards)
					.set({ updatedAt: sql`clock_timestamp()` })
					.where(eq(whiteboards.id, input.whiteboardId));

				const [update] = await tx
					.insert(whiteboardE2eeUpdates)
					.values({
						whiteboardId: input.whiteboardId,
						userId: access.userId,
						clientId: input.clientId,
						update: encryptServerUpdate(input.update),
						createdAt: sql`clock_timestamp()`,
					})
					.returning({
						id: whiteboardE2eeUpdates.id,
						createdAt: whiteboardE2eeUpdates.createdAt,
					});
				return update;
			});

			publishBoardLive({
				type: "update",
				whiteboardId: input.whiteboardId,
				id: created.id,
				createdAt: created.createdAt.toISOString(),
			});
			return created;
		}),

	compactServerUpdates: publicProcedure
		.input(
			e2eeAccessInputSchema.extend({
				clientId: z.string().min(8).max(120),
				update: serverUpdateSchema,
				upToId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const access = await requireE2eeUpdateAccess(ctx, input);
			assertBoardEncryptionMode(access, "server");
			if (!access.canWrite) {
				throw createAppError({
					code: "FORBIDDEN",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Keine Schreibrechte fuer dieses Board",
				});
			}

			const created = await ctx.db.transaction(async (tx) => {
				await tx
					.update(whiteboards)
					.set({ updatedAt: sql`clock_timestamp()` })
					.where(eq(whiteboards.id, input.whiteboardId));

				const [cutoff] = await tx
					.select({
						id: whiteboardE2eeUpdates.id,
						createdAt: whiteboardE2eeUpdates.createdAt,
					})
					.from(whiteboardE2eeUpdates)
					.where(
						and(
							eq(whiteboardE2eeUpdates.whiteboardId, input.whiteboardId),
							eq(whiteboardE2eeUpdates.id, input.upToId),
						),
					)
					.limit(1);
				if (!cutoff) {
					throw createAppError({
						code: "BAD_REQUEST",
						appErrorCode: appErrorCodes.whiteboardAccessDenied,
						message: "Server-Compaction-Cursor ist ungueltig",
					});
				}

				await tx
					.delete(whiteboardE2eeUpdates)
					.where(
						and(
							eq(whiteboardE2eeUpdates.whiteboardId, input.whiteboardId),
							or(
								lt(whiteboardE2eeUpdates.createdAt, cutoff.createdAt),
								and(
									eq(whiteboardE2eeUpdates.createdAt, cutoff.createdAt),
									lte(whiteboardE2eeUpdates.id, input.upToId),
								),
							),
						),
					);

				const [snapshot] = await tx
					.insert(whiteboardE2eeUpdates)
					.values({
						whiteboardId: input.whiteboardId,
						userId: access.userId,
						clientId: input.clientId,
						update: encryptServerUpdate(input.update),
						createdAt: sql`clock_timestamp()`,
					})
					.returning({
						id: whiteboardE2eeUpdates.id,
						createdAt: whiteboardE2eeUpdates.createdAt,
					});
				return snapshot;
			});

			publishBoardLive({
				type: "compact",
				whiteboardId: input.whiteboardId,
				id: created.id,
				createdAt: created.createdAt.toISOString(),
			});
			return created;
		}),

	regeneratePresentationShareToken: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			await requireBoardManageShare(ctx, input.id);
			const existing = await ctx.db.query.whiteboards.findFirst({
				where: eq(whiteboards.id, input.id),
				columns: { presentationSessionId: true },
			});

			const [updated] = await ctx.db
				.update(whiteboards)
				.set({
					presentationShareEnabled: true,
					presentationShareToken: createPresentationShareToken(),
					presentationActiveUntil: null,
					presentationSessionId: null,
					presentationPresenterId: null,
					presentationFrameSequence: null,
					presentationFramePayload: null,
					presentationFrameAssetIds: null,
					presentationFrameUpdatedAt: null,
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
			publishPresentationLive({
				type: "revoke",
				whiteboardId: input.id,
				sessionId: existing?.presentationSessionId ?? null,
			});

			return {
				shareEnabled: updated.presentationShareEnabled,
				shareToken: updated.presentationShareToken,
				presenceEnabled: updated.presentationSharePresenceEnabled,
				accessMode: updated.presentationShareAccessMode,
			};
		}),

	startPresentationSession: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const access = await requireBoardMember(ctx, input.id);
			if (!access.canWrite || !access.whiteboard.presentationShareEnabled) {
				throw createAppError({
					code: "FORBIDDEN",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Praesentieren ist fuer dieses Board nicht erlaubt",
				});
			}

			const sessionId = randomUUID();
			const startedAt = new Date();
			const activeUntil = new Date(startedAt.getTime() + 90_000);

			const [updated] = await ctx.db
				.update(whiteboards)
				.set({
					presentationActiveUntil: activeUntil,
					presentationSessionId: sessionId,
					presentationPresenterId: ctx.user.id,
					presentationFrameSequence: null,
					presentationFramePayload: null,
					presentationFrameAssetIds: null,
					presentationFrameUpdatedAt: null,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(whiteboards.id, input.id),
						eq(whiteboards.presentationShareEnabled, true),
						or(
							isNull(whiteboards.presentationActiveUntil),
							lt(whiteboards.presentationActiveUntil, startedAt),
						),
					),
				)
				.returning({
					id: whiteboards.id,
					presentationSessionId: whiteboards.presentationSessionId,
				});

			if (!updated) {
				throw createAppError({
					code: "CONFLICT",
					appErrorCode: appErrorCodes.whiteboardNotFound,
					message: "Auf diesem Board laeuft bereits eine andere Praesentation",
				});
			}

			return {
				id: updated.id,
				sessionId: updated.presentationSessionId as string,
				startedAt: startedAt.toISOString(),
				audienceCount: 0,
			};
		}),

	heartbeatPresentationSession: protectedProcedure
		.input(z.object({ id: z.string().uuid(), sessionId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const access = await requireBoardMember(ctx, input.id);
			if (!access.canWrite) {
				throw createAppError({
					code: "FORBIDDEN",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Keine Berechtigung zum Praesentieren",
				});
			}
			const now = new Date();
			const [updated] = await ctx.db
				.update(whiteboards)
				.set({
					presentationActiveUntil: new Date(now.getTime() + 90_000),
				})
				.where(
					and(
						eq(whiteboards.id, input.id),
						eq(whiteboards.presentationSessionId, input.sessionId),
						eq(whiteboards.presentationPresenterId, ctx.user.id),
						gt(whiteboards.presentationActiveUntil, now),
					),
				)
				.returning({ id: whiteboards.id });
			if (!updated) {
				throw createAppError({
					code: "CONFLICT",
					appErrorCode: appErrorCodes.presentationShareInactive,
					message: "Diese Presenter-Session ist nicht mehr aktiv",
				});
			}
			return {
				id: updated.id,
				isPresentationActive: true,
				audienceCount: await countPresentationAudience(
					ctx.db,
					input.id,
					input.sessionId,
				),
			};
		}),

	endPresentationSession: protectedProcedure
		.input(z.object({ id: z.string().uuid(), sessionId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			await requireBoardMember(ctx, input.id);
			const ended = await endPresentationSession(ctx.db, {
				whiteboardId: input.id,
				sessionId: input.sessionId,
				presenterId: ctx.user.id,
			});
			if (ended) {
				publishPresentationLive({
					type: "ended",
					whiteboardId: input.id,
					sessionId: input.sessionId,
				});
			}
			return { id: input.id, ended };
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
				body: z.string().trim().min(1).max(2000),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await requireBoardComment(ctx, input.whiteboardId);

			const now = new Date();
			const body = input.body.trim();
			const thread = await ctx.db.transaction(async (tx) => {
				const [createdThread] = await tx
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

				await tx.insert(whiteboardCommentMessages).values({
					threadId: createdThread.id,
					authorId: ctx.user.id,
					body,
				});

				return createdThread;
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
				await requireBoardResolveComments(ctx, input.whiteboardId);
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
			if (!access.whiteboard.teamId) {
				throw createAppError({
					code: "BAD_REQUEST",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Board gehoert zu keinem Workspace",
				});
			}
			const role = await requireTeamRole(
				ctx.db,
				access.whiteboard.teamId,
				input.roleId,
			);
			const permissions = parseTeamRolePermissions(role.permissions);
			assertCanAssignTeamRoleForBoard(access, permissions);
			const memberValues = membershipValuesFromTeamRole(role.id);
			const assignedAccessLevel = accessLevelFromPermissions(permissions);

			const email = normalizeInviteEmail(input.email);
			const user = await ctx.db.query.users.findFirst({
				where: eq(users.email, email),
			});
			const workspace = await ctx.db.query.teams.findFirst({
				where: eq(teams.id, access.whiteboard.teamId),
				columns: { ownerId: true },
			});

			if (!user) {
				const invite = await createRegistrationInvite(ctx.db, {
					email,
					invitedById: ctx.user.id,
					purpose: "board",
					teamId: access.whiteboard.teamId,
					teamRoleId: role.id,
					workspaceRole: "member",
					whiteboardId: input.id,
					whiteboardTeamRoleId: role.id,
				});
				const inviteUrl = buildRegistrationInviteUrl({
					token: invite.token,
					email,
					redirect: `/board/${input.id}`,
				});
				await logWhiteboardActivity(ctx.db, {
					whiteboardId: input.id,
					userId: ctx.user.id,
					type: "member_invited",
					metadata: {
						email,
						accessLevel: assignedAccessLevel,
						roleName: role.name,
						pendingRegistration: true,
					},
				});

				return {
					success: true,
					pendingRegistration: true,
					emailDelivered: false,
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

			if (workspace?.ownerId !== user.id) {
				await ctx.db
					.insert(teamMembers)
					.values({
						teamId: access.whiteboard.teamId,
						userId: user.id,
						roleId: role.id,
						workspaceRole: "member",
					})
					.onConflictDoNothing();
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
					accessLevel: assignedAccessLevel,
					roleName: role.name,
				},
			});

			const recipientIdentity = await ctx.db.query.userE2eeIdentities.findFirst(
				{
					where: eq(userE2eeIdentities.userId, user.id),
					columns: { publicKey: true },
				},
			);

			return {
				success: true,
				pendingRegistration: false,
				recipient: {
					userId: user.id,
					publicKey: recipientIdentity?.publicKey ?? null,
				},
			};
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

			if (!access.whiteboard.teamId) {
				throw createAppError({
					code: "BAD_REQUEST",
					appErrorCode: appErrorCodes.whiteboardAccessDenied,
					message: "Board gehoert zu keinem Workspace",
				});
			}
			const role = await requireTeamRole(
				ctx.db,
				access.whiteboard.teamId,
				input.roleId,
			);
			assertCanAssignTeamRoleForBoard(
				access,
				parseTeamRolePermissions(role.permissions),
			);
			const memberValues = membershipValuesFromTeamRole(role.id);
			const workspace = await ctx.db.query.teams.findFirst({
				where: eq(teams.id, access.whiteboard.teamId),
				columns: { ownerId: true },
			});

			if (workspace?.ownerId !== input.userId) {
				await ctx.db
					.insert(teamMembers)
					.values({
						teamId: access.whiteboard.teamId,
						userId: input.userId,
						roleId: role.id,
						workspaceRole: "member",
					})
					.onConflictDoNothing();
			}

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

			await ctx.db.transaction(async (tx) => {
				await tx
					.delete(whiteboardMembers)
					.where(
						and(
							eq(whiteboardMembers.whiteboardId, input.id),
							eq(whiteboardMembers.userId, input.userId),
						),
					);

				await tx
					.delete(whiteboardKeyRecipients)
					.where(
						and(
							eq(whiteboardKeyRecipients.whiteboardId, input.id),
							eq(whiteboardKeyRecipients.userId, input.userId),
						),
					);
			});

			return { success: true };
		}),
});
