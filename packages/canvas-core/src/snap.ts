import {
	type BBox,
	getBBox,
	getUntransformedBBox,
	inverseTransformCanvasElementPoint,
	transformCanvasElementPoint,
} from "./geometry";
import { getElementPolygonPoints, isPolygonVariant } from "./shape-geometry";
import { type CanvasElement, GRID_SIZE } from "./types";

const SNAP_THRESHOLD = 6;
const SNAP_POINT_THRESHOLD = 12;
const SNAP_POINT_VISIBILITY_DISTANCE = 28;
export const MIN_CANVAS_SNAP_DIVISION_COUNT = 1;
export const MAX_CANVAS_SNAP_DIVISION_COUNT = 8;
export const DEFAULT_CANVAS_SNAP_DIVISION_COUNT = 2;

export type SnapAnchorKind =
	| "corner"
	| "edge-midpoint"
	| "center"
	| "endpoint"
	| "segment-midpoint"
	| "division"
	| "geometric-center"
	| "quadrant"
	| "intersection"
	| "extension"
	| "insertion"
	| "nearest";

export type CanvasObjectSnapMode =
	| "endpoint"
	| "midpoint"
	| "division"
	| "center"
	| "geometric-center"
	| "quadrant"
	| "intersection"
	| "extension"
	| "insertion"
	| "nearest";

export interface SnapPointOptions {
	includeCenters: boolean;
	includeMidpoints: boolean;
	includeDivisions?: boolean;
	/** Number of symmetric interior points per straight side or ellipse quadrant. */
	divisionCount?: number;
	includeEndpoints?: boolean;
	includeNearest?: boolean;
	includeGeometricCenters?: boolean;
	includeQuadrants?: boolean;
	includeIntersections?: boolean;
	includeExtensions?: boolean;
	includeInsertions?: boolean;
}

export interface SnapAnchor {
	elementId: string;
	kind: SnapAnchorKind;
	x: number;
	y: number;
}

/** Keeps host-configured grid spacing finite and usable. */
export function normalizeCanvasGridSize(size: number): number {
	return Number.isFinite(size)
		? Math.max(1, Math.min(1000, Math.round(size)))
		: GRID_SIZE;
}

/** Shared scalar grid snap used by every editor host. */
export function snapCanvasCoordinateToGrid(
	value: number,
	gridSize = GRID_SIZE,
): number {
	const size = normalizeCanvasGridSize(gridSize);
	return Math.round(value / size) * size;
}

/** Shared point grid snap used by every editor host. */
export function snapCanvasPointToGrid(
	point: { x: number; y: number },
	gridSize = GRID_SIZE,
): { x: number; y: number } {
	return {
		x: snapCanvasCoordinateToGrid(point.x, gridSize),
		y: snapCanvasCoordinateToGrid(point.y, gridSize),
	};
}

export interface SnapPointIndicator extends SnapAnchor {
	active: boolean;
}

export interface SnapGuide {
	orientation: "h" | "v";
	pos: number;
	from: number;
	to: number;
}

export interface SnapResult {
	dx: number;
	dy: number;
	guides: SnapGuide[];
}

interface SnapPoint {
	pos: number;
	min: number;
	max: number;
}

function createAnchor(
	elementId: string,
	kind: SnapAnchorKind,
	x: number,
	y: number,
): SnapAnchor {
	return { elementId, kind, x, y };
}

export function normalizeCanvasSnapDivisionCount(count: number): number {
	return Number.isFinite(count)
		? Math.max(
				MIN_CANVAS_SNAP_DIVISION_COUNT,
				Math.min(MAX_CANVAS_SNAP_DIVISION_COUNT, Math.round(count)),
			)
		: DEFAULT_CANVAS_SNAP_DIVISION_COUNT;
}

function getDivisionAmounts(
	divisionCount: number | undefined,
	includeMidpoints: boolean,
): readonly number[] {
	const count = normalizeCanvasSnapDivisionCount(
		divisionCount ?? DEFAULT_CANVAS_SNAP_DIVISION_COUNT,
	);
	return Array.from(
		{ length: count },
		(_, index) => (index + 1) / (count + 1),
	).filter((amount) => !includeMidpoints || Math.abs(amount - 0.5) > 1e-9);
}

