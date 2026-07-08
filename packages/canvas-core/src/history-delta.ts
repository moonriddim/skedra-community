import type { CanvasElement, SavedCanvasView } from "./types";

export type CanvasHistoryEntityKind = "element" | "view";

export type CanvasHistoryEntity =
	| CanvasElement
	| SavedCanvasView
	| Record<string, unknown>;

export interface CanvasHistoryValueSnapshot {
	exists: boolean;
	value?: unknown;
}

export interface CanvasHistoryFieldPatch {
	path: string[];
	before: CanvasHistoryValueSnapshot;
	after: CanvasHistoryValueSnapshot;
}

export interface CanvasHistoryDelta {
	kind: CanvasHistoryEntityKind;
	id: string;
	patches?: CanvasHistoryFieldPatch[];
	before: CanvasHistoryEntity | null;
	after: CanvasHistoryEntity | null;
}

export interface CanvasHistoryEntry {
	id: string;
	createdAt: number;
	deltas: CanvasHistoryDelta[];
}

export function createCanvasHistoryEntry(
	deltas: CanvasHistoryDelta[],
	options: { id?: string; createdAt?: number } = {},
): CanvasHistoryEntry | null {
	const normalized = deltas.filter(
		(delta) => !isCanvasHistoryDeltaEmpty(delta),
	);
	if (normalized.length === 0) return null;
	return {
		id: options.id ?? createEntryId(),
		createdAt: options.createdAt ?? Date.now(),
		deltas: normalized,
	};
}

export function invertCanvasHistoryEntry(
	entry: CanvasHistoryEntry,
): CanvasHistoryEntry {
	return {
		id: createEntryId(),
		createdAt: Date.now(),
		deltas: entry.deltas.map(invertCanvasHistoryDelta),
	};
}

export function squashCanvasHistoryEntries(
	entries: CanvasHistoryEntry[],
): CanvasHistoryEntry | null {
	const byEntity = new Map<string, CanvasHistoryDelta>();
	for (const entry of entries) {
		for (const delta of entry.deltas) {
			const key = `${delta.kind}:${delta.id}`;
			const existing = byEntity.get(key);
			if (!existing) {
				byEntity.set(key, cloneCanvasHistoryDelta(delta));
				continue;
			}
			byEntity.set(key, squashCanvasHistoryDeltas(existing, delta));
		}
	}
	return createCanvasHistoryEntry(Array.from(byEntity.values()));
}

export function createCanvasHistoryPatchDelta(
	kind: CanvasHistoryEntityKind,
	id: string,
	before: CanvasHistoryEntity,
	after: CanvasHistoryEntity,
): CanvasHistoryDelta | null {
	const patches = diffCanvasHistoryEntities(before, after);
	if (patches.length === 0) return null;
	return {
		kind,
		id,
		patches,
		before: null,
		after: null,
	};
}

export function shouldApplyCanvasHistoryDelta(
	current: CanvasHistoryEntity | null,
	expected: CanvasHistoryEntity | null,
) {
	return deepEqual(current, expected);
}

export function shouldApplyCanvasHistoryPatchDelta(
	current: CanvasHistoryEntity | null,
	delta: CanvasHistoryDelta,
	direction: "undo" | "redo",
) {
	if (!delta.patches) return false;
	if (current == null) return false;
	return delta.patches.every((patch) => {
		const expected = direction === "undo" ? patch.after : patch.before;
		return snapshotsEqual(readSnapshotAtPath(current, patch.path), expected);
	});
}

export function applyCanvasHistoryPatchDelta(
	current: CanvasHistoryEntity,
	delta: CanvasHistoryDelta,
	direction: "undo" | "redo",
): CanvasHistoryEntity {
	if (!delta.patches) return current;
	const next = cloneCanvasHistoryEntity(current) as Record<string, unknown>;
	for (const patch of delta.patches) {
		const snapshot = direction === "undo" ? patch.before : patch.after;
		writeSnapshotAtPath(next, patch.path, snapshot);
	}
	return next;
}

export function cloneCanvasHistoryEntity<T extends CanvasHistoryEntity | null>(
	value: T,
): T {
	if (value == null) return value;
	return JSON.parse(JSON.stringify(value)) as T;
}

function invertCanvasHistoryDelta(
	delta: CanvasHistoryDelta,
): CanvasHistoryDelta {
	if (delta.patches) {
		return {
			...delta,
			patches: delta.patches.map((patch) => ({
				path: [...patch.path],
				before: cloneSnapshot(patch.after),
				after: cloneSnapshot(patch.before),
			})),
			before: delta.after,
			after: delta.before,
		};
	}
	return {
		...delta,
		before: delta.after,
		after: delta.before,
	};
}

function squashCanvasHistoryDeltas(
	left: CanvasHistoryDelta,
	right: CanvasHistoryDelta,
): CanvasHistoryDelta {
	if (left.patches && right.patches) {
		return {
			...left,
			patches: squashCanvasHistoryPatches(left.patches, right.patches),
			before: null,
			after: null,
		};
	}

	if (!left.patches && right.patches) {
		return {
			...left,
			after:
				left.after == null
					? left.after
					: applyCanvasHistoryPatchDelta(left.after, right, "redo"),
		};
	}

	if (left.patches && !right.patches) {
		return {
			...right,
			before:
				right.before == null
					? right.before
					: applyCanvasHistoryPatchDelta(right.before, left, "undo"),
		};
	}

	return {
		...left,
		after: right.after,
	};
}

