import assert from "node:assert/strict";
import test from "node:test";
import type { WSContext } from "hono/ws";
import {
	broadcastPresence,
	joinPresenceRoom,
	leavePresenceRoom,
} from "./board-presence";

function createFakeWebSocket() {
	const messages: unknown[] = [];
	const ws = {
		send(data: unknown) {
			messages.push(data);
		},
	} as unknown as WSContext;
	return { messages, ws };
}

test("replays the latest presence state to newly joined viewers", () => {
	const boardId = crypto.randomUUID();
	const presenterSocket = createFakeWebSocket();
	const viewerSocket = createFakeWebSocket();
	const presenter = joinPresenceRoom(boardId, presenterSocket.ws, "presenter");

	broadcastPresence(boardId, presenter, "presenter-state");
	const viewer = joinPresenceRoom(boardId, viewerSocket.ws, "viewer");

	assert.deepEqual(viewerSocket.messages, ["presenter-state"]);

	broadcastPresence(boardId, viewer, "viewer-state");
	assert.deepEqual(presenterSocket.messages, ["viewer-state"]);
	assert.deepEqual(viewerSocket.messages, ["presenter-state"]);

	leavePresenceRoom(boardId, presenter);
	leavePresenceRoom(boardId, viewer);
});
