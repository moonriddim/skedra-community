import { getSvgPathElementData } from "./svg-path-element";
import type { CanvasElement } from "./types";

export function isCanvasPointPathElement(
	element: CanvasElement,
): element is CanvasElement & { points: [number, number][] } {
	return (
		!getSvgPathElementData(element) &&
		(element.type === "line" ||
			element.type === "arrow" ||
			element.type === "cloud") &&
		(element.points?.length ?? 0) >= 2
	);
}

export function buildCanvasPathPointChanges(
	element: CanvasElement,
	pointIndex: number,
	point: [number, number],
): Partial<CanvasElement> | null {
	if (!isCanvasPointPathElement(element)) return null;
	if (pointIndex < 0 || pointIndex >= element.points.length) return null;
	return {
		points: element.points.map((current, index) =>
			index === pointIndex ? point : current,
		),
	};
}

export function buildCanvasPathInsertPointChanges(
	element: CanvasElement,
	pointIndex: number,
	point: [number, number],
): Partial<CanvasElement> | null {
	if (!isCanvasPointPathElement(element)) return null;
	if (pointIndex < 1 || pointIndex > element.points.length) return null;
	const points = [...element.points];
	points.splice(pointIndex, 0, point);
	return { points };
}

export interface CanvasPathSegmentMidpoint {
	segmentIndex: number;
	insertIndex: number;
	point: [number, number];
}

export function getCanvasPathSegmentMidpoints(
	element: CanvasElement,
): CanvasPathSegmentMidpoint[] {
	if (!isCanvasPointPathElement(element)) return [];
	const segmentCount = element.closed
		? element.points.length
		: element.points.length - 1;
	return Array.from({ length: segmentCount }, (_, segmentIndex) => {
		const [x1, y1] = element.points[segmentIndex];
		const [x2, y2] = element.points[(segmentIndex + 1) % element.points.length];
		return {
			segmentIndex,
			insertIndex: segmentIndex + 1,
			point: [(x1 + x2) / 2, (y1 + y2) / 2],
		};
	});
}
