/**
 * Rahmen (Frame-Tool) fuer AI.
 */

import { z } from "zod";
import type { AddCanvasElementInput } from "../canvas-api";

const aiFrameSchema = z.object({
	label: z.string().min(1).max(120),
	width: z.number().min(120).max(1200).optional(),
	height: z.number().min(80).max(900).optional(),
});

export const aiFramesSchema = z.object({
	frames: z.array(aiFrameSchema).min(1).max(8),
});

export type AiFramesInput = z.infer<typeof aiFramesSchema>;

function createId() {
	return crypto.randomUUID();
}

export function buildFrameElementsFromAi(
	input: AiFramesInput,
	options: { x?: number; y?: number } = {},
): { elements: AddCanvasElementInput[]; frameCount: number } {
	const originX = options.x ?? 80;
	const originY = options.y ?? 80;
	const gap = 32;
	let cursorX = originX;
	const elements: AddCanvasElementInput[] = [];

	input.frames.forEach((frame, index) => {
		const width = frame.width ?? 420;
		const height = frame.height ?? 280;

		elements.push({
			id: createId(),
			type: "frame",
			x: cursorX,
			y: originY,
			width,
			height,
			fill: "transparent",
			stroke: "#64748B",
			strokeWidth: 1.5,
			frameLabel: frame.label,
		});

		cursorX += width + gap;
	});

	return { elements, frameCount: input.frames.length };
}
