import assert from "node:assert/strict";
import { test } from "node:test";
import {
	type CanvasElement,
	addGanttTask,
	buildCanvasMoveUpdates,
	buildGanttChartMutationPlan,
	createGanttChartElements,
	createVisualSequenceDiagramElements,
	getGanttChartDocument,
	getSequenceDiagramSummaries,
	planSequenceDiagramMessageInsertion,
	resizeGanttChartDocument,
	squashCanvasHistoryEntries,
} from "@skedra/canvas-core";
import * as Y from "yjs";
import {
	applyCanvasHistoryEntryToYDoc,
	drainCanvasHistoryEntries,
	rollbackCanvasHistoryEntries,
} from "./canvas-undo.js";
import {
	yjsApplyCanvasMutationPlan,
	yjsCreateElement,
	yjsDeleteElement,
	yjsDeleteElements,
	yjsUpdateElement,
	yjsUpdateElements,
} from "./yjs-canvas-mutations.js";
import { readCanvasMapsFromYDoc } from "./yjs-document-helpers.js";

function rectangle(): CanvasElement {
	return {
		id: "rectangle",
		type: "rectangle",
		x: 10,
		y: 20,
		width: 120,
		height: 80,
		rotation: 0,
		fill: "#ffffff",
		stroke: "#000000",
		strokeWidth: 2,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
	};
}

test("records local canvas mutations and can undo and redo them", () => {
	const doc = new Y.Doc({ gc: false });

	yjsCreateElement(doc, rectangle());
	const entries = drainCanvasHistoryEntries(doc);

	assert.equal(entries.length, 1);
	assert.equal(readCanvasMapsFromYDoc(doc).elements.has("rectangle"), true);
	assert.equal(applyCanvasHistoryEntryToYDoc(doc, entries[0], "undo"), 1);
	assert.equal(readCanvasMapsFromYDoc(doc).elements.has("rectangle"), false);
	assert.equal(applyCanvasHistoryEntryToYDoc(doc, entries[0], "redo"), 1);
	assert.equal(readCanvasMapsFromYDoc(doc).elements.has("rectangle"), true);
});

test("rolls back in-progress placement and eraser mutations without history", () => {
	const placementDoc = new Y.Doc({ gc: false });
	yjsCreateElement(placementDoc, rectangle());
	const placementEntries = drainCanvasHistoryEntries(placementDoc);
	assert.equal(rollbackCanvasHistoryEntries(placementDoc, placementEntries), 1);
	assert.equal(
		readCanvasMapsFromYDoc(placementDoc).elements.has("rectangle"),
		false,
	);

	const eraserDoc = new Y.Doc({ gc: false });
	yjsCreateElement(eraserDoc, rectangle());
	drainCanvasHistoryEntries(eraserDoc);
	yjsDeleteElement(eraserDoc, "rectangle");
	const eraserEntries = drainCanvasHistoryEntries(eraserDoc);
	assert.equal(rollbackCanvasHistoryEntries(eraserDoc, eraserEntries), 1);
	assert.equal(
		readCanvasMapsFromYDoc(eraserDoc).elements.has("rectangle"),
		true,
	);
});

test("undoes a semantic Gantt resize as one complete history entry", () => {
	const doc = new Y.Doc({ gc: false });
	let id = 0;
	const defaults = {
		createId: () => `gantt-${id++}`,
		stroke: "#111827",
		fontFamily: "Inter",
	};
	const initial = createGanttChartElements(defaults, {
		x: 100,
		y: 80,
		startDate: "2026-07-13",
	});
	for (const element of initial) yjsCreateElement(doc, element);
	const initialStored = Array.from(
		readCanvasMapsFromYDoc(doc).elements.values(),
	);
	drainCanvasHistoryEntries(doc);

	const frame = initial[0];
	assert.ok(frame);
	const rawWidth = frame.width - 254;
	yjsUpdateElement(doc, frame.id, { width: rawWidth });
	const resized = { ...frame, width: rawWidth };
	const virtualElements = new Map(
		initial.map((element) => [element.id, element]),
	);
	virtualElements.set(frame.id, resized);
	const ganttDocument = getGanttChartDocument(
		virtualElements.values(),
		resized,
	);
	assert.ok(ganttDocument);
	const plan = buildGanttChartMutationPlan(
		defaults,
		virtualElements.values(),
		resized,
		resizeGanttChartDocument(ganttDocument, { width: rawWidth }),
	);

	yjsDeleteElements(doc, plan.deleteIds);
	yjsUpdateElements(doc, plan.update);
	for (const element of plan.create) yjsCreateElement(doc, element);
	const historyEntry = squashCanvasHistoryEntries(
		drainCanvasHistoryEntries(doc),
	);
	assert.ok(historyEntry);
	assert.ok(
		(readCanvasMapsFromYDoc(doc).elements.get(frame.id)?.width ?? frame.width) <
			frame.width,
	);

	assert.ok(applyCanvasHistoryEntryToYDoc(doc, historyEntry, "undo") > 0);
	assert.deepEqual(
		Array.from(readCanvasMapsFromYDoc(doc).elements.values()),
		initialStored,
	);
});

