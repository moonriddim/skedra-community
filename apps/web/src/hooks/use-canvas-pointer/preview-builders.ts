import {
	CANVAS_DEFAULT_FONT,
	type CanvasThemeState,
} from "@/lib/canvas/canvas-defaults";
import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import { getDefaultKanbanCardTitle } from "@/lib/canvas/kanban-options";
import {
	type CanvasElement,
	buildCanvasDrawingElement,
	createKanbanCardElement,
	createStickyNoteElement,
} from "@skedra/canvas-core";
import { DEFAULT_FONT_SIZE } from "@skedra/canvas-core";
import { buildCanvasSinglePathElement } from "@skedra/canvas-editor";

import type { useCanvasStore } from "../use-canvas-store";

type CanvasStoreState = ReturnType<typeof useCanvasStore.getState>;
type ShapePlacementDraft = NonNullable<CanvasStoreState["shapePlacementDraft"]>;
type KanbanCardPlacementDraft = NonNullable<
	CanvasStoreState["kanbanCardPlacementDraft"]
>;
type StickyNotePlacementDraft = NonNullable<
	CanvasStoreState["stickyNotePlacementDraft"]
>;

const STICKY_NOTE_SIZE = 200;

export const STICKY_NOTE_PLACEMENT_SIZE = STICKY_NOTE_SIZE;

export function buildStickyNotePlacementElement(
	id: string,
	draft: StickyNotePlacementDraft,
	centerX: number,
	centerY: number,
	theme?: CanvasThemeState,
): CanvasElement {
	const note = createStickyNoteElement(getCanvasElementFactoryDefaults(theme), {
		x: centerX - STICKY_NOTE_SIZE / 2,
		y: centerY - STICKY_NOTE_SIZE / 2,
		color: draft.color,
	});
	return { ...note, id };
}

export function buildStickyNotePlacementPreview(
	draft: StickyNotePlacementDraft,
	centerX: number,
	centerY: number,
	theme?: CanvasThemeState,
): CanvasElement {
	return {
		...buildStickyNotePlacementElement(
			"__preview",
			draft,
			centerX,
			centerY,
			theme,
		),
		opacity: 70,
	};
}

export function buildKanbanCardPlacementElement(
	id: string,
	draft: KanbanCardPlacementDraft,
	centerX: number,
	centerY: number,
	listId?: string,
	theme?: CanvasThemeState,
): CanvasElement {
	const card = createKanbanCardElement(getCanvasElementFactoryDefaults(theme), {
		x: 0,
		y: 0,
		title: getDefaultKanbanCardTitle(),
		priority: draft.priority,
		listId,
	});
	return {
		...card,
		id,
		x: centerX - card.width / 2,
		y: centerY - card.height / 2,
	};
}

export function buildKanbanCardPlacementPreview(
	draft: KanbanCardPlacementDraft,
	centerX: number,
	centerY: number,
	theme?: CanvasThemeState,
): CanvasElement {
	return {
		...buildKanbanCardPlacementElement(
			"__preview",
			draft,
			centerX,
			centerY,
			undefined,
			theme,
		),
		opacity: 70,
	};
}

export function buildShapePlacementPreview(
	draft: ShapePlacementDraft,
	centerX: number,
	centerY: number,
	store: CanvasStoreState,
): CanvasElement {
	return buildCanvasDrawingElement({
		id: "__preview",
		tool: draft.type,
		start: {
			x: centerX - draft.width / 2,
			y: centerY - draft.height / 2,
		},
		end: {
			x: centerX + draft.width / 2,
			y: centerY + draft.height / 2,
		},
		style: getDrawingStyle(store),
	});
}

export function buildPlacedShapeElement(
	id: string,
	draft: ShapePlacementDraft,
	centerX: number,
	centerY: number,
	store: CanvasStoreState,
): CanvasElement {
	return {
		...buildShapePlacementPreview(draft, centerX, centerY, store),
		id,
	};
}

export function buildFreehandPreview(
	x: number,
	y: number,
	store: CanvasStoreState,
): CanvasElement {
	return buildCanvasDrawingElement({
		id: "__preview",
		tool: "freehand",
		start: { x, y },
		points: [{ x, y }],
		style: getDrawingStyle(store),
	});
}

export function buildSingleArrowPreview(
	x: number,
	y: number,
	store: CanvasStoreState,
): CanvasElement {
	return buildCanvasSinglePathElement({
		id: "__preview",
		tool: "arrow",
		start: { x, y },
		end: { x, y },
		style: getDrawingStyle(store),
	});
}

export function buildSinglePathPreview(
	tool: "line" | "arrow",
	startX: number,
	startY: number,
	endX: number,
	endY: number,
	store: CanvasStoreState,
): CanvasElement {
	return buildCanvasSinglePathElement({
		id: "__preview",
		tool,
		start: { x: startX, y: startY },
		end: { x: endX, y: endY },
		style: getDrawingStyle(store),
	});
}

export function buildTextBoxPreview(
	x: number,
	y: number,
	store: CanvasStoreState,
): CanvasElement {
	return {
		id: "__preview",
		type: "text",
		x,
		y,
		width: 0,
		height: 0,
		rotation: 0,
		fill: "transparent",
		stroke: store.strokeColor,
		strokeWidth: 1,
		strokeStyle: "dashed",
		opacity: 60,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		text: "",
		fontSize: DEFAULT_FONT_SIZE,
		fontFamily: CANVAS_DEFAULT_FONT,
		textAlign: "left",
	};
}

export function buildDrawingPreview(
	tool: CanvasElement["type"],
	x: number,
	y: number,
	store: CanvasStoreState,
): CanvasElement {
	if (tool === "line" || tool === "arrow") {
		return buildSinglePathPreview(tool, x, y, x, y, store);
	}
	return buildCanvasDrawingElement({
		id: "__preview",
		tool: tool as Exclude<CanvasElement["type"], "image" | "text">,
		start: { x, y },
		end: { x, y },
		style: {
			...getDrawingStyle(store),
			stroke: tool === "frame" ? "#6366f1" : store.strokeColor,
		},
	});
}

function getDrawingStyle(store: CanvasStoreState) {
	return {
		stroke: store.strokeColor,
		fill: store.fillColor,
		strokeWidth: store.strokeWidth,
		strokeStyle: store.strokeStyle,
		cornerRadiusPercent: store.cornerRadiusPercent,
		roughness: store.roughness,
		roughFillStyle: store.roughFillStyle,
		roughFillScale: store.roughFillScale,
		arrowMode: store.arrowMode,
		arrowHeadStart: store.arrowHeadStart,
		arrowHeadEnd: store.arrowHeadEnd,
		arrowHeadScale: store.arrowHeadScale,
		arrowHeadFilled: store.arrowHeadFilled,
	};
}
