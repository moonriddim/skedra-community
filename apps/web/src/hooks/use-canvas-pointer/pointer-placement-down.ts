/**
 * Ein-Klick-Platzierung: Haftnotiz, Kanban-Karte, Form-Vorlage.
 */

import type { CanvasThemeState } from "@/lib/canvas/canvas-defaults";
import { buildKanbanReflowUpdates } from "@skedra/canvas-core";
import type { CanvasElement, CanvasScene } from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import type { useCanvasStore } from "../use-canvas-store";
import {
	STICKY_NOTE_PLACEMENT_SIZE,
	buildKanbanCardPlacementElement,
	buildPlacedShapeElement,
	buildStickyNotePlacementElement,
} from "./preview-builders";

type CanvasStoreState = ReturnType<typeof useCanvasStore.getState>;

interface PlacementDownContext {
	elements: Map<string, CanvasElement>;
	scene: CanvasScene;
	snappedX: number;
	snappedY: number;
	clientX: number;
	clientY: number;
	store: CanvasStoreState;
	createElement: (el: CanvasElement) => void;
	updateElements: (
		updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
	) => void;
	resolveCenteredPlacementSnap: (
		screenX: number,
		screenY: number,
		width: number,
		height: number,
	) => { centerX: number; centerY: number };
	setDrawingPreview: React.Dispatch<React.SetStateAction<CanvasElement | null>>;
	clearSnapVisuals: () => void;
	theme: CanvasThemeState;
}

/** @returns true wenn die Platzierung abgeschlossen wurde */
export function handlePlacementPointerDown(ctx: PlacementDownContext): boolean {
	const {
		elements,
		scene,
		snappedX,
		snappedY,
		clientX,
		clientY,
		store,
		createElement,
		updateElements,
		resolveCenteredPlacementSnap,
		setDrawingPreview,
		clearSnapVisuals,
		theme,
	} = ctx;

	if (store.stickyNotePlacementDraft) {
		const draft = store.stickyNotePlacementDraft;
		const { centerX, centerY } = resolveCenteredPlacementSnap(
			clientX,
			clientY,
			STICKY_NOTE_PLACEMENT_SIZE,
			STICKY_NOTE_PLACEMENT_SIZE,
		);
		const id = nanoid();
		const note = buildStickyNotePlacementElement(
			id,
			draft,
			centerX,
			centerY,
			theme,
		);
		createElement(note);
		store.setEditingTextId(id);
		store.clearSelection();
		store.clearStickyNotePlacementDraft();
		store.setActivePanel(null);
		setDrawingPreview(null);
		clearSnapVisuals();
		return true;
	}

	if (store.kanbanCardPlacementDraft) {
		const draft = store.kanbanCardPlacementDraft;
		const targetList = scene.getKanbanListAtPosition(snappedX, snappedY);
		const id = nanoid();
		const card = buildKanbanCardPlacementElement(
			id,
			draft,
			snappedX,
			snappedY,
			targetList?.id,
			theme,
		);
		createElement(card);

		if (targetList) {
			const moved = new Set<string>([id]);
			const target = new Map<string, string | null>([[id, targetList.id]]);
			const nextElements = new Map(elements);
			nextElements.set(id, card);
			const updates = buildKanbanReflowUpdates(nextElements, moved, target);
			if (updates.length > 0) updateElements(updates);
		}

		store.clearSelection();
		store.clearKanbanCardPlacementDraft();
		setDrawingPreview(null);
		clearSnapVisuals();
		return true;
	}

	if (store.shapePlacementDraft) {
		const draft = store.shapePlacementDraft;
		const id = nanoid();
		createElement(
			buildPlacedShapeElement(id, draft, snappedX, snappedY, store),
		);
		store.clearSelection();
		store.clearShapePlacementDraft();
		setDrawingPreview(null);
		clearSnapVisuals();
		if (!store.toolLocked) {
			store.setActiveTool("select");
		}
		return true;
	}

	return false;
}
