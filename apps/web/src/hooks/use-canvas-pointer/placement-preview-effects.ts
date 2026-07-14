/**
 * Vorschau-Effekte fuer Kanban-Karten, Haftnotizen und Form-Platzierung.
 */

import { isStickyNote } from "@/lib/canvas/sticky-note-utils";
import { isKanbanCard } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { useEffect } from "react";
import { useCanvasStore } from "../use-canvas-store";
import { isShapePlacementPreview } from "./snap-placement";

interface UsePlacementPreviewEffectsOptions {
	drawingPreview: CanvasElement | null;
	setDrawingPreview: React.Dispatch<React.SetStateAction<CanvasElement | null>>;
}

export function usePlacementPreviewEffects({
	drawingPreview,
	setDrawingPreview,
}: UsePlacementPreviewEffectsOptions) {
	const shapePlacementDraft = useCanvasStore(
		(state) => state.shapePlacementDraft,
	);
	const kanbanCardPlacementDraft = useCanvasStore(
		(state) => state.kanbanCardPlacementDraft,
	);
	const stickyNotePlacementDraft = useCanvasStore(
		(state) => state.stickyNotePlacementDraft,
	);

	useEffect(() => {
		if (shapePlacementDraft) return;
		if (isShapePlacementPreview(drawingPreview)) {
			setDrawingPreview(null);
		}
	}, [shapePlacementDraft, drawingPreview, setDrawingPreview]);

	useEffect(() => {
		if (kanbanCardPlacementDraft) return;
		if (drawingPreview?.id === "__preview" && isKanbanCard(drawingPreview)) {
			setDrawingPreview(null);
		}
	}, [kanbanCardPlacementDraft, drawingPreview, setDrawingPreview]);

	useEffect(() => {
		if (stickyNotePlacementDraft) return;
		if (drawingPreview?.id === "__preview" && isStickyNote(drawingPreview)) {
			setDrawingPreview(null);
		}
	}, [stickyNotePlacementDraft, drawingPreview, setDrawingPreview]);
}
