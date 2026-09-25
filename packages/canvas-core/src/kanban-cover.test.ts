import assert from "node:assert/strict";
import test from "node:test";
import { moveKanbanCoverPosition, normalizeKanbanCoverImage } from "./kanban";

const image = {
	id: "cover",
	src: "data:image/png;base64,AA==",
	name: "Cover",
	width: 600,
	height: 900,
};

test("cover positions survive serialization and old covers default to the center", () => {
	assert.deepEqual(normalizeKanbanCoverImage({ coverImage: image })?.position, {
		x: 50,
		y: 50,
	});
	const serialized = JSON.parse(
		JSON.stringify({ coverImage: { ...image, position: { x: 18, y: 83 } } }),
	);
	assert.deepEqual(normalizeKanbanCoverImage(serialized)?.position, {
		x: 18,
		y: 83,
	});
	assert.deepEqual(
		normalizeKanbanCoverImage({
			coverImage: { ...image, position: { x: -40, y: 200 } },
		})?.position,
		{ x: 0, y: 100 },
	);
	assert.deepEqual(
		normalizeKanbanCoverImage({
			coverImage: { ...image, position: { x: Number.NaN, y: "10" } },
		})?.position,
		{ x: 50, y: 50 },
	);
	assert.equal(normalizeKanbanCoverImage({ coverImage: null }), null);
});

test("dragging portrait and panorama covers follows the finger without exposing empty edges", () => {
	const start = { x: 50, y: 50 };
	const frame = { width: 300, height: 100 };
	assert.deepEqual(
		moveKanbanCoverPosition(start, { x: 30, y: 35 }, image, frame),
		{ x: 50, y: 40 },
	);
	assert.deepEqual(
		moveKanbanCoverPosition(start, { x: 0, y: 999 }, image, frame),
		{ x: 50, y: 0 },
	);
	assert.deepEqual(
		moveKanbanCoverPosition(start, { x: 0, y: -999 }, image, frame),
		{ x: 50, y: 100 },
	);
	assert.deepEqual(
		moveKanbanCoverPosition(
			start,
			{ x: 30, y: 50 },
			{ width: 1200, height: 200 },
			frame,
		),
		{ x: 40, y: 50 },
	);
	assert.deepEqual(
		moveKanbanCoverPosition(start, { x: 30, y: 50 }, frame, frame),
		start,
	);
	assert.deepEqual(
		moveKanbanCoverPosition(
			start,
			{ x: 30, y: 50 },
			{ width: 0, height: 0 },
			frame,
		),
		start,
	);
	// The same relative gesture in a half-size mobile preview selects the same crop.
	assert.deepEqual(
		moveKanbanCoverPosition(start, { x: 15, y: 17.5 }, image, {
			width: 150,
			height: 50,
		}),
		{ x: 50, y: 40 },
	);
});
