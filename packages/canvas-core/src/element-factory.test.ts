import assert from "node:assert/strict";
import { test } from "node:test";
import {
	type CanvasElementFactoryDefaults,
	createCanvasElementFromBoundsInput,
	createImageCanvasElement,
	createKanbanListElements,
	createStickyNoteElement,
	fitImageSize,
} from "./element-factory.js";

const defaults: CanvasElementFactoryDefaults = {
	createId: (() => {
		let next = 0;
		return () => `id-${next++}`;
	})(),
	stroke: "#111111",
	fontFamily: "Inter",
	kanbanFontFamily: "Kalam",
};

test("creates sticky notes with core defaults and metadata", () => {
	const note = createStickyNoteElement(defaults, {
		x: 10,
		y: 20,
		color: "#fff3bf",
		text: "Plan",
	});

	assert.equal(note.type, "rectangle");
	assert.equal(note.fontFamily, "Inter");
	assert.deepEqual(note.customData?.stickyChecklist, []);
});

test("fits images without upscaling", () => {
	assert.deepEqual(fitImageSize(960, 720, 480, 360), {
		width: 480,
		height: 360,
	});
	assert.deepEqual(fitImageSize(120, 80, 480, 360), {
		width: 120,
		height: 80,
	});
	assert.deepEqual(fitImageSize(0, 0, 480, 360), {
		width: 480,
		height: 360,
	});

	const image = createImageCanvasElement(defaults, {
		x: 0,
		y: 0,
		src: "data:image/png;base64,test",
		width: 960,
		height: 720,
		alt: "Image",
	});
	assert.equal(image.width, 480);
	assert.equal(image.customData?.naturalWidth, 960);
});

test("creates API and MCP bounds elements through one canonical mapper", () => {
	const pyramid = createCanvasElementFromBoundsInput(defaults, {
		id: "pyramid",
		type: "triangle",
		x: 10,
		y: 20,
		width: 200,
		height: 120,
		pyramidSections: 4,
	});
	assert.equal(pyramid.id, "pyramid");
	assert.equal(pyramid.pyramidSections, 4);
	assert.equal(pyramid.stroke, "#111111");

	const arrow = createCanvasElementFromBoundsInput(
		defaults,
		{ type: "arrow", x: 0, y: 0, width: 80, height: 40 },
		{ createPathPointsFromBounds: true },
	);
	assert.deepEqual(arrow.points, [
		[0, 0],
		[80, 40],
	]);

	const structuredArrow = createCanvasElementFromBoundsInput(defaults, {
		type: "arrow",
		x: 0,
		y: 0,
		width: 120,
		height: 40,
		points: [
			[0, 0],
			[60, 0],
			[120, 40],
		],
		strokeStyle: "dashed",
		arrowMode: "elbow",
		arrowHeadEnd: "triangle",
		fontFamily: "system-ui",
		customData: { skedraType: "sequence-diagram-element" },
	});
	assert.equal(structuredArrow.strokeStyle, "dashed");
	assert.equal(structuredArrow.arrowMode, "elbow");
	assert.equal(structuredArrow.arrowHeadEnd, "triangle");
	assert.equal(structuredArrow.fontFamily, "system-ui");
	assert.equal(
		structuredArrow.customData?.skedraType,
		"sequence-diagram-element",
	);
});

test("creates kanban lists and cards without numeric layer ordering", () => {
	const elements = createKanbanListElements(defaults, {
		x: 100,
		y: 200,
		name: "Todo",
		cardTitles: ["One", "Two"],
	});

	assert.equal(elements.length, 3);
	assert.equal(elements[0].customData?.skedraType, "kanban-list");
	assert.equal(elements[1].frameId, elements[0].id);
	assert.equal(elements[2].frameId, elements[0].id);
	assert.ok(elements.every((element) => element.stackIndex === undefined));
});
