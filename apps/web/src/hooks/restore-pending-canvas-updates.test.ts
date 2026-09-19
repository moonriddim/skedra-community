import assert from "node:assert/strict";
import test from "node:test";
import * as Y from "yjs";
import { restorePendingCanvasUpdates } from "./restore-pending-canvas-updates";

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function fixture() {
	const source = new Y.Doc();
	source.getMap("elementsMap").set("old-board-element", "content");
	const record = { id: "queued-update", update: Y.encodeStateAsUpdate(source) };
	source.destroy();
	const ydoc = new Y.Doc();
	const replacement = new Y.Doc();
	let current = ydoc;
	let restored = 0;
	const appliedIds = new Set<string>();
	return {
		record,
		ydoc,
		replacement,
		switchBoard: () => {
			current = replacement;
			ydoc.destroy();
		},
		options: {
			ydoc,
			isCurrent: () => current === ydoc,
			load: async () => [record],
			decode: (queued: typeof record) => queued.update,
			appliedIds,
			origin: "pending-test",
			onRestored: () => restored++,
		},
		assertNotApplied() {
			assert.equal(ydoc.getMap("elementsMap").size, 0);
			assert.equal(replacement.getMap("elementsMap").size, 0);
			assert.equal(appliedIds.size, 0);
			assert.equal(restored, 0);
		},
		dispose() {
			ydoc.destroy();
			replacement.destroy();
		},
	};
}

test("a delayed queue read cannot restore updates after a board switch", async (t) => {
	const f = fixture();
	t.after(f.dispose);
	const pending = deferred<(typeof f.record)[]>();
	const restoring = restorePendingCanvasUpdates({
		...f.options,
		load: () => pending.promise,
	});
	f.switchBoard();
	pending.resolve([f.record]);
	await restoring;
	f.assertNotApplied();
});

test("a board switch during decryption discards the decrypted update", async (t) => {
	const f = fixture();
	t.after(f.dispose);
	const started = deferred<void>();
	const decrypted = deferred<Uint8Array>();
	const restoring = restorePendingCanvasUpdates({
		...f.options,
		decode: () => {
			started.resolve();
			return decrypted.promise;
		},
	});
	await started.promise;
	f.switchBoard();
	decrypted.resolve(f.record.update);
	await restoring;
	f.assertNotApplied();
});

test("unmounting during a queue read discards the pending update", async (t) => {
	const f = fixture();
	t.after(f.dispose);
	const pending = deferred<(typeof f.record)[]>();
	const restoring = restorePendingCanvasUpdates({
		...f.options,
		load: () => pending.promise,
	});
	f.ydoc.destroy();
	pending.resolve([f.record]);
	await restoring;
	f.assertNotApplied();
});

test("current-board updates are restored once with the pending origin", async (t) => {
	const f = fixture();
	t.after(f.dispose);
	const origins: unknown[] = [];
	f.ydoc.on("update", (_update, origin) => origins.push(origin));
	await restorePendingCanvasUpdates(f.options);
	await restorePendingCanvasUpdates(f.options);
	assert.equal(
		f.ydoc.getMap("elementsMap").get("old-board-element"),
		"content",
	);
	assert.deepEqual(origins, ["pending-test"]);
	assert.deepEqual([...f.options.appliedIds], [f.record.id]);
});

test("restore failures are reported only while their board is current", async (t) => {
	const f = fixture();
	t.after(f.dispose);
	const error = new Error("queue unavailable");
	await assert.rejects(
		restorePendingCanvasUpdates({
			...f.options,
			load: async () => {
				throw error;
			},
		}),
		error,
	);
	const pending = deferred<(typeof f.record)[]>();
	const restoring = restorePendingCanvasUpdates({
		...f.options,
		load: () => pending.promise,
	});
	f.switchBoard();
	pending.reject(error);
	await restoring;
	f.assertNotApplied();
});
