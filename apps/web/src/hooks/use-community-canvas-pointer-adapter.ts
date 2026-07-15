/** Community document/state adapter for the shared canvas-editor pointer pipeline. */

import { useThemeStore } from "@/stores/theme";
import type { CanvasElement, CanvasScene } from "@skedra/canvas-core";
import {
	type CanvasEditorTextPlacement,
	useCanvasEditorPointer,
} from "@skedra/canvas-editor";
import { nanoid } from "nanoid";
import { useCallback, useState } from "react";
import { usePlacementPreviewEffects } from "./use-canvas-pointer/placement-preview-effects";
import { handlePlacementPointerDown } from "./use-canvas-pointer/pointer-placement-down";
import {
	buildKanbanCardPlacementPreview,
	buildShapePlacementPreview,
} from "./use-canvas-pointer/preview-builders";
import { usePointerSnapPlacement } from "./use-canvas-pointer/snap-placement";
import { useCanvasStore, useCanvasStoreRef } from "./use-canvas-store";

interface UseCommunityCanvasPointerAdapterOptions {
	svgRef: React.RefObject<SVGSVGElement | null>;
	readOnly?: boolean;
	elements: Map<string, CanvasElement>;
	scene: CanvasScene;
	createElement: (el: CanvasElement) => void;
	updateElement: (id: string, updates: Partial<CanvasElement>) => void;
	updateElements: (
		updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
	) => void;
	duplicateSelection?: () => void;
	deleteElements?: (ids: string[]) => void;
	stopUndoCapture?: () => void;
	cancelUndoCapture?: () => void;
	startTextPlacement: (placement: CanvasEditorTextPlacement) => void;
}

