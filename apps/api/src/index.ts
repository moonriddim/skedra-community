import { createHash } from "node:crypto";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { SKEDRA_LIB_MIME, skedraLibrarySchema } from "@skedra/shared";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import type Stripe from "stripe";
import { z } from "zod";
import { env } from "./env";
import {
	AssetObjectNotFoundError,
	AssetStorageUnavailableError,
	AssetUploadError,
	createEncryptedImageAsset,
	findAsset,
	readAssetObject,
} from "./lib/assets";
import { auth } from "./lib/auth";
import { userHasProductAccess } from "./lib/billing-entitlement";
import { subscribeBoardLive } from "./lib/board-live-bus";
import {
	type PresenceMember,
	broadcastPresence,
	joinPresenceRoom,
	leavePresenceRoom,
} from "./lib/board-presence";
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
import { getStripeClient, isStripeBillingConfigured } from "./lib/stripe";
import { processStripeWebhookEvent } from "./lib/stripe-billing";
import { restApp } from "./rest";
import { appRouter, createContext } from "./trpc";

const app = new Hono();

if (isStripeBillingConfigured()) {
	/**
	 * Keep this route free of body parsers: Stripe's signature check must receive
	 * the exact raw request body. Billing access is changed only from this handler,
	 * never from the browser's return from Checkout.
	 */
	app.post("/api/stripe/webhook", async (c) => {
		const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
		if (!webhookSecret) {
			return c.json({ error: "Stripe webhook ist nicht konfiguriert." }, 503);
		}

		const signature = c.req.header("stripe-signature");
		if (!signature) {
			return c.json({ error: "Stripe-Signatur fehlt." }, 400);
		}

		let event: Stripe.Event;
		try {
			event = getStripeClient().webhooks.constructEvent(
				await c.req.raw.text(),
				signature,
				webhookSecret,
			);
		} catch {
			return c.json({ error: "Ungültige Stripe-Signatur." }, 400);
		}

		try {
			await processStripeWebhookEvent(db, event);
			return c.json({ received: true });
		} catch (error) {
			console.error("Stripe webhook processing failed", error);
			return c.json(
				{ error: "Stripe-Webhook konnte nicht verarbeitet werden." },
				500,
			);
		}
	});
}

// WebSocket-Support für den Presence-Kanal (Phase 2). injectWebSocket wird nach
// dem serve()-Aufruf unten mit dem Node-Server verbunden.
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

const publicLibrarySubmissionSchema = z.object({
	slug: z.string().min(3).max(64),
	name: z.string().min(1).max(120),
	description: z.string().max(500).optional(),
	authorName: z.string().max(120).optional(),
	submitterName: z.string().max(120).optional(),
	submitterEmail: z.string().email().max(320).optional(),
	sourceInstanceUrl: z.string().url().max(500).optional(),
	licenseAccepted: z.literal(true),
	file: skedraLibrarySchema,
});

const uuidPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | undefined): value is string {
	return typeof value === "string" && uuidPattern.test(value);
}

type AssetAccessUser = {
	id: string;
	name: string;
	email: string;
	image?: string | null;
};

class AssetAccessError extends Error {
	constructor(
		message: string,
		readonly status: 401 | 403 | 409 | 429,
	) {
		super(message);
		this.name = "AssetAccessError";
	}
}

const ASSET_UPLOAD_BODY_OVERHEAD_BYTES = 1024 * 1024;
const ASSET_UPLOAD_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const ASSET_UPLOAD_RATE_LIMITS = { member: 120, collabLink: 30 } as const;
const assetUploadRateLimits = new Map<
	string,
	{ windowStart: number; count: number }
>();
let assetUploadRateLimitLastCleanupAt = 0;

