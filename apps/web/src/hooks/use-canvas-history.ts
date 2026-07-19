/** Persistente Canvas-Historie (Undo/Redo) via Element-/View-Deltas. */

import {
	CANVAS_HISTORY_STORAGE_VERSION,
	clearPersistedCanvasHistory,
	loadPersistedCanvasHistory,
	savePersistedCanvasHistory,
} from "@/lib/canvas/canvas-history-storage";
import {
	LOCAL_UNDO_ORIGIN,
	applyCanvasHistoryEntryToYDoc,
	drainCanvasHistoryEntries,
	rollbackCanvasHistoryEntries,
} from "@/lib/canvas/canvas-undo";
import {
	type CanvasHistoryEntry,
	squashCanvasHistoryEntries,
} from "@skedra/canvas-core";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as Y from "yjs";

const MAX_HISTORY_ENTRIES = 100;
const MAX_HISTORY_MEMORY_BYTES = 8 * 1024 * 1024;
const HISTORY_DEBOUNCE_MS = 400;

interface UseCanvasHistoryOptions {
	getYDoc: () => Y.Doc | null;
	/** z. B. "local" oder "board:<whiteboardId>" */
	scopeKey: string;
	isReady: boolean;
}

export function useCanvasHistory({
	getYDoc,
	scopeKey,
	isReady,
}: UseCanvasHistoryOptions) {
	const undoStackRef = useRef<CanvasHistoryEntry[]>([]);
	const redoStackRef = useRef<CanvasHistoryEntry[]>([]);
	const pendingEntriesRef = useRef<CanvasHistoryEntry[]>([]);
	const isRestoringRef = useRef(false);
	const isCapturingRef = useRef(false);
	const debounceRef = useRef<number | null>(null);
	const scopeKeyRef = useRef(scopeKey);
	const getYDocRef = useRef(getYDoc);
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);

	scopeKeyRef.current = scopeKey;
	getYDocRef.current = getYDoc;

	// Sync hooks may return a new wrapper function after scene updates. Keeping the
	// latest getter behind a stable callback prevents those renders from resetting
	// the complete undo/redo session.
	const getCurrentYDoc = useCallback(() => getYDocRef.current(), []);

	const syncUndoRedoState = useCallback(() => {
		setCanUndo(
			undoStackRef.current.length > 0 || pendingEntriesRef.current.length > 0,
		);
		setCanRedo(redoStackRef.current.length > 0);
	}, []);

	const persistHistory = useCallback(() => {
		savePersistedCanvasHistory(scopeKeyRef.current, {
			version: CANVAS_HISTORY_STORAGE_VERSION,
			undoStack: undoStackRef.current,
			redoStack: redoStackRef.current,
			index: undoStackRef.current.length - 1,
		});
	}, []);

	const trimHistoryMemory = useCallback(() => {
		undoStackRef.current = trimEntriesByBudget(
			undoStackRef.current.slice(-MAX_HISTORY_ENTRIES),
			MAX_HISTORY_MEMORY_BYTES,
		);
		redoStackRef.current = trimEntriesByBudget(
			redoStackRef.current.slice(-MAX_HISTORY_ENTRIES),
			MAX_HISTORY_MEMORY_BYTES,
		);
	}, []);

	const pushPendingEntry = useCallback(
		(force = false) => {
			if (isRestoringRef.current) return;
			if (!force && pendingEntriesRef.current.length === 0) return;

			const entry = squashCanvasHistoryEntries(pendingEntriesRef.current);
			pendingEntriesRef.current = [];
			if (!entry) {
				syncUndoRedoState();
				return;
			}

			undoStackRef.current.push(entry);
			trimHistoryMemory();
			redoStackRef.current = [];
			persistHistory();
			syncUndoRedoState();
		},
		[persistHistory, syncUndoRedoState, trimHistoryMemory],
	);

	const schedulePendingPush = useCallback(() => {
		if (isCapturingRef.current) return;
		if (debounceRef.current != null) {
			window.clearTimeout(debounceRef.current);
		}
		debounceRef.current = window.setTimeout(() => {
			debounceRef.current = null;
			pushPendingEntry();
		}, HISTORY_DEBOUNCE_MS);
	}, [pushPendingEntry]);

	const initializeHistory = useCallback(() => {
		const persisted = loadPersistedCanvasHistory(scopeKeyRef.current);
		if (persisted) {
			undoStackRef.current = persisted.undoStack.slice(-MAX_HISTORY_ENTRIES);
			redoStackRef.current = persisted.redoStack.slice(-MAX_HISTORY_ENTRIES);
			trimHistoryMemory();
		} else {
			undoStackRef.current = [];
			redoStackRef.current = [];
			persistHistory();
		}
		pendingEntriesRef.current = [];
		isCapturingRef.current = false;
		syncUndoRedoState();
	}, [persistHistory, syncUndoRedoState, trimHistoryMemory]);

	useEffect(() => {
		if (!isReady) {
			undoStackRef.current = [];
			redoStackRef.current = [];
			pendingEntriesRef.current = [];
			isCapturingRef.current = false;
			setCanUndo(false);
			setCanRedo(false);
			return;
		}

		const doc = getCurrentYDoc();
		if (!doc) return;

		initializeHistory();

		const onAfterTransaction = (transaction: Y.Transaction) => {
			if (transaction.origin !== LOCAL_UNDO_ORIGIN || isRestoringRef.current)
				return;
			const entries = drainCanvasHistoryEntries(doc);
			if (entries.length === 0) return;
			pendingEntriesRef.current.push(...entries);
			schedulePendingPush();
			syncUndoRedoState();
		};

		doc.on("afterTransaction", onAfterTransaction);

		return () => {
			doc.off("afterTransaction", onAfterTransaction);
			if (debounceRef.current != null) {
				window.clearTimeout(debounceRef.current);
				debounceRef.current = null;
			}
		};
	}, [
		getCurrentYDoc,
		initializeHistory,
		isReady,
		schedulePendingPush,
		syncUndoRedoState,
	]);

	const undo = useCallback(() => {
		pushPendingEntry(true);
		if (undoStackRef.current.length === 0) return;

		const doc = getCurrentYDoc();
		if (!doc) return;

		if (debounceRef.current != null) {
			window.clearTimeout(debounceRef.current);
			debounceRef.current = null;
		}

		const entry = undoStackRef.current.pop();
		if (!entry) return;
		let applied = 0;
		isRestoringRef.current = true;
		try {
			applied = applyCanvasHistoryEntryToYDoc(doc, entry, "undo");
		} finally {
			isRestoringRef.current = false;
		}
		if (applied > 0) redoStackRef.current.push(entry);

		persistHistory();
		syncUndoRedoState();
	}, [getCurrentYDoc, persistHistory, pushPendingEntry, syncUndoRedoState]);

	const redo = useCallback(() => {
		if (redoStackRef.current.length === 0) return;

		const doc = getCurrentYDoc();
		if (!doc) return;

		if (debounceRef.current != null) {
			window.clearTimeout(debounceRef.current);
			debounceRef.current = null;
		}

		const entry = redoStackRef.current.pop();
		if (!entry) return;
		let applied = 0;
		isRestoringRef.current = true;
		try {
			applied = applyCanvasHistoryEntryToYDoc(doc, entry, "redo");
		} finally {
			isRestoringRef.current = false;
		}
		if (applied > 0) undoStackRef.current.push(entry);

		persistHistory();
		syncUndoRedoState();
	}, [getCurrentYDoc, persistHistory, syncUndoRedoState]);

	const stopCapturing = useCallback(() => {
		if (debounceRef.current != null) {
			window.clearTimeout(debounceRef.current);
			debounceRef.current = null;
		}
		isCapturingRef.current = false;
		pushPendingEntry(true);
	}, [pushPendingEntry]);

	const startCapturing = useCallback(() => {
		if (debounceRef.current != null) {
			window.clearTimeout(debounceRef.current);
			debounceRef.current = null;
		}
		// Close the previous action before holding all following mutations until
		// the gesture explicitly finishes. This keeps long drags atomic even when
		// they exceed the normal history debounce window.
		pushPendingEntry(true);
		isCapturingRef.current = true;
	}, [pushPendingEntry]);

	const cancelCapturing = useCallback(() => {
		if (debounceRef.current != null) {
			window.clearTimeout(debounceRef.current);
			debounceRef.current = null;
		}
		isCapturingRef.current = false;

		const entries = pendingEntriesRef.current;
		pendingEntriesRef.current = [];
		const doc = getCurrentYDoc();
		if (!doc || entries.length === 0) {
			syncUndoRedoState();
			return;
		}

		isRestoringRef.current = true;
		try {
			rollbackCanvasHistoryEntries(doc, entries);
		} finally {
			isRestoringRef.current = false;
		}
		syncUndoRedoState();
	}, [getCurrentYDoc, syncUndoRedoState]);

	const clearHistory = useCallback(() => {
		if (debounceRef.current != null) {
			window.clearTimeout(debounceRef.current);
			debounceRef.current = null;
		}

		undoStackRef.current = [];
		redoStackRef.current = [];
		pendingEntriesRef.current = [];
		isCapturingRef.current = false;
		clearPersistedCanvasHistory(scopeKeyRef.current);
		persistHistory();
		syncUndoRedoState();
	}, [persistHistory, syncUndoRedoState]);

	return {
		undo,
		redo,
		canUndo,
		canRedo,
		startCapturing,
		stopCapturing,
		cancelCapturing,
		clearHistory,
	};
}

function trimEntriesByBudget(
	entries: CanvasHistoryEntry[],
	maxBytes: number,
): CanvasHistoryEntry[] {
	let next = entries;
	while (next.length > 1 && estimateJsonBytes(next) > maxBytes) {
		next = next.slice(1);
	}
	return next;
}

function estimateJsonBytes(value: unknown) {
	try {
		return JSON.stringify(value).length;
	} catch {
		return Number.POSITIVE_INFINITY;
	}
}
