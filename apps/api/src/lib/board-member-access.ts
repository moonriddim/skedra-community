/**
 * Leitet Board-Rechte aus Mitgliedschaft + Board-Rolle (pro Canvas) ab.
 */

import {
	type Database,
	type teamRoles,
	type whiteboardMembers,
	whiteboardRoles,
} from "@skedra/db";
import {
	type BoardRolePermissions,
	DEFAULT_EDITOR_ROLE_PERMISSIONS,
	accessLevelFromPermissions,
	parseTeamRolePermissions,
	permissionsFromLegacyAccessLevel,
} from "@skedra/shared";
import { and, eq } from "drizzle-orm";

export type ResolvedBoardAccess = {
	permissions: BoardRolePermissions;
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
	permissions: BoardRolePermissions,
	isOwner: boolean,
): ResolvedBoardAccess {
	return {
		permissions,
		canWrite: permissions.editCanvas,
		canComment: permissions.comment,
		canResolveComments: isOwner || permissions.resolveComments,
		canInvite: permissions.inviteOthers,
		canManageShare: isOwner || permissions.manageShare,
		canManageMembers: isOwner || permissions.manageMembers,
		canViewActivity: isOwner || permissions.viewActivity,
		canUseAi: permissions.useAi,
		canManage: isOwner,
		accessLevel: permissions.editCanvas ? "edit" : "view",
		roleId: null,
		roleName: null,
		roleColor: null,
	};
}

export async function resolveMemberBoardAccess(
	db: Database,
	whiteboardId: string,
	membership: typeof whiteboardMembers.$inferSelect,
): Promise<ResolvedBoardAccess> {
	let permissions = permissionsFromLegacyAccessLevel(membership.accessLevel);
	let roleName: string | null = null;
	let roleColor: string | null = null;
	const roleId = membership.roleId;

	if (roleId) {
		const role = await db.query.whiteboardRoles.findFirst({
			where: and(
				eq(whiteboardRoles.id, roleId),
				eq(whiteboardRoles.whiteboardId, whiteboardId),
			),
		});
		if (role) {
			permissions = parseTeamRolePermissions(role.permissions);
			roleName = role.name;
			roleColor = role.color;
		}
	}

	const base = flagsFromPermissions(permissions, false);
	return { ...base, roleId, roleName, roleColor };
}

export function resolveOwnerBoardAccess(): ResolvedBoardAccess {
	const permissions: BoardRolePermissions = {
		...DEFAULT_EDITOR_ROLE_PERMISSIONS,
		inviteOthers: true,
		manageShare: true,
		manageMembers: true,
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
		const permissions: BoardRolePermissions = {
			...DEFAULT_EDITOR_ROLE_PERMISSIONS,
			inviteOthers: true,
			manageShare: true,
			manageMembers: true,
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

	const permissions = options.memberRole
		? parseTeamRolePermissions(options.memberRole.permissions)
		: DEFAULT_EDITOR_ROLE_PERMISSIONS;
	const base = flagsFromPermissions(permissions, false);
	return {
		...base,
		roleId: options.memberRole?.id ?? null,
		roleName: options.memberRole?.name ?? "Workspace member",
		roleColor: options.memberRole?.color ?? "#2563eb",
	};
}

export async function requireWhiteboardRole(
	db: Database,
	whiteboardId: string,
	roleId: string,
) {
	const role = await db.query.whiteboardRoles.findFirst({
		where: and(
			eq(whiteboardRoles.id, roleId),
			eq(whiteboardRoles.whiteboardId, whiteboardId),
		),
	});

	if (!role) {
		throw new Error("Rolle gehört nicht zu diesem Board");
	}

	return role;
}

export function membershipValuesFromRole(
	roleId: string,
	permissions: BoardRolePermissions,
) {
	return {
		roleId,
		accessLevel: accessLevelFromPermissions(permissions),
	};
}
