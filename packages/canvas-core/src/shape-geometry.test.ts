import assert from "node:assert/strict";
import test from "node:test";
import { hitTest } from "./hit-test";
import {
	DEFAULT_CLOUD_ARC_RADIUS,
	DEFAULT_POLYGON_SIDES,
	MAX_CLOUD_ARC_RADIUS,
	MAX_POLYGON_SIDES,
	MIN_CLOUD_ARC_RADIUS,
	MIN_POLYGON_SIDES,
	buildCloudArcRadiusChanges,
	clampCloudArcRadius,
	clampPolygonSides,
	clampPyramidSections,
	getCloudSvgPath,
	getElementPolygonPoints,
	getFreeformRevisionCloudSvgPath,
	getPyramidDividerSegments,
	getTrianglePoints,
} from "./shape-geometry";
import type { CanvasElement } from "./types";

const triangle: CanvasElement = {
	id: "triangle",
	type: "triangle",
	x: 10,
	y: 20,
	width: 200,
	height: 120,
	rotation: 0,
	fill: "transparent",
	stroke: "#111111",
	strokeWidth: 2,
	strokeStyle: "solid",
	opacity: 100,
	locked: false,
	groupId: null,
	flipX: false,
	flipY: false,
};

test("builds triangle geometry and evenly spaced pyramid dividers", () => {
	assert.deepEqual(getTrianglePoints(triangle), [
		[110, 20],
		[210, 140],
		[10, 140],
	]);
	assert.deepEqual(getPyramidDividerSegments(triangle, 4), [
		{ x1: 85, y1: 50, x2: 135, y2: 50 },
		{ x1: 60, y1: 80, x2: 160, y2: 80 },
		{ x1: 35, y1: 110, x2: 185, y2: 110 },
	]);
});

test("clamps pyramid sections to the supported persisted range", () => {
	assert.equal(clampPyramidSections(undefined), 1);
	assert.equal(clampPyramidSections(-4), 1);
	assert.equal(clampPyramidSections(4.6), 5);
	assert.equal(clampPyramidSections(99), 12);
});

test("builds bounded polygon variants and clamps their corner count", () => {
	assert.equal(clampPolygonSides(undefined), DEFAULT_POLYGON_SIDES);
	assert.equal(clampPolygonSides(2), MIN_POLYGON_SIDES);
	assert.equal(clampPolygonSides(7.6), 8);
	assert.equal(clampPolygonSides(99), MAX_POLYGON_SIDES);

	const octagon: CanvasElement = {
		...triangle,
		id: "octagon",
		type: "rectangle",
		polygonSides: 8,
	};
	const points = getElementPolygonPoints(octagon);
	assert.equal(points.length, 8);
	assert.equal(Math.round(Math.min(...points.map(([x]) => x))), octagon.x);
	assert.equal(
		Math.round(Math.max(...points.map(([x]) => x))),
		octagon.x + octagon.width,
	);
	assert.equal(Math.round(Math.min(...points.map(([, y]) => y))), octagon.y);
	assert.equal(
		Math.round(Math.max(...points.map(([, y]) => y))),
		octagon.y + octagon.height,
	);
	assert.equal(hitTest(octagon, 110, 80), true);
	assert.equal(hitTest(octagon, 10, 20), false);
});

test("clamps revision-cloud arc radii to the supported range", () => {
	assert.equal(clampCloudArcRadius(undefined), DEFAULT_CLOUD_ARC_RADIUS);
	assert.equal(clampCloudArcRadius(-2), MIN_CLOUD_ARC_RADIUS);
	assert.equal(clampCloudArcRadius(23.5), 23.5);
	assert.equal(clampCloudArcRadius(100), MAX_CLOUD_ARC_RADIUS);
});

test("resizes freeform cloud bounds without moving its baseline points", () => {
	const cloud: CanvasElement = {
		...triangle,
		id: "cloud",
		type: "cloud",
		x: 2,
		y: 12,
		width: 136,
		height: 96,
		cloudArcRadius: 8,
		points: [
			[8, 8],
			[128, 18],
			[108, 88],
		],
	};
	const originalAbsolutePoints = cloud.points?.map(([x, y]) => [
		cloud.x + x,
		cloud.y + y,
	]);
	const changes = buildCloudArcRadiusChanges(cloud, 28);

	assert.deepEqual(
		changes.points?.map(([x, y]) => [
			(changes.x ?? cloud.x) + x,
			(changes.y ?? cloud.y) + y,
		]),
		originalAbsolutePoints,
	);
	assert.deepEqual(
		{
			x: changes.x,
			y: changes.y,
			width: changes.width,
			height: changes.height,
			cloudArcRadius: changes.cloudArcRadius,
		},
		{ x: -18, y: -8, width: 176, height: 136, cloudArcRadius: 28 },
	);
});

test("triangle hit testing follows the silhouette", () => {
	assert.equal(hitTest(triangle, 110, 60), true);
	assert.equal(hitTest(triangle, 15, 25), false);
});

test("cloud path builds a scalable revision cloud around every edge", () => {
	const path = getCloudSvgPath({ x: 10, y: 20, width: 200, height: 100 });
	assert.match(path, /^M 26 36 /);
	assert.equal(path.match(/\bQ\b/g)?.length, 14);
	assert.match(path, /Q 210 .* 194 104/);
	assert.match(path, /Q 10 .* 26 36 Z$/);
});

test("revision cloud remains finite for tiny drag bounds", () => {
	const path = getCloudSvgPath({ x: 4, y: 7, width: 1, height: 1 });
	assert.equal(path.includes("NaN"), false);
	assert.equal(path.includes("Infinity"), false);
	assert.match(path, /Z$/);
});

test("cloud arc radius controls scallop size for rectangular and freeform clouds", () => {
	const smallRect = getCloudSvgPath({
		x: 0,
		y: 0,
		width: 240,
		height: 160,
		cloudArcRadius: 6,
	});
	const largeRect = getCloudSvgPath({
		x: 0,
		y: 0,
		width: 240,
		height: 160,
		cloudArcRadius: 30,
	});
	assert.ok(
		(smallRect.match(/\bQ\b/g)?.length ?? 0) >
			(largeRect.match(/\bQ\b/g)?.length ?? 0),
	);

	const points: [number, number][] = [
		[20, 20],
		[180, 20],
		[160, 120],
		[30, 100],
	];
	const smallFreeform = getFreeformRevisionCloudSvgPath(points, 6);
	const largeFreeform = getFreeformRevisionCloudSvgPath(points, 30);
	assert.ok(
		(smallFreeform.match(/\bQ\b/g)?.length ?? 0) >
			(largeFreeform.match(/\bQ\b/g)?.length ?? 0),
	);
});

test("freeform revision cloud follows every point-to-point edge", () => {
	const path = getFreeformRevisionCloudSvgPath([
		[10, 10],
		[110, 10],
		[90, 90],
		[20, 80],
	]);
	assert.match(path, /^M 10 10 /);
	assert.ok((path.match(/\bQ\b/g)?.length ?? 0) > 4);
	assert.match(path, /Q [^ ]+ -/);
	assert.match(path, /10 10 Z$/);
});
