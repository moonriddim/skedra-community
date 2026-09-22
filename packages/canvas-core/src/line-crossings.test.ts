import assert from "node:assert/strict";
import test from "node:test";
import { createBaseCanvasElement } from "./element-factory";
import { FRAME_SIZE_PRESETS } from "./frame-presets";
import { buildLineCrossingGaps } from "./line-crossings";
import type { CanvasElement } from "./types";

function line(
	id: string,
	points: [number, number][],
	gap = 0,
	overrides: Partial<CanvasElement> = {},
) {
	return createBaseCanvasElement(
		{ createId: () => id, stroke: "#fff" },
		{
			type: "line",
			points,
			width: 100,
			height: 100,
			customData: { lineCrossingGap: gap },
			...overrides,
		},
	);
}
test("crossings interrupt only the opted-in line and preserve geometry", () => {
	const a = line(
		"a",
		[
			[50, 0],
			[50, 100],
		],
		16,
	);
	const b = line("b", [
		[0, 50],
		[100, 50],
	]);
	const before = JSON.stringify([a, b]);
	assert.deepEqual(buildLineCrossingGaps([a, b]).get("a"), [
		{ x: 50, y: 50, radius: 9 },
	]);
	assert.equal(buildLineCrossingGaps([a, b]).has("b"), false);
	assert.equal(JSON.stringify([a, b]), before);
	assert.equal(buildLineCrossingGaps([b]).size, 0);
});
test("both enabled uses stacking order; endpoints and parallel paths stay connected", () => {
	const a = line(
		"a",
		[
			[50, 0],
			[50, 100],
		],
		16,
	);
	const b = line(
		"b",
		[
			[0, 50],
			[100, 50],
		],
		16,
	);
	assert.deepEqual([...buildLineCrossingGaps([a, b]).keys()], ["a"]);
	assert.equal(
		buildLineCrossingGaps([
			a,
			line("t", [
				[0, 50],
				[50, 50],
			]),
		]).size,
		0,
	);
	assert.equal(
		buildLineCrossingGaps([
			a,
			line("p", [
				[60, 0],
				[60, 100],
			]),
		]).size,
		0,
	);
});
test("rotated paths and multiple crossings use rendered coordinates", () => {
	const a = line(
		"a",
		[
			[0, 50],
			[100, 50],
		],
		8,
		{ rotation: 90, x: 100 },
	);
	const b = line("b", [
		[100, 25],
		[200, 25],
	]);
	const c = line("c", [
		[100, 75],
		[200, 75],
	]);
	assert.equal(buildLineCrossingGaps([a, b, c]).get("a")?.length, 2);
});
test("A4 through A1 presets default to landscape", () => {
	for (const id of ["a4", "a3", "a2", "a1"]) {
		const preset = FRAME_SIZE_PRESETS.find((p) => p.id === id);
		assert.ok(preset && preset.width > preset.height);
	}
});
