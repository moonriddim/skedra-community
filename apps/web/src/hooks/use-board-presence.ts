/**
 * WebSocket-Presence (Client) für Realtime-E2EE — Live-Cursor/Auswahl.
 *
 * Verbindet sich mit `/api/boards/:id/presence` und tauscht Presence-Nachrichten
 * (Cursor, Auswahl, Viewport, Name/Farbe) mit den anderen Teilnehmern aus. Die
 * Nachrichten werden mit demselben Board-Schlüssel VERSCHLÜSSELT (gleicher Envelope
 * wie die Yjs-Updates) — der Server relayt nur Ciphertext und persistiert nichts.
 *
 * Ersetzt den bisherigen No-op im E2EE-Sync-Hook.
 */

import { getApiWebSocketUrl } from "@/lib/api-url";
import { decryptYjsUpdate, encryptYjsUpdate } from "@/lib/e2ee";
import type { Viewport } from "@skedra/canvas-core";
import type { CanvasRole } from "@skedra/shared";
import { remoteCanvasPresenceSchema } from "@skedra/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RemoteCanvasPresence } from "./canvas-sync-types";

/** Wie lange eine Presence ohne Update sichtbar bleibt, bevor sie verschwindet. */
const PRESENCE_TTL_MS = 12_000;
/** Mindestabstand zwischen gesendeten Presence-Updates (gegen Flooding). */
const SEND_THROTTLE_MS = 60;
const PRESENCE_HEARTBEAT_MS = 4_000;
const PRUNE_INTERVAL_MS = 4_000;
const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;

export interface PresenceIdentity {
	id: string;
	name: string;
	image: string | null;
	color: string;
	role: CanvasRole;
	canWrite: boolean;
}

