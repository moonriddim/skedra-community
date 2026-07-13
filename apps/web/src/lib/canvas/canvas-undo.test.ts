import assert from "node:assert/strict";
import { test } from "node:test";
import type { CanvasElement } from "@skedra/canvas-core";
import * as Y from "yjs";
import {
	applyCanvasHistoryEntryToYDoc,
	drainCanvasHistoryEntries,
} from "./canvas-undo.js";
import { yjsCreateElement } from "./yjs-canvas-mutations.js";
import { readCanvasMapsFromYDoc } from "./yjs-document-helpers.js";

function rectangle(): CanvasElement {
	return {
		id: "rectangle",
		type: "rectangle",
		x: 10,
		y: 20,
		width: 120,
		height: 80,
		rotation: 0,
		fill: "#ffffff",
		stroke: "#000000",
		strokeWidth: 2,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
	};
}

test("records local canvas mutations and can undo and redo them", () => {
	const doc = new Y.Doc({ gc: false });

	yjsCreateElement(doc, rectangle());
	const entries = drainCanvasHistoryEntries(doc);

	assert.equal(entries.length, 1);
	assert.equal(readCanvasMapsFromYDoc(doc).elements.has("rectangle"), true);
	assert.equal(applyCanvasHistoryEntryToYDoc(doc, entries[0], "undo"), 1);
	assert.equal(readCanvasMapsFromYDoc(doc).elements.has("rectangle"), false);
	assert.equal(applyCanvasHistoryEntryToYDoc(doc, entries[0], "redo"), 1);
	assert.equal(readCanvasMapsFromYDoc(doc).elements.has("rectangle"), true);
});
