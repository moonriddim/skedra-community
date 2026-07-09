/**
 * Viewport (Pan/Zoom) im Browser persistieren — bleibt nach Reload erhalten.
 */

import type { Viewport } from "@skedra/canvas-core";

const GUEST_VIEWPORT_KEY = "skedra-guest-viewport-v1";

function boardViewportKey(boardId: string) {
	return `skedra-viewport-${boardId}`;
}

function parseViewport(raw: string | null): Viewport | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<Viewport>;
		if (
			typeof parsed.x === "number" &&
			typeof parsed.y === "number" &&
			typeof parsed.zoom === "number"
		) {
			return { x: parsed.x, y: parsed.y, zoom: parsed.zoom };
		}
	} catch {
		// Beschaedigter Eintrag ignorieren
	}
	return null;
}

export function loadGuestCanvasViewport(): Viewport | null {
	try {
		return parseViewport(localStorage.getItem(GUEST_VIEWPORT_KEY));
	} catch {
		return null;
	}
}

export function saveGuestCanvasViewport(viewport: Viewport) {
	try {
		localStorage.setItem(GUEST_VIEWPORT_KEY, JSON.stringify(viewport));
	} catch {
		// ignore
	}
}

export function clearGuestCanvasViewport() {
	try {
		localStorage.removeItem(GUEST_VIEWPORT_KEY);
	} catch {
		// ignore
	}
}

export function loadBoardCanvasViewport(boardId: string): Viewport | null {
	try {
		return parseViewport(localStorage.getItem(boardViewportKey(boardId)));
	} catch {
		return null;
	}
}

export function saveBoardCanvasViewport(boardId: string, viewport: Viewport) {
	try {
		localStorage.setItem(boardViewportKey(boardId), JSON.stringify(viewport));
	} catch {
		// ignore
	}
}

function clearBoardCanvasViewport(boardId: string) {
	try {
		localStorage.removeItem(boardViewportKey(boardId));
	} catch {
		// ignore
	}
}
