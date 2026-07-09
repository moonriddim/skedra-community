import { serve } from "@hono/node-server";
import { SKEDRA_LIB_MIME, skedraLibrarySchema } from "@skedra/shared";
import { createRealtimeAuthToken } from "@skedra/shared/realtime-auth";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { env } from "./env";
import { auth } from "./lib/auth";
import { getCollabShareAccess, getEmbedShareAccess } from "./lib/collab-share";
import { db } from "./lib/db";
import { getBoardAccess } from "./lib/permissions";
import { getPresentationShareAccess } from "./lib/presentation";
import {
	assignFirstUserAsInstanceAdmin,
	canSignUpWithEmail,
	completeRegistrationInvite,
	normalizeInviteEmail,
} from "./lib/registration-invites";
import {
	getConfiguredPublishedLibraryFile,
	listConfiguredPublicShapeLibraries,
	submitShapeLibraryForReview,
} from "./lib/shape-libraries";
import { restApp } from "./rest";
import { appRouter, createContext } from "./trpc";

const app = new Hono();

const publicLibrarySubmissionSchema = z.object({
	slug: z.string().min(3).max(64),
	name: z.string().min(1).max(120),
	description: z.string().max(500).optional(),
	authorName: z.string().max(120).optional(),
	submitterName: z.string().max(120).optional(),
	submitterEmail: z.string().email().max(320).optional(),
	sourceInstanceUrl: z.string().url().max(500).optional(),
	file: skedraLibrarySchema,
});

const corsOrigins = [env.APP_URL, env.LIBRARIES_URL].map((url) =>
	url.replace(/\/$/, ""),
);

app.use(
	"*",
	cors({
		origin: (origin) => {
			if (!origin) return corsOrigins[0];
			const normalized = origin.replace(/\/$/, "");
			return corsOrigins.includes(normalized) ? normalized : corsOrigins[0];
		},
		credentials: true,
	}),
);

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.route("/api", restApp);

function isEmailSignUpRequest(request: Request) {
	const url = new URL(request.url);
	return (
		request.method.toUpperCase() === "POST" &&
		url.pathname.endsWith("/api/auth/sign-up/email")
	);
}

async function readSignUpBody(request: Request) {
	try {
		const rawBody = await request.clone().json();
		const body =
			typeof rawBody === "object" && rawBody !== null && !Array.isArray(rawBody)
				? ({ ...rawBody } as Record<string, unknown>)
				: {};
		const inviteToken = body.inviteToken;
		body.inviteToken = undefined;

		return {
			email:
				typeof body.email === "string" ? normalizeInviteEmail(body.email) : "",
			inviteToken: typeof inviteToken === "string" ? inviteToken : null,
			authBody: body,
		};
	} catch {
		return { email: "", inviteToken: null, authBody: {} };
	}
}

function createAuthRequestWithoutInviteToken(
	request: Request,
	body: Record<string, unknown>,
) {
	const headers = new Headers(request.headers);
	headers.delete("content-length");
	headers.set("content-type", "application/json");

	return new Request(request.url, {
		method: request.method,
		headers,
		body: JSON.stringify(body),
	});
}

app.all("/api/auth/*", async (c) => {
	const request = c.req.raw;
	if (!isEmailSignUpRequest(request)) {
		return auth.handler(request);
	}

	const signUp = await readSignUpBody(request);
	if (!signUp.email) {
		return c.json(
			{ code: "INVALID_EMAIL", message: "E-Mail-Adresse fehlt." },
			400,
		);
	}

	const access = await canSignUpWithEmail(db, {
		email: signUp.email,
		token: signUp.inviteToken,
		mode: env.SKEDRA_REGISTRATION_MODE,
	});

	if (!access.allowed) {
		return c.json(
			{
				code: "REGISTRATION_INVITE_REQUIRED",
				message:
					env.SKEDRA_REGISTRATION_MODE === "closed"
						? "Registrierung ist auf dieser Skedra-Instanz deaktiviert."
						: "Registrierung ist nur mit einem gueltigen Einladungslink moeglich.",
			},
			403,
		);
	}

	const response = await auth.handler(
		createAuthRequestWithoutInviteToken(request, signUp.authBody),
	);
	if (response.ok) {
		const user = await db.query.users.findFirst({
			where: (users, { eq }) => eq(users.email, signUp.email),
		});

		if (user && access.firstUser) {
			await assignFirstUserAsInstanceAdmin(db, user.id);
		}

		if (signUp.inviteToken) {
			await completeRegistrationInvite(db, {
				email: signUp.email,
				token: signUp.inviteToken,
			});
		}
	}

	return response;
});

