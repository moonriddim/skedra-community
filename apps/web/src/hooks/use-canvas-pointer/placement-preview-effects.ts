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
	stateRef: React.RefObject<{ action: string }>;
	toCanvas: (screenX: number, screenY: number) => { x: number; y: number };
	setKanbanCardPlacementPreview: (centerX: number, centerY: number) => void;
	updateStickyNotePlacementFromScreen: (
		screenX: number,
		screenY: number,
	) => void;
}

export function usePlacementPreviewEffects({
	drawingPreview,
	setDrawingPreview,
	stateRef,
	toCanvas,
	setKanbanCardPlacementPreview,
	updateStickyNotePlacementFromScreen,
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
		if (stateRef.current.action !== "none") return;
		if (isShapePlacementPreview(drawingPreview)) {
			setDrawingPreview(null);
		}
	}, [shapePlacementDraft, drawingPreview, setDrawingPreview, stateRef]);

	useEffect(() => {
		if (kanbanCardPlacementDraft) return;
		if (stateRef.current.action !== "none") return;
		if (drawingPreview?.id === "__preview" && isKanbanCard(drawingPreview)) {
			setDrawingPreview(null);
		}
	}, [kanbanCardPlacementDraft, drawingPreview, setDrawingPreview, stateRef]);

	useEffect(() => {
		if (stickyNotePlacementDraft) return;
		if (stateRef.current.action !== "none") return;
		if (drawingPreview?.id === "__preview" && isStickyNote(drawingPreview)) {
			setDrawingPreview(null);
		}
	}, [stickyNotePlacementDraft, drawingPreview, setDrawingPreview, stateRef]);

	useEffect(() => {
		if (!kanbanCardPlacementDraft) return;

		const handlePointerMove = (event: PointerEvent) => {
			const canvas = toCanvas(event.clientX, event.clientY);
			const snapState = useCanvasStore.getState();
			setKanbanCardPlacementPreview(
				snapState.snapToGrid(canvas.x),
				snapState.snapToGrid(canvas.y),
			);
		};

		window.addEventListener("pointermove", handlePointerMove);
		return () => window.removeEventListener("pointermove", handlePointerMove);
	}, [setKanbanCardPlacementPreview, kanbanCardPlacementDraft, toCanvas]);

	useEffect(() => {
		if (!stickyNotePlacementDraft) return;

		const handlePointerMove = (event: PointerEvent) => {
			updateStickyNotePlacementFromScreen(event.clientX, event.clientY);
		};

		window.addEventListener("pointermove", handlePointerMove);
		return () => window.removeEventListener("pointermove", handlePointerMove);
	}, [stickyNotePlacementDraft, updateStickyNotePlacementFromScreen]);
}
