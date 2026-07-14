import assert from "node:assert/strict";
import test from "node:test";
import {
	type CanvasElement,
	CanvasScene,
	createBaseCanvasElement,
} from "@skedra/canvas-core";
import {
	buildCanvasEditorDefaultsElement,
	buildCanvasEditorEditingSession,
	resolveCanvasEditorMoveGesture,
	resolveCanvasEditorPointSnap,
	resolveCanvasEditorSelectPointerDown,
} from "./index";

function rectangle(
	id: string,
	x: number,
	y: number,
	overrides: Partial<CanvasElement> = {},
): CanvasElement {
	return createBaseCanvasElement(
		{ createId: () => id, stroke: "#111111" },
		{ id, type: "rectangle", x, y, width: 100, height: 80, ...overrides },
	);
}

test("selection routing expands groups through the shared controller", () => {
	const elements = new Map([
		["a", rectangle("a", 0, 0, { groupId: "group" })],
		["b", rectangle("b", 140, 0, { groupId: "group" })],
	]);
	let selected = new Set<string>();
	const result = resolveCanvasEditorSelectPointerDown({
		e: { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
		tool: "select",
		canvas: { x: 20, y: 20 },
		elements,
		scene: CanvasScene.from(elements.values()),
		selectedIds: selected,
		getSelectedIds: () => selected,
		updateElement: () => undefined,
		setSelectedIds: (ids) => {
			selected = ids;
		},
		setSelectionBox: () => undefined,
		setLassoPath: () => undefined,
	});
	assert.equal(result.handled, true);
	assert.deepEqual([...selected].sort(), ["a", "b"]);
});

test("read-only selection never starts a move gesture", () => {
	const element = rectangle("read-only", 0, 0);
	let selected = new Set<string>();
	const result = resolveCanvasEditorSelectPointerDown({
		e: { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
		tool: "select",
		canvas: { x: 20, y: 20 },
		elements: new Map([[element.id, element]]),
		scene: CanvasScene.from([element]),
		selectedIds: selected,
		getSelectedIds: () => selected,
		readOnly: true,
		updateElement: () => assert.fail("read-only selection mutated an element"),
		setSelectedIds: (ids) => {
			selected = ids;
		},
		setSelectionBox: () => undefined,
		setLassoPath: () => undefined,
	});

	assert.deepEqual(result, { handled: true, earlyExit: true });
	assert.deepEqual([...selected], [element.id]);
});

test("object anchors and move guides use the same snap contract", () => {
	const fixed = rectangle("fixed", 100, 100);
	const moving = rectangle("moving", 0, 100);
	const elements = new Map([
		[fixed.id, fixed],
		[moving.id, moving],
	]);
	const point = resolveCanvasEditorPointSnap({
		point: { x: 102, y: 101 },
		elements,
		excludeIds: new Set([moving.id]),
		snap: { enabled: true, includeCenters: true, includeMidpoints: true },
	});
	assert.deepEqual(point.point, { x: 100, y: 100 });
	assert.equal(point.anchor?.elementId, fixed.id);

	const move = resolveCanvasEditorMoveGesture({
		elements,
		moveStart: new Map([[moving.id, { x: moving.x, y: moving.y }]]),
		selectedIds: new Set([moving.id]),
		start: { x: 0, y: 0 },
		current: { x: 96, y: 0 },
		snapToObjects: true,
	});
	assert.equal(move.updates[0]?.changes.x, 100);
});

test("sticky and arrow inline editing sessions are host independent", () => {
	const sticky = rectangle("sticky", 10, 20, {
		text: "Tasks",
		customData: {
			skedraType: "sticky-note",
			stickyNoteMode: "checklist",
			stickyChecklist: [{ id: "one", text: "Ship", completed: false }],
		},
	});
	const stickySession = buildCanvasEditorEditingSession({ element: sticky });
	assert.equal(stickySession.editingText.variant, "sticky-note");
	assert.equal(stickySession.stickyNoteMode, "checklist");
	assert.equal(stickySession.stickyChecklist?.[0]?.text, "Ship");

	const arrow = createBaseCanvasElement(
		{ createId: () => "arrow", stroke: "#111111" },
		{
			id: "arrow",
			type: "arrow",
			x: 0,
			y: 0,
			width: 100,
			height: 0,
			points: [
				[0, 0],
				[100, 0],
			],
		},
	);
	assert.equal(
		buildCanvasEditorEditingSession({ element: arrow }).editingText.variant,
		"arrow",
	);
});

test("web and sdk properties consume the same drawing defaults element", () => {
	const defaults = buildCanvasEditorDefaultsElement({
		tool: "arrow",
		width: 240,
		height: 80,
		style: {
			stroke: "#123456",
			fill: "transparent",
			strokeWidth: 4,
			arrowMode: "curve",
			arrowHeadEnd: "triangle",
			fontSize: 24,
		},
	});
	assert.ok(defaults);
	assert.equal(defaults.type, "arrow");
	assert.equal(defaults.strokeWidth, 4);
	assert.equal(defaults.arrowMode, "curve");
	assert.equal(defaults.arrowHeadEnd, "triangle");
	assert.deepEqual(defaults.points, [
		[0, 0],
		[100, 0],
	]);
	assert.equal(
		buildCanvasEditorDefaultsElement({
			tool: "select",
			style: { stroke: "#123456" },
		}),
		null,
	);
});
