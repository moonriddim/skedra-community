import {
	type Database,
	teamMembers,
	teams,
	whiteboardMembers,
	whiteboardRoles,
	whiteboards,
} from "@skedra/db";
import { type RealtimeRole, parseTeamRolePermissions } from "@skedra/shared";
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
	role: RealtimeRole;
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

	const workspaceMembership =
		!isOwner && !membership
			? await getWorkspaceMembership(ctx.db, ctx.user.id, whiteboard.teamId)
			: null;

	if (!isOwner && !membership && !workspaceMembership) {
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
		resolved = membership
			? await resolveMemberBoardAccess(ctx.db, whiteboardId, membership)
			: resolveWorkspaceBoardAccess({
					isWorkspaceOwner: workspaceMembership?.isOwner ?? false,
					workspaceRole: workspaceMembership?.workspaceRole ?? "member",
					memberRole: workspaceMembership?.memberRole ?? null,
				});
	}

	const realtimeRole: RealtimeRole = isOwner
		? "owner"
		: resolved.canWrite
			? "editor"
			: "viewer";

	return {
		whiteboard,
		role: realtimeRole,
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
			e2eeEnabled: true,
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
					e2eeEnabled: true,
					archivedAt: true,
					createdAt: true,
					updatedAt: true,
				},
			},
			role: true,
		},
	});

	type BoardRow = (typeof owned)[number] & {
		libraryAccess: BoardListAccess;
		roleName?: string | null;
		roleColor?: string | null;
	};

	const byId = new Map<string, BoardRow>();

	for (const board of owned) {
		byId.set(board.id, { ...board, libraryAccess: "owner" });
	}

	for (const entry of memberEntries) {
		if (!entry.whiteboard || entry.whiteboard.archivedAt) continue;
		const { archivedAt: _, ...board } = entry.whiteboard;
		byId.set(board.id, {
			...board,
			libraryAccess: entry.accessLevel === "view" ? "view" : "edit",
			roleName: entry.role?.name ?? null,
			roleColor: entry.role?.color ?? null,
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
				e2eeEnabled: true,
				createdAt: true,
				updatedAt: true,
			},
		});
		const membershipByTeam = new Map(
			workspaceMemberships.map((member) => [member.teamId, member]),
		);
		const ownedTeamIds = new Set(ownedTeams.map((team) => team.id));

		for (const board of workspaceBoards) {
			if (byId.has(board.id)) continue;
			const member =
				board.teamId != null ? membershipByTeam.get(board.teamId) : undefined;
			const ownedWorkspace =
				board.teamId != null && ownedTeamIds.has(board.teamId);
			const canEdit =
				ownedWorkspace ||
				member?.workspaceRole === "admin" ||
				(member?.role
					? parseTeamRolePermissions(member.role.permissions).editCanvas
					: true);
			byId.set(board.id, {
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
					role: true,
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

	for (const entry of whiteboard.members.filter(
		(member) => member.user.id !== whiteboard.ownerId,
	)) {
		const resolved = await resolveMemberBoardAccess(db, whiteboardId, entry);
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

	const roles = await db.query.whiteboardRoles.findMany({
		where: eq(whiteboardRoles.whiteboardId, whiteboardId),
		orderBy: asc(whiteboardRoles.createdAt),
	});
	const roleOptions = roles.map((role) => ({
		id: role.id,
		name: role.name,
		color: role.color,
	}));

	return { members, roles: roleOptions, groups: roleOptions };
}
