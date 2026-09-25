import { compareCanvasElementStackOrder } from "./ordering";
import type { CanvasElement } from "./types";

export type KanbanPriority = "low" | "medium" | "high" | "urgent";
export interface KanbanQuickEdit {
	title?: string;
	priority?: KanbanPriority | null;
	dueDate?: string | null;
	toggleChecklistItem?: string;
}

/** Apply only the edited field to the latest card, preserving other collaborators' data. */
export function buildKanbanQuickEditUpdates(
	elements: Map<string, CanvasElement>,
	id: string,
	edit: KanbanQuickEdit,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const card = elements.get(id);
	if (!card || !isKanbanCard(card) || card.locked) return [];
	const customData = { ...card.customData };
	if (edit.priority !== undefined) customData.priority = edit.priority;
	if (edit.dueDate !== undefined) customData.dueDate = edit.dueDate;
	if (edit.toggleChecklistItem !== undefined) {
		customData.checklist = normalizeKanbanChecklist(customData.checklist).map(
			(item) =>
				item.id === edit.toggleChecklistItem
					? { ...item, completed: !item.completed }
					: item,
		);
	}
	const text = edit.title ?? card.text ?? "";
	const height = computeKanbanCardHeight({
		title: text,
		description:
			typeof customData.description === "string" ? customData.description : "",
		checklist: normalizeKanbanChecklist(customData.checklist),
		attachments: normalizeKanbanAttachments(customData),
		coverImage: normalizeKanbanCoverImage(customData),
		startDate: customData.startDate as string | null,
		dueDate: customData.dueDate as string | null,
		assignmentBadges: getKanbanAssignmentBadgeCount(customData),
	});
	const changes = { text, customData, height };
	const next = new Map(elements);
	next.set(id, { ...card, ...changes });
	return [
		{ id, changes },
		...buildKanbanReflowUpdates(
			next,
			new Set([id]),
			new Map([[id, card.frameId ?? null]]),
		),
	];
}
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
	mimeType?: string;
	sizeBytes?: number;
}

export const KANBAN_CARD_COVER_HEIGHT = 88;

export interface KanbanCoverPosition {
	x: number;
	y: number;
}

export interface KanbanCoverImage extends KanbanCardAttachment {
	position: KanbanCoverPosition;
}

export function normalizeKanbanCoverPosition(
	value: unknown,
): KanbanCoverPosition {
	const position =
		value && typeof value === "object"
			? (value as Record<string, unknown>)
			: {};
	const clamp = (value: unknown) =>
		typeof value === "number" && Number.isFinite(value)
			? Math.max(0, Math.min(100, value))
			: 50;
	return { x: clamp(position.x), y: clamp(position.y) };
}

