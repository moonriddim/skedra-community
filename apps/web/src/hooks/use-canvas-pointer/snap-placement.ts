/**
 * Snap-Hilfen fuer zentrierte Platzierung und Pfad-Anker.
 */

import { isStickyNote } from "@/lib/canvas/sticky-note-utils";
import { isKanbanCard } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import {
	resolveCanvasEditorPointSnap,
	resolveCanvasEditorRectSnap,
} from "@skedra/canvas-editor";
import { useCallback } from "react";
import { useCanvasStore, useCanvasStoreRef } from "../use-canvas-store";
import {
	STICKY_NOTE_PLACEMENT_SIZE,
	buildStickyNotePlacementPreview,
} from "./preview-builders";

interface UsePointerSnapPlacementOptions {
	elements: Map<string, CanvasElement>;
	toCanvas: (screenX: number, screenY: number) => { x: number; y: number };
	setDrawingPreview: React.Dispatch<React.SetStateAction<CanvasElement | null>>;
}

export function usePointerSnapPlacement({
	elements,
	toCanvas,
	setDrawingPreview,
}: UsePointerSnapPlacementOptions) {
	const storeRef = useCanvasStoreRef();

	const clearSnapVisuals = useCallback(() => {
		const snapState = useCanvasStore.getState();
		if (snapState.snapGuides.length > 0) {
			snapState.setSnapGuides([]);
		}
		if (snapState.snapPointIndicators.length > 0) {
			snapState.setSnapPointIndicators([]);
		}
	}, []);

	const resolveCenteredPlacementSnap = useCallback(
		(screenX: number, screenY: number, width: number, height: number) => {
			const canvas = toCanvas(screenX, screenY);
			const snapState = useCanvasStore.getState();
			let centerX = snapState.snapToGrid(canvas.x);
			let centerY = snapState.snapToGrid(canvas.y);
			let x = centerX - width / 2;
			let y = centerY - height / 2;

			if (snapState.snapToObjects) {
				const snap = resolveCanvasEditorRectSnap({
					rect: { x, y, width, height },
					elements,
					excludeIds: new Set(["__preview"]),
					snap: {
						enabled: true,
						includeCenters: snapState.snapToCenters,
						includeMidpoints: snapState.snapToMidpoints,
						showInactivePoints: snapState.showSnapPoints,
					},
				});
				x = snap.rect.x;
				y = snap.rect.y;
				centerX = x + width / 2;
				centerY = y + height / 2;
				snapState.setSnapGuides(snap.guides);
				snapState.setSnapPointIndicators(snap.indicators);
			} else {
				clearSnapVisuals();
			}

			return { centerX, centerY };
		},
		[clearSnapVisuals, elements, toCanvas],
	);

	const resolvePathPlacement = useCallback(
		(
			screenX: number,
			screenY: number,
			options?: {
				forceAnchor?: boolean;
			},
		) => {
			const store = storeRef.current;
			const canvas = toCanvas(screenX, screenY);
			const gridX = store.snapToGrid(canvas.x);
			const gridY = store.snapToGrid(canvas.y);
			const anchorSnapTool =
				store.activeTool === "line" ||
				store.activeTool === "arrow" ||
				store.activeTool === "rectangle" ||
				store.activeTool === "ellipse" ||
				store.activeTool === "diamond";

			if (!anchorSnapTool) {
				clearSnapVisuals();
				return { canvas, x: gridX, y: gridY, anchor: null };
			}

			if (!store.snapToObjects) {
				clearSnapVisuals();
				return { canvas, x: gridX, y: gridY, anchor: null };
			}

			const snap = resolveCanvasEditorPointSnap({
				point: { x: gridX, y: gridY },
				elements,
				excludeIds: new Set(["__preview"]),
				snap: {
					enabled: true,
					includeCenters: store.snapToCenters,
					includeMidpoints: store.snapToMidpoints,
					showInactivePoints: store.showSnapPoints,
				},
				forceAnchor: options?.forceAnchor,
			});
			store.setSnapPointIndicators(snap.indicators);
			store.setSnapGuides(snap.guides);
			return {
				canvas,
				x: snap.point.x,
				y: snap.point.y,
				anchor: snap.anchor,
			};
		},
		[toCanvas, storeRef, elements, clearSnapVisuals],
	);

	const updateStickyNotePlacementFromScreen = useCallback(
		(screenX: number, screenY: number) => {
			const draft = useCanvasStore.getState().stickyNotePlacementDraft;
			if (!draft) return;

			const { centerX, centerY } = resolveCenteredPlacementSnap(
				screenX,
				screenY,
				STICKY_NOTE_PLACEMENT_SIZE,
				STICKY_NOTE_PLACEMENT_SIZE,
			);
			setDrawingPreview(
				buildStickyNotePlacementPreview(draft, centerX, centerY),
			);
		},
		[resolveCenteredPlacementSnap, setDrawingPreview],
	);

	return {
		clearSnapVisuals,
		resolveCenteredPlacementSnap,
		resolvePathPlacement,
		updateStickyNotePlacementFromScreen,
	};
}

export function isShapePlacementPreview(
	preview: CanvasElement | null,
): boolean {
	return (
		!!preview &&
		preview.id === "__preview" &&
		!isKanbanCard(preview) &&
		!isStickyNote(preview) &&
		(preview.type === "rectangle" ||
			preview.type === "ellipse" ||
			preview.type === "diamond")
	);
}
