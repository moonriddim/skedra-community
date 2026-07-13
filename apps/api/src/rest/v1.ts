/**
 * Public REST API v1 — Board-Endpunkte.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import {
	teamMembers,
	teamRoles,
	teams,
	userE2eeIdentities,
	users,
	whiteboardE2eeUpdates,
	whiteboardKeyRecipients,
	whiteboardMembers,
	whiteboards,
} from "@skedra/db";
import {
	accessLevelFromPermissions,
	createWhiteboardSchema,
	e2eeKeyHashSchema,
	parseTeamRolePermissions,
} from "@skedra/shared";
import { decryptText, encryptText } from "@skedra/shared/server-crypto";
import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
	findArchivedBoardsForUser,
	listBoardActivities,
	listRecentActivities,
	logWhiteboardActivity,
} from "../lib/activity";
import {
	deleteAssetObjects,
	deleteWhiteboardAndCollectAssetObjects,
} from "../lib/assets";
import { publishBoardLive } from "../lib/board-live-bus";
import { membershipValuesFromTeamRole } from "../lib/board-member-access";
import { db } from "../lib/db";
import {
	assertCanAssignTeamRoleForBoard,
	findBoardsForUser,
	getBoardCollaborators,
	requireArchivedBoardOwner,
	requireBoardInvite,
	requireBoardMember,
	requireBoardOwner,
	requireBoardViewActivity,
} from "../lib/permissions";
import { requireTeamRole } from "../lib/team-roles";
import { ensureOwnedWorkspace } from "../lib/workspace";
import { getYjsEncryptionOptions } from "../lib/yjs-encryption";
import {
	type ApiAuthVariables,
	apiKeyAuth,
	serializeBoard,
	toPermissionCtx,
	withApiScope,
} from "./middleware";
import {
	RestBadRequestError,
	handleRestRouteError,
	handleRestRouteErrorWithZod,
} from "./route-errors";

const boardsRouter = new Hono<{ Variables: ApiAuthVariables }>();
const uuidParamSchema = z.string().uuid();

boardsRouter.use("*", apiKeyAuth);

function uuidParam(
	c: { req: { param: (name: string) => string } },
	name: string,
) {
	const value = c.req.param(name);
	if (!uuidParamSchema.safeParse(value).success) {
		throw new RestBadRequestError(`${name} ist ungueltig`);
	}
	return value;
}

function assertBoardKeyEnvelopeMetadata(
	encryptedBoardKey: string,
	expected: {
		whiteboardId: string;
		userId: string;
		keyHash: string;
		recipientPublicKeyHash: string;
	},
) {
	let parsed: unknown;
	try {
		parsed = JSON.parse(encryptedBoardKey);
	} catch {
		throw new RestBadRequestError("E2EE-Key-Umschlag ist ungueltig");
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new RestBadRequestError("E2EE-Key-Umschlag ist ungueltig");
	}
	const envelope = parsed as Record<string, unknown>;
	if (
		envelope.v !== 1 ||
		envelope.alg !== "ECDH-P256-AES-GCM-256" ||
		envelope.boardId !== expected.whiteboardId ||
		envelope.recipientUserId !== expected.userId ||
		envelope.keyHash !== expected.keyHash ||
		envelope.recipientPublicKeyHash !== expected.recipientPublicKeyHash ||
		typeof envelope.iv !== "string" ||
		typeof envelope.data !== "string" ||
		!envelope.epk ||
		typeof envelope.epk !== "object" ||
		Array.isArray(envelope.epk)
	) {
		throw new RestBadRequestError(
			"E2EE-Key-Umschlag passt nicht zu Board oder Empfaenger",
		);
	}
}

function createUserE2eePublicKeyHash(publicKey: string) {
	return createHash("sha256").update(publicKey, "utf8").digest("hex");
}

async function requireUserE2eePublicKeyHash(userId: string) {
	const identity = await db.query.userE2eeIdentities.findFirst({
		where: eq(userE2eeIdentities.userId, userId),
		columns: { publicKey: true },
	});
	if (!identity) {
		throw new RestBadRequestError("E2EE-Identity fehlt fuer diesen Empfaenger");
	}
	return createUserE2eePublicKeyHash(identity.publicKey);
}

/** GET /api/v1/me — Authentifizierung testen */
boardsRouter.get("/me", (c) => {
	const user = c.get("apiUser");
	return c.json({ id: user.id, name: user.name, email: user.email });
});

