/**
 * Template-Boards (Retrospektive, SWOT) fuer AI.
 */

import { z } from "zod";
import type { AddCanvasElementInput } from "../canvas-api";

const TEMPLATE_SECTION_TYPE = "template-section";
const SECTION_PADDING_X = 18;
const SECTION_PADDING_TOP = 92;
const SECTION_GAP = 18;

function createId() {
	return crypto.randomUUID();
}

function buildTemplateSection(input: {
	x: number;
	y: number;
	width: number;
	height: number;
	label: string;
	tool: "retrospective" | "swot";
	sectionId: string;
	accent: string;
	stickyColor: string;
	stickyWidth: number;
	stickyHeight: number;
	layoutId: string;
	layoutRole: string;
}): AddCanvasElementInput {
	return {
		id: createId(),
		type: "frame",
		x: input.x,
		y: input.y,
		width: input.width,
		height: input.height,
		fill: "transparent",
		stroke: input.accent,
		strokeWidth: 1.5,
		frameLabel: input.label,
		customData: {
			skedraType: TEMPLATE_SECTION_TYPE,
			templateTool: input.tool,
			templateSectionId: input.sectionId,
			templateAccent: input.accent,
			templateBaseHeight: input.height,
			stickyColor: input.stickyColor,
			stickyWidth: input.stickyWidth,
			stickyHeight: input.stickyHeight,
			templateLayoutId: input.layoutId,
			templateLayoutRole: input.layoutRole,
		},
	};
}

function buildTemplateSticky(input: {
	section: AddCanvasElementInput;
	text: string;
	index: number;
	tool: "retrospective" | "swot";
	sectionId: string;
	noteType: string;
	accent: string;
	stickyColor: string;
	noteWidth: number;
	noteHeight: number;
}): AddCanvasElementInput {
	const columns = Math.max(
		1,
		Math.floor(
			(input.section.width - SECTION_PADDING_X * 2 + SECTION_GAP) /
				(input.noteWidth + SECTION_GAP),
		),
	);
	const column = input.index % columns;
	const row = Math.floor(input.index / columns);

	return {
		id: createId(),
		type: "rectangle",
		x:
			input.section.x +
			SECTION_PADDING_X +
			column * (input.noteWidth + SECTION_GAP),
		y:
			input.section.y +
			SECTION_PADDING_TOP +
			row * (input.noteHeight + SECTION_GAP),
		width: input.noteWidth,
		height: input.noteHeight,
		fill: input.stickyColor,
		stroke: input.accent,
		strokeWidth: 1,
		cornerRadius: 8,
		text: input.text,
		fontSize: input.noteHeight < 160 ? 18 : 20,
		textAlign: "left",
		frameId: input.section.id,
		customData: {
			skedraType: "sticky-note",
			templateTool: input.tool,
			templateSectionId: input.sectionId,
			templateNoteType: input.noteType,
			templateAccent: input.accent,
			stickyColor: input.stickyColor,
			stickyWidth: input.noteWidth,
			stickyHeight: input.noteHeight,
		},
	};
}

export const aiRetrospectiveSchema = z.object({
	celebrate: z.array(z.string().min(1).max(500)).max(12).optional(),
	friction: z.array(z.string().min(1).max(500)).max(12).optional(),
	commitment: z.array(z.string().min(1).max(500)).max(12).optional(),
});

export const aiSwotSchema = z.object({
	strengths: z.array(z.string().min(1).max(500)).max(12).optional(),
	weaknesses: z.array(z.string().min(1).max(500)).max(12).optional(),
	opportunities: z.array(z.string().min(1).max(500)).max(12).optional(),
	threats: z.array(z.string().min(1).max(500)).max(12).optional(),
});

const RETRO_SECTIONS = [
	{
		key: "celebrate",
		label: "Celebrate",
		sectionId: "celebrate",
		noteType: "celebrate",
		accent: "#15803D",
		color: "#D3F9D8",
	},
	{
		key: "friction",
		label: "Friction",
		sectionId: "friction",
		noteType: "friction",
		accent: "#DC2626",
		color: "#FFD6E0",
	},
	{
		key: "commitment",
		label: "Commitment",
		sectionId: "commitment",
		noteType: "commitment",
		accent: "#2563EB",
		color: "#D0EBFF",
	},
] as const;

