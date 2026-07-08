import assert from "node:assert/strict";
import { test } from "node:test";
import {
	type CanvasElementFactoryDefaults,
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
