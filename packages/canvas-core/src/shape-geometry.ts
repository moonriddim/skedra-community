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
