import assert from "node:assert/strict";
import test from "node:test";
import { buildCanvasTextUpdate } from "./editor-operations";
import { createBaseCanvasElement } from "./element-factory";
import { transformCanvasElementPoint } from "./geometry-bbox";
import {
	getPyramidSectionAtPoint,
	getPyramidSectionTextElement,
	getPyramidSectionTexts,
} from "./pyramid-text";
import { findCanvasSearchMatches } from "./search";

const pyramid = createBaseCanvasElement(
	{ createId: () => "pyramid", stroke: "#111" },
	{
		type: "triangle",
		x: 100,
		y: 200,
		width: 400,
		height: 320,
		pyramidSections: 4,
	},
);

test("each segment can be targeted after rotation and flips", () => {
	for (const rotation of [0, 45, 90, 180, 270]) {
		for (const flipY of [false, true]) {
			const element = { ...pyramid, rotation, flipY, flipX: true };
			for (let section = 0; section < 4; section++) {
				const point = transformCanvasElementPoint(element, {
					x: 300,
					y: 240 + section * 80,
				});
				assert.equal(
					getPyramidSectionAtPoint(element, point.x, point.y),
					section,
				);
				const editor = getPyramidSectionTextElement(element, section, true);
				assert.ok(Math.abs(editor.x + editor.width / 2 - point.x) < 0.001);
				assert.ok(Math.abs(editor.y + editor.height / 2 - point.y) < 0.001);
			}
		}
	}
	assert.equal(
		getPyramidSectionAtPoint({ ...pyramid, pyramidSections: 1 }, 300, 400),
		null,
	);
	assert.equal(getPyramidSectionAtPoint(pyramid, 300, 520), 3);
});

test("segment edits preserve siblings, old labels, metadata and shape bounds", () => {
	let element = { ...pyramid, text: "Existing", customData: { other: "keep" } };
	const first = buildCanvasTextUpdate({
		element,
		text: "Goal",
		pyramidSection: 0,
	});
	assert.equal(first.width, undefined);
	assert.equal(first.height, undefined);
	element = { ...element, ...first };
	const original = element;
	element = {
		...element,
		...buildCanvasTextUpdate({
			element,
			text: "Foundation",
			pyramidSection: 3,
		}),
	};
	assert.deepEqual(getPyramidSectionTexts(element), [
		"Goal",
		"",
		"Existing",
		"Foundation",
	]);
	assert.deepEqual(getPyramidSectionTexts(original), ["Goal", "", "Existing"]);
	assert.equal(element.customData.other, "keep");
	element = {
		...element,
		...buildCanvasTextUpdate({ element, text: "", pyramidSection: 2 }),
	};
	assert.deepEqual(getPyramidSectionTexts(element), [
		"Goal",
		"",
		"",
		"Foundation",
	]);
	const reduced = { ...element, pyramidSections: 2 };
	assert.equal(getPyramidSectionTexts(reduced)[3], "Foundation");
	assert.equal(findCanvasSearchMatches([element], "Foundation").length, 1);
	assert.equal(findCanvasSearchMatches([reduced], "Foundation").length, 0);
});

test("segment text follows resize and ordinary shapes keep their text behavior", () => {
	const resized = { ...pyramid, width: 800, height: 640 };
	const label = getPyramidSectionTextElement(resized, 3);
	assert.equal(label.y + label.height / 2, 760);
	assert.equal(label.x + label.width / 2, 500);
	assert.equal(label.height, 160);
	const triangle = { ...pyramid, pyramidSections: 1, text: "Plain" };
	assert.equal(
		buildCanvasTextUpdate({ element: triangle, text: "Changed" }).text,
		"Changed",
	);
	assert.equal(
		buildCanvasTextUpdate({ element: triangle, text: "Changed" }).customData,
		undefined,
	);
});
