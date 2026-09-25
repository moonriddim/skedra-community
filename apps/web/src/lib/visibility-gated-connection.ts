/**
 * Hält eine langlebige Verbindung (z. B. SSE) nur offen, solange der Tab sichtbar ist.
 *
 * Hintergrund: Über HTTP/1.1 erlauben Browser nur etwa 6 gleichzeitige
 * Verbindungen pro Origin – über ALLE Tabs hinweg. Jede offene EventSource
 * belegt dauerhaft einen dieser Slots. Mit mehreren Board-Tabs hinter einem
 * Proxy ohne HTTP/2 warten Sync-Requests dann in der Browser-Queue, bis ihr
 * Timeout abläuft („signal timed out“). Versteckte Tabs geben ihren Slot daher
 * nach einer kurzen Karenzzeit frei und verbinden sich beim Zurückwechseln neu.
 */

/** Minimaler Ausschnitt aus `Document`, damit sich die Logik ohne DOM testen lässt. */
export interface VisibilitySource {
	readonly visibilityState: DocumentVisibilityState;
	addEventListener(type: "visibilitychange", listener: () => void): void;
	removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export interface VisibilityGatedConnectionOptions {
	/** Öffnet die Verbindung und liefert eine Funktion zum Schließen zurück. */
	connect: () => () => void;
	/** Standard: das globale `document`. */
	visibility?: VisibilitySource;
	/**
	 * Wartezeit, bevor ein versteckter Tab die Verbindung schließt. Kurze
	 * Tab-Wechsel sollen nicht jedes Mal einen Reconnect auslösen.
	 */
	hiddenGraceMs?: number;
}

export const LIVE_CONNECTION_HIDDEN_GRACE_MS = 10_000;

/**
 * Startet die Verbindung sofort, wenn der Tab sichtbar ist, und verwaltet
 * danach Öffnen/Schließen anhand von `visibilitychange`.
 * Rückgabe: Aufräumfunktion, die Listener, Timer und Verbindung beendet.
 */
export function createVisibilityGatedConnection({
	connect,
	visibility = document,
	hiddenGraceMs = LIVE_CONNECTION_HIDDEN_GRACE_MS,
}: VisibilityGatedConnectionOptions): () => void {
	// Schließt die aktuell offene Verbindung; null = derzeit keine Verbindung.
	let disconnect: (() => void) | null = null;
	// Ausstehender Timer, der einen versteckten Tab nach der Karenzzeit trennt.
	let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

	const clearHiddenTimer = () => {
		if (hiddenTimer == null) return;
		clearTimeout(hiddenTimer);
		hiddenTimer = null;
	};
	const open = () => {
		clearHiddenTimer();
		if (!disconnect) disconnect = connect();
	};
	const close = () => {
		clearHiddenTimer();
		const current = disconnect;
		disconnect = null;
		current?.();
	};

	const handleVisibilityChange = () => {
		if (visibility.visibilityState === "visible") {
			open();
			return;
		}
		// Bereits geplant oder schon getrennt: nichts zu tun.
		if (hiddenTimer != null || !disconnect) return;
		hiddenTimer = setTimeout(() => {
			hiddenTimer = null;
			close();
		}, hiddenGraceMs);
	};

	// Ein im Hintergrund geöffneter Tab belegt erst beim Anzeigen einen Slot.
	if (visibility.visibilityState === "visible") open();
	visibility.addEventListener("visibilitychange", handleVisibilityChange);

	return () => {
		visibility.removeEventListener("visibilitychange", handleVisibilityChange);
		close();
	};
}
