import assert from "node:assert/strict";
import test from "node:test";
import {
	type CanvasElement,
	CanvasScene,
	createBaseCanvasElement,
	createGanttChartElements,
	createVisualSequenceDiagramElements,
} from "@skedra/canvas-core";
import {
	buildCanvasEditorDefaultsElement,
	buildCanvasEditorEditingSession,
	canvasEditorToolSupportsSnapOverride,
	expandCanvasEditorAtomicSelectionIds,
	getCanvasEditorContextSelectionIds,
	getCanvasEditorSnapModeOptions,
	resolveCanvasEditorContextSelectionIds,
	resolveCanvasEditorMoveGesture,
	resolveCanvasEditorPlacementPoint,
	resolveCanvasEditorPointSnap,
	resolveCanvasEditorSelectPointerDown,
} from "./index";

test("snap overrides share one mode and tool policy", () => {
	assert.equal(canvasEditorToolSupportsSnapOverride("line"), true);
	assert.equal(canvasEditorToolSupportsSnapOverride("select"), false);
	assert.deepEqual(getCanvasEditorSnapModeOptions("intersection"), {
		includeEndpoints: false,
		includeMidpoints: false,
		includeDivisions: false,
		includeCenters: false,
		includeGeometricCenters: false,
		includeQuadrants: false,
		includeIntersections: true,
		includeExtensions: false,
		includeInsertions: false,
		includeNearest: false,
	});
	assert.equal(
		getCanvasEditorSnapModeOptions("division")?.includeDivisions,
		true,
	);
});

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

test("context selection expands groups and complete frame relationships", () => {
	const frame = {
		...rectangle("frame", 0, 0),
		type: "frame" as const,
		width: 420,
		height: 280,
	};
	const first = rectangle("a", 20, 20, { frameId: frame.id });
	const second = rectangle("b", 160, 20, { frameId: frame.id });
	const grouped = rectangle("grouped", 500, 0, { groupId: "group" });
	const groupedPeer = rectangle("grouped-peer", 640, 0, {
		groupId: "group",
	});
	const elements = new Map(
		[frame, first, second, grouped, groupedPeer].map((element) => [
			element.id,
			element,
		]),
	);

	assert.deepEqual(
		[...getCanvasEditorContextSelectionIds(first, elements)].sort(),
		["a", "b", "frame"],
	);
	assert.deepEqual(
		[...getCanvasEditorContextSelectionIds(grouped, elements)].sort(),
		["grouped", "grouped-peer"],
	);
	assert.deepEqual(
		[
			...resolveCanvasEditorContextSelectionIds(
				grouped,
				elements,
				new Set(["a", "b"]),
			),
		].sort(),
		["grouped", "grouped-peer"],
	);
	assert.deepEqual(
		[
			...resolveCanvasEditorContextSelectionIds(
				first,
				elements,
				new Set(["a", "b", "frame"]),
			),
		].sort(),
		["a", "b", "frame"],
	);
});