function createStraightDivisionAnchors(
	elementId: string,
	points: ReadonlyArray<{ x: number; y: number }>,
	closed: boolean,
	includeMidpoints: boolean,
	divisionCount?: number,
): SnapAnchor[] {
	if (points.length < 2) return [];
	const anchors: SnapAnchor[] = [];
	const segmentCount = closed ? points.length : points.length - 1;
	for (let index = 0; index < segmentCount; index++) {
		const start = points[index];
		const end = points[(index + 1) % points.length];
		for (const amount of getDivisionAmounts(divisionCount, includeMidpoints)) {
			anchors.push(
				createAnchor(
					elementId,
					"division",
					start.x + (end.x - start.x) * amount,
					start.y + (end.y - start.y) * amount,
				),
			);
		}
	}
	return anchors;
}

function createEllipseDivisionAnchors(
	elementId: string,
	center: { x: number; y: number },
	radiusX: number,
	radiusY: number,
	divisionCount?: number,
): SnapAnchor[] {
	const count = normalizeCanvasSnapDivisionCount(
		divisionCount ?? DEFAULT_CANVAS_SNAP_DIVISION_COUNT,
	);
	const anchors: SnapAnchor[] = [];
	const quadrantAngle = Math.PI / 2;
	for (let quadrant = 0; quadrant < 4; quadrant++) {
		const startAngle = -quadrantAngle + quadrant * quadrantAngle;
		for (let index = 1; index <= count; index++) {
			const angle = startAngle + (quadrantAngle * index) / (count + 1);
			anchors.push(
				createAnchor(
					elementId,
					"division",
					center.x + radiusX * Math.cos(angle),
					center.y + radiusY * Math.sin(angle),
				),
			);
		}
	}
	return anchors;
}

function getPathAnchors(
	el: CanvasElement,
	options: SnapPointOptions,
): SnapAnchor[] {
	const points = el.points ?? [];
	if (points.length === 0) return [];

	const anchors: SnapAnchor[] =
		el.closed || options.includeEndpoints === false
			? []
			: [
					createAnchor(
						el.id,
						"endpoint",
						el.x + points[0][0],
						el.y + points[0][1],
					),
				];
	const lastPoint = points[points.length - 1];
	if (
		options.includeEndpoints !== false &&
		!el.closed &&
		lastPoint &&
		points.length > 1
	) {
		anchors.push(
			createAnchor(el.id, "endpoint", el.x + lastPoint[0], el.y + lastPoint[1]),
		);
	}
	if (options.includeGeometricCenters && el.closed) {
		const bbox = getUntransformedBBox(el);
		anchors.push(
			createAnchor(
				el.id,
				"geometric-center",
				bbox.x + bbox.width / 2,
				bbox.y + bbox.height / 2,
			),
		);
	}
	if (options.includeInsertions) {
		anchors.push(createAnchor(el.id, "insertion", el.x, el.y));
	}

	if (
		(!options.includeMidpoints && !options.includeDivisions) ||
		points.length < 2
	) {
		return anchors.map((anchor) => ({
			...anchor,
			...transformCanvasElementPoint(el, anchor),
		}));
	}

	if (el.type === "arrow" && el.arrowMode === "curve" && points.length >= 3) {
		const [start, ctrl, end] = points;
		const addCurveAnchor = (kind: SnapAnchorKind, t: number) => {
			const mt = 1 - t;
			anchors.push(
				createAnchor(
					el.id,
					kind,
					el.x + mt * mt * start[0] + 2 * mt * t * ctrl[0] + t * t * end[0],
					el.y + mt * mt * start[1] + 2 * mt * t * ctrl[1] + t * t * end[1],
				),
			);
		};
		if (options.includeMidpoints) addCurveAnchor("segment-midpoint", 0.5);
		if (options.includeDivisions) {
			for (const amount of getDivisionAmounts(
				options.divisionCount,
				options.includeMidpoints,
			)) {
				addCurveAnchor("division", amount);
			}
		}
		return anchors.map((anchor) => ({
			...anchor,
			...transformCanvasElementPoint(el, anchor),
		}));
	}

	const segmentCount = el.closed ? points.length : points.length - 1;
	for (let index = 0; index < segmentCount; index++) {
		const [x1, y1] = points[index];
		const [x2, y2] = points[(index + 1) % points.length];
		if (options.includeMidpoints) {
			anchors.push(
				createAnchor(
					el.id,
					"segment-midpoint",
					el.x + (x1 + x2) / 2,
					el.y + (y1 + y2) / 2,
				),
			);
		}
		if (options.includeDivisions) {
			for (const amount of getDivisionAmounts(
				options.divisionCount,
				options.includeMidpoints,
			)) {
				anchors.push(
					createAnchor(
						el.id,
						"division",
						el.x + x1 + (x2 - x1) * amount,
						el.y + y1 + (y2 - y1) * amount,
					),
				);
			}
		}
	}

	return anchors.map((anchor) => ({
		...anchor,
		...transformCanvasElementPoint(el, anchor),
	}));
}

