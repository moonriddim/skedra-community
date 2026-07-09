/**
 * Public REST API v1 — Board-Endpunkte.
 */

import { users, whiteboardMembers, whiteboards } from "@skedra/db";
import {
	addCanvasElementsSchema,
	createWhiteboardSchema,
	updateCanvasElementSchema,
} from "@skedra/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
	findArchivedBoardsForUser,
	listBoardActivities,
	listRecentActivities,
	logWhiteboardActivity,
} from "../lib/activity";
import {
	addElementsToYjsState,
	deleteElementFromYjsState,
	readElementsFromYjsState,
	updateElementInYjsState,
} from "../lib/canvas-state";
import { db } from "../lib/db";
import {
	findBoardsForUser,
	getBoardCollaborators,
	requireArchivedBoardOwner,
	requireBoardMember,
	requireBoardOwner,
} from "../lib/permissions";
import {
	type ApiAuthVariables,
	apiKeyAuth,
	serializeBoard,
	toPermissionCtx,
	withApiScope,
} from "./middleware";
import {
	handleRestRouteError,
	handleRestRouteErrorWithZod,
} from "./route-errors";

const boardsRouter = new Hono<{ Variables: ApiAuthVariables }>();

boardsRouter.use("*", apiKeyAuth);

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

			const [created] = await db
				.insert(whiteboards)
				.values({
					name: body.name,
					ownerId: user.id,
					e2eeEnabled: true,
					e2eeCreatedAt: new Date(),
				})
				.returning();

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
				c.req.param("id"),
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
			const id = c.req.param("id");
			const access = await requireBoardMember(ctx, id);
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
				c.req.param("id"),
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
				c.req.param("id"),
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
			const id = c.req.param("id");
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

			await db.delete(whiteboards).where(eq(whiteboards.id, id));
			return c.json({ success: true });
		} catch (error) {
			return handleRestRouteError(c, error);
		}
	}),
);

/** GET /api/v1/boards/:id/elements */
boardsRouter.get("/boards/:id/elements", (c) =>
	withApiScope(c, "boards:read", async () => {
		try {
			const access = await requireBoardMember(
				toPermissionCtx(c.get("apiUser")),
				c.req.param("id"),
			);
			if (access.whiteboard.e2eeEnabled) {
				return c.json(
					{ error: "E2EE-Boards koennen ueber REST nicht gelesen werden" },
					409,
				);
			}
			const full = await db.query.whiteboards.findFirst({
				where: eq(whiteboards.id, access.whiteboard.id),
				columns: { yjsState: true },
			});
			const elements = readElementsFromYjsState(full?.yjsState ?? null);
			return c.json({ elements, count: elements.length });
		} catch (error) {
			return handleRestRouteError(c, error);
		}
	}),
);

/** POST /api/v1/boards/:id/elements */
boardsRouter.post("/boards/:id/elements", (c) =>
	withApiScope(c, "boards:write", async () => {
		try {
			const user = c.get("apiUser");
			const id = c.req.param("id");
			const access = await requireBoardMember(toPermissionCtx(user), id);
			if (access.whiteboard.e2eeEnabled) {
				return c.json(
					{ error: "E2EE-Boards koennen ueber REST nicht bearbeitet werden" },
					409,
				);
			}
			if (!access.canWrite) {
				return c.json(
					{ error: "Nur Besitzer und Mitglieder duerfen Elemente hinzufuegen" },
					403,
				);
			}

			const body = addCanvasElementsSchema.parse(await c.req.json());
			const full = await db.query.whiteboards.findFirst({
				where: eq(whiteboards.id, access.whiteboard.id),
				columns: { yjsState: true },
			});

			const { state, elements } = addElementsToYjsState(
				full?.yjsState ?? null,
				body.elements,
			);

			await db
				.update(whiteboards)
				.set({ yjsState: state, updatedAt: new Date() })
				.where(eq(whiteboards.id, id));

			return c.json({ elements, count: elements.length }, 201);
		} catch (error) {
			return handleRestRouteErrorWithZod(c, error);
		}
	}),
);

