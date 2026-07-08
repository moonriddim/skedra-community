import assert from "node:assert/strict";
import { test } from "node:test";
import {
	applyCanvasHistoryPatchDelta,
	createCanvasHistoryEntry,
	createCanvasHistoryPatchDelta,
	invertCanvasHistoryEntry,
	shouldApplyCanvasHistoryDelta,
	shouldApplyCanvasHistoryPatchDelta,
	squashCanvasHistoryEntries,
} from "./history-delta.js";

test("creates and inverts canvas history entries", () => {
	const entry = createCanvasHistoryEntry([
		{
			kind: "element",
			id: "a",
			before: { id: "a", x: 0 },
			after: { id: "a", x: 10 },
		},
	]);

	if (!entry) throw new Error("expected history entry");
	const inverse = invertCanvasHistoryEntry(entry);
	assert.deepEqual(inverse.deltas[0].before, { id: "a", x: 10 });
	assert.deepEqual(inverse.deltas[0].after, { id: "a", x: 0 });
});

test("squashes multiple updates per entity", () => {
	const first = createCanvasHistoryEntry([
		{
			kind: "element",
			id: "a",
			before: { id: "a", x: 0 },
			after: { id: "a", x: 10 },
		},
	]);
	const second = createCanvasHistoryEntry([
		{
			kind: "element",
			id: "a",
			before: { id: "a", x: 10 },
			after: { id: "a", x: 20 },
		},
	]);

	if (!first || !second) throw new Error("expected history entries");
	const squashed = squashCanvasHistoryEntries([first, second]);

	assert.deepEqual(squashed?.deltas[0].before, { id: "a", x: 0 });
	assert.deepEqual(squashed?.deltas[0].after, { id: "a", x: 20 });
});

test("creates compact nested patches for entity updates", () => {
	const delta = createCanvasHistoryPatchDelta(
		"element",
		"a",
		{
			id: "a",
			x: 0,
			customData: { title: "before", unchanged: true },
		},
		{
			id: "a",
			x: 10,
			customData: { title: "after", unchanged: true },
		},
	);

	assert.deepEqual(delta?.patches, [
		{
			path: ["x"],
			before: { exists: true, value: 0 },
			after: { exists: true, value: 10 },
		},
		{
			path: ["customData", "title"],
			before: { exists: true, value: "before" },
			after: { exists: true, value: "after" },
		},
	]);
});

test("applies and inverts patch deltas without replacing whole entity", () => {
	const delta = createCanvasHistoryPatchDelta(
		"element",
		"a",
		{ id: "a", x: 0, customData: { title: "before", keep: "same" } },
		{ id: "a", x: 10, customData: { title: "after", keep: "same" } },
	);
	if (!delta) throw new Error("expected patch delta");

	const current = {
		id: "a",
		x: 10,
		customData: { title: "after", keep: "same", remote: "untouched" },
	};
	assert.equal(
		shouldApplyCanvasHistoryPatchDelta(current, delta, "undo"),
		true,
	);
	assert.deepEqual(applyCanvasHistoryPatchDelta(current, delta, "undo"), {
		id: "a",
		x: 0,
		customData: { title: "before", keep: "same", remote: "untouched" },
	});

	const inverse = invertCanvasHistoryEntry({
		id: "hist",
		createdAt: 1,
		deltas: [delta],
	});
	assert.deepEqual(inverse.deltas[0].patches?.[0], {
		path: ["x"],
		before: { exists: true, value: 10 },
		after: { exists: true, value: 0 },
	});
});

test("squashes patch deltas per field", () => {
	const firstDelta = createCanvasHistoryPatchDelta(
		"element",
		"a",
		{ id: "a", x: 0, y: 0 },
		{ id: "a", x: 10, y: 0 },
	);
	const secondDelta = createCanvasHistoryPatchDelta(
		"element",
		"a",
		{ id: "a", x: 10, y: 0 },
		{ id: "a", x: 20, y: 5 },
	);
	assert.ok(firstDelta);
	assert.ok(secondDelta);

	const first = createCanvasHistoryEntry([firstDelta]);
	const second = createCanvasHistoryEntry([secondDelta]);
	assert.ok(first);
	assert.ok(second);
	const squashed = squashCanvasHistoryEntries([first, second]);

	assert.deepEqual(squashed?.deltas[0].patches, [
		{
			path: ["x"],
			before: { exists: true, value: 0 },
			after: { exists: true, value: 20 },
		},
		{
			path: ["y"],
			before: { exists: true, value: 0 },
			after: { exists: true, value: 5 },
		},
	]);
});

test("checks conflict expectations by value", () => {
	assert.equal(
		shouldApplyCanvasHistoryDelta({ id: "a", x: 1 }, { id: "a", x: 1 }),
		true,
	);
	assert.equal(
		shouldApplyCanvasHistoryDelta({ id: "a", x: 2 }, { id: "a", x: 1 }),
		false,
	);
});
