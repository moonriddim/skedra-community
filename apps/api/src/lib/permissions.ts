import {
	type Database,
	teamMembers,
	teams,
	whiteboardMembers,
	whiteboardTeamRoleAccess,
	whiteboards,
} from "@skedra/db";
import {
	type CanvasRole,
	TEAM_ROLE_PERMISSION_KEYS,
	type TeamRolePermissions,
	accessLevelFromPermissions,
	parseTeamRolePermissions,
} from "@skedra/shared";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { isBoardArchived } from "./activity";
import { appErrorCodes, createAppError } from "./app-errors";
import {
	type ResolvedBoardAccess,
	resolveMemberBoardAccess,
	resolveOwnerBoardAccess,
	resolveWorkspaceBoardAccess,
} from "./board-member-access";
import { TEAM_OWNER_ROLE_COLOR, TEAM_OWNER_ROLE_NAME } from "./team-roles";
import { getWorkspaceMembership } from "./workspace";

type AuthUser = {
	id: string;
	name: string;
	email: string;
	image?: string | null;
};

type Ctx = {
	db: Database;
	user: AuthUser | null;
};

type BoardListAccess = "owner" | "edit" | "view";

export type BoardAccessResult = {
	whiteboard: typeof whiteboards.$inferSelect;
	role: CanvasRole;
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
	permissions: ResolvedBoardAccess["permissions"];
	roleId: string | null;
	roleName: string | null;
	roleColor: string | null;
};

async function hasTeamRoleBoardAccess(
	db: Database,
	whiteboardId: string,
	roleId: string | null | undefined,
) {
	if (!roleId) return false;
	const grant = await db.query.whiteboardTeamRoleAccess.findFirst({
		where: and(
			eq(whiteboardTeamRoleAccess.whiteboardId, whiteboardId),
			eq(whiteboardTeamRoleAccess.teamRoleId, roleId),
		),
		columns: { id: true },
	});
	return !!grant;
}

function mergeBoardAccess(
	accesses: Array<ResolvedBoardAccess | null | undefined>,
): ResolvedBoardAccess | null {
	const available = accesses.filter(
		(access): access is ResolvedBoardAccess => !!access,
	);
	if (available.length === 0) return null;
	if (available.length === 1) return available[0];

	const permissions = { ...available[0].permissions };
	for (const key of TEAM_ROLE_PERMISSION_KEYS) {
		permissions[key] = available.some((access) => access.permissions[key]);
	}

	const canWrite = available.some((access) => access.canWrite);
	const strongest = available.reduce((best, access) => {
		const bestScore =
			(best.permissions.admin ? 4 : 0) +
			(best.canManageMembers ? 2 : 0) +
			(best.canWrite ? 1 : 0);
		const accessScore =
			(access.permissions.admin ? 4 : 0) +
			(access.canManageMembers ? 2 : 0) +
			(access.canWrite ? 1 : 0);
		return accessScore > bestScore ? access : best;
	}, available[0]);

	return {
		...strongest,
		permissions,
		canWrite,
		canComment: available.some((access) => access.canComment),
		canResolveComments: available.some((access) => access.canResolveComments),
		canInvite: available.some((access) => access.canInvite),
		canManageShare: available.some((access) => access.canManageShare),
		canManageMembers: available.some((access) => access.canManageMembers),
		canViewActivity: available.some((access) => access.canViewActivity),
		canUseAi: available.some((access) => access.canUseAi),
		canManage: available.some((access) => access.canManage),
		accessLevel: canWrite ? "edit" : "view",
	};
}

