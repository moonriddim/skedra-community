import assert from "node:assert/strict";
import test from "node:test";
import { indexedDB } from "fake-indexeddb";
import {
	deletePendingE2eeUpdateDatabase,
	deletePendingServerUpdates,
	enqueuePendingE2eeUpdate,
	enqueuePendingServerUpdate,
	listPendingE2eeUpdates,
	listPendingServerUpdates,
} from "./e2ee-update-queue";

Object.defineProperty(globalThis, "indexedDB", {
	configurable: true,
	value: indexedDB,
});

test("durable queue isolates encryption modes and whiteboards", async () => {
	await deletePendingE2eeUpdateDatabase();
	const encrypted = await enqueuePendingE2eeUpdate({
		whiteboardId: "board-1",
		clientId: "client-e2ee",
		keyHash: "hash-1",
		update: "encrypted-update",
	});
	const server = await enqueuePendingServerUpdate({
		whiteboardId: "board-1",
		clientId: "client-server",
		update: "server-update",
	});
	await enqueuePendingServerUpdate({
		whiteboardId: "board-2",
		clientId: "client-server",
		update: "other-board-update",
	});

	assert.deepEqual(
		(await listPendingE2eeUpdates("board-1")).map((record) => record.id),
		[encrypted.id],
	);
	assert.deepEqual(
		(await listPendingServerUpdates("board-1")).map((record) => record.id),
		[server.id],
	);
	assert.equal((await listPendingServerUpdates("board-2")).length, 1);

	await deletePendingServerUpdates([server.id]);
	assert.equal((await listPendingServerUpdates("board-1")).length, 0);
	assert.equal((await listPendingE2eeUpdates("board-1")).length, 1);
	await deletePendingE2eeUpdateDatabase();
});
