import assert from "node:assert/strict";
import test from "node:test";
import { resolveCanvasEditorNaturalTextSize } from "./canvas-editor-text-overlay";

test("standalone text bounds follow the measured text instead of the editor box", () => {
	const size = resolveCanvasEditorNaturalTextSize({
		text: "test",
		fontSize: 20,
		fontFamily: "sans-serif",
		fontWeight: "normal",
		fontStyle: "italic",
		lineHeight: 1.4,
		paddingX: 4,
		paddingY: 2,
		measureLine: (line) => line.length * 9,
	});

	assert.deepEqual(size, { width: 44, height: 32 });
});

test("standalone multiline text uses the widest line and one line box per row", () => {
	const widths = new Map([
		["short", 30],
		["longer line", 82],
	]);
	const size = resolveCanvasEditorNaturalTextSize({
		text: "short\nlonger line",
		fontSize: 16,
		fontFamily: "sans-serif",
		fontWeight: "bold",
		fontStyle: "normal",
		lineHeight: 1.4,
		paddingX: 4,
		paddingY: 2,
		measureLine: (line) => widths.get(line) ?? 0,
	});

	assert.deepEqual(size, { width: 90, height: 49 });
});