export async function getBoardAccess(
	ctx: Ctx,
	whiteboardId: string,
): Promise<BoardAccessResult> {
	const whiteboard = await ctx.db.query.whiteboards.findFirst({
		where: eq(whiteboards.id, whiteboardId),
	});

	if (!whiteboard) {
		throw createAppError({
			code: "NOT_FOUND",
			appErrorCode: appErrorCodes.whiteboardNotFound,
			message: "Board nicht gefunden",
		});
	}

	if (isBoardArchived(whiteboard)) {
		throw createAppError({
			code: "NOT_FOUND",
			appErrorCode: appErrorCodes.whiteboardArchived,
			message: "Board ist archiviert",
		});
	}

	if (!ctx.user) {
		throw createAppError({
			code: "UNAUTHORIZED",
			appErrorCode: appErrorCodes.unauthorized,
			message: "Nicht authentifiziert",
		});
	}

	const isOwner = whiteboard.ownerId === ctx.user.id;

	const membership = await ctx.db.query.whiteboardMembers.findFirst({
		where: and(
			eq(whiteboardMembers.whiteboardId, whiteboardId),
			eq(whiteboardMembers.userId, ctx.user.id),
		),
	});

	const workspaceMembership = !isOwner
		? await getWorkspaceMembership(ctx.db, ctx.user.id, whiteboard.teamId)
		: null;
	const workspaceAccessAllowed =
		!!workspaceMembership &&
		(workspaceMembership.isOwner ||
			workspaceMembership.workspaceRole === "admin" ||
			(await hasTeamRoleBoardAccess(
				ctx.db,
				whiteboardId,
				workspaceMembership.memberRole?.id,
			)));

	if (!isOwner && !membership && !workspaceAccessAllowed) {
		throw createAppError({
			code: "FORBIDDEN",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "Kein Zugriff auf dieses Board",
		});
	}

	let resolved: ResolvedBoardAccess;
	if (isOwner) {
		resolved = resolveOwnerBoardAccess();
	} else {
		const memberAccess = membership
			? await resolveMemberBoardAccess(ctx.db, whiteboardId, membership)
			: null;
		const workspaceAccess = workspaceAccessAllowed
			? resolveWorkspaceBoardAccess({
					isWorkspaceOwner: workspaceMembership?.isOwner ?? false,
					workspaceRole: workspaceMembership?.workspaceRole ?? "member",
					memberRole: workspaceMembership?.memberRole ?? null,
				})
			: null;
		const merged = mergeBoardAccess([memberAccess, workspaceAccess]);
		if (!merged) {
			throw createAppError({
				code: "FORBIDDEN",
				appErrorCode: appErrorCodes.whiteboardAccessDenied,
				message: "Kein Zugriff auf dieses Board",
			});
		}
		resolved = merged;
	}

	const canvasRole: CanvasRole = isOwner
		? "owner"
		: resolved.canWrite
			? "editor"
			: "viewer";

	return {
		whiteboard,
		role: canvasRole,
		canWrite: resolved.canWrite,
		canComment: resolved.canComment,
		canResolveComments: resolved.canResolveComments,
		canInvite: resolved.canInvite,
		canManageShare: resolved.canManageShare,
		canManageMembers: resolved.canManageMembers,
		canViewActivity: resolved.canViewActivity,
		canUseAi: resolved.canUseAi,
		canManage: resolved.canManage,
		accessLevel: resolved.accessLevel,
		permissions: resolved.permissions,
		roleId: resolved.roleId,
		roleName: resolved.roleName,
		roleColor: resolved.roleColor,
	};
}

export async function requireBoardComment(ctx: Ctx, whiteboardId: string) {
	const access = await getBoardAccess(ctx, whiteboardId);
	if (!access.canComment) {
		throw createAppError({
			code: "FORBIDDEN",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "Keine Berechtigung für Kommentare",
		});
	}
	return access;
}

async function requireBoardWrite(ctx: Ctx, whiteboardId: string) {
	const access = await getBoardAccess(ctx, whiteboardId);
	if (!access.canWrite) {
		throw createAppError({
			code: "FORBIDDEN",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "Keine Berechtigung zum Bearbeiten",
		});
	}
	return access;
}

