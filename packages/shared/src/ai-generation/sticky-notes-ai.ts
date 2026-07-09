/**
 * Sticky-Notes-Grid fuer AI.
 */

import { z } from "zod";
import type { AddCanvasElementInput } from "../canvas-api";

const STICKY_SIZE = 200;
const STICKY_GAP = 20;
const STICKY_COLORS = [
	"#FFF3BF",
	"#D3F9D8",
	"#D0EBFF",
	"#FFD6E0",
	"#FFE0CC",
	"#E5DBFF",
] as const;

const aiStickyNoteSchema = z.object({
	text: z.string().min(1).max(2000),
	color: z.string().max(16).optional(),
});

export const aiStickyNotesSchema = z.object({
	notes: z.array(aiStickyNoteSchema).min(1).max(24),
});

export type AiStickyNotesInput = z.infer<typeof aiStickyNotesSchema>;

function createId() {
	return crypto.randomUUID();
}

export function buildStickyNoteElementsFromAi(
	input: AiStickyNotesInput,
	options: { x?: number; y?: number; columns?: number } = {},
): { elements: AddCanvasElementInput[]; noteCount: number } {
	const originX = options.x ?? 80;
	const originY = options.y ?? 80;
	const columns = options.columns ?? 4;
	const elements: AddCanvasElementInput[] = [];

	input.notes.forEach((note, index) => {
		const column = index % columns;
		const row = Math.floor(index / columns);
		const color =
			note.color ??
			STICKY_COLORS[index % STICKY_COLORS.length] ??
			STICKY_COLORS[0];

		elements.push({
			id: createId(),
			type: "rectangle",
			x: originX + column * (STICKY_SIZE + STICKY_GAP),
			y: originY + row * (STICKY_SIZE + STICKY_GAP),
			width: STICKY_SIZE,
			height: STICKY_SIZE,
			fill: color,
			stroke: "#CED4DA",
			strokeWidth: 1,
			cornerRadius: 8,
			text: note.text,
			fontSize: 20,
			textAlign: "left",
			customData: { skedraType: "sticky-note" },
		});
	});

	return { elements, noteCount: input.notes.length };
}