export function useCommunityCanvasPointerAdapter({
	svgRef,
	readOnly = false,
	elements,
	scene,
	createElement,
	updateElement,
	updateElements,
	duplicateSelection,
	deleteElements,
	stopUndoCapture,
	cancelUndoCapture,
	startTextPlacement,
}: UseCommunityCanvasPointerAdapterOptions) {
	const storeRef = useCanvasStoreRef();
	const activeTool = useCanvasStore((state) => state.activeTool);
	const pathDrawMode = useCanvasStore((state) => state.pathDrawMode);
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
	const [placementPreview, setPlacementPreview] =
		useState<CanvasElement | null>(null);

	const toCanvas = useCallback(
		(screenX: number, screenY: number) => {
			const rect = svgRef.current?.getBoundingClientRect();
			if (!rect) return { x: screenX, y: screenY };
			const { viewport } = storeRef.current;
			return {
				x: (screenX - rect.left - viewport.x) / viewport.zoom,
				y: (screenY - rect.top - viewport.y) / viewport.zoom,
			};
		},
		[storeRef, svgRef],
	);

	const {
		clearSnapVisuals,
		resolveCenteredPlacementSnap,
		resolvePathPlacement,
		updateStickyNotePlacementFromScreen,
	} = usePointerSnapPlacement({
		elements,
		toCanvas,
		setDrawingPreview: setPlacementPreview,
	});

	const setKanbanCardPlacementPreview = useCallback(
		(centerX: number, centerY: number) => {
			const draft = useCanvasStore.getState().kanbanCardPlacementDraft;
			if (!draft) return;
			setPlacementPreview(
				buildKanbanCardPlacementPreview(draft, centerX, centerY, {
					resolvedTheme,
				}),
			);
		},
		[resolvedTheme],
	);

	usePlacementPreviewEffects({
		drawingPreview: placementPreview,
		setDrawingPreview: setPlacementPreview,
	});

	const resolvePoint = useCallback(
		(clientX: number, clientY: number, options?: { forceAnchor?: boolean }) => {
			const placement = resolvePathPlacement(clientX, clientY, options);
			return {
				raw: placement.canvas,
				snapped: { x: placement.x, y: placement.y },
				allowMiddleButtonDraw: placement.anchor != null,
			};
		},
		[resolvePathPlacement],
	);

	const documentAdapter = {
		kind: "community",
		getElements: () => elements,
		getScene: () => scene,
		createId: nanoid,
		createElement,
		updateElement,
		updateElements,
		deleteElements,
		duplicateSelection,
		beginHistory: stopUndoCapture,
		finishHistory: stopUndoCapture,
		cancelHistory: cancelUndoCapture,
	};

	const shared = useCanvasEditorPointer({
		svgRef,
		activeTool,
		pathDrawMode,
		documentAdapter,
		uiAdapter: {
			getState: () => {
				const store = storeRef.current;
				return {
					activeTool: store.activeTool,
					pathDrawMode: store.pathDrawMode,
					toolLocked: store.toolLocked,
					readOnly,
					spacePressed: store.isSpacePressed,
					viewport: store.viewport,
					selectedIds: store.selectedIds,
					snapToObjects: store.snapToObjects,
					selectionBox: store.selectionBox,
					lassoPath: store.lassoPath,
				};
			},
			getStyle: (tool) => {
				const store = storeRef.current;
				return {
					stroke: tool === "frame" ? "#6366f1" : store.strokeColor,
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
			},
			getDefaultElementSize: () => ({
				width: storeRef.current.shapePresetWidth,
				height: storeRef.current.shapePresetHeight,
			}),
			setActiveTool: (tool) =>
				storeRef.current.setActiveTool(
					tool as typeof storeRef.current.activeTool,
				),
			setSelectedIds: (ids) => storeRef.current.setSelectedIds(ids),
			clearSelection: () => storeRef.current.clearSelection(),
			pan: (dx, dy) => storeRef.current.pan(dx, dy),
			setViewport: (viewport) => storeRef.current.setViewport(viewport),
			setSelectionBox: (box) => storeRef.current.setSelectionBox(box),
			setLassoPath: (path) => storeRef.current.setLassoPath(path),
			setSnapVisuals: (guides, points = []) => {
				storeRef.current.setSnapGuides(guides);
				storeRef.current.setSnapPointIndicators(points);
			},
			setEyedropperColors: ({ stroke, fill }) => {
				const store = storeRef.current;
				if (store.eyedropperTarget === "fill") store.setFillColor(fill);
				else store.setStrokeColor(stroke);
			},
			beginLaser: (point) =>
				storeRef.current.addLaserTrailPoint(point.x, point.y, null),
			appendLaser: (id, point) => {
				storeRef.current.addLaserTrailPoint(point.x, point.y, id);
			},
			finishLaser: (id) => storeRef.current.closeLaserTrail(id),
		},
		resolvePoint,
		startTextPlacement,
		onBeforePointerDown: (point, event) =>
			handlePlacementPointerDown({
				elements,
				scene,
				snappedX: point.snapped.x,
				snappedY: point.snapped.y,
				clientX: event.clientX,
				clientY: event.clientY,
				store: storeRef.current,
				createElement,
				updateElements,
				resolveCenteredPlacementSnap,
				setDrawingPreview: setPlacementPreview,
				clearSnapVisuals,
				theme: { resolvedTheme },
			}),
		shouldDeferTouchPointerDown: () => {
			const store = storeRef.current;
			return (
				store.stickyNotePlacementDraft != null ||
				store.kanbanCardPlacementDraft != null ||
				store.shapePlacementDraft != null
			);
		},
		onIdlePointerMove: (point, event) => {
			const store = storeRef.current;
			if (store.kanbanCardPlacementDraft) {
				setKanbanCardPlacementPreview(point.snapped.x, point.snapped.y);
				return true;
			}
			if (store.stickyNotePlacementDraft) {
				updateStickyNotePlacementFromScreen(event.clientX, event.clientY);
				return true;
			}
			if (store.shapePlacementDraft) {
				setPlacementPreview(
					buildShapePlacementPreview(
						store.shapePlacementDraft,
						point.snapped.x,
						point.snapped.y,
						store,
					),
				);
				return true;
			}
			return false;
		},
	});

	return {
		...shared,
		documentAdapter,
		drawingPreview: shared.drawingPreview ?? placementPreview,
		showKanbanCardPlacementPreview: (point: {
			clientX: number;
			clientY: number;
		}) => {
			const resolved = resolvePoint(point.clientX, point.clientY);
			setKanbanCardPlacementPreview(resolved.snapped.x, resolved.snapped.y);
		},
		showStickyNotePlacementPreview: (point: {
			clientX: number;
			clientY: number;
		}) => updateStickyNotePlacementFromScreen(point.clientX, point.clientY),
	};
}
