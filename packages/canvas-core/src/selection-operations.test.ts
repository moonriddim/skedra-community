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
	buildCanvasElementFormatUpdates,
	cloneCanvasSelection,
	cloneTransformedCanvasSelection,
	getCanvasElementFormat,
	getCanvasPasteOffset,
	getFlipUpdates,
	getGroupUpdates,
	getLockUpdates,
	getRotateUpdates,
} from "./selection-operations";
import {
	createVisualSequenceDiagramElements,
	getSequenceDiagramId,
} from "./sequence-diagram";

function rectangle(id: string, x: number, width = 20) {
	return createBaseCanvasElement(
		{ createId: () => id, stroke: "#111" },
		{ type: "rectangle", x, y: 0, width, height: 20 },
	);
}

test("centers pasted selections at the requested canvas point", () => {
	const elements = [rectangle("a", 10, 20), rectangle("b", 70, 40)];

	assert.deepEqual(getCanvasPasteOffset(elements, { x: 300, y: 200 }), {
		x: 240,
		y: 190,
	});
	assert.deepEqual(getCanvasPasteOffset(elements), { x: 20, y: 20 });
});

test("format clipboard behavior stays shared across editor hosts", () => {
	const source = {
		...rectangle("source", 0),
		cornerRadiusPercent: 35,
		fontSize: 24,
		fontFamily: "Inter",
	};
	const cloud = {
		...rectangle("cloud", 40),
		type: "cloud" as const,
		points: [
			[4, 4],
			[16, 16],
		] as [number, number][],
		cloudArcRadius: 8,
		fontSize: 16,
		fontFamily: "Arial",
	};
	const format = getCanvasElementFormat(source);
	const [update] = buildCanvasElementFormatUpdates([cloud], {
		...format,
		cloudArcRadius: 28,
	});

	assert.equal(update.id, "cloud");
	assert.equal(update.changes.stroke, source.stroke);
	assert.equal(update.changes.cloudArcRadius, 28);
	assert.equal(update.changes.fontSize, 24);
	assert.equal(update.changes.fontFamily, "Inter");
	assert.notEqual(update.changes.x, cloud.x);
});

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
		getFlipUpdates(elements, "horizontal").map((update) => update.changes),
		[
			{ x: 30, flipX: true, rotation: 0 },
			{ x: 0, flipX: true, rotation: 0 },
		],
	);
	assert.deepEqual(
		getFlipUpdates([{ ...elements[0], rotation: 30 }], "horizontal"),
		[
			{
				id: "a",
				changes: { x: 0, flipX: true, rotation: 330 },
			},
		],
	);
	assert.deepEqual(
		getLockUpdates(elements).map((update) => update.changes.locked),
		[true, true],
	);
});

test("rotation keeps a single center fixed and rotates a selection around its base", () => {
	const first = rectangle("a", 0);
	const second = rectangle("b", 40);
	assert.deepEqual(getRotateUpdates([first], 90)[0].changes, {
		x: 0,
		y: 0,
		rotation: 90,
	});
	const updates = getRotateUpdates([first, second], 90, { x: 30, y: 10 });
	assert.deepEqual(
		updates.map((update) => update.changes),
		[
			{ x: 20, y: -20, rotation: 90 },
			{ x: 20, y: 20, rotation: 90 },
		],
	);
});

test("mirroring can use an explicit origin instead of the selection center", () => {
	const element = rectangle("a", 20);
	assert.deepEqual(
		getFlipUpdates([element], "horizontal", { x: 0, y: 0 })[0].changes,
		{ x: -40, flipX: true, rotation: 0 },
	);
	assert.deepEqual(
		getFlipUpdates([element], "vertical", { x: 0, y: 40 })[0].changes,
		{ y: 60, flipY: true, rotation: 0 },
	);
});

test("transformed cloning preserves source locks and uses the shared origin", () => {
	let next = 0;
	const source = { ...rectangle("source", 20), locked: true };
	const mirrored = cloneTransformedCanvasSelection({
		elements: [source],
		existingElements: [source],
		createId: () => `clone-${next++}`,
		transform: { type: "flip", axis: "horizontal" },
		origin: { x: 0, y: 0 },
	});
	assert.equal(mirrored.elements[0].x, -40);
	assert.equal(mirrored.elements[0].flipX, true);
	assert.equal(mirrored.elements[0].locked, true);

	const rotated = cloneTransformedCanvasSelection({
		elements: [source],
		createId: () => `clone-${next++}`,
		transform: { type: "rotate", angle: 90 },
	});
	assert.equal(rotated.elements[0].rotation, 90);
});

test("mirrored copies are placed adjacent to the source selection", () => {
	let next = 0;
	const source = rectangle("source", 20);
	const horizontal = cloneTransformedCanvasSelection({
		elements: [source],
		existingElements: [source],
		createId: () => `horizontal-${next++}`,
		transform: { type: "flip", axis: "horizontal" },
	});
	assert.equal(horizontal.elements[0].x, source.x + source.width);
	assert.equal(horizontal.elements[0].y, source.y);
	assert.equal(horizontal.elements[0].flipX, true);

	const vertical = cloneTransformedCanvasSelection({
		elements: [source],
		existingElements: [source],
		createId: () => `vertical-${next++}`,
		transform: { type: "flip", axis: "vertical" },
	});
	assert.equal(vertical.elements[0].x, source.x);
	assert.equal(vertical.elements[0].y, source.y + source.height);
	assert.equal(vertical.elements[0].flipY, true);

	const multi = [rectangle("left", 0), rectangle("right", 30)];
	const grouped = cloneTransformedCanvasSelection({
		elements: multi,
		existingElements: multi,
		createId: () => `group-${next++}`,
		transform: { type: "flip", axis: "horizontal" },
	});
	assert.deepEqual(
		grouped.elements.map((element) => element.x),
		[80, 50],
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

test("clipboard cloning gives a sequence diagram its own logical identity", () => {
	let sourceId = 0;
	const source = createVisualSequenceDiagramElements({
		preset: "blank",
		x: 300,
		y: 200,
		defaults: {
			createId: () => `sequence-source-${sourceId++}`,
			stroke: "#111",
		},
	});
	const sourceDiagramId = getSequenceDiagramId(source[0]);
	assert.ok(sourceDiagramId);
	let cloneId = 0;
	const cloned = cloneCanvasSelection({
		elements: source,
		createId: () => `sequence-clone-${cloneId++}`,
	});
	const clonedDiagramIds = new Set(cloned.elements.map(getSequenceDiagramId));

	assert.equal(clonedDiagramIds.size, 1);
	assert.notEqual([...clonedDiagramIds][0], sourceDiagramId);
});