function squashCanvasHistoryPatches(
	left: CanvasHistoryFieldPatch[],
	right: CanvasHistoryFieldPatch[],
) {
	const patches = new Map<string, CanvasHistoryFieldPatch>();
	for (const patch of left) {
		patches.set(pathKey(patch.path), clonePatch(patch));
	}
	for (const patch of right) {
		const key = pathKey(patch.path);
		const existing = patches.get(key);
		if (!existing) {
			patches.set(key, clonePatch(patch));
			continue;
		}
		existing.after = cloneSnapshot(patch.after);
		if (snapshotsEqual(existing.before, existing.after)) {
			patches.delete(key);
		}
	}
	return Array.from(patches.values());
}

function cloneCanvasHistoryDelta(
	delta: CanvasHistoryDelta,
): CanvasHistoryDelta {
	return {
		...delta,
		before: cloneCanvasHistoryEntity(delta.before),
		after: cloneCanvasHistoryEntity(delta.after),
		patches: delta.patches?.map(clonePatch),
	};
}

function clonePatch(patch: CanvasHistoryFieldPatch): CanvasHistoryFieldPatch {
	return {
		path: [...patch.path],
		before: cloneSnapshot(patch.before),
		after: cloneSnapshot(patch.after),
	};
}

function cloneSnapshot(
	snapshot: CanvasHistoryValueSnapshot,
): CanvasHistoryValueSnapshot {
	return {
		exists: snapshot.exists,
		...(snapshot.exists
			? { value: cloneCanvasHistoryValue(snapshot.value) }
			: {}),
	};
}

function cloneCanvasHistoryValue(value: unknown) {
	if (value == null || typeof value !== "object") return value;
	return JSON.parse(JSON.stringify(value)) as unknown;
}

function diffCanvasHistoryEntities(
	before: CanvasHistoryEntity,
	after: CanvasHistoryEntity,
) {
	const patches: CanvasHistoryFieldPatch[] = [];
	diffRecordValues(
		before as Record<string, unknown>,
		after as Record<string, unknown>,
		[],
		patches,
	);
	return patches;
}

function diffRecordValues(
	before: Record<string, unknown>,
	after: Record<string, unknown>,
	path: string[],
	patches: CanvasHistoryFieldPatch[],
) {
	const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
	for (const key of keys) {
		const beforeSnapshot = readSnapshotAtPath(before, [key]);
		const afterSnapshot = readSnapshotAtPath(after, [key]);
		diffSnapshots(beforeSnapshot, afterSnapshot, [...path, key], patches);
	}
}

function diffSnapshots(
	before: CanvasHistoryValueSnapshot,
	after: CanvasHistoryValueSnapshot,
	path: string[],
	patches: CanvasHistoryFieldPatch[],
) {
	if (snapshotsEqual(before, after)) return;

	if (
		before.exists &&
		after.exists &&
		isPlainRecord(before.value) &&
		isPlainRecord(after.value)
	) {
		diffRecordValues(before.value, after.value, path, patches);
		return;
	}

	patches.push({
		path,
		before: cloneSnapshot(before),
		after: cloneSnapshot(after),
	});
}

function readSnapshotAtPath(
	value: CanvasHistoryEntity | Record<string, unknown>,
	path: string[],
): CanvasHistoryValueSnapshot {
	let current: unknown = value;
	for (const segment of path) {
		if (
			!isPlainRecord(current) ||
			!Object.prototype.hasOwnProperty.call(current, segment)
		) {
			return { exists: false };
		}
		current = current[segment];
	}
	return { exists: true, value: cloneCanvasHistoryValue(current) };
}

function writeSnapshotAtPath(
	target: Record<string, unknown>,
	path: string[],
	snapshot: CanvasHistoryValueSnapshot,
) {
	const key = path[path.length - 1];
	if (!key) return;

	let parent = target;
	for (const segment of path.slice(0, -1)) {
		const child = parent[segment];
		if (!isPlainRecord(child)) {
			parent[segment] = {};
		}
		parent = parent[segment] as Record<string, unknown>;
	}

	if (!snapshot.exists) {
		delete parent[key];
		return;
	}
	parent[key] = cloneCanvasHistoryValue(snapshot.value);
}

function isCanvasHistoryDeltaEmpty(delta: CanvasHistoryDelta) {
	if (delta.patches) return delta.patches.length === 0;
	return deepEqual(delta.before, delta.after);
}

function snapshotsEqual(
	left: CanvasHistoryValueSnapshot,
	right: CanvasHistoryValueSnapshot,
) {
	return left.exists === right.exists && deepEqual(left.value, right.value);
}

function pathKey(path: string[]) {
	return JSON.stringify(path);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	if (value == null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function deepEqual(left: unknown, right: unknown) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function createEntryId() {
	return `hist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
