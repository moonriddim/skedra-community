import assert from "node:assert/strict";
import test from "node:test";
import * as Y from "yjs";
import { base64ToBytes, bytesToBase64 } from "./e2ee";
import type { PendingServerUpdate } from "./e2ee-update-queue";
import {
	SERVER_UPDATE_BATCH_MAX_RAW_BYTES,
	createPendingServerUpdateBatch,
} from "./server-update-batching";

function pending(
	id: string,
	update: Uint8Array,
	overrides: Partial<PendingServerUpdate> = {},
): PendingServerUpdate {
	return {
		id,
		whiteboardId: "board-1",
		clientId: "client-1",
		mode: "server",
		update: bytesToBase64(update),
		createdAt: Number(id),
		...overrides,
	};
}

function createUpdates() {
	const source = new Y.Doc();
	const updates: Uint8Array[] = [];
	source.on("update", (update) => updates.push(update));
	source.getMap("canvas").set("first", 1);
	source.getMap("canvas").set("second", 2);
	return updates;
}

test("merges durable server updates into one Yjs update", () => {
	const updates = createUpdates();
	const batch = createPendingServerUpdateBatch([
		pending("1", updates[0]),
		pending("2", updates[1]),
	]);

	assert.ok(batch);
	assert.equal(batch.records.length, 2);
	assert.ok(batch.rawBytes < SERVER_UPDATE_BATCH_MAX_RAW_BYTES);
	const restored = new Y.Doc();
	Y.applyUpdate(restored, base64ToBytes(batch.update));
	assert.deepEqual(restored.getMap("canvas").toJSON(), {
		first: 1,
		second: 2,
	});
});

test("keeps different clients and oversized following records separate", () => {
	const updates = createUpdates();
	const bySize = createPendingServerUpdateBatch(
		[pending("1", updates[0]), pending("2", updates[1])],
		updates[0].byteLength,
	);
	const byClient = createPendingServerUpdateBatch([
		pending("1", updates[0]),
		pending("2", updates[1], { clientId: "client-2" }),
	]);

	assert.deepEqual(
		bySize?.records.map((record) => record.id),
		["1"],
	);
	assert.deepEqual(
		byClient?.records.map((record) => record.id),
		["1"],
	);
});
