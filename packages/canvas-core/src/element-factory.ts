import {
	KANBAN_CARD_GAP,
	KANBAN_LIST_FOOTER_HEIGHT,
	KANBAN_LIST_HEADER,
	KANBAN_LIST_PADDING,
	type KanbanPriority,
	computeKanbanCardHeight,
} from "./kanban";
import { type CanvasElement, DEFAULT_FILL, DEFAULT_FONT_FAMILY } from "./types";

export const STICKY_NOTE_TEXT_PADDING = 12;
export const KANBAN_LIST_WIDTH = 280;
export const KANBAN_CARD_WIDTH = KANBAN_LIST_WIDTH - KANBAN_LIST_PADDING * 2;

export interface CanvasElementFactoryDefaults {
	createId: () => string;
	stroke: string;
	fontFamily?: string;
	kanbanFontFamily?: string;
}

export function createBaseCanvasElement(
	defaults: CanvasElementFactoryDefaults,
	overrides: Partial<CanvasElement> & { type: CanvasElement["type"] },
): CanvasElement {
	return {
		id: defaults.createId(),
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		rotation: 0,
		fill: "transparent",
		stroke: defaults.stroke,
		strokeWidth: 2,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		...overrides,
	};
}

export function createStickyNoteElement(
	defaults: CanvasElementFactoryDefaults,
	options: {
		x: number;
		y: number;
		color: string;
		text?: string;
		width?: number;
		height?: number;
		fontSize?: number;
		fontFamily?: string;
		textAlign?: "left" | "center" | "right";
		stroke?: string;
		frameId?: string;
		stackIndex?: string;
		customData?: Record<string, unknown>;
	},
): CanvasElement {
	return createBaseCanvasElement(defaults, {
		type: "rectangle",
		x: options.x,
		y: options.y,
		width: options.width ?? 200,
		height: options.height ?? 200,
		fill: options.color,
		stroke: options.stroke ?? "#CED4DA",
		strokeWidth: 1,
		cornerRadius: 8,
		text: options.text ?? "",
		fontSize: options.fontSize ?? 20,
		fontFamily:
			options.fontFamily ?? defaults.fontFamily ?? DEFAULT_FONT_FAMILY,
		textAlign: options.textAlign ?? "left",
		frameId: options.frameId,
		stackIndex: options.stackIndex,
		customData: {
			skedraType: "sticky-note",
			stickyNoteMode: "note",
			stickyChecklist: [],
			...(options.customData ?? {}),
		},
	});
}

export function fitImageSize(
	width: number,
	height: number,
	maxWidth = 480,
	maxHeight = 360,
) {
	if (width <= 0 || height <= 0) return { width: maxWidth, height: maxHeight };
	const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
	return {
		width: Math.round(width * ratio),
		height: Math.round(height * ratio),
	};
}

export type CanvasElementBoundsInput = Pick<
	CanvasElement,
	"type" | "x" | "y" | "width" | "height"
> &
	Partial<
		Pick<
			CanvasElement,
			| "id"
			| "rotation"
			| "fill"
			| "stroke"
			| "strokeWidth"
			| "strokeStyle"
			| "opacity"
			| "locked"
			| "groupId"
			| "flipX"
			| "flipY"
			| "link"
			| "text"
			| "fontSize"
			| "fontFamily"
			| "fontWeight"
			| "fontStyle"
			| "textDecoration"
			| "textAlign"
			| "textColor"
			| "frameId"
			| "frameLabel"
			| "cornerRadius"
			| "cornerRadiusPercent"
			| "cloudArcRadius"
			| "pyramidSections"
			| "closed"
			| "arrowMode"
			| "arrowHeadStart"
			| "arrowHeadEnd"
			| "arrowHeadScale"
			| "arrowHeadFilled"
			| "roughness"
			| "roughFillStyle"
			| "roughFillScale"
			| "stackIndex"
			| "customData"
			| "points"
		>
	>;

/**
 * Converts the bounds-oriented public API contract into a complete element.
 * Hosts only provide their approved IDs and theme-dependent stroke default.
 */
