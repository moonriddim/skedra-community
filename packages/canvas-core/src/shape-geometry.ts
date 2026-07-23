import { getEffectiveCornerRadius } from "./corner-radius";
import {
	inverseTransformCanvasElementPoint,
	transformCanvasElementPoint,
} from "./geometry-bbox";
import type { CanvasElement, ElementType } from "./types";

export type CanvasGeometryElementType = Extract<
	ElementType,
	"rectangle" | "ellipse" | "diamond" | "triangle" | "cloud"
>;

export const CANVAS_GEOMETRY_ELEMENT_TYPES = [
	"rectangle",
	"ellipse",
	"diamond",
	"triangle",
	"cloud",
] as const satisfies readonly CanvasGeometryElementType[];

const CANVAS_GEOMETRY_ELEMENT_TYPE_SET = new Set<string>(
	CANVAS_GEOMETRY_ELEMENT_TYPES,
);

export const MIN_PYRAMID_SECTIONS = 1;
export const MAX_PYRAMID_SECTIONS = 12;
export const DEFAULT_PYRAMID_SECTIONS = 1;

export const MIN_POLYGON_SIDES = 4;
export const MAX_POLYGON_SIDES = 12;
export const DEFAULT_POLYGON_SIDES = 4;

export const MIN_CLOUD_ARC_RADIUS = 4;
export const MAX_CLOUD_ARC_RADIUS = 48;
export const DEFAULT_CLOUD_ARC_RADIUS = 18;

export interface ShapeBounds {
	x: number;
	y: number;
	width: number;
	height: number;
	points?: readonly [number, number][];
	cloudArcRadius?: number;
}

