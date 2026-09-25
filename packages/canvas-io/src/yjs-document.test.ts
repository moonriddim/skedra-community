import assert from "node:assert/strict";
import { test } from "node:test";
import { createBaseCanvasElement } from "@skedra/canvas-core";
import * as Y from "yjs";
import {
	applyPartialUpdatesToYMap,
	applyYDocStateBase64,
	encodeCanvasSnapshotBase64,
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

test("encodes a presentation frame as a reusable canvas snapshot", () => {
	const element = createBaseCanvasElement(
		{ createId: () => "slide-element", stroke: "#111111" },
		{ type: "rectangle", text: "Current slide" },
	);
	const state = encodeCanvasSnapshotBase64({
		elements: [element],
		views: [
			{
				id: "slide",
				name: "Current slide",
				x: 0,
				y: 0,
				width: 1600,
				height: 900,
				createdAt: 1,
				updatedAt: 1,
				order: 0,
				aspectRatio: "16:9",
			},
		],
		canvasBg: "#f8fafc",
	});
	const restored = new Y.Doc();
	applyYDocStateBase64(restored, state);
	const snapshot = readCanvasMapsFromYDoc(restored);

	assert.equal(snapshot.elements.get(element.id)?.text, "Current slide");
	assert.equal(snapshot.views.get("slide")?.name, "Current slide");
	assert.equal(snapshot.canvasBg, "#f8fafc");
	restored.destroy();
});

test("partial updates skip unchanged values so they add no Yjs history", () => {
	const doc = new Y.Doc();
	const yElement = objectToYMap({
		x: 10,
		height: 40,
		text: "Hi",
		points: [
			[0, 0],
			[5, 5],
		],
	});
	doc.getMap<Y.Map<unknown>>("elementsMap").set("text", yElement);
	let updates = 0;
	doc.on("update", () => updates++);

	// Nothing changes: no update may be emitted at all.
	doc.transact(() =>
		applyPartialUpdatesToYMap(yElement, {
			x: 10,
			height: 40,
			points: [
				[0, 0],
				[5, 5],
			],
			missing: undefined,
		}),
	);
	assert.equal(updates, 0);

	// Only the changed key is written.
	let changedKeys: string[] = [];
	yElement.observe((event) => {
		changedKeys = [...event.keysChanged];
	});
	doc.transact(() =>
		applyPartialUpdatesToYMap(yElement, { text: "Hi!", height: 40 }),
	);
	assert.equal(updates, 1);
	assert.deepEqual(changedKeys, ["text"]);
	doc.destroy();
});
