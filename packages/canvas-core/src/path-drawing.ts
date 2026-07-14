import type { CanvasElement } from "./types";

export type CanvasPathTool = "line" | "arrow";
export type CanvasPathDrawMode = "normal" | "multi";
export type CanvasPathPoint = [number, number];

export interface CanvasPathDraftState {
	tool: CanvasPathTool;
	points: CanvasPathPoint[];
}

export interface CanvasPathStartSnapState {
	point: CanvasPathPoint;
	active: boolean;
}

export const CANVAS_PATH_START_SNAP_DISTANCE_PX = 14;
export const CANVAS_PATH_START_INDICATOR_DISTANCE_PX = 48;

/**
 * Returns the shared start-point indicator/snap state used while drawing a
 * multi-line. Arrows stay open, while lines with at least three points can be
 * closed by clicking their first point.
 */
export function getCanvasPathStartSnapState(
	draft: CanvasPathDraftState | null,
	pointer: { x: number; y: number },
	zoom: number,
): CanvasPathStartSnapState | null {
	if (draft?.tool !== "line" || draft.points.length < 3) return null;
	const first = draft.points[0];
	const screenDistance =
		Math.hypot(pointer.x - first[0], pointer.y - first[1]) *
		Math.max(zoom, 0.01);
	if (screenDistance > CANVAS_PATH_START_INDICATOR_DISTANCE_PX) return null;
	return {
		point: first,
		active: screenDistance <= CANVAS_PATH_START_SNAP_DISTANCE_PX,
	};
}

export function dedupeCanvasPathPoints(
	points: CanvasPathPoint[],
): CanvasPathPoint[] {
	return points.filter((point, index) => {
		if (index === 0) return true;
		const previous = points[index - 1];
		return previous[0] !== point[0] || previous[1] !== point[1];
	});
}

export function appendCanvasPathPreviewPoint(
	points: CanvasPathPoint[],
	hoverPoint: CanvasPathPoint,
	mode?: CanvasElement["arrowMode"],
): CanvasPathPoint[] {
	if (mode === "elbow") {
		return appendCanvasElbowSegment(points, hoverPoint, true);
	}
	return [...points, hoverPoint];
}

export function commitCanvasPathPoint(
	points: CanvasPathPoint[],
	nextPoint: CanvasPathPoint,
	mode?: CanvasElement["arrowMode"],
): CanvasPathPoint[] {
	if (mode === "elbow") {
		return dedupeCanvasPathPoints(
			appendCanvasElbowSegment(points, nextPoint, false),
		);
	}
	return dedupeCanvasPathPoints([...points, nextPoint]);
}

function appendCanvasElbowSegment(
	points: CanvasPathPoint[],
	nextPoint: CanvasPathPoint,
	includePreviewTail: boolean,
): CanvasPathPoint[] {
	const lastPoint = points[points.length - 1];
	if (!lastPoint)
		return includePreviewTail ? [nextPoint, nextPoint] : [nextPoint];
	const relX = nextPoint[0] - lastPoint[0];
	const relY = nextPoint[1] - lastPoint[1];
	const segmentPoints = computeCanvasElbowPoints(relX, relY)
		.slice(1)
		.map(([x, y]) => [lastPoint[0] + x, lastPoint[1] + y] as CanvasPathPoint);
	const merged = [...points, ...segmentPoints];
	if (!includePreviewTail) return merged;
	const committed = dedupeCanvasPathPoints(merged);
	const tail = committed[committed.length - 1] ?? nextPoint;
	return [...committed, tail];
}

export function computeCanvasElbowPoints(
	relX: number,
	relY: number,
): CanvasPathPoint[] {
	const midX = relX / 2;
	const midY = relY / 2;
	if (Math.abs(relX) > Math.abs(relY)) {
		return [
			[0, 0],
			[midX, 0],
			[midX, relY],
			[relX, relY],
		];
	}
	return [
		[0, 0],
		[0, midY],
		[relX, midY],
		[relX, relY],
	];
}
