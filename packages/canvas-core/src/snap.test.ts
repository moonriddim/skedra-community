import assert from "node:assert/strict";
import test from "node:test";
import { createBaseCanvasElement } from "./element-factory";
import {
	findClosestSnapAnchor,
	getCanvasElementSnapPointIndicators,
	getVisibleSnapPointIndicators,
	normalizeCanvasGridSize,
	normalizeCanvasSnapDivisionCount,
	snapCanvasCoordinateToGrid,
	snapCanvasPointToGrid,
} from "./snap";
import type { CanvasElement } from "./types";

function rectangle(overrides: Partial<CanvasElement> = {}) {
	return createBaseCanvasElement(
		{ createId: () => "rect", stroke: "#111" },
		{
			type: "rectangle",
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			...overrides,
		},
	);
}

test("grid snapping is shared, configurable, and safely normalized", () => {
	assert.equal(normalizeCanvasGridSize(Number.NaN), 20);
	assert.equal(normalizeCanvasGridSize(0), 1);
	assert.equal(normalizeCanvasGridSize(5000), 1000);
	assert.equal(snapCanvasCoordinateToGrid(26, 10), 30);
	assert.deepEqual(snapCanvasPointToGrid({ x: 24, y: -14 }, 10), {
		x: 20,
		y: -10,
	});
});

test("object snap modes can disable endpoints and enable nearest", () => {
	const element = rectangle();
	const elements = new Map([[element.id, element]]);
	const withoutEndpoints = findClosestSnapAnchor(
		{ x: 1, y: 1 },
		elements,
		new Set(),
		{
			includeEndpoints: false,
			includeCenters: false,
			includeMidpoints: false,
			includeNearest: false,
		},
	);
	assert.equal(withoutEndpoints, null);
	const nearest = findClosestSnapAnchor({ x: 46, y: 3 }, elements, new Set(), {
		includeEndpoints: false,
		includeCenters: false,
		includeMidpoints: false,
		includeNearest: true,
	});
	assert.equal(nearest?.kind, "nearest");
	assert.deepEqual(nearest && { x: nearest.x, y: nearest.y }, { x: 46, y: 0 });
});

test("division snap exposes a configurable symmetric count per side", () => {
	const element = rectangle();
	const elements = new Map([[element.id, element]]);
	assert.equal(normalizeCanvasSnapDivisionCount(0), 1);
	const singleTopPoint = getCanvasElementSnapPointIndicators([element], {
		includeEndpoints: false,
		includeCenters: false,
		includeMidpoints: false,
		includeDivisions: true,
		divisionCount: 1,
	}).filter((point) => point.y === 0);
	assert.equal(singleTopPoint.length, 1);
	assert.equal(singleTopPoint[0]?.x, 50);
	for (const x of [100 / 3, 200 / 3]) {
		const anchor = findClosestSnapAnchor(
			{ x, y: 0 },
			elements,
			new Set(),
			{
				includeEndpoints: false,
				includeCenters: false,
				includeMidpoints: false,
				includeDivisions: true,
				divisionCount: 2,
			},
			0.01,
		);
		assert.equal(anchor?.kind, "division");
		assert.ok(anchor && Math.abs(anchor.x - x) < 1e-9);
		assert.equal(anchor?.y, 0);
	}
	const sevenTopPoints = getCanvasElementSnapPointIndicators([element], {
		includeEndpoints: false,
		includeCenters: false,
		includeMidpoints: false,
		includeDivisions: true,
		divisionCount: 7,
	}).filter((point) => point.y === 0);
	assert.equal(sevenTopPoints.length, 7);
	assert.deepEqual(
		sevenTopPoints.map((point) => point.x),
		[12.5, 25, 37.5, 50, 62.5, 75, 87.5],
	);
});

test("division snap distributes symmetric points around circles", () => {
	const circle = rectangle({ type: "ellipse", height: 100 });
	const points = getCanvasElementSnapPointIndicators([circle], {
		includeEndpoints: false,
		includeCenters: false,
		includeMidpoints: false,
		includeQuadrants: false,
		includeDivisions: true,
		divisionCount: 2,
	});
	assert.equal(points.length, 8);
	assert.ok(points.every((point) => point.kind === "division"));
	assert.ok(
		points.every(
			(point) => Math.abs(Math.hypot(point.x - 50, point.y - 50) - 50) < 1e-9,
		),
	);
	for (let index = 0; index < points.length / 2; index++) {
		const opposite = points[index + points.length / 2];
		assert.ok(opposite);
		assert.ok(Math.abs(points[index].x + opposite.x - 100) < 1e-9);
		assert.ok(Math.abs(points[index].y + opposite.y - 100) < 1e-9);
	}
});

