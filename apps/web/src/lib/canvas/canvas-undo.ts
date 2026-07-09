/** Undo/Redo fuer Canvas-Aenderungen via Element-/View-Deltas. */

import {
	objectToYMap,
	readCanvasMapsFromYDoc,
} from "@/lib/canvas/yjs-document-helpers";
import {
	type CanvasHistoryDelta,
	type CanvasHistoryEntity,
	type CanvasHistoryEntry,
	applyCanvasHistoryPatchDelta,
	cloneCanvasHistoryEntity,
	createCanvasHistoryEntry,
	shouldApplyCanvasHistoryDelta,
	shouldApplyCanvasHistoryPatchDelta,
} from "@skedra/canvas-core";
import type * as Y from "yjs";

/** Origin fuer alle lokalen Canvas-Mutationen (Zeichnen, Verschieben, Loeschen, …) */
export const LOCAL_UNDO_ORIGIN = Symbol("skedra-local-undo");

/** Origin fuer Undo/Redo-Wiederherstellung — wird nicht in die Historie aufgenommen */
const RESTORE_ORIGIN = Symbol("skedra-restore");
const pendingEntries = new WeakMap<Y.Doc, CanvasHistoryEntry[]>();

export function transactLocalUndo(
	doc: Y.Doc,
	fn: () => void,
	historyEntry?: CanvasHistoryEntry | null,
) {
	doc.transact(() => {
		if (historyEntry) recordCanvasHistoryEntry(doc, historyEntry);
		fn();
	}, LOCAL_UNDO_ORIGIN);
}

function transactRestore(doc: Y.Doc, fn: () => void) {
	doc.transact(fn, RESTORE_ORIGIN);
}

export function recordCanvasHistoryEntry(
	doc: Y.Doc,
	entry: CanvasHistoryEntry,
) {
	const entries = pendingEntries.get(doc) ?? [];
	entries.push(entry);
	pendingEntries.set(doc, entries);
}

export function drainCanvasHistoryEntries(doc: Y.Doc): CanvasHistoryEntry[] {
	const entries = pendingEntries.get(doc) ?? [];
	pendingEntries.delete(doc);
	return entries;
}

export function createYjsHistoryEntry(deltas: CanvasHistoryDelta[]) {
	return createCanvasHistoryEntry(deltas);
}

export function applyCanvasHistoryEntryToYDoc(
	target: Y.Doc,
	entry: CanvasHistoryEntry,
	direction: "undo" | "redo",
) {
	let applied = 0;
	transactRestore(target, () => {
		const { elements, views } = readCanvasMapsFromYDoc(target);
		const yElements = target.getMap<Y.Map<unknown>>("elementsMap");
		const yViews = target.getMap<Y.Map<unknown>>("viewsMap");

		for (const delta of entry.deltas) {
			const currentMap = delta.kind === "element" ? elements : views;
			const yMap = delta.kind === "element" ? yElements : yViews;
			const current = currentMap.get(delta.id) as
				| CanvasHistoryEntity
				| undefined;

			if (delta.patches) {
				if (
					!shouldApplyCanvasHistoryPatchDelta(current ?? null, delta, direction)
				) {
					continue;
				}
				const next = applyCanvasHistoryPatchDelta(
					current as CanvasHistoryEntity,
					delta,
					direction,
				);
				yMap.set(delta.id, objectToYMap(cloneCanvasHistoryEntity(next)));
				applied += 1;
				continue;
			}

			const expected = direction === "undo" ? delta.after : delta.before;
			const next = direction === "undo" ? delta.before : delta.after;

			if (!shouldApplyCanvasHistoryDelta(current ?? null, expected)) continue;

			if (next == null) {
				yMap.delete(delta.id);
			} else {
				yMap.set(delta.id, objectToYMap(cloneCanvasHistoryEntity(next)));
			}
			applied += 1;
		}
	});
	return applied;
}

export function buildReplaceAllHistoryEntry(
	ydoc: Y.Doc,
	nextElements: CanvasHistoryEntity[],
	nextViews: CanvasHistoryEntity[],
) {
	const current = readCanvasMapsFromYDoc(ydoc);
	const deltas: CanvasHistoryDelta[] = [];
	const nextElementMap = new Map(
		nextElements
			.map((element) => [readHistoryEntityId(element), element] as const)
			.filter(
				(entry): entry is readonly [string, CanvasHistoryEntity] =>
					entry[0] != null,
			),
	);
	const nextViewMap = new Map(
		nextViews
			.map((view) => [readHistoryEntityId(view), view] as const)
			.filter(
				(entry): entry is readonly [string, CanvasHistoryEntity] =>
					entry[0] != null,
			),
	);

	for (const [id, before] of current.elements) {
		deltas.push({
			kind: "element",
			id,
			before,
			after: nextElementMap.get(id) ?? null,
		});
		nextElementMap.delete(id);
	}
	for (const [id, after] of nextElementMap) {
		deltas.push({ kind: "element", id, before: null, after });
	}
	for (const [id, before] of current.views) {
		deltas.push({
			kind: "view",
			id,
			before,
			after: nextViewMap.get(id) ?? null,
		});
		nextViewMap.delete(id);
	}
	for (const [id, after] of nextViewMap) {
		deltas.push({ kind: "view", id, before: null, after });
	}

	return createYjsHistoryEntry(deltas);
}

function readHistoryEntityId(entity: CanvasHistoryEntity) {
	const id = (entity as { id?: unknown }).id;
	return typeof id === "string" && id.length > 0 ? id : null;
}
