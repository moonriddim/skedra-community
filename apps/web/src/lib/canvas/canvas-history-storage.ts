/** Persistente Undo/Redo-Deltas pro Canvas (localStorage, ueberlebt Refresh). */

import type { CanvasHistoryEntry } from "@skedra/canvas-core";

export const CANVAS_HISTORY_STORAGE_VERSION = 3;

const HISTORY_KEY_PREFIX = "skedra-canvas-history-v3:";
const LEGACY_HISTORY_KEY_PREFIXES = [
	"skedra-canvas-history-v2:",
	"skedra-canvas-history-v1:",
];
const HISTORY_BLOB_KEY_PREFIX = "skedra-canvas-history-blob-v1:";
const HISTORY_BLOB_REF_KEY = "__skedraHistoryBlobRef";
const HISTORY_BLOB_REF_VERSION_KEY = "__skedraHistoryBlobRefVersion";
const HISTORY_BLOB_REF_VERSION = 1;
const LARGE_STRING_THRESHOLD = 2048;
const LARGE_JSON_THRESHOLD = 4096;

export interface PersistedCanvasHistory {
	version: typeof CANVAS_HISTORY_STORAGE_VERSION;
	undoStack: CanvasHistoryEntry[];
	redoStack: CanvasHistoryEntry[];
	index: number;
}

interface StoredPersistedCanvasHistory {
	version: typeof CANVAS_HISTORY_STORAGE_VERSION;
	undoStack: unknown[];
	redoStack: unknown[];
	index: number;
	blobIds: string[];
}

interface HistoryBlobRef {
	[HISTORY_BLOB_REF_KEY]: string;
	[HISTORY_BLOB_REF_VERSION_KEY]: typeof HISTORY_BLOB_REF_VERSION;
}

function historyStorageKey(scopeKey: string) {
	return `${HISTORY_KEY_PREFIX}${scopeKey}`;
}

function legacyHistoryStorageKey(scopeKey: string, prefix: string) {
	return `${prefix}${scopeKey}`;
}

function historyBlobStorageKey(scopeKey: string, blobId: string) {
	return `${HISTORY_BLOB_KEY_PREFIX}${scopeKey}:${blobId}`;
}

function historyBlobStorageKeyPrefix(scopeKey: string) {
	return `${HISTORY_BLOB_KEY_PREFIX}${scopeKey}:`;
}

export function loadPersistedCanvasHistory(
	scopeKey: string,
): PersistedCanvasHistory | null {
	try {
		const raw = localStorage.getItem(historyStorageKey(scopeKey));
		if (raw) {
			return inflateStoredHistory(scopeKey, JSON.parse(raw));
		}

		for (const prefix of LEGACY_HISTORY_KEY_PREFIXES) {
			const legacyRaw = localStorage.getItem(
				legacyHistoryStorageKey(scopeKey, prefix),
			);
			if (!legacyRaw) continue;
			return normalizeLegacyHistory(JSON.parse(legacyRaw));
		}

		return null;
	} catch {
		return null;
	}
}

export function savePersistedCanvasHistory(
	scopeKey: string,
	history: PersistedCanvasHistory,
) {
	try {
		const blobIds = new Set<string>();
		const stored: StoredPersistedCanvasHistory = {
			version: CANVAS_HISTORY_STORAGE_VERSION,
			undoStack: history.undoStack.map((entry) =>
				compactHistoryValue(scopeKey, entry, blobIds),
			),
			redoStack: history.redoStack.map((entry) =>
				compactHistoryValue(scopeKey, entry, blobIds),
			),
			index: history.index,
			blobIds: Array.from(blobIds).sort(),
		};
		localStorage.setItem(historyStorageKey(scopeKey), JSON.stringify(stored));
		for (const key of collectStaleBlobKeys(scopeKey, blobIds)) {
			localStorage.removeItem(key);
		}
	} catch {
		// Quota oder Storage deaktiviert: Undo bleibt in der Session.
	}
}

export function clearPersistedCanvasHistory(scopeKey: string) {
	try {
		localStorage.removeItem(historyStorageKey(scopeKey));
		for (const prefix of LEGACY_HISTORY_KEY_PREFIXES) {
			localStorage.removeItem(legacyHistoryStorageKey(scopeKey, prefix));
		}
		for (const key of collectBlobKeys(scopeKey)) {
			localStorage.removeItem(key);
		}
	} catch {
		// ignore
	}
}

export function clearLegacyPersistedCanvasHistory(scopeKey: string) {
	try {
		for (const prefix of LEGACY_HISTORY_KEY_PREFIXES) {
			localStorage.removeItem(legacyHistoryStorageKey(scopeKey, prefix));
		}
	} catch {
		// ignore
	}
}

