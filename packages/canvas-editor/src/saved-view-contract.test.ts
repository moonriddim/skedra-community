import assert from "node:assert/strict";
import test from "node:test";
import {
	constrainCanvasEditorViewBoundsToAspectRatio,
	getCanvasEditorCapturedViewBounds,
	getCanvasEditorViewResizeAspectRatio,
	isCanvasEditorViewInteractionPointer,
} from "./index";

test("saved-view interactions only accept their owning pointer", () => {
	const interaction = {
		mode: "move" as const,
		pointerId: 7,
		startCanvasX: 10,
		startCanvasY: 20,
		viewId: "view-1",
		startBounds: { x: 0, y: 0, width: 400, height: 225 },
		handle: null,
	};

	assert.equal(isCanvasEditorViewInteractionPointer(interaction, 7), true);
	assert.equal(isCanvasEditorViewInteractionPointer(interaction, 8), false);
	assert.equal(isCanvasEditorViewInteractionPointer(null, 7), false);
});

test("new slide bounds are constrained to widescreen", () => {
	const bounds = constrainCanvasEditorViewBoundsToAspectRatio(
		{ x: 10, y: 20, width: 800, height: 800 },
		16 / 9,
	);

	assert.equal(bounds.width / bounds.height, 16 / 9);
	assert.equal(bounds.x, 10);
	assert.equal(bounds.y, 20);
});

test("normal saved views preserve the freely captured area", () => {
	const bounds = { x: 10, y: 20, width: 800, height: 800 };

	assert.deepEqual(getCanvasEditorCapturedViewBounds(bounds, false), bounds);
	assert.equal(getCanvasEditorViewResizeAspectRatio("16:9", false), null);
});

test("presentation preparation constrains new and legacy views as slides", () => {
	const bounds = getCanvasEditorCapturedViewBounds(
		{ x: 10, y: 20, width: 800, height: 800 },
		true,
	);

	assert.equal(bounds.width / bounds.height, 16 / 9);
	assert.equal(getCanvasEditorViewResizeAspectRatio(undefined, true), 16 / 9);
	assert.equal(getCanvasEditorViewResizeAspectRatio("4:3", true), 4 / 3);
	assert.equal(getCanvasEditorViewResizeAspectRatio("free", true), null);
});
