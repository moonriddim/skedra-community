import {
	getUntransformedBBox,
	inverseTransformCanvasElementPoint,
} from "./geometry-bbox";
import { pathTextLabelHitTest as defaultPathTextLabelHitTest } from "./path-rendering";
import { getFreeformRevisionCloudScallopDepth } from "./shape-geometry";
import type { CanvasElement } from "./types";

const CURVE_HIT_SEGMENTS = 24;

export type PathTextLabelHitTest = (
	element: CanvasElement,
	px: number,
	py: number,
	tolerance: number,
) => boolean;

export interface HitTestOptions {
	tolerance?: number;
	pathTextLabelHitTest?: PathTextLabelHitTest;
}

export function hitTest(
	el: CanvasElement,
	px: number,
	py: number,
	toleranceOrOptions: number | HitTestOptions = 4,
): boolean {
	const options =
		typeof toleranceOrOptions === "number"
			? { tolerance: toleranceOrOptions }
			: toleranceOrOptions;
	const t = options.tolerance ?? 4;
	const pathTextLabelHitTest =
		options.pathTextLabelHitTest ?? defaultPathTextLabelHitTest;
	const localPoint = inverseTransformCanvasElementPoint(el, { x: px, y: py });
	const hitX = localPoint.x;
	const hitY = localPoint.y;
	const bbox = getUntransformedBBox(el);

	switch (el.type) {
		case "rectangle":
		case "text":
			return (
				hitX >= bbox.x - t &&
				hitX <= bbox.x + bbox.width + t &&
				hitY >= bbox.y - t &&
				hitY <= bbox.y + bbox.height + t
			);

		case "diamond": {
			const dcx = bbox.x + bbox.width / 2;
			const dcy = bbox.y + bbox.height / 2;
			const drx = bbox.width / 2 + t;
			const dry = bbox.height / 2 + t;
			return Math.abs(hitX - dcx) / drx + Math.abs(hitY - dcy) / dry <= 1;
		}

		case "triangle":
			return pointInPolygon(hitX, hitY, [
				[bbox.x + bbox.width / 2, bbox.y - t],
				[bbox.x + bbox.width + t, bbox.y + bbox.height + t],
				[bbox.x - t, bbox.y + bbox.height + t],
			]);

		case "cloud": {
			if (!el.points || el.points.length < 3) {
				return (
					hitX >= bbox.x - t &&
					hitX <= bbox.x + bbox.width + t &&
					hitY >= bbox.y - t &&
					hitY <= bbox.y + bbox.height + t
				);
			}
			const localX = hitX - el.x;
			const localY = hitY - el.y;
			if (pointInPolygon(localX, localY, el.points)) return true;
			const tolerance =
				t +
				el.strokeWidth +
				getFreeformRevisionCloudScallopDepth(el.points, el.cloudArcRadius);
			for (let index = 0; index < el.points.length; index++) {
				const [x1, y1] = el.points[index];
				const [x2, y2] = el.points[(index + 1) % el.points.length];
				if (pointToLineDistance(localX, localY, x1, y1, x2, y2) <= tolerance) {
					return true;
				}
			}
			return false;
		}

		case "ellipse": {
			const cx = bbox.x + bbox.width / 2;
			const cy = bbox.y + bbox.height / 2;
			const rx = bbox.width / 2 + t;
			const ry = bbox.height / 2 + t;
			const dx = (hitX - cx) / rx;
			const dy = (hitY - cy) / ry;
			return dx * dx + dy * dy <= 1;
		}

		case "line": {
			if (pathTextLabelHitTest?.(el, hitX, hitY, t + 6)) return true;
			if (!el.points || el.points.length < 2) return false;
			const localX = hitX - el.x;
			const localY = hitY - el.y;
			if (
				el.closed === true &&
				el.points.length >= 3 &&
				el.fill !== "transparent" &&
				el.fill !== "" &&
				pointInPolygon(localX, localY, el.points)
			) {
				return true;
			}
			if (el.arrowMode === "curve" && el.points.length >= 3) {
				return el.closed
					? pointNearClosedSmoothCurve(
							localX,
							localY,
							el.points,
							t + el.strokeWidth + 4,
						)
					: pointNearArrowCurve(
							localX,
							localY,
							el.points,
							t + el.strokeWidth + 4,
							false,
						);
			}
			const segmentCount = el.closed ? el.points.length : el.points.length - 1;
			for (let i = 0; i < segmentCount; i++) {
				const [x1, y1] = el.points[i];
				const [x2, y2] = el.points[(i + 1) % el.points.length];
				if (
					pointToLineDistance(localX, localY, x1, y1, x2, y2) <=
					t + el.strokeWidth + 4
				) {
					return true;
				}
			}
			return false;
		}

		case "arrow":
		case "freehand": {
			if (
				el.type === "arrow" &&
				pathTextLabelHitTest?.(el, hitX, hitY, t + 6)
			) {
				return true;
			}
			if (!el.points || el.points.length < 2) return false;
			if (
				el.type === "arrow" &&
				el.arrowMode === "curve" &&
				el.points.length >= 3
			) {
				return pointNearArrowCurve(
					hitX - el.x,
					hitY - el.y,
					el.points,
					t + el.strokeWidth + 4,
					(el.roughness ?? 0) > 0,
				);
			}
			for (let i = 0; i < el.points.length - 1; i++) {
				const [x1, y1] = el.points[i];
				const [x2, y2] = el.points[i + 1];
				if (
					pointToLineDistance(hitX - el.x, hitY - el.y, x1, y1, x2, y2) <=
					t + el.strokeWidth + 4
				) {
					return true;
				}
			}
			return false;
		}

		default:
			return (
				hitX >= bbox.x - t &&
				hitX <= bbox.x + bbox.width + t &&
				hitY >= bbox.y - t &&
				hitY <= bbox.y + bbox.height + t
			);
	}
}

