import {
	type CanvasElement,
	type CanvasElementFactoryDefaults,
	createBaseCanvasElement,
} from "@skedra/canvas-core";
import { z } from "zod";

export const elementInputSchema = z.object({
	type: z.enum([
		"rectangle",
		"ellipse",
		"diamond",
		"line",
		"arrow",
		"text",
		"frame",
	]),
	x: z.number(),
	y: z.number(),
	width: z.number().positive(),
	height: z.number().positive(),
	text: z.string().optional(),
	fill: z.string().optional(),
	stroke: z.string().optional(),
});

export type McpCanvasElementInput = z.infer<typeof elementInputSchema>;

/** Converts the bounds-oriented MCP shape contract into a renderable element. */
export function createMcpCanvasElement(
	defaults: CanvasElementFactoryDefaults,
	input: McpCanvasElementInput,
): CanvasElement {
	const isPath = input.type === "line" || input.type === "arrow";
	return createBaseCanvasElement(defaults, {
		type: input.type,
		x: input.x,
		y: input.y,
		width: input.width,
		height: input.height,
		...(isPath
			? {
					points: [
						[0, 0],
						[input.width, input.height],
					] as [number, number][],
				}
			: {}),
		...(input.text !== undefined ? { text: input.text } : {}),
		...(input.fill !== undefined ? { fill: input.fill } : {}),
		...(input.stroke !== undefined ? { stroke: input.stroke } : {}),
	});
}
