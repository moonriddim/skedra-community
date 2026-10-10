import { randomUUID } from "node:crypto";
import type { WSContext } from "hono/ws";
import postgres from "postgres";
import { env } from "../env";

export type PresenceMember = {
	ws: WSContext;
	userId: string;
	lastData: string | null;
	authorize: () => Promise<boolean>;
	active: boolean;
	broadcasting: boolean;
	checking: Promise<boolean> | null;
	timer: ReturnType<typeof setInterval> | null;
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

async function canUsePresence(whiteboardId: string, member: PresenceMember) {
	if (!member.active) return false;
	if (!member.checking) {
		member.checking = Promise.resolve()
			.then(member.authorize)
			.catch(() => false);
	}
	const checking = member.checking;
	const allowed = await checking;
	if (member.checking === checking) member.checking = null;
	if (!allowed && member.active) {
		leavePresenceRoom(whiteboardId, member);
		try {
			member.ws.close(1008, "presence access revoked");
		} catch {
			/* Already closed. */
		}
	}
	return allowed && member.active;
}

async function fanoutLocal(
	whiteboardId: string,
	data: string,
	sender?: PresenceMember,
	senderUserId = sender?.userId,
) {
	const room = rooms.get(whiteboardId);
	if (!room) return;
	await Promise.all(
		[...room].map(async (member) => {
			// Presence represents people, not browser connections. A reconnect or a
			// second tab belonging to the same account must not appear as another user.
			if (member === sender || member.userId === senderUserId) return;
			// Check recipients even when they never send anything. This also covers
			// messages arriving through another API instance's NOTIFY bridge.
			if (!(await canUsePresence(whiteboardId, member))) return;
			try {
				member.ws.send(data);
			} catch {
				// The websocket lifecycle removes disconnected room members.
			}
		}),
	);
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
				userId?: unknown;
			};
			if (parsed.origin === PROCESS_ID) return;
			if (
				typeof parsed.whiteboardId !== "string" ||
				typeof parsed.data !== "string" ||
				parsed.data.length > 6_000
			) {
				return;
			}
			void fanoutLocal(
				parsed.whiteboardId,
				parsed.data,
				undefined,
				typeof parsed.userId === "string" ? parsed.userId : undefined,
			);
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

export async function joinPresenceRoom(
	whiteboardId: string,
	ws: WSContext,
	userId: string,
	authorize: () => Promise<boolean>,
): Promise<PresenceMember> {
	ensureNotifyBridge();
	const member: PresenceMember = {
		ws,
		userId,
		lastData: null,
		authorize,
		active: true,
		broadcasting: false,
		checking: null,
		timer: null,
	};
	if (!(await canUsePresence(whiteboardId, member))) return member;
	let room = rooms.get(whiteboardId);
	if (!room) {
		room = new Set();
		rooms.set(whiteboardId, room);
	}
	const existingMembers = [...room];
	room.add(member);
	// Close idle revoked sockets too. Delivery never waits for this timer.
	member.timer = setInterval(() => {
		void canUsePresence(whiteboardId, member);
	}, 30_000);
	member.timer.unref();
	for (const existingMember of existingMembers) {
		// A previous connection from the same account may still be closing while
		// the user returns to the board. Do not replay that stale state as a peer.
		if (existingMember.userId === userId) continue;
		if (!existingMember.lastData) continue;
		if (!(await canUsePresence(whiteboardId, existingMember))) continue;
		if (!(await canUsePresence(whiteboardId, member))) break;
		try {
			ws.send(existingMember.lastData);
		} catch {
			// The new connection is cleaned up by its websocket lifecycle.
		}
	}
	return member;
}

export function leavePresenceRoom(
	whiteboardId: string,
	member: PresenceMember,
) {
	member.active = false;
	member.lastData = null;
	if (member.timer) clearInterval(member.timer);
	member.timer = null;
	const room = rooms.get(whiteboardId);
	if (!room) return;
	room.delete(member);
	if (room.size === 0) rooms.delete(whiteboardId);
}

export async function broadcastPresence(
	whiteboardId: string,
	sender: PresenceMember,
	data: string,
) {
	// Presence is ephemeral: drop overlapping updates instead of queuing
	// unbounded permission queries when a client floods the connection.
	if (!sender.active || sender.broadcasting) return;
	sender.broadcasting = true;
	try {
		if (!(await canUsePresence(whiteboardId, sender))) return;
		sender.lastData = data;
		await fanoutLocal(whiteboardId, data, sender);
		if (!sender.active) return;
		ensureNotifyBridge();
		if (!notifyClient) return;
		void notifyClient
			.notify(
				NOTIFY_CHANNEL,
				JSON.stringify({
					origin: PROCESS_ID,
					whiteboardId,
					data,
					userId: sender.userId,
				}),
			)
			.catch(() => undefined);
	} finally {
		sender.broadcasting = false;
	}
}

export async function closeBoardPresence() {
	notifyBridgeClosing = true;
	notifyBridgeStarted = false;
	for (const [boardId, room] of rooms) {
		for (const member of room) leavePresenceRoom(boardId, member);
	}
	rooms.clear();
	const subscription = await waitForNotifySubscription();
	if (subscription) await unlistenNotify(subscription);
	notifyListenRequest = null;
	notifySubscription = null;
	const client = notifyClient;
	notifyClient = null;
	if (client) await client.end({ timeout: 5 });
}
