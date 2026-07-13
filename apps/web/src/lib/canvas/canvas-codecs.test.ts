import assert from "node:assert/strict";
import { test } from "node:test";
import type { CanvasElement } from "@skedra/canvas-core";
import { decodeCanvasElement, encodeCanvasElement } from "./canvas-codecs.js";

function triangleArrow(): CanvasElement {
	return {
		id: "arrow",
		type: "arrow",
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		rotation: 0,
		fill: "transparent",
		stroke: "#000000",
		strokeWidth: 2,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		points: [
			[0, 0],
			[100, 40],
		],
		arrowHeadEnd: "triangle",
		arrowHeadFilled: false,
	};
}

test("preserves hollow arrowheads through the canvas codec", () => {
	const decoded = decodeCanvasElement(encodeCanvasElement(triangleArrow()));

	assert.equal(decoded?.arrowHeadFilled, false);
});

test("rejects invalid arrowhead fill values", () => {
	const encoded = encodeCanvasElement(triangleArrow());
	encoded.arrowHeadFilled = "hollow";

	assert.equal(decodeCanvasElement(encoded), null);
});
