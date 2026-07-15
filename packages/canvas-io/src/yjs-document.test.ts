import assert from "node:assert/strict";
import { test } from "node:test";
import { createBaseCanvasElement } from "@skedra/canvas-core";
import * as Y from "yjs";
import {
	applyPartialUpdatesToYMap,
	objectToYMap,
	readCanvasMapsFromYDoc,
	yMapToObject,
} from "./yjs-document.js";

test("shares one Web-compatible Yjs document codec across hosts", () => {
	const doc = new Y.Doc();
	const element = createBaseCanvasElement(
		{ createId: () => "element", stroke: "#111111" },
		{ type: "triangle", pyramidSections: 3 },
	);
	const yElement = objectToYMap(element);
	applyPartialUpdatesToYMap(yElement, { text: "Pyramid", link: undefined });
	doc.getMap<Y.Map<unknown>>("elementsMap").set(element.id, yElement);

	assert.equal(yMapToObject<{ text: string }>(yElement).text, "Pyramid");
	const state = readCanvasMapsFromYDoc(doc);
	assert.equal(state.elements.get(element.id)?.pyramidSections, 3);
	assert.equal(state.elements.get(element.id)?.text, "Pyramid");
	doc.destroy();
});
