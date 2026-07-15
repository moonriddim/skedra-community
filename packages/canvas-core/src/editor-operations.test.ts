import assert from "node:assert/strict";
import { test } from "node:test";
import {
	type CanvasMutationPlan,
	applyCanvasElementUpdates,
	applyCanvasMutationPlan,
	buildCanvasDrawingElement,
	buildCanvasMoveUpdates,
	buildCanvasTextUpdate,
	collectCanvasSelectionRectIds,
	executeCanvasMutationPlan,
	getCanvasKeyboardCommand,
	getCanvasKeyboardResizeChanges,
	planCanvasDeletion,
	planFlowchartStepMutation,
	planKanbanCardInsertion,
	planMindmapChildMutation,
	planMindmapSiblingMutation,
	shouldKeepCanvasDrawing,
	toCanvasElementMap,
	translateCanvasElements,
} from "./editor-operations";
import {
	createBaseCanvasElement,
	createKanbanCardElement,
	createKanbanListElements,
} from "./element-factory";
import { createFlowchartNode, getFlowchartConnectorMeta } from "./flowchart";
import { createMindmapEdge, createMindmapNode } from "./mindmap";
import type { CanvasElement } from "./types";

function idFactory(prefix = "id") {
	let index = 0;
	return () => `${prefix}-${index++}`;
}

