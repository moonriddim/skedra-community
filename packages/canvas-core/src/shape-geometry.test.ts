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
	canTrimCanvasShape,
	clampCloudArcRadius,
	clampPolygonSides,
	clampPyramidSections,
	getCanvasShapeContourPoints,
	getCanvasShapePathProgressAtPoint,
	getCanvasShapePointAtPathProgress,
	getCanvasShapeTrimSvgPath,
	getCloudSvgPath,
	getElementPolygonPoints,
	getEllipseAngleAtPoint,
	getEllipseArcSvgPath,
	getFreeformRevisionCloudSvgPath,
	getPyramidDividerSegments,
	getRetainedCanvasShapeTrim,
	getRetainedEllipseArcAngles,
	getTrianglePoints,
	getTrimmedCanvasShapePolyline,
	resolveCanvasShapeTrimEndpointDrag,
	resolveEllipseArcEndpointDrag,
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

	const pentagon: CanvasElement = {
		...octagon,
		id: "pentagon",
		polygonSides: 5,
	};
	const pentagonPoints = getElementPolygonPoints(pentagon);
	const topY = Math.min(...pentagonPoints.map(([, y]) => y));
	const bottomY = Math.max(...pentagonPoints.map(([, y]) => y));
	assert.deepEqual(
		pentagonPoints.filter(([, y]) => Math.abs(y - topY) < 0.001),
		[[pentagon.x + pentagon.width / 2, pentagon.y]],
	);
	assert.equal(
		pentagonPoints.filter(([, y]) => Math.abs(y - bottomY) < 0.001).length,
		2,
	);
});

test("clamps revision-cloud arc radii to the supported range", () => {
	assert.equal(clampCloudArcRadius(undefined), DEFAULT_CLOUD_ARC_RADIUS);
	assert.equal(clampCloudArcRadius(-2), MIN_CLOUD_ARC_RADIUS);
	assert.equal(clampCloudArcRadius(23.5), 23.5);
	assert.equal(clampCloudArcRadius(100), MAX_CLOUD_ARC_RADIUS);
});

test("builds ellipse arcs from two cut points and keeps the short side", () => {
	const ellipse: CanvasElement = {
		...triangle,
		id: "ellipse",
		type: "ellipse",
		x: 10,
		y: 20,
		width: 200,
		height: 100,
	};
	assert.equal(getEllipseAngleAtPoint(ellipse, { x: 210, y: 70 }), 0);
	assert.equal(getEllipseAngleAtPoint(ellipse, { x: 110, y: 120 }), 90);

	const shortArc = getRetainedEllipseArcAngles(350, 80);
	assert.deepEqual(shortArc, {
		startAngle: 350,
		endAngle: 80,
		sweepAngle: 90,
	});
	assert.deepEqual(getRetainedEllipseArcAngles(350, 80, true), {
		startAngle: 80,
		endAngle: 350,
		sweepAngle: 270,
	});
	assert.equal(getRetainedEllipseArcAngles(45, 45), null);
	assert.match(
		getEllipseArcSvgPath(
			ellipse,
			shortArc?.startAngle ?? 0,
			shortArc?.endAngle ?? 0,
		),
		/^M .* A 100 50 0 0 1 /,
	);
});

test("ellipse arc hit testing ignores the removed part of the circle", () => {
	const arc: CanvasElement = {
		...triangle,
		id: "arc",
		type: "ellipse",
		x: 10,
		y: 20,
		width: 200,
		height: 100,
		arcStartAngle: 0,
		arcEndAngle: 90,
	};
	assert.equal(hitTest(arc, 210, 70), true);
	assert.equal(hitTest(arc, 110, 120), true);
	assert.equal(hitTest(arc, 10, 70), false);
	assert.equal(hitTest(arc, 110, 20), false);
});

test("drags either ellipse arc endpoint and snaps back to a full ellipse", () => {
	const arc: CanvasElement = {
		...triangle,
		id: "editable-arc",
		type: "ellipse",
		x: 10,
		y: 20,
		width: 200,
		height: 100,
		arcStartAngle: 0,
		arcEndAngle: 180,
	};
	const movedStart = resolveEllipseArcEndpointDrag(
		arc,
		"start",
		{ x: 110, y: 120 },
		5,
	);
	assert.deepEqual(movedStart?.changes, {
		arcStartAngle: 90,
		arcEndAngle: 180,
	});
	assert.equal(movedStart?.snappedToFullEllipse, false);

	const restored = resolveEllipseArcEndpointDrag(
		arc,
		"end",
		{ x: 208, y: 70 },
		5,
	);
	assert.equal(restored?.snappedToFullEllipse, true);
	assert.deepEqual(restored?.changes, {
		arcStartAngle: undefined,
		arcEndAngle: undefined,
	});
	assert.deepEqual(restored?.snapPoint, { x: 210, y: 70 });
});

