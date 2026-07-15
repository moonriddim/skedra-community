import assert from "node:assert/strict";
import { test } from "node:test";
import { createBaseCanvasElement } from "./element-factory";
import { getCanvasPreviewBounds } from "./viewport";

test("preview bounds are shared and padded around canvas content", () => {
	const element = createBaseCanvasElement(
		{ createId: () => "preview", stroke: "#111" },
		{
			type: "rectangle",
			x: 40,
			y: 60,
			width: 240,
			height: 120,
			fill: "#fff",
		},
	);
	assert.deepEqual(getCanvasPreviewBounds([element]), {
		minX: 11.200000000000003,
		minY: 31.200000000000003,
		width: 297.6,
		height: 177.6,
	});
	assert.deepEqual(getCanvasPreviewBounds([]), {
		minX: 0,
		minY: 0,
		width: 320,
		height: 180,
	});
});