export async function requireBoardAi(ctx: Ctx, whiteboardId: string) {
	const access = await getBoardAccess(ctx, whiteboardId);
	if (!access.canUseAi) {
		throw createAppError({
			code: "FORBIDDEN",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "Keine Berechtigung für KI auf diesem Board",
		});
	}
	return access;
}

/** Zugriff auf archivierte Boards — nur fuer Owner (Wiederherstellen / Loeschen). */
export async function requireArchivedBoardOwner(
	ctx: Ctx,
	whiteboardId: string,
) {
	if (!ctx.user) {
		throw createAppError({
			code: "UNAUTHORIZED",
			appErrorCode: appErrorCodes.unauthorized,
			message: "Nicht authentifiziert",
		});
	}

	const whiteboard = await ctx.db.query.whiteboards.findFirst({
		where: eq(whiteboards.id, whiteboardId),
	});

	if (
		!whiteboard ||
		whiteboard.ownerId !== ctx.user.id ||
		!isBoardArchived(whiteboard)
	) {
		throw createAppError({
			code: "NOT_FOUND",
			appErrorCode: appErrorCodes.whiteboardNotFound,
			message: "Board nicht im Papierkorb gefunden",
		});
	}

	return { whiteboard };
}

export async function requireBoardMember(ctx: Ctx, whiteboardId: string) {
	return getBoardAccess(ctx, whiteboardId);
}

export async function requireBoardOwner(ctx: Ctx, whiteboardId: string) {
	const access = await getBoardAccess(ctx, whiteboardId);
	if (!access.canManage) {
		throw createAppError({
			code: "FORBIDDEN",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "Nur der Besitzer darf das",
		});
	}
	return access;
}

export async function requireBoardInvite(ctx: Ctx, whiteboardId: string) {
	const access = await getBoardAccess(ctx, whiteboardId);
	if (!access.canManage && !access.canInvite) {
		throw createAppError({
			code: "FORBIDDEN",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "Keine Berechtigung zum Einladen",
		});
	}
	return access;
}

export async function requireBoardManageShare(ctx: Ctx, whiteboardId: string) {
	const access = await getBoardAccess(ctx, whiteboardId);
	if (!access.canManageShare) {
		throw createAppError({
			code: "FORBIDDEN",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "Keine Berechtigung für Freigabe-Links",
		});
	}
	return access;
}

export async function requireBoardResolveComments(
	ctx: Ctx,
	whiteboardId: string,
) {
	const access = await getBoardAccess(ctx, whiteboardId);
	if (!access.canResolveComments) {
		throw createAppError({
			code: "FORBIDDEN",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "Keine Berechtigung, Kommentare zu schließen",
		});
	}
	return access;
}

export async function requireBoardManageMembers(
	ctx: Ctx,
	whiteboardId: string,
) {
	const access = await getBoardAccess(ctx, whiteboardId);
	if (!access.canManageMembers) {
		throw createAppError({
			code: "FORBIDDEN",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "Keine Berechtigung zur Mitglieder-Verwaltung",
		});
	}
	return access;
}

export async function requireBoardViewActivity(ctx: Ctx, whiteboardId: string) {
	const access = await getBoardAccess(ctx, whiteboardId);
	if (!access.canViewActivity) {
		throw createAppError({
			code: "FORBIDDEN",
			appErrorCode: appErrorCodes.whiteboardAccessDenied,
			message: "Keine Berechtigung fuer Aktivitaeten",
		});
	}
	return access;
}

export function canGrantTeamRolePermissions(
	granter: TeamRolePermissions,
	target: TeamRolePermissions,
) {
	return TEAM_ROLE_PERMISSION_KEYS.every((key) => {
		if (!target[key]) return true;
		if (key === "manageWorkspaceAdmins") {
			return granter.manageWorkspaceAdmins;
		}
		return granter.admin || granter[key];
	});
}