function formString(formData: FormData, key: string) {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

function queryString(
	c: { req: { query: (name: string) => string | undefined } },
	key: string,
) {
	return c.req.query(key)?.trim() ?? "";
}

function hashRateLimitToken(token: string) {
	return createHash("sha256").update(token).digest("hex").slice(0, 32);
}

function cleanupExpiredAssetUploadRateLimits(now: number) {
	if (
		assetUploadRateLimits.size < 1000 &&
		now - assetUploadRateLimitLastCleanupAt < 60_000
	) {
		return;
	}
	assetUploadRateLimitLastCleanupAt = now;
	for (const [key, bucket] of assetUploadRateLimits) {
		if (now - bucket.windowStart >= ASSET_UPLOAD_RATE_LIMIT_WINDOW_MS) {
			assetUploadRateLimits.delete(key);
		}
	}
}

function enforceAssetUploadRateLimit(input: {
	key: string;
	maxUploads: number;
}) {
	const now = Date.now();
	cleanupExpiredAssetUploadRateLimits(now);
	const bucket = assetUploadRateLimits.get(input.key);
	if (
		!bucket ||
		now - bucket.windowStart >= ASSET_UPLOAD_RATE_LIMIT_WINDOW_MS
	) {
		assetUploadRateLimits.set(input.key, { windowStart: now, count: 1 });
		return;
	}
	if (bucket.count >= input.maxUploads) {
		throw new AssetAccessError(
			"Zu viele Uploads. Bitte spaeter erneut versuchen.",
			429,
		);
	}
	bucket.count += 1;
}

async function authorizeAssetUpload(input: {
	whiteboardId: string;
	user: AssetAccessUser | null;
	collabShareToken: string;
}) {
	if (input.collabShareToken) {
		const access = await getCollabShareAccess(db, input.collabShareToken).catch(
			() => {
				throw new AssetAccessError("Zugriff verweigert", 403);
			},
		);
		if (access.whiteboard.id !== input.whiteboardId || !access.canWrite) {
			throw new AssetAccessError("Zugriff verweigert", 403);
		}
		return {
			ownerId: access.whiteboard.ownerId,
			rateLimitKey: `collab:${hashRateLimitToken(input.collabShareToken)}`,
			maxUploads: ASSET_UPLOAD_RATE_LIMITS.collabLink,
		};
	}

	if (!input.user) throw new AssetAccessError("Nicht authentifiziert", 401);
	if (!(await userHasProductAccess(db, input.user.id))) {
		throw new AssetAccessError("Aktives Abo erforderlich", 403);
	}
	const access = await getBoardAccess(
		{ db, user: input.user },
		input.whiteboardId,
	);
	if (!access.canWrite) throw new AssetAccessError("Zugriff verweigert", 403);
	return {
		ownerId: input.user.id,
		rateLimitKey: `user:${input.user.id}`,
		maxUploads: ASSET_UPLOAD_RATE_LIMITS.member,
	};
}

async function hasShareTokenAssetAccess(input: {
	whiteboardId: string;
	presentationShareToken: string;
	collabShareToken: string;
	embedShareToken: string;
}) {
	if (input.collabShareToken) {
		try {
			const access = await getCollabShareAccess(db, input.collabShareToken);
			if (access.whiteboard.id === input.whiteboardId) return true;
		} catch {
			// Another supplied token may still grant access.
		}
	}
	if (input.presentationShareToken) {
		try {
			const access = await getPresentationShareAccess(
				db,
				input.presentationShareToken,
			);
			if (access.whiteboard.id === input.whiteboardId) return true;
		} catch {
			// Another supplied token may still grant access.
		}
	}
	if (input.embedShareToken) {
		try {
			const access = await getEmbedShareAccess(db, input.embedShareToken);
			if (access.whiteboard.id === input.whiteboardId) return true;
		} catch {
			// No matching share token.
		}
	}
	return false;
}

async function authorizeAssetRead(input: {
	asset: NonNullable<Awaited<ReturnType<typeof findAsset>>>;
	user: AssetAccessUser | null;
	presentationShareToken: string;
	collabShareToken: string;
	embedShareToken: string;
}) {
	if (input.user) {
		if (await userHasProductAccess(db, input.user.id)) {
			try {
				await getBoardAccess(
					{ db, user: input.user },
					input.asset.whiteboardId,
				);
				return;
			} catch {
				// Share tokens below may still grant access.
			}
		}
	}
	if (
		await hasShareTokenAssetAccess({
			whiteboardId: input.asset.whiteboardId,
			presentationShareToken: input.presentationShareToken,
			collabShareToken: input.collabShareToken,
			embedShareToken: input.embedShareToken,
		})
	) {
		return;
	}
	throw new AssetAccessError(
		input.user ? "Zugriff verweigert" : "Nicht authentifiziert",
		input.user ? 403 : 401,
	);
}

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

app.use(
	"/api/assets/images",
	bodyLimit({
		maxSize:
			env.SKEDRA_ASSET_MAX_IMAGE_BYTES + ASSET_UPLOAD_BODY_OVERHEAD_BYTES,
		onError: (c) => c.json({ error: "Upload zu gross" }, 413),
	}),
);

app.post("/api/assets/images", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	const user = session?.user
		? {
				id: session.user.id,
				name: session.user.name,
				email: session.user.email,
				image: session.user.image,
			}
		: null;
	const formData = await c.req.raw.formData().catch(() => null);
	if (!formData) return c.json({ error: "Ungueltiger Upload" }, 400);

	const assetId = formString(formData, "assetId");
	const whiteboardId = formString(formData, "whiteboardId");
	const collabShareToken = formString(formData, "collabShareToken");
	const fileValue = formData.get("file");
	if (!isUuid(assetId)) return c.json({ error: "assetId ist ungueltig" }, 400);
	if (!isUuid(whiteboardId)) {
		return c.json({ error: "whiteboardId ist ungueltig" }, 400);
	}
	if (!fileValue || typeof fileValue === "string") {
		return c.json({ error: "Datei fehlt" }, 400);
	}

	try {
		const access = await authorizeAssetUpload({
			whiteboardId,
			user,
			collabShareToken,
		});
		enforceAssetUploadRateLimit({
			key: access.rateLimitKey,
			maxUploads: access.maxUploads,
		});
		const asset = await createEncryptedImageAsset({
			db,
			assetId,
			userId: access.ownerId,
			whiteboardId,
			file: fileValue,
			plaintextSize: Number(formString(formData, "plaintextSize")),
			encryptionVersion: Number(formString(formData, "encryptionVersion")),
		});
		return c.json(asset, 201);
	} catch (error) {
		if (error instanceof AssetAccessError) {
			return c.json({ error: error.message }, error.status);
		}
		if (error instanceof AssetUploadError) {
			const status =
				error.status === 413 ? 413 : error.status === 409 ? 409 : 400;
			return c.json({ error: error.message }, status);
		}
		console.error("Encrypted image upload failed", { assetId, error });
		return c.json({ error: "Bild konnte nicht gespeichert werden" }, 500);
	}
});

