/**
 * Workspace access helpers: owner, admin, member.
 */

import { type Database, teamMembers, teamRoles, teams } from "@skedra/db";
import {
	DEFAULT_EDITOR_ROLE_PERMISSIONS,
	parseTeamRolePermissions,
	serializeTeamRolePermissions,
} from "@skedra/shared";
import { and, eq } from "drizzle-orm";

async function getOwnedTeam(db: Database, userId: string) {
	return db.query.teams.findFirst({
		where: eq(teams.ownerId, userId),
	});
}

async function ensureDefaultTeamRole(db: Database, teamId: string) {
	const existing = await db.query.teamRoles.findFirst({
		where: eq(teamRoles.teamId, teamId),
		columns: { id: true },
	});
	if (existing) return;

	await db.insert(teamRoles).values({
		teamId,
		name: "Mitglied",
		color: "#2563eb",
		permissions: serializeTeamRolePermissions(DEFAULT_EDITOR_ROLE_PERMISSIONS),
	});
}

export async function ensureOwnedWorkspace(
	db: Database,
	user: { id: string; name: string },
) {
	const owned = await getOwnedTeam(db, user.id);
	if (owned) {
		await ensureDefaultTeamRole(db, owned.id);
		return owned;
	}

	const [created] = await db
		.insert(teams)
		.values({
			name: `${user.name}'s Workspace`,
			ownerId: user.id,
		})
		.returning();

	await ensureDefaultTeamRole(db, created.id);
	return created;
}

export async function getManagedWorkspace(db: Database, userId: string) {
	const owned = await getOwnedTeam(db, userId);
	if (owned) {
		return {
			team: owned,
			isOwner: true as const,
			canManageWorkspace: true as const,
			canManageWorkspaceAdmins: true as const,
		};
	}

	const adminRow = await db.query.teamMembers.findFirst({
		where: and(
			eq(teamMembers.userId, userId),
			eq(teamMembers.workspaceRole, "admin"),
		),
		with: { role: true, team: true },
	});

	if (adminRow?.team) {
		const permissions = adminRow.role
			? parseTeamRolePermissions(adminRow.role.permissions)
			: null;
		return {
			team: adminRow.team,
			isOwner: false as const,
			canManageWorkspace: true as const,
			canManageWorkspaceAdmins: permissions?.manageWorkspaceAdmins ?? false,
		};
	}

	return null;
}

export async function requireManagedWorkspace(db: Database, userId: string) {
	const ctx = await getManagedWorkspace(db, userId);
	if (!ctx) {
		throw new Error("Keine Berechtigung fuer Workspace-Verwaltung");
	}
	return ctx;
}

export async function getWorkspaceMembership(
	db: Database,
	userId: string,
	teamId: string | null,
) {
	if (!teamId) return null;

	const team = await db.query.teams.findFirst({
		where: eq(teams.id, teamId),
	});
	if (!team) return null;

	if (team.ownerId === userId) {
		return {
			team,
			isOwner: true as const,
			workspaceRole: "admin" as const,
			memberRole: null,
		};
	}

	const member = await db.query.teamMembers.findFirst({
		where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
		with: { role: true },
	});
	if (!member) return null;

	return {
		team,
		isOwner: false as const,
		workspaceRole: member.workspaceRole,
		memberRole: member.role,
	};
}
