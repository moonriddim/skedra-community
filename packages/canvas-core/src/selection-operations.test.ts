import assert from "node:assert/strict";
import { test } from "node:test";
import {
	getAlignmentUpdates,
	getCanvasLayoutItemCount,
	getDistributionUpdates,
} from "./align";
import { createBaseCanvasElement } from "./element-factory";
import { createFlowchartConnector, createFlowchartNode } from "./flowchart";
import {
	cloneCanvasSelection,
	getFlipUpdates,
	getGroupUpdates,
	getLockUpdates,
} from "./selection-operations";

function rectangle(id: string, x: number, width = 20) {
	return createBaseCanvasElement(
		{ createId: () => id, stroke: "#111" },
		{ type: "rectangle", x, y: 0, width, height: 20 },
	);
}

test("distribution preserves outer elements and creates equal gaps", () => {
	const elements = [rectangle("a", 0), rectangle("b", 30), rectangle("c", 100)];
	const updates = getDistributionUpdates(elements, "horizontal");
	assert.deepEqual(updates.find((update) => update.id === "a")?.changes, {});
	assert.deepEqual(updates.find((update) => update.id === "b")?.changes, {
		x: 50,
	});
	assert.deepEqual(updates.find((update) => update.id === "c")?.changes, {});
});

test("alignment uses the selection bounds for mixed shapes and text", () => {
	const shape = createBaseCanvasElement(
		{ createId: () => "shape", stroke: "#111" },
		{ type: "rectangle", x: 0, y: 0, width: 20, height: 30 },
	);
	const text = createBaseCanvasElement(
		{ createId: () => "text", stroke: "#111" },
		{ type: "text", x: 100, y: 60, width: 40, height: 20, text: "Label" },
	);

	assert.deepEqual(
		getAlignmentUpdates([shape, text], "horizontal-center").map(
			(update) => update.changes,
		),
		[{ x: 60 }, { x: 50 }],
	);
	assert.deepEqual(
		getAlignmentUpdates([shape, text], "vertical-center").map(
			(update) => update.changes,
		),
		[{ y: 25 }, { y: 30 }],
	);
});

test("alignment and distribution keep grouped elements together", () => {
	const grouped = [
		{ ...rectangle("a", 0), groupId: "group" },
		{ ...rectangle("b", 30), groupId: "group" },
	];
	const middle = rectangle("c", 100);
	const end = rectangle("d", 200);

	assert.equal(getCanvasLayoutItemCount([...grouped, middle, end]), 3);
	assert.deepEqual(
		getAlignmentUpdates([...grouped, end], "right").map(
			(update) => update.changes.x,
		),
		[170, 200, 200],
	);
	assert.deepEqual(
		getDistributionUpdates([...grouped, middle, end], "horizontal").map(
			(update) => update.changes.x,
		),
		[undefined, undefined, 115, undefined],
	);
});

test("selection operations share group, flip and lock semantics", () => {
	const elements = [rectangle("a", 0), rectangle("b", 30)];
	assert.deepEqual(
		getGroupUpdates(elements, "group").map((update) => update.changes.groupId),
		["group", "group"],
	);
	assert.deepEqual(
		getFlipUpdates(elements, "horizontal").map(
			(update) => update.changes.flipX,
		),
		[true, true],
	);
	assert.deepEqual(
		getLockUpdates(elements).map((update) => update.changes.locked),
		[true, true],
	);
});

test("clipboard cloning remaps flowchart element and logical references", () => {
	const source = createFlowchartNode({
		id: "source",
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		type: "rectangle",
		text: "Source",
		flowchartId: "flow",
		nodeKind: "step",
		stroke: "#111",
	});
	const target = createFlowchartNode({
		id: "target",
		x: 200,
		y: 0,
		width: 100,
		height: 50,
		type: "rectangle",
		text: "Target",
		flowchartId: "flow",
		nodeKind: "step",
		stroke: "#111",
	});
	const connector = createFlowchartConnector({
		id: "edge",
		flowchartId: "flow",
		source,
		target,
		route: "right",
	});
	let next = 0;
	const cloned = cloneCanvasSelection({
		elements: [source, target, connector],
		createId: () => `new-${next++}`,
	});
	const clonedEdge = cloned.elements.find(
		(element) => element.type === "arrow",
	);
	assert.ok(clonedEdge);
	assert.equal(
		clonedEdge.customData?.flowchartSourceId,
		cloned.idMap.get(source.id),
	);
	assert.equal(
		clonedEdge.customData?.flowchartTargetId,
		cloned.idMap.get(target.id),
	);
	assert.notEqual(clonedEdge.customData?.flowchartId, "flow");
	assert.equal(
		cloned.elements[0].customData?.flowchartId,
		clonedEdge.customData?.flowchartId,
	);
});
