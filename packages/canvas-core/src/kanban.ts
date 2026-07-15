import { compareCanvasElementStackOrder } from "./ordering";
import type { CanvasElement } from "./types";

export type KanbanPriority = "low" | "medium" | "high" | "urgent";
export type KanbanDueKind =
	| "default"
	| "due-soon"
	| "overdue"
	| "overdue-long"
	| "complete";

const KANBAN_DUE_SOON_MS = 24 * 60 * 60 * 1000;

/** Parses date-only values in local time, matching the approved Web behavior. */
export function parseKanbanDateTime(value: string): Date | null {
	const match = value.match(
		/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/,
	);
	if (match) {
		const [, year, month, day, hours = "0", minutes = "0"] = match;
		const date = new Date(
			Number(year),
			Number(month) - 1,
			Number(day),
			Number(hours),
			Number(minutes),
		);
		return Number.isNaN(date.getTime()) ? null : date;
	}

	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveKanbanDueKind(
	dueDate: string | null | undefined,
	dueComplete: boolean,
	now = new Date(),
): KanbanDueKind {
	if (!dueDate) return "default";
	if (dueComplete) return "complete";
	const parsedDate = parseKanbanDateTime(dueDate);
	if (!parsedDate) return "default";
	const diffMs = parsedDate.getTime() - now.getTime();
	if (diffMs < 0) {
		return Math.abs(diffMs) > KANBAN_DUE_SOON_MS ? "overdue-long" : "overdue";
	}
	return diffMs <= KANBAN_DUE_SOON_MS ? "due-soon" : "default";
}

export function formatKanbanDateTimeValue(
	value: string,
	locale: "en" | "de",
): string {
	const match = value.match(
		/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/,
	);
	if (match) {
		const [, year, month, day, hours, minutes] = match;
		if (hours && minutes) {
			return locale === "en"
				? `${month}/${day}/${year}, ${hours}:${minutes}`
				: `${day}.${month}.${year}, ${hours}:${minutes}`;
		}
		return locale === "en"
			? `${month}/${day}/${year}`
			: `${day}.${month}.${year}`;
	}

	try {
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return value;
		return parsed.toLocaleString(locale === "en" ? "en-US" : "de-DE", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return value;
	}
}

export interface KanbanChecklistItem {
	id: string;
	text: string;
	completed: boolean;
}

export interface KanbanCardAttachment {
	id: string;
	src: string;
	name: string;
	width: number;
	height: number;
}

export interface KanbanAssigneeOption {
	id: string;
	name: string;
	image?: string | null;
	roleName?: string;
	roleColor?: string;
}

export interface KanbanRoleOption {
	id: string;
	name: string;
	color?: string | null;
}

export interface KanbanAssignmentOptions {
	members: KanbanAssigneeOption[];
	roles: KanbanRoleOption[];
}

export const KANBAN_LIST_PADDING = 12;
export const KANBAN_LIST_HEADER = 50;
export const KANBAN_LIST_IMAGE_HEADER = 112;
export const KANBAN_LIST_IMAGE_ASPECT_RATIO = 5 / 2;
export const KANBAN_CARD_GAP = 10;
export const KANBAN_LIST_FOOTER_HEIGHT = 42;

const KANBAN_LIST_MIN_HEIGHT =
	KANBAN_LIST_HEADER + KANBAN_LIST_PADDING + KANBAN_LIST_FOOTER_HEIGHT;

export function isKanbanCard(el: CanvasElement | undefined | null): boolean {
	return el?.customData?.skedraType === "kanban-card";
}

export function isKanbanList(el: CanvasElement | undefined | null): boolean {
	return el?.customData?.skedraType === "kanban-list";
}

export function hasKanbanListHeaderImage(
	el: CanvasElement | undefined | null,
): boolean {
	return (
		typeof el?.customData?.headerImageSrc === "string" &&
		el.customData.headerImageSrc.length > 0
	);
}

export function getKanbanListHeaderHeight(
	el: CanvasElement | undefined | null,
): number {
	return hasKanbanListHeaderImage(el)
		? KANBAN_LIST_IMAGE_HEADER
		: KANBAN_LIST_HEADER;
}

export function normalizeKanbanImageFocus(value: unknown): {
	x: number;
	y: number;
} {
	if (!value || typeof value !== "object") return { x: 0.5, y: 0.5 };
	const record = value as Record<string, unknown>;
	const x = typeof record.x === "number" ? record.x : 0.5;
	const y = typeof record.y === "number" ? record.y : 0.5;
	return {
		x: Math.min(1, Math.max(0, x)),
		y: Math.min(1, Math.max(0, y)),
	};
}

export function getKanbanImageObjectPosition(value: unknown): string {
	const focus = normalizeKanbanImageFocus(value);
	return `${Math.round(focus.x * 100)}% ${Math.round(focus.y * 100)}%`;
}

function getHitTestPriority(el: CanvasElement): number {
	if (isKanbanCard(el)) return 2;
	if (isKanbanList(el)) return 0;
	return 1;
}

export function getHitTestOrderedElements(
	elements: Iterable<CanvasElement>,
): CanvasElement[] {
	return Array.from(elements).sort((a, b) => {
		const priorityDiff = getHitTestPriority(b) - getHitTestPriority(a);
		if (priorityDiff !== 0) return priorityDiff;
		return compareCanvasElementStackOrder(b, a);
	});
}

export function elementCenter(el: CanvasElement): { x: number; y: number } {
	return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
}

function pointInRect(
	x: number,
	y: number,
	rx: number,
	ry: number,
	rw: number,
	rh: number,
): boolean {
	return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
}

export function findListAtPoint(
	elements: Map<string, CanvasElement>,
	x: number,
	y: number,
): CanvasElement | null {
	let hit: CanvasElement | null = null;
	for (const el of elements.values()) {
		if (!isKanbanList(el)) continue;
		if (pointInRect(x, y, el.x, el.y, el.width, el.height)) {
			if (!hit || compareCanvasElementStackOrder(el, hit) >= 0) {
				hit = el;
			}
		}
	}
	return hit;
}

function getListCards(
	elements: Map<string, CanvasElement>,
	listId: string,
): CanvasElement[] {
	const cards: CanvasElement[] = [];
	for (const el of elements.values()) {
		if (isKanbanCard(el) && el.frameId === listId) cards.push(el);
	}
	cards.sort((a, b) => {
		if (a.y !== b.y) return a.y - b.y;
		if (a.x !== b.x) return a.x - b.x;
		return a.id.localeCompare(b.id);
	});
	return cards;
}

function computeStackLayout(
	list: CanvasElement,
	cards: CanvasElement[],
	insertedCardId?: string,
	insertY?: number,
): {
	cardUpdates: Array<{ id: string; x: number; y: number; width: number }>;
	listHeight: number;
} {
	const cardWidth = list.width - KANBAN_LIST_PADDING * 2;
	const headerHeight = getKanbanListHeaderHeight(list);
	const startY =
		list.y +
		headerHeight +
		(hasKanbanListHeaderImage(list) ? KANBAN_CARD_GAP : 0);
	const startX = list.x + KANBAN_LIST_PADDING;

	let ordered = cards;
	if (insertedCardId && insertY != null) {
		const others = cards.filter((card) => card.id !== insertedCardId);
		const inserted = cards.find((card) => card.id === insertedCardId);
		if (inserted) {
			const insertIdx = others.findIndex(
				(card) => insertY < card.y + card.height / 2,
			);
			const idx = insertIdx === -1 ? others.length : insertIdx;
			ordered = [...others.slice(0, idx), inserted, ...others.slice(idx)];
		}
	}

	const updates: Array<{ id: string; x: number; y: number; width: number }> =
		[];
	let cursorY = startY;
	for (const card of ordered) {
		updates.push({
			id: card.id,
			x: startX,
			y: cursorY,
			width: cardWidth,
		});
		cursorY += card.height + KANBAN_CARD_GAP;
	}

	const listHeight = Math.max(
		Math.max(
			KANBAN_LIST_MIN_HEIGHT,
			headerHeight + KANBAN_LIST_PADDING + KANBAN_LIST_FOOTER_HEIGHT,
		),
		cursorY -
			list.y +
			(KANBAN_LIST_PADDING - KANBAN_CARD_GAP) +
			KANBAN_LIST_FOOTER_HEIGHT,
	);

	return { cardUpdates: updates, listHeight };
}

function buildKanbanListLayoutUpdates(
	elements: Map<string, CanvasElement>,
	listId: string,
	insertedCardId?: string,
	insertY?: number,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const list = elements.get(listId);
	if (!list || !isKanbanList(list)) return [];

	const cards = getListCards(elements, listId);
	const { cardUpdates, listHeight } = computeStackLayout(
		list,
		cards,
		insertedCardId,
		insertY,
	);
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [
		{ id: listId, changes: { height: listHeight } },
	];

	for (let index = 0; index < cardUpdates.length; index++) {
		const update = cardUpdates[index];
		updates.push({
			id: update.id,
			changes: {
				x: update.x,
				y: update.y,
				width: update.width,
				frameId: listId,
			},
		});
	}

	return updates;
}

export function buildKanbanListReflowUpdates(
	elements: Map<string, CanvasElement>,
	listId: string,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	return buildKanbanListLayoutUpdates(elements, listId);
}

export function buildKanbanReflowUpdates(
	elements: Map<string, CanvasElement>,
	movedCardIds: Set<string>,
	targetListByCard: Map<string, string | null>,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const affectedLists = new Set<string>();

	for (const cardId of movedCardIds) {
		const card = elements.get(cardId);
		if (!card) continue;
		if (card.frameId) affectedLists.add(card.frameId);
		const target = targetListByCard.get(cardId);
		if (target) affectedLists.add(target);
	}

	const dropY = new Map<string, number>();
	const nextElements = new Map(elements);
	for (const [cardId, listId] of targetListByCard) {
		const card = nextElements.get(cardId);
		if (!card) continue;
		dropY.set(cardId, card.y);
		nextElements.set(cardId, { ...card, frameId: listId ?? undefined });
	}

	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];

	for (const listId of affectedLists) {
		const cards = getListCards(nextElements, listId);
		const insertedCard = cards.find(
			(card) =>
				movedCardIds.has(card.id) && targetListByCard.get(card.id) === listId,
		);
		updates.push(
			...buildKanbanListLayoutUpdates(
				nextElements,
				listId,
				insertedCard?.id,
				insertedCard ? dropY.get(insertedCard.id) : undefined,
			),
		);
	}

	for (const cardId of movedCardIds) {
		const target = targetListByCard.get(cardId);
		if (target === null) {
			updates.push({ id: cardId, changes: { frameId: undefined } });
		}
	}

	return updates;
}

export function buildKanbanDeletionReflowUpdates(
	elements: Map<string, CanvasElement>,
	deletedIds: Iterable<string>,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const deletedSet = new Set(deletedIds);
	const affectedLists = new Set<string>();

	for (const id of deletedSet) {
		const element = elements.get(id);
		if (element && isKanbanCard(element) && element.frameId) {
			affectedLists.add(element.frameId);
		}
	}

	if (affectedLists.size === 0) return [];

	const nextElements = new Map(elements);
	for (const id of deletedSet) {
		nextElements.delete(id);
	}

	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];
	for (const listId of affectedLists) {
		updates.push(...buildKanbanListLayoutUpdates(nextElements, listId));
	}

	return updates;
}

