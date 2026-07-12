/**
 * Leitet Board-Rechte aus Mitgliedschaft + zentraler Team-Rolle ab.
 */

import { type Database, teamRoles, type whiteboardMembers } from "@skedra/db";
import {
	DEFAULT_ADMIN_ROLE_PERMISSIONS,
	DEFAULT_VIEWER_ROLE_PERMISSIONS,
	type TeamRolePermissions,
	parseTeamRolePermissions,
} from "@skedra/shared";
import { eq } from "drizzle-orm";

export type ResolvedBoardAccess = {
	permissions: TeamRolePermissions;
	canWrite: boolean;
	canComment: boolean;
	canResolveComments: boolean;
	canInvite: boolean;
	canManageShare: boolean;
	canManageMembers: boolean;
	canViewActivity: boolean;
	canUseAi: boolean;
	canManage: boolean;
	accessLevel: "owner" | "edit" | "view";
	roleId: string | null;
	roleName: string | null;
	roleColor: string | null;
};

function flagsFromPermissions(
	permissions: TeamRolePermissions,
	isOwner: boolean,
): ResolvedBoardAccess {
	const hasBoardAdmin = isOwner || permissions.admin;
	return {
		permissions,
		canWrite: hasBoardAdmin || permissions.editCanvas,
		canComment: hasBoardAdmin || permissions.comment,
		canResolveComments: hasBoardAdmin || permissions.resolveComments,
		canInvite: hasBoardAdmin || permissions.inviteOthers,
		canManageShare: hasBoardAdmin || permissions.manageShare,
		canManageMembers: hasBoardAdmin || permissions.manageMembers,
		canViewActivity: hasBoardAdmin || permissions.viewActivity,
		canUseAi: hasBoardAdmin || permissions.useAi,
		canManage: isOwner,
		accessLevel: hasBoardAdmin || permissions.editCanvas ? "edit" : "view",
		roleId: null,
		roleName: null,
		roleColor: null,
	};
}

function canManageWorkspaceAdmins(role: typeof teamRoles.$inferSelect | null) {
	return role
		? parseTeamRolePermissions(role.permissions).manageWorkspaceAdmins
		: false;
}

export async function resolveMemberBoardAccess(
	db: Database,
	_whiteboardId: string,
	membership: typeof whiteboardMembers.$inferSelect,
): Promise<ResolvedBoardAccess> {
	const teamRoleId = membership.teamRoleId;
	const role = await db.query.teamRoles.findFirst({
		where: eq(teamRoles.id, teamRoleId),
	});
	if (!role) {
		throw new Error("Team-Rolle nicht gefunden.");
	}

	const permissions = parseTeamRolePermissions(role.permissions);
	const base = flagsFromPermissions(permissions, false);
	return {
		...base,
		roleId: teamRoleId,
		roleName: role.name,
		roleColor: role.color,
	};
}

export function resolveOwnerBoardAccess(): ResolvedBoardAccess {
	const permissions: TeamRolePermissions = {
		...DEFAULT_ADMIN_ROLE_PERMISSIONS,
		manageWorkspaceAdmins: true,
	};
	const base = flagsFromPermissions(permissions, true);
	return { ...base, roleId: null, roleName: null, roleColor: null };
}

export function resolveWorkspaceBoardAccess(options: {
	isWorkspaceOwner: boolean;
	workspaceRole: "member" | "admin";
	memberRole: typeof teamRoles.$inferSelect | null;
}): ResolvedBoardAccess {
	if (options.isWorkspaceOwner || options.workspaceRole === "admin") {
		const permissions: TeamRolePermissions = {
			...DEFAULT_ADMIN_ROLE_PERMISSIONS,
			manageWorkspaceAdmins:
				options.isWorkspaceOwner ||
				canManageWorkspaceAdmins(options.memberRole),
		};
		const base = flagsFromPermissions(permissions, options.isWorkspaceOwner);
		return {
			...base,
			roleId: options.memberRole?.id ?? null,
			roleName: options.isWorkspaceOwner
				? "Workspace owner"
				: (options.memberRole?.name ?? "Workspace admin"),
			roleColor: options.memberRole?.color ?? "#14b8a6",
			canManage: options.isWorkspaceOwner,
		};
	}

	// Fail-Closed: Kann fuer ein Workspace-Mitglied keine konkrete Rolle aufgeloest
	// werden (z. B. Rolle wurde geloescht -> teamMembers.roleId auf NULL gesetzt),
	// darf daraus KEIN Schreibzugriff entstehen. Frueher war der Fallback
	// "Editor" (Schreibrechte) – das ist ein Fail-Open. Sicherer Default: nur Lesen.
	const permissions = options.memberRole
		? parseTeamRolePermissions(options.memberRole.permissions)
		: DEFAULT_VIEWER_ROLE_PERMISSIONS;
	const base = flagsFromPermissions(permissions, false);
	return {
		...base,
		roleId: options.memberRole?.id ?? null,
		roleName: options.memberRole?.name ?? "Workspace member",
		roleColor: options.memberRole?.color ?? "#2563eb",
	};
}

export function membershipValuesFromTeamRole(roleId: string) {
	return {
		teamRoleId: roleId,
	};
}
