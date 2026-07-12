import { z } from "zod";

/** Rechte einer zentralen Team-Rolle im Board-, Canvas- und Workspace-Kontext. */
export const teamRolePermissionsSchema = z.object({
	/** Board-Admin: schaltet alle granularen Board-Rechte frei */
	admin: z.boolean(),
	/** Workspace-Admins ernennen, bearbeiten oder entfernen */
	manageWorkspaceAdmins: z.boolean(),
	/** Canvas zeichnen / Elemente bearbeiten */
	editCanvas: z.boolean(),
	/** Kommentar-Threads erstellen und beantworten */
	comment: z.boolean(),
	/** Threads als erledigt markieren oder löschen */
	resolveComments: z.boolean(),
	/** Weitere Kollaborateure per E-Mail zu diesem Board einladen */
	inviteOthers: z.boolean(),
	/** Präsentations- und Kollaborations-Links verwalten */
	manageShare: z.boolean(),
	/** Team-Rollen anderer Mitglieder auf diesem Board ändern / entfernen */
	manageMembers: z.boolean(),
	/** Aktivitätsverlauf auf dem Board ansehen */
	viewActivity: z.boolean(),
	/** KI-Funktionen auf dem Board */
	useAi: z.boolean(),
});

export type TeamRolePermissions = z.infer<typeof teamRolePermissionsSchema>;

export const TEAM_ROLE_PERMISSION_KEYS = [
	"admin",
	"manageWorkspaceAdmins",
	"editCanvas",
	"comment",
	"resolveComments",
	"inviteOthers",
	"manageShare",
	"manageMembers",
	"viewActivity",
	"useAi",
] as const satisfies readonly (keyof TeamRolePermissions)[];

const TEAM_ROLE_PERMISSION_DEFAULTS: TeamRolePermissions = {
	admin: false,
	manageWorkspaceAdmins: false,
	editCanvas: false,
	comment: false,
	resolveComments: false,
	inviteOthers: false,
	manageShare: false,
	manageMembers: false,
	viewActivity: false,
	useAi: false,
};

/** Vollzugriff-Kollaborateur (Standard „Designer“). */
export const DEFAULT_EDITOR_ROLE_PERMISSIONS: TeamRolePermissions = {
	...TEAM_ROLE_PERMISSION_DEFAULTS,
	editCanvas: true,
	comment: true,
	resolveComments: true,
	viewActivity: true,
	useAi: true,
};

/** Nur lesen. */
export const DEFAULT_VIEWER_ROLE_PERMISSIONS: TeamRolePermissions = {
	...TEAM_ROLE_PERMISSION_DEFAULTS,
	viewActivity: true,
};

/** Reviewer: kommentieren, nicht zeichnen. */
export const DEFAULT_REVIEWER_ROLE_PERMISSIONS: TeamRolePermissions = {
	...TEAM_ROLE_PERMISSION_DEFAULTS,
	comment: true,
	resolveComments: true,
	viewActivity: true,
};

/** Board-Admin: alle Board-Rechte; Workspace-Admin-Verwaltung bleibt separat. */
export const DEFAULT_ADMIN_ROLE_PERMISSIONS: TeamRolePermissions = {
	...TEAM_ROLE_PERMISSION_DEFAULTS,
	admin: true,
	editCanvas: true,
	comment: true,
	resolveComments: true,
	inviteOthers: true,
	manageShare: true,
	manageMembers: true,
	viewActivity: true,
	useAi: true,
};

export function normalizeTeamRolePermissions(
	partial: Partial<TeamRolePermissions> | Record<string, unknown>,
): TeamRolePermissions {
	const merged = { ...TEAM_ROLE_PERMISSION_DEFAULTS };
	for (const key of TEAM_ROLE_PERMISSION_KEYS) {
		if (typeof partial[key] === "boolean") {
			merged[key] = partial[key];
		}
	}
	return teamRolePermissionsSchema.parse(merged);
}

export function parseTeamRolePermissions(
	raw: string | null | undefined,
): TeamRolePermissions {
	if (!raw?.trim()) {
		return { ...TEAM_ROLE_PERMISSION_DEFAULTS };
	}
	try {
		return normalizeTeamRolePermissions(
			JSON.parse(raw) as Record<string, unknown>,
		);
	} catch {
		return { ...TEAM_ROLE_PERMISSION_DEFAULTS };
	}
}

export function serializeTeamRolePermissions(
	permissions: TeamRolePermissions,
): string {
	return JSON.stringify(teamRolePermissionsSchema.parse(permissions));
}

export function accessLevelFromPermissions(
	permissions: TeamRolePermissions,
): "view" | "edit" {
	return permissions.admin || permissions.editCanvas ? "edit" : "view";
}
