import type { CanvasThemeState } from "@/lib/canvas/canvas-defaults";
import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import { getDefaultKanbanCardTitle } from "@/lib/canvas/kanban-options";
import {
	type CanvasElement,
	createKanbanCardElement,
	createStickyNoteElement,
} from "@skedra/canvas-core";
import { buildCanvasEditorDrawingElement } from "@skedra/canvas-editor";

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
	const element = buildCanvasEditorDrawingElement({
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
	/* Frame-Presets tragen ihren Namen (z. B. "iPhone 15 Pro") als Label. */
	if (draft.type === "frame" && draft.label) {
		return { ...element, frameLabel: draft.label };
	}
	return element;
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
		pyramidSections: store.pyramidSections,
		arrowMode: store.arrowMode,
		arrowHeadStart: store.arrowHeadStart,
		arrowHeadEnd: store.arrowHeadEnd,
		arrowHeadScale: store.arrowHeadScale,
		arrowHeadFilled: store.arrowHeadFilled,
	};
}