/** GET /api/v1/boards */
boardsRouter.get("/boards", (c) =>
	withApiScope(c, "boards:read", async () => {
		const user = c.get("apiUser");
		const boards = await findBoardsForUser(db, user.id);
		return c.json({
			boards: boards.map((board) => serializeBoard(board)),
		});
	}),
);

/** GET /api/v1/boards/archived */
boardsRouter.get("/boards/archived", (c) =>
	withApiScope(c, "boards:read", async () => {
		const user = c.get("apiUser");
		const boards = await findArchivedBoardsForUser(db, user.id);
		return c.json({
			boards: boards.map((board) => serializeBoard(board)),
		});
	}),
);

/** POST /api/v1/boards */
boardsRouter.post("/boards", (c) =>
	withApiScope(c, "boards:write", async () => {
		try {
			const user = c.get("apiUser");
			const body = createWhiteboardSchema.parse(await c.req.json());
			if (
				body.encryptionMode === "e2ee" &&
				body.ownEncryptedBoardKey &&
				!body.id
			) {
				throw new RestBadRequestError(
					"Board-ID fehlt fuer gebundenen E2EE-Key-Umschlag",
				);
			}
			if (body.encryptionMode === "e2ee" && body.ownEncryptedBoardKey) {
				const recipientPublicKeyHash = await requireUserE2eePublicKeyHash(
					user.id,
				);
				assertBoardKeyEnvelopeMetadata(body.ownEncryptedBoardKey, {
					whiteboardId: body.id as string,
					userId: user.id,
					keyHash: body.e2eeKeyHash,
					recipientPublicKeyHash,
				});
			}
			const workspace = await ensureOwnedWorkspace(db, user);

			const created = await db.transaction(async (tx) => {
				const [board] = await tx
					.insert(whiteboards)
					.values({
						...(body.id ? { id: body.id } : {}),
						name: body.name,
						ownerId: user.id,
						teamId: workspace.id,
						encryptionMode: body.encryptionMode,
						...(body.encryptionMode === "e2ee"
							? {
									e2eeKeyHash: body.e2eeKeyHash,
									e2eeCreatedAt: new Date(),
								}
							: {}),
					})
					.returning();

				if (body.encryptionMode === "e2ee" && body.ownEncryptedBoardKey) {
					await tx.insert(whiteboardKeyRecipients).values({
						whiteboardId: board.id,
						userId: user.id,
						encryptedBoardKey: body.ownEncryptedBoardKey,
					});
				}

				return board;
			});

			await logWhiteboardActivity(db, {
				whiteboardId: created.id,
				userId: user.id,
				type: "board_created",
				metadata: { name: created.name },
			});

			return c.json({ board: serializeBoard(created) }, 201);
		} catch (error) {
			return handleRestRouteErrorWithZod(c, error);
		}
	}),
);

/** GET /api/v1/boards/:id */
boardsRouter.get("/boards/:id", (c) =>
	withApiScope(c, "boards:read", async () => {
		try {
			const access = await requireBoardMember(
				toPermissionCtx(c.get("apiUser")),
				uuidParam(c, "id"),
			);
			return c.json({ board: serializeBoard(access.whiteboard) });
		} catch (error) {
			return handleRestRouteError(c, error);
		}
	}),
);

/** PATCH /api/v1/boards/:id */
boardsRouter.patch("/boards/:id", (c) =>
	withApiScope(c, "boards:write", async () => {
		try {
			const user = c.get("apiUser");
			const ctx = toPermissionCtx(user);
			const id = uuidParam(c, "id");
			const access = await requireBoardOwner(ctx, id);
			const body = z
				.object({ name: z.string().min(1).max(120) })
				.parse(await c.req.json());

			const [updated] = await db
				.update(whiteboards)
				.set({ name: body.name, updatedAt: new Date() })
				.where(eq(whiteboards.id, id))
				.returning();

			if (body.name !== access.whiteboard.name) {
				await logWhiteboardActivity(db, {
					whiteboardId: id,
					userId: user.id,
					type: "board_renamed",
					metadata: { name: body.name, previousName: access.whiteboard.name },
				});
			}

			return c.json({ board: serializeBoard(updated) });
		} catch (error) {
			return handleRestRouteErrorWithZod(c, error);
		}
	}),
);

