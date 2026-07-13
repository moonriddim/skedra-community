import assert from "node:assert/strict";
import { test } from "node:test";
import {
	applyCanvasElementUpdates,
	applyCanvasMutationPlan,
	buildCanvasDrawingElement,
	collectCanvasSelectionRectIds,
	executeCanvasMutationPlan,
	getCanvasKeyboardCommand,
	planCanvasDeletion,
	planMindmapChildMutation,
	planMindmapSiblingMutation,
	shouldKeepCanvasDrawing,
	toCanvasElementMap,
	translateCanvasElements,
} from "./editor-operations";
import { createKanbanListElements } from "./element-factory";
import { createMindmapEdge, createMindmapNode } from "./mindmap";
import type { CanvasElement } from "./types";

function idFactory(prefix = "id") {
	let index = 0;
	return () => `${prefix}-${index++}`;
}

function applyThroughAdapter(
	elements: CanvasElement[],
	plan: NonNullable<ReturnType<typeof planMindmapChildMutation>>,
) {
	let current = [...elements];
	executeCanvasMutationPlan(plan, {
		deleteElements: (ids) => {
			const deleted = new Set(ids);
			current = current.filter((element) => !deleted.has(element.id));
		},
		updateElements: (updates) => {
			current = applyCanvasElementUpdates(current, updates);
		},
		createElement: (element) => {
			current.push(element);
		},
	});
	return current;
}

test("mutation plans produce identical local and adapter-backed state", () => {
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
	const plan = planMindmapChildMutation({
		parentId: root.id,
		elements: toCanvasElementMap([root]),
		createId: idFactory("mindmap"),
		text: "Child",
		startEditing: false,
	});
	assert.ok(plan);
	assert.deepEqual(
		applyThroughAdapter([root], plan),
		applyCanvasMutationPlan([root], plan),
	);
});

test("child and sibling planners share selection and editing semantics", () => {
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
	const childPlan = planMindmapChildMutation({
		parentId: root.id,
		elements: toCanvasElementMap([root]),
		createId: idFactory("child"),
		text: "Child",
	});
	assert.ok(childPlan);
	const withChild = applyCanvasMutationPlan([root], childPlan);
	const child = childPlan.create.find(
		(element) => element.customData?.skedraType === "mindmap-node",
	);
	assert.ok(child);
	assert.equal(childPlan.editingTextId, child.id);

	const siblingPlan = planMindmapSiblingMutation({
		nodeId: child.id,
		elements: toCanvasElementMap(withChild),
		createId: idFactory("sibling"),
		text: "Sibling",
		position: "after",
		startEditing: false,
	});
	assert.ok(siblingPlan);
	assert.equal(siblingPlan.create.length, 2);
	assert.equal(siblingPlan.editingTextId, null);
});

test("deletion cascades through mindmaps and kanban lists", () => {
	const defaults = { createId: idFactory("kanban"), stroke: "#111" };
	const kanban = createKanbanListElements(defaults, {
		x: 0,
		y: 0,
		name: "Todo",
		cardTitles: ["One"],
	});
	const root = createMindmapNode({
		id: "root",
		x: 500,
		y: 0,
		text: "Root",
		treeId: "tree",
		parentId: null,
		direction: "right",
		depth: 0,
	});
	const child = createMindmapNode({
		id: "child",
		x: 800,
		y: 0,
		text: "Child",
		treeId: "tree",
		parentId: root.id,
		direction: "right",
		depth: 1,
	});
	const edge = createMindmapEdge({
		id: "edge",
		treeId: "tree",
		source: root,
		target: child,
		stroke: "#111",
	});
	const elements = [...kanban, root, child, edge];
	const plan = planCanvasDeletion(toCanvasElementMap(elements), [
		kanban[0].id,
		root.id,
	]);
	assert.deepEqual(
		new Set(plan.deleteIds),
		new Set(elements.map((element) => element.id)),
	);
});

test("drawing, selection, movement, and keyboard commands use one contract", () => {
	const drawing = buildCanvasDrawingElement({
		id: "shape",
		tool: "rectangle",
		start: { x: 100, y: 80 },
		end: { x: 10, y: 20 },
		style: { stroke: "#111", fill: "#fff" },
	});
	assert.deepEqual(
		{
			x: drawing.x,
			y: drawing.y,
			width: drawing.width,
			height: drawing.height,
		},
		{ x: 10, y: 20, width: 90, height: 60 },
	);
	assert.equal(shouldKeepCanvasDrawing(drawing), true);
	assert.deepEqual(
		collectCanvasSelectionRectIds(
			[drawing],
			{ x: 0, y: 0 },
			{ x: 110, y: 100 },
		),
		new Set([drawing.id]),
	);
	assert.equal(
		translateCanvasElements([drawing], new Set([drawing.id]), 5, -5)[0].x,
		15,
	);
	assert.equal(
		getCanvasKeyboardCommand({
			key: "Delete",
			ctrlKey: false,
			metaKey: false,
			shiftKey: false,
			altKey: false,
		}),
		"delete-selection",
	);
});