export function assertCanAssignTeamRoleForBoard(
	access: BoardAccessResult,
	targetPermissions: TeamRolePermissions,
) {
	if (access.canManage) return;
	if (
		(access.canManageMembers || access.canInvite) &&
		canGrantTeamRolePermissions(access.permissions, targetPermissions)
	) {
		return;
	}
	throw createAppError({
		code: "FORBIDDEN",
		appErrorCode: appErrorCodes.whiteboardAccessDenied,
		message: "Du darfst keine Rolle mit hoeheren Rechten vergeben",
	});
}

/** Bibliothek: eigene Boards + explizit geteilte. */
export async function findBoardsForUser(db: Database, userId: string) {
	const owned = await db.query.whiteboards.findMany({
		where: and(eq(whiteboards.ownerId, userId), isNull(whiteboards.archivedAt)),
		columns: {
			id: true,
			name: true,
			ownerId: true,
			teamId: true,
			folderId: true,
			presentationShareEnabled: true,
			collabShareEnabled: true,
			embedShareEnabled: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	const memberEntries = await db.query.whiteboardMembers.findMany({
		where: eq(whiteboardMembers.userId, userId),
		with: {
			whiteboard: {
				columns: {
					id: true,
					name: true,
					ownerId: true,
					teamId: true,
					folderId: true,
					presentationShareEnabled: true,
					collabShareEnabled: true,
					embedShareEnabled: true,
					archivedAt: true,
					createdAt: true,
					updatedAt: true,
				},
			},
			teamRole: true,
		},
	});

	type BoardRow = (typeof owned)[number] & {
		libraryAccess: BoardListAccess;
		roleName?: string | null;
		roleColor?: string | null;
	};

	const byId = new Map<string, BoardRow>();
	const setBoardListAccess = (row: BoardRow) => {
		const existing = byId.get(row.id);
		if (
			!existing ||
			(existing.libraryAccess === "view" && row.libraryAccess !== "view")
		) {
			byId.set(row.id, row);
		}
	};

	for (const board of owned) {
		byId.set(board.id, { ...board, libraryAccess: "owner" });
	}

	for (const entry of memberEntries) {
		if (!entry.whiteboard || entry.whiteboard.archivedAt) continue;
		if (!entry.teamRole) continue;
		const { archivedAt: _, ...board } = entry.whiteboard;
		const explicitPermissions = parseTeamRolePermissions(
			entry.teamRole.permissions,
		);
		setBoardListAccess({
			...board,
			libraryAccess: accessLevelFromPermissions(explicitPermissions),
			roleName: entry.teamRole.name,
			roleColor: entry.teamRole.color,
		});
	}

	const ownedTeams = await db.query.teams.findMany({
		where: eq(teams.ownerId, userId),
		columns: { id: true },
	});
	const workspaceMemberships = await db.query.teamMembers.findMany({
		where: eq(teamMembers.userId, userId),
		with: { role: true },
	});
	const workspaceTeamIds = [
		...ownedTeams.map((team) => team.id),
		...workspaceMemberships.map((member) => member.teamId),
	];
	const workspaceRoleIds = workspaceMemberships
		.map((member) => member.roleId)
		.filter((roleId): roleId is string => !!roleId);
	const roleGrantKeys = new Set<string>();
	if (workspaceRoleIds.length > 0) {
		const grants = await db.query.whiteboardTeamRoleAccess.findMany({
			where: inArray(whiteboardTeamRoleAccess.teamRoleId, workspaceRoleIds),
			columns: { whiteboardId: true, teamRoleId: true },
		});
		for (const grant of grants) {
			roleGrantKeys.add(`${grant.whiteboardId}:${grant.teamRoleId}`);
		}
	}

	if (workspaceTeamIds.length > 0) {
		const workspaceBoards = await db.query.whiteboards.findMany({
			where: and(
				inArray(whiteboards.teamId, workspaceTeamIds),
				isNull(whiteboards.archivedAt),
			),
			columns: {
				id: true,
				name: true,
				ownerId: true,
				teamId: true,
				folderId: true,
				presentationShareEnabled: true,
				collabShareEnabled: true,
				embedShareEnabled: true,
				createdAt: true,
				updatedAt: true,
			},
		});
		const membershipByTeam = new Map(
			workspaceMemberships.map((member) => [member.teamId, member]),
		);
		const ownedTeamIds = new Set(ownedTeams.map((team) => team.id));

		for (const board of workspaceBoards) {
			if (byId.get(board.id)?.libraryAccess === "owner") continue;
			const member =
				board.teamId != null ? membershipByTeam.get(board.teamId) : undefined;
			const ownedWorkspace =
				board.teamId != null && ownedTeamIds.has(board.teamId);
			const roleGranted =
				!!member?.roleId && roleGrantKeys.has(`${board.id}:${member.roleId}`);
			if (
				!ownedWorkspace &&
				member?.workspaceRole !== "admin" &&
				!roleGranted
			) {
				continue;
			}
			const canEdit =
				ownedWorkspace ||
				member?.workspaceRole === "admin" ||
				(member?.role
					? accessLevelFromPermissions(
							parseTeamRolePermissions(member.role.permissions),
						) === "edit"
					: false);
			setBoardListAccess({
				...board,
				libraryAccess: canEdit ? "edit" : "view",
				roleName: ownedWorkspace
					? TEAM_OWNER_ROLE_NAME
					: (member?.role?.name ?? "Workspace"),
				roleColor: ownedWorkspace
					? TEAM_OWNER_ROLE_COLOR
					: (member?.role?.color ?? null),
			});
		}
	}

	return [...byId.values()].sort(
		(a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
	);
}

type BoardCollaboratorEntry = {
	id: string;
	membershipId: string | null;
	name: string;
	image: string | null;
	isOwner: boolean;
	accessLevel: "owner" | "edit" | "view";
	roleId: string | null;
	roleName: string | null;
	roleColor: string | null;
	permissions: ResolvedBoardAccess["permissions"];
};

export async function getBoardCollaborators(
	db: Database,
	whiteboardId: string,
) {
	const whiteboard = await db.query.whiteboards.findFirst({
		where: eq(whiteboards.id, whiteboardId),
		with: {
			owner: { columns: { id: true, name: true, image: true } },
			members: {
				with: {
					user: { columns: { id: true, name: true, image: true } },
					teamRole: true,
				},
			},
		},
	});

	if (!whiteboard)
		return { members: [] as BoardCollaboratorEntry[], roles: [], groups: [] };

	const ownerAccess = resolveOwnerBoardAccess();
	const members: BoardCollaboratorEntry[] = [
		{
			id: whiteboard.owner.id,
			membershipId: null,
			name: whiteboard.owner.name,
			image: whiteboard.owner.image,
			isOwner: true,
			accessLevel: "owner",
			roleId: null,
			roleName: TEAM_OWNER_ROLE_NAME,
			roleColor: TEAM_OWNER_ROLE_COLOR,
			permissions: ownerAccess.permissions,
		},
	];

	const roleGrants = await db.query.whiteboardTeamRoleAccess.findMany({
		where: eq(whiteboardTeamRoleAccess.whiteboardId, whiteboardId),
		orderBy: asc(whiteboardTeamRoleAccess.createdAt),
		with: { teamRole: true },
	});
	const grantedRoleIds = roleGrants
		.map((grant) => grant.teamRoleId)
		.filter((roleId): roleId is string => !!roleId);
	const grantedRoleIdSet = new Set(grantedRoleIds);

	const resolveGrantedWorkspaceAccess = async (userId: string) => {
		if (!whiteboard.teamId) return null;
		const workspaceMembership = await getWorkspaceMembership(
			db,
			userId,
			whiteboard.teamId,
		);
		if (!workspaceMembership) return null;
		const workspaceAccessAllowed =
			workspaceMembership.isOwner ||
			workspaceMembership.workspaceRole === "admin" ||
			(!!workspaceMembership.memberRole?.id &&
				grantedRoleIdSet.has(workspaceMembership.memberRole.id));
		if (!workspaceAccessAllowed) return null;

		return resolveWorkspaceBoardAccess({
			isWorkspaceOwner: workspaceMembership.isOwner,
			workspaceRole: workspaceMembership.workspaceRole,
			memberRole: workspaceMembership.memberRole,
		});
	};

	for (const entry of whiteboard.members.filter(
		(member) => member.user.id !== whiteboard.ownerId,
	)) {
		const memberAccess = await resolveMemberBoardAccess(
			db,
			whiteboardId,
			entry,
		);
		const workspaceAccess = await resolveGrantedWorkspaceAccess(entry.user.id);
		const resolved =
			mergeBoardAccess([memberAccess, workspaceAccess]) ?? memberAccess;
		members.push({
			id: entry.user.id,
			membershipId: entry.id,
			name: entry.user.name,
			image: entry.user.image,
			isOwner: false,
			accessLevel: resolved.accessLevel,
			roleId: resolved.roleId,
			roleName: resolved.roleName,
			roleColor: resolved.roleColor,
			permissions: resolved.permissions,
		});
	}

	const explicitMemberIds = new Set(members.map((member) => member.id));

	if (whiteboard.teamId && grantedRoleIds.length > 0) {
		const roleMembers = await db.query.teamMembers.findMany({
			where: and(
				eq(teamMembers.teamId, whiteboard.teamId),
				inArray(teamMembers.roleId, grantedRoleIds),
			),
			with: {
				user: { columns: { id: true, name: true, image: true } },
				role: true,
			},
		});

		for (const member of roleMembers) {
			if (explicitMemberIds.has(member.user.id)) continue;
			const resolved = resolveWorkspaceBoardAccess({
				isWorkspaceOwner: false,
				workspaceRole: member.workspaceRole,
				memberRole: member.role,
			});
			members.push({
				id: member.user.id,
				membershipId: null,
				name: member.user.name,
				image: member.user.image,
				isOwner: false,
				accessLevel: resolved.accessLevel,
				roleId: resolved.roleId,
				roleName: resolved.roleName,
				roleColor: resolved.roleColor,
				permissions: resolved.permissions,
			});
			explicitMemberIds.add(member.user.id);
		}
	}

	if (whiteboard.teamId) {
		const workspaceAdmins = await db.query.teamMembers.findMany({
			where: and(
				eq(teamMembers.teamId, whiteboard.teamId),
				eq(teamMembers.workspaceRole, "admin"),
			),
			with: {
				user: { columns: { id: true, name: true, image: true } },
				role: true,
			},
		});

		for (const member of workspaceAdmins) {
			if (explicitMemberIds.has(member.user.id)) continue;
			const resolved = resolveWorkspaceBoardAccess({
				isWorkspaceOwner: false,
				workspaceRole: member.workspaceRole,
				memberRole: member.role,
			});
			members.push({
				id: member.user.id,
				membershipId: null,
				name: member.user.name,
				image: member.user.image,
				isOwner: false,
				accessLevel: resolved.accessLevel,
				roleId: resolved.roleId,
				roleName: resolved.roleName,
				roleColor: resolved.roleColor,
				permissions: resolved.permissions,
			});
			explicitMemberIds.add(member.user.id);
		}
	}

	const roleOptions = roleGrants
		.filter((grant) => !!grant.teamRole)
		.map((grant) => ({
			id: grant.teamRole.id,
			name: grant.teamRole.name,
			color: grant.teamRole.color,
		}));

	return { members, roles: roleOptions, groups: roleOptions };
}
