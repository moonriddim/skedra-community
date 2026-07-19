import assert from "node:assert/strict";
import test from "node:test";
import { resolveCanvasEditorToolbarMagnification } from "./toolbar-feedback";

test("toolbar magnification is strongest at the pointer and fades smoothly", () => {
	const centered = resolveCanvasEditorToolbarMagnification(0);
	const neighbor = resolveCanvasEditorToolbarMagnification(36);
	const distant = resolveCanvasEditorToolbarMagnification(72);

	assert.deepEqual(centered, { scale: 1.23, lift: -2 });
	assert.equal(neighbor.scale > 1 && neighbor.scale < centered.scale, true);
	assert.equal(neighbor.lift < 0 && neighbor.lift > centered.lift, true);
	assert.deepEqual(distant, { scale: 1, lift: 0 });
});

test("toolbar magnification clamps invalid negative distances", () => {
	assert.deepEqual(
		resolveCanvasEditorToolbarMagnification(-20),
		resolveCanvasEditorToolbarMagnification(0),
	);
});