test("Gantt selection is atomic even from a locked child or partial selection", () => {
	let index = 0;
	const chart = createGanttChartElements(
		{
			createId: () => `gantt-selection-${index++}`,
			stroke: "#111111",
			fontFamily: "Inter",
		},
		{ x: 100, y: 200, startDate: "2026-07-13" },
	);
	const elements = new Map(chart.map((element) => [element.id, element]));
	const lockedHeader = chart.find(
		(element) => element.customData?.ganttRole === "task-header",
	);
	assert.ok(lockedHeader?.locked);

	assert.equal(
		expandCanvasEditorAtomicSelectionIds(new Set([lockedHeader.id]), elements)
			.size,
		chart.length,
	);

	let selected = new Set<string>([lockedHeader.id]);
	const result = resolveCanvasEditorSelectPointerDown({
		e: { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
		tool: "select",
		canvas: { x: lockedHeader.x + 5, y: lockedHeader.y + 5 },
		elements,
		scene: CanvasScene.from(chart),
		selectedIds: selected,
		getSelectedIds: () => selected,
		updateElement: () => undefined,
		setSelectedIds: (ids) => {
			selected = ids;
		},
		setSelectionBox: () => undefined,
		setLassoPath: () => undefined,
	});

	assert.equal("action" in result ? result.action : null, "move");
	assert.equal(selected.size, chart.length);
	assert.equal(
		"patch" in result ? result.patch.moveStart?.size : 0,
		chart.length,
	);
});

test("the Gantt canvas scrollbar stays outside normal element selection", () => {
	let index = 0;
	const chart = createGanttChartElements(
		{
			createId: () => `gantt-scroll-${index++}`,
			stroke: "#111111",
			fontFamily: "Inter",
		},
		{ x: 100, y: 200, startDate: "2026-01-01", dayCount: 120 },
	);
	const elements = new Map(chart.map((element) => [element.id, element]));
	const thumb = chart.find(
		(element) => element.customData?.ganttRole === "canvas-scroll-thumb",
	);
	const header = chart.find(
		(element) => element.customData?.ganttRole === "task-header",
	);
	assert.ok(thumb);
	assert.ok(header);
	assert.equal(
		expandCanvasEditorAtomicSelectionIds(new Set([header.id]), elements).size,
		chart.length,
	);
	assert.equal(thumb.locked, true);
	assert.notEqual(
		CanvasScene.from(chart).getElementAtPosition(
			thumb.x + thumb.width / 2,
			thumb.y + thumb.height / 2,
		)?.id,
		thumb.id,
	);
});

test("sequence diagram selection moves every generated part as one object", () => {
	let index = 0;
	const diagram = createVisualSequenceDiagramElements({
		preset: "checkout",
		x: 500,
		y: 350,
		defaults: {
			createId: () => `sequence-selection-${index++}`,
			stroke: "#111111",
			fontFamily: "Inter",
		},
	});
	const elements = new Map(diagram.map((element) => [element.id, element]));
	const message = diagram.find(
		(element) => element.customData?.sequenceRole === "message",
	);
	assert.ok(message);
	assert.equal(
		expandCanvasEditorAtomicSelectionIds(new Set([message.id]), elements).size,
		diagram.length,
	);

	let selected = new Set<string>();
	const result = resolveCanvasEditorSelectPointerDown({
		e: { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
		tool: "select",
		canvas: { x: message.x + 2, y: message.y + 2 },
		elements,
		scene: CanvasScene.from(diagram),
		selectedIds: selected,
		getSelectedIds: () => selected,
		updateElement: () => undefined,
		setSelectedIds: (ids) => {
			selected = ids;
		},
		setSelectionBox: () => undefined,
		setLassoPath: () => undefined,
	});

	assert.equal("action" in result ? result.action : null, "move");
	assert.equal(selected.size, diagram.length);
	assert.equal(
		"patch" in result ? result.patch.moveStart?.size : 0,
		diagram.length,
	);
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
	assert.deepEqual(resolveCanvasEditorPlacementPoint(point, { x: 80, y: 80 }), {
		x: 100,
		y: 100,
	});
	assert.deepEqual(
		resolveCanvasEditorPlacementPoint(
			{ point: { x: 73, y: 74 }, anchor: null },
			{ x: 80, y: 80 },
		),
		{ x: 80, y: 80 },
	);

	const move = resolveCanvasEditorMoveGesture({
		elements,
		moveStart: new Map([[moving.id, { x: moving.x, y: moving.y }]]),
		selectedIds: new Set([moving.id]),
		start: { x: 0, y: 0 },
		current: { x: 96, y: 0 },
		snapToObjects: true,
	});
	assert.equal(move.updates[0]?.changes.x, 100);

	const exactBasePointMove = resolveCanvasEditorMoveGesture({
		elements,
		moveStart: new Map([[moving.id, { x: moving.x, y: moving.y }]]),
		selectedIds: new Set([moving.id]),
		start: { x: 0, y: 0 },
		current: { x: 96, y: 0 },
		snapToObjects: true,
		anchorSnapped: true,
	});
	assert.equal(exactBasePointMove.updates[0]?.changes.x, 96);
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

test("small wireframe text editors reuse the rendered text bounds", () => {
	const compactButton = rectangle("button", 10, 20, {
		width: 74,
		height: 28,
		fontSize: 14,
		text: "MARKE",
		textAlign: "center",
		customData: { skedraType: "wireframe-node" },
	});
	const buttonEditor = buildCanvasEditorEditingSession({
		element: compactButton,
	}).editingText;
	assert.equal(buttonEditor.variant, "shape");
	assert.equal(buttonEditor.paddingX, 5.92);
	assert.ok(Math.abs((buttonEditor.paddingY ?? 0) - 6.3) < 0.0001);
	assert.equal(buttonEditor.lineHeight, 1.1);
	assert.equal(buttonEditor.width, compactButton.width);
	assert.equal(buttonEditor.height, compactButton.height);

	const compactLabel = createBaseCanvasElement(
		{ createId: () => "label", stroke: "#111111" },
		{
			id: "label",
			type: "text",
			x: 40,
			y: 80,
			width: 60,
			height: 8,
			fontSize: 14,
			text: "Preise",
			customData: { skedraType: "wireframe-node" },
		},
	);
	const labelEditor = buildCanvasEditorEditingSession({
		element: compactLabel,
	}).editingText;
	assert.equal(labelEditor.variant, "canvas-text");
	assert.equal(labelEditor.lineHeight, 1);
	assert.equal(labelEditor.paddingX, 4);
	assert.equal(labelEditor.paddingY, 0);
	assert.equal(labelEditor.preserveBounds, true);
	assert.equal(labelEditor.sourceWidth, compactLabel.width);
	assert.equal(labelEditor.sourceHeight, compactLabel.height);
	assert.equal(labelEditor.height, 20);
	assert.equal(labelEditor.y, 74);
});

test("plain frame editing session targets the label above the frame", () => {
	const frame = createBaseCanvasElement(
		{ createId: () => "frame", stroke: "#111111" },
		{
			id: "frame",
			type: "frame",
			x: 40,
			y: 80,
			width: 400,
			height: 300,
			frameLabel: "Login Screen",
		},
	);
	const session = buildCanvasEditorEditingSession({ element: frame });
	assert.equal(session.editingText.variant, "frame-label");
	assert.equal(session.editingText.text, "Login Screen");
	/* Editor sitzt oberhalb der Frame-Kante am Label, nicht auf der Flaeche */
	assert.ok(session.editingText.y < frame.y);

	const wireframeScreen = {
		...frame,
		id: "wireframe",
		customData: { skedraType: "wireframe-screen" },
		frameLabel: "Desktop · Login",
	} as CanvasElement;
	const wireframeSession = buildCanvasEditorEditingSession({
		element: wireframeScreen,
	});
	assert.equal(wireframeSession.editingText.variant, "frame-label");
	assert.equal(wireframeSession.editingText.text, "Desktop · Login");
	assert.ok(wireframeSession.editingText.y < wireframeScreen.y);

	/* Kanban-Listen behalten ihre eigene Label-Session (im Frame-Kopf) */
	const kanbanList = {
		...frame,
		id: "list",
		customData: { skedraType: "kanban-list" },
		frameLabel: "Backlog",
	} as CanvasElement;
	const listSession = buildCanvasEditorEditingSession({ element: kanbanList });
	assert.equal(listSession.editingText.variant, "frame-label");
	assert.equal(listSession.editingText.y, kanbanList.y);
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
