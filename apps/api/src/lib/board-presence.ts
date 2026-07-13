import { randomUUID } from "node:crypto";
import type { WSContext } from "hono/ws";
import postgres from "postgres";
import { env } from "../env";

export type PresenceMember = {
	ws: WSContext;
	userId: string;
	lastData: string | null;
};

const rooms = new Map<string, Set<PresenceMember>>();
const NOTIFY_CHANNEL = "skedra_board_presence";
const PROCESS_ID = randomUUID();
let notifyClient: ReturnType<typeof postgres> | null = null;
let notifyBridgeStarted = false;
let notifyBridgeClosing = false;
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

function fanoutLocal(
	whiteboardId: string,
	data: string,
	sender?: PresenceMember,
) {
	const room = rooms.get(whiteboardId);
	if (!room) return;
	for (const member of room) {
		if (member === sender) continue;
		try {
			member.ws.send(data);
		} catch {
			// The websocket lifecycle removes disconnected room members.
		}
	}
}

function ensureNotifyBridge() {
	if (process.env.NODE_TEST_CONTEXT) return;
	if (notifyBridgeStarted || notifyBridgeClosing) return;
	notifyBridgeStarted = true;
	const client = postgres(env.DATABASE_URL, {
		max: 1,
		connect_timeout: env.DATABASE_CONNECT_TIMEOUT_SECONDS,
		connection: {
			application_name: "skedra-presence-bus",
			statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
			idle_in_transaction_session_timeout:
				env.DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS,
		},
	});
	notifyClient = client;
	const listenRequest = client.listen(NOTIFY_CHANNEL, (payload) => {
		try {
			const parsed = JSON.parse(payload) as {
				origin?: unknown;
				whiteboardId?: unknown;
				data?: unknown;
			};
			if (parsed.origin === PROCESS_ID) return;
			if (
				typeof parsed.whiteboardId !== "string" ||
				typeof parsed.data !== "string" ||
				parsed.data.length > 6_000
			) {
				return;
			}
			fanoutLocal(parsed.whiteboardId, parsed.data);
		} catch {
			// Ignore malformed cross-process presence messages.
		}
	});
	notifyListenRequest = listenRequest;
	void listenRequest
		.then((subscription) => {
			notifySubscription = subscription;
			if (notifyBridgeClosing) void unlistenNotify(subscription);
		})
		.catch(async () => {
			if (notifyBridgeClosing) return;
			if (notifyClient === client) notifyClient = null;
			notifyBridgeStarted = false;
			await client.end({ timeout: 1 }).catch(() => undefined);
		});
}

export function joinPresenceRoom(
	whiteboardId: string,
	ws: WSContext,
	userId: string,
): PresenceMember {
	ensureNotifyBridge();
	let room = rooms.get(whiteboardId);
	if (!room) {
		room = new Set();
		rooms.set(whiteboardId, room);
	}
	for (const existingMember of room) {
		if (!existingMember.lastData) continue;
		try {
			ws.send(existingMember.lastData);
		} catch {
			// The new connection is cleaned up by its websocket lifecycle.
		}
	}
	const member: PresenceMember = { ws, userId, lastData: null };
	room.add(member);
	return member;
}

export function leavePresenceRoom(
	whiteboardId: string,
	member: PresenceMember,
) {
	const room = rooms.get(whiteboardId);
	if (!room) return;
	room.delete(member);
	if (room.size === 0) rooms.delete(whiteboardId);
}

export function broadcastPresence(
	whiteboardId: string,
	sender: PresenceMember,
	data: string,
) {
	sender.lastData = data;
	fanoutLocal(whiteboardId, data, sender);
	ensureNotifyBridge();
	if (!notifyClient) return;
	void notifyClient
		.notify(
			NOTIFY_CHANNEL,
			JSON.stringify({ origin: PROCESS_ID, whiteboardId, data }),
		)
		.catch(() => undefined);
}

export async function closeBoardPresence() {
	notifyBridgeClosing = true;
	notifyBridgeStarted = false;
	rooms.clear();
	const subscription = await waitForNotifySubscription();
	if (subscription) await unlistenNotify(subscription);
	notifyListenRequest = null;
	notifySubscription = null;
	const client = notifyClient;
	notifyClient = null;
	if (client) await client.end({ timeout: 5 });
}
