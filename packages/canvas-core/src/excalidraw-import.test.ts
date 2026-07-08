import assert from "node:assert/strict";
import { test } from "node:test";
import {
	convertExcalidrawElement,
	convertExcalidrawLibraryGroups,
} from "./excalidraw-import.js";

const options = {
	createId: () => "generated-id",
	defaultFontFamily: "Inter",
	defaultStroke: "#111111",
};

test("converts Excalidraw arrows with points and arrow heads", () => {
	const element = convertExcalidrawElement(
		{
			id: "arrow-1",
			type: "line",
			x: 10,
			y: 20,
			width: 100,
			height: 40,
			strokeColor: "#ff0000",
			strokeStyle: "dashed",
			endArrowhead: "triangle",
			points: [
				[0, 0],
				[100, 40],
			],
		},
		options,
	);

	assert.equal(element?.type, "arrow");
	assert.equal(element?.strokeStyle, "dashed");
	assert.equal(element?.arrowHeadEnd, "triangle");
	assert.deepEqual(element?.points, [
		[0, 0],
		[100, 40],
	]);
});

test("converts Excalidraw text with fallback font and group id", () => {
	const element = convertExcalidrawElement(
		{
			type: "text",
			x: 0,
			y: 0,
			width: 120,
			height: 40,
			text: "Hello",
			groupIds: ["group-a"],
		},
		options,
	);

	assert.equal(element?.id, "generated-id");
	assert.equal(element?.text, "Hello");
	assert.equal(element?.fontFamily, "Inter");
	assert.equal(element?.groupId, "group-a");
	assert.equal(element?.customData?.excalidrawImport, true);
});

test("converts only non-empty Excalidraw library groups", () => {
	const groups = convertExcalidrawLibraryGroups(
		[
			[{ id: "rect-1", type: "rectangle", width: 10, height: 10 }],
			[{ type: "unknown" }],
			[{ id: "deleted", type: "ellipse", isDeleted: true }],
		],
		options,
	);

	assert.equal(groups.length, 1);
	assert.equal(groups[0].name, "Item 1");
	assert.equal(groups[0].elements[0].id, "rect-1");
});
