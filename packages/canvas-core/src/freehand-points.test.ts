import assert from "node:assert/strict";
import { test } from "node:test";
import {
	FREEHAND_POINT_STEP,
	appendFreehandPoint,
	quantizeFreehandCoordinate,
} from "./freehand-points";

test("freehand coordinates snap to a float32-exact grid", () => {
	assert.equal(quantizeFreehandCoordinate(12.345678), 12.375);
	assert.equal(quantizeFreehandCoordinate(-0.01), 0);
	assert.ok(Object.is(quantizeFreehandCoordinate(-0.01), 0));
	for (const value of [3.3, -271.828, 1000.001]) {
		const quantized = quantizeFreehandCoordinate(value);
		assert.equal(Math.fround(quantized), quantized);
		assert.ok(Math.abs(quantized - value) <= FREEHAND_POINT_STEP / 2);
	}
});

test("points that barely move on screen are dropped", () => {
	const points: [number, number][] = [[0, 0]];
	// Zoom 1: 0.3 px is below the 0.5 px threshold.
	assert.equal(appendFreehandPoint(points, 0.3, 0, 1), false);
	assert.equal(appendFreehandPoint(points, 2, 0, 1), true);
	// Zoom 4: 0.2 canvas units are 0.8 screen px and are kept.
	assert.equal(appendFreehandPoint(points, 2.2, 0, 4), true);
	assert.deepEqual(points, [
		[0, 0],
		[2, 0],
		[2.1875, 0],
	]);
});

test("a typical slow stroke keeps far fewer, compactly encodable points", () => {
	let seed = 7;
	const random = () => {
		seed = (seed * 16807) % 2147483647;
		return seed / 2147483647;
	};
	// 400 pointer samples, several per screen pixel, like a slow pen stroke.
	const compact: [number, number][] = [[0, 0]];
	let x = 0;
	let y = 0;
	for (let i = 0; i < 400; i++) {
		x += random() * 0.9;
		y += (random() - 0.5) * 0.9;
		appendFreehandPoint(compact, x, y, 1);
	}
	assert.ok(compact.length < 400 * 0.7, `kept ${compact.length} points`);
	// Every stored value fits into a 32-bit float (5 instead of 9 bytes in Yjs).
	for (const [px, py] of compact) {
		assert.equal(Math.fround(px), px);
		assert.equal(Math.fround(py), py);
	}
});