function getShapeAnchors(
	el: CanvasElement,
	options: SnapPointOptions,
): SnapAnchor[] {
	const bbox = getUntransformedBBox(el);
	const left = bbox.x;
	const right = bbox.x + bbox.width;
	const top = bbox.y;
	const bottom = bbox.y + bbox.height;
	const centerX = bbox.x + bbox.width / 2;
	const centerY = bbox.y + bbox.height / 2;
	if (isPolygonVariant(el)) {
		const polygonPoints = getElementPolygonPoints({
			...el,
			x: bbox.x,
			y: bbox.y,
			width: bbox.width,
			height: bbox.height,
		}).map(([x, y]) => ({ x, y }));
		return [
			...(options.includeEndpoints === false
				? []
				: polygonPoints.map((point) =>
						createAnchor(el.id, "corner", point.x, point.y),
					)),
			...(options.includeDivisions
				? createStraightDivisionAnchors(
						el.id,
						polygonPoints,
						true,
						options.includeMidpoints,
						options.divisionCount,
					)
				: []),
			...((options.includeGeometricCenters ?? options.includeCenters)
				? [createAnchor(el.id, "geometric-center", centerX, centerY)]
				: []),
			...(options.includeInsertions
				? [createAnchor(el.id, "insertion", el.x, el.y)]
				: []),
		].map((anchor) => ({
			...anchor,
			...transformCanvasElementPoint(el, anchor),
		}));
	}

	switch (el.type) {
		case "ellipse":
			return [
				...(options.includeQuadrants
					? [
							createAnchor(el.id, "quadrant", centerX, top),
							createAnchor(el.id, "quadrant", right, centerY),
							createAnchor(el.id, "quadrant", centerX, bottom),
							createAnchor(el.id, "quadrant", left, centerY),
						]
					: []),
				...(options.includeCenters
					? [createAnchor(el.id, "center", centerX, centerY)]
					: []),
				...(options.includeDivisions
					? createEllipseDivisionAnchors(
							el.id,
							{ x: centerX, y: centerY },
							bbox.width / 2,
							bbox.height / 2,
							options.divisionCount,
						)
					: []),
				...(options.includeInsertions
					? [createAnchor(el.id, "insertion", el.x, el.y)]
					: []),
			].map((anchor) => ({
				...anchor,
				...transformCanvasElementPoint(el, anchor),
			}));
		case "diamond":
			return [
				...(options.includeEndpoints === false
					? []
					: [
							createAnchor(el.id, "corner", centerX, top),
							createAnchor(el.id, "corner", right, centerY),
							createAnchor(el.id, "corner", centerX, bottom),
							createAnchor(el.id, "corner", left, centerY),
						]),
				...(options.includeDivisions
					? createStraightDivisionAnchors(
							el.id,
							[
								{ x: centerX, y: top },
								{ x: right, y: centerY },
								{ x: centerX, y: bottom },
								{ x: left, y: centerY },
							],
							true,
							options.includeMidpoints,
							options.divisionCount,
						)
					: []),
				...((options.includeGeometricCenters ?? options.includeCenters)
					? [createAnchor(el.id, "geometric-center", centerX, centerY)]
					: []),
				...(options.includeInsertions
					? [createAnchor(el.id, "insertion", el.x, el.y)]
					: []),
			].map((anchor) => ({
				...anchor,
				...transformCanvasElementPoint(el, anchor),
			}));
		case "triangle":
			return [
				...(options.includeEndpoints === false
					? []
					: [
							createAnchor(el.id, "corner", centerX, top),
							createAnchor(el.id, "corner", right, bottom),
							createAnchor(el.id, "corner", left, bottom),
						]),
				...(options.includeMidpoints
					? [
							createAnchor(
								el.id,
								"edge-midpoint",
								(centerX + right) / 2,
								(top + bottom) / 2,
							),
							createAnchor(el.id, "edge-midpoint", centerX, bottom),
							createAnchor(
								el.id,
								"edge-midpoint",
								(left + centerX) / 2,
								(top + bottom) / 2,
							),
						]
					: []),
				...(options.includeDivisions
					? createStraightDivisionAnchors(
							el.id,
							[
								{ x: centerX, y: top },
								{ x: right, y: bottom },
								{ x: left, y: bottom },
							],
							true,
							options.includeMidpoints,
							options.divisionCount,
						)
					: []),
				...((options.includeGeometricCenters ?? options.includeCenters)
					? [createAnchor(el.id, "geometric-center", centerX, centerY)]
					: []),
				...(options.includeInsertions
					? [createAnchor(el.id, "insertion", el.x, el.y)]
					: []),
			].map((anchor) => ({
				...anchor,
				...transformCanvasElementPoint(el, anchor),
			}));
		default:
			return [
				...(options.includeEndpoints === false
					? []
					: [
							createAnchor(el.id, "corner", left, top),
							createAnchor(el.id, "corner", right, top),
							createAnchor(el.id, "corner", right, bottom),
							createAnchor(el.id, "corner", left, bottom),
						]),
				...(options.includeMidpoints
					? [
							createAnchor(el.id, "edge-midpoint", centerX, top),
							createAnchor(el.id, "edge-midpoint", right, centerY),
							createAnchor(el.id, "edge-midpoint", centerX, bottom),
							createAnchor(el.id, "edge-midpoint", left, centerY),
						]
					: []),
				...(options.includeDivisions
					? createStraightDivisionAnchors(
							el.id,
							[
								{ x: left, y: top },
								{ x: right, y: top },
								{ x: right, y: bottom },
								{ x: left, y: bottom },
							],
							true,
							options.includeMidpoints,
							options.divisionCount,
						)
					: []),
				...((options.includeGeometricCenters ?? options.includeCenters)
					? [createAnchor(el.id, "geometric-center", centerX, centerY)]
					: []),
				...(options.includeInsertions
					? [createAnchor(el.id, "insertion", el.x, el.y)]
					: []),
			].map((anchor) => ({
				...anchor,
				...transformCanvasElementPoint(el, anchor),
			}));
	}
}

