import { createHash, randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { whiteboards } from "@skedra/db";
import {
	SKEDRA_LIB_MIME,
	presentationFrameContentSchema,
	presentationPublisherMessageSchema,
	skedraLibrarySchema,
} from "@skedra/shared";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import type { WSContext } from "hono/ws";
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
import { closeBoardLiveBus, subscribeBoardLive } from "./lib/board-live-bus";
import {
	type PresenceMember,
	broadcastPresence,
	closeBoardPresence,
	joinPresenceRoom,
	leavePresenceRoom,
} from "./lib/board-presence";
import { getCollabShareAccess, getEmbedShareAccess } from "./lib/collab-share";
import { closeDatabase, db } from "./lib/db";
import { getBoardAccess } from "./lib/permissions";
import {
	countPresentationAudience,
	getPresentationShareAccess,
	isAuthorizedPresentationSession,
	presentationFrameAllowsAsset,
	refreshPresentationAudienceConnection,
	removePresentationAudienceConnection,
} from "./lib/presentation";
import {
	type PresentationLiveEvent,
	closePresentationLiveBus,
	publishPresentationLive,
	subscribePresentationLive,
} from "./lib/presentation-live-bus";
import {
	assignFirstUserAsInstanceAdmin,
	canSignUpWithEmail,
	closeRegistrationLocks,
	completeRegistrationInvite,
	normalizeInviteEmail,
	withRegistrationLock,
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
const { injectWebSocket, upgradeWebSocket, wss } = createNodeWebSocket({ app });

type PresentationViewerConnection = {
	ws: WSContext;
	connectionId: string;
	sessionId: string | null;
	refreshTimer: ReturnType<typeof setInterval> | null;
	syncInFlight: boolean;
};

type PresentationPresenterConnection = {
	ws: WSContext;
	sessionId: string;
	userId: string;
};

const presentationViewerRooms = new Map<
	string,
	Set<PresentationViewerConnection>
>();
const presentationPresenterRooms = new Map<
	string,
	Set<PresentationPresenterConnection>
>();
const presentationRoomUnsubscribers = new Map<string, () => void>();
const presentationAudienceCountTimers = new Map<
	string,
	ReturnType<typeof setTimeout>
>();

function sendPresentationMessage(ws: WSContext, message: unknown) {
	try {
		ws.send(JSON.stringify(message));
	} catch {
		// The websocket lifecycle removes disconnected room members.
	}
}

async function sendStoredPresentationFrame(
	whiteboardId: string,
	viewer: PresentationViewerConnection,
) {
	const board = await db.query.whiteboards.findFirst({
		where: eq(whiteboards.id, whiteboardId),
		columns: {
			presentationSessionId: true,
			presentationActiveUntil: true,
			presentationFrameSequence: true,
			presentationFramePayload: true,
		},
	});
	if (
		!board?.presentationSessionId ||
		!board.presentationFramePayload ||
		board.presentationFrameSequence == null ||
		!board.presentationActiveUntil ||
		board.presentationActiveUntil.getTime() <= Date.now()
	) {
		sendPresentationMessage(viewer.ws, { type: "waiting" });
		return;
	}
	sendPresentationMessage(viewer.ws, {
		type: "frame",
		sessionId: board.presentationSessionId,
		sequence: board.presentationFrameSequence,
		payload: board.presentationFramePayload,
	});
}

async function relayPresentationLiveEvent(event: PresentationLiveEvent) {
	if (event.type === "frame") {
		const board = await db.query.whiteboards.findFirst({
			where: eq(whiteboards.id, event.whiteboardId),
			columns: {
				presentationSessionId: true,
				presentationFrameSequence: true,
				presentationFramePayload: true,
			},
		});
		if (
			board?.presentationSessionId !== event.sessionId ||
			board.presentationFrameSequence !== event.sequence ||
			!board.presentationFramePayload
		) {
			return;
		}
		for (const viewer of presentationViewerRooms.get(event.whiteboardId) ??
			[]) {
			sendPresentationMessage(viewer.ws, {
				type: "frame",
				sessionId: event.sessionId,
				sequence: event.sequence,
				payload: board.presentationFramePayload,
			});
		}
		return;
	}

	if (event.type === "cursor") {
		for (const viewer of presentationViewerRooms.get(event.whiteboardId) ??
			[]) {
			sendPresentationMessage(viewer.ws, {
				type: "cursor",
				sessionId: event.sessionId,
				sequence: event.sequence,
				cursor: event.cursor,
			});
		}
		return;
	}

	if (event.type === "camera") {
		for (const viewer of presentationViewerRooms.get(event.whiteboardId) ??
			[]) {
			sendPresentationMessage(viewer.ws, {
				type: "camera",
				sessionId: event.sessionId,
				sequence: event.sequence,
				viewId: event.viewId,
				camera: event.camera,
			});
		}
		return;
	}

	if (event.type === "audience") {
		for (const presenter of presentationPresenterRooms.get(
			event.whiteboardId,
		) ?? []) {
			if (presenter.sessionId !== event.sessionId) continue;
			sendPresentationMessage(presenter.ws, {
				type: "audience",
				count: event.count,
			});
		}
		return;
	}

	for (const viewer of presentationViewerRooms.get(event.whiteboardId) ?? []) {
		if (event.sessionId && viewer.sessionId !== event.sessionId) continue;
		sendPresentationMessage(viewer.ws, { type: "ended" });
		viewer.sessionId = null;
		if (event.type === "revoke") viewer.ws.close(1008, "presentation revoked");
	}
	for (const presenter of presentationPresenterRooms.get(event.whiteboardId) ??
		[]) {
		if (event.sessionId && presenter.sessionId !== event.sessionId) continue;
		sendPresentationMessage(presenter.ws, { type: "ended" });
		if (event.type === "revoke")
			presenter.ws.close(1008, "presentation revoked");
	}
}

function ensurePresentationRoomSubscription(whiteboardId: string) {
	if (presentationRoomUnsubscribers.has(whiteboardId)) return;
	presentationRoomUnsubscribers.set(
		whiteboardId,
		subscribePresentationLive(whiteboardId, (event) => {
			void relayPresentationLiveEvent(event);
		}),
	);
}

function cleanupPresentationRoomSubscription(whiteboardId: string) {
	if (
		(presentationViewerRooms.get(whiteboardId)?.size ?? 0) > 0 ||
		(presentationPresenterRooms.get(whiteboardId)?.size ?? 0) > 0
	) {
		return;
	}
	presentationViewerRooms.delete(whiteboardId);
	presentationPresenterRooms.delete(whiteboardId);
	presentationRoomUnsubscribers.get(whiteboardId)?.();
	presentationRoomUnsubscribers.delete(whiteboardId);
}

async function publishPresentationAudienceCount(
	whiteboardId: string,
	sessionId: string,
) {
	publishPresentationLive({
		type: "audience",
		whiteboardId,
		sessionId,
		count: await countPresentationAudience(db, whiteboardId, sessionId),
	});
}

/** Collapse simultaneous viewer lease refreshes into one audience count. */
function schedulePresentationAudienceCount(
	whiteboardId: string,
	sessionId: string,
) {
	const key = `${whiteboardId}:${sessionId}`;
	if (presentationAudienceCountTimers.has(key)) return;
	const timer = setTimeout(() => {
		presentationAudienceCountTimers.delete(key);
		void publishPresentationAudienceCount(whiteboardId, sessionId).catch(
			(error) => {
				console.warn(
					"[skedra] Could not publish presentation audience count.",
					error,
				);
			},
		);
	}, 100);
	timer.unref();
	presentationAudienceCountTimers.set(key, timer);
}

function clearScheduledPresentationAudienceCounts() {
	for (const timer of presentationAudienceCountTimers.values()) {
		clearTimeout(timer);
	}
	presentationAudienceCountTimers.clear();
}

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
	assetId: string;
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
			if (
				presentationFrameAllowsAsset(access.whiteboard, {
					whiteboardId: input.whiteboardId,
					assetId: input.assetId,
				})
			)
				return true;
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
			assetId: input.asset.id,
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

app.get("/api/health", async (c) => {
	c.header("Cache-Control", "no-store");
	try {
		await db.$client`select 1`;
		return c.json({ status: "ok", database: "ok" });
	} catch {
		return c.json({ status: "error", database: "unavailable" }, 503);
	}
});

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

	return withRegistrationLock(async () => {
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

			if (user) {
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
	if (
		env.SKEDRA_DEPLOYMENT_MODE !== "managed" ||
		env.SKEDRA_LIBRARY_CATALOG_MODE !== "local"
	) {
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

	c.header("Cache-Control", "no-cache, no-transform");
	c.header("X-Accel-Buffering", "no");
	return streamSSE(c, async (stream) => {
		// The event is only a refetch hint. Coalescing prevents slow clients from
		// accumulating an unbounded queue while the durable update log stays exact.
		let pendingEvent: string | null = null;
		let wake: (() => void) | null = null;

		const unsubscribe = subscribeBoardLive(id, (event) => {
			pendingEvent = JSON.stringify(event);
			wake?.();
		});
		stream.onAbort(() => unsubscribe());

		try {
			await stream.writeSSE({ event: "ready", data: "ok" });
			while (!stream.aborted) {
				if (!pendingEvent) {
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
				if (!pendingEvent) {
					await stream.writeSSE({ event: "ping", data: String(Date.now()) });
					continue;
				}
				const data = pendingEvent;
				pendingEvent = null;
				await stream.writeSSE({ event: "update", data });
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
 * persistiert, nichts entschlüsselt. Zugriff: eingeloggte Nutzer mit Board-Lesezugriff
 * oder Presentation-Viewer, wenn Presence für den Share-Link aktiviert ist.
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
				if (!data || data.length > 6_000) return;
				broadcastPresence(boardId, member, data);
			},
			onClose() {
				if (member && boardId) leavePresenceRoom(boardId, member);
			},
		};
	}),
);

/** Receive-only channel that exposes only the currently published slide. */
app.get(
	"/api/presentations/:shareToken/live",
	upgradeWebSocket(async (c) => {
		const shareToken = c.req.param("shareToken")?.trim() ?? "";
		let whiteboardId: string | null = null;
		try {
			whiteboardId = (await getPresentationShareAccess(db, shareToken))
				.whiteboard.id;
		} catch {
			whiteboardId = null;
		}

		let viewer: PresentationViewerConnection | null = null;
		const synchronizeViewerSession = async () => {
			const currentViewer = viewer;
			if (!currentViewer || !whiteboardId || currentViewer.syncInFlight) return;
			currentViewer.syncInFlight = true;
			try {
				const access = await getPresentationShareAccess(db, shareToken);
				if (viewer !== currentViewer) return;
				if (access.whiteboard.id !== whiteboardId)
					throw new Error("wrong board");
				const activeSessionId =
					access.whiteboard.presentationSessionId &&
					access.whiteboard.presentationActiveUntil &&
					access.whiteboard.presentationActiveUntil.getTime() > Date.now()
						? access.whiteboard.presentationSessionId
						: null;

				if (
					currentViewer.sessionId &&
					currentViewer.sessionId !== activeSessionId
				) {
					const previousSessionId = currentViewer.sessionId;
					await removePresentationAudienceConnection(
						db,
						currentViewer.connectionId,
					);
					if (viewer !== currentViewer) return;
					currentViewer.sessionId = null;
					schedulePresentationAudienceCount(whiteboardId, previousSessionId);
				}
				if (activeSessionId) {
					currentViewer.sessionId = activeSessionId;
					await refreshPresentationAudienceConnection(db, {
						connectionId: currentViewer.connectionId,
						whiteboardId,
						sessionId: activeSessionId,
					});
					if (viewer !== currentViewer) {
						void removePresentationAudienceConnection(
							db,
							currentViewer.connectionId,
						).catch((error) => {
							console.warn(
								"[skedra] Could not remove presentation audience connection.",
								error,
							);
						});
						return;
					}
					schedulePresentationAudienceCount(whiteboardId, activeSessionId);
				}
				await sendStoredPresentationFrame(whiteboardId, currentViewer);
			} catch (error) {
				if (
					error instanceof Error &&
					error.message === "presentation-share-inactive" &&
					viewer === currentViewer
				) {
					const previousSessionId = currentViewer.sessionId;
					await removePresentationAudienceConnection(
						db,
						currentViewer.connectionId,
					);
					if (viewer !== currentViewer) return;
					currentViewer.sessionId = null;
					if (previousSessionId) {
						schedulePresentationAudienceCount(whiteboardId, previousSessionId);
					}
					sendPresentationMessage(currentViewer.ws, { type: "ended" });
					return;
				}
				if (viewer === currentViewer) {
					currentViewer.ws.close(1008, "presentation access expired");
				}
			} finally {
				currentViewer.syncInFlight = false;
			}
		};

		return {
			onOpen(_event, ws) {
				if (!whiteboardId) {
					ws.close(1008, "unauthorized");
					return;
				}
				viewer = {
					ws,
					connectionId: randomUUID(),
					sessionId: null,
					refreshTimer: null,
					syncInFlight: false,
				};
				let room = presentationViewerRooms.get(whiteboardId);
				if (!room) {
					room = new Set();
					presentationViewerRooms.set(whiteboardId, room);
				}
				room.add(viewer);
				ensurePresentationRoomSubscription(whiteboardId);
				void synchronizeViewerSession();
				viewer.refreshTimer = setInterval(() => {
					void synchronizeViewerSession();
				}, 15_000);
			},
			onMessage(_event, ws) {
				ws.close(1008, "audience channel is receive-only");
			},
			onClose() {
				if (!viewer || !whiteboardId) return;
				if (viewer.refreshTimer) clearInterval(viewer.refreshTimer);
				presentationViewerRooms.get(whiteboardId)?.delete(viewer);
				const { connectionId, sessionId } = viewer;
				void removePresentationAudienceConnection(db, connectionId)
					.then(() => {
						if (sessionId) {
							schedulePresentationAudienceCount(whiteboardId, sessionId);
						}
					})
					.catch((error) => {
						console.warn(
							"[skedra] Could not remove presentation audience connection.",
							error,
						);
					});
				cleanupPresentationRoomSubscription(whiteboardId);
				viewer = null;
			},
		};
	}),
);

/** Session-bound publisher channel for the single authorized presenter. */
app.get(
	"/api/boards/:id/presentation-live",
	upgradeWebSocket(async (c) => {
		const rawBoardId = c.req.param("id");
		const whiteboardId = isUuid(rawBoardId) ? rawBoardId : null;
		const rawSessionId = c.req.query("sessionId")?.trim();
		const sessionId = isUuid(rawSessionId) ? rawSessionId : null;
		let authorizedUserId: string | null = null;
		let cursorEnabled = false;
		let publisherEncryptionMode: "server" | "e2ee" | null = null;

		if (whiteboardId && sessionId) {
			const session = await auth.api.getSession({ headers: c.req.raw.headers });
			if (session?.user && (await userHasProductAccess(db, session.user.id))) {
				try {
					const access = await getBoardAccess(
						{
							db,
							user: {
								id: session.user.id,
								name: session.user.name,
								email: session.user.email,
								image: session.user.image,
							},
						},
						whiteboardId,
					);
					if (
						access.canWrite &&
						isAuthorizedPresentationSession(access.whiteboard, {
							sessionId,
							presenterId: session.user.id,
						})
					) {
						authorizedUserId = session.user.id;
						cursorEnabled = access.whiteboard.presentationSharePresenceEnabled;
						publisherEncryptionMode = access.whiteboard.encryptionMode;
					}
				} catch {
					authorizedUserId = null;
				}
			}
		}

		let presenter: PresentationPresenterConnection | null = null;
		return {
			async onOpen(_event, ws) {
				if (!whiteboardId || !sessionId || !authorizedUserId) {
					ws.close(1008, "unauthorized presenter session");
					return;
				}
				presenter = { ws, sessionId, userId: authorizedUserId };
				let room = presentationPresenterRooms.get(whiteboardId);
				if (!room) {
					room = new Set();
					presentationPresenterRooms.set(whiteboardId, room);
				}
				room.add(presenter);
				ensurePresentationRoomSubscription(whiteboardId);
				sendPresentationMessage(ws, {
					type: "ready",
					audienceCount: await countPresentationAudience(
						db,
						whiteboardId,
						sessionId,
					),
				});
			},
			async onMessage(event, ws) {
				if (!presenter || !whiteboardId || !sessionId || !authorizedUserId)
					return;
				const data = typeof event.data === "string" ? event.data : "";
				if (!data || data.length > 4_100_000) {
					ws.close(1008, "invalid presentation message");
					return;
				}
				let rawMessage: unknown;
				try {
					rawMessage = JSON.parse(data);
				} catch {
					ws.close(1008, "invalid presentation message");
					return;
				}
				const parsed = presentationPublisherMessageSchema.safeParse(rawMessage);
				if (!parsed.success) {
					ws.close(1008, "invalid presentation message");
					return;
				}
				const message = parsed.data;
				const now = new Date();

				if (message.type === "heartbeat") {
					const [renewed] = await db
						.update(whiteboards)
						.set({ presentationActiveUntil: new Date(now.getTime() + 90_000) })
						.where(
							and(
								eq(whiteboards.id, whiteboardId),
								eq(whiteboards.presentationSessionId, sessionId),
								eq(whiteboards.presentationPresenterId, authorizedUserId),
								gt(whiteboards.presentationActiveUntil, now),
							),
						)
						.returning({
							id: whiteboards.id,
							cursorEnabled: whiteboards.presentationSharePresenceEnabled,
						});
					if (!renewed) {
						sendPresentationMessage(ws, { type: "ended" });
						ws.close(1008, "presenter session expired");
					} else {
						cursorEnabled = renewed.cursorEnabled;
					}
					return;
				}

				if (message.type === "cursor") {
					if (!cursorEnabled) return;
					publishPresentationLive({
						type: "cursor",
						whiteboardId,
						sessionId,
						sequence: message.sequence,
						cursor: message.cursor,
					});
					return;
				}

				if (message.type === "camera") {
					publishPresentationLive({
						type: "camera",
						whiteboardId,
						sessionId,
						sequence: message.sequence,
						viewId: message.viewId,
						camera: message.camera,
					});
					return;
				}

				if (publisherEncryptionMode === "server") {
					let frameContent: unknown;
					try {
						frameContent = JSON.parse(message.payload);
					} catch {
						ws.close(1008, "invalid presentation frame");
						return;
					}
					if (!presentationFrameContentSchema.safeParse(frameContent).success) {
						ws.close(1008, "invalid presentation frame");
						return;
					}
				}

				const [stored] = await db
					.update(whiteboards)
					.set({
						presentationFrameSequence: message.sequence,
						presentationFramePayload: message.payload,
						presentationFrameAssetIds: JSON.stringify(message.assetIds),
						presentationFrameUpdatedAt: now,
					})
					.where(
						and(
							eq(whiteboards.id, whiteboardId),
							eq(whiteboards.presentationSessionId, sessionId),
							eq(whiteboards.presentationPresenterId, authorizedUserId),
							gt(whiteboards.presentationActiveUntil, now),
							or(
								isNull(whiteboards.presentationFrameSequence),
								lt(whiteboards.presentationFrameSequence, message.sequence),
							),
						),
					)
					.returning({ id: whiteboards.id });
				if (!stored) return;
				publishPresentationLive({
					type: "frame",
					whiteboardId,
					sessionId,
					sequence: message.sequence,
				});
				sendPresentationMessage(ws, {
					type: "ack",
					sequence: message.sequence,
				});
			},
			onClose() {
				if (!presenter || !whiteboardId) return;
				presentationPresenterRooms.get(whiteboardId)?.delete(presenter);
				cleanupPresentationRoomSubscription(whiteboardId);
				presenter = null;
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

let shutdownStarted = false;

async function shutdown(signal: NodeJS.Signals) {
	if (shutdownStarted) return;
	shutdownStarted = true;
	console.log(`[Skedra API] ${signal} received, shutting down.`);

	for (const client of wss.clients) {
		client.close(1001, "Server shutting down");
	}

	const closeTransports = Promise.all([
		new Promise<void>((resolve) => {
			server.close(() => resolve());
		}),
		new Promise<void>((resolve) => {
			wss.close(() => resolve());
		}),
	]);
	await Promise.race([
		closeTransports,
		new Promise<void>((resolve) => {
			const timeout = setTimeout(() => {
				for (const client of wss.clients) client.terminate();
				if ("closeAllConnections" in server) server.closeAllConnections();
				resolve();
			}, 8_000);
			timeout.unref();
		}),
	]);

	clearScheduledPresentationAudienceCounts();
	await Promise.allSettled([
		closeBoardLiveBus(),
		closeBoardPresence(),
		closePresentationLiveBus(),
		closeRegistrationLocks(),
		closeDatabase(),
	]);
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
	process.once(signal, () => {
		void shutdown(signal)
			.then(() => process.exit(0))
			.catch((error) => {
				console.error("[Skedra API] Shutdown failed.", error);
				process.exit(1);
			});
	});
}
