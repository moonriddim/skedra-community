import assert from "node:assert/strict";
import test from "node:test";
import { createBaseCanvasElement } from "@skedra/canvas-core";
import { getLibraryPreviewBackground } from "./library-preview-background";

const symbol = (stroke: string) =>
	createBaseCanvasElement(
		{ createId: () => stroke, stroke },
		{ type: "line", fill: "transparent" },
	);

test("dark symbol strokes get a light preview surface", () => {
	const elements = [symbol("#17211d")];
	const before = JSON.stringify(elements);
	assert.equal(getLibraryPreviewBackground(elements), "#fafaf9");
	assert.equal(JSON.stringify(elements), before);
});

test("light symbol strokes get a dark preview surface", () => {
	assert.equal(getLibraryPreviewBackground([symbol("#f5f5f4")]), "#1a1a1a");
	assert.equal(
		getLibraryPreviewBackground([symbol("rgb(255, 255, 255)")]),
		"#1a1a1a",
	);
});

test("mixed black and white symbols retain contrast for both colors", () => {
	assert.equal(
		getLibraryPreviewBackground([symbol("#000"), symbol("#fff")]),
		"#808080",
	);
});

test("unoutlined fills, invisible elements and theme colors are handled", () => {
	assert.equal(
		getLibraryPreviewBackground([
			{ ...symbol("transparent"), strokeWidth: 0, fill: "#fff" },
		]),
		"#1a1a1a",
	);
	assert.equal(
		getLibraryPreviewBackground([{ ...symbol("#fff"), opacity: 0 }]),
		"var(--background)",
	);
	assert.equal(
		getLibraryPreviewBackground([symbol("var(--foreground)")]),
		"var(--background)",
	);
});
