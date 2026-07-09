/**
 * Realtime-Server fuer Y.js-Kollaboration auf Canvas-Boards.
 */

import { Database } from "@hocuspocus/extension-database";
import { Hocuspocus } from "@hocuspocus/server";
import {
	createDb,
	teamMembers,
	teams,
	whiteboardMembers,
	whiteboards,
} from "@skedra/db";
import type { RealtimeRole } from "@skedra/shared";
import { parseTeamRolePermissions } from "@skedra/shared";
import { verifyRealtimeAuthToken } from "@skedra/shared/realtime-auth";
import { decryptBytes, encryptBytes } from "@skedra/shared/server-crypto";
import { and, eq } from "drizzle-orm";
import { env } from "./env";

const READONLY_ROLES: RealtimeRole[] = ["viewer"];

const db = createDb(env.DATABASE_URL);

function rejectE2eeRealtime(whiteboard: typeof whiteboards.$inferSelect) {
	if (!whiteboard.e2eeEnabled) return;
	throw Object.assign(new Error("e2ee-board-realtime-disabled"), {
		reason: "e2ee-board-realtime-disabled",
	});
}

function getYjsEncryptionOptions() {
	return {
		secret: env.DATA_ENCRYPTION_SECRET ?? env.AUTH_SECRET,
		purpose: "whiteboard-yjs-state",
	};
}

async function requireMemberAccess(userId: string, whiteboardId: string) {
	const whiteboard = await db.query.whiteboards.findFirst({
		where: eq(whiteboards.id, whiteboardId),
	});

	if (!whiteboard) throw new Error("whiteboard-nicht-gefunden");

	if (whiteboard.archivedAt) throw new Error("whiteboard-archiviert");

	const isOwner = whiteboard.ownerId === userId;
	const membership = await db.query.whiteboardMembers.findFirst({
		where: and(
			eq(whiteboardMembers.whiteboardId, whiteboardId),
			eq(whiteboardMembers.userId, userId),
		),
	});

	if (!isOwner && !membership) throw new Error("whiteboard-zugriff-verweigert");

	const canWrite = isOwner || membership?.accessLevel === "edit";

	return { whiteboard, canWrite };
}

async function requireWorkspaceAccess(userId: string, whiteboardId: string) {
	const whiteboard = await db.query.whiteboards.findFirst({
		where: eq(whiteboards.id, whiteboardId),
	});

	if (!whiteboard) throw new Error("whiteboard-nicht-gefunden");
	if (whiteboard.archivedAt) throw new Error("whiteboard-archiviert");
	if (!whiteboard.teamId) throw new Error("whiteboard-zugriff-verweigert");

	const team = await db.query.teams.findFirst({
		where: eq(teams.id, whiteboard.teamId),
	});
	if (!team) throw new Error("whiteboard-zugriff-verweigert");
	if (team.ownerId === userId) return { whiteboard, canWrite: true };

	const member = await db.query.teamMembers.findFirst({
		where: and(
			eq(teamMembers.teamId, whiteboard.teamId),
			eq(teamMembers.userId, userId),
		),
		with: { role: true },
	});
	if (!member) throw new Error("whiteboard-zugriff-verweigert");

	const canWrite =
		member.workspaceRole === "admin" ||
		(member.role
			? parseTeamRolePermissions(member.role.permissions).editCanvas
			: true);

	return { whiteboard, canWrite };
}

async function requireCollabLinkAccess(
	whiteboardId: string,
	shareToken: string,
) {
	const whiteboard = await db.query.whiteboards.findFirst({
		where: eq(whiteboards.id, whiteboardId),
	});

	if (
		!whiteboard ||
		!whiteboard.collabShareEnabled ||
		whiteboard.collabShareToken !== shareToken ||
		whiteboard.archivedAt
	) {
		throw new Error("collab-share-not-found");
	}

	return {
		whiteboard,
		canWrite: whiteboard.collabShareAccessLevel === "edit",
	};
}

async function requirePresentationAccess(
	whiteboardId: string,
	shareToken: string,
) {
	const whiteboard = await db.query.whiteboards.findFirst({
		where: eq(whiteboards.id, whiteboardId),
	});

	if (
		!whiteboard ||
		!whiteboard.presentationShareEnabled ||
		whiteboard.presentationShareToken !== shareToken
	) {
		throw new Error("presentation-share-not-found");
	}

	if (whiteboard.archivedAt) {
		throw new Error("presentation-share-not-found");
	}

	return { whiteboard };
}