app.get("/api/realtime/token", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) return c.json({ error: "Nicht authentifiziert" }, 401);

	const whiteboardId = c.req.query("whiteboardId");
	if (!whiteboardId) return c.json({ error: "whiteboardId fehlt" }, 400);

	try {
		const access = await getBoardAccess(
			{ db, user: session.user },
			whiteboardId,
		);
		if (access.whiteboard.e2eeEnabled) {
			return c.json({ error: "E2EE-Boards nutzen verschluesselten Sync" }, 409);
		}
		const realtimeRole = access.canWrite ? access.role : "viewer";
		const exp = Math.floor(Date.now() / 1000) + 60 * 5;

		const token = createRealtimeAuthToken(
			{
				v: 1,
				userId: session.user.id,
				whiteboardId: access.whiteboard.id,
				accessType: "member",
				role: realtimeRole,
				name: session.user.name,
				image: session.user.image ?? null,
				exp,
			},
			env.AUTH_SECRET,
		);

		return c.json({
			token,
			expiresAt: exp,
			user: {
				id: session.user.id,
				name: session.user.name,
				image: session.user.image ?? null,
				role: realtimeRole,
			},
		});
	} catch {
		return c.json({ error: "Zugriff verweigert" }, 403);
	}
});

app.get("/api/realtime/collab-token", async (c) => {
	const shareToken = c.req.query("shareToken");
	if (!shareToken) return c.json({ error: "shareToken fehlt" }, 400);

	try {
		const access = await getCollabShareAccess(db, shareToken);
		if (access.whiteboard.e2eeEnabled) {
			return c.json({ error: "E2EE-Boards nutzen verschluesselten Sync" }, 409);
		}
		const exp = Math.floor(Date.now() / 1000) + 60 * 5;
		const guestId = `guest-${shareToken.slice(0, 8)}`;
		const role = access.canWrite ? "editor" : "viewer";

		const token = createRealtimeAuthToken(
			{
				v: 1,
				userId: guestId,
				whiteboardId: access.whiteboard.id,
				accessType: "collabLink",
				collabShareToken: shareToken,
				role,
				name: "Gast",
				image: null,
				exp,
			},
			env.AUTH_SECRET,
		);

		return c.json({
			token,
			expiresAt: exp,
			whiteboardId: access.whiteboard.id,
			canWrite: access.canWrite,
			user: { id: guestId, name: "Gast", image: null, role },
		});
	} catch {
		return c.json({ error: "Link ungueltig" }, 403);
	}
});

app.get("/api/realtime/presentation-token", async (c) => {
	const shareToken = c.req.query("shareToken");
	if (!shareToken) return c.json({ error: "shareToken fehlt" }, 400);

	try {
		const access = await getPresentationShareAccess(db, shareToken);
		if (access.whiteboard.e2eeEnabled) {
			return c.json({ error: "E2EE-Boards nutzen verschluesselten Sync" }, 409);
		}
		const exp = Math.floor(Date.now() / 1000) + 60 * 5;

		const token = createRealtimeAuthToken(
			{
				v: 1,
				userId: `guest-${shareToken.slice(0, 8)}`,
				whiteboardId: access.whiteboard.id,
				accessType: "presentation",
				presentationShareToken: shareToken,
				role: "viewer",
				name: "Gast",
				image: null,
				exp,
			},
			env.AUTH_SECRET,
		);

		return c.json({
			token,
			expiresAt: exp,
			presenceEnabled: access.shareSettings.presenceEnabled,
			user: {
				id: `guest-${shareToken.slice(0, 8)}`,
				name: "Gast",
				image: null,
				role: "viewer",
			},
		});
	} catch {
		return c.json({ error: "Link ungueltig" }, 403);
	}
});

