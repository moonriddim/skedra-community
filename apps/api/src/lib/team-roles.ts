import { teamRoles, teams } from "@skedra/db";
import type { Database } from "@skedra/db";
import { eq } from "drizzle-orm";

/** Feste Farbe für Workspace-Besitzer in UI und Erwähnungen. */
export const TEAM_OWNER_ROLE_COLOR = "#14b8a6";
export const TEAM_OWNER_ROLE_NAME = "Besitzer";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function isValidTeamRoleColor(color: string) {
	return HEX_COLOR.test(color);
}

export async function requireOwnedTeam(db: Database, ownerId: string) {
	const team = await db.query.teams.findFirst({
		where: eq(teams.ownerId, ownerId),
	});

	if (!team) {
		throw new Error("Team nicht gefunden");
	}

	return team;
}

export async function requireTeamRole(
	db: Database,
	teamId: string,
	roleId: string,
) {
	const role = await db.query.teamRoles.findFirst({
		where: eq(teamRoles.id, roleId),
	});

	if (!role || role.teamId !== teamId) {
		throw new Error("Rolle nicht gefunden");
	}

	return role;
}