test("trims straight closed shapes along their perimeter and hit tests only the retained path", () => {
	const rectangle: CanvasElement = {
		...triangle,
		id: "trimmed-rectangle",
		type: "rectangle",
		pathTrimStart: 0.125,
		pathTrimEnd: 0.375,
	};
	assert.deepEqual(getCanvasShapePointAtPathProgress(rectangle, 0.125), {
		x: 90,
		y: 20,
	});
	assert.equal(
		getCanvasShapePathProgressAtPoint(rectangle, { x: 210, y: 60 }),
		0.375,
	);
	assert.deepEqual(getTrimmedCanvasShapePolyline(rectangle), [
		{ x: 90, y: 20 },
		{ x: 210, y: 20 },
		{ x: 210, y: 60 },
	]);
	assert.equal(
		getCanvasShapeTrimSvgPath(rectangle),
		"M 90 20 L 210 20 L 210 60",
	);
	assert.equal(hitTest(rectangle, 150, 20), true);
	assert.equal(hitTest(rectangle, 10, 80), false);

	const shortTrim = getRetainedCanvasShapeTrim(rectangle, 0.9, 0.1);
	assert.equal(shortTrim?.kind, "path");
	assert.equal(shortTrim?.start, 0.9);
	assert.equal(shortTrim?.end, 0.1);
	assert.ok(Math.abs((shortTrim?.sweep ?? 0) - 0.2) < 1e-9);
	assert.deepEqual(
		getTrimmedCanvasShapePolyline({
			...rectangle,
			pathTrimStart: 0.9,
			pathTrimEnd: 0.1,
		}),
		[
			{ x: 10, y: 84 },
			{ x: 10, y: 20 },
			{ x: 74, y: 20 },
		],
	);
	assert.deepEqual(getRetainedCanvasShapeTrim(rectangle, 0.9, 0.1, true), {
		kind: "path",
		start: 0.1,
		end: 0.9,
		sweep: 0.8,
	});
});

test("drags polygon trim endpoints and restores the full closed shape", () => {
	const polygon: CanvasElement = {
		...triangle,
		id: "editable-polygon",
		type: "rectangle",
		polygonSides: 8,
		pathTrimStart: 0.1,
		pathTrimEnd: 0.6,
	};
	const moved = resolveCanvasShapeTrimEndpointDrag(
		polygon,
		"start",
		{ x: 210, y: 80 },
		5,
	);
	assert.equal(moved?.snappedToFullShape, false);
	assert.notEqual(moved?.changes.pathTrimStart, polygon.pathTrimStart);
	assert.equal(moved?.changes.pathTrimEnd, polygon.pathTrimEnd);

	const opposite = getCanvasShapePointAtPathProgress(polygon, 0.1, true);
	assert.ok(opposite);
	const restored = resolveCanvasShapeTrimEndpointDrag(
		polygon,
		"end",
		opposite,
		1,
	);
	assert.equal(restored?.snappedToFullShape, true);
	assert.deepEqual(restored?.changes, {
		arcStartAngle: undefined,
		arcEndAngle: undefined,
		pathTrimStart: undefined,
		pathTrimEnd: undefined,
	});
});

test("rounded rectangles and diamonds retain their visible curved contour", () => {
	for (const type of ["rectangle", "diamond"] as const) {
		const rounded: CanvasElement = {
			...triangle,
			id: `rounded-${type}`,
			type,
			cornerRadiusPercent: 25,
			pathTrimStart: 0.8,
			pathTrimEnd: 0.2,
		};
		assert.equal(canTrimCanvasShape(rounded), true);
		assert.equal(getCanvasShapeContourPoints(rounded).length, 68);
		const retained = getTrimmedCanvasShapePolyline(rounded);
		assert.ok(retained.length > 20);
		assert.ok(getCanvasShapeTrimSvgPath(rounded).split(" L ").length > 20);
	}
	assert.equal(
		canTrimCanvasShape({
			...triangle,
			type: "rectangle",
			customData: { skedraType: "sticky-note" },
		}),
		false,
	);
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
