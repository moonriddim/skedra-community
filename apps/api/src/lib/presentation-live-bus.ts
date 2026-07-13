import { randomUUID } from "node:crypto";
import {
	presentationCursorSchema,
	presentationRelativeCameraSchema,
} from "@skedra/shared";
import postgres from "postgres";
import { z } from "zod";
import { env } from "../env";

const presentationLiveEventSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("frame"),
		whiteboardId: z.string().uuid(),
		sessionId: z.string().uuid(),
		sequence: z.number().int().nonnegative(),
	}),
	z.object({
		type: z.literal("cursor"),
		whiteboardId: z.string().uuid(),
		sessionId: z.string().uuid(),
		sequence: z.number().int().nonnegative(),
		cursor: presentationCursorSchema,
	}),
	z.object({
		type: z.literal("camera"),
		whiteboardId: z.string().uuid(),
		sessionId: z.string().uuid(),
		sequence: z.number().int().nonnegative(),
		viewId: z.string().min(1).max(160),
		camera: presentationRelativeCameraSchema,
	}),
	z.object({
		type: z.literal("audience"),
		whiteboardId: z.string().uuid(),
		sessionId: z.string().uuid(),
		count: z.number().int().nonnegative(),
	}),
	z.object({
		type: z.enum(["ended", "revoke"]),
		whiteboardId: z.string().uuid(),
		sessionId: z.string().uuid().nullable(),
	}),
]);

export type PresentationLiveEvent = z.infer<typeof presentationLiveEventSchema>;
type Subscriber = (event: PresentationLiveEvent) => void;

const NOTIFY_CHANNEL = "skedra_presentation_live";
const PROCESS_ID = randomUUID();
const subscribers = new Map<string, Set<Subscriber>>();

let notifyBridgeStarted = false;
let notifyBridgeClosing = false;
let notifyClient: ReturnType<typeof postgres> | null = null;
type NotifySubscription = { unlisten(): Promise<void> };
let notifyListenRequest: Promise<NotifySubscription> | null = null;
let notifySubscription: NotifySubscription | null = null;
let notifyUnlistenPromise: Promise<void> | null = null;

function unlistenNotify(subscription: NotifySubscription) {
	if (!notifyUnlistenPromise) {
		notifyUnlistenPromise = subscription.unlisten().catch(() => undefined);
	}
	return notifyUnlistenPromise;
}

async function waitForNotifySubscription() {
	if (notifySubscription) return notifySubscription;
	if (!notifyListenRequest) return null;
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			notifyListenRequest.catch(() => null),
			new Promise<null>((resolve) => {
				timeout = setTimeout(() => resolve(null), 1_000);
				timeout.unref();
			}),
		]);
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}

function fanoutLocal(event: PresentationLiveEvent) {
	const boardSubscribers = subscribers.get(event.whiteboardId);
	if (!boardSubscribers) return;
	for (const subscriber of boardSubscribers) {
		try {
			subscriber(event);
		} catch {
			// One disconnected socket must not prevent delivery to the room.
		}
	}
}

function ensureNotifyBridge() {
	if (notifyBridgeStarted || notifyBridgeClosing) return;
	notifyBridgeStarted = true;
	try {
		const client = postgres(env.DATABASE_URL, {
			max: 1,
			connect_timeout: env.DATABASE_CONNECT_TIMEOUT_SECONDS,
			connection: {
				application_name: "skedra-presentation-live-bus",
				statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
				idle_in_transaction_session_timeout:
					env.DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS,
			},
		});
		notifyClient = client;
		const listenRequest = client.listen(NOTIFY_CHANNEL, (payload) => {
			try {
				const raw = JSON.parse(payload) as unknown;
				if (
					raw &&
					typeof raw === "object" &&
					"origin" in raw &&
					raw.origin === PROCESS_ID
				) {
					return;
				}
				const parsed = presentationLiveEventSchema.parse(raw);
				fanoutLocal(parsed);
			} catch {
				// Ignore malformed or stale cross-process messages.
			}
		});
		notifyListenRequest = listenRequest;
		void listenRequest
			.then((subscription) => {
				notifySubscription = subscription;
				if (notifyBridgeClosing) void unlistenNotify(subscription);
			})
			.catch(async (error) => {
				if (notifyBridgeClosing) return;
				if (notifyClient === client) notifyClient = null;
				notifyBridgeStarted = false;
				console.warn(
					"[skedra] Presentation live bus is using in-process delivery only.",
					error,
				);
				await client.end({ timeout: 1 }).catch(() => undefined);
			});
	} catch (error) {
		console.warn(
			"[skedra] Presentation live bus is using in-process delivery only.",
			error,
		);
	}
}

export function subscribePresentationLive(
	whiteboardId: string,
	subscriber: Subscriber,
) {
	ensureNotifyBridge();
	let boardSubscribers = subscribers.get(whiteboardId);
	if (!boardSubscribers) {
		boardSubscribers = new Set();
		subscribers.set(whiteboardId, boardSubscribers);
	}
	boardSubscribers.add(subscriber);
	return () => {
		const current = subscribers.get(whiteboardId);
		if (!current) return;
		current.delete(subscriber);
		if (current.size === 0) subscribers.delete(whiteboardId);
	};
}

export function publishPresentationLive(event: PresentationLiveEvent) {
	ensureNotifyBridge();
	fanoutLocal(event);
	if (!notifyClient) return;
	void notifyClient
		.notify(NOTIFY_CHANNEL, JSON.stringify({ ...event, origin: PROCESS_ID }))
		.catch(() => undefined);
}

export async function closePresentationLiveBus() {
	notifyBridgeClosing = true;
	notifyBridgeStarted = false;
	subscribers.clear();
	const subscription = await waitForNotifySubscription();
	if (subscription) await unlistenNotify(subscription);
	notifyListenRequest = null;
	notifySubscription = null;
	const client = notifyClient;
	notifyClient = null;
	if (client) await client.end({ timeout: 5 });
}