function applyThroughAdapter(
	elements: CanvasElement[],
	plan: CanvasMutationPlan,
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

test("inline text edits on plain frames rename the frame label", () => {
	const frame = createBaseCanvasElement(
		{ createId: idFactory("frame"), stroke: "#111111" },
		{ type: "frame", x: 0, y: 0, width: 400, height: 300 },
	);

	/* Einfacher Frame: Text-Commit aktualisiert das Label, nicht el.text */
	assert.deepEqual(buildCanvasTextUpdate({ element: frame, text: "Login" }), {
		frameLabel: "Login",
	});

	const wireframeScreen = {
		...frame,
		customData: { skedraType: "wireframe-screen" },
	} as CanvasElement;
	assert.deepEqual(
		buildCanvasTextUpdate({ element: wireframeScreen, text: "Checkout" }),
		{ frameLabel: "Checkout" },
	);

	/* Kanban-Listen behalten ihr bestehendes Label-Verhalten */
	const kanbanList = {
		...frame,
		customData: { skedraType: "kanban-list" },
	} as CanvasElement;
	assert.deepEqual(
		buildCanvasTextUpdate({ element: kanbanList, text: "Backlog" }),
		{ frameLabel: "Backlog" },
	);

	/* Template-Sektionen bearbeiten weiterhin die Beschreibung (el.text) */
	const templateSection = {
		...frame,
		customData: { skedraType: "template-section" },
	} as CanvasElement;
	const update = buildCanvasTextUpdate({
		element: templateSection,
		text: "Notes",
	});
	assert.equal(update.text, "Notes");
	assert.equal(update.frameLabel, undefined);
});

test("multiple updates for one element are merged in mutation order", () => {
	const element = createBaseCanvasElement(
		{ createId: () => "shape", stroke: "#111" },
		{ type: "rectangle", x: 10, y: 20, width: 77, height: 55 },
	);
	const plan: CanvasMutationPlan = {
		create: [],
		update: [
			{ id: element.id, changes: { width: 160, height: 124 } },
			{ id: element.id, changes: { x: 80, y: 90 } },
		],
		deleteIds: [],
	};
	const expected = applyThroughAdapter([element], plan);

	assert.deepEqual(applyCanvasMutationPlan([element], plan), expected);
	assert.deepEqual(
		expected.map(({ x, y, width, height }) => ({ x, y, width, height })),
		[{ x: 80, y: 90, width: 160, height: 124 }],
	);
});

test("kanban insertion updates the newly-created card inside its target list", () => {
	const defaults = { createId: idFactory("kanban"), stroke: "#111" };
	const elements = createKanbanListElements(defaults, {
		x: 100,
		y: 100,
		name: "Todo",
		cardTitles: ["Existing"],
	});
	const list = elements[0];
	const card = createKanbanCardElement(defaults, {
		x: list.x,
		y: list.y + list.height + 1_000,
		title: "New card",
	});
	const plan = planKanbanCardInsertion({
		elements: toCanvasElementMap(elements),
		listId: list.id,
		card,
	});
	assert.ok(plan);

	const local = applyCanvasMutationPlan(elements, plan);
	const adapterBacked = applyThroughAdapter(elements, plan);
	const inserted = local.find((element) => element.id === card.id);
	assert.ok(inserted);
	assert.equal(inserted.frameId, list.id);
	assert.ok(inserted.y >= list.y && inserted.y < list.y + list.height);
	assert.deepEqual(adapterBacked, local);
});

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

test("shared movement expands frame children and mindmap descendants", () => {
	const frame = createBaseCanvasElement(
		{ createId: () => "frame", stroke: "#111" },
		{ type: "frame", x: 10, y: 20, width: 300, height: 200 },
	);
	const frameChild = createBaseCanvasElement(
		{ createId: () => "frame-child", stroke: "#111" },
		{
			type: "rectangle",
			x: 40,
			y: 60,
			width: 80,
			height: 50,
			frameId: frame.id,
		},
	);
	const lockedFrameChild = createBaseCanvasElement(
		{ createId: () => "locked-frame-child", stroke: "#111" },
		{
			type: "rectangle",
			x: 140,
			y: 60,
			width: 80,
			height: 50,
			frameId: frame.id,
			locked: true,
		},
	);
	const root = createMindmapNode({
		id: "move-root",
		x: 500,
		y: 100,
		text: "Root",
		treeId: "move-tree",
		parentId: null,
		direction: "right",
		depth: 0,
	});
	const child = createMindmapNode({
		id: "move-child",
		x: 800,
		y: 100,
		text: "Child",
		treeId: "move-tree",
		parentId: root.id,
		direction: "right",
		depth: 1,
	});
	const edge = createMindmapEdge({
		id: "move-edge",
		treeId: "move-tree",
		source: root,
		target: child,
		stroke: "#111",
	});
	const elements = [frame, frameChild, lockedFrameChild, root, child, edge];
	const moveStart = new Map([
		[frame.id, { x: frame.x, y: frame.y }],
		[root.id, { x: root.x, y: root.y }],
	]);

	const updates = buildCanvasMoveUpdates(
		toCanvasElementMap(elements),
		moveStart,
		25,
		-15,
	);
	const moved = toCanvasElementMap(
		applyCanvasElementUpdates(elements, updates),
	);

	assert.equal(moveStart.has(frameChild.id), true);
	assert.equal(moveStart.has(lockedFrameChild.id), false);
	assert.equal(moveStart.has(child.id), true);
	assert.deepEqual(
		{ x: moved.get(frameChild.id)?.x, y: moved.get(frameChild.id)?.y },
		{ x: frameChild.x + 25, y: frameChild.y - 15 },
	);
	assert.deepEqual(
		{ x: moved.get(child.id)?.x, y: moved.get(child.id)?.y },
		{ x: child.x + 25, y: child.y - 15 },
	);
	assert.deepEqual(
		{
			x: moved.get(lockedFrameChild.id)?.x,
			y: moved.get(lockedFrameChild.id)?.y,
		},
		{ x: lockedFrameChild.x, y: lockedFrameChild.y },
	);
	assert.ok(updates.some((update) => update.id === edge.id));
});

test("keyboard resize rejects locked elements", () => {
	const element = createBaseCanvasElement(
		{ createId: () => "locked", stroke: "#111" },
		{ type: "rectangle", locked: true },
	);
	assert.equal(
		getCanvasKeyboardResizeChanges({
			element,
			handle: "se",
			key: "ArrowRight",
		}),
		null,
	);
	assert.deepEqual(
		getCanvasKeyboardResizeChanges({
			element: { ...element, locked: false },
			handle: "se",
			key: "ArrowRight",
		}),
		{ x: 0, y: 0, width: 101, height: 100 },
	);
});

test("flowchart planner and deletion use the shared mutation contract", () => {
	const root = createFlowchartNode({
		id: "flow-root",
		x: 10,
		y: 20,
		width: 160,
		height: 56,
		type: "ellipse",
		text: "Start",
		flowchartId: "flow",
		nodeKind: "start",
		stroke: "#111",
	});
	const plan = planFlowchartStepMutation({
		elements: toCanvasElementMap([root]),
		nodeId: root.id,
		createId: idFactory("flow"),
		branch: "yes",
		label: "Approved",
		startEditing: false,
	});
	assert.ok(plan);
	assert.equal(plan.create.length, 2);
	const connector = plan.create.find((element) =>
		getFlowchartConnectorMeta(element),
	);
	assert.ok(connector);

	const withStep = applyCanvasMutationPlan([root], plan);
	const deletion = planCanvasDeletion(toCanvasElementMap(withStep), [root.id]);
	assert.ok(deletion.deleteIds.includes(root.id));
	assert.ok(deletion.deleteIds.includes(connector.id));
});