export function createCanvasElementFromBoundsInput(
	defaults: CanvasElementFactoryDefaults,
	input: CanvasElementBoundsInput,
	options: { createPathPointsFromBounds?: boolean } = {},
): CanvasElement {
	const isPath = input.type === "line" || input.type === "arrow";
	const points =
		input.points ??
		(isPath && options.createPathPointsFromBounds
			? ([
					[0, 0],
					[input.width, input.height],
				] as [number, number][])
			: undefined);
	return createBaseCanvasElement(
		{
			...defaults,
			createId: () => input.id ?? defaults.createId(),
		},
		{
			type: input.type,
			x: input.x,
			y: input.y,
			width: input.width,
			height: input.height,
			rotation: input.rotation ?? 0,
			fill: input.fill ?? DEFAULT_FILL,
			stroke: input.stroke ?? defaults.stroke,
			strokeWidth: input.strokeWidth ?? 2,
			strokeStyle: input.strokeStyle ?? "solid",
			opacity: input.opacity ?? 100,
			locked: input.locked ?? false,
			groupId: input.groupId ?? null,
			flipX: input.flipX ?? false,
			flipY: input.flipY ?? false,
			...(input.link !== undefined ? { link: input.link } : {}),
			...(input.text !== undefined ? { text: input.text } : {}),
			...(input.fontSize !== undefined ? { fontSize: input.fontSize } : {}),
			...(input.fontFamily !== undefined
				? { fontFamily: input.fontFamily }
				: {}),
			...(input.fontWeight !== undefined
				? { fontWeight: input.fontWeight }
				: {}),
			...(input.fontStyle !== undefined ? { fontStyle: input.fontStyle } : {}),
			...(input.textDecoration !== undefined
				? { textDecoration: input.textDecoration }
				: {}),
			...(input.textAlign !== undefined ? { textAlign: input.textAlign } : {}),
			...(input.textColor !== undefined ? { textColor: input.textColor } : {}),
			...(input.frameId !== undefined ? { frameId: input.frameId } : {}),
			...(input.frameLabel !== undefined
				? { frameLabel: input.frameLabel }
				: {}),
			...(input.cornerRadius !== undefined
				? { cornerRadius: input.cornerRadius }
				: {}),
			...(input.cornerRadiusPercent !== undefined
				? { cornerRadiusPercent: input.cornerRadiusPercent }
				: {}),
			...(input.cloudArcRadius !== undefined
				? { cloudArcRadius: input.cloudArcRadius }
				: {}),
			...(input.pyramidSections !== undefined
				? { pyramidSections: input.pyramidSections }
				: {}),
			...(input.closed !== undefined ? { closed: input.closed } : {}),
			...(input.arrowMode !== undefined ? { arrowMode: input.arrowMode } : {}),
			...(input.arrowHeadStart !== undefined
				? { arrowHeadStart: input.arrowHeadStart }
				: {}),
			...(input.arrowHeadEnd !== undefined
				? { arrowHeadEnd: input.arrowHeadEnd }
				: {}),
			...(input.arrowHeadScale !== undefined
				? { arrowHeadScale: input.arrowHeadScale }
				: {}),
			...(input.arrowHeadFilled !== undefined
				? { arrowHeadFilled: input.arrowHeadFilled }
				: {}),
			...(input.roughness !== undefined ? { roughness: input.roughness } : {}),
			...(input.roughFillStyle !== undefined
				? { roughFillStyle: input.roughFillStyle }
				: {}),
			...(input.roughFillScale !== undefined
				? { roughFillScale: input.roughFillScale }
				: {}),
			...(input.stackIndex !== undefined
				? { stackIndex: input.stackIndex }
				: {}),
			...(input.customData !== undefined
				? { customData: input.customData }
				: {}),
			...(points ? { points } : {}),
		},
	);
}