/** CSS object-position percentages map to the image overflow, not its full size. */
export function moveKanbanCoverPosition(
	start: KanbanCoverPosition,
	delta: { x: number; y: number },
	image: { width: number; height: number },
	frame: { width: number; height: number },
): KanbanCoverPosition {
	if (
		image.width <= 0 ||
		image.height <= 0 ||
		frame.width <= 0 ||
		frame.height <= 0
	)
		return normalizeKanbanCoverPosition(start);
	const scale = Math.max(
		frame.width / image.width,
		frame.height / image.height,
	);
	const overflowX = image.width * scale - frame.width;
	const overflowY = image.height * scale - frame.height;
	return normalizeKanbanCoverPosition({
		x: overflowX > 0.01 ? start.x - (delta.x / overflowX) * 100 : start.x,
		y: overflowY > 0.01 ? start.y - (delta.y / overflowY) * 100 : start.y,
	});
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

export const KANBAN_LAYOUT_CARD_WIDTH = 256;

interface KanbanColumn {
	id: number;
	cards: CanvasElement[];
}

const columnStep = KANBAN_LAYOUT_CARD_WIDTH + KANBAN_CARD_GAP;
const kanbanColumnsWidth = (count: number) =>
	Math.max(1, count) * columnStep - KANBAN_CARD_GAP + KANBAN_LIST_PADDING * 2;
const kanbanContentY = (list: CanvasElement) =>
	list.y +
	getKanbanListHeaderHeight(list) +
	(hasKanbanListHeaderImage(list) ? KANBAN_CARD_GAP : 0);
const columnHeight = (cards: CanvasElement[]) =>
	cards.reduce((height, card) => height + card.height, 0) +
	Math.max(0, cards.length - 1) * KANBAN_CARD_GAP;

function getKanbanColumns(
	list: CanvasElement,
	cards: CanvasElement[],
): KanbanColumn[] {
	const columns = new Map<number, CanvasElement[]>();
	for (const card of cards) {
		const saved = card.customData?.kanbanColumn;
		// Read the previous row layout once, retaining left/right placement while closing vertical gaps.
		const id =
			typeof saved === "number" && Number.isInteger(saved) && saved >= 0
				? saved
				: typeof card.customData?.kanbanRow === "string"
					? Math.max(
							0,
							Math.round((card.x - list.x - KANBAN_LIST_PADDING) / columnStep),
						)
					: 0;
		const column = columns.get(id) ?? [];
		column.push(card);
		columns.set(id, column);
	}
	return [...columns]
		.sort(([a], [b]) => a - b)
		.map(([id, cards]) => ({
			id,
			cards: cards.sort((a, b) => a.y - b.y || a.id.localeCompare(b.id)),
		}));
}

export interface KanbanDropTarget {
	listId: string;
	index: number;
	column: number;
	mode: "between" | "beside";
	x: number;
	y: number;
	width: number;
	cardHeight?: number;
	listBounds: { x: number; y: number; width: number; height: number };
}

/** Each column has its own stack; either outer edge deliberately creates another. */
export function resolveKanbanDropTarget(
	elements: Map<string, CanvasElement>,
	movedIds: Iterable<string>,
	point: { x: number; y: number },
): KanbanDropTarget | null {
	const moved = new Set(movedIds);
	const moving = [...moved]
		.map((id) => elements.get(id))
		.filter((card): card is CanvasElement =>
			Boolean(
				card &&
					isKanbanCard(card) &&
					!card.locked &&
					!(card.frameId && moved.has(card.frameId)),
			),
		);
	if (moving.length !== 1) return null;
	const card = moving[0];
	const columnsFor = (list: CanvasElement) =>
		getKanbanColumns(list, getListCards(elements, list.id)).map((column) => ({
			...column,
			cards: column.cards.filter((card) => !moved.has(card.id)),
		}));
	const extensionSide = (
		list: CanvasElement,
		columns: KanbanColumn[],
	): "left" | "right" | null => {
		const overlapsCard = (column: KanbanColumn | undefined) =>
			column?.cards.some(
				(card) => point.y > card.y + 12 && point.y < card.y + card.height - 12,
			);
		const left = list.x + KANBAN_LIST_PADDING;
		const right =
			list.x + kanbanColumnsWidth(columns.length) - KANBAN_LIST_PADDING;
		if (
			point.x >= left - columnStep &&
			point.x <= left + 24 &&
			overlapsCard(columns[0])
		)
			return "left";
		if (
			point.x >= right - 24 &&
			point.x <= right + columnStep &&
			overlapsCard(columns.at(-1))
		)
			return "right";
		return null;
	};
	let list = findListAtPoint(elements, point.x, point.y);
	if (!list) {
		for (const candidate of elements.values()) {
			if (
				!isKanbanList(candidate) ||
				candidate.locked ||
				moved.has(candidate.id)
			)
				continue;
			if (
				extensionSide(candidate, columnsFor(candidate)) &&
				(!list || compareCanvasElementStackOrder(candidate, list) > 0)
			)
				list = candidate;
		}
	}
	if (!list || list.locked || moved.has(list.id)) return null;
	const columns = columnsFor(list);
	if (!columns.length) columns.push({ id: 0, cards: [] });
	const baseX = list.x + KANBAN_LIST_PADDING;
	const top = kanbanContentY(list);
	const side = extensionSide(list, columns);
	const beside = side !== null;
	const ordinal = beside
		? columns.length
		: Math.min(
				columns.length - 1,
				Math.max(
					0,
					Math.floor((point.x - baseX + KANBAN_CARD_GAP / 2) / columnStep),
				),
			);
	const column = beside
		? {
				id:
					side === "left"
						? -1
						: Math.max(...columns.map((column) => column.id)) + 1,
				cards: [],
			}
		: columns[ordinal];
	const occupied = columns.filter(
		(existing) => existing.cards.length || existing.id === column.id,
	);
	if (beside) occupied.push(column);
	occupied.sort((a, b) => a.id - b.id);
	const layoutX = list.x - (side === "left" ? columnStep : 0);
	const targetOrdinal = occupied.findIndex(
		(existing) => existing.id === column.id,
	);
	const before = column.cards.findIndex(
		(card) => point.y < card.y + card.height / 2,
	);
	const index = before < 0 ? column.cards.length : before;
	const beforeCards = column.cards.slice(0, index);
	const lineY =
		index === 0
			? top - KANBAN_CARD_GAP / 2
			: top + columnHeight(beforeCards) + KANBAN_CARD_GAP / 2;
	const targetHeight =
		columnHeight(column.cards) +
		card.height +
		(column.cards.length ? KANBAN_CARD_GAP : 0);
	return {
		listId: list.id,
		index,
		column: column.id,
		mode: beside ? "beside" : "between",
		x: layoutX + KANBAN_LIST_PADDING + targetOrdinal * columnStep,
		y: beside ? top : lineY,
		width: KANBAN_LAYOUT_CARD_WIDTH,
		cardHeight: card.height,
		listBounds: {
			x: layoutX,
			y: list.y,
			width: kanbanColumnsWidth(occupied.length),
			height: Math.max(
				KANBAN_LIST_MIN_HEIGHT,
				top -
					list.y +
					Math.max(
						targetHeight,
						...columns.map((column) => columnHeight(column.cards)),
					) +
					KANBAN_LIST_PADDING +
					KANBAN_LIST_FOOTER_HEIGHT,
			),
		},
	};
}

function buildKanbanListLayoutUpdates(
	elements: Map<string, CanvasElement>,
	listId: string,
	insertedCardId?: string,
	insertY?: number,
	placement?: KanbanDropTarget,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const list = elements.get(listId);
	if (!list || !isKanbanList(list)) return [];
	const cards = getListCards(elements, listId);
	const inserted = cards.find((card) => card.id === insertedCardId);
	let columns = getKanbanColumns(
		list,
		placement ? cards.filter((card) => card.id !== insertedCardId) : cards,
	);
	if (inserted && placement) {
		let column = columns.find((column) => column.id === placement.column);
		if (!column) {
			column = { id: placement.column, cards: [] };
			columns.push(column);
			columns.sort((a, b) => a.id - b.id);
		}
		column.cards.splice(
			Math.min(placement.index, column.cards.length),
			0,
			inserted,
		);
	} else if (inserted && insertY != null) {
		const column = columns.find((column) =>
			column.cards.some((card) => card.id === inserted.id),
		);
		if (column) {
			column.cards = column.cards.filter((card) => card.id !== inserted.id);
			const before = column.cards.findIndex(
				(card) => insertY < card.y + card.height / 2,
			);
			column.cards.splice(
				before < 0 ? column.cards.length : before,
				0,
				inserted,
			);
		}
	}
	columns = columns.filter((column) => column.cards.length > 0);
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];
	const top = kanbanContentY(list);
	const layoutX = placement?.listBounds.x ?? list.x;
	for (const [ordinal, column] of columns.entries()) {
		let y = top;
		for (const card of column.cards) {
			updates.push({
				id: card.id,
				changes: {
					x: layoutX + KANBAN_LIST_PADDING + ordinal * columnStep,
					y,
					width: KANBAN_LAYOUT_CARD_WIDTH,
					rotation: 0,
					frameId: listId,
					customData: {
						...card.customData,
						kanbanRow: undefined,
						kanbanColumn: ordinal,
					},
				},
			});
			y += card.height + KANBAN_CARD_GAP;
		}
	}
	const width = kanbanColumnsWidth(columns.length);
	const height = Math.max(
		KANBAN_LIST_MIN_HEIGHT,
		top -
			list.y +
			Math.max(0, ...columns.map((column) => columnHeight(column.cards))) +
			KANBAN_LIST_PADDING +
			KANBAN_LIST_FOOTER_HEIGHT,
	);
	return [
		{ id: listId, changes: { x: layoutX, width, height, rotation: 0 } },
		...updates,
	];
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
	insertionYByCard?: ReadonlyMap<string, number>,
	placements?: ReadonlyMap<string, KanbanDropTarget>,
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
		dropY.set(cardId, insertionYByCard?.get(cardId) ?? card.y);
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
				insertedCard ? placements?.get(insertedCard.id) : undefined,
			),
		);
	}

	for (const cardId of movedCardIds) {
		const target = targetListByCard.get(cardId);
		if (target === null) {
			updates.push({
				id: cardId,
				changes: {
					frameId: undefined,
					customData: {
						...elements.get(cardId)?.customData,
						kanbanRow: undefined,
						kanbanColumn: undefined,
					},
				},
			});
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
): KanbanCoverImage | null {
	const explicitCover = normalizeAttachmentRecord(
		customData?.coverImage,
		"cover-image",
	);
	if (explicitCover) {
		const raw = customData?.coverImage as Record<string, unknown>;
		return {
			...explicitCover,
			position: normalizeKanbanCoverPosition(raw.position),
		};
	}

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
		(input.checklist.length > 0 ? 1 : 0) +
		(input.attachments.length > 0 ? 1 : 0) +
		(input.assignmentBadges ?? 0);

	let height = 24;
	if (input.coverImage) height += KANBAN_CARD_COVER_HEIGHT + 10;
	height += Math.max(40, titleLines * 18);
	if (descriptionLines > 0) height += 6 + descriptionLines * 14;
	if (checklistPreviewCount > 0) {
		height += 10 + checklistPreviewCount * 40;
		if (checklistExtraCount > 0) height += 14;
	}
	if (footerBadges > 0) height += 12 + Math.ceil(footerBadges / 2) * 24;
	height += 18 + 48;

	return Math.max(132, height);
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
		...(typeof attachment.mimeType === "string"
			? { mimeType: attachment.mimeType }
			: {}),
		...(typeof attachment.sizeBytes === "number" &&
		Number.isFinite(attachment.sizeBytes) &&
		attachment.sizeBytes >= 0
			? { sizeBytes: attachment.sizeBytes }
			: {}),
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
