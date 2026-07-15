import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildCanvasPathInsertPointChanges,
	buildCanvasPathPointChanges,
	getCanvasPathSegmentMidpoints,
} from "./path-editing.js";
import type { CanvasElement } from "./types.js";

const line: CanvasElement = {
	id: "line",
	type: "line",
	x: 10,
	y: 20,
	width: 100,
	height: 100,
	rotation: 0,
	fill: "transparent",
	stroke: "#111",
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
		[100, 100],
	],
};

test("moves and inserts path points through shared changes", () => {
	assert.deepEqual(buildCanvasPathPointChanges(line, 1, [80, 20]), {
		points: [
			[0, 0],
			[80, 20],
			[100, 100],
		],
	});
	assert.deepEqual(buildCanvasPathInsertPointChanges(line, 2, [100, 50]), {
		points: [
			[0, 0],
			[100, 0],
			[100, 50],
			[100, 100],
		],
	});
});

test("includes the closing segment midpoint for closed paths", () => {
	assert.deepEqual(getCanvasPathSegmentMidpoints({ ...line, closed: true }), [
		{ segmentIndex: 0, insertIndex: 1, point: [50, 0] },
		{ segmentIndex: 1, insertIndex: 2, point: [100, 50] },
		{ segmentIndex: 2, insertIndex: 3, point: [50, 50] },
	]);
	assert.equal(
		getCanvasPathSegmentMidpoints({
			...line,
			type: "cloud",
			closed: true,
		}).length,
		3,
	);
});
