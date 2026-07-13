import assert from "node:assert/strict";
import { test } from "node:test";
import {
	MINDMAP_HORIZONTAL_GAP,
	MINDMAP_NODE_WIDTH,
	createMindmapNode,
	planMindmapChildInsertion,
	planMindmapSiblingInsertion,
} from "./mindmap";
import type { CanvasElement } from "./types";

function toMap(elements: CanvasElement[]) {
	return new Map(elements.map((element) => [element.id, element]));
}

test("child insertion balances root branches and uses the shared spacing", () => {
	const root = createMindmapNode({
		id: "root",
		x: 100,
		y: 100,
		text: "Root",
		treeId: "tree",
		parentId: null,
		direction: "right",
		depth: 0,
	});
	const right = createMindmapNode({
		id: "right",
		x: root.x + root.width + MINDMAP_HORIZONTAL_GAP,
		y: 100,
		text: "Right",
		treeId: "tree",
		parentId: root.id,
		direction: "right",
		depth: 1,
	});
	const plan = planMindmapChildInsertion({
		parent: root,
		elements: toMap([root, right]),
	});

	assert.ok(plan);
	assert.equal(plan.direction, "left");
	assert.equal(plan.x, root.x - MINDMAP_HORIZONTAL_GAP - MINDMAP_NODE_WIDTH);
	assert.deepEqual(plan.shifts, []);
});

test("before insertion shifts all existing child subtrees", () => {
	const root = createMindmapNode({
		id: "root",
		x: 0,
		y: 0,
		text: "Root",
		treeId: "tree",
		parentId: null,
		direction: "right",
		depth: 0,
	});
	const child = createMindmapNode({
		id: "child",
		x: 380,
		y: -20,
		text: "Child",
		treeId: "tree",
		parentId: root.id,
		direction: "right",
		depth: 1,
	});
	const grandchild = createMindmapNode({
		id: "grandchild",
		x: 720,
		y: -20,
		text: "Grandchild",
		treeId: "tree",
		parentId: child.id,
		direction: "right",
		depth: 2,
	});
	const plan = planMindmapChildInsertion({
		parent: root,
		elements: toMap([root, child, grandchild]),
		direction: "right",
		position: "before",
	});

	assert.ok(plan);
	assert.equal(plan.y, child.y);
	assert.deepEqual(plan.shifts.map((shift) => shift.id).sort(), [
		"child",
		"grandchild",
	]);
});

test("sibling insertion starts after the complete anchor subtree", () => {
	const root = createMindmapNode({
		id: "root",
		x: 0,
		y: 0,
		text: "Root",
		treeId: "tree",
		parentId: null,
		direction: "right",
		depth: 0,
	});
	const child = createMindmapNode({
		id: "child",
		x: 380,
		y: 0,
		text: "Child",
		treeId: "tree",
		parentId: root.id,
		direction: "right",
		depth: 1,
	});
	const grandchild = createMindmapNode({
		id: "grandchild",
		x: 720,
		y: 160,
		text: "Grandchild",
		treeId: "tree",
		parentId: child.id,
		direction: "right",
		depth: 2,
	});
	const plan = planMindmapSiblingInsertion({
		node: child,
		elements: toMap([root, child, grandchild]),
	});

	assert.ok(plan);
	assert.equal(plan.y, grandchild.y + grandchild.height + 32);
	assert.equal(plan.x, child.x);
});