/** POST /api/v1/boards/:id/archive */
boardsRouter.post("/boards/:id/archive", (c) =>
	withApiScope(c, "boards:write", async () => {
		try {
			const user = c.get("apiUser");
			const access = await requireBoardOwner(
				toPermissionCtx(user),
				uuidParam(c, "id"),
			);

			await db
				.update(whiteboards)
				.set({ archivedAt: new Date(), updatedAt: new Date() })
				.where(eq(whiteboards.id, access.whiteboard.id));

			await logWhiteboardActivity(db, {
				whiteboardId: access.whiteboard.id,
				userId: user.id,
				type: "board_archived",
				metadata: { name: access.whiteboard.name },
			});

			return c.json({ success: true });
		} catch (error) {
			return handleRestRouteError(c, error);
		}
	}),
);

/** POST /api/v1/boards/:id/restore */
boardsRouter.post("/boards/:id/restore", (c) =>
	withApiScope(c, "boards:write", async () => {
		try {
			const user = c.get("apiUser");
			const { whiteboard } = await requireArchivedBoardOwner(
				toPermissionCtx(user),
				uuidParam(c, "id"),
			);

			await db
				.update(whiteboards)
				.set({ archivedAt: null, updatedAt: new Date() })
				.where(eq(whiteboards.id, whiteboard.id));

			await logWhiteboardActivity(db, {
				whiteboardId: whiteboard.id,
				userId: user.id,
				type: "board_restored",
				metadata: { name: whiteboard.name },
			});

			return c.json({ success: true });
		} catch (error) {
			return handleRestRouteError(c, error);
		}
	}),
);

/** DELETE /api/v1/boards/:id — endgueltig loeschen (nur archivierte Boards) */
boardsRouter.delete("/boards/:id", (c) =>
	withApiScope(c, "boards:delete", async () => {
		try {
			const user = c.get("apiUser");
			const id = uuidParam(c, "id");
			const { whiteboard } = await requireArchivedBoardOwner(
				toPermissionCtx(user),
				id,
			);

			await logWhiteboardActivity(db, {
				whiteboardId: id,
				userId: user.id,
				type: "board_deleted",
				metadata: { name: whiteboard.name },
			});

			const assetObjects = await deleteWhiteboardAndCollectAssetObjects({
				db,
				whiteboardId: id,
			});
			await deleteAssetObjects({ db, objects: assetObjects, whiteboardId: id });
			return c.json({ success: true });
		} catch (error) {
			return handleRestRouteError(c, error);
		}
	}),
);

/** GET /api/v1/boards/:id/members */
boardsRouter.get("/boards/:id/members", (c) =>
	withApiScope(c, "boards:read", async () => {
		try {
			const id = uuidParam(c, "id");
			const access = await requireBoardMember(
				toPermissionCtx(c.get("apiUser")),
				id,
			);
			const collaborators = await getBoardCollaborators(db, id);
			return c.json(collaborators);
		} catch (error) {
			return handleRestRouteError(c, error);
		}
	}),
);

/** GET /api/v1/boards/:id/team-roles */
boardsRouter.get("/boards/:id/team-roles", (c) =>
	withApiScope(c, "boards:read", async () => {
		try {
			const access = await requireBoardMember(
				toPermissionCtx(c.get("apiUser")),
				uuidParam(c, "id"),
			);
			if (!access.whiteboard.teamId) return c.json({ roles: [] });

			const roles = await db.query.teamRoles.findMany({
				where: eq(teamRoles.teamId, access.whiteboard.teamId),
			});

			return c.json({
				roles: roles.map((role) => ({
					id: role.id,
					name: role.name,
					color: role.color,
					permissions: parseTeamRolePermissions(role.permissions),
				})),
			});
		} catch (error) {
			return handleRestRouteError(c, error);
		}
	}),
);

