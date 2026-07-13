import assert from "node:assert/strict";
import { test } from "node:test";
import { hitTest } from "./hit-test.js";
import { getArrowTextMetrics, pathTextLabelHitTest } from "./path-rendering.js";
import type { CanvasElement } from "./types.js";

function arrow(overrides: Partial<CanvasElement> = {}): CanvasElement {
	return {
		id: "arrow",
		type: "arrow",
		x: 0,
		y: 0,
		width: 100,
		height: 1,
		rotation: 0,
		fill: "transparent",
		stroke: "#000",
		strokeWidth: 2,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		points: [
			[0, 0],
			[100, 0],
		],
		text: "Label",
		fontSize: 16,
		...overrides,
	};
}

test("computes arrow label metrics", () => {
	const metrics = getArrowTextMetrics(
		[
			[0, 0],
			[100, 0],
		],
		"straight",
		"above",
		12,
	);

	assert.deepEqual(metrics.anchor, [50, -12]);
	assert.equal(metrics.tangentAngle, 0);
});

test("path label hit testing is available from core hitTest", () => {
	const element = arrow();
	const metrics = getArrowTextMetrics(
		element.points ?? [],
		element.arrowMode,
		"above",
		13,
	);
	const [labelX, labelY] = metrics.anchor;

	assert.equal(pathTextLabelHitTest(element, labelX, labelY), true);
	assert.equal(hitTest(element, labelX, labelY), true);
	assert.equal(pathTextLabelHitTest(element, 50, 80), false);
});

test("hit tests the complete cubic arrow curve", () => {
	const element = arrow({
		arrowMode: "curve",
		points: [
			[0, 0],
			[0, 100],
			[100, 100],
			[100, 0],
		],
	});

	assert.equal(hitTest(element, 50, 75), true);
	assert.equal(hitTest(element, 50, 40), false);
});

test("hit tests later segments of rough multi-point arrow curves", () => {
	const element = arrow({
		arrowMode: "curve",
		roughness: 1,
		points: [
			[0, 0],
			[100, 100],
			[200, 0],
			[300, 100],
		],
	});

	assert.equal(hitTest(element, 256.25, 43.75), true);
	assert.equal(hitTest(element, 280, 0), false);
});
