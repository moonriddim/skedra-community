/**
 * Gemeinsame Y.js-Schreiboperationen fuer Online- und Gast-Canvas-Sync.
 */

import {
	applyCanvasElementUpdates,
	applySavedCanvasViewUpdates,
	decodeCanvasElement,
	decodeSavedCanvasView,
} from "@/lib/canvas/canvas-codecs";
import {
	createYjsHistoryEntry,
	transactLocalUndo,
} from "@/lib/canvas/canvas-undo";
import {
	applyPartialUpdatesToYMap,
	objectToYMap,
	readCanvasMapsFromYDoc,
	yMapToObject,
} from "@/lib/canvas/yjs-document-helpers";
import {
	type CanvasElement,
	type CanvasHistoryDelta,
	type SavedCanvasView,
	createCanvasHistoryPatchDelta,
	createStackIndexAfter,
} from "@skedra/canvas-core";
import type * as Y from "yjs";

export function yjsCreateElement(ydoc: Y.Doc, element: CanvasElement) {
	const { elements } = readCanvasMapsFromYDoc(ydoc);
	const normalizedElement: CanvasElement = {
		...element,
		stackIndex:
			element.stackIndex ??
			createStackIndexAfter(elements.values(), element.id),
	};
	const entry = createYjsHistoryEntry([
		{
			kind: "element",
			id: normalizedElement.id,
			before: null,
			after: normalizedElement,
		},
	]);
	transactLocalUndo(
		ydoc,
		() => {
			ydoc
				.getMap<Y.Map<unknown>>("elementsMap")
				.set(normalizedElement.id, objectToYMap(normalizedElement));
		},
		entry,
	);
}

export function yjsUpdateElement(
	ydoc: Y.Doc,
	id: string,
	updates: Partial<CanvasElement>,
) {
	const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
	const yEl = yElements.get(id);
	if (!yEl) return;
	const before =
		readCanvasMapsFromYDoc(ydoc).elements.get(id) ??
		decodeCanvasElement({ ...yMapToObject<Record<string, unknown>>(yEl), id });
	if (!before) return;
	const after = applyCanvasElementUpdates(before, updates);
	if (!after) return;
	const delta = createCanvasHistoryPatchDelta("element", id, before, after);
	const entry = delta ? createYjsHistoryEntry([delta]) : null;

	transactLocalUndo(
		ydoc,
		() => {
			applyPartialUpdatesToYMap(yEl, updates);
		},
		entry,
	);
}

export function yjsUpdateElements(
	ydoc: Y.Doc,
	updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
) {
	const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
	const currentElements = readCanvasMapsFromYDoc(ydoc).elements;
	const deltas: CanvasHistoryDelta[] = [];
	const validatedUpdates: Array<{
		id: string;
		changes: Partial<CanvasElement>;
	}> = [];
	for (const { id, changes } of updates) {
		const yEl = yElements.get(id);
		if (!yEl) continue;
		const before =
			currentElements.get(id) ??
			decodeCanvasElement({
				...yMapToObject<Record<string, unknown>>(yEl),
				id,
			});
		if (!before) continue;
		const after = applyCanvasElementUpdates(before, changes);
		if (!after) continue;
		const delta = createCanvasHistoryPatchDelta("element", id, before, after);
		if (delta) deltas.push(delta);
		validatedUpdates.push({ id, changes });
	}
	const entry = createYjsHistoryEntry(deltas);

	transactLocalUndo(
		ydoc,
		() => {
			for (const { id, changes } of validatedUpdates) {
				const yEl = yElements.get(id);
				if (!yEl) continue;
				applyPartialUpdatesToYMap(yEl, changes);
			}
		},
		entry,
	);
}

export function yjsDeleteElement(ydoc: Y.Doc, id: string) {
	const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
	const yEl = yElements.get(id);
	if (!yEl) return;
	const before =
		readCanvasMapsFromYDoc(ydoc).elements.get(id) ??
		decodeCanvasElement({ ...yMapToObject<Record<string, unknown>>(yEl), id });
	if (!before) return;
	const entry = createYjsHistoryEntry([
		{ kind: "element", id, before, after: null },
	]);
	transactLocalUndo(
		ydoc,
		() => {
			yElements.delete(id);
		},
		entry,
	);
}

export function yjsDeleteElements(ydoc: Y.Doc, ids: string[]) {
	const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
	const currentElements = readCanvasMapsFromYDoc(ydoc).elements;
	const deltas: CanvasHistoryDelta[] = [];
	for (const id of ids) {
		const yEl = yElements.get(id);
		if (!yEl) continue;
		const before =
			currentElements.get(id) ??
			decodeCanvasElement({
				...yMapToObject<Record<string, unknown>>(yEl),
				id,
			});
		if (!before) continue;
		deltas.push({
			kind: "element",
			id,
			before,
			after: null,
		});
	}
	const entry = createYjsHistoryEntry(deltas);
	transactLocalUndo(
		ydoc,
		() => {
			for (const id of ids) {
				yElements.delete(id);
			}
		},
		entry,
	);
}

export function yjsCreateView(ydoc: Y.Doc, view: SavedCanvasView) {
	const entry = createYjsHistoryEntry([
		{ kind: "view", id: view.id, before: null, after: view },
	]);
	transactLocalUndo(
		ydoc,
		() => {
			ydoc.getMap<Y.Map<unknown>>("viewsMap").set(view.id, objectToYMap(view));
		},
		entry,
	);
}

export function yjsUpdateView(
	ydoc: Y.Doc,
	id: string,
	updates: Partial<SavedCanvasView>,
) {
	const yViews = ydoc.getMap<Y.Map<unknown>>("viewsMap");
	const yView = yViews.get(id);
	if (!yView) return;
	const before = decodeSavedCanvasView({
		...yMapToObject<Record<string, unknown>>(yView),
		id,
	});
	if (!before) return;
	const after = applySavedCanvasViewUpdates(before, updates);
	if (!after) return;
	const delta = createCanvasHistoryPatchDelta("view", id, before, after);
	const entry = delta ? createYjsHistoryEntry([delta]) : null;

	transactLocalUndo(
		ydoc,
		() => {
			applyPartialUpdatesToYMap(yView, updates);
		},
		entry,
	);
}

export function yjsDeleteView(ydoc: Y.Doc, id: string) {
	const yViews = ydoc.getMap<Y.Map<unknown>>("viewsMap");
	const yView = yViews.get(id);
	if (!yView) return;
	const before = decodeSavedCanvasView({
		...yMapToObject<Record<string, unknown>>(yView),
		id,
	});
	if (!before) return;
	const entry = createYjsHistoryEntry([
		{ kind: "view", id, before, after: null },
	]);
	transactLocalUndo(
		ydoc,
		() => {
			yViews.delete(id);
		},
		entry,
	);
}
