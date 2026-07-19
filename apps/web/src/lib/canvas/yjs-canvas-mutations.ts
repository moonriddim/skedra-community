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
	type CanvasMutationPlan,
	type SavedCanvasView,
	applyCanvasMutationPlan,
	createCanvasHistoryPatchDelta,
	createStackIndexAfter,
} from "@skedra/canvas-core";
import type * as Y from "yjs";

/**
 * Applies a complete semantic canvas edit in one Y.js transaction.
 *
 * Composite editors such as Gantt rebuild several child elements at once. If
 * those writes are emitted separately, React can briefly publish an incomplete
 * chart and the history observer has to reconstruct the intended edit. Keeping
 * the plan atomic gives the canvas one coherent snapshot and one Undo entry.
 */
export function yjsApplyCanvasMutationPlan(
	ydoc: Y.Doc,
	plan: CanvasMutationPlan,
) {
	const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
	const current = readCanvasMapsFromYDoc(ydoc).elements;
	const stackContext = new Map(current);
	for (const id of plan.deleteIds) stackContext.delete(id);
	const preparedCreate = plan.create.map((element) => {
		const prepared = element.stackIndex
			? element
			: {
					...element,
					stackIndex: createStackIndexAfter(stackContext.values(), element.id),
				};
		stackContext.set(prepared.id, prepared);
		return prepared;
	});
	const preparedPlan: CanvasMutationPlan = {
		...plan,
		create: preparedCreate,
	};
	const next = new Map(
		applyCanvasMutationPlan(Array.from(current.values()), preparedPlan).map(
			(element) => [element.id, element] as const,
		),
	);
	const ids = new Set([...current.keys(), ...next.keys()]);
	const deltas: CanvasHistoryDelta[] = [];
	const changedIds: string[] = [];

	for (const id of ids) {
		const before = current.get(id) ?? null;
		const after = next.get(id) ?? null;
		if (before == null || after == null) {
			if (before !== after) {
				deltas.push({ kind: "element", id, before, after });
				changedIds.push(id);
			}
			continue;
		}
		const delta = createCanvasHistoryPatchDelta("element", id, before, after);
		if (delta) {
			deltas.push(delta);
			changedIds.push(id);
		}
	}

	if (changedIds.length === 0) return current;
	transactLocalUndo(
		ydoc,
		() => {
			for (const id of changedIds) {
				const before = current.get(id);
				const after = next.get(id);
				if (!after) {
					yElements.delete(id);
					continue;
				}
				const yElement = yElements.get(id);
				if (!before || !yElement) {
					yElements.set(id, objectToYMap(after));
					continue;
				}
				applyPartialUpdatesToYMap(
					yElement,
					createTopLevelElementChanges(before, after),
				);
			}
		},
		createYjsHistoryEntry(deltas),
	);

	return next;
}

function createTopLevelElementChanges(
	before: CanvasElement,
	after: CanvasElement,
): Record<string, unknown> {
	const beforeRecord = before as unknown as Record<string, unknown>;
	const afterRecord = after as unknown as Record<string, unknown>;
	const changes: Record<string, unknown> = {};
	for (const key of new Set([
		...Object.keys(beforeRecord),
		...Object.keys(afterRecord),
	])) {
		if (
			JSON.stringify(beforeRecord[key]) === JSON.stringify(afterRecord[key])
		) {
			continue;
		}
		changes[key] = Object.hasOwn(afterRecord, key)
			? afterRecord[key]
			: undefined;
	}
	return changes;
}

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
	const before = decodeYjsCanvasElement(id, yEl);
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
	const deltas: CanvasHistoryDelta[] = [];
	const validatedUpdates: Array<{
		id: string;
		changes: Partial<CanvasElement>;
	}> = [];
	for (const { id, changes } of updates) {
		const yEl = yElements.get(id);
		if (!yEl) continue;
		const before = decodeYjsCanvasElement(id, yEl);
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
	const before = decodeYjsCanvasElement(id, yEl);
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
	const deltas: CanvasHistoryDelta[] = [];
	for (const id of ids) {
		const yEl = yElements.get(id);
		if (!yEl) continue;
		const before = decodeYjsCanvasElement(id, yEl);
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

function decodeYjsCanvasElement(
	id: string,
	yElement: Y.Map<unknown>,
): CanvasElement | null {
	return decodeCanvasElement({
		...yMapToObject<Record<string, unknown>>(yElement),
		id,
	});
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