function pointInPolygon(
	px: number,
	py: number,
	points: [number, number][],
): boolean {
	let inside = false;
	for (
		let index = 0, previous = points.length - 1;
		index < points.length;
		previous = index++
	) {
		const [x1, y1] = points[index];
		const [x2, y2] = points[previous];
		const crosses =
			y1 > py !== y2 > py && px < ((x2 - x1) * (py - y1)) / (y2 - y1) + x1;
		if (crosses) inside = !inside;
	}
	return inside;
}

function pointNearClosedSmoothCurve(
	px: number,
	py: number,
	points: [number, number][],
	tolerance: number,
): boolean {
	for (let index = 0; index < points.length; index++) {
		const previous = points[(index - 1 + points.length) % points.length];
		const current = points[index];
		const next = points[(index + 1) % points.length];
		const start: [number, number] = [
			(previous[0] + current[0]) / 2,
			(previous[1] + current[1]) / 2,
		];
		const end: [number, number] = [
			(current[0] + next[0]) / 2,
			(current[1] + next[1]) / 2,
		];
		if (pointNearQuadraticBezier(px, py, start, current, end, tolerance)) {
			return true;
		}
	}
	return false;
}

function pointNearArrowCurve(
	px: number,
	py: number,
	points: [number, number][],
	tolerance: number,
	isRough: boolean,
): boolean {
	if (isRough) {
		return pointNearCatmullRomCurve(px, py, points, tolerance);
	}

	if (points.length === 3) {
		return pointNearQuadraticBezier(
			px,
			py,
			points[0],
			points[1],
			points[2],
			tolerance,
		);
	}

	if (points.length === 4) {
		return pointNearCubicBezier(
			px,
			py,
			points[0],
			points[1],
			points[2],
			points[3],
			tolerance,
		);
	}

	return pointNearSmoothCurve(px, py, points, tolerance);
}

