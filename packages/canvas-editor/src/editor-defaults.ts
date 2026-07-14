import {
	type CanvasDrawingStyle,
	type CanvasElement,
	createBaseCanvasElement,
} from "@skedra/canvas-core";
import type { CanvasEditorToolId } from "./editor-contract";

export type CanvasEditorElementStyle = CanvasDrawingStyle &
	Partial<
		Pick<
			CanvasElement,
			| "opacity"
			| "fontSize"
			| "textColor"
			| "textAlign"
			| "fontWeight"
			| "fontStyle"
			| "textDecoration"
		>
	>;

export interface BuildCanvasEditorDefaultsElementOptions {
	tool: CanvasEditorToolId;
	style: CanvasEditorElementStyle;
	width?: number;
	height?: number;
	id?: string;
}

/**
 * Builds the synthetic element consumed by the shared properties surface while
 * no real element is selected. Both adapters therefore expose and mutate the
 * same drawing defaults through the same UI contract.
 */
export function buildCanvasEditorDefaultsElement({
	tool,
	style,
	width = 100,
	height = 100,
	id = "__canvas-editor-defaults__",
}: BuildCanvasEditorDefaultsElementOptions): CanvasElement | null {
	const type = getCanvasEditorDefaultsElementType(tool);
	if (!type) return null;

	return createBaseCanvasElement(
		{
			createId: () => id,
			stroke: style.stroke,
			fontFamily: style.fontFamily,
		},
		{
			type,
			width,
			height,
			...style,
			points:
				type === "line" || type === "arrow"
					? [
							[0, 0],
							[100, 0],
						]
					: undefined,
		},
	);
}

function getCanvasEditorDefaultsElementType(
	tool: CanvasEditorToolId,
): CanvasElement["type"] | null {
	switch (tool) {
		case "rectangle":
		case "ellipse":
		case "diamond":
		case "line":
		case "arrow":
		case "text":
		case "freehand":
		case "frame":
			return tool;
		default:
			return null;
	}
}
