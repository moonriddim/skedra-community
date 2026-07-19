import assert from "node:assert/strict";
import { test } from "node:test";
import { CanvasScene } from "./scene.js";
import type { CanvasElement } from "./types.js";

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
	};
}

test("scene exposes sorted and selected elements", () => {
	const scene = CanvasScene.from([element("b", 20), element("a", 0)]);

	assert.deepEqual(
		scene.getSortedElements().map((item) => item.id),
		["a", "b"],
	);
	assert.deepEqual(
		scene.getSelectedElements(new Set(["b"])).map((item) => item.id),
		["b"],
	);
});

test("scene hit tests from top to bottom", () => {
	const scene = CanvasScene.from([element("bottom", 0), element("top", 0)]);

	assert.equal(scene.getElementAtPosition(5, 5)?.id, "top");
});

test("scene keeps selected elements visible outside viewport", () => {
	const scene = CanvasScene.from([element("near", 0), element("far", 1000)]);
	const visible = scene.getVisibleElements(
		{ x: -20, y: -20, width: 100, height: 100 },
		new Set(["far"]),
	);

	assert.deepEqual(
		visible.map((item) => item.id),
		["far", "near"],
	);
});

test("scene patches geometry without replacing untouched elements", () => {
	const scene = CanvasScene.from([element("a", 0), element("b", 20)]);
	const previousA = scene.getElement("a");
	const previousB = scene.getElement("b");
	assert.ok(previousA);
	assert.ok(previousB);
	const nextA = { ...previousA, x: 40 };

	const patched = scene.withElementChanges(new Map([["a", nextA]]));

	assert.equal(patched.getElement("a"), nextA);
	assert.equal(patched.getElement("b"), previousB);
	assert.deepEqual(
		patched.getSortedElements().map((item) => item.id),
		["a", "b"],
	);
});

test("scene bounds the exact-viewport visibility cache", () => {
	const scene = CanvasScene.from([element("a", 0)]);
	for (let x = 0; x < 100; x++) {
		scene.getVisibleElements({ x, y: 0, width: 100, height: 100 }, new Set());
	}
	const cache = (
		scene as unknown as {
			visibleElementsCache: Map<string, CanvasElement[]>;
		}
	).visibleElementsCache;
	assert.equal(cache.size, 32);
});

test("scene exposes cached rect, lasso and eraser selections", () => {
	const scene = CanvasScene.from([
		element("outside", 200),
		element("inside", 10),
		element("locked", 20),
	]);
	const locked = scene.getElement("locked");
	assert.ok(locked);
	const lockedScene = CanvasScene.from([
		element("inside", 10),
		{ ...locked, locked: true },
	]);

	assert.deepEqual(
		scene
			.getElementsInRect({ startX: 0, startY: 0, endX: 40, endY: 40 })
			.map((item) => item.id),
		["inside", "locked"],
	);
	assert.deepEqual(
		scene
			.getElementsInLassoPath([
				[0, 0],
				[50, 0],
				[50, 50],
				[0, 50],
			])
			.map((item) => item.id),
		["inside", "locked"],
	);
	assert.deepEqual(
		lockedScene
			.getElementsToEraseAtPosition(25, 5, 20, new Set())
			.map((item) => item.id),
		["inside"],
	);
});

test("scene caches kanban and mindmap derived order", () => {
	const listA = {
		...element("list-a", 0),
		width: 100,
		height: 200,
		customData: { skedraType: "kanban-list" },
	};
	const listB = {
		...element("list-b", 0),
		width: 100,
		height: 200,
		customData: { skedraType: "kanban-list" },
	};
	const cardLow = {
		...element("card-low", 20),
		y: 80,
		frameId: "list-b",
		customData: { skedraType: "kanban-card" },
	};
	const cardHigh = {
		...element("card-high", 20),
		y: 40,
		frameId: "list-b",
		customData: { skedraType: "kanban-card" },
	};
	const mindmapChildA = {
		...element("mindmap-a", 0),
		y: 100,
		customData: {
			skedraType: "mindmap-node",
			mindmapTreeId: "tree",
			mindmapParentId: "root",
			mindmapDirection: "right",
			mindmapDepth: 1,
		},
	};
	const mindmapChildB = {
		...element("mindmap-b", 0),
		y: 60,
		customData: {
			skedraType: "mindmap-node",
			mindmapTreeId: "tree",
			mindmapParentId: "root",
			mindmapDirection: "right",
			mindmapDepth: 1,
		},
	};

	const scene = CanvasScene.from([
		listA,
		listB,
		cardLow,
		cardHigh,
		mindmapChildA,
		mindmapChildB,
	]);

	assert.equal(scene.getKanbanListAtPosition(5, 5)?.id, "list-b");
	assert.deepEqual(
		scene.getKanbanCardsForList("list-b").map((item) => item.id),
		["card-high", "card-low"],
	);
	assert.deepEqual(
		scene.getMindmapChildNodes("root", "right").map((item) => item.id),
		["mindmap-b", "mindmap-a"],
	);
});