/** PATCH /api/v1/boards/:id/elements/:elementId */
boardsRouter.patch("/boards/:id/elements/:elementId", (c) =>
	withApiScope(c, "boards:write", async () => {
		try {
			const user = c.get("apiUser");
			const boardId = c.req.param("id");
			const elementId = c.req.param("elementId");
			const access = await requireBoardMember(toPermissionCtx(user), boardId);
			if (access.whiteboard.e2eeEnabled) {
				return c.json(
					{ error: "E2EE-Boards koennen ueber REST nicht bearbeitet werden" },
					409,
				);
			}
			if (!access.canWrite) {
				return c.json(
					{ error: "Nur Besitzer und Mitglieder duerfen Elemente bearbeiten" },
					403,
				);
			}

			const body = updateCanvasElementSchema.parse(await c.req.json());
			const full = await db.query.whiteboards.findFirst({
				where: eq(whiteboards.id, access.whiteboard.id),
				columns: { yjsState: true },
			});

			const { state, element } = updateElementInYjsState(
				full?.yjsState ?? null,
				elementId,
				body,
			);
			if (!element) {
				return c.json({ error: "Element nicht gefunden" }, 404);
			}

			await db
				.update(whiteboards)
				.set({ yjsState: state, updatedAt: new Date() })
				.where(eq(whiteboards.id, boardId));

			return c.json({ element });
		} catch (error) {
			return handleRestRouteErrorWithZod(c, error);
		}
	}),
);

/** DELETE /api/v1/boards/:id/elements/:elementId */
boardsRouter.delete("/boards/:id/elements/:elementId", (c) =>
	withApiScope(c, "boards:write", async () => {
		try {
			const user = c.get("apiUser");
			const boardId = c.req.param("id");
			const elementId = c.req.param("elementId");
			const access = await requireBoardMember(toPermissionCtx(user), boardId);
			if (access.whiteboard.e2eeEnabled) {
				return c.json(
					{ error: "E2EE-Boards koennen ueber REST nicht bearbeitet werden" },
					409,
				);
			}
			if (!access.canWrite) {
				return c.json(
					{ error: "Nur Besitzer und Mitglieder duerfen Elemente loeschen" },
					403,
				);
			}

			const full = await db.query.whiteboards.findFirst({
				where: eq(whiteboards.id, access.whiteboard.id),
				columns: { yjsState: true },
			});

			const { state, deleted } = deleteElementFromYjsState(
				full?.yjsState ?? null,
				elementId,
			);
			if (!deleted) {
				return c.json({ error: "Element nicht gefunden" }, 404);
			}

			await db
				.update(whiteboards)
				.set({ yjsState: state, updatedAt: new Date() })
				.where(eq(whiteboards.id, boardId));

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
			await requireBoardMember(
				toPermissionCtx(c.get("apiUser")),
				c.req.param("id"),
			);
			const collaborators = await getBoardCollaborators(db, c.req.param("id"));
			return c.json(collaborators);
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
			const id = c.req.param("id");
			await requireBoardOwner(toPermissionCtx(user), id);
			const body = z
				.object({ email: z.string().email() })
				.parse(await c.req.json());

			const invited = await db.query.users.findFirst({
				where: eq(users.email, body.email.toLowerCase()),
			});

			if (!invited) {
				return c.json(
					{ error: "Benutzer mit dieser E-Mail nicht gefunden" },
					404,
				);
			}

			await db
				.insert(whiteboardMembers)
				.values({ whiteboardId: id, userId: invited.id })
				.onConflictDoNothing();

			await logWhiteboardActivity(db, {
				whiteboardId: id,
				userId: user.id,
				type: "member_invited",
				metadata: { email: invited.email },
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
			const id = c.req.param("id");
			await requireBoardMember(toPermissionCtx(c.get("apiUser")), id);
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

export { boardsRouter };
