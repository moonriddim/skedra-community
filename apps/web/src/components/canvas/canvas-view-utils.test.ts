import assert from "node:assert/strict";
import { test } from "node:test";
import {
	constrainViewBoundsToAspectRatio,
	getCapturedViewBounds,
	getViewResizeAspectRatio,
} from "./canvas-view-utils.js";

test("new slide bounds are constrained to widescreen", () => {
	const bounds = constrainViewBoundsToAspectRatio(
		{ x: 10, y: 20, width: 800, height: 800 },
		16 / 9,
	);

	assert.equal(bounds.width / bounds.height, 16 / 9);
	assert.equal(bounds.x, 10);
	assert.equal(bounds.y, 20);
});

test("normal saved views preserve the freely captured area", () => {
	const bounds = { x: 10, y: 20, width: 800, height: 800 };

	assert.deepEqual(getCapturedViewBounds(bounds, false), bounds);
	assert.equal(getViewResizeAspectRatio("16:9", false), null);
});

test("presentation preparation constrains new and legacy views as slides", () => {
	const bounds = getCapturedViewBounds(
		{ x: 10, y: 20, width: 800, height: 800 },
		true,
	);

	assert.equal(bounds.width / bounds.height, 16 / 9);
	assert.equal(getViewResizeAspectRatio(undefined, true), 16 / 9);
	assert.equal(getViewResizeAspectRatio("4:3", true), 4 / 3);
	assert.equal(getViewResizeAspectRatio("free", true), null);
});
