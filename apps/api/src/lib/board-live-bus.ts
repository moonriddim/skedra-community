/**
 * Live-Bus für Realtime-E2EE-Sync.
 *
 * Der Bus benachrichtigt verbundene Clients SOFORT, wenn ein neues verschlüsseltes
 * Update im durable Log (`whiteboardE2eeUpdates`) landet — statt dass sie bis zu
 * 1,5 s auf den nächsten Poll warten. Er transportiert dabei NUR Metadaten
 * (Board-ID, Update-ID, Zeitstempel), niemals Klartext. Der eigentliche Ciphertext
 * wird weiterhin über `listE2eeUpdates` geladen und nur im Client entschlüsselt.
 *
 * Zwei Ebenen:
 *  1) In-Process-Fanout (immer aktiv, deckt Single-Node/Selfhost ab).
 *  2) Optionaler Postgres LISTEN/NOTIFY-Bridge für Mehr-Node-Betrieb (Managed),
 *     ohne zusätzlichen Dienst. Fällt bei Fehlern still auf reines In-Process zurück.
 */

import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { env } from "../env";

/** Ereignis, das an Live-Abonnenten eines Boards geschickt wird. */
export type BoardLiveEvent = {
	type: "update" | "compact";
	whiteboardId: string;
	/** ID der neuen Zeile in whiteboardE2eeUpdates. */
	id: string;
	/** ISO-Zeitstempel der neuen Zeile. */
	createdAt: string;
};

type Subscriber = (event: BoardLiveEvent) => void;

/** Postgres-NOTIFY-Kanal. Payload bleibt klein (nur Metadaten). */
const NOTIFY_CHANNEL = "skedra_board_live";

/** Eindeutige ID dieses Prozesses, um eigene NOTIFYs beim Zurückkommen zu ignorieren. */
const PROCESS_ID = randomUUID();

/** whiteboardId -> Menge lokaler Abonnenten (SSE-/WS-Verbindungen dieses Prozesses). */
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

/** Liefert das Ereignis an alle lokalen Abonnenten dieses Prozesses aus. */
function fanoutLocal(event: BoardLiveEvent) {
	const set = subscribers.get(event.whiteboardId);
	if (!set) return;
	for (const cb of set) {
		try {
			cb(event);
		} catch {
			// Ein defekter Abonnent darf die anderen nicht mitreißen.
		}
	}
}

/**
 * Startet die Postgres-Bridge einmalig (lazy beim ersten Abonnenten). Empfängt
 * NOTIFYs anderer Nodes und verteilt sie lokal. Fehler werden geloggt, der Bus
 * arbeitet dann rein In-Process weiter.
 */
function ensureNotifyBridge() {
	if (notifyBridgeStarted || notifyBridgeClosing) return;
	notifyBridgeStarted = true;

	try {
		// Eigene Verbindung — LISTEN belegt eine Verbindung dauerhaft.
		const client = postgres(env.DATABASE_URL, {
			max: 1,
			connect_timeout: env.DATABASE_CONNECT_TIMEOUT_SECONDS,
			connection: {
				application_name: "skedra-live-bus",
				statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
				idle_in_transaction_session_timeout:
					env.DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS,
			},
		});
		notifyClient = client;
		const listenRequest = client.listen(NOTIFY_CHANNEL, (payload) => {
			try {
				const parsed = JSON.parse(payload) as BoardLiveEvent & {
					origin?: string;
				};
				// Eigene NOTIFYs haben wir bereits lokal gefanoutet → ignorieren.
				if (parsed.origin === PROCESS_ID) return;
				fanoutLocal({
					type: parsed.type,
					whiteboardId: parsed.whiteboardId,
					id: parsed.id,
					createdAt: parsed.createdAt,
				});
			} catch {
				// Ungültige Payload ignorieren.
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
					"[skedra] Live-Bus: Postgres LISTEN/NOTIFY nicht verfuegbar, nutze nur In-Process.",
					error,
				);
				await client.end({ timeout: 1 }).catch(() => undefined);
			});
	} catch (error) {
		console.warn(
			"[skedra] Live-Bus: Postgres LISTEN/NOTIFY nicht verfügbar, nutze nur In-Process.",
			error,
		);
	}
}

/** Sendet das Ereignis an andere Nodes (best-effort). */
async function publishViaNotify(event: BoardLiveEvent) {
	if (!notifyClient) return;
	try {
		await notifyClient.notify(
			NOTIFY_CHANNEL,
			JSON.stringify({ ...event, origin: PROCESS_ID }),
		);
	} catch {
		// Cross-Node-Zustellung ist best-effort; lokal wurde bereits ausgeliefert.
	}
}

/**
 * Abonniert Live-Ereignisse eines Boards. Gibt eine Unsubscribe-Funktion zurück,
 * die beim Verbindungsende aufgerufen werden MUSS.
 */
export function subscribeBoardLive(
	whiteboardId: string,
	cb: Subscriber,
): () => void {
	ensureNotifyBridge();

	let set = subscribers.get(whiteboardId);
	if (!set) {
		set = new Set();
		subscribers.set(whiteboardId, set);
	}
	set.add(cb);

	return () => {
		const current = subscribers.get(whiteboardId);
		if (!current) return;
		current.delete(cb);
		if (current.size === 0) subscribers.delete(whiteboardId);
	};
}

/**
 * Veröffentlicht ein Update-Ereignis: sofort lokal + best-effort an andere Nodes.
 * Wird vom Whiteboard-Router (nach dem DB-Commit) und von der REST-Update-Route
 * (MCP/Agent) aufgerufen.
 */
export function publishBoardLive(event: BoardLiveEvent) {
	ensureNotifyBridge();
	fanoutLocal(event);
	void publishViaNotify(event);
}

/** Stops LISTEN/NOTIFY and releases its dedicated connection during shutdown. */
export async function closeBoardLiveBus() {
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
