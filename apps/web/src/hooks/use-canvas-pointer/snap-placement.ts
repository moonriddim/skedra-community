/**
 * Snap-Hilfen fuer zentrierte Platzierung und Pfad-Anker.
 */

import { isStickyNote } from "@/lib/canvas/sticky-note-utils";
import { isKanbanCard } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import {
	canvasEditorToolSupportsSnapOverride,
	getCanvasEditorSnapModeOptions,
	resolveCanvasEditorPlacementPoint,
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
						includeEndpoints: snapState.snapToEndpoints,
						includeCenters: snapState.snapToCenters,
						includeMidpoints: snapState.snapToMidpoints,
						includeDivisions: snapState.snapToDivisions,
						divisionCount: snapState.snapDivisionCount,
						includeNearest: snapState.snapToNearest,
						includeGeometricCenters: snapState.snapToGeometricCenters,
						includeQuadrants: snapState.snapToQuadrants,
						includeIntersections: snapState.snapToIntersections,
						includeExtensions: snapState.snapToExtensions,
						includeInsertions: snapState.snapToInsertions,
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
				objectSnap?: boolean;
				excludeIds?: Set<string>;
			},
		) => {
			const store = storeRef.current;
			const canvas = toCanvas(screenX, screenY);
			const overrideOptions = getCanvasEditorSnapModeOptions(
				store.snapOverrideMode,
			);
			const gridX = store.snapToGrid(canvas.x);
			const gridY = store.snapToGrid(canvas.y);
			const anchorSnapTool =
				canvasEditorToolSupportsSnapOverride(store.activeTool) ||
				((options?.forceAnchor || options?.objectSnap) &&
					store.activeTool === "select");

			if (!anchorSnapTool) {
				clearSnapVisuals();
				return { canvas, x: gridX, y: gridY, anchor: null };
			}

			if (!store.snapToObjects && !options?.forceAnchor && !overrideOptions) {
				clearSnapVisuals();
				return { canvas, x: gridX, y: gridY, anchor: null };
			}

			const snap = resolveCanvasEditorPointSnap({
				// Object snaps always resolve from the real cursor position. Grid snapping
				// is only the fallback when no configured object anchor is in range.
				point: canvas,
				elements,
				excludeIds: new Set(["__preview", ...(options?.excludeIds ?? [])]),
				snap: {
					enabled: true,
					includeEndpoints:
						overrideOptions?.includeEndpoints ?? store.snapToEndpoints,
					includeCenters:
						overrideOptions?.includeCenters ?? store.snapToCenters,
					includeMidpoints:
						overrideOptions?.includeMidpoints ?? store.snapToMidpoints,
					includeDivisions:
						overrideOptions?.includeDivisions ?? store.snapToDivisions,
					divisionCount: store.snapDivisionCount,
					includeNearest:
						overrideOptions?.includeNearest ?? store.snapToNearest,
					includeGeometricCenters:
						overrideOptions?.includeGeometricCenters ??
						store.snapToGeometricCenters,
					includeQuadrants:
						overrideOptions?.includeQuadrants ?? store.snapToQuadrants,
					includeIntersections:
						overrideOptions?.includeIntersections ?? store.snapToIntersections,
					includeExtensions:
						overrideOptions?.includeExtensions ?? store.snapToExtensions,
					includeInsertions:
						overrideOptions?.includeInsertions ?? store.snapToInsertions,
					showInactivePoints: store.showSnapPoints,
					threshold: 12 / Math.max(store.viewport.zoom, 0.01),
				},
				forceAnchor: options?.forceAnchor,
			});
			store.setSnapPointIndicators(snap.indicators);
			store.setSnapGuides(snap.anchor ? snap.guides : []);
			const resolvedPoint = resolveCanvasEditorPlacementPoint(snap, {
				x: gridX,
				y: gridY,
			});
			return {
				canvas,
				x: resolvedPoint.x,
				y: resolvedPoint.y,
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
			preview.type === "diamond" ||
			preview.type === "triangle" ||
			preview.type === "cloud")
	);
}
