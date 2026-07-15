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