interface UseBoardPresenceOptions {
	enabled: boolean;
	encryptionMode: "server" | "e2ee";
	e2eeKey: string | null | undefined;
	identity: PresenceIdentity;
	presentationShareToken?: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function randomClientId() {
	return Math.floor(Math.random() * 0x7fff_ffff);
}

export function useBoardPresence(
	whiteboardId: string,
	options: UseBoardPresenceOptions,
) {
	const { enabled, encryptionMode, e2eeKey, identity, presentationShareToken } =
		options;

	const clientIdRef = useRef(randomClientId());
	const wsRef = useRef<WebSocket | null>(null);
	const identityRef = useRef(identity);
	identityRef.current = identity;

	const stateRef = useRef<{
		selection: string[];
		cursor: { x: number; y: number } | null;
		viewport: Viewport | null;
		activeViewId: string | null;
	}>({ selection: [], cursor: null, viewport: null, activeViewId: null });

	const [remoteMap, setRemoteMap] = useState<Map<number, RemoteCanvasPresence>>(
		() => new Map(),
	);
	const [isConnected, setIsConnected] = useState(false);

	const sendTimerRef = useRef<number | null>(null);
	const lastSentRef = useRef(0);
	const flushSendRef = useRef<() => Promise<void>>(async () => {});

	// Verbindung auf- und bei Abbruch wieder aufbauen.
	useEffect(() => {
		if (!enabled || !whiteboardId || (encryptionMode === "e2ee" && !e2eeKey))
			return;

		let closed = false;
		let reconnectTimer: number | null = null;
		let reconnectAttempt = 0;

		const scheduleReconnect = () => {
			if (closed || reconnectTimer !== null) return;
			const delay = Math.min(
				RECONNECT_MAX_DELAY_MS,
				RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt,
			);
			reconnectAttempt += 1;
			reconnectTimer = window.setTimeout(() => {
				reconnectTimer = null;
				connect();
			}, delay);
		};

		const connect = () => {
			if (closed) return;
			const presenceUrl = new URL(
				getApiWebSocketUrl(`/api/boards/${whiteboardId}/presence`),
			);
			if (presentationShareToken) {
				presenceUrl.searchParams.set(
					"presentationShareToken",
					presentationShareToken,
				);
			}
			const ws = new WebSocket(presenceUrl);
			wsRef.current = ws;
			ws.onopen = () => {
				reconnectAttempt = 0;
				setIsConnected(true);
				void flushSendRef.current();
			};

			ws.onmessage = async (event) => {
				try {
					const data = typeof event.data === "string" ? event.data : "";
					if (!data) return;
					const json =
						encryptionMode === "e2ee"
							? decoder.decode(await decryptYjsUpdate(data, e2eeKey as string))
							: data;
					const parsed = remoteCanvasPresenceSchema.parse(
						JSON.parse(json),
					) as RemoteCanvasPresence;
					// Eigene Nachrichten ignorieren (sollte der Server schon filtern).
					if (parsed.clientId === clientIdRef.current) return;
					setRemoteMap((prev) => {
						const next = new Map(prev);
						next.set(parsed.clientId, { ...parsed, updatedAt: Date.now() });
						return next;
					});
				} catch {
					// Nicht entschlüsselbare/ungültige Nachricht ignorieren.
				}
			};

			ws.onclose = (event) => {
				if (wsRef.current === ws) wsRef.current = null;
				setIsConnected(false);
				// Policy violations are permanent (missing session/board access), so
				// retrying would only flood the console and server.
				if (!closed && event.code !== 1008) scheduleReconnect();
			};
			ws.onerror = () => ws.close();
		};

		connect();

		return () => {
			closed = true;
			if (reconnectTimer) window.clearTimeout(reconnectTimer);
			if (sendTimerRef.current != null) {
				window.clearTimeout(sendTimerRef.current);
				sendTimerRef.current = null;
			}
			wsRef.current?.close();
			wsRef.current = null;
			setIsConnected(false);
			setRemoteMap(new Map());
		};
	}, [enabled, encryptionMode, whiteboardId, e2eeKey, presentationShareToken]);

	// Abgelaufene (stille) Presences ausblenden.
	useEffect(() => {
		const interval = window.setInterval(() => {
			setRemoteMap((prev) => {
				const now = Date.now();
				let changed = false;
				const next = new Map(prev);
				for (const [id, presence] of next) {
					if (now - presence.updatedAt > PRESENCE_TTL_MS) {
						next.delete(id);
						changed = true;
					}
				}
				return changed ? next : prev;
			});
		}, PRUNE_INTERVAL_MS);
		return () => window.clearInterval(interval);
	}, []);

	const flushSend = useCallback(async () => {
		const ws = wsRef.current;
		const key = e2eeKey;
		if (
			!ws ||
			ws.readyState !== WebSocket.OPEN ||
			(encryptionMode === "e2ee" && !key)
		)
			return;

		const id = identityRef.current;
		const payload: RemoteCanvasPresence = {
			clientId: clientIdRef.current,
			user: {
				id: id.id,
				name: id.name,
				image: id.image,
				color: id.color,
				role: id.role,
			},
			selection: stateRef.current.selection.slice(0, 200),
			cursor: stateRef.current.cursor,
			viewport: stateRef.current.viewport,
			activeViewId: stateRef.current.activeViewId,
			canWrite: id.canWrite,
			updatedAt: Date.now(),
		};

		try {
			const json = JSON.stringify(payload);
			ws.send(
				encryptionMode === "e2ee"
					? await encryptYjsUpdate(encoder.encode(json), key as string)
					: json,
			);
		} catch {
			// Senden ist best-effort.
		}
	}, [e2eeKey, encryptionMode]);
	flushSendRef.current = flushSend;

	useEffect(() => {
		if (!enabled) return;
		const interval = window.setInterval(() => {
			void flushSend();
		}, PRESENCE_HEARTBEAT_MS);
		return () => window.clearInterval(interval);
	}, [enabled, flushSend]);

	// Gedrosseltes Senden: sofort, sonst gesammelt nach kurzer Wartezeit.
	const scheduleSend = useCallback(() => {
		const now = Date.now();
		const since = now - lastSentRef.current;
		if (since >= SEND_THROTTLE_MS) {
			lastSentRef.current = now;
			void flushSend();
			return;
		}
		if (sendTimerRef.current == null) {
			sendTimerRef.current = window.setTimeout(() => {
				sendTimerRef.current = null;
				lastSentRef.current = Date.now();
				void flushSend();
			}, SEND_THROTTLE_MS - since);
		}
	}, [flushSend]);

	const setPresenceCursor = useCallback(
		(cursor: { x: number; y: number } | null) => {
			stateRef.current.cursor = cursor;
			scheduleSend();
		},
		[scheduleSend],
	);
	const setPresenceSelection = useCallback(
		(selection: string[]) => {
			stateRef.current.selection = selection;
			scheduleSend();
		},
		[scheduleSend],
	);
	const setPresenceViewport = useCallback(
		(viewport: Viewport) => {
			stateRef.current.viewport = viewport;
			scheduleSend();
		},
		[scheduleSend],
	);
	const setPresenceActiveView = useCallback(
		(activeViewId: string | null) => {
			stateRef.current.activeViewId = activeViewId;
			scheduleSend();
		},
		[scheduleSend],
	);

	const remotePresence = useMemo(
		() => Array.from(remoteMap.values()),
		[remoteMap],
	);

	return {
		isConnected,
		remotePresence,
		setPresenceCursor,
		setPresenceSelection,
		setPresenceViewport,
		setPresenceActiveView,
	};
}