/** POST /api/v1/boards/:id/members */
boardsRouter.post("/boards/:id/members", (c) =>
	withApiScope(c, "members:write", async () => {
		try {
			const user = c.get("apiUser");
			const id = uuidParam(c, "id");
			const access = await requireBoardInvite(toPermissionCtx(user), id);
			if (!access.whiteboard.teamId) {
				return c.json({ error: "Board gehoert zu keinem Workspace" }, 400);
			}
			const body = z
				.object({
					email: z.string().email(),
					roleId: z.string().uuid(),
				})
				.parse(await c.req.json());

			const role = await requireTeamRole(
				db,
				access.whiteboard.teamId,
				body.roleId,
			);
			const permissions = parseTeamRolePermissions(role.permissions);
			assertCanAssignTeamRoleForBoard(access, permissions);
			const memberValues = membershipValuesFromTeamRole(role.id);
			const assignedAccessLevel = accessLevelFromPermissions(permissions);

			const invited = await db.query.users.findFirst({
				where: eq(users.email, body.email.toLowerCase()),
			});

			if (!invited) {
				return c.json(
					{ error: "Benutzer mit dieser E-Mail nicht gefunden" },
					404,
				);
			}

			const workspace = await db.query.teams.findFirst({
				where: eq(teams.id, access.whiteboard.teamId),
				columns: { ownerId: true },
			});
			if (workspace?.ownerId !== invited.id) {
				await db
					.insert(teamMembers)
					.values({
						teamId: access.whiteboard.teamId,
						userId: invited.id,
						roleId: role.id,
						workspaceRole: "member",
					})
					.onConflictDoNothing();
			}

			await db
				.insert(whiteboardMembers)
				.values({ whiteboardId: id, userId: invited.id, ...memberValues })
				.onConflictDoUpdate({
					target: [whiteboardMembers.whiteboardId, whiteboardMembers.userId],
					set: memberValues,
				});

			await logWhiteboardActivity(db, {
				whiteboardId: id,
				userId: user.id,
				type: "member_invited",
				metadata: {
					email: invited.email,
					accessLevel: assignedAccessLevel,
					roleName: role.name,
				},
			});

			return c.json({ success: true }, 201);
		} catch (error) {
			return handleRestRouteErrorWithZod(c, error);
		}
	}),
);

/** GET /api/v1/boards/:id/activity */
boardsRouter.get("/boards/:id/activity", (c) =>
	withApiScope(c, "boards:read", async () => {
		try {
			const id = uuidParam(c, "id");
			await requireBoardViewActivity(toPermissionCtx(c.get("apiUser")), id);
			const limit = Number(c.req.query("limit") ?? 50);
			const activities = await listBoardActivities(
				db,
				id,
				Math.min(Math.max(limit, 1), 100),
			);
			return c.json({
				activities: activities.map((item) => ({
					...item,
					createdAt: item.createdAt.toISOString(),
				})),
			});
		} catch (error) {
			return handleRestRouteError(c, error);
		}
	}),
);

/** GET /api/v1/activity */
boardsRouter.get("/activity", (c) =>
	withApiScope(c, "boards:read", async () => {
		const user = c.get("apiUser");
		const limit = Number(c.req.query("limit") ?? 30);
		const activities = await listRecentActivities(
			db,
			user.id,
			Math.min(Math.max(limit, 1), 100),
		);
		return c.json({
			activities: activities.map((item) => ({
				...item,
				createdAt: item.createdAt.toISOString(),
				whiteboard: item.whiteboard
					? {
							...item.whiteboard,
							archivedAt: item.whiteboard.archivedAt?.toISOString() ?? null,
						}
					: null,
			})),
		});
	}),
);

/**
 * Vergleicht E2EE-Key-Hashes (SHA-256-Hex) in konstanter Zeit — gleiche Logik wie
 * im tRPC-Whiteboard-Router. Der Hash beweist Schlüsselbesitz, ohne den Schlüssel
 * preiszugeben; ein Timing-sicherer Vergleich verhindert einen Seitenkanal.
 */
