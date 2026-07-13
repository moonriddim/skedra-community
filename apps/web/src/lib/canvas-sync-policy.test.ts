import assert from "node:assert/strict";
import test from "node:test";
import {
	CANVAS_UPDATE_COMPACT_AFTER_BYTES,
	CANVAS_UPDATE_COMPACT_AFTER_COUNT,
	shouldCompactCanvasUpdateLog,
} from "./canvas-sync-policy";

test("compacts at the update-count threshold", () => {
	assert.equal(
		shouldCompactCanvasUpdateLog({
			updateCount: CANVAS_UPDATE_COMPACT_AFTER_COUNT,
			compactableBytes: 1,
		}),
		true,
	);
});

test("compacts a multi-row log at the payload threshold", () => {
	assert.equal(
		shouldCompactCanvasUpdateLog({
			updateCount: 2,
			compactableBytes: CANVAS_UPDATE_COMPACT_AFTER_BYTES,
		}),
		true,
	);
});

test("does not repeatedly compact a large snapshot without new delta bytes", () => {
	assert.equal(
		shouldCompactCanvasUpdateLog({
			updateCount: 2,
			compactableBytes: 100,
		}),
		false,
	);
});
