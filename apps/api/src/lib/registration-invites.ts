import { randomBytes } from "node:crypto";
import {
	type Database,
	instanceSettings,
	registrationInvites,
	teamMembers,
	teamRoles,
	teams,
	users,
	whiteboardMembers,
} from "@skedra/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import { env } from "../env";
import { membershipValuesFromTeamRole } from "./board-member-access";
import { getOrCreateInstanceSettings } from "./instance-settings";
import { syncWorkspaceSubscriptionSeats } from "./stripe-billing";

const INVITE_TTL_DAYS = 7;

export type RegistrationMode = "open" | "invite" | "closed";

export function normalizeInviteEmail(email: string) {
	return email.trim().toLowerCase();
}

export function buildRegistrationInviteUrl(input: {
	token: string;
	email: string;
	redirect?: string;
}) {
	const url = new URL("/register", env.APP_URL);
	url.searchParams.set("invite", input.token);
	url.searchParams.set("email", input.email);
	if (input.redirect) url.searchParams.set("redirect", input.redirect);
	return url.toString();
}

export async function hasAnyUser(db: Database) {
	const existing = await db.query.users.findFirst({
		columns: { id: true },
	});
	return !!existing;
}

export async function createRegistrationInvite(
	db: Database,
	input: {
		email: string;
		invitedById: string;
		purpose?: "app" | "team" | "board";
		teamId?: string;
		teamRoleId?: string | null;
		workspaceRole?: "member" | "admin";
		whiteboardId?: string;
		whiteboardTeamRoleId?: string | null;
	},
) {
	const email = normalizeInviteEmail(input.email);
	const token = randomBytes(32).toString("hex");
	const expiresAt = new Date(
		Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
	);

	const [invite] = await db
		.insert(registrationInvites)
		.values({
			email,
			token,
			purpose: input.purpose ?? "app",
			invitedById: input.invitedById,
			teamId: input.teamId,
			teamRoleId: input.teamRoleId ?? null,
			workspaceRole: input.workspaceRole ?? "member",
			whiteboardId: input.whiteboardId,
			whiteboardTeamRoleId: input.whiteboardTeamRoleId ?? null,
			expiresAt,
		})
		.returning();

	return invite;
}

export async function findValidRegistrationInvite(
	db: Database,
	input: { email: string; token?: string | null },
) {
	if (!input.token) return null;
	const email = normalizeInviteEmail(input.email);

	return db.query.registrationInvites.findFirst({
		where: and(
			eq(registrationInvites.email, email),
			eq(registrationInvites.token, input.token),
			isNull(registrationInvites.acceptedAt),
			gt(registrationInvites.expiresAt, new Date()),
		),
	});
}

export async function canSignUpWithEmail(
	db: Database,
	input: {
		email: string;
		token?: string | null;
		mode: RegistrationMode;
	},
) {
	const firstUser = !(await hasAnyUser(db));
	if (firstUser) return { allowed: true as const, firstUser, invite: null };
	if (input.mode === "open")
		return { allowed: true as const, firstUser, invite: null };
	if (input.mode === "closed")
		return { allowed: false as const, firstUser, invite: null };

	const invite = await findValidRegistrationInvite(db, input);
	return { allowed: !!invite, firstUser, invite };
}

export async function completeRegistrationInvite(
	db: Database,
	input: { email: string; token?: string | null },
) {
	const invite = await findValidRegistrationInvite(db, input);
	if (!invite) return null;

	const user = await db.query.users.findFirst({
		where: eq(users.email, normalizeInviteEmail(input.email)),
	});
	if (!user) return null;

	if (invite.teamId) {
		const memberValues = {
			teamId: invite.teamId,
			userId: user.id,
			roleId: invite.teamRoleId,
			workspaceRole: invite.workspaceRole,
		};

		if (invite.purpose === "board") {
			await db.insert(teamMembers).values(memberValues).onConflictDoNothing();
		} else {
			await db
				.insert(teamMembers)
				.values(memberValues)
				.onConflictDoUpdate({
					target: [teamMembers.teamId, teamMembers.userId],
					set: {
						roleId: invite.teamRoleId,
						workspaceRole: invite.workspaceRole,
					},
				});
		}
	}

	if (invite.whiteboardId) {
		let memberValues: { teamRoleId: string } | null = null;

		if (invite.whiteboardTeamRoleId) {
			const role = await db.query.teamRoles.findFirst({
				where: eq(teamRoles.id, invite.whiteboardTeamRoleId),
			});
			if (role) {
				memberValues = membershipValuesFromTeamRole(role.id);
			}
		}

		if (memberValues) {
			await db
				.insert(whiteboardMembers)
				.values({
					whiteboardId: invite.whiteboardId,
					userId: user.id,
					...memberValues,
				})
				.onConflictDoUpdate({
					target: [whiteboardMembers.whiteboardId, whiteboardMembers.userId],
					set: memberValues,
				});
		}
	}

	const [accepted] = await db
		.update(registrationInvites)
		.set({ acceptedAt: new Date() })
		.where(eq(registrationInvites.id, invite.id))
		.returning();

	if (accepted?.teamId) {
		const workspace = await db.query.teams.findFirst({
			where: eq(teams.id, accepted.teamId),
			columns: { id: true, ownerId: true },
		});
		if (workspace) await syncWorkspaceSubscriptionSeats(db, workspace);
	}

	return accepted;
}

export async function assignFirstUserAsInstanceAdmin(
	db: Database,
	userId: string,
) {
	const settings = await getOrCreateInstanceSettings(db);
	if (settings.adminUserId) return settings;

	const [updated] = await db
		.update(instanceSettings)
		.set({ adminUserId: userId, updatedAt: new Date() })
		.where(eq(instanceSettings.id, "default"))
		.returning();

	return updated ?? settings;
}