app.get("/api/realtime/embed-token", async (c) => {
	const shareToken = c.req.query("shareToken");
	if (!shareToken) return c.json({ error: "shareToken fehlt" }, 400);

	try {
		const access = await getEmbedShareAccess(db, shareToken);
		if (access.whiteboard.e2eeEnabled) {
			return c.json({ error: "E2EE-Boards nutzen verschluesselten Sync" }, 409);
		}
		const exp = Math.floor(Date.now() / 1000) + 60 * 5;
		const guestId = `embed-${shareToken.slice(0, 8)}`;

		const token = createRealtimeAuthToken(
			{
				v: 1,
				userId: guestId,
				whiteboardId: access.whiteboard.id,
				accessType: "embed",
				embedShareToken: shareToken,
				role: "viewer",
				name: "Embed",
				image: null,
				exp,
			},
			env.AUTH_SECRET,
		);

		return c.json({
			token,
			expiresAt: exp,
			whiteboardId: access.whiteboard.id,
			user: { id: guestId, name: "Embed", image: null, role: "viewer" },
		});
	} catch {
		return c.json({ error: "Link ungueltig" }, 403);
	}
});

/** Öffentliche .skedralib-Dateien (von Nutzern veröffentlicht). */
app.get("/api/libraries", async (c) => {
	try {
		return c.json(await listConfiguredPublicShapeLibraries(db), 200, {
			"Cache-Control": "public, max-age=60",
		});
	} catch {
		return c.json({ error: "Katalog konnte nicht geladen werden" }, 502);
	}
});

app.post("/api/libraries/submissions", async (c) => {
	if (env.SKEDRA_LIBRARY_CATALOG_MODE !== "local") {
		return c.json({ error: "Einreichungen werden zentral verwaltet" }, 404);
	}

	const rawBody = await c.req.json().catch(() => null);
	const parsed = publicLibrarySubmissionSchema.safeParse(rawBody);
	if (!parsed.success) {
		return c.json({ error: "Ungueltige Einreichung" }, 400);
	}

	const authorName =
		parsed.data.authorName?.trim() ||
		parsed.data.submitterName?.trim() ||
		"Skedra user";

	try {
		const row = await submitShapeLibraryForReview(db, {
			authorName,
			submitterName: parsed.data.submitterName?.trim() || authorName,
			submitterEmail: parsed.data.submitterEmail,
			sourceInstanceUrl: parsed.data.sourceInstanceUrl,
			slug: parsed.data.slug,
			name: parsed.data.name,
			description: parsed.data.description,
			file: parsed.data.file,
		});

		return c.json(
			{
				id: row.id,
				slug: row.slug,
				name: row.name,
				status: row.status,
			},
			201,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : "UNKNOWN";
		if (message === "SLUG_TAKEN") {
			return c.json({ error: "Dieser Slug ist bereits vergeben" }, 409);
		}
		if (message === "INVALID_SLUG" || message === "EMPTY_LIBRARY") {
			return c.json({ error: "Ungueltige Bibliothek" }, 400);
		}
		return c.json(
			{ error: "Einreichung konnte nicht gespeichert werden" },
			500,
		);
	}
});

app.get("/api/libraries/:slug", async (c) => {
	const rawSlug = c.req.param("slug") ?? "";

	try {
		const file = await getConfiguredPublishedLibraryFile(db, rawSlug);
		if (!file) {
			return c.json({ error: "Bibliothek nicht gefunden" }, 404);
		}
		return c.json(file, 200, {
			"Content-Type": SKEDRA_LIB_MIME,
			"Cache-Control": "public, max-age=300",
		});
	} catch {
		return c.json({ error: "Ungültige Bibliothek" }, 500);
	}
});

app.all("/api/trpc/*", (c) =>
	fetchRequestHandler({
		endpoint: "/api/trpc",
		req: c.req.raw,
		router: appRouter,
		createContext: ({ req }) => createContext({ req }),
	}),
);

serve({ fetch: app.fetch, port: 3001 }, () => {
	console.log("[Skedra API] http://localhost:3001");
});
