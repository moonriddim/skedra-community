import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCanvasDrawingElement } from "./editor-operations.js";
import {
	appendCanvasPathPreviewPoint,
	commitCanvasPathPoint,
	getCanvasPathStartSnapState,
} from "./path-drawing.js";

test("shares screen-space start snapping for closable multi-lines", () => {
	const draft = {
		tool: "line" as const,
		points: [
			[10, 20],
			[100, 20],
			[100, 100],
		] as [number, number][],
	};

	assert.deepEqual(getCanvasPathStartSnapState(draft, { x: 16, y: 20 }, 2), {
		point: [10, 20],
		active: true,
	});
	assert.deepEqual(getCanvasPathStartSnapState(draft, { x: 20, y: 20 }, 2), {
		point: [10, 20],
		active: false,
	});
	assert.equal(getCanvasPathStartSnapState(draft, { x: 40, y: 20 }, 2), null);
	assert.equal(
		getCanvasPathStartSnapState(
			{ ...draft, tool: "arrow" },
			{ x: 10, y: 20 },
			1,
		),
		null,
	);
});

test("uses identical elbow points for committed paths and hover previews", () => {
	const committed = commitCanvasPathPoint([[0, 0]], [80, 40], "elbow");
	assert.deepEqual(committed, [
		[0, 0],
		[40, 0],
		[40, 40],
		[80, 40],
	]);
	assert.deepEqual(appendCanvasPathPreviewPoint([[0, 0]], [80, 40], "elbow"), [
		[0, 0],
		[40, 0],
		[40, 40],
		[80, 40],
		[80, 40],
	]);
});

test("builds closed, filled multi-point lines through the shared drawing factory", () => {
	const element = buildCanvasDrawingElement({
		id: "closed-path",
		tool: "line",
		start: { x: 30, y: 20 },
		points: [
			{ x: 30, y: 20 },
			{ x: 90, y: 20 },
			{ x: 60, y: 80 },
		],
		closed: true,
		style: {
			stroke: "#111111",
			fill: "#22c55e",
			arrowMode: "curve",
		},
	});

	assert.equal(element.closed, true);
	assert.equal(element.fill, "#22c55e");
	assert.equal(element.arrowMode, "curve");
	assert.deepEqual(
		[element.x, element.y, element.width, element.height],
		[30, 20, 60, 60],
	);
	assert.deepEqual(element.points, [
		[0, 0],
		[60, 0],
		[30, 60],
	]);
});
