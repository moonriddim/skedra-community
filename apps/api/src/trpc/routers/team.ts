/**
 * tRPC Router fuer die Team/Workspace-Verwaltung inkl. Rollen mit Farben.
 */

import {
	teamMembers,
	teamRoles,
	teams,
	users,
	whiteboardMembers,
} from "@skedra/db";
import {
	parseTeamRolePermissions,
	serializeTeamRolePermissions,
	teamRolePermissionsSchema,
} from "@skedra/shared";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { sendRegistrationInviteEmail } from "../../lib/mail";
import {
	buildRegistrationInviteUrl,
	createRegistrationInvite,
	normalizeInviteEmail,
} from "../../lib/registration-invites";
import { syncWorkspaceSubscriptionSeats } from "../../lib/stripe-billing";
import { isValidTeamRoleColor, requireTeamRole } from "../../lib/team-roles";
import { requireManagedWorkspace } from "../../lib/workspace";
import { protectedProcedure, router } from "../init";

const roleColorSchema = z
	.string()
	.regex(/^#[0-9A-Fa-f]{6}$/, "Ungültige Hex-Farbe (#RRGGBB)");

function roleCanManageWorkspaceAdmins(role: typeof teamRoles.$inferSelect) {
	return parseTeamRolePermissions(role.permissions).manageWorkspaceAdmins;
}

function assertCanManageWorkspaceAdmins(
	canManageWorkspaceAdmins: boolean,
	message: string,
) {
	if (!canManageWorkspaceAdmins) {
		throw new Error(message);
	}
}

export const teamRouter = router({
	/** Holt das Team des Users inkl. Mitglieder und Rollen */
	get: protectedProcedure.query(async ({ ctx }) => {
		let team:
			| (typeof teams.$inferSelect & {
					owner: Pick<
						typeof users.$inferSelect,
						"id" | "name" | "email" | "image"
					>;
					roles: (typeof teamRoles.$inferSelect)[];
					members: Array<
						typeof teamMembers.$inferSelect & {
							user: Pick<
								typeof users.$inferSelect,
								"id" | "name" | "email" | "image"
							>;
							role: typeof teamRoles.$inferSelect | null;
						}
					>;
			  })
			| undefined;

		team = await ctx.db.query.teams.findFirst({
			where: eq(teams.ownerId, ctx.user.id),
			with: {
				owner: {
					columns: { id: true, name: true, email: true, image: true },
				},
				roles: { orderBy: asc(teamRoles.createdAt) },
				members: {
					with: {
						user: {
							columns: { id: true, name: true, email: true, image: true },
						},
						role: true,
					},
				},
			},
		});

		if (!team) {
			const membership = await ctx.db.query.teamMembers.findFirst({
				where: eq(teamMembers.userId, ctx.user.id),
				with: {
					team: {
						with: {
							owner: {
								columns: { id: true, name: true, email: true, image: true },
							},
							roles: { orderBy: asc(teamRoles.createdAt) },
							members: {
								with: {
									user: {
										columns: {
											id: true,
											name: true,
											email: true,
											image: true,
										},
									},
									role: true,
								},
							},
						},
					},
				},
			});
			team = membership?.team;
		}

		if (!team) {
			const [created] = await ctx.db
				.insert(teams)
				.values({
					name: `${ctx.user.name}'s Workspace`,
					ownerId: ctx.user.id,
				})
				.returning();

			team = await ctx.db.query.teams.findFirst({
				where: eq(teams.id, created.id),
				with: {
					owner: {
						columns: { id: true, name: true, email: true, image: true },
					},
					roles: { orderBy: asc(teamRoles.createdAt) },
					members: {
						with: {
							user: {
								columns: { id: true, name: true, email: true, image: true },
							},
							role: true,
						},
					},
				},
			});
		}

		if (!team) {
			return null;
		}

		const isOwner = team.ownerId === ctx.user.id;
		const currentMembership = team.members.find(
			(member) => member.userId === ctx.user.id,
		);
		const currentRolePermissions = currentMembership?.role
			? parseTeamRolePermissions(currentMembership.role.permissions)
			: null;
		const canManageWorkspace =
			isOwner || currentMembership?.workspaceRole === "admin";
		const canManageWorkspaceAdmins =
			isOwner ||
			(currentMembership?.workspaceRole === "admin" &&
				(currentRolePermissions?.manageWorkspaceAdmins ?? false));

		return {
			...team,
			isOwner,
			currentUserWorkspaceRole: isOwner
				? ("admin" as const)
				: (currentMembership?.workspaceRole ?? null),
			canManageWorkspace,
			canManageWorkspaceAdmins,
			roles: team.roles.map((role) => ({
				...role,
				permissions: parseTeamRolePermissions(role.permissions),
			})),
			members: team.members.map((member) => ({
				...member,
				role: member.role
					? {
							...member.role,
							permissions: parseTeamRolePermissions(member.role.permissions),
						}
					: null,
			})),
		};
	}),

	updateName: protectedProcedure
		.input(z.object({ name: z.string().min(1).max(100) }))
		.mutation(async ({ ctx, input }) => {
			const { team } = await requireManagedWorkspace(ctx.db, ctx.user.id);

			return ctx.db
				.update(teams)
				.set({ name: input.name.trim() })
				.where(eq(teams.id, team.id))
				.returning();
		}),

	createRole: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(40),
				color: roleColorSchema,
				permissions: teamRolePermissionsSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { team, canManageWorkspaceAdmins } = await requireManagedWorkspace(
				ctx.db,
				ctx.user.id,
			);

			if (!isValidTeamRoleColor(input.color)) {
				throw new Error("Ungültige Farbe");
			}

			if (input.permissions.manageWorkspaceAdmins) {
				assertCanManageWorkspaceAdmins(
					canManageWorkspaceAdmins,
					"Keine Berechtigung, Workspace-Admin-Rechte zu vergeben.",
				);
			}

			const [role] = await ctx.db
				.insert(teamRoles)
				.values({
					teamId: team.id,
					name: input.name.trim(),
					color: input.color,
					permissions: serializeTeamRolePermissions(input.permissions),
				})
				.returning();

			return {
				...role,
				permissions: parseTeamRolePermissions(role.permissions),
			};
		}),

	updateRole: protectedProcedure
		.input(
			z.object({
				roleId: z.string().uuid(),
				name: z.string().min(1).max(40).optional(),
				color: roleColorSchema.optional(),
				permissions: teamRolePermissionsSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { team, canManageWorkspaceAdmins } = await requireManagedWorkspace(
				ctx.db,
				ctx.user.id,
			);
			const existingRole = await requireTeamRole(ctx.db, team.id, input.roleId);
			if (
				roleCanManageWorkspaceAdmins(existingRole) ||
				input.permissions?.manageWorkspaceAdmins
			) {
				assertCanManageWorkspaceAdmins(
					canManageWorkspaceAdmins,
					"Keine Berechtigung, Workspace-Admin-Rechte zu verwalten.",
				);
			}

			const updates: { name?: string; color?: string; permissions?: string } =
				{};
			if (input.name) updates.name = input.name.trim();
			if (input.color) {
				if (!isValidTeamRoleColor(input.color)) {
					throw new Error("Ungültige Farbe");
				}
				updates.color = input.color;
			}
			if (input.permissions) {
				updates.permissions = serializeTeamRolePermissions(input.permissions);
			}

			const [role] = await ctx.db
				.update(teamRoles)
				.set(updates)
				.where(eq(teamRoles.id, input.roleId))
				.returning();

			return {
				...role,
				permissions: parseTeamRolePermissions(role.permissions),
			};
		}),

	deleteRole: protectedProcedure
		.input(z.object({ roleId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const { team, canManageWorkspaceAdmins } = await requireManagedWorkspace(
				ctx.db,
				ctx.user.id,
			);
			const role = await requireTeamRole(ctx.db, team.id, input.roleId);
			if (roleCanManageWorkspaceAdmins(role)) {
				assertCanManageWorkspaceAdmins(
					canManageWorkspaceAdmins,
					"Keine Berechtigung, Rollen mit Workspace-Admin-Rechten zu loeschen.",
				);
			}

			await ctx.db
				.delete(whiteboardMembers)
				.where(eq(whiteboardMembers.teamRoleId, input.roleId));
			await ctx.db.delete(teamRoles).where(eq(teamRoles.id, input.roleId));
			return { success: true };
		}),

	inviteMember: protectedProcedure
		.input(
			z.object({
				email: z.string().email(),
				/** Optional — nur Label im Team, keine Board-Rechte */
				roleId: z.string().uuid().optional(),
				workspaceRole: z.enum(["member", "admin"]).default("member"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { team, canManageWorkspaceAdmins } = await requireManagedWorkspace(
				ctx.db,
				ctx.user.id,
			);
			if (input.roleId) {
				await requireTeamRole(ctx.db, team.id, input.roleId);
			}
			if (input.workspaceRole === "admin") {
				assertCanManageWorkspaceAdmins(
					canManageWorkspaceAdmins,
					"Keine Berechtigung, Workspace-Admins einzuladen.",
				);
			}

			const email = normalizeInviteEmail(input.email);
			const invitedUser = await ctx.db.query.users.findFirst({
				where: eq(users.email, email),
			});

			if (!invitedUser) {
				const invite = await createRegistrationInvite(ctx.db, {
					email,
					invitedById: ctx.user.id,
					purpose: "team",
					teamId: team.id,
					teamRoleId: input.roleId,
					workspaceRole: input.workspaceRole,
				});
				const inviteUrl = buildRegistrationInviteUrl({
					token: invite.token,
					email,
					redirect: "/library",
				});
				const delivery = await sendRegistrationInviteEmail(ctx.db, {
					email,
					url: inviteUrl,
					inviterName: ctx.user.name,
					context: team.name,
				});

				return {
					success: true,
					pendingRegistration: true,
					emailDelivered: delivery.delivered,
					inviteUrl,
				};
			}

			if (invitedUser.id === ctx.user.id) {
				throw new Error("Du kannst dich nicht selbst einladen.");
			}

			const existingMember = await ctx.db.query.teamMembers.findFirst({
				where: and(
					eq(teamMembers.teamId, team.id),
					eq(teamMembers.userId, invitedUser.id),
				),
			});

			if (existingMember) {
				await ctx.db
					.update(teamMembers)
					.set({
						roleId: input.roleId ?? null,
						workspaceRole: input.workspaceRole,
					})
					.where(eq(teamMembers.id, existingMember.id));
			} else {
				await ctx.db.insert(teamMembers).values({
					teamId: team.id,
					userId: invitedUser.id,
					roleId: input.roleId ?? null,
					workspaceRole: input.workspaceRole,
				});
				await syncWorkspaceSubscriptionSeats(ctx.db, team);
			}

			return { success: true, pendingRegistration: false };
		}),

	updateMemberRole: protectedProcedure
		.input(
			z.object({
				userId: z.string(),
				roleId: z.string().uuid().optional(),
				workspaceRole: z.enum(["member", "admin"]).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { team, canManageWorkspaceAdmins } = await requireManagedWorkspace(
				ctx.db,
				ctx.user.id,
			);
			if (input.userId === ctx.user.id) {
				throw new Error("Du kannst deine eigene Workspace-Rolle nicht ändern.");
			}
			if (input.roleId) {
				await requireTeamRole(ctx.db, team.id, input.roleId);
			}

			const targetMember = await ctx.db.query.teamMembers.findFirst({
				where: and(
					eq(teamMembers.teamId, team.id),
					eq(teamMembers.userId, input.userId),
				),
			});
			if (!targetMember) {
				throw new Error("Mitglied nicht gefunden.");
			}
			if (
				targetMember.workspaceRole === "admin" ||
				input.workspaceRole === "admin"
			) {
				assertCanManageWorkspaceAdmins(
					canManageWorkspaceAdmins,
					"Keine Berechtigung, Workspace-Admins zu verwalten.",
				);
			}

			const [updated] = await ctx.db
				.update(teamMembers)
				.set({
					...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
					...(input.workspaceRole
						? { workspaceRole: input.workspaceRole }
						: {}),
				})
				.where(
					and(
						eq(teamMembers.teamId, team.id),
						eq(teamMembers.userId, input.userId),
					),
				)
				.returning();
			if (!updated) {
				throw new Error("Mitglied nicht gefunden.");
			}

			return { success: true };
		}),

	removeMember: protectedProcedure
		.input(z.object({ userId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { team, canManageWorkspaceAdmins } = await requireManagedWorkspace(
				ctx.db,
				ctx.user.id,
			);
			if (input.userId === ctx.user.id) {
				throw new Error("Du kannst dich hier nicht selbst entfernen.");
			}

			const targetMember = await ctx.db.query.teamMembers.findFirst({
				where: and(
					eq(teamMembers.teamId, team.id),
					eq(teamMembers.userId, input.userId),
				),
			});
			if (!targetMember) {
				throw new Error("Mitglied nicht gefunden.");
			}
			if (targetMember.workspaceRole === "admin") {
				assertCanManageWorkspaceAdmins(
					canManageWorkspaceAdmins,
					"Keine Berechtigung, Workspace-Admins zu entfernen.",
				);
			}

			await ctx.db
				.delete(teamMembers)
				.where(
					and(
						eq(teamMembers.teamId, team.id),
						eq(teamMembers.userId, input.userId),
					),
				);
			await syncWorkspaceSubscriptionSeats(ctx.db, team);

			return { success: true };
		}),
});
