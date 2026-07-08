import { getBBox } from "./geometry-bbox";
import { pathTextLabelHitTest as defaultPathTextLabelHitTest } from "./path-rendering";
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
	const bbox = getBBox(el);

	switch (el.type) {
		case "rectangle":
		case "text":
			return (
				px >= bbox.x - t &&
				px <= bbox.x + bbox.width + t &&
				py >= bbox.y - t &&
				py <= bbox.y + bbox.height + t
			);

		case "diamond": {
			const dcx = bbox.x + bbox.width / 2;
			const dcy = bbox.y + bbox.height / 2;
			const drx = bbox.width / 2 + t;
			const dry = bbox.height / 2 + t;
			return Math.abs(px - dcx) / drx + Math.abs(py - dcy) / dry <= 1;
		}

		case "ellipse": {
			const cx = bbox.x + bbox.width / 2;
			const cy = bbox.y + bbox.height / 2;
			const rx = bbox.width / 2 + t;
			const ry = bbox.height / 2 + t;
			const dx = (px - cx) / rx;
			const dy = (py - cy) / ry;
			return dx * dx + dy * dy <= 1;
		}

		case "line": {
			if (pathTextLabelHitTest?.(el, px, py, t + 6)) return true;
			if (!el.points || el.points.length < 2) return false;
			for (let i = 0; i < el.points.length - 1; i++) {
				const [x1, y1] = el.points[i];
				const [x2, y2] = el.points[i + 1];
				if (
					pointToLineDistance(px - el.x, py - el.y, x1, y1, x2, y2) <=
					t + el.strokeWidth + 4
				) {
					return true;
				}
			}
			return false;
		}

		case "arrow":
		case "freehand": {
			if (el.type === "arrow" && pathTextLabelHitTest?.(el, px, py, t + 6)) {
				return true;
			}
			if (!el.points || el.points.length < 2) return false;
			if (
				el.type === "arrow" &&
				el.arrowMode === "curve" &&
				el.points.length >= 3
			) {
				return pointNearQuadraticBezier(
					px - el.x,
					py - el.y,
					el.points[0],
					el.points[1],
					el.points[2],
					t + el.strokeWidth + 4,
				);
			}
			for (let i = 0; i < el.points.length - 1; i++) {
				const [x1, y1] = el.points[i];
				const [x2, y2] = el.points[i + 1];
				if (
					pointToLineDistance(px - el.x, py - el.y, x1, y1, x2, y2) <=
					t + el.strokeWidth + 4
				) {
					return true;
				}
			}
			return false;
		}

		default:
			return (
				px >= bbox.x - t &&
				px <= bbox.x + bbox.width + t &&
				py >= bbox.y - t &&
				py <= bbox.y + bbox.height + t
			);
	}
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
