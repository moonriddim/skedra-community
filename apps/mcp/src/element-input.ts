import {
	type CanvasElement,
	type CanvasElementFactoryDefaults,
	createCanvasElementFromBoundsInput,
} from "@skedra/canvas-core";
import {
	type CanvasBoundsElementInput,
	canvasBoundsElementInputSchema,
} from "@skedra/shared";

export const elementInputSchema = canvasBoundsElementInputSchema;

export type McpCanvasElementInput = CanvasBoundsElementInput;

/** Converts the bounds-oriented MCP shape contract into a renderable element. */
export function createMcpCanvasElement(
	defaults: CanvasElementFactoryDefaults,
	input: McpCanvasElementInput,
): CanvasElement {
	return createCanvasElementFromBoundsInput(defaults, input, {
		createPathPointsFromBounds: true,
	});
}