function pointToLineDistance(
	px: number,
	py: number,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
): number {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const lenSq = dx * dx + dy * dy;
	if (lenSq === 0) return Math.hypot(px - x1, py - y1);

	let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
	t = Math.max(0, Math.min(1, t));

	const nearX = x1 + t * dx;
	const nearY = y1 + t * dy;
	return Math.hypot(px - nearX, py - nearY);
}

function pointNearQuadraticBezier(
	px: number,
	py: number,
	start: [number, number],
	control: [number, number],
	end: [number, number],
	tolerance: number,
): boolean {
	let previous = start;
	for (let step = 1; step <= CURVE_HIT_SEGMENTS; step++) {
		const t = step / CURVE_HIT_SEGMENTS;
		const mt = 1 - t;
		const current: [number, number] = [
			mt * mt * start[0] + 2 * mt * t * control[0] + t * t * end[0],
			mt * mt * start[1] + 2 * mt * t * control[1] + t * t * end[1],
		];
		if (
			pointToLineDistance(
				px,
				py,
				previous[0],
				previous[1],
				current[0],
				current[1],
			) <= tolerance
		) {
			return true;
		}
		previous = current;
	}
	return false;
}

function pointNearCubicBezier(
	px: number,
	py: number,
	start: [number, number],
	control1: [number, number],
	control2: [number, number],
	end: [number, number],
	tolerance: number,
): boolean {
	let previous = start;
	for (let step = 1; step <= CURVE_HIT_SEGMENTS; step++) {
		const t = step / CURVE_HIT_SEGMENTS;
		const mt = 1 - t;
		const current: [number, number] = [
			mt * mt * mt * start[0] +
				3 * mt * mt * t * control1[0] +
				3 * mt * t * t * control2[0] +
				t * t * t * end[0],
			mt * mt * mt * start[1] +
				3 * mt * mt * t * control1[1] +
				3 * mt * t * t * control2[1] +
				t * t * t * end[1],
		];
		if (
			pointToLineDistance(
				px,
				py,
				previous[0],
				previous[1],
				current[0],
				current[1],
			) <= tolerance
		) {
			return true;
		}
		previous = current;
	}
	return false;
}

function pointNearSmoothCurve(
	px: number,
	py: number,
	points: [number, number][],
	tolerance: number,
): boolean {
	let segmentStart = points[0];
	for (let index = 1; index < points.length - 1; index++) {
		const control = points[index];
		const next = points[index + 1];
		const segmentEnd: [number, number] = [
			(control[0] + next[0]) / 2,
			(control[1] + next[1]) / 2,
		];
		if (
			pointNearQuadraticBezier(
				px,
				py,
				segmentStart,
				control,
				segmentEnd,
				tolerance,
			)
		) {
			return true;
		}
		segmentStart = segmentEnd;
	}

	const end = points[points.length - 1];
	return (
		pointToLineDistance(
			px,
			py,
			segmentStart[0],
			segmentStart[1],
			end[0],
			end[1],
		) <= tolerance
	);
}

function pointNearCatmullRomCurve(
	px: number,
	py: number,
	points: [number, number][],
	tolerance: number,
): boolean {
	const first = points[0];
	const last = points[points.length - 1];
	const extended = [first, ...points, last];

	for (let index = 1; index + 2 < extended.length; index++) {
		const before = extended[index - 1];
		const start = extended[index];
		const end = extended[index + 1];
		const after = extended[index + 2];
		const control1: [number, number] = [
			start[0] + (end[0] - before[0]) / 6,
			start[1] + (end[1] - before[1]) / 6,
		];
		const control2: [number, number] = [
			end[0] + (start[0] - after[0]) / 6,
			end[1] + (start[1] - after[1]) / 6,
		];
		if (
			pointNearCubicBezier(px, py, start, control1, control2, end, tolerance)
		) {
			return true;
		}
	}

	return false;
}