test("hidden snap points render only the active anchor", () => {
	const element = rectangle();
	const elements = new Map([[element.id, element]]);
	const options = {
		includeEndpoints: true,
		includeCenters: true,
		includeMidpoints: true,
	};
	const active = findClosestSnapAnchor(
		{ x: 1, y: 1 },
		elements,
		new Set(),
		options,
	);
	assert.ok(active);
	assert.deepEqual(
		getVisibleSnapPointIndicators(
			{ x: 1, y: 1 },
			elements,
			new Set(),
			options,
			active,
			false,
		),
		[{ ...active, active: true }],
	);
	assert.ok(
		getVisibleSnapPointIndicators(
			{ x: 1, y: 1 },
			elements,
			new Set(),
			options,
			active,
			true,
		).length > 1,
	);
});

test("object snap anchors follow element rotation", () => {
	const element = rectangle({ rotation: 90 });
	const anchor = findClosestSnapAnchor(
		{ x: 70, y: -30 },
		new Map([[element.id, element]]),
		new Set(),
		{
			includeEndpoints: true,
			includeCenters: false,
			includeMidpoints: false,
		},
		0.01,
	);
	assert.equal(anchor?.kind, "corner");
	assert.ok(anchor);
	assert.ok(Math.abs(anchor.x - 70) < 0.001);
	assert.ok(Math.abs(anchor.y + 30) < 0.001);
});

test("center, geometric center, and quadrant are independent object snaps", () => {
	const ellipse = rectangle({ id: "ellipse", type: "ellipse" });
	const shape = rectangle({ id: "shape" });
	const elements = new Map([
		[ellipse.id, ellipse],
		[shape.id, shape],
	]);
	const center = findClosestSnapAnchor(
		{ x: 50, y: 20 },
		elements,
		new Set([shape.id]),
		{
			includeEndpoints: false,
			includeCenters: true,
			includeMidpoints: false,
			includeGeometricCenters: false,
			includeQuadrants: false,
		},
	);
	assert.equal(center?.kind, "center");
	const geometricCenter = findClosestSnapAnchor(
		{ x: 50, y: 20 },
		elements,
		new Set([ellipse.id]),
		{
			includeEndpoints: false,
			includeCenters: false,
			includeMidpoints: false,
			includeGeometricCenters: true,
		},
	);
	assert.equal(geometricCenter?.kind, "geometric-center");
	const quadrant = findClosestSnapAnchor(
		{ x: 100, y: 20 },
		elements,
		new Set([shape.id]),
		{
			includeEndpoints: false,
			includeCenters: false,
			includeMidpoints: false,
			includeQuadrants: true,
		},
	);
	assert.equal(quadrant?.kind, "quadrant");
});

test("intersection object snap resolves crossing path segments", () => {
	const first = createBaseCanvasElement(
		{ createId: () => "first", stroke: "#111" },
		{
			type: "line",
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			points: [
				[0, 0],
				[100, 100],
			],
		},
	);
	const second = createBaseCanvasElement(
		{ createId: () => "second", stroke: "#111" },
		{
			type: "line",
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			points: [
				[0, 100],
				[100, 0],
			],
		},
	);
	const anchor = findClosestSnapAnchor(
		{ x: 52, y: 49 },
		new Map([
			[first.id, first],
			[second.id, second],
		]),
		new Set(),
		{
			includeEndpoints: false,
			includeCenters: false,
			includeMidpoints: false,
			includeIntersections: true,
		},
	);
	assert.equal(anchor?.kind, "intersection");
	assert.deepEqual(anchor && { x: anchor.x, y: anchor.y }, { x: 50, y: 50 });
});

test("extension object snap projects beyond a path endpoint", () => {
	const line = createBaseCanvasElement(
		{ createId: () => "line", stroke: "#111" },
		{
			type: "line",
			x: 0,
			y: 0,
			width: 100,
			height: 0,
			points: [
				[0, 0],
				[100, 0],
			],
		},
	);
	const anchor = findClosestSnapAnchor(
		{ x: 120, y: 2 },
		new Map([[line.id, line]]),
		new Set(),
		{
			includeEndpoints: false,
			includeCenters: false,
			includeMidpoints: false,
			includeExtensions: true,
		},
	);
	assert.equal(anchor?.kind, "extension");
	assert.deepEqual(anchor && { x: anchor.x, y: anchor.y }, { x: 120, y: 0 });
});