test("publishes a Gantt studio rebuild atomically and undoes it in one step", () => {
	const doc = new Y.Doc({ gc: false });
	let id = 0;
	const defaults = {
		createId: () => `gantt-live-${id++}`,
		stroke: "#111827",
		fontFamily: "Inter",
	};
	const initial = createGanttChartElements(defaults, {
		x: 100,
		y: 80,
		startDate: "2026-07-13",
	});
	for (const element of initial) yjsCreateElement(doc, element);
	drainCanvasHistoryEntries(doc);
	const frame = initial[0];
	assert.ok(frame);
	const initialDocument = getGanttChartDocument(initial, frame);
	assert.ok(initialDocument);
	const nextDocument = addGanttTask(initialDocument, "milestone");
	const plan = buildGanttChartMutationPlan(
		defaults,
		initial,
		frame,
		nextDocument,
	);

	let updateCount = 0;
	doc.on("update", () => {
		updateCount += 1;
	});
	const nextElements = yjsApplyCanvasMutationPlan(doc, plan);
	const storedFrame = nextElements.get(frame.id);
	assert.ok(storedFrame);
	const storedDocument = getGanttChartDocument(
		nextElements.values(),
		storedFrame,
	);
	assert.equal(updateCount, 1);
	assert.equal(storedDocument?.tasks.length, initialDocument.tasks.length + 1);
	assert.equal(storedDocument?.tasks.at(-1)?.title, "New milestone");

	const entries = drainCanvasHistoryEntries(doc);
	assert.equal(entries.length, 1);
	assert.ok(applyCanvasHistoryEntryToYDoc(doc, entries[0], "undo") > 0);
	const restoredElements = readCanvasMapsFromYDoc(doc).elements;
	assert.equal(restoredElements.size, initial.length);
	assert.deepEqual(
		[...restoredElements.keys()].sort(),
		initial.map((element) => element.id).sort(),
	);
	const restoredFrame = restoredElements.get(frame.id);
	assert.ok(restoredFrame);
	assert.equal(
		getGanttChartDocument(restoredElements.values(), restoredFrame)?.tasks
			.length,
		initialDocument.tasks.length,
	);
});

test("adds a sequence message atomically and removes it with one undo", () => {
	const doc = new Y.Doc({ gc: false });
	let id = 0;
	const defaults = {
		createId: () => `sequence-live-${id++}`,
		stroke: "#111827",
		fontFamily: "Inter",
	};
	const initial = createVisualSequenceDiagramElements({
		preset: "blank",
		x: 400,
		y: 300,
		defaults,
	});
	for (const element of initial) yjsCreateElement(doc, element);
	drainCanvasHistoryEntries(doc);
	const initialMap = readCanvasMapsFromYDoc(doc).elements;
	const summary = getSequenceDiagramSummaries(initialMap.values())[0];
	assert.ok(summary);
	const plan = planSequenceDiagramMessageInsertion({
		elements: initialMap,
		diagramId: summary.id,
		fromParticipantId: summary.participants[0].id,
		toParticipantId: summary.participants[1].id,
		label: "Live request",
		kind: "synchronous",
		defaults,
	});
	assert.ok(plan);

	const nextElements = yjsApplyCanvasMutationPlan(doc, plan);
	assert.equal(
		[...nextElements.values()].filter(
			(element) => element.customData?.sequenceRole === "message",
		).length,
		1,
	);
	const entries = drainCanvasHistoryEntries(doc);
	assert.equal(entries.length, 1);
	assert.ok(applyCanvasHistoryEntryToYDoc(doc, entries[0], "undo") > 0);
	const restored = readCanvasMapsFromYDoc(doc).elements;
	assert.equal(restored.size, initial.length);
	assert.equal(
		[...restored.values()].some(
			(element) => element.customData?.sequenceRole === "message",
		),
		false,
	);
});

test("moves and undoes a complete Gantt chart without detaching locked parts", () => {
	const doc = new Y.Doc({ gc: false });
	let id = 0;
	const initial = createGanttChartElements(
		{
			createId: () => `gantt-move-${id++}`,
			stroke: "#111827",
			fontFamily: "Inter",
		},
		{ x: 100, y: 80, startDate: "2026-07-13" },
	);
	for (const element of initial) yjsCreateElement(doc, element);
	const initialStored = Array.from(
		readCanvasMapsFromYDoc(doc).elements.values(),
	);
	drainCanvasHistoryEntries(doc);

	const frame = initial[0];
	assert.ok(frame);
	const moveStart = new Map([[frame.id, { x: frame.x, y: frame.y }]]);
	const updates = buildCanvasMoveUpdates(
		new Map(initial.map((element) => [element.id, element])),
		moveStart,
		120,
		45,
	);
	yjsUpdateElements(doc, updates);
	const historyEntry = squashCanvasHistoryEntries(
		drainCanvasHistoryEntries(doc),
	);
	assert.ok(historyEntry);
	assert.equal(updates.length, initial.length);

	assert.ok(applyCanvasHistoryEntryToYDoc(doc, historyEntry, "undo") > 0);
	assert.deepEqual(
		Array.from(readCanvasMapsFromYDoc(doc).elements.values()),
		initialStored,
	);
});
