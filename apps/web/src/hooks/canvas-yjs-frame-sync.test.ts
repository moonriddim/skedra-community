import assert from "node:assert/strict";
import { test } from "node:test";
import { type CanvasElement, CanvasScene } from "@skedra/canvas-core";
import {
	objectToYMap,
	readCanvasElementsFromYDoc,
} from "@skedra/canvas-io/yjs-document";
import * as Y from "yjs";
import {
	collectChangedCanvasElementIds,
	patchCanvasSceneFromYDoc,
} from "./canvas-yjs-frame-sync";

function element(id: string, x: number): CanvasElement {
	return {
		id,
		type: "rectangle",
		x,
		y: 0,
		width: 10,
		height: 10,
		rotation: 0,
		fill: "transparent",
		stroke: "#000",
		strokeWidth: 1,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		stackIndex: id === "a" ? "1" : "2",
	};
}

test("Y.js scene patches decode only changed top-level elements", () => {
	const ydoc = new Y.Doc();
	const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
	yElements.set("a", objectToYMap(element("a", 0)));
	yElements.set("b", objectToYMap(element("b", 20)));
	const scene = CanvasScene.from(readCanvasElementsFromYDoc(ydoc));
	const previousA = scene.getElement("a");
	const previousB = scene.getElement("b");
	let ids = new Set<string>();
	yElements.observeDeep((events) => {
		ids = collectChangedCanvasElementIds(events);
	});

	yElements.get("a")?.set("x", 40);
	const patched = patchCanvasSceneFromYDoc(scene, ydoc, ids);

	assert.deepEqual([...ids], ["a"]);
	assert.notEqual(patched.getElement("a"), previousA);
	assert.equal(patched.getElement("a")?.x, 40);
	assert.equal(patched.getElement("b"), previousB);
});

test("Y.js scene patches include top-level deletes", () => {
	const ydoc = new Y.Doc();
	const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
	yElements.set("a", objectToYMap(element("a", 0)));
	const scene = CanvasScene.from(readCanvasElementsFromYDoc(ydoc));
	let ids = new Set<string>();
	yElements.observeDeep((events) => {
		ids = collectChangedCanvasElementIds(events);
	});

	yElements.delete("a");
	const patched = patchCanvasSceneFromYDoc(scene, ydoc, ids);

	assert.deepEqual([...ids], ["a"]);
	assert.equal(patched.getElement("a"), null);
});