async function requireEmbedAccess(whiteboardId: string, shareToken: string) {
	const whiteboard = await db.query.whiteboards.findFirst({
		where: eq(whiteboards.id, whiteboardId),
	});

	if (
		!whiteboard ||
		!whiteboard.embedShareEnabled ||
		whiteboard.embedShareToken !== shareToken
	) {
		throw new Error("embed-share-not-found");
	}

	if (whiteboard.archivedAt) {
		throw new Error("embed-share-not-found");
	}

	return { whiteboard };
}

const server = new Hocuspocus({
	port: env.REALTIME_PORT,
	extensions: [
		new Database({
			async fetch({ documentName }) {
				const result = await db
					.select({
						e2eeEnabled: whiteboards.e2eeEnabled,
						yjsState: whiteboards.yjsState,
					})
					.from(whiteboards)
					.where(eq(whiteboards.id, documentName))
					.limit(1);

				if (result.length > 0 && !result[0].e2eeEnabled && result[0].yjsState) {
					return decryptBytes(result[0].yjsState, getYjsEncryptionOptions());
				}
				return null;
			},

			async store({ documentName, state }) {
				await db
					.update(whiteboards)
					.set({
						yjsState: encryptBytes(
							Buffer.from(state),
							getYjsEncryptionOptions(),
						),
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(whiteboards.id, documentName),
							eq(whiteboards.e2eeEnabled, false),
						),
					);
			},
		}),
	],

	async onAuthenticate({ token, documentName, connection }) {
		const payload = verifyRealtimeAuthToken(token, env.AUTH_SECRET);

		if (payload.whiteboardId !== documentName) {
			throw Object.assign(new Error("whiteboard-token-mismatch"), {
				reason: "whiteboard-token-mismatch",
			});
		}

		if (payload.accessType === "presentation") {
			if (!payload.presentationShareToken || payload.role !== "viewer") {
				throw Object.assign(new Error("presentation-token-invalid"), {
					reason: "presentation-token-invalid",
				});
			}
			const access = await requirePresentationAccess(
				documentName,
				payload.presentationShareToken,
			);
			rejectE2eeRealtime(access.whiteboard);
		} else if (payload.accessType === "collabLink") {
			if (!payload.collabShareToken) {
				throw Object.assign(new Error("collab-token-invalid"), {
					reason: "collab-token-invalid",
				});
			}
			const collab = await requireCollabLinkAccess(
				documentName,
				payload.collabShareToken,
			);
			rejectE2eeRealtime(collab.whiteboard);
			const expectedRole: RealtimeRole = collab.canWrite ? "editor" : "viewer";
			if (payload.role !== expectedRole) {
				throw Object.assign(new Error("collab-role-mismatch"), {
					reason: "collab-role-mismatch",
				});
			}
		} else if (payload.accessType === "embed") {
			if (!payload.embedShareToken || payload.role !== "viewer") {
				throw Object.assign(new Error("embed-token-invalid"), {
					reason: "embed-token-invalid",
				});
			}
			const access = await requireEmbedAccess(
				documentName,
				payload.embedShareToken,
			);
			rejectE2eeRealtime(access.whiteboard);
		} else {
			const access = await requireMemberAccess(
				payload.userId,
				documentName,
			).catch(() => requireWorkspaceAccess(payload.userId, documentName));
			rejectE2eeRealtime(access.whiteboard);
			const expectedRole: RealtimeRole = access.canWrite
				? payload.role === "owner"
					? "owner"
					: "editor"
				: "viewer";

			if (
				expectedRole !== payload.role &&
				!(access.canWrite && payload.role === "editor")
			) {
				// Owner-Token akzeptieren wenn User Schreibrechte hat
				if (
					!(
						access.canWrite &&
						(payload.role === "owner" || payload.role === "editor")
					)
				) {
					throw Object.assign(new Error("role-token-mismatch"), {
						reason: "role-token-mismatch",
					});
				}
			}
		}

		connection.readOnly =
			payload.accessType === "presentation" ||
			payload.accessType === "embed" ||
			READONLY_ROLES.includes(payload.role as RealtimeRole);

		return {
			user: {
				id: payload.userId,
				name: payload.name,
				image: payload.image ?? null,
			},
			whiteboardId: payload.whiteboardId,
			role: payload.role,
		};
	},
});

process.on("SIGTERM", async () => {
	await server.destroy();
	process.exit(0);
});

server.listen().then(() => {
	console.log(`[Skedra Realtime] ws://localhost:${env.REALTIME_PORT}`);
});