app.get("/api/assets/:assetId", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	const user = session?.user
		? {
				id: session.user.id,
				name: session.user.name,
				email: session.user.email,
				image: session.user.image,
			}
		: null;
	const assetId = c.req.param("assetId");
	if (!isUuid(assetId)) return c.json({ error: "assetId ist ungueltig" }, 400);
	const asset = await findAsset(db, assetId);
	if (!asset) return c.json({ error: "Asset nicht gefunden" }, 404);

	try {
		await authorizeAssetRead({
			asset,
			user,
			presentationShareToken: queryString(c, "presentationShareToken"),
			collabShareToken: queryString(c, "collabShareToken"),
			embedShareToken: queryString(c, "embedShareToken"),
		});
		const object = await readAssetObject({ db, assetId });
		if (!object) return c.json({ error: "Asset nicht gefunden" }, 404);
		const headers = new Headers({
			"Content-Type": object.contentType,
			"X-Content-Type-Options": "nosniff",
			"Cache-Control": "private, max-age=300, stale-while-revalidate=60",
			Vary: "Cookie, Authorization",
		});
		if (object.etag) headers.set("ETag", object.etag);
		const body = object.body.buffer.slice(
			object.body.byteOffset,
			object.body.byteOffset + object.body.byteLength,
		) as ArrayBuffer;
		return new Response(body, { headers });
	} catch (error) {
		if (error instanceof AssetAccessError) {
			return c.json({ error: error.message }, error.status);
		}
		if (error instanceof AssetObjectNotFoundError) {
			return c.json({ error: "Asset nicht gefunden" }, 404);
		}
		if (error instanceof AssetStorageUnavailableError) {
			console.error("Asset storage unavailable", { assetId, error });
			return c.json({ error: "Asset Storage ist nicht erreichbar" }, 503);
		}
		console.error("Asset delivery failed", { assetId, error });
		return c.json({ error: "Asset konnte nicht geladen werden" }, 502);
	}
});

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

		// Fix A6: E-Mail konsistent normalisieren. Zuvor prüfte der Invite-Check
		// die kleingeschriebene E-Mail, an better-auth ging aber die Original-
		// Schreibweise — dadurch konnten First-Admin-Zuweisung und Invite-Abschluss
		// (Lookup per normalisierter E-Mail) stillschweigend fehlschlagen.
		const normalizedEmail =
			typeof body.email === "string" ? normalizeInviteEmail(body.email) : "";
		if (normalizedEmail) {
			body.email = normalizedEmail;
		}

		return {
			email: normalizedEmail,
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
			licenseAccepted: parsed.data.licenseAccepted,
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

/**
 * SSE-Live-Kanal für Realtime-E2EE-Sync (Phase 1).
 *
 * Schiebt sofort ein Ereignis an verbundene Clients, sobald ein neues
 * verschlüsseltes Update im Log landet — so entfällt die Poll-Latenz. Übertragen
 * werden NUR Metadaten (Update-ID, Zeitstempel); der Ciphertext wird weiter über
 * listE2eeUpdates geholt und ausschließlich im Client entschlüsselt.
 *
 * Zugriff: eingeloggte Nutzer mit Board-Lesezugriff. Gäste über Share-Links
 * bleiben vorerst beim Polling.
 */
app.get("/api/boards/:id/live", async (c) => {
	const id = c.req.param("id");
	if (!isUuid(id)) return c.json({ error: "Board-ID ist ungueltig" }, 400);

	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session?.user) return c.json({ error: "Nicht authentifiziert" }, 401);
	if (!(await userHasProductAccess(db, session.user.id))) {
		return c.json({ error: "Aktives Abo erforderlich" }, 402);
	}

	try {
		await getBoardAccess(
			{
				db,
				user: {
					id: session.user.id,
					name: session.user.name,
					email: session.user.email,
					image: session.user.image,
				},
			},
			id,
		);
	} catch {
		return c.json({ error: "Kein Zugriff auf dieses Board" }, 403);
	}

	return streamSSE(c, async (stream) => {
		const queue: string[] = [];
		let wake: (() => void) | null = null;

		const unsubscribe = subscribeBoardLive(id, (event) => {
			queue.push(JSON.stringify(event));
			wake?.();
		});
		stream.onAbort(() => unsubscribe());

		try {
			await stream.writeSSE({ event: "ready", data: "ok" });
			while (!stream.aborted) {
				if (queue.length === 0) {
					// Auf das nächste Ereignis warten ODER nach 15 s einen Heartbeat senden.
					await Promise.race([
						new Promise<void>((resolve) => {
							wake = resolve;
						}),
						stream.sleep(15_000),
					]);
					wake = null;
				}
				if (stream.aborted) break;
				if (queue.length === 0) {
					await stream.writeSSE({ event: "ping", data: String(Date.now()) });
					continue;
				}
				const data = queue.shift();
				if (data) await stream.writeSSE({ event: "update", data });
			}
		} finally {
			unsubscribe();
		}
	});
});