export function normalizeKanbanChecklist(
	value: unknown,
): KanbanChecklistItem[] {
	if (!Array.isArray(value)) return [];

	return value.flatMap((entry, index) => {
		if (!entry || typeof entry !== "object") return [];
		const item = entry as Record<string, unknown>;
		const text = typeof item.text === "string" ? item.text.trim() : "";
		if (!text) return [];
		return [
			{
				id:
					typeof item.id === "string" && item.id
						? item.id
						: `check-${index}-${text.slice(0, 8)}`,
				text,
				completed: Boolean(item.completed),
			} satisfies KanbanChecklistItem,
		];
	});
}

export function normalizeKanbanAttachments(
	customData: Record<string, unknown> | undefined,
): KanbanCardAttachment[] {
	return normalizeRawAttachments(customData?.attachments);
}

export function normalizeKanbanCoverImage(
	customData: Record<string, unknown> | undefined,
): KanbanCardAttachment | null {
	const explicitCover = normalizeAttachmentRecord(
		customData?.coverImage,
		"cover-image",
	);
	if (explicitCover) return explicitCover;

	return null;
}

export function computeKanbanCardHeight(input: {
	title: string;
	description: string;
	checklist: KanbanChecklistItem[];
	coverImage?: KanbanCardAttachment | null;
	attachments: KanbanCardAttachment[];
	startDate?: string | null;
	dueDate?: string | null;
	assignmentBadges?: number;
}): number {
	const titleLines = estimateWrappedLines(input.title || "Neue Karte", 24, 3);
	const descriptionLines = input.description.trim()
		? estimateWrappedLines(input.description, 30, 3)
		: 0;
	const checklistPreviewCount = Math.min(input.checklist.length, 3);
	const checklistExtraCount = Math.max(
		0,
		input.checklist.length - checklistPreviewCount,
	);
	const footerBadges =
		(input.startDate ? 1 : 0) +
		(input.dueDate ? 1 : 0) +
		(input.checklist.length > 0 ? 1 : 0) +
		(input.attachments.length > 0 ? 1 : 0) +
		(input.assignmentBadges ?? 0);

	let height = 24;
	if (input.coverImage) height += 88 + 10;
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

function estimateWrappedLines(
	text: string,
	charsPerLine: number,
	maxLines: number,
): number {
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

function normalizeRawAttachments(value: unknown): KanbanCardAttachment[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry, index) => {
		const normalized = normalizeAttachmentRecord(entry, `att-${index}`);
		return normalized ? [normalized] : [];
	});
}

function normalizeAttachmentRecord(
	value: unknown,
	fallbackId: string,
): KanbanCardAttachment | null {
	if (!value || typeof value !== "object") return null;
	const attachment = value as Record<string, unknown>;
	const src = typeof attachment.src === "string" ? attachment.src : "";
	if (!src) return null;
	return {
		id:
			typeof attachment.id === "string" && attachment.id
				? attachment.id
				: fallbackId,
		src,
		name:
			typeof attachment.name === "string" && attachment.name
				? attachment.name
				: "Anhang",
		width: typeof attachment.width === "number" ? attachment.width : 0,
		height: typeof attachment.height === "number" ? attachment.height : 0,
	};
}

export function getKanbanAssignmentBadgeCount(
	customData: Record<string, unknown> | undefined,
): number {
	return (
		(typeof customData?.assigneeName === "string" && customData.assigneeName
			? 1
			: 0) +
		((typeof customData?.roleName === "string" && customData.roleName) ||
		(typeof customData?.groupName === "string" && customData.groupName)
			? 1
			: 0)
	);
}
