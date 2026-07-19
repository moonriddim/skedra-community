import {
	readCanvasBackgroundFromYDoc,
	readCanvasElementFromYMap,
	readCanvasElementsFromYDoc,
	readCanvasViewsFromYDoc,
} from "@/lib/canvas/yjs-document-helpers";
import {
	type CanvasElement,
	CanvasScene,
	type SavedCanvasView,
} from "@skedra/canvas-core";
import type * as Y from "yjs";

/** Collects top-level element ids affected by a Y.Map deep-observer batch. */
export function collectChangedCanvasElementIds(
	events: readonly Y.YEvent<Y.AbstractType<unknown>>[],
): Set<string> {
	const ids = new Set<string>();
	for (const event of events) {
		const rootId = event.path[0];
		if (typeof rootId === "string") {
			ids.add(rootId);
			continue;
		}
		// Adds/deletes happen directly on elementsMap and therefore have no path.
		for (const key of event.changes.keys.keys()) ids.add(key);
	}
	return ids;
}

/**
 * Decodes only changed Y.js entries and preserves references for every other
 * element so React.memo and renderer-local geometry caches remain effective.
 */
export function patchCanvasSceneFromYDoc(
	current: CanvasScene,
	ydoc: Y.Doc,
	changedIds: ReadonlySet<string>,
): CanvasScene {
	if (changedIds.size === 0) return current;
	const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
	const changes = new Map<string, CanvasElement | null>();
	for (const id of changedIds) {
		const yElement = yElements.get(id);
		changes.set(id, yElement ? readCanvasElementFromYMap(id, yElement) : null);
	}
	return current.withElementChanges(changes);
}

interface CanvasYjsFrameSyncOptions {
	ydoc: Y.Doc;
	setScene: (
		update: CanvasScene | ((current: CanvasScene) => CanvasScene),
	) => void;
	setViews: (views: Map<string, SavedCanvasView>) => void;
	setCanvasBg: (canvasBg: string) => void;
}

/** Batches Web Y.js observers once per frame while keeping element updates sparse. */
export function createCanvasYjsFrameSync({
	ydoc,
	setScene,
	setViews,
	setCanvasBg,
}: CanvasYjsFrameSyncOptions) {
	let frame: number | null = null;
	let viewsChanged = false;
	let appStateChanged = false;
	const changedElementIds = new Set<string>();

	const flush = () => {
		frame = null;
		if (changedElementIds.size > 0) {
			const ids = new Set(changedElementIds);
			changedElementIds.clear();
			setScene((current) => patchCanvasSceneFromYDoc(current, ydoc, ids));
		}
		if (viewsChanged) {
			viewsChanged = false;
			setViews(readCanvasViewsFromYDoc(ydoc));
		}
		if (appStateChanged) {
			appStateChanged = false;
			setCanvasBg(readCanvasBackgroundFromYDoc(ydoc));
		}
	};

	const schedule = () => {
		if (frame != null) return;
		frame = window.requestAnimationFrame(flush);
	};

	return {
		elementsObserver(events: Y.YEvent<Y.AbstractType<unknown>>[]) {
			for (const id of collectChangedCanvasElementIds(events)) {
				changedElementIds.add(id);
			}
			schedule();
		},
		viewsObserver() {
			viewsChanged = true;
			schedule();
		},
		appStateObserver() {
			appStateChanged = true;
			schedule();
		},
		syncAll() {
			if (frame != null) window.cancelAnimationFrame(frame);
			frame = null;
			changedElementIds.clear();
			viewsChanged = false;
			appStateChanged = false;
			setScene(CanvasScene.from(readCanvasElementsFromYDoc(ydoc)));
			setViews(readCanvasViewsFromYDoc(ydoc));
			setCanvasBg(readCanvasBackgroundFromYDoc(ydoc));
		},
		dispose() {
			if (frame != null) window.cancelAnimationFrame(frame);
			frame = null;
			changedElementIds.clear();
		},
	};
}
