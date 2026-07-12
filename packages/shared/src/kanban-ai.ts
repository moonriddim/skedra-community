/**
 * Kanban-Generierung fuer AI: Schema + Layout-Builder (OpenAI-kompatibles Element-Format).
 */

import { z } from "zod";
import type { AddCanvasElementInput } from "./canvas-api";

export const KANBAN_LIST_WIDTH = 280;
export const KANBAN_LIST_PADDING = 12;
export const KANBAN_LIST_HEADER = 50;
export const KANBAN_CARD_GAP = 10;
export const KANBAN_LIST_FOOTER_HEIGHT = 42;
export const KANBAN_LIST_GAP = 24;
export const KANBAN_CARD_WIDTH = KANBAN_LIST_WIDTH - KANBAN_LIST_PADDING * 2;

const kanbanPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const aiKanbanCardSchema = z.object({
	title: z.string().min(1).max(200),
	description: z.string().max(2000).optional(),
	priority: kanbanPrioritySchema.optional(),
	checklist: z
		.array(
			z.object({
				text: z.string().min(1).max(300),
				completed: z.boolean().optional(),
			}),
		)
		.max(15)
		.optional(),
	dueDate: z.string().max(32).optional(),
});

export const aiKanbanListSchema = z.object({
	name: z.string().min(1).max(120),
	cards: z.array(aiKanbanCardSchema).max(15),
});

export const aiKanbanBoardSchema = z.object({
	lists: z.array(aiKanbanListSchema).min(1).max(6),
});

export type AiKanbanBoard = z.infer<typeof aiKanbanBoardSchema>;

function createId() {
	return crypto.randomUUID();
}

function estimateWrappedLines(
	text: string,
	charsPerLine: number,
	maxLines: number,
) {
	const normalized = text.trim();
	if (!normalized) return 0;
	const lines = normalized
		.split(/\r?\n/)
		.reduce(
			(sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)),
			0,
		);
	return Math.min(maxLines, lines);
}

/** Vereinfachte Hoehenberechnung — muss mit dem Canvas-Renderer konsistent bleiben. */
export function computeKanbanCardHeight(input: {
	title: string;
	description?: string;
	checklistCount?: number;
	hasDueDate?: boolean;
}): number {
	const titleLines = estimateWrappedLines(input.title || "Neue Karte", 24, 3);
	const descriptionLines = input.description?.trim()
		? estimateWrappedLines(input.description, 30, 3)
		: 0;
	const checklistPreviewCount = Math.min(input.checklistCount ?? 0, 3);
	const checklistExtraCount = Math.max(
		0,
		(input.checklistCount ?? 0) - checklistPreviewCount,
	);
	const footerBadges =
		(input.hasDueDate ? 1 : 0) + ((input.checklistCount ?? 0) > 0 ? 1 : 0);

	let height = 24;
	height += titleLines * 18;
	if (descriptionLines > 0) height += 6 + descriptionLines * 14;
	if (checklistPreviewCount > 0) {
		height += 10 + checklistPreviewCount * 18;
		if (checklistExtraCount > 0) height += 14;
	}
	if (footerBadges > 0) height += 12 + Math.ceil(footerBadges / 2) * 24;
	height += 18;

	return Math.max(88, Math.min(280, height));
}

function buildKanbanCardElement(input: {
	id: string;
	listId: string;
	x: number;
	y: number;
	height: number;
	title: string;
	description: string;
	priority: z.infer<typeof kanbanPrioritySchema> | null;
	checklist: Array<{ id: string; text: string; completed: boolean }>;
	dueDate: string | null;
}): AddCanvasElementInput {
	return {
		id: input.id,
		type: "rectangle",
		x: input.x,
		y: input.y,
		width: KANBAN_CARD_WIDTH,
		height: input.height,
		fill: "transparent",
		stroke: "transparent",
		strokeWidth: 1,
		cornerRadius: 8,
		text: input.title,
		fontSize: 14,
		fontFamily: "system-ui, sans-serif",
		frameId: input.listId,
		customData: {
			skedraType: "kanban-card",
			priority: input.priority,
			description: input.description,
			startDate: null,
			dueDate: input.dueDate,
			dueComplete: false,
			coverImage: null,
			checklist: input.checklist,
			attachments: [],
		},
	};
}

function buildKanbanListElements(input: {
	list: z.infer<typeof aiKanbanListSchema>;
	x: number;
	y: number;
}): AddCanvasElementInput[] {
	const listId = createId();
	const cardHeights = input.list.cards.map((card) =>
		computeKanbanCardHeight({
			title: card.title,
			description: card.description,
			checklistCount: card.checklist?.length ?? 0,
			hasDueDate: !!card.dueDate,
		}),
	);

	const listHeight =
		KANBAN_LIST_HEADER +
		cardHeights.reduce((sum, height) => sum + height, 0) +
		Math.max(0, input.list.cards.length - 1) * KANBAN_CARD_GAP +
		KANBAN_LIST_PADDING +
		KANBAN_LIST_FOOTER_HEIGHT;

	const listElement: AddCanvasElementInput = {
		id: listId,
		type: "frame",
		x: input.x,
		y: input.y,
		width: KANBAN_LIST_WIDTH,
		height: listHeight,
		fill: "transparent",
		stroke: "transparent",
		frameLabel: input.list.name,
		customData: { skedraType: "kanban-list" },
	};

	let nextCardY = input.y + KANBAN_LIST_HEADER;
	const cardElements = input.list.cards.map((card, index) => {
		const checklist =
			card.checklist?.map((item, checklistIndex) => ({
				id: `check-${checklistIndex}`,
				text: item.text,
				completed: item.completed ?? false,
			})) ?? [];

		const element = buildKanbanCardElement({
			id: createId(),
			listId,
			x: input.x + KANBAN_LIST_PADDING,
			y: nextCardY,
			height: cardHeights[index] ?? 88,
			title: card.title,
			description: card.description?.trim() ?? "",
			priority: card.priority ?? null,
			checklist,
			dueDate: card.dueDate ?? null,
		});

		nextCardY += (cardHeights[index] ?? 88) + KANBAN_CARD_GAP;
		return element;
	});

	return [listElement, ...cardElements];
}

/** Baut ein vollstaendiges Kanban-Board aus AI-JSON. */
export function buildKanbanElementsFromAi(
	board: AiKanbanBoard,
	options: { x?: number; y?: number } = {},
): AddCanvasElementInput[] {
	const originX = options.x ?? 80;
	const originY = options.y ?? 80;
	const elements: AddCanvasElementInput[] = [];

	for (const [index, list] of board.lists.entries()) {
		const listElements = buildKanbanListElements({
			list,
			x: originX + index * (KANBAN_LIST_WIDTH + KANBAN_LIST_GAP),
			y: originY,
		});
		elements.push(...listElements);
	}

	return elements;
}

export function countKanbanStats(elements: AddCanvasElementInput[]) {
	let lists = 0;
	let cards = 0;
	for (const element of elements) {
		const type = element.customData?.skedraType;
		if (type === "kanban-list") lists += 1;
		if (type === "kanban-card") cards += 1;
	}
	return { lists, cards };
}

/** Erkennt Kanban-relevante Prompts fuer einen zusaetzlichen LLM-Hinweis. */
export function promptSuggestsKanban(prompt: string) {
	return /\b(kanban|task\s*board|taskboard|spalten|backlog|sprint\s*board|todo\s*board|aufgaben(?:board|verwaltung)?)\b/i.test(
		prompt,
	);
}