function e2eeKeyHashesEqual(
	a: string | null | undefined,
	b: string | null | undefined,
) {
	if (!a || !b || a.length !== b.length) return false;
	return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * GET /api/v1/boards/:id/updates — verschlüsseltes Update-Log lesen.
 *
 * Für MCP/Agents, die den bestehenden Board-Zustand rekonstruieren wollen. Gibt
 * ausschließlich Ciphertext-Envelopes zurück; entschlüsselt wird nur beim Agent,
 * der den E2EE-Schlüssel besitzt.
 */
boardsRouter.get("/boards/:id/updates", (c) =>
	withApiScope(c, "boards:read", async () => {
		try {
			const id = uuidParam(c, "id");
			const access = await requireBoardMember(
				toPermissionCtx(c.get("apiUser")),
				id,
			);

			const limit = Math.min(
				Math.max(Number(c.req.query("limit") ?? 500), 1),
				1000,
			);
			const afterId = c.req.query("afterId");
			const afterCreatedAtRaw = c.req.query("afterCreatedAt");
			const afterCreatedAt = afterCreatedAtRaw
				? new Date(afterCreatedAtRaw)
				: null;

			const where =
				afterCreatedAt && afterId
					? and(
							eq(whiteboardE2eeUpdates.whiteboardId, id),
							or(
								gt(whiteboardE2eeUpdates.createdAt, afterCreatedAt),
								and(
									eq(whiteboardE2eeUpdates.createdAt, afterCreatedAt),
									gt(whiteboardE2eeUpdates.id, afterId),
								),
							),
						)
					: eq(whiteboardE2eeUpdates.whiteboardId, id);

			const rows = await db.query.whiteboardE2eeUpdates.findMany({
				where,
				orderBy: [
					asc(whiteboardE2eeUpdates.createdAt),
					asc(whiteboardE2eeUpdates.id),
				],
				limit,
				columns: { id: true, clientId: true, update: true, createdAt: true },
			});

			return c.json({
				updates: rows.map((row) => ({
					id: row.id,
					clientId: row.clientId,
					update:
						access.whiteboard.encryptionMode === "server"
							? decryptText(row.update, getYjsEncryptionOptions())
							: row.update,
					createdAt: row.createdAt.toISOString(),
				})),
			});
		} catch (error) {
			return handleRestRouteError(c, error);
		}
	}),
);

const appendUpdateBodySchema = z.object({
	clientId: z.string().min(8).max(120),
	keyHash: e2eeKeyHashSchema.optional(),
	update: z.string().min(1).max(4_000_000),
});

/**
 * POST /api/v1/boards/:id/updates — verschlüsseltes Update anhängen.
 *
 * Der MCP/Agent baut das Yjs-Update lokal, verschlüsselt es mit dem E2EE-Schlüssel
 * und schickt hier nur den Ciphertext + den keyHash (Schlüsselnachweis). Nach dem
 * durable Insert wird der Live-Bus benachrichtigt → die Änderung erscheint sofort
 * bei allen verbundenen Web-Clients. Der Server sieht nie Klartext.
 */
boardsRouter.post("/boards/:id/updates", (c) =>
	withApiScope(c, "boards:write", async () => {
		try {
			const user = c.get("apiUser");
			const id = uuidParam(c, "id");
			const access = await requireBoardMember(toPermissionCtx(user), id);

			if (!access.canWrite) {
				return c.json({ error: "Keine Schreibrechte fuer dieses Board" }, 403);
			}

			const body = appendUpdateBodySchema.parse(await c.req.json());

			// Schlüsselnachweis: der geposteten keyHash muss zum Board passen.
			if (access.whiteboard.encryptionMode === "e2ee") {
				if (!access.whiteboard.e2eeKeyHash) {
					return c.json({ error: "Board hat keinen E2EE-Key-Verifier" }, 400);
				}
				if (!e2eeKeyHashesEqual(body.keyHash, access.whiteboard.e2eeKeyHash)) {
					return c.json({ error: "E2EE-Key passt nicht zu diesem Board" }, 403);
				}
			}

			const created = await db.transaction(async (tx) => {
				// Lock the board row before inserting so REST appends use the same
				// per-board ordering guarantee as tRPC append/compaction.
				await tx
					.update(whiteboards)
					.set({ updatedAt: sql`clock_timestamp()` })
					.where(eq(whiteboards.id, id));

				const [row] = await tx
					.insert(whiteboardE2eeUpdates)
					.values({
						whiteboardId: id,
						userId: user.id,
						clientId: body.clientId,
						update:
							access.whiteboard.encryptionMode === "server"
								? encryptText(body.update, getYjsEncryptionOptions())
								: body.update,
						createdAt: sql`clock_timestamp()`,
					})
					.returning({
						id: whiteboardE2eeUpdates.id,
						createdAt: whiteboardE2eeUpdates.createdAt,
					});
				return row;
			});

			// Realtime: sofort an verbundene Clients (nur Metadaten, kein Klartext).
			publishBoardLive({
				type: "update",
				whiteboardId: id,
				id: created.id,
				createdAt: created.createdAt.toISOString(),
			});

			return c.json(
				{ id: created.id, createdAt: created.createdAt.toISOString() },
				201,
			);
		} catch (error) {
			return handleRestRouteErrorWithZod(c, error);
		}
	}),
);

export { boardsRouter };