export function createImageCanvasElement(
	defaults: CanvasElementFactoryDefaults,
	options: {
		x: number;
		y: number;
		src: string;
		width: number;
		height: number;
		alt: string;
	},
): CanvasElement {
	const fitted = fitImageSize(options.width, options.height);
	return createBaseCanvasElement(defaults, {
		type: "image",
		x: options.x,
		y: options.y,
		width: fitted.width,
		height: fitted.height,
		fill: "transparent",
		stroke: "#00000020",
		strokeWidth: 1,
		customData: {
			imageSrc: options.src,
			imageAlt: options.alt,
			naturalWidth: options.width,
			naturalHeight: options.height,
			imageCrop: { x: 0, y: 0, width: 1, height: 1 },
		},
	});
}

export function createKanbanCardElement(
	defaults: CanvasElementFactoryDefaults,
	options: {
		x: number;
		y: number;
		title: string;
		priority?: KanbanPriority | null;
		listId?: string;
		stackIndex?: string;
	},
): CanvasElement {
	return createBaseCanvasElement(defaults, {
		type: "rectangle",
		x: options.x,
		y: options.y,
		width: KANBAN_CARD_WIDTH,
		height: getInitialKanbanCardHeight(options.title),
		fill: "transparent",
		stroke: "transparent",
		strokeWidth: 1,
		cornerRadius: 8,
		text: options.title,
		fontSize: 14,
		fontFamily:
			defaults.kanbanFontFamily ??
			defaults.fontFamily ??
			"system-ui, sans-serif",
		textAlign: "left",
		frameId: options.listId,
		stackIndex: options.stackIndex,
		customData: {
			skedraType: "kanban-card",
			priority: options.priority ?? null,
			description: "",
			startDate: null,
			dueDate: null,
			dueComplete: false,
			coverImage: null,
			checklist: [],
			attachments: [],
		},
	});
}

export function createKanbanListElements(
	defaults: CanvasElementFactoryDefaults,
	options: {
		x: number;
		y: number;
		name: string;
		cardTitles: string[];
	},
): CanvasElement[] {
	const listId = defaults.createId();
	const cardHeights = options.cardTitles.map(getInitialKanbanCardHeight);
	const listHeight =
		KANBAN_LIST_HEADER +
		cardHeights.reduce((sum, height) => sum + height, 0) +
		Math.max(0, options.cardTitles.length - 1) * KANBAN_CARD_GAP +
		KANBAN_LIST_PADDING +
		KANBAN_LIST_FOOTER_HEIGHT;

	const list = createBaseCanvasElement(defaults, {
		id: listId,
		type: "frame",
		x: options.x,
		y: options.y,
		width: KANBAN_LIST_WIDTH,
		height: listHeight,
		fill: "transparent",
		stroke: "transparent",
		frameLabel: options.name,
		customData: { skedraType: "kanban-list" },
	});

	let nextCardY = options.y + KANBAN_LIST_HEADER;
	const cardElements = options.cardTitles.map((title) => {
		const card = createKanbanCardElement(defaults, {
			x: options.x + KANBAN_LIST_PADDING,
			y: nextCardY,
			title,
			listId,
		});
		nextCardY += card.height + KANBAN_CARD_GAP;
		return card;
	});

	return [list, ...cardElements];
}

export function createKanbanBoardElements(
	defaults: CanvasElementFactoryDefaults,
	options: {
		x: number;
		y: number;
		lists: Array<{ name: string; cards: string[] }>;
		defaultCardTitle: string;
	},
): CanvasElement[] {
	const gap = 24;
	return options.lists.flatMap((list, index) =>
		createKanbanListElements(defaults, {
			x: options.x + index * (KANBAN_LIST_WIDTH + gap),
			y: options.y,
			name: list.name,
			cardTitles:
				list.cards.length > 0 ? list.cards : [options.defaultCardTitle],
		}),
	);
}

function getInitialKanbanCardHeight(title: string): number {
	return computeKanbanCardHeight({
		title,
		description: "",
		checklist: [],
		coverImage: null,
		attachments: [],
		startDate: null,
		dueDate: null,
	});
}