export interface PyramidDividerSegment {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface EllipseArcAngles {
	startAngle: number;
	endAngle: number;
	sweepAngle: number;
}

export type CanvasShapeTrimEndpoint = "start" | "end";
/** @deprecated Use CanvasShapeTrimEndpoint. */
export type EllipseArcEndpoint = CanvasShapeTrimEndpoint;

export interface EllipseArcEndpointDragResult {
	changes: Pick<CanvasElement, "arcStartAngle" | "arcEndAngle">;
	draggedAngle: number;
	snapPoint: { x: number; y: number };
	snappedToFullEllipse: boolean;
}

export type CanvasTrimmableShapeType = Extract<
	ElementType,
	"rectangle" | "ellipse" | "diamond" | "triangle"
>;

export interface CanvasShapeTrim {
	kind: "ellipse" | "path";
	start: number;
	end: number;
	sweep: number;
}

export const CANVAS_SHAPE_FRAGMENT_DATA_KEY = "skedraShapeFragment";

export interface CanvasShapeFragmentMeta {
	/** Stable lineage shared by every piece produced from the same contour. */
	rootId: string;
}

export interface CanvasShapeSplitResult {
	/** The piece that keeps the selected element's id. */
	primary: CanvasShapeTrim;
	/** Every visible piece, with the primary piece first. */
	fragments: CanvasShapeTrim[];
}

export interface CanvasShapeFragmentReconnectPlan {
	survivorId: string;
	siblingId: string;
	changes: Partial<CanvasElement>;
	snapPoint: { x: number; y: number };
}

export interface CanvasShapeTrimEndpointDragResult {
	changes: Pick<
		CanvasElement,
		"arcStartAngle" | "arcEndAngle" | "pathTrimStart" | "pathTrimEnd"
	>;
	draggedPosition: number;
	snapPoint: { x: number; y: number };
	snappedToFullShape: boolean;
}

const FULL_TURN_DEGREES = 360;
export const MIN_ELLIPSE_ARC_SWEEP_DEGREES = 0.1;

export function normalizeEllipseAngle(angle: number): number {
	const normalized =
		((angle % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
	return Math.abs(normalized) < Number.EPSILON ? 0 : normalized;
}

export function getEllipseArcSweep(
	startAngle: number,
	endAngle: number,
): number {
	return normalizeEllipseAngle(endAngle - startAngle);
}

export function getEllipseArcAngles(
	element: Pick<CanvasElement, "type" | "arcStartAngle" | "arcEndAngle">,
): EllipseArcAngles | null {
	if (
		element.type !== "ellipse" ||
		!Number.isFinite(element.arcStartAngle) ||
		!Number.isFinite(element.arcEndAngle)
	) {
		return null;
	}
	const startAngle = normalizeEllipseAngle(element.arcStartAngle ?? 0);
	const endAngle = normalizeEllipseAngle(element.arcEndAngle ?? 0);
	const sweepAngle = getEllipseArcSweep(startAngle, endAngle);
	if (sweepAngle < MIN_ELLIPSE_ARC_SWEEP_DEGREES) return null;
	return {
		startAngle,
		endAngle,
		sweepAngle,
	};
}

export function isEllipseArc(
	element: Pick<CanvasElement, "type" | "arcStartAngle" | "arcEndAngle">,
): boolean {
	return getEllipseArcAngles(element) !== null;
}

export function getEllipsePointAtAngle(
	element: Pick<
		CanvasElement,
		"x" | "y" | "width" | "height" | "rotation" | "flipX" | "flipY"
	>,
	angle: number,
	transformed = false,
): { x: number; y: number } {
	const radians = (normalizeEllipseAngle(angle) * Math.PI) / 180;
	const point = {
		x: element.x + element.width / 2 + (element.width / 2) * Math.cos(radians),
		y:
			element.y + element.height / 2 + (element.height / 2) * Math.sin(radians),
	};
	return transformed
		? transformCanvasElementPoint(element as CanvasElement, point)
		: point;
}

/** Projects an arbitrary rendered point onto the ellipse's parametric angle. */
export function getEllipseAngleAtPoint(
	element: Pick<
		CanvasElement,
		"x" | "y" | "width" | "height" | "rotation" | "flipX" | "flipY"
	>,
	point: { x: number; y: number },
): number {
	const local = inverseTransformCanvasElementPoint(
		element as CanvasElement,
		point,
	);
	const centerX = element.x + element.width / 2;
	const centerY = element.y + element.height / 2;
	const radiusX = Math.max(Math.abs(element.width) / 2, 0.001);
	const radiusY = Math.max(Math.abs(element.height) / 2, 0.001);
	return normalizeEllipseAngle(
		(Math.atan2((local.y - centerY) / radiusY, (local.x - centerX) / radiusX) *
			180) /
			Math.PI,
	);
}

/**
 * Moves one open arc endpoint along the source ellipse. Dropping it close to
 * the opposite endpoint removes the cut and restores a complete ellipse.
 */
export function resolveEllipseArcEndpointDrag(
	element: Pick<
		CanvasElement,
		| "type"
		| "x"
		| "y"
		| "width"
		| "height"
		| "rotation"
		| "flipX"
		| "flipY"
		| "arcStartAngle"
		| "arcEndAngle"
	>,
	endpoint: EllipseArcEndpoint,
	point: { x: number; y: number },
	snapDistance: number,
): EllipseArcEndpointDragResult | null {
	const arc = getEllipseArcAngles(element);
	if (!arc) return null;
	const oppositeAngle = endpoint === "start" ? arc.endAngle : arc.startAngle;
	const snapPoint = getEllipsePointAtAngle(element, oppositeAngle, true);
	const snappedToFullEllipse =
		Math.hypot(point.x - snapPoint.x, point.y - snapPoint.y) <=
		Math.max(0, snapDistance);
	if (snappedToFullEllipse) {
		return {
			changes: {
				arcStartAngle: undefined,
				arcEndAngle: undefined,
			},
			draggedAngle: oppositeAngle,
			snapPoint,
			snappedToFullEllipse: true,
		};
	}

	const draggedAngle = getEllipseAngleAtPoint(element, point);
	return {
		changes:
			endpoint === "start"
				? {
						arcStartAngle: draggedAngle,
						arcEndAngle: arc.endAngle,
					}
				: {
						arcStartAngle: arc.startAngle,
						arcEndAngle: draggedAngle,
					},
		draggedAngle,
		snapPoint,
		snappedToFullEllipse: false,
	};
}

export function getEllipseArcSvgPath(
	element: Pick<CanvasElement, "x" | "y" | "width" | "height">,
	startAngle: number,
	endAngle: number,
): string {
	const sweepAngle = getEllipseArcSweep(startAngle, endAngle);
	if (sweepAngle < MIN_ELLIPSE_ARC_SWEEP_DEGREES) return "";
	const start = getEllipsePointAtAngle(
		{
			...element,
			rotation: 0,
			flipX: false,
			flipY: false,
		},
		startAngle,
	);
	const end = getEllipsePointAtAngle(
		{
			...element,
			rotation: 0,
			flipX: false,
			flipY: false,
		},
		endAngle,
	);
	const radiusX = Math.max(1, Math.abs(element.width) / 2);
	const radiusY = Math.max(1, Math.abs(element.height) / 2);
	return [
		`M ${start.x} ${start.y}`,
		`A ${radiusX} ${radiusY} 0 ${sweepAngle > 180 ? 1 : 0} 1 ${end.x} ${end.y}`,
	].join(" ");
}

/**
 * Chooses the short arc by default. Holding the modifier lets callers retain
 * the complementary long arc without changing the two picked cut points.
 */
export function getRetainedEllipseArcAngles(
	firstAngle: number,
	secondAngle: number,
	preferLongArc = false,
): EllipseArcAngles | null {
	const first = normalizeEllipseAngle(firstAngle);
	const second = normalizeEllipseAngle(secondAngle);
	const clockwiseSweep = getEllipseArcSweep(first, second);
	if (
		clockwiseSweep < MIN_ELLIPSE_ARC_SWEEP_DEGREES ||
		FULL_TURN_DEGREES - clockwiseSweep < MIN_ELLIPSE_ARC_SWEEP_DEGREES
	) {
		return null;
	}
	const keepClockwise = preferLongArc
		? clockwiseSweep >= 180
		: clockwiseSweep <= 180;
	const startAngle = keepClockwise ? first : second;
	const endAngle = keepClockwise ? second : first;
	return {
		startAngle,
		endAngle,
		sweepAngle: getEllipseArcSweep(startAngle, endAngle),
	};
}

const MIN_PATH_TRIM_SWEEP = 0.0001;

export function isCanvasTrimmableShape(
	element: Pick<CanvasElement, "type">,
): element is Pick<CanvasElement, "type"> & {
	type: CanvasTrimmableShapeType;
} {
	return (
		element.type === "rectangle" ||
		element.type === "ellipse" ||
		element.type === "diamond" ||
		element.type === "triangle"
	);
}

/** Excludes semantic widgets and curved-corner variants from straight contour trim. */
export function canTrimCanvasShape(element: CanvasElement): boolean {
	if (!isCanvasTrimmableShape(element) || element.locked) return false;
	if (
		element.type === "rectangle" &&
		(element.customData?.skedraType !== undefined ||
			element.customData?.ganttRole !== undefined)
	) {
		return false;
	}
	return true;
}

export function normalizeCanvasPathProgress(progress: number): number {
	if (progress >= 0 && progress < 1) return progress;
	const normalized = ((progress % 1) + 1) % 1;
	return Math.abs(normalized) < Number.EPSILON ? 0 : normalized;
}

const ROUNDED_CONTOUR_SEGMENTS = 16;

function appendArcContourPoints(
	points: [number, number][],
	centerX: number,
	centerY: number,
	radiusX: number,
	radiusY: number,
	startAngle: number,
	endAngle: number,
	includeEnd = true,
) {
	const count = ROUNDED_CONTOUR_SEGMENTS;
	const last = includeEnd ? count : count - 1;
	for (let index = 1; index <= last; index++) {
		const angle = startAngle + ((endAngle - startAngle) * index) / count;
		points.push([
			centerX + radiusX * Math.cos(angle),
			centerY + radiusY * Math.sin(angle),
		]);
	}
}

function getRoundedRectangleContourPoints(
	element: CanvasElement,
	radius: number,
): [number, number][] {
	const left = element.x;
	const right = element.x + element.width;
	const top = element.y;
	const bottom = element.y + element.height;
	const points: [number, number][] = [
		[left + radius, top],
		[right - radius, top],
	];
	appendArcContourPoints(
		points,
		right - radius,
		top + radius,
		radius,
		radius,
		-Math.PI / 2,
		0,
	);
	points.push([right, bottom - radius]);
	appendArcContourPoints(
		points,
		right - radius,
		bottom - radius,
		radius,
		radius,
		0,
		Math.PI / 2,
	);
	points.push([left + radius, bottom]);
	appendArcContourPoints(
		points,
		left + radius,
		bottom - radius,
		radius,
		radius,
		Math.PI / 2,
		Math.PI,
	);
	points.push([left, top + radius]);
	appendArcContourPoints(
		points,
		left + radius,
		top + radius,
		radius,
		radius,
		Math.PI,
		(Math.PI * 3) / 2,
		false,
	);
	return points;
}

function cubicPoint(
	start: [number, number],
	control: [number, number],
	end: [number, number],
	amount: number,
): [number, number] {
	const inverse = 1 - amount;
	return [
		inverse * inverse * inverse * start[0] +
			3 * inverse * inverse * amount * control[0] +
			3 * inverse * amount * amount * control[0] +
			amount * amount * amount * end[0],
		inverse * inverse * inverse * start[1] +
			3 * inverse * inverse * amount * control[1] +
			3 * inverse * amount * amount * control[1] +
			amount * amount * amount * end[1],
	];
}

function appendRoundedDiamondCorner(
	points: [number, number][],
	start: [number, number],
	vertex: [number, number],
	end: [number, number],
	includeEnd = true,
) {
	const last = includeEnd
		? ROUNDED_CONTOUR_SEGMENTS
		: ROUNDED_CONTOUR_SEGMENTS - 1;
	for (let index = 1; index <= last; index++) {
		points.push(
			cubicPoint(start, vertex, end, index / ROUNDED_CONTOUR_SEGMENTS),
		);
	}
}

function getRoundedDiamondContourPoints(
	element: CanvasElement,
	radius: number,
): [number, number][] {
	const width = Math.max(1, element.width);
	const height = Math.max(1, element.height);
	const radiusX = Math.min(Math.max(0, radius), width / 4);
	const radiusY = Math.min(Math.max(0, radius), height / 4);
	const top: [number, number] = [element.x + width / 2, element.y];
	const right: [number, number] = [element.x + width, element.y + height / 2];
	const bottom: [number, number] = [element.x + width / 2, element.y + height];
	const left: [number, number] = [element.x, element.y + height / 2];
	const topAfter: [number, number] = [top[0] + radiusX, top[1] + radiusY];
	const rightBefore: [number, number] = [
		right[0] - radiusX,
		right[1] - radiusY,
	];
	const rightAfter: [number, number] = [right[0] - radiusX, right[1] + radiusY];
	const bottomBefore: [number, number] = [
		bottom[0] + radiusX,
		bottom[1] - radiusY,
	];
	const bottomAfter: [number, number] = [
		bottom[0] - radiusX,
		bottom[1] - radiusY,
	];
	const leftBefore: [number, number] = [left[0] + radiusX, left[1] + radiusY];
	const leftAfter: [number, number] = [left[0] + radiusX, left[1] - radiusY];
	const topBefore: [number, number] = [top[0] - radiusX, top[1] + radiusY];
	const points: [number, number][] = [topAfter, rightBefore];
	appendRoundedDiamondCorner(points, rightBefore, right, rightAfter);
	points.push(bottomBefore);
	appendRoundedDiamondCorner(points, bottomBefore, bottom, bottomAfter);
	points.push(leftBefore);
	appendRoundedDiamondCorner(points, leftBefore, left, leftAfter);
	points.push(topBefore);
	appendRoundedDiamondCorner(points, topBefore, top, topAfter, false);
	return points;
}

export function getCanvasShapeContourPoints(
	element: Pick<
		CanvasElement,
		| "type"
		| "x"
		| "y"
		| "width"
		| "height"
		| "rotation"
		| "flipX"
		| "flipY"
		| "polygonSides"
		| "cornerRadius"
		| "cornerRadiusPercent"
	>,
	transformed = false,
): [number, number][] {
	let points: [number, number][];
	const radius = getEffectiveCornerRadius(element);
	if (
		element.type === "rectangle" &&
		!isPolygonVariant(element) &&
		radius > 0
	) {
		points = getRoundedRectangleContourPoints(element as CanvasElement, radius);
	} else if (element.type === "diamond" && radius > 0) {
		points = getRoundedDiamondContourPoints(element as CanvasElement, radius);
	} else if (element.type === "diamond" || isPolygonVariant(element)) {
		points = getElementPolygonPoints(element);
	} else if (element.type === "triangle") {
		points = getTrianglePoints(element);
	} else if (element.type === "rectangle") {
		points = [
			[element.x, element.y],
			[element.x + element.width, element.y],
			[element.x + element.width, element.y + element.height],
			[element.x, element.y + element.height],
		];
	} else {
		return [];
	}
	return transformed
		? points.map(([x, y]) => {
				const point = transformCanvasElementPoint(element as CanvasElement, {
					x,
					y,
				});
				return [point.x, point.y];
			})
		: points;
}

function getContourMetrics(points: readonly [number, number][]) {
	const segmentLengths = points.map(([x1, y1], index) => {
		const [x2, y2] = points[(index + 1) % points.length] ?? [x1, y1];
		return Math.hypot(x2 - x1, y2 - y1);
	});
	return {
		segmentLengths,
		totalLength: segmentLengths.reduce((sum, length) => sum + length, 0),
	};
}

export function getCanvasShapePointAtPathProgress(
	element: CanvasElement,
	progress: number,
	transformed = false,
): { x: number; y: number } | null {
	const points = getCanvasShapeContourPoints(element);
	if (points.length < 2) return null;
	const { segmentLengths, totalLength } = getContourMetrics(points);
	if (totalLength <= 0) return null;
	let remaining = normalizeCanvasPathProgress(progress) * totalLength;
	for (let index = 0; index < points.length; index++) {
		const length = segmentLengths[index] ?? 0;
		if (remaining <= length || index === points.length - 1) {
			const [x1, y1] = points[index];
			const [x2, y2] = points[(index + 1) % points.length];
			const amount = length > 0 ? Math.min(1, remaining / length) : 0;
			const point = {
				x: x1 + (x2 - x1) * amount,
				y: y1 + (y2 - y1) * amount,
			};
			return transformed ? transformCanvasElementPoint(element, point) : point;
		}
		remaining -= length;
	}
	return null;
}

/** Projects an arbitrary rendered point onto a straight closed shape contour. */
export function getCanvasShapePathProgressAtPoint(
	element: CanvasElement,
	point: { x: number; y: number },
): number | null {
	const points = getCanvasShapeContourPoints(element);
	if (points.length < 2) return null;
	const local = inverseTransformCanvasElementPoint(element, point);
	const { segmentLengths, totalLength } = getContourMetrics(points);
	if (totalLength <= 0) return null;
	let traversed = 0;
	let bestProgress = 0;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (let index = 0; index < points.length; index++) {
		const [x1, y1] = points[index];
		const [x2, y2] = points[(index + 1) % points.length];
		const dx = x2 - x1;
		const dy = y2 - y1;
		const length = segmentLengths[index] ?? 0;
		const amount =
			length > 0
				? Math.max(
						0,
						Math.min(
							1,
							((local.x - x1) * dx + (local.y - y1) * dy) / (length * length),
						),
					)
				: 0;
		const nearestX = x1 + dx * amount;
		const nearestY = y1 + dy * amount;
		const distance = Math.hypot(local.x - nearestX, local.y - nearestY);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestProgress = (traversed + length * amount) / totalLength;
		}
		traversed += length;
	}
	return normalizeCanvasPathProgress(bestProgress);
}

export function getCanvasShapeTrim(
	element: Pick<
		CanvasElement,
		"type" | "arcStartAngle" | "arcEndAngle" | "pathTrimStart" | "pathTrimEnd"
	>,
): CanvasShapeTrim | null {
	if (element.type === "ellipse") {
		const arc = getEllipseArcAngles(element);
		return arc
			? {
					kind: "ellipse",
					start: arc.startAngle,
					end: arc.endAngle,
					sweep: arc.sweepAngle,
				}
			: null;
	}
	if (
		(element.type !== "rectangle" &&
			element.type !== "diamond" &&
			element.type !== "triangle") ||
		!Number.isFinite(element.pathTrimStart) ||
		!Number.isFinite(element.pathTrimEnd)
	) {
		return null;
	}
	const start = normalizeCanvasPathProgress(element.pathTrimStart ?? 0);
	const end = normalizeCanvasPathProgress(element.pathTrimEnd ?? 0);
	const sweep = normalizeCanvasPathProgress(end - start);
	if (sweep < MIN_PATH_TRIM_SWEEP) return null;
	return { kind: "path", start, end, sweep };
}

export function getCanvasShapeTrimPositionAtPoint(
	element: CanvasElement,
	point: { x: number; y: number },
): number | null {
	if (element.type === "ellipse") return getEllipseAngleAtPoint(element, point);
	if (!isCanvasTrimmableShape(element)) return null;
	return getCanvasShapePathProgressAtPoint(element, point);
}

export function getCanvasShapePointAtTrimPosition(
	element: CanvasElement,
	position: number,
	transformed = false,
): { x: number; y: number } | null {
	if (element.type === "ellipse") {
		return getEllipsePointAtAngle(element, position, transformed);
	}
	if (!isCanvasTrimmableShape(element)) return null;
	return getCanvasShapePointAtPathProgress(element, position, transformed);
}

export function getRetainedCanvasShapeTrim(
	element: Pick<CanvasElement, "type">,
	firstPosition: number,
	secondPosition: number,
	preferLongPath = false,
): CanvasShapeTrim | null {
	if (element.type === "ellipse") {
		const arc = getRetainedEllipseArcAngles(
			firstPosition,
			secondPosition,
			preferLongPath,
		);
		return arc
			? {
					kind: "ellipse",
					start: arc.startAngle,
					end: arc.endAngle,
					sweep: arc.sweepAngle,
				}
			: null;
	}
	if (!isCanvasTrimmableShape(element)) return null;
	const first = normalizeCanvasPathProgress(firstPosition);
	const second = normalizeCanvasPathProgress(secondPosition);
	const clockwiseSweep = normalizeCanvasPathProgress(second - first);
	if (
		clockwiseSweep < MIN_PATH_TRIM_SWEEP ||
		1 - clockwiseSweep < MIN_PATH_TRIM_SWEEP
	) {
		return null;
	}
	const keepClockwise = preferLongPath
		? clockwiseSweep >= 0.5
		: clockwiseSweep <= 0.5;
	const start = keepClockwise ? first : second;
	const end = keepClockwise ? second : first;
	return {
		kind: "path",
		start,
		end,
		sweep: normalizeCanvasPathProgress(end - start),
	};
}

export function getCanvasShapeTrimChanges(
	element: Pick<CanvasElement, "type">,
	trim: CanvasShapeTrim,
): Pick<
	CanvasElement,
	"arcStartAngle" | "arcEndAngle" | "pathTrimStart" | "pathTrimEnd"
> {
	return element.type === "ellipse"
		? {
				arcStartAngle: trim.start,
				arcEndAngle: trim.end,
				pathTrimStart: undefined,
				pathTrimEnd: undefined,
			}
		: {
				arcStartAngle: undefined,
				arcEndAngle: undefined,
				pathTrimStart: trim.start,
				pathTrimEnd: trim.end,
			};
}

const SHAPE_FRAGMENT_PROGRESS_EPSILON = 1e-7;

function getCanvasShapeTrimUnitPosition(
	kind: CanvasShapeTrim["kind"],
	position: number,
): number {
	return kind === "ellipse"
		? normalizeCanvasPathProgress(position / FULL_TURN_DEGREES)
		: normalizeCanvasPathProgress(position);
}

function getCanvasShapeTrimUnitSweep(trim: CanvasShapeTrim): number {
	return trim.kind === "ellipse" ? trim.sweep / FULL_TURN_DEGREES : trim.sweep;
}

function createCanvasShapeTrimFromUnitInterval(
	kind: CanvasShapeTrim["kind"],
	start: number,
	sweep: number,
): CanvasShapeTrim {
	const normalizedStart = normalizeCanvasPathProgress(start);
	const normalizedEnd = normalizeCanvasPathProgress(start + sweep);
	return kind === "ellipse"
		? {
				kind,
				start: normalizedStart * FULL_TURN_DEGREES,
				end: normalizedEnd * FULL_TURN_DEGREES,
				sweep: sweep * FULL_TURN_DEGREES,
			}
		: {
				kind,
				start: normalizedStart,
				end: normalizedEnd,
				sweep,
			};
}

function canvasShapeTrimIntervalsEqual(
	first: CanvasShapeTrim,
	second: CanvasShapeTrim,
): boolean {
	if (first.kind !== second.kind) return false;
	const firstStart = getCanvasShapeTrimUnitPosition(first.kind, first.start);
	const secondStart = getCanvasShapeTrimUnitPosition(second.kind, second.start);
	const startDistance = Math.min(
		normalizeCanvasPathProgress(firstStart - secondStart),
		normalizeCanvasPathProgress(secondStart - firstStart),
	);
	return (
		startDistance <= SHAPE_FRAGMENT_PROGRESS_EPSILON &&
		Math.abs(
			getCanvasShapeTrimUnitSweep(first) - getCanvasShapeTrimUnitSweep(second),
		) <= SHAPE_FRAGMENT_PROGRESS_EPSILON
	);
}

/**
 * Splits the currently visible contour interval at two positions. Closed
 * shapes produce two arcs; cutting an existing arc can produce up to three
 * independently movable pieces.
 */
export function getCanvasShapeSplitResult(
	element: CanvasElement,
	firstPosition: number,
	secondPosition: number,
	preferLongPath = false,
): CanvasShapeSplitResult | null {
	if (!isCanvasTrimmableShape(element)) return null;
	const existingTrim = getCanvasShapeTrim(element);
	const kind: CanvasShapeTrim["kind"] =
		element.type === "ellipse" ? "ellipse" : "path";
	const currentStart = existingTrim
		? getCanvasShapeTrimUnitPosition(kind, existingTrim.start)
		: 0;
	const currentSweep = existingTrim
		? getCanvasShapeTrimUnitSweep(existingTrim)
		: 1;
	const toCurrentOffset = (position: number) =>
		normalizeCanvasPathProgress(
			getCanvasShapeTrimUnitPosition(kind, position) - currentStart,
		);
	const firstOffset = toCurrentOffset(firstPosition);
	const secondOffset = toCurrentOffset(secondPosition);

	if (
		existingTrim &&
		(firstOffset > currentSweep + SHAPE_FRAGMENT_PROGRESS_EPSILON ||
			secondOffset > currentSweep + SHAPE_FRAGMENT_PROGRESS_EPSILON)
	) {
		return null;
	}

	const cutOffsets = [firstOffset, secondOffset]
		.filter(
			(offset) =>
				offset > SHAPE_FRAGMENT_PROGRESS_EPSILON &&
				offset < currentSweep - SHAPE_FRAGMENT_PROGRESS_EPSILON,
		)
		.sort((a, b) => a - b)
		.filter(
			(offset, index, values) =>
				index === 0 ||
				Math.abs(offset - (values[index - 1] ?? offset)) >
					SHAPE_FRAGMENT_PROGRESS_EPSILON,
		);

	let fragments: CanvasShapeTrim[];
	if (!existingTrim) {
		const first = getCanvasShapeTrimUnitPosition(kind, firstPosition);
		const second = getCanvasShapeTrimUnitPosition(kind, secondPosition);
		const clockwiseSweep = normalizeCanvasPathProgress(second - first);
		if (
			clockwiseSweep <= SHAPE_FRAGMENT_PROGRESS_EPSILON ||
			1 - clockwiseSweep <= SHAPE_FRAGMENT_PROGRESS_EPSILON
		) {
			return null;
		}
		fragments = [
			createCanvasShapeTrimFromUnitInterval(kind, first, clockwiseSweep),
			createCanvasShapeTrimFromUnitInterval(kind, second, 1 - clockwiseSweep),
		];
	} else {
		if (cutOffsets.length === 0) return null;
		const boundaries = [0, ...cutOffsets, currentSweep];
		fragments = boundaries
			.slice(0, -1)
			.map((offset, index) =>
				createCanvasShapeTrimFromUnitInterval(
					kind,
					currentStart + offset,
					(boundaries[index + 1] ?? currentSweep) - offset,
				),
			);
	}

	let primary: CanvasShapeTrim | undefined;
	if (!existingTrim) {
		const retained = getRetainedCanvasShapeTrim(
			element,
			firstPosition,
			secondPosition,
			preferLongPath,
		);
		primary = retained
			? fragments.find((fragment) =>
					canvasShapeTrimIntervalsEqual(fragment, retained),
				)
			: undefined;
	} else if (
		Math.abs(firstOffset - secondOffset) > SHAPE_FRAGMENT_PROGRESS_EPSILON
	) {
		const middleStart = Math.min(firstOffset, secondOffset);
		const middleSweep = Math.abs(firstOffset - secondOffset);
		const middle = createCanvasShapeTrimFromUnitInterval(
			kind,
			currentStart + middleStart,
			middleSweep,
		);
		primary = fragments.find((fragment) =>
			canvasShapeTrimIntervalsEqual(fragment, middle),
		);
	}
	primary ??= preferLongPath
		? fragments.reduce((longest, fragment) =>
				getCanvasShapeTrimUnitSweep(fragment) >
				getCanvasShapeTrimUnitSweep(longest)
					? fragment
					: longest,
			)
		: fragments.reduce((shortest, fragment) =>
				getCanvasShapeTrimUnitSweep(fragment) <
				getCanvasShapeTrimUnitSweep(shortest)
					? fragment
					: shortest,
			);

	return {
		primary,
		fragments: [
			primary,
			...fragments.filter((fragment) => fragment !== primary),
		],
	};
}

export function getCanvasShapeFragmentMeta(
	element: Pick<CanvasElement, "customData">,
): CanvasShapeFragmentMeta | null {
	const candidate = element.customData?.[CANVAS_SHAPE_FRAGMENT_DATA_KEY];
	if (
		!candidate ||
		typeof candidate !== "object" ||
		typeof (candidate as { rootId?: unknown }).rootId !== "string"
	) {
		return null;
	}
	return { rootId: (candidate as { rootId: string }).rootId };
}

function withCanvasShapeFragmentMeta(
	element: CanvasElement,
	rootId: string,
): Record<string, unknown> {
	return {
		...(element.customData ?? {}),
		[CANVAS_SHAPE_FRAGMENT_DATA_KEY]: { rootId },
	};
}

function withoutCanvasShapeFragmentMeta(
	customData: CanvasElement["customData"],
): CanvasElement["customData"] {
	if (!customData) return undefined;
	const { [CANVAS_SHAPE_FRAGMENT_DATA_KEY]: _fragmentMeta, ...remaining } =
		customData;
	return Object.keys(remaining).length > 0 ? remaining : undefined;
}

/**
 * Creates normal canvas elements for every piece while preserving the
 * selected element id on the previewed piece.
 */
export function splitCanvasShapeElement(
	element: CanvasElement,
	firstPosition: number,
	secondPosition: number,
	createId: () => string,
	preferLongPath = false,
): CanvasElement[] | null {
	const result = getCanvasShapeSplitResult(
		element,
		firstPosition,
		secondPosition,
		preferLongPath,
	);
	if (!result || result.fragments.length < 2) return null;
	const rootId = getCanvasShapeFragmentMeta(element)?.rootId ?? element.id;
	return result.fragments.map((trim, index) => {
		const fragment: CanvasElement = {
			...element,
			id: index === 0 ? element.id : createId(),
			groupId: null,
			customData: withCanvasShapeFragmentMeta(element, rootId),
			...getCanvasShapeTrimChanges(element, trim),
		};
		if (index > 0) {
			fragment.text = undefined;
			fragment.containerId = undefined;
			fragment.link = undefined;
		}
		return fragment;
	});
}

function canvasShapeFragmentValuesEqual(
	first: CanvasElement,
	second: CanvasElement,
): boolean {
	const numericKeys = [
		"x",
		"y",
		"width",
		"height",
		"rotation",
		"strokeWidth",
		"opacity",
		"roughness",
		"roughFillScale",
	] as const;
	if (
		numericKeys.some(
			(key) =>
				Math.abs((first[key] ?? 0) - (second[key] ?? 0)) >
				SHAPE_FRAGMENT_PROGRESS_EPSILON,
		)
	) {
		return false;
	}
	return (
		first.type === second.type &&
		first.flipX === second.flipX &&
		first.flipY === second.flipY &&
		first.stroke === second.stroke &&
		first.fill === second.fill &&
		first.strokeStyle === second.strokeStyle &&
		first.frameId === second.frameId &&
		first.roughFillStyle === second.roughFillStyle
	);
}

function getCanvasShapeFragmentMergeChanges(
	element: CanvasElement,
	sibling: CanvasElement,
	endpoint: CanvasShapeTrimEndpoint,
): Partial<CanvasElement> | null {
	const trim = getCanvasShapeTrim(element);
	const siblingTrim = getCanvasShapeTrim(sibling);
	if (!trim || !siblingTrim || trim.kind !== siblingTrim.kind) return null;
	const meta = getCanvasShapeFragmentMeta(element);
	const siblingMeta = getCanvasShapeFragmentMeta(sibling);
	if (
		!meta ||
		!siblingMeta ||
		meta.rootId !== siblingMeta.rootId ||
		!canvasShapeFragmentValuesEqual(element, sibling)
	) {
		return null;
	}

	const start = getCanvasShapeTrimUnitPosition(trim.kind, trim.start);
	const sweep = getCanvasShapeTrimUnitSweep(trim);
	const end = normalizeCanvasPathProgress(start + sweep);
	const siblingStart = getCanvasShapeTrimUnitPosition(
		siblingTrim.kind,
		siblingTrim.start,
	);
	const siblingSweep = getCanvasShapeTrimUnitSweep(siblingTrim);
	const siblingEnd = normalizeCanvasPathProgress(siblingStart + siblingSweep);
	const boundaryDistance =
		endpoint === "start"
			? Math.min(
					normalizeCanvasPathProgress(start - siblingEnd),
					normalizeCanvasPathProgress(siblingEnd - start),
				)
			: Math.min(
					normalizeCanvasPathProgress(end - siblingStart),
					normalizeCanvasPathProgress(siblingStart - end),
				);
	if (boundaryDistance > SHAPE_FRAGMENT_PROGRESS_EPSILON) return null;

	const mergedSweep = sweep + siblingSweep;
	if (mergedSweep > 1 + SHAPE_FRAGMENT_PROGRESS_EPSILON) return null;
	const mergedStart = endpoint === "start" ? siblingStart : start;
	const mergedIsFull = mergedSweep >= 1 - SHAPE_FRAGMENT_PROGRESS_EPSILON;
	return {
		...(mergedIsFull
			? {
					arcStartAngle: undefined,
					arcEndAngle: undefined,
					pathTrimStart: undefined,
					pathTrimEnd: undefined,
				}
			: getCanvasShapeTrimChanges(
					element,
					createCanvasShapeTrimFromUnitInterval(
						trim.kind,
						mergedStart,
						mergedSweep,
					),
				)),
		customData: mergedIsFull
			? withoutCanvasShapeFragmentMeta(element.customData)
			: element.customData,
		...(element.text === undefined && sibling.text !== undefined
			? { text: sibling.text }
			: {}),
		...(element.link === undefined && sibling.link !== undefined
			? { link: sibling.link }
			: {}),
	};
}

/**
 * Finds a same-lineage piece whose matching endpoint is still on the exact
 * same source geometry. Moved pieces intentionally stop matching.
 */
export function findCanvasShapeFragmentReconnect(
	element: CanvasElement,
	endpoint: CanvasShapeTrimEndpoint,
	elements: ReadonlyMap<string, CanvasElement>,
	point: { x: number; y: number },
	snapDistance: number,
): CanvasShapeFragmentReconnectPlan | null {
	const trim = getCanvasShapeTrim(element);
	if (!trim || !getCanvasShapeFragmentMeta(element)) return null;
	const endpointPosition = endpoint === "start" ? trim.start : trim.end;
	const snapPoint = getCanvasShapePointAtTrimPosition(
		element,
		endpointPosition,
		true,
	);
	if (
		!snapPoint ||
		Math.hypot(point.x - snapPoint.x, point.y - snapPoint.y) >
			Math.max(0, snapDistance)
	) {
		return null;
	}
	for (const sibling of elements.values()) {
		if (sibling.id === element.id) continue;
		const changes = getCanvasShapeFragmentMergeChanges(
			element,
			sibling,
			endpoint,
		);
		if (!changes) continue;
		return {
			survivorId: element.id,
			siblingId: sibling.id,
			changes,
			snapPoint,
		};
	}
	return null;
}

export function getTrimmedCanvasShapePolyline(
	element: CanvasElement,
	transformed = false,
): Array<{ x: number; y: number }> {
	const trim = getCanvasShapeTrim(element);
	if (!trim || trim.kind !== "path") return [];
	const contour = getCanvasShapeContourPoints(element);
	const { segmentLengths, totalLength } = getContourMetrics(contour);
	if (contour.length < 2 || totalLength <= 0) return [];
	const startPoint = getCanvasShapePointAtPathProgress(element, trim.start);
	const endPoint = getCanvasShapePointAtPathProgress(element, trim.end);
	if (!startPoint || !endPoint) return [];
	const result = [startPoint];
	const endUnwrapped = trim.start + trim.sweep;
	let traversed = 0;
	const vertices = contour.map(([x, y], index) => {
		if (index > 0) traversed += segmentLengths[index - 1] ?? 0;
		return { x, y, progress: traversed / totalLength };
	});
	for (let cycle = 0; cycle <= 1; cycle++) {
		for (const vertex of vertices) {
			const vertexProgress = vertex.progress + cycle;
			if (
				vertexProgress > trim.start + MIN_PATH_TRIM_SWEEP &&
				vertexProgress < endUnwrapped - MIN_PATH_TRIM_SWEEP
			) {
				result.push({ x: vertex.x, y: vertex.y });
			}
		}
	}
	result.push(endPoint);
	return transformed
		? result.map((point) => transformCanvasElementPoint(element, point))
		: result;
}

export function getCanvasShapeTrimSvgPath(element: CanvasElement): string {
	const trim = getCanvasShapeTrim(element);
	if (!trim) return "";
	if (trim.kind === "ellipse") {
		return getEllipseArcSvgPath(element, trim.start, trim.end);
	}
	const points = getTrimmedCanvasShapePolyline(element);
	if (points.length < 2) return "";
	return points
		.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
		.join(" ");
}

/**
 * Moves either endpoint along the source contour. Dropping it on the opposite
 * endpoint removes the trim and restores the complete closed shape.
 */
export function resolveCanvasShapeTrimEndpointDrag(
	element: CanvasElement,
	endpoint: CanvasShapeTrimEndpoint,
	point: { x: number; y: number },
	snapDistance: number,
): CanvasShapeTrimEndpointDragResult | null {
	const trim = getCanvasShapeTrim(element);
	if (!trim) return null;
	const oppositePosition = endpoint === "start" ? trim.end : trim.start;
	const snapPoint = getCanvasShapePointAtTrimPosition(
		element,
		oppositePosition,
		true,
	);
	if (!snapPoint) return null;
	const snappedToFullShape =
		Math.hypot(point.x - snapPoint.x, point.y - snapPoint.y) <=
		Math.max(0, snapDistance);
	if (snappedToFullShape) {
		if (getCanvasShapeFragmentMeta(element)) {
			const draggedPosition = endpoint === "start" ? trim.start : trim.end;
			return {
				changes: getCanvasShapeTrimChanges(element, trim),
				draggedPosition,
				snapPoint:
					getCanvasShapePointAtTrimPosition(element, draggedPosition, true) ??
					snapPoint,
				snappedToFullShape: false,
			};
		}
		return {
			changes: {
				arcStartAngle: undefined,
				arcEndAngle: undefined,
				pathTrimStart: undefined,
				pathTrimEnd: undefined,
			},
			draggedPosition: oppositePosition,
			snapPoint,
			snappedToFullShape: true,
		};
	}
	const draggedPosition = getCanvasShapeTrimPositionAtPoint(element, point);
	if (draggedPosition === null) return null;
	const nextTrim: CanvasShapeTrim = {
		...trim,
		start: endpoint === "start" ? draggedPosition : trim.start,
		end: endpoint === "end" ? draggedPosition : trim.end,
	};
	nextTrim.sweep =
		nextTrim.kind === "ellipse"
			? getEllipseArcSweep(nextTrim.start, nextTrim.end)
			: normalizeCanvasPathProgress(nextTrim.end - nextTrim.start);
	if (
		(nextTrim.kind === "ellipse" &&
			nextTrim.sweep < MIN_ELLIPSE_ARC_SWEEP_DEGREES) ||
		(nextTrim.kind === "path" && nextTrim.sweep < MIN_PATH_TRIM_SWEEP)
	) {
		return {
			changes: getCanvasShapeTrimChanges(element, trim),
			draggedPosition: endpoint === "start" ? trim.start : trim.end,
			snapPoint:
				getCanvasShapePointAtTrimPosition(
					element,
					endpoint === "start" ? trim.start : trim.end,
					true,
				) ?? snapPoint,
			snappedToFullShape: false,
		};
	}
	return {
		changes: getCanvasShapeTrimChanges(element, nextTrim),
		draggedPosition,
		snapPoint:
			getCanvasShapePointAtTrimPosition(element, draggedPosition, true) ??
			snapPoint,
		snappedToFullShape: false,
	};
}

export function isCanvasGeometryElementType(
	type: string,
): type is CanvasGeometryElementType {
	return CANVAS_GEOMETRY_ELEMENT_TYPE_SET.has(type);
}

export function isCanvasGeometryElement(
	element: Pick<CanvasElement, "type">,
): element is Pick<CanvasElement, "type"> & {
	type: CanvasGeometryElementType;
} {
	return isCanvasGeometryElementType(element.type);
}

export function clampPyramidSections(sections?: number): number {
	if (!Number.isFinite(sections)) return DEFAULT_PYRAMID_SECTIONS;
	return Math.min(
		MAX_PYRAMID_SECTIONS,
		Math.max(MIN_PYRAMID_SECTIONS, Math.round(sections ?? 1)),
	);
}

export function clampPolygonSides(sides?: number): number {
	if (!Number.isFinite(sides)) return DEFAULT_POLYGON_SIDES;
	return Math.min(
		MAX_POLYGON_SIDES,
		Math.max(MIN_POLYGON_SIDES, Math.round(sides ?? DEFAULT_POLYGON_SIDES)),
	);
}

export function isPolygonVariant(
	element: Pick<CanvasElement, "type" | "polygonSides">,
): boolean {
	return (
		(element.type === "rectangle" || element.type === "diamond") &&
		clampPolygonSides(element.polygonSides) > DEFAULT_POLYGON_SIDES
	);
}

/** Vertices of a polygon stretched to fill the supplied bounds. */
export function getRegularPolygonPoints(
	bounds: ShapeBounds,
	sides?: number,
	orientation: "vertex-top" | "edge-top" = "vertex-top",
): [number, number][] {
	const count = clampPolygonSides(sides);
	const startAngle =
		-Math.PI / 2 + (orientation === "edge-top" ? Math.PI / count : 0);
	const unitPoints = Array.from({ length: count }, (_, index) => {
		const angle = startAngle + (index * Math.PI * 2) / count;
		return [Math.cos(angle), Math.sin(angle)] as [number, number];
	});
	const maxX = Math.max(...unitPoints.map(([x]) => Math.abs(x)), 0.001);
	const maxY = Math.max(...unitPoints.map(([, y]) => Math.abs(y)), 0.001);
	const centerX = bounds.x + bounds.width / 2;
	const centerY = bounds.y + bounds.height / 2;
	const radiusX = bounds.width / 2 / maxX;
	const radiusY = bounds.height / 2 / maxY;
	return unitPoints.map(([x, y]) => [
		centerX + x * radiusX,
		centerY + y * radiusY,
	]);
}

export function getElementPolygonPoints(
	element: Pick<
		CanvasElement,
		"type" | "x" | "y" | "width" | "height" | "polygonSides"
	>,
): [number, number][] {
	const sides = clampPolygonSides(element.polygonSides);
	const orientation =
		element.type === "rectangle" && sides % 2 === 0 ? "edge-top" : "vertex-top";
	return getRegularPolygonPoints(element, sides, orientation);
}

export function getElementPolygonPointsAttribute(
	element: Pick<
		CanvasElement,
		"type" | "x" | "y" | "width" | "height" | "polygonSides"
	>,
): string {
	return getElementPolygonPoints(element)
		.map(([x, y]) => `${x},${y}`)
		.join(" ");
}

export function clampCloudArcRadius(radius?: number): number {
	if (!Number.isFinite(radius)) return DEFAULT_CLOUD_ARC_RADIUS;
	return Math.min(
		MAX_CLOUD_ARC_RADIUS,
		Math.max(MIN_CLOUD_ARC_RADIUS, radius ?? DEFAULT_CLOUD_ARC_RADIUS),
	);
}

/**
 * Keeps a point-by-point cloud's baseline points fixed while its scallop radius
 * changes, and expands or contracts the stored bounds around those points.
 */
export function buildCloudArcRadiusChanges(
	element: CanvasElement,
	radius?: number,
): Partial<CanvasElement> {
	const cloudArcRadius = clampCloudArcRadius(radius);
	if (element.type !== "cloud" || (element.points?.length ?? 0) < 2) {
		return { cloudArcRadius };
	}

	const absolutePoints = (element.points ?? []).map(
		([pointX, pointY]) =>
			[element.x + pointX, element.y + pointY] as [number, number],
	);
	const minX = Math.min(...absolutePoints.map(([pointX]) => pointX));
	const minY = Math.min(...absolutePoints.map(([, pointY]) => pointY));
	const maxX = Math.max(...absolutePoints.map(([pointX]) => pointX));
	const maxY = Math.max(...absolutePoints.map(([, pointY]) => pointY));
	const x = minX - cloudArcRadius;
	const y = minY - cloudArcRadius;

	return {
		x,
		y,
		width: maxX - minX + cloudArcRadius * 2,
		height: maxY - minY + cloudArcRadius * 2,
		cloudArcRadius,
		points: absolutePoints.map(
			([pointX, pointY]) => [pointX - x, pointY - y] as [number, number],
		),
	};
}

export function getTrianglePoints(
	bounds: ShapeBounds,
): [[number, number], [number, number], [number, number]] {
	return [
		[bounds.x + bounds.width / 2, bounds.y],
		[bounds.x + bounds.width, bounds.y + bounds.height],
		[bounds.x, bounds.y + bounds.height],
	];
}

export function getTrianglePointsAttribute(bounds: ShapeBounds): string {
	return getTrianglePoints(bounds)
		.map(([x, y]) => `${x},${y}`)
		.join(" ");
}

/** Horizontal separators whose endpoints remain exactly on the triangle edges. */
export function getPyramidDividerSegments(
	bounds: ShapeBounds,
	sections?: number,
): PyramidDividerSegment[] {
	const count = clampPyramidSections(sections);
	const centerX = bounds.x + bounds.width / 2;
	return Array.from({ length: count - 1 }, (_, index) => {
		const progress = (index + 1) / count;
		const halfWidth = (bounds.width / 2) * progress;
		const y = bounds.y + bounds.height * progress;
		return {
			x1: centerX - halfWidth,
			y1: y,
			x2: centerX + halfWidth,
			y2: y,
		};
	});
}

function appendHorizontalRevisionScallops(
	commands: string[],
	startX: number,
	endX: number,
	baselineY: number,
	outwardY: number,
	targetSpan: number,
) {
	const count = Math.max(1, Math.round(Math.abs(endX - startX) / targetSpan));
	for (let index = 0; index < count; index++) {
		const progress = (index + 1) / count;
		const previousProgress = index / count;
		const segmentEndX = startX + (endX - startX) * progress;
		const controlX =
			startX + (endX - startX) * ((previousProgress + progress) / 2);
		commands.push(`Q ${controlX} ${outwardY} ${segmentEndX} ${baselineY}`);
	}
}

function appendVerticalRevisionScallops(
	commands: string[],
	startY: number,
	endY: number,
	baselineX: number,
	outwardX: number,
	targetSpan: number,
) {
	const count = Math.max(1, Math.round(Math.abs(endY - startY) / targetSpan));
	for (let index = 0; index < count; index++) {
		const progress = (index + 1) / count;
		const previousProgress = index / count;
		const segmentEndY = startY + (endY - startY) * progress;
		const controlY =
			startY + (endY - startY) * ((previousProgress + progress) / 2);
		commands.push(`Q ${outwardX} ${controlY} ${baselineX} ${segmentEndY}`);
	}
}

export function getFreeformRevisionCloudScallopDepth(
	points: readonly [number, number][],
	radius?: number,
): number {
	if (radius !== undefined) return clampCloudArcRadius(radius);
	if (points.length === 0) return 6;
	const xs = points.map(([x]) => x);
	const ys = points.map(([, y]) => y);
	const width = Math.max(...xs) - Math.min(...xs);
	const height = Math.max(...ys) - Math.min(...ys);
	const dimensions = [width, height].filter((value) => value > 0);
	const reference = dimensions.length > 0 ? Math.min(...dimensions) : 1;
	return Math.min(18, Math.max(6, reference * 0.14));
}

function getPolygonSignedArea(points: readonly [number, number][]): number {
	return points.reduce((area, [x1, y1], index) => {
		const [x2, y2] = points[(index + 1) % points.length] ?? [x1, y1];
		return area + x1 * y2 - y1 * x2;
	}, 0);
}

function appendFreeformRevisionScallops(
	commands: string[],
	start: readonly [number, number],
	end: readonly [number, number],
	outwardDirection: 1 | -1,
	depth: number,
) {
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const length = Math.hypot(dx, dy);
	if (length === 0) return;
	const normalX = (outwardDirection * dy) / length;
	const normalY = (outwardDirection * -dx) / length;
	const count = Math.max(1, Math.round(length / Math.max(1, depth * 2.15)));

	for (let index = 0; index < count; index++) {
		const startProgress = index / count;
		const endProgress = (index + 1) / count;
		const middleProgress = (startProgress + endProgress) / 2;
		const endX = start[0] + dx * endProgress;
		const endY = start[1] + dy * endProgress;
		const controlX = start[0] + dx * middleProgress + normalX * depth;
		const controlY = start[1] + dy * middleProgress + normalY * depth;
		commands.push(`Q ${controlX} ${controlY} ${endX} ${endY}`);
	}
}

/** A closed revision cloud following an arbitrary point-by-point outline. */
export function getFreeformRevisionCloudSvgPath(
	points: readonly [number, number][],
	radius?: number,
): string {
	const uniquePoints = points.filter((point, index) => {
		if (index === 0) return true;
		const previous = points[index - 1];
		return previous[0] !== point[0] || previous[1] !== point[1];
	});
	if (uniquePoints.length < 2) return "";

	const depth = getFreeformRevisionCloudScallopDepth(uniquePoints, radius);
	const commands = [`M ${uniquePoints[0][0]} ${uniquePoints[0][1]}`];
	if (uniquePoints.length === 2) {
		appendFreeformRevisionScallops(
			commands,
			uniquePoints[0],
			uniquePoints[1],
			1,
			depth,
		);
		appendFreeformRevisionScallops(
			commands,
			uniquePoints[1],
			uniquePoints[0],
			1,
			depth,
		);
		commands.push("Z");
		return commands.join(" ");
	}

	const outwardDirection = getPolygonSignedArea(uniquePoints) >= 0 ? 1 : -1;
	for (let index = 0; index < uniquePoints.length; index++) {
		appendFreeformRevisionScallops(
			commands,
			uniquePoints[index],
			uniquePoints[(index + 1) % uniquePoints.length],
			outwardDirection,
			depth,
		);
	}
	commands.push("Z");
	return commands.join(" ");
}

/** A scalable CAD-style revision cloud with repeating scallops on every edge. */
export function getCloudSvgPath(bounds: ShapeBounds): string {
	if ((bounds.points?.length ?? 0) >= 2) {
		return getFreeformRevisionCloudSvgPath(
			(bounds.points ?? []).map(([pointX, pointY]) => [
				bounds.x + pointX,
				bounds.y + pointY,
			]),
			bounds.cloudArcRadius,
		);
	}
	const { x, y } = bounds;
	const width = Math.max(1, bounds.width);
	const height = Math.max(1, bounds.height);
	const minimumDimension = Math.min(width, height);
	const requestedDepth =
		bounds.cloudArcRadius === undefined
			? Math.min(18, minimumDimension * 0.16)
			: clampCloudArcRadius(bounds.cloudArcRadius);
	const scallopDepth = Math.max(
		0.25,
		Math.min(requestedDepth, width / 3, height / 3),
	);
	const targetSpan = Math.max(1, scallopDepth * 2.15);
	const left = x + scallopDepth;
	const right = x + width - scallopDepth;
	const top = y + scallopDepth;
	const bottom = y + height - scallopDepth;
	const commands = [`M ${left} ${top}`];

	appendHorizontalRevisionScallops(commands, left, right, top, y, targetSpan);
	appendVerticalRevisionScallops(
		commands,
		top,
		bottom,
		right,
		x + width,
		targetSpan,
	);
	appendHorizontalRevisionScallops(
		commands,
		right,
		left,
		bottom,
		y + height,
		targetSpan,
	);
	appendVerticalRevisionScallops(commands, bottom, top, left, x, targetSpan);
	commands.push("Z");

	return commands.join(" ");
}
