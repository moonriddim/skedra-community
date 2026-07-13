import {
	elbowPath,
	linePath,
	quadBezierPath,
	smoothPath,
} from "@skedra/canvas-core";
import type { CanvasElement, StrokeStyle } from "@skedra/canvas-core";

export {
	roughArrowHeadHtml,
	useRoughShapeLayers,
	type RoughShapeLayers,
} from "./rough-shape-layers";

export function dashArray(
	style: StrokeStyle | undefined,
	strokeWidth: number,
): string | undefined {
	if (!style || style === "solid") return undefined;
	if (style === "dashed") return `${strokeWidth * 4} ${strokeWidth * 3}`;
	if (style === "dotted") return `${strokeWidth} ${strokeWidth * 2}`;
	return undefined;
}

function getPathData(el: CanvasElement) {
	if (!el.points || el.points.length < 2) return null;
	if (el.type === "freehand") return smoothPath(el.points);
	if (el.type === "line") return linePath(el.points);
	if (el.type !== "arrow") return null;

	const mode = el.arrowMode ?? "straight";
	if (mode === "curve") return quadBezierPath(el.points);
	if (mode === "elbow") return elbowPath(el.points);
	return linePath(el.points);
}
