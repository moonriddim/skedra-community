import assert from "node:assert/strict";
import test from "node:test";
import { clampCanvasEditorFloatingPanelOffset } from "./use-canvas-editor-floating-panel";

test("floating panels stay inside the canvas boundary", () => {
	assert.deepEqual(
		clampCanvasEditorFloatingPanelOffset(
			{ x: -120, y: 500 },
			{ left: -100, top: 520, width: 320, height: 240 },
			{ left: 0, top: 0, width: 900, height: 700 },
			8,
		),
		{ x: -12, y: 432 },
	);
});

test("oversized floating panels keep their top-left handle reachable", () => {
	assert.deepEqual(
		clampCanvasEditorFloatingPanelOffset(
			{ x: 50, y: 60 },
			{ left: 50, top: 60, width: 700, height: 500 },
			{ left: 0, top: 0, width: 600, height: 400 },
			8,
		),
		{ x: 8, y: 8 },
	);
});