function getElementSnapAnchors(
	el: CanvasElement,
	options: SnapPointOptions,
): SnapAnchor[] {
	if (
		el.type === "line" ||
		el.type === "arrow" ||
		el.type === "freehand" ||
		(el.type === "cloud" && (el.points?.length ?? 0) >= 3)
	) {
		return getPathAnchors(el, options);
	}
	return getShapeAnchors(el, options);
}

/** Static snap points for selected objects, independent of cursor movement. */
export function getCanvasElementSnapPointIndicators(
	elements: readonly CanvasElement[],
	options: SnapPointOptions,
): SnapPointIndicator[] {
	return elements.flatMap((element) =>
		getElementSnapAnchors(element, options).map((anchor) => ({
			...anchor,
			active: false,
		})),
	);
}

/** Combines persistent selection points with transient hover/active points. */
export function mergeCanvasSnapPointIndicators(
	...groups: readonly SnapPointIndicator[][]
): SnapPointIndicator[] {
	const indicators = new Map<string, SnapPointIndicator>();
	for (const group of groups) {
		for (const indicator of group) {
			const key = `${indicator.elementId}:${indicator.kind}:${indicator.x}:${indicator.y}`;
			const existing = indicators.get(key);
			if (!existing || indicator.active) indicators.set(key, indicator);
		}
	}
	return [...indicators.values()];
}

/** Shared selected-object plus transient snap-point presentation. */
export function getCanvasSelectionSnapPointIndicators(
	selectedElements: readonly CanvasElement[],
	selectedOptions: SnapPointOptions | null,
	transientIndicators: readonly SnapPointIndicator[],
): SnapPointIndicator[] {
	const selectedIndicators = selectedOptions
		? getCanvasElementSnapPointIndicators(selectedElements, selectedOptions)
		: [];
	return mergeCanvasSnapPointIndicators(selectedIndicators, [
		...transientIndicators,
	]);
}

type SnapSegment = {
	elementId: string;
	start: { x: number; y: number };
	end: { x: number; y: number };
};

