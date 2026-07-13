import assert from "node:assert/strict";
import { test } from "node:test";
import { constrainViewBoundsToAspectRatio } from "./canvas-view-utils.js";

test("new slide bounds are constrained to widescreen", () => {
	const bounds = constrainViewBoundsToAspectRatio(
		{ x: 10, y: 20, width: 800, height: 800 },
		16 / 9,
	);

	assert.equal(bounds.width / bounds.height, 16 / 9);
	assert.equal(bounds.x, 10);
	assert.equal(bounds.y, 20);
});
