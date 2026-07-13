import {
	CANVAS_DEFAULT_FONT,
	type CanvasThemeState,
} from "@/lib/canvas/canvas-defaults";
import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import { getDefaultKanbanCardTitle } from "@/lib/canvas/kanban-options";
import {
	type CanvasElement,
	createKanbanCardElement,
	createStickyNoteElement,
} from "@skedra/canvas-core";
import { DEFAULT_FONT_SIZE } from "@skedra/canvas-core";

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
	return {
		id: "__preview",
		type: draft.type,
		x: centerX - draft.width / 2,
		y: centerY - draft.height / 2,
		width: draft.width,
		height: draft.height,
		rotation: 0,
		fill: store.fillColor,
		stroke: store.strokeColor,
		strokeWidth: store.strokeWidth,
		strokeStyle: store.strokeStyle,
		cornerRadiusPercent:
			draft.type === "rectangle" ? store.cornerRadiusPercent : undefined,
		roughness: store.roughness,
		roughFillStyle: store.roughFillStyle,
		roughFillScale: store.roughFillScale,
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
	};
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
	return {
		id: "__preview",
		type: "freehand",
		x,
		y,
		width: 0,
		height: 0,
		rotation: 0,
		fill: "transparent",
		stroke: store.strokeColor,
		strokeWidth: store.strokeWidth,
		strokeStyle: store.strokeStyle,
		roughness: store.roughness,
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		points: [[0, 0]],
	};
}

export function buildSingleArrowPreview(
	x: number,
	y: number,
	store: CanvasStoreState,
): CanvasElement {
	return {
		id: "__preview",
		type: "arrow",
		x,
		y,
		width: 0,
		height: 0,
		rotation: 0,
		fill: "transparent",
		stroke: store.strokeColor,
		strokeWidth: store.strokeWidth,
		strokeStyle: store.strokeStyle,
		roughness: store.roughness,
		arrowMode: store.arrowMode,
		arrowHeadStart: store.arrowHeadStart,
		arrowHeadEnd: store.arrowHeadEnd,
		arrowHeadScale: store.arrowHeadScale,
		arrowHeadFilled: store.arrowHeadFilled,
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		points: [[0, 0]],
	};
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
	return {
		id: "__preview",
		type: tool,
		x,
		y,
		width: 0,
		height: 0,
		rotation: 0,
		fill: tool === "frame" ? "transparent" : store.fillColor,
		stroke: tool === "frame" ? "#6366f1" : store.strokeColor,
		strokeWidth: tool === "frame" ? 1.5 : store.strokeWidth,
		strokeStyle: store.strokeStyle,
		cornerRadiusPercent:
			tool === "rectangle" ? store.cornerRadiusPercent : undefined,
		roughness: tool === "frame" ? 0 : store.roughness,
		roughFillStyle: tool === "frame" ? undefined : store.roughFillStyle,
		roughFillScale: tool === "frame" ? undefined : store.roughFillScale,
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		...(tool === "frame" ? { frameLabel: "Frame" } : {}),
	};
}
