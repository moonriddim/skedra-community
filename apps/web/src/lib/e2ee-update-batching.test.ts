import assert from "node:assert/strict";
import test from "node:test";
import * as Y from "yjs";
import { bytesToBase64Url, decryptYjsUpdate, encryptYjsUpdate } from "./e2ee";
import { createPendingE2eeUpdateBatch } from "./e2ee-update-batching";
import type { PendingE2eeUpdate } from "./e2ee-update-queue";

function pending(
	id: string,
	update: string,
	overrides: Partial<PendingE2eeUpdate> = {},
): PendingE2eeUpdate {
	return {
		id,
		whiteboardId: "board-1",
		clientId: "client-1",
		keyHash: "hash-1",
		update,
		createdAt: Number(id),
		...overrides,
	};
}

test("merges durable encrypted updates into one encrypted Yjs update", async () => {
	const key = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
	const source = new Y.Doc();
	const updates: Uint8Array[] = [];
	source.on("update", (update) => updates.push(update));
	source.getMap("canvas").set("first", 1);
	source.getMap("canvas").set("second", 2);

	const encrypted = await Promise.all(
		updates.map((update) => encryptYjsUpdate(update, key)),
	);
	const batch = await createPendingE2eeUpdateBatch(
		[pending("1", encrypted[0]), pending("2", encrypted[1])],
		key,
	);

	assert.ok(batch);
	assert.equal(batch.records.length, 2);
	const restored = new Y.Doc();
	Y.applyUpdate(restored, await decryptYjsUpdate(batch.update, key));
	assert.deepEqual(restored.getMap("canvas").toJSON(), {
		first: 1,
		second: 2,
	});
});

test("keeps different key-verifier groups separate", async () => {
	const key = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
	const source = new Y.Doc();
	const update = Y.encodeStateAsUpdate(source);
	const encrypted = await encryptYjsUpdate(update, key);
	const batch = await createPendingE2eeUpdateBatch(
		[pending("1", encrypted), pending("2", encrypted, { keyHash: "hash-2" })],
		key,
	);

	assert.ok(batch);
	assert.deepEqual(
		batch.records.map((record) => record.id),
		["1"],
	);
});