function normalizeLegacyHistory(value: unknown): PersistedCanvasHistory | null {
	if (!isRecord(value)) return null;
	if (!Array.isArray(value.undoStack) || !Array.isArray(value.redoStack)) {
		return null;
	}
	return {
		version: CANVAS_HISTORY_STORAGE_VERSION,
		undoStack: value.undoStack as CanvasHistoryEntry[],
		redoStack: value.redoStack as CanvasHistoryEntry[],
		index: typeof value.index === "number" ? value.index : -1,
	};
}

function inflateStoredHistory(
	scopeKey: string,
	value: unknown,
): PersistedCanvasHistory | null {
	if (!isRecord(value)) return null;
	if (
		value.version !== CANVAS_HISTORY_STORAGE_VERSION ||
		!Array.isArray(value.undoStack) ||
		!Array.isArray(value.redoStack)
	) {
		return null;
	}

	return {
		version: CANVAS_HISTORY_STORAGE_VERSION,
		undoStack: expandHistoryValue(
			scopeKey,
			value.undoStack,
		) as CanvasHistoryEntry[],
		redoStack: expandHistoryValue(
			scopeKey,
			value.redoStack,
		) as CanvasHistoryEntry[],
		index: typeof value.index === "number" ? value.index : -1,
	};
}

function compactHistoryValue(
	scopeKey: string,
	value: unknown,
	blobIds: Set<string>,
): unknown {
	if (typeof value === "string") {
		if (value.length < LARGE_STRING_THRESHOLD) return value;
		return storeHistoryBlob(scopeKey, value, blobIds);
	}

	if (value == null || typeof value !== "object") return value;

	if (Array.isArray(value)) {
		const compacted = value.map((item) =>
			compactHistoryValue(scopeKey, item, blobIds),
		);
		return maybeStoreLargeJsonBlob(scopeKey, compacted, blobIds);
	}

	const compacted: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value)) {
		compacted[key] = compactHistoryValue(scopeKey, item, blobIds);
	}
	return maybeStoreLargeJsonBlob(scopeKey, compacted, blobIds);
}

function maybeStoreLargeJsonBlob(
	scopeKey: string,
	value: unknown,
	blobIds: Set<string>,
) {
	const json = JSON.stringify(value);
	if (json.length < LARGE_JSON_THRESHOLD) return value;
	return storeHistoryBlob(scopeKey, value, blobIds, json);
}

function storeHistoryBlob(
	scopeKey: string,
	value: unknown,
	blobIds: Set<string>,
	json = JSON.stringify(value),
): HistoryBlobRef {
	const blobId = createBlobId(json);
	const key = historyBlobStorageKey(scopeKey, blobId);
	if (localStorage.getItem(key) == null) {
		localStorage.setItem(key, json);
	}
	blobIds.add(blobId);
	return {
		[HISTORY_BLOB_REF_KEY]: blobId,
		[HISTORY_BLOB_REF_VERSION_KEY]: HISTORY_BLOB_REF_VERSION,
	};
}

function expandHistoryValue(scopeKey: string, value: unknown): unknown {
	if (isHistoryBlobRef(value)) {
		const raw = localStorage.getItem(
			historyBlobStorageKey(scopeKey, value[HISTORY_BLOB_REF_KEY]),
		);
		if (raw == null) {
			throw new Error("Missing canvas history blob");
		}
		return expandHistoryValue(scopeKey, JSON.parse(raw));
	}

	if (Array.isArray(value)) {
		return value.map((item) => expandHistoryValue(scopeKey, item));
	}

	if (!isRecord(value)) return value;

	const expanded: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value)) {
		expanded[key] = expandHistoryValue(scopeKey, item);
	}
	return expanded;
}

function isHistoryBlobRef(value: unknown): value is HistoryBlobRef {
	return (
		isRecord(value) &&
		value[HISTORY_BLOB_REF_VERSION_KEY] === HISTORY_BLOB_REF_VERSION &&
		typeof value[HISTORY_BLOB_REF_KEY] === "string"
	);
}

function collectStaleBlobKeys(scopeKey: string, activeBlobIds: Set<string>) {
	return collectBlobKeys(scopeKey).filter((key) => {
		const blobId = key.slice(historyBlobStorageKeyPrefix(scopeKey).length);
		return !activeBlobIds.has(blobId);
	});
}

function collectBlobKeys(scopeKey: string) {
	const prefix = historyBlobStorageKeyPrefix(scopeKey);
	const keys: string[] = [];
	for (let index = 0; index < localStorage.length; index++) {
		const key = localStorage.key(index);
		if (key?.startsWith(prefix)) keys.push(key);
	}
	return keys;
}

function createBlobId(json: string) {
	let hash = 2166136261;
	for (let index = 0; index < json.length; index++) {
		hash ^= json.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return `${(hash >>> 0).toString(36)}_${json.length.toString(36)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === "object" && !Array.isArray(value);
}