const SWOT_SECTIONS = [
	{
		key: "strengths",
		label: "Strengths",
		sectionId: "strengths",
		noteType: "strength",
		accent: "#15803D",
		color: "#D3F9D8",
	},
	{
		key: "weaknesses",
		label: "Weaknesses",
		sectionId: "weaknesses",
		noteType: "weakness",
		accent: "#DC2626",
		color: "#FFD6E0",
	},
	{
		key: "opportunities",
		label: "Opportunities",
		sectionId: "opportunities",
		noteType: "opportunity",
		accent: "#2563EB",
		color: "#D0EBFF",
	},
	{
		key: "threats",
		label: "Threats",
		sectionId: "threats",
		noteType: "threat",
		accent: "#D97706",
		color: "#FFE0CC",
	},
] as const;

export function buildRetrospectiveElementsFromAi(
	input: z.infer<typeof aiRetrospectiveSchema>,
	options: { x?: number; y?: number } = {},
): {
	elements: AddCanvasElementInput[];
	sectionCount: number;
	noteCount: number;
} {
	const layoutId = createId();
	const columnWidth = 316;
	const columnHeight = 420;
	const gap = 34;
	const startX =
		(options.x ?? 80) - (columnWidth * 3 + gap * 2) / 2 + columnWidth;
	const startY = options.y ?? 80;
	const elements: AddCanvasElementInput[] = [];
	let noteCount = 0;

	RETRO_SECTIONS.forEach((section, index) => {
		const notes = input[section.key as keyof typeof input] ?? [];
		const sectionElement = buildTemplateSection({
			x: startX + index * (columnWidth + gap),
			y: startY,
			width: columnWidth,
			height: columnHeight,
			label: section.label,
			tool: "retrospective",
			sectionId: section.sectionId,
			accent: section.accent,
			stickyColor: section.color,
			stickyWidth: 126,
			stickyHeight: 110,
			layoutId,
			layoutRole: section.sectionId,
		});
		elements.push(sectionElement);

		notes.forEach((text, noteIndex) => {
			elements.push(
				buildTemplateSticky({
					section: sectionElement,
					text,
					index: noteIndex,
					tool: "retrospective",
					sectionId: section.sectionId,
					noteType: section.noteType,
					accent: section.accent,
					stickyColor: section.color,
					noteWidth: 126,
					noteHeight: 110,
				}),
			);
			noteCount += 1;
		});
	});

	return { elements, sectionCount: RETRO_SECTIONS.length, noteCount };
}

export function buildSwotElementsFromAi(
	input: z.infer<typeof aiSwotSchema>,
	options: { x?: number; y?: number } = {},
): {
	elements: AddCanvasElementInput[];
	quadrantCount: number;
	noteCount: number;
} {
	const layoutId = createId();
	const sectionWidth = 380;
	const sectionHeight = 340;
	const sectionGap = 38;
	const centerX = options.x ?? 500;
	const topY = options.y ?? 80;
	const leftX = centerX - sectionWidth - sectionGap / 2;
	const rightX = centerX + sectionGap / 2;
	const bottomY = topY + sectionHeight + sectionGap;
	const elements: AddCanvasElementInput[] = [];
	let noteCount = 0;

	const positions = [
		{ x: leftX, y: topY },
		{ x: rightX, y: topY },
		{ x: leftX, y: bottomY },
		{ x: rightX, y: bottomY },
	];

	SWOT_SECTIONS.forEach((section, index) => {
		const notes = input[section.key as keyof typeof input] ?? [];
		const pos = positions[index] ?? positions[0];
		if (!pos) return;
		const sectionElement = buildTemplateSection({
			x: pos.x,
			y: pos.y,
			width: sectionWidth,
			height: sectionHeight,
			label: section.label,
			tool: "swot",
			sectionId: section.sectionId,
			accent: section.accent,
			stickyColor: section.color,
			stickyWidth: 160,
			stickyHeight: 124,
			layoutId,
			layoutRole: section.sectionId,
		});
		elements.push(sectionElement);

		notes.forEach((text, noteIndex) => {
			elements.push(
				buildTemplateSticky({
					section: sectionElement,
					text,
					index: noteIndex,
					tool: "swot",
					sectionId: section.sectionId,
					noteType: section.noteType,
					accent: section.accent,
					stickyColor: section.color,
					noteWidth: 160,
					noteHeight: 124,
				}),
			);
			noteCount += 1;
		});
	});

	return { elements, quadrantCount: SWOT_SECTIONS.length, noteCount };
}
