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
let notifyClient: ReturnType<typeof postgres> | null = null;

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
	if (notifyBridgeStarted) return;
	notifyBridgeStarted = true;

	try {
		// Eigene Verbindung — LISTEN belegt eine Verbindung dauerhaft.
		notifyClient = postgres(env.DATABASE_URL, { max: 1 });
		void notifyClient.listen(NOTIFY_CHANNEL, (payload) => {
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