function getElementSnapSegments(el: CanvasElement): SnapSegment[] {
	let points: Array<{ x: number; y: number }> = [];
	let closed = true;
	if (
		el.type === "line" ||
		el.type === "arrow" ||
		el.type === "freehand" ||
		(el.type === "cloud" && (el.points?.length ?? 0) >= 3)
	) {
		points = (el.points ?? []).map(([x, y]) =>
			transformCanvasElementPoint(el, { x: el.x + x, y: el.y + y }),
		);
		closed = Boolean(el.closed);
	} else if (el.type !== "ellipse") {
		const bbox = getUntransformedBBox(el);
		const left = bbox.x;
		const right = bbox.x + bbox.width;
		const top = bbox.y;
		const bottom = bbox.y + bbox.height;
		const centerX = bbox.x + bbox.width / 2;
		const centerY = bbox.y + bbox.height / 2;
		const localPoints =
			el.type === "diamond" || isPolygonVariant(el)
				? getElementPolygonPoints({
						...el,
						x: bbox.x,
						y: bbox.y,
						width: bbox.width,
						height: bbox.height,
					}).map(([x, y]) => ({ x, y }))
				: el.type === "triangle"
					? [
							{ x: centerX, y: top },
							{ x: right, y: bottom },
							{ x: left, y: bottom },
						]
					: [
							{ x: left, y: top },
							{ x: right, y: top },
							{ x: right, y: bottom },
							{ x: left, y: bottom },
						];
		points = localPoints.map((point) => transformCanvasElementPoint(el, point));
	}
	if (points.length < 2) return [];
	const segmentCount = closed ? points.length : points.length - 1;
	return Array.from({ length: segmentCount }, (_, index) => ({
		elementId: el.id,
		start: points[index],
		end: points[(index + 1) % points.length],
	}));
}

