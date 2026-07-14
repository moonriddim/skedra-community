import {
	type CanvasDrawingStyle,
	type CanvasDrawingTool,
	type CanvasElement,
	buildCanvasDrawingElement,
} from "@skedra/canvas-core";
import { buildCanvasSinglePathElement } from "./single-path";

export interface BuildCanvasEditorDrawingElementOptions {
	id: string;
	tool: CanvasDrawingTool;
	start: { x: number; y: number };
	end?: { x: number; y: number };
	points?: Array<{ x: number; y: number }>;
	style: CanvasDrawingStyle;
}

/** One drawing-element factory shared by Community previews and the SDK surface. */
export function buildCanvasEditorDrawingElement({
	id,
	tool,
	start,
	end = start,
	points,
	style,
}: BuildCanvasEditorDrawingElementOptions): CanvasElement {
	if (tool === "line" || tool === "arrow") {
		return buildCanvasSinglePathElement({ id, tool, start, end, style });
	}
	return buildCanvasDrawingElement({ id, tool, start, end, points, style });
}
