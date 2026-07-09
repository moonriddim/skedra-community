import { clearPersistedCanvasHistory } from "@/lib/canvas/canvas-history-storage";

/** localStorage-Key fuer den lokalen Gast-Canvas (Excalidraw-aehnlicher Modus). */
const LOCAL_CANVAS_STORAGE_KEY = "skedra-guest-canvas-v1";

export function loadLocalCanvasStateBase64() {
	try {
		return localStorage.getItem(LOCAL_CANVAS_STORAGE_KEY);
	} catch {
		return null;
	}
}

export function saveLocalCanvasStateBase64(stateBase64: string) {
	try {
		localStorage.setItem(LOCAL_CANVAS_STORAGE_KEY, stateBase64);
	} catch {
		// Quota ueberschritten oder Storage blockiert — Zeichnen bleibt trotzdem moeglich.
	}
}

export function clearLocalCanvasState() {
	try {
		localStorage.removeItem(LOCAL_CANVAS_STORAGE_KEY);
		clearPersistedCanvasHistory("local");
	} catch {
		// ignore
	}
}
