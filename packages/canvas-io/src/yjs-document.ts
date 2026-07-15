import {
	type CanvasElement,
	type SavedCanvasView,
	normalizeCanvasElementStackIndexes,
} from "@skedra/canvas-core";
import * as Y from "yjs";
import { decodeCanvasElement, decodeSavedCanvasView } from "./codecs";

export const CANVAS_ELEMENTS_MAP_KEY = "elementsMap";
export const CANVAS_VIEWS_MAP_KEY = "viewsMap";
export const CANVAS_APP_STATE_MAP_KEY = "appStateMap";

export function objectToYMap<T extends object>(obj: T): Y.Map<unknown> {
	const yMap = new Y.Map<unknown>();
	for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
		if (value === undefined) continue;
		yMap.set(key, cloneYValue(value));
	}
	return yMap;
}

export function yMapToObject<T>(yMap: Y.Map<unknown>): T {
	const obj: Record<string, unknown> = {};
	yMap.forEach((value, key) => {
		obj[key] =
			value instanceof Y.Map
				? yMapToObject<Record<string, unknown>>(value)
				: value;
	});
	return obj as T;
}

function cloneYValue(value: unknown) {
	if (value == null || typeof value !== "object") return value;
	return JSON.parse(JSON.stringify(value));
}

export function applyPartialUpdatesToYMap(
	yMap: Y.Map<unknown>,
	updates: Record<string, unknown>,
) {
	for (const [key, value] of Object.entries(updates)) {
		if (value === undefined) {
			yMap.delete(key);
			continue;
		}
		yMap.set(key, cloneYValue(value));
	}
}

export function applyPartialUpdatesToObject<T extends Record<string, unknown>>(
	value: T,
	updates: Record<string, unknown>,
): T {
	const next = cloneYValue(value) as Record<string, unknown>;
	for (const [key, update] of Object.entries(updates)) {
		if (update === undefined) {
			delete next[key];
			continue;
		}
		next[key] = cloneYValue(update);
	}
	return next as T;
}

export function normalizeCanvasElementsForRead(
	elements: Iterable<CanvasElement>,
): CanvasElement[] {
	return normalizeCanvasElementStackIndexes(elements);
}

export function readCanvasMapsFromYDoc(ydoc: Y.Doc) {
	const yElements = ydoc.getMap<Y.Map<unknown>>(CANVAS_ELEMENTS_MAP_KEY);
	const yViews = ydoc.getMap<Y.Map<unknown>>(CANVAS_VIEWS_MAP_KEY);
	const yAppState = ydoc.getMap<unknown>(CANVAS_APP_STATE_MAP_KEY);

	const elements = new Map<string, CanvasElement>();
	const rawElements: CanvasElement[] = [];
	yElements.forEach((yEl, id) => {
		const element = decodeCanvasElement({
			...yMapToObject<Record<string, unknown>>(yEl),
			id,
		});
		if (element) rawElements.push(element);
	});
	for (const element of normalizeCanvasElementsForRead(rawElements)) {
		elements.set(element.id, element);
	}

	const views = new Map<string, SavedCanvasView>();
	yViews.forEach((yView, id) => {
		const view = decodeSavedCanvasView({
			...yMapToObject<Record<string, unknown>>(yView),
			id,
		});
		if (view) views.set(id, view);
	});

	const storedCanvasBg = yAppState.get("canvasBg");
	const canvasBg = typeof storedCanvasBg === "string" ? storedCanvasBg : "";
	return { elements, views, canvasBg };
}

export function setCanvasBackgroundInYDoc(ydoc: Y.Doc, canvasBg: string) {
	const yAppState = ydoc.getMap<unknown>(CANVAS_APP_STATE_MAP_KEY);
	if (canvasBg) {
		yAppState.set("canvasBg", canvasBg);
	} else {
		yAppState.delete("canvasBg");
	}
}

export function encodeYDocStateBase64(ydoc: Y.Doc) {
	const update = Y.encodeStateAsUpdate(ydoc);
	const binary = Array.from(update, (byte) => String.fromCharCode(byte)).join(
		"",
	);
	return btoa(binary);
}

export function applyYDocStateBase64(ydoc: Y.Doc, stateBase64: string) {
	const binary = atob(stateBase64);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	Y.applyUpdate(ydoc, bytes);
}
