import assert from "node:assert/strict";
import test from "node:test";
import type { WSContext } from "hono/ws";
import {
	broadcastPresence,
	closeBoardPresence,
	joinPresenceRoom,
	leavePresenceRoom,
} from "./board-presence";

function createFakeWebSocket() {
	const messages: unknown[] = [];
	const closes: number[] = [];
	const ws = {
		close(code: number) {
			closes.push(code);
		},
		send(data: unknown) {
			messages.push(data);
		},
	} as unknown as WSContext;
	return { messages, closes, ws };
}

test("replays the latest presence state to newly joined viewers", async () => {
	// Keep this unit test local-only; LISTEN/NOTIFY is covered by integration checks.
	await closeBoardPresence();
	const boardId = crypto.randomUUID();
	const presenterSocket = createFakeWebSocket();
	const viewerSocket = createFakeWebSocket();
	const presenter = await joinPresenceRoom(
		boardId,
		presenterSocket.ws,
		"presenter",
		async () => true,
	);

	await broadcastPresence(boardId, presenter, "presenter-state");
	const viewer = await joinPresenceRoom(
		boardId,
		viewerSocket.ws,
		"viewer",
		async () => true,
	);

	assert.deepEqual(viewerSocket.messages, ["presenter-state"]);

	await broadcastPresence(boardId, viewer, "viewer-state");
	assert.deepEqual(presenterSocket.messages, ["viewer-state"]);
	assert.deepEqual(viewerSocket.messages, ["presenter-state"]);

	leavePresenceRoom(boardId, presenter);
	leavePresenceRoom(boardId, viewer);
});

test("revoked passive recipients and active senders are disconnected before delivery", async () => {
	await closeBoardPresence();
	const boardId = crypto.randomUUID();
	let allowed = true;
	const ownerSocket = createFakeWebSocket();
	const removedSocket = createFakeWebSocket();
	const owner = await joinPresenceRoom(
		boardId,
		ownerSocket.ws,
		"owner",
		async () => true,
	);
	const removed = await joinPresenceRoom(
		boardId,
		removedSocket.ws,
		"removed",
		async () => allowed,
	);
	allowed = false;
	await broadcastPresence(boardId, owner, "private-presence");
	await broadcastPresence(boardId, removed, "unauthorized-presence");
	assert.deepEqual(removedSocket.messages, []);
	assert.deepEqual(ownerSocket.messages, []);
	assert.deepEqual(removedSocket.closes, [1008]);
	assert.equal(removed.lastData, null);
	leavePresenceRoom(boardId, owner);
});

test("revoked senders cannot publish and stale presence is not replayed", async () => {
	await closeBoardPresence();
	const boardId = crypto.randomUUID();
	let allowed = true;
	const removedSocket = createFakeWebSocket();
	const removed = await joinPresenceRoom(
		boardId,
		removedSocket.ws,
		"removed",
		async () => allowed,
	);
	await broadcastPresence(boardId, removed, "old-private-presence");
	allowed = false;
	const newcomerSocket = createFakeWebSocket();
	const newcomer = await joinPresenceRoom(
		boardId,
		newcomerSocket.ws,
		"newcomer",
		async () => true,
	);
	assert.deepEqual(newcomerSocket.messages, []);
	assert.deepEqual(removedSocket.closes, [1008]);
	await broadcastPresence(boardId, removed, "forged-presence");
	assert.deepEqual(newcomerSocket.messages, []);
	leavePresenceRoom(boardId, newcomer);
});

test("authorization failure and disconnect during an in-flight check fail closed", async () => {
	await closeBoardPresence();
	const boardId = crypto.randomUUID();
	const socket = createFakeWebSocket();
	const member = await joinPresenceRoom(
		boardId,
		socket.ws,
		"user",
		async () => true,
	);
	const peerSocket = createFakeWebSocket();
	const peer = await joinPresenceRoom(
		boardId,
		peerSocket.ws,
		"peer",
		async () => true,
	);
	let finish: (allowed: boolean) => void = () => {};
	member.authorize = () =>
		new Promise<boolean>((resolve) => {
			finish = resolve;
		});
	const broadcasting = broadcastPresence(boardId, member, "pending");
	await Promise.resolve();
	leavePresenceRoom(boardId, member);
	finish(true);
	await broadcasting;
	assert.deepEqual(peerSocket.messages, []);
	peer.authorize = async () => {
		throw new Error("database unavailable");
	};
	await broadcastPresence(boardId, peer, "blocked");
	assert.deepEqual(peerSocket.closes, [1008]);
});

test("does not expose another connection from the same user as a peer", async () => {
	await closeBoardPresence();
	const boardId = crypto.randomUUID();
	const firstSocket = createFakeWebSocket();
	const secondSocket = createFakeWebSocket();
	const first = await joinPresenceRoom(
		boardId,
		firstSocket.ws,
		"same-user",
		async () => true,
	);

	await broadcastPresence(boardId, first, "stale-first-connection");
	const second = await joinPresenceRoom(
		boardId,
		secondSocket.ws,
		"same-user",
		async () => true,
	);

	assert.deepEqual(secondSocket.messages, []);
	await broadcastPresence(boardId, second, "second-connection");
	assert.deepEqual(firstSocket.messages, []);
	assert.deepEqual(secondSocket.messages, []);

	leavePresenceRoom(boardId, first);
	leavePresenceRoom(boardId, second);
});