/**
 * WebSocket-Presence-Kanal für Realtime-E2EE (Phase 2).
 *
 * Relayt ausschließlich CLIENTSEITIG verschlüsselte Presence-Nachrichten
 * (Cursor/Auswahl/Name) an die anderen Teilnehmer eines Boards. Nichts wird
 * persistiert, nichts entschlüsselt. Zugriff: eingeloggte Nutzer mit Board-Lesezugriff.
 */
app.get(
	"/api/boards/:id/presence",
	upgradeWebSocket(async (c) => {
		const rawId = c.req.param("id");
		const boardId = isUuid(rawId) ? rawId : null;
		let authorizedUserId: string | null = null;

		if (boardId) {
			const session = await auth.api.getSession({ headers: c.req.raw.headers });
			if (session?.user && (await userHasProductAccess(db, session.user.id))) {
				try {
					await getBoardAccess(
						{
							db,
							user: {
								id: session.user.id,
								name: session.user.name,
								email: session.user.email,
								image: session.user.image,
							},
						},
						boardId,
					);
					authorizedUserId = session.user.id;
				} catch {
					authorizedUserId = null;
				}
			}
		}

		let member: PresenceMember | null = null;

		return {
			onOpen(_evt, ws) {
				if (!authorizedUserId || !boardId) {
					ws.close(1008, "unauthorized");
					return;
				}
				member = joinPresenceRoom(boardId, ws, authorizedUserId);
			},
			onMessage(evt) {
				if (!member || !boardId) return;
				const data = typeof evt.data === "string" ? evt.data : null;
				// Größenlimit gegen Missbrauch; Inhalt ist Ciphertext, wird nicht geparst.
				if (!data || data.length > 64_000) return;
				broadcastPresence(boardId, member, data);
			},
			onClose() {
				if (member && boardId) leavePresenceRoom(boardId, member);
			},
		};
	}),
);

app.all("/api/trpc/*", (c) =>
	fetchRequestHandler({
		endpoint: "/api/trpc",
		req: c.req.raw,
		router: appRouter,
		createContext: ({ req }) => createContext({ req }),
	}),
);

const server = serve({ fetch: app.fetch, port: 3001 }, () => {
	console.log("[Skedra API] http://localhost:3001");
});

// WebSocket-Upgrades (Presence) an den Node-Server anhängen.
injectWebSocket(server);
