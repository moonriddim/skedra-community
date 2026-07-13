/**
 * Presence-Relay für Realtime-E2EE (Phase 2, WebSocket).
 *
 * Hält pro Board einen flüchtigen „Raum" von WebSocket-Verbindungen und leitet
 * Presence-Nachrichten (Cursor-Position, Auswahl, Name/Farbe) an die anderen
 * Teilnehmer weiter. Die Nachrichten sind **clientseitig mit dem Board-Schlüssel
 * verschlüsselt** — der Server relayt nur Ciphertext, entschlüsselt nie und
 * persistiert nichts (Presence ist flüchtig).
 */

import type { WSContext } from "hono/ws";

export type PresenceMember = {
	ws: WSContext;
	userId: string;
	lastData: string | null;
};

/** whiteboardId -> aktive Presence-Verbindungen dieses Prozesses. */
const rooms = new Map<string, Set<PresenceMember>>();

export function joinPresenceRoom(
	whiteboardId: string,
	ws: WSContext,
	userId: string,
): PresenceMember {
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
			// The new connection will be cleaned up by its websocket lifecycle.
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

/**
 * Leitet eine (verschlüsselte) Presence-Nachricht an alle ANDEREN Teilnehmer im
 * Raum weiter. Der Absender bekommt seine eigene Nachricht nicht zurück.
 */
export function broadcastPresence(
	whiteboardId: string,
	sender: PresenceMember,
	data: string,
) {
	const room = rooms.get(whiteboardId);
	if (!room) return;
	sender.lastData = data;
	for (const member of room) {
		if (member === sender) continue;
		try {
			member.ws.send(data);
		} catch {
			// Defekte Verbindung ignorieren; onClose räumt sie ohnehin auf.
		}
	}
}
