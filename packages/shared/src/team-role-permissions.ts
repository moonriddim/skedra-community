import { z } from "zod";

/** Rechte einer Board-Rolle — gelten nur auf dem jeweiligen Canvas. */
export const boardRolePermissionsSchema = z.object({
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
	/** Rollen anderer Mitglieder auf diesem Board ändern / entfernen */
	manageMembers: z.boolean(),
	/** Aktivitätsverlauf auf dem Board ansehen */
	viewActivity: z.boolean(),
	/** KI-Funktionen auf dem Board */
	useAi: z.boolean(),
});

/** @deprecated Alias — nutze boardRolePermissionsSchema */
export const teamRolePermissionsSchema = boardRolePermissionsSchema;

export type BoardRolePermissions = z.infer<typeof boardRolePermissionsSchema>;
export type TeamRolePermissions = BoardRolePermissions;

export const BOARD_ROLE_PERMISSION_KEYS = [
	"editCanvas",
	"comment",
	"resolveComments",
	"inviteOthers",
	"manageShare",
	"manageMembers",
	"viewActivity",
	"useAi",
] as const satisfies readonly (keyof BoardRolePermissions)[];

export const TEAM_ROLE_PERMISSION_KEYS = BOARD_ROLE_PERMISSION_KEYS;

const BOARD_ROLE_PERMISSION_DEFAULTS: BoardRolePermissions = {
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
export const DEFAULT_EDITOR_ROLE_PERMISSIONS: BoardRolePermissions = {
	...BOARD_ROLE_PERMISSION_DEFAULTS,
	editCanvas: true,
	comment: true,
	resolveComments: true,
	viewActivity: true,
	useAi: true,
};

/** Nur lesen. */
export const DEFAULT_VIEWER_ROLE_PERMISSIONS: BoardRolePermissions = {
	...BOARD_ROLE_PERMISSION_DEFAULTS,
	viewActivity: true,
};

/** Reviewer: kommentieren, nicht zeichnen. */
export const DEFAULT_REVIEWER_ROLE_PERMISSIONS: BoardRolePermissions = {
	...BOARD_ROLE_PERMISSION_DEFAULTS,
	comment: true,
	resolveComments: true,
	viewActivity: true,
};

export function normalizeBoardRolePermissions(
	partial: Partial<BoardRolePermissions> | Record<string, unknown>,
): BoardRolePermissions {
	const merged = { ...BOARD_ROLE_PERMISSION_DEFAULTS };
	for (const key of BOARD_ROLE_PERMISSION_KEYS) {
		if (typeof partial[key] === "boolean") {
			merged[key] = partial[key];
		}
	}
	return boardRolePermissionsSchema.parse(merged);
}

export function parseTeamRolePermissions(
	raw: string | null | undefined,
): BoardRolePermissions {
	if (!raw?.trim()) {
		return { ...DEFAULT_EDITOR_ROLE_PERMISSIONS };
	}
	try {
		return normalizeBoardRolePermissions(
			JSON.parse(raw) as Record<string, unknown>,
		);
	} catch {
		return { ...DEFAULT_EDITOR_ROLE_PERMISSIONS };
	}
}

export function serializeTeamRolePermissions(
	permissions: BoardRolePermissions,
): string {
	return JSON.stringify(boardRolePermissionsSchema.parse(permissions));
}

/** Legacy access_level für Realtime — edit nur wenn Canvas bearbeitbar. */
export function accessLevelFromPermissions(
	permissions: TeamRolePermissions,
): "view" | "edit" {
	return permissions.editCanvas ? "edit" : "view";
}

export function permissionsFromLegacyAccessLevel(
	level: "view" | "edit",
): TeamRolePermissions {
	return level === "edit"
		? { ...DEFAULT_EDITOR_ROLE_PERMISSIONS }
		: { ...DEFAULT_VIEWER_ROLE_PERMISSIONS };
}
