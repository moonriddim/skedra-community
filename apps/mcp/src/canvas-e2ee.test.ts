import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import {
	createBaseCanvasElement,
	sortCanvasElements,
} from "@skedra/canvas-core";
import {
	createPlainCanvasMutationUpdate,
	createPlainElementsUpdate,
	decryptBoardState,
	encryptCanvasMutationUpdate,
	encryptElementsUpdate,
	readPlainBoardState,
} from "./canvas-e2ee.js";

function createTestKey() {
	return randomBytes(32).toString("base64url");
}

test("decryptBoardState reconstructs MCP-created encrypted elements", () => {
	const key = createTestKey();
	const element = createBaseCanvasElement(
		{ createId: () => "mcp-element-1", stroke: "#111111" },
		{ type: "rectangle", x: 10, y: 20, width: 120, height: 80 },
	);

	const encrypted = encryptElementsUpdate([element], key);
	const state = decryptBoardState(
		[{ id: "update-1", update: encrypted.update }],
		key,
	);

	assert.equal(state.appliedUpdates, 1);
	assert.equal(state.elements.length, 1);
	assert.equal(state.elements[0]?.id, "mcp-element-1");
	assert.equal(state.elements[0]?.type, "rectangle");
	assert.equal(state.elements[0]?.x, 10);
	assert.equal(state.elements[0]?.width, 120);
});

test("decryptBoardState rejects updates encrypted for another key", () => {
	const key = createTestKey();
	const wrongKey = createTestKey();
	const element = createBaseCanvasElement(
		{ createId: () => "mcp-element-2", stroke: "#111111" },
		{ type: "text", x: 0, y: 0, width: 100, height: 40, text: "secret" },
	);

	const encrypted = encryptElementsUpdate([element], key);

	assert.throws(
		() =>
			decryptBoardState(
				[{ id: "update-2", update: encrypted.update }],
				wrongKey,
			),
		/Board-Update update-2 konnte nicht entschluesselt werden/u,
	);
});

test("readPlainBoardState reconstructs server-managed MCP updates", () => {
	const element = createBaseCanvasElement(
		{ createId: () => "server-element-1", stroke: "#111111" },
		{ type: "ellipse", x: 40, y: 50, width: 90, height: 60 },
	);
	const update = createPlainElementsUpdate([element]);
	const state = readPlainBoardState([{ id: "server-update-1", update }]);

	assert.equal(state.appliedUpdates, 1);
	assert.equal(state.elements[0]?.id, "server-element-1");
	assert.equal(state.elements[0]?.type, "ellipse");
});

test("createPlainCanvasMutationUpdate updates and deletes existing elements", () => {
	const first = createBaseCanvasElement(
		{ createId: () => "plain-update", stroke: "#111111" },
		{ type: "text", x: 10, y: 20, width: 100, height: 40, text: "before" },
	);
	const removed = createBaseCanvasElement(
		{ createId: () => "plain-delete", stroke: "#111111" },
		{ type: "rectangle", x: 0, y: 0, width: 20, height: 20 },
	);
	const initial = createPlainElementsUpdate([first, removed]);
	const mutation = createPlainCanvasMutationUpdate([{ update: initial }], {
		create: [],
		update: [{ id: first.id, changes: { text: "after", x: 30 } }],
		deleteIds: [removed.id],
	});
	const state = readPlainBoardState([
		{ update: initial },
		{ update: mutation.update },
	]);

	assert.equal(mutation.changed, 2);
	assert.equal(state.elements.length, 1);
	assert.equal(state.elements[0]?.text, "after");
	assert.equal(state.elements[0]?.x, 30);
});

test("new MCP batches stay above legacy elements and preserve their layer order", () => {
	const legacyFront = createBaseCanvasElement(
		{ createId: () => "zzz-legacy-front", stroke: "#111111" },
		{ type: "text", x: 0, y: 0, width: 100, height: 40, text: "old" },
	);
	const legacyBack = createBaseCanvasElement(
		{ createId: () => "aaa-legacy-back", stroke: "#111111" },
		{ type: "rectangle", x: 0, y: 0, width: 100, height: 40 },
	);
	const background = createBaseCanvasElement(
		{ createId: () => "batch-background", stroke: "#111111" },
		{ type: "rectangle", x: 0, y: 0, width: 100, height: 40 },
	);
	const symbol = createBaseCanvasElement(
		{ createId: () => "batch-symbol", stroke: "#111111" },
		{ type: "ellipse", x: 10, y: 10, width: 20, height: 20 },
	);
	const label = createBaseCanvasElement(
		{ createId: () => "batch-label", stroke: "#111111" },
		{ type: "text", x: 0, y: 0, width: 100, height: 40, text: "new" },
	);
	const initial = createPlainElementsUpdate([legacyFront, legacyBack]);
	const mutation = createPlainCanvasMutationUpdate([{ update: initial }], {
		create: [background, symbol, label],
		update: [],
		deleteIds: [],
	});
	const state = readPlainBoardState([
		{ update: initial },
		{ update: mutation.update },
	]);

	const orderedIds = sortCanvasElements(state.elements).map(
		(element) => element.id,
	);
	assert.deepEqual(orderedIds.slice(-3), [
		"batch-background",
		"batch-symbol",
		"batch-label",
	]);
	assert.ok(
		orderedIds.indexOf("zzz-legacy-front") <
			orderedIds.indexOf("batch-background"),
	);
	assert.ok(
		state.elements
			.filter((element) => element.id.startsWith("batch-"))
			.every((element) => element.stackIndex),
	);
});

test("encryptCanvasMutationUpdate creates an E2EE-compatible incremental edit", () => {
	const key = createTestKey();
	const element = createBaseCanvasElement(
		{ createId: () => "encrypted-update", stroke: "#111111" },
		{ type: "text", x: 10, y: 20, width: 100, height: 40, text: "before" },
	);
	const initial = encryptElementsUpdate([element], key);
	const mutation = encryptCanvasMutationUpdate(
		[{ update: initial.update }],
		key,
		{
			create: [],
			update: [{ id: element.id, changes: { text: "after" } }],
			deleteIds: [],
		},
	);
	const state = decryptBoardState(
		[{ update: initial.update }, { update: mutation.update }],
		key,
	);

	assert.equal(mutation.changed, 1);
	assert.equal(mutation.keyHash, initial.keyHash);
	assert.equal(state.elements[0]?.text, "after");
});
