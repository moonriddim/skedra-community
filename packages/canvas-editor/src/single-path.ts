import {
	type CanvasDrawingStyle,
	type CanvasElement,
	type CanvasPathTool,
	buildCanvasDrawingElement,
	computeCanvasElbowPoints,
} from "@skedra/canvas-core";

export interface BuildCanvasSinglePathElementOptions {
	id: string;
	tool: CanvasPathTool;
	start: { x: number; y: number };
	end: { x: number; y: number };
	style: CanvasDrawingStyle;
}

/** Shared single-drag path construction used by Community and SDK. */
export function buildCanvasSinglePathElement({
	id,
	tool,
	start,
	end,
	style,
}: BuildCanvasSinglePathElementOptions): CanvasElement {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const relativePoints =
		style.arrowMode === "elbow"
			? computeCanvasElbowPoints(dx, dy)
			: style.arrowMode === "curve"
				? ([
						[0, 0],
						[dx / 2, dy / 2],
						[dx, dy],
					] satisfies [number, number][])
				: ([
						[0, 0],
						[dx, dy],
					] satisfies [number, number][]);
	return buildCanvasDrawingElement({
		id,
		tool,
		start,
		end,
		points: relativePoints.map(([x, y]) => ({
			x: start.x + x,
			y: start.y + y,
		})),
		style,
	});
}
