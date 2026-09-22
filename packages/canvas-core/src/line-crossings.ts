import * as pointsOnPathModule from "points-on-path";
import { getArrowPath, getLinePath } from "./path-rendering";
import type { CanvasElement } from "./types";

type Point = [number, number];
export interface LineCrossingGap {
	x: number;
	y: number;
	radius: number;
}

export function getLineCrossingGapSize(element: CanvasElement): number {
	const value = element.customData?.lineCrossingGap;
	return typeof value === "number" && Number.isFinite(value)
		? Math.max(0, Math.min(100, value))
		: 0;
}

function worldPaths(element: CanvasElement): Point[][] {
	const points = element.points;
	if (!points || points.length < 2) return [];
	const path =
		element.type === "line"
			? getLinePath(points, element.arrowMode, element.closed)
			: getArrowPath(points, element.arrowMode);
	const angle = ((element.rotation ?? 0) * Math.PI) / 180;
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return pointsOnPathModule.pointsOnPath(path, 0.2, 0.1).map((set) =>
		set.map(([x, y]): Point => {
			const dx = (x - element.width / 2) * (element.flipX ? -1 : 1);
			const dy = (y - element.height / 2) * (element.flipY ? -1 : 1);
			return [
				element.x + element.width / 2 + dx * cos - dy * sin,
				element.y + element.height / 2 + dx * sin + dy * cos,
			];
		}),
	);
}

/** Transparent gaps on opted-in paths; shared endpoints remain connected.
 * If both paths opt in, only the lower path in stacking order is interrupted.
 */
export function buildLineCrossingGaps(
	elements: readonly CanvasElement[],
): Map<string, LineCrossingGap[]> {
	const result = new Map<string, LineCrossingGap[]>();
	const lines = elements.filter(
		(el) => (el.type === "line" || el.type === "arrow") && el.opacity > 0,
	);
	if (!lines.some((el) => getLineCrossingGapSize(el) > 0)) return result;
	const paths = lines.map(worldPaths);
	for (let i = 0; i < lines.length; i++) {
		const size = getLineCrossingGapSize(lines[i]);
		if (!size) continue;
		const gaps: LineCrossingGap[] = [];
		for (let j = 0; j < lines.length; j++) {
			if (i === j || (j < i && getLineCrossingGapSize(lines[j]) > 0)) continue;
			for (const a of paths[i])
				for (const b of paths[j]) {
					for (let ai = 1; ai < a.length; ai++)
						for (let bi = 1; bi < b.length; bi++) {
							const p = a[ai - 1];
							const q = b[bi - 1];
							const rx = a[ai][0] - p[0];
							const ry = a[ai][1] - p[1];
							const sx = b[bi][0] - q[0];
							const sy = b[bi][1] - q[1];
							const cross = rx * sy - ry * sx;
							if (Math.abs(cross) < 1e-8) continue;
							const t = ((q[0] - p[0]) * sy - (q[1] - p[1]) * sx) / cross;
							const u = ((q[0] - p[0]) * ry - (q[1] - p[1]) * rx) / cross;
							if (t < 0 || t > 1 || u < 0 || u > 1) continue;
							const x = p[0] + t * rx;
							const y = p[1] + t * ry;
							if (
								[a[0], a[a.length - 1], b[0], b[b.length - 1]].some(
									(end) => Math.hypot(end[0] - x, end[1] - y) < 0.01,
								)
							)
								continue;
							if (!gaps.some((gap) => Math.hypot(gap.x - x, gap.y - y) < 0.1)) {
								gaps.push({ x, y, radius: (size + lines[j].strokeWidth) / 2 });
							}
						}
				}
		}
		if (gaps.length) result.set(lines[i].id, gaps);
	}
	return result;
}
