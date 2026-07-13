/**
 * SSE-Live-Kanal (Client) für Realtime-E2EE-Sync.
 *
 * Öffnet eine EventSource auf `/api/boards/:id/live`. Sobald der Server ein neues
 * verschlüsseltes Update signalisiert, ruft der Hook `onEvent()` auf — der
 * E2EE-Sync lädt dann sofort das Update-Log nach, statt aufs Polling zu warten.
 * Übertragen werden nur Metadaten; entschlüsselt wird ausschließlich lokal.
 *
 * EventSource reconnectet bei Verbindungsabbruch automatisch. Cookies (Session)
 * werden per `withCredentials` mitgeschickt — passend zur same-origin-API.
 */

import { getApiUrl } from "@/lib/api-url";
import { useEffect, useRef } from "react";

const LIVE_EVENT_DEBOUNCE_MS = 100;

interface UseBoardLiveChannelOptions {
	enabled: boolean;
	/** Wird bei jedem Live-Update-Signal aufgerufen (→ Update-Log nachladen). */
	onEvent: () => void;
	/** Meldet Verbindungsstatus (z. B. um das Poll-Intervall zu drosseln). */
	onConnectedChange?: (connected: boolean) => void;
}

export function useBoardLiveChannel(
	whiteboardId: string,
	options: UseBoardLiveChannelOptions,
) {
	const { enabled, onEvent, onConnectedChange } = options;

	// Callbacks in Refs halten, damit der Effect nicht bei jedem Render neu verbindet.
	const onEventRef = useRef(onEvent);
	onEventRef.current = onEvent;
	const onConnectedRef = useRef(onConnectedChange);
	onConnectedRef.current = onConnectedChange;

	useEffect(() => {
		if (!enabled || !whiteboardId) return;
		let eventTimer: number | null = null;

		const source = new EventSource(
			getApiUrl(`/api/boards/${whiteboardId}/live`),
			{
				withCredentials: true,
			},
		);

		const handleReady = () => onConnectedRef.current?.(true);
		const handleUpdate = () => {
			if (eventTimer != null) return;
			eventTimer = window.setTimeout(() => {
				eventTimer = null;
				onEventRef.current();
			}, LIVE_EVENT_DEBOUNCE_MS);
		};
		const handleError = () => onConnectedRef.current?.(false);

		source.addEventListener("ready", handleReady);
		source.addEventListener("update", handleUpdate);
		// "ping"-Heartbeats halten die Verbindung offen — keine Aktion nötig.
		source.onerror = handleError;

		return () => {
			if (eventTimer != null) window.clearTimeout(eventTimer);
			onConnectedRef.current?.(false);
			source.removeEventListener("ready", handleReady);
			source.removeEventListener("update", handleUpdate);
			source.close();
		};
	}, [enabled, whiteboardId]);
}
