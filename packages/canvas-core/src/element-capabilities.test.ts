import assert from "node:assert/strict";
import test from "node:test";
import { isCanvasTextEditableElement } from "./element-capabilities";
import type { CanvasElement } from "./types";

test("keeps inline text capability centralized for every element type", () => {
	const editable: CanvasElement["type"][] = [
		"text",
		"rectangle",
		"ellipse",
		"diamond",
		"frame",
		"line",
		"arrow",
	];
	const nonEditable: CanvasElement["type"][] = ["image", "freehand"];

	for (const type of editable) {
		assert.equal(isCanvasTextEditableElement({ type }), true, type);
	}
	for (const type of nonEditable) {
		assert.equal(isCanvasTextEditableElement({ type }), false, type);
	}
});