function intersectSegments(a: SnapSegment, b: SnapSegment) {
	const x1 = a.start.x;
	const y1 = a.start.y;
	const x2 = a.end.x;
	const y2 = a.end.y;
	const x3 = b.start.x;
	const y3 = b.start.y;
	const x4 = b.end.x;
	const y4 = b.end.y;
	const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
	if (Math.abs(denominator) < 1e-9) return null;
	const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
	const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;
	if (t < 0 || t > 1 || u < 0 || u > 1) return null;
	return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

function getDistanceToSegment(
	segment: SnapSegment,
	point: { x: number; y: number },
) {
	const closest = closestPointOnSegment(point, segment.start, segment.end);
	return Math.hypot(closest.x - point.x, closest.y - point.y);
}

function getIntersectionAnchors(
	elements: Map<string, CanvasElement>,
	excludeIds: Set<string>,
	queryPoint?: { x: number; y: number },
	threshold = Number.POSITIVE_INFINITY,
): SnapAnchor[] {
	const segments: SnapSegment[] = [];
	for (const [id, el] of elements) {
		if (excludeIds.has(id) || el.locked) continue;
		for (const segment of getElementSnapSegments(el)) {
			if (queryPoint && getDistanceToSegment(segment, queryPoint) > threshold) {
				continue;
			}
			segments.push(segment);
		}
	}
	const anchors: SnapAnchor[] = [];
	for (let aIndex = 0; aIndex < segments.length; aIndex++) {
		for (let bIndex = aIndex + 1; bIndex < segments.length; bIndex++) {
			const a = segments[aIndex];
			const b = segments[bIndex];
			if (a.elementId === b.elementId) continue;
			const point = intersectSegments(a, b);
			if (!point) continue;
			if (
				anchors.some(
					(anchor) =>
						Math.abs(anchor.x - point.x) < 0.001 &&
						Math.abs(anchor.y - point.y) < 0.001,
				)
			) {
				continue;
			}
			anchors.push(
				createAnchor(
					`${a.elementId}:${b.elementId}`,
					"intersection",
					point.x,
					point.y,
				),
			);
		}
	}
	return anchors;
}

function getClosestExtensionAnchor(
	el: CanvasElement,
	point: { x: number; y: number },
): SnapAnchor | null {
	if (el.type !== "line" && el.type !== "arrow" && el.type !== "freehand") {
		return null;
	}
	let best: SnapAnchor | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const segment of getElementSnapSegments(el)) {
		const dx = segment.end.x - segment.start.x;
		const dy = segment.end.y - segment.start.y;
		const lengthSquared = dx * dx + dy * dy;
		if (lengthSquared === 0) continue;
		const amount =
			((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) /
			lengthSquared;
		if (amount >= 0 && amount <= 1) continue;
		const candidate = {
			x: segment.start.x + amount * dx,
			y: segment.start.y + amount * dy,
		};
		const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
		if (distance < bestDistance) {
			bestDistance = distance;
			best = createAnchor(el.id, "extension", candidate.x, candidate.y);
		}
	}
	return best;
}

function distanceToBBoxPoint(bbox: BBox, x: number, y: number) {
	const dx = Math.max(bbox.x - x, 0, x - (bbox.x + bbox.width));
	const dy = Math.max(bbox.y - y, 0, y - (bbox.y + bbox.height));
	return Math.hypot(dx, dy);
}

function isSameAnchor(a: SnapAnchor, b: SnapAnchor) {
	return (
		a.elementId === b.elementId &&
		a.kind === b.kind &&
		a.x === b.x &&
		a.y === b.y
	);
}

function closestPointOnSegment(
	point: { x: number; y: number },
	start: { x: number; y: number },
	end: { x: number; y: number },
) {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const lengthSquared = dx * dx + dy * dy;
	if (lengthSquared === 0) return start;
	const amount = Math.max(
		0,
		Math.min(
			1,
			((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
		),
	);
	return { x: start.x + amount * dx, y: start.y + amount * dy };
}

function closestPointOnSegments(
	point: { x: number; y: number },
	segments: Array<[{ x: number; y: number }, { x: number; y: number }]>,
) {
	let closest = point;
	let closestDistance = Number.POSITIVE_INFINITY;
	for (const [start, end] of segments) {
		const candidate = closestPointOnSegment(point, start, end);
		const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
		if (distance < closestDistance) {
			closest = candidate;
			closestDistance = distance;
		}
	}
	return closest;
}

function closestPointOnEllipse(
	point: { x: number; y: number },
	center: { x: number; y: number },
	radiusX: number,
	radiusY: number,
) {
	const localX = point.x - center.x;
	const localY = point.y - center.y;
	if (localX === 0 && localY === 0) {
		return radiusX <= radiusY
			? { x: center.x + radiusX, y: center.y }
			: { x: center.x, y: center.y + radiusY };
	}

	let angle = Math.atan2(localY * radiusX, localX * radiusY);
	for (let iteration = 0; iteration < 12; iteration++) {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const ellipseX = radiusX * cos;
		const ellipseY = radiusY * sin;
		const tangentX = -radiusX * sin;
		const tangentY = radiusY * cos;
		const secondX = -radiusX * cos;
		const secondY = -radiusY * sin;
		const dx = ellipseX - localX;
		const dy = ellipseY - localY;
		const firstDerivative = 2 * (dx * tangentX + dy * tangentY);
		const secondDerivative =
			2 *
			(tangentX * tangentX + tangentY * tangentY + dx * secondX + dy * secondY);
		if (Math.abs(secondDerivative) < 1e-9) break;
		const step = firstDerivative / secondDerivative;
		angle -= step;
		if (Math.abs(step) < 1e-8) break;
	}

	return {
		x: center.x + radiusX * Math.cos(angle),
		y: center.y + radiusY * Math.sin(angle),
	};
}

function getNearestPointOnElement(
	el: CanvasElement,
	point: { x: number; y: number },
): SnapAnchor | null {
	const local = inverseTransformCanvasElementPoint(el, point);
	const bbox = getUntransformedBBox(el);
	const left = bbox.x;
	const right = bbox.x + bbox.width;
	const top = bbox.y;
	const bottom = bbox.y + bbox.height;
	let nearest: { x: number; y: number } | null = null;

	if (el.type === "line" || el.type === "arrow" || el.type === "freehand") {
		const points = (el.points ?? []).map(([x, y]) => ({
			x: el.x + x,
			y: el.y + y,
		}));
		if (points.length < 2) return null;
		const segments: Array<
			[{ x: number; y: number }, { x: number; y: number }]
		> = [];
		const segmentCount = el.closed ? points.length : points.length - 1;
		for (let index = 0; index < segmentCount; index++) {
			segments.push([points[index], points[(index + 1) % points.length]]);
		}
		nearest = closestPointOnSegments(local, segments);
	} else if (el.type === "ellipse") {
		const centerX = left + bbox.width / 2;
		const centerY = top + bbox.height / 2;
		const radiusX = Math.max(bbox.width / 2, 0.001);
		const radiusY = Math.max(bbox.height / 2, 0.001);
		nearest = closestPointOnEllipse(
			local,
			{ x: centerX, y: centerY },
			radiusX,
			radiusY,
		);
	} else {
		const centerX = left + bbox.width / 2;
		const centerY = top + bbox.height / 2;
		const vertices =
			el.type === "diamond" || isPolygonVariant(el)
				? getElementPolygonPoints({
						...el,
						x: bbox.x,
						y: bbox.y,
						width: bbox.width,
						height: bbox.height,
					}).map(([x, y]) => ({ x, y }))
				: el.type === "triangle"
					? [
							{ x: centerX, y: top },
							{ x: right, y: bottom },
							{ x: left, y: bottom },
						]
					: [
							{ x: left, y: top },
							{ x: right, y: top },
							{ x: right, y: bottom },
							{ x: left, y: bottom },
						];
		nearest = closestPointOnSegments(
			local,
			vertices.map(
				(vertex, index) =>
					[vertex, vertices[(index + 1) % vertices.length]] as [
						{ x: number; y: number },
						{ x: number; y: number },
					],
			),
		);
	}

	if (!nearest) return null;
	const transformed = transformCanvasElementPoint(el, nearest);
	return createAnchor(el.id, "nearest", transformed.x, transformed.y);
}

function getSnapPoints(el: CanvasElement): { h: SnapPoint[]; v: SnapPoint[] } {
	const bbox = getBBox(el);
	const left = bbox.x;
	const right = bbox.x + bbox.width;
	const top = bbox.y;
	const bottom = bbox.y + bbox.height;
	const cx = bbox.x + bbox.width / 2;
	const cy = bbox.y + bbox.height / 2;

	return {
		v: [
			{ pos: left, min: top, max: bottom },
			{ pos: cx, min: top, max: bottom },
			{ pos: right, min: top, max: bottom },
		],
		h: [
			{ pos: top, min: left, max: right },
			{ pos: cy, min: left, max: right },
			{ pos: bottom, min: left, max: right },
		],
	};
}

function createMovingSnapElement(movingBBox: {
	x: number;
	y: number;
	width: number;
	height: number;
}): CanvasElement {
	return {
		...movingBBox,
		id: "",
		type: "rectangle",
		rotation: 0,
		fill: "",
		stroke: "",
		strokeWidth: 0,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
	};
}

export function calcSnap(
	movingBBox: { x: number; y: number; width: number; height: number },
	others: Map<string, CanvasElement>,
	excludeIds: Set<string>,
): SnapResult {
	const movingSnaps = getSnapPoints(createMovingSnapElement(movingBBox));

	let bestDx = Number.POSITIVE_INFINITY;
	let bestDy = Number.POSITIVE_INFINITY;
	const guides: SnapGuide[] = [];

	const otherSnapPoints: { h: SnapPoint[]; v: SnapPoint[] }[] = [];
	for (const [id, el] of others) {
		if (excludeIds.has(id)) continue;
		if (el.type === "freehand") continue;
		otherSnapPoints.push(getSnapPoints(el));
	}

	for (const mSnap of movingSnaps.v) {
		for (const oSnaps of otherSnapPoints) {
			for (const oSnap of oSnaps.v) {
				const diff = oSnap.pos - mSnap.pos;
				// Nur uebernehmen, wenn dieser Versatz strikt kleiner ist als der
				// bisher beste (das fruehere <= war redundant zum folgenden <).
				if (
					Math.abs(diff) < SNAP_THRESHOLD &&
					Math.abs(diff) < Math.abs(bestDx)
				) {
					bestDx = diff;
				}
			}
		}
	}

	for (const mSnap of movingSnaps.h) {
		for (const oSnaps of otherSnapPoints) {
			for (const oSnap of oSnaps.h) {
				const diff = oSnap.pos - mSnap.pos;
				// Nur uebernehmen, wenn dieser Versatz strikt kleiner ist als der
				// bisher beste (das fruehere <= war redundant zum folgenden <).
				if (
					Math.abs(diff) < SNAP_THRESHOLD &&
					Math.abs(diff) < Math.abs(bestDy)
				) {
					bestDy = diff;
				}
			}
		}
	}

	const snapDx = Math.abs(bestDx) <= SNAP_THRESHOLD ? bestDx : 0;
	const snapDy = Math.abs(bestDy) <= SNAP_THRESHOLD ? bestDy : 0;

	const snappedMoving = {
		...movingBBox,
		x: movingBBox.x + snapDx,
		y: movingBBox.y + snapDy,
	};
	const snappedSnaps = getSnapPoints(createMovingSnapElement(snappedMoving));

	if (snapDx !== 0) {
		for (const mSnap of snappedSnaps.v) {
			for (const oSnaps of otherSnapPoints) {
				for (const oSnap of oSnaps.v) {
					if (Math.abs(oSnap.pos - mSnap.pos) < 0.5) {
						guides.push({
							orientation: "v",
							pos: oSnap.pos,
							from: Math.min(mSnap.min, oSnap.min),
							to: Math.max(mSnap.max, oSnap.max),
						});
					}
				}
			}
		}
	}

	if (snapDy !== 0) {
		for (const mSnap of snappedSnaps.h) {
			for (const oSnaps of otherSnapPoints) {
				for (const oSnap of oSnaps.h) {
					if (Math.abs(oSnap.pos - mSnap.pos) < 0.5) {
						guides.push({
							orientation: "h",
							pos: oSnap.pos,
							from: Math.min(mSnap.min, oSnap.min),
							to: Math.max(mSnap.max, oSnap.max),
						});
					}
				}
			}
		}
	}

	return { dx: snapDx, dy: snapDy, guides };
}

export function findClosestSnapAnchor(
	point: { x: number; y: number },
	others: Map<string, CanvasElement>,
	excludeIds: Set<string>,
	options: SnapPointOptions,
	threshold = SNAP_POINT_THRESHOLD,
): SnapAnchor | null {
	let bestAnchor: SnapAnchor | null = null;
	let bestDistance = threshold;

	for (const [id, el] of others) {
		if (excludeIds.has(id) || el.locked) continue;

		const anchors = getElementSnapAnchors(el, options);
		if (options.includeNearest) {
			const nearest = getNearestPointOnElement(el, point);
			if (nearest) anchors.push(nearest);
		}
		if (options.includeExtensions) {
			const extension = getClosestExtensionAnchor(el, point);
			if (extension) anchors.push(extension);
		}
		for (const anchor of anchors) {
			const distance = Math.hypot(anchor.x - point.x, anchor.y - point.y);
			if (distance <= bestDistance) {
				bestDistance = distance;
				bestAnchor = anchor;
			}
		}
	}
	if (options.includeIntersections) {
		for (const anchor of getIntersectionAnchors(
			others,
			excludeIds,
			point,
			threshold,
		)) {
			const distance = Math.hypot(anchor.x - point.x, anchor.y - point.y);
			if (distance <= bestDistance) {
				bestDistance = distance;
				bestAnchor = anchor;
			}
		}
	}

	return bestAnchor;
}

export function getVisibleSnapPointIndicators(
	point: { x: number; y: number },
	others: Map<string, CanvasElement>,
	excludeIds: Set<string>,
	options: SnapPointOptions,
	activeAnchor: SnapAnchor | null,
	showInactivePoints: boolean,
): SnapPointIndicator[] {
	if (!showInactivePoints) {
		return activeAnchor ? [{ ...activeAnchor, active: true }] : [];
	}

	let anchorSource: CanvasElement | null = null;

	if (activeAnchor) {
		anchorSource = others.get(activeAnchor.elementId) ?? null;
	}

	if (!anchorSource && showInactivePoints) {
		let closest: { distance: number; element: CanvasElement } | null = null;

		for (const [id, el] of others) {
			if (excludeIds.has(id) || el.locked) continue;
			const distance = distanceToBBoxPoint(getBBox(el), point.x, point.y);
			if (distance > SNAP_POINT_VISIBILITY_DISTANCE) continue;
			if (!closest || distance < closest.distance) {
				closest = { distance, element: el };
			}
		}

		anchorSource = closest?.element ?? null;
	}

	const indicators = anchorSource
		? getElementSnapAnchors(anchorSource, options).map((anchor) => ({
				...anchor,
				active: activeAnchor ? isSameAnchor(anchor, activeAnchor) : false,
			}))
		: [];

	if (
		activeAnchor &&
		!indicators.some((indicator) => isSameAnchor(indicator, activeAnchor))
	) {
		indicators.push({ ...activeAnchor, active: true });
	}

	return indicators;
}
