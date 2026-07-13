/**
 * Pointer-Event-Handler fuer das Canvas.
 * Verwaltet Zeichnen, Selektieren, Verschieben und Resize.
 * Nutzt Pointer-Events fuer Maus-, Touch- und Stift-Kompatibilitaet.
 */

import { useThemeStore } from "@/stores/theme";
import type { CanvasElement, CanvasScene } from "@skedra/canvas-core";
import { useCallback, useRef, useState } from "react";
import { calcResize } from "./use-canvas-pointer/geometry-helpers";
import { usePathDraft } from "./use-canvas-pointer/path-draft";
import { appendPreviewPoint } from "./use-canvas-pointer/path-helpers";
import { usePlacementPreviewEffects } from "./use-canvas-pointer/placement-preview-effects";
import {
	isCenterShapeTool,
	isPathTool,
	resolvePointerCanvasCoords,
	supportsAnchorSnapTool,
} from "./use-canvas-pointer/pointer-coords";
import { handleDrawPointerDown } from "./use-canvas-pointer/pointer-draw-down";
import { finalizeDrawOnPointerUp } from "./use-canvas-pointer/pointer-draw-finish";
import { updateDrawingPreviewOnMove } from "./use-canvas-pointer/pointer-draw-move";
import { collectMoveDropUpdates } from "./use-canvas-pointer/pointer-drop-updates";
import { resetPointerGestureState } from "./use-canvas-pointer/pointer-gesture-reset";
import {
	buildDragPointUpdate,
	buildMoveGestureUpdates,
} from "./use-canvas-pointer/pointer-move-gesture";
import { handlePlacementPointerDown } from "./use-canvas-pointer/pointer-placement-down";
import { handleSelectPointerDown } from "./use-canvas-pointer/pointer-select-down";
import {
	collectLassoSelectionIds,
	collectSelectionBoxIds,
	mergeSelectionIds,
} from "./use-canvas-pointer/pointer-selection";
import {
	findElementsToEraseAtPoint,
	pickEyedropperColor,
} from "./use-canvas-pointer/pointer-tools";
import {
	LASSO_POINT_MIN_DISTANCE,
	type PointerState,
} from "./use-canvas-pointer/pointer-types";
import {
	buildKanbanCardPlacementPreview,
	buildShapePlacementPreview,
} from "./use-canvas-pointer/preview-builders";
import { usePointerSnapPlacement } from "./use-canvas-pointer/snap-placement";
import { useCanvasStore, useCanvasStoreRef } from "./use-canvas-store";

interface UseCanvasPointerOptions {
	svgRef: React.RefObject<SVGSVGElement | null>;
	elements: Map<string, CanvasElement>;
	scene: CanvasScene;
	createElement: (el: CanvasElement) => void;
	updateElement: (id: string, updates: Partial<CanvasElement>) => void;
	updateElements: (
		updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
	) => void;
	/** Alt+Ziehen: Auswahl duplizieren (Excalidraw) */
	duplicateSelection?: () => void;
	deleteElements?: (ids: string[]) => void;
	/** Beendet Undo-Gruppierung nach abgeschlossener Geste (Verschieben, Zeichnen, …) */
	stopUndoCapture?: () => void;
	startTextPlacement: Parameters<
		typeof finalizeDrawOnPointerUp
	>[0]["startTextPlacement"];
}

export function useCanvasPointer({
	svgRef,
	elements,
	scene,
	createElement,
	updateElement,
	updateElements,
	duplicateSelection,
	deleteElements,
	stopUndoCapture,
	startTextPlacement,
}: UseCanvasPointerOptions) {
	const storeRef = useCanvasStoreRef();
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
	const stateRef = useRef<PointerState>({
		startScreenX: 0,
		startScreenY: 0,
		startCanvasX: 0,
		startCanvasY: 0,
		action: "none",
		freehandPoints: [],
		moveStart: new Map(),
		resizeHandle: null,
		resizeStartBBox: null,
		dragPointElementId: null,
		dragPointIndex: -1,
		dragPointStart: [0, 0],
		drawFromCenter: false,
		erasedIds: new Set(),
		laserTrailId: null,
	});
	const [drawingPreview, setDrawingPreview] = useState<CanvasElement | null>(
		null,
	);

	/** Screen -> Canvas Koordinaten */
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
		[svgRef, storeRef],
	);

	const repaintCanvasAfterGesture = useCallback(() => {
		const svg = svgRef.current;
		if (!svg) return;
		const previousVisibility = svg.style.visibility;
		svg.style.visibility = "hidden";
		svg.getBoundingClientRect();
		svg.style.visibility = previousVisibility;
	}, [svgRef]);

	const {
		clearSnapVisuals,
		resolveCenteredPlacementSnap,
		resolvePathPlacement,
		updateStickyNotePlacementFromScreen,
	} = usePointerSnapPlacement({ elements, toCanvas, setDrawingPreview });

	const { pathDraftRef, setPathPreview, finalizePathDraft } = usePathDraft({
		createElement,
		stopUndoCapture,
		drawingPreview,
		setDrawingPreview,
		clearSnapVisuals,
	});

	const setShapePlacementPreview = useCallback(
		(centerX: number, centerY: number) => {
			const store = storeRef.current;
			const draft = store.shapePlacementDraft;
			if (!draft) return;

			setDrawingPreview(
				buildShapePlacementPreview(draft, centerX, centerY, store),
			);
		},
		[storeRef],
	);

	const setKanbanCardPlacementPreview = useCallback(
		(centerX: number, centerY: number) => {
			const draft = useCanvasStore.getState().kanbanCardPlacementDraft;
			if (!draft) return;

			setDrawingPreview(
				buildKanbanCardPlacementPreview(draft, centerX, centerY, {
					resolvedTheme,
				}),
			);
		},
		[resolvedTheme],
	);

	usePlacementPreviewEffects({
		drawingPreview,
		setDrawingPreview,
		stateRef,
		toCanvas,
		setKanbanCardPlacementPreview,
		updateStickyNotePlacementFromScreen,
	});

	const showKanbanCardPlacementPreview = useCallback(
		(point: { clientX: number; clientY: number }) => {
			const canvas = toCanvas(point.clientX, point.clientY);
			const snapState = useCanvasStore.getState();
			setKanbanCardPlacementPreview(
				snapState.snapToGrid(canvas.x),
				snapState.snapToGrid(canvas.y),
			);
		},
		[setKanbanCardPlacementPreview, toCanvas],
	);

	const showStickyNotePlacementPreview = useCallback(
		(point: { clientX: number; clientY: number }) => {
			updateStickyNotePlacementFromScreen(point.clientX, point.clientY);
		},
		[updateStickyNotePlacementFromScreen],
	);

	const eraseAtPoint = useCallback(
		(x: number, y: number) => {
			if (!deleteElements) return;
			const erased = stateRef.current.erasedIds;
			const toDelete = findElementsToEraseAtPoint(scene, x, y, erased);
			for (const id of toDelete) erased.add(id);
			if (toDelete.length > 0) deleteElements(toDelete);
		},
		[deleteElements, scene],
	);

	const applyEyedropper = useCallback(
		(x: number, y: number) => {
			const store = storeRef.current;
			const target = store.eyedropperTarget;
			const color = pickEyedropperColor(elements, x, y, target);
			if (color) {
				if (target === "fill") store.setFillColor(color);
				else store.setStrokeColor(color);
			}
			store.restorePreviousTool();
		},
		[elements, storeRef],
	);

	const onPointerDown = useCallback(
		(e: React.PointerEvent) => {
			const store = storeRef.current;
			const tool = store.activeTool;
			const supportsAnchorSnap = supportsAnchorSnapTool(tool);
			const middleClickPathSnap =
				e.button === 1 && supportsAnchorSnap && store.snapToObjects
					? resolvePathPlacement(e.clientX, e.clientY, { forceAnchor: true })
					: null;
			const allowPathSnapWithMiddleButton = !!middleClickPathSnap?.anchor;

			if (e.button === 1 && !allowPathSnapWithMiddleButton) {
				e.preventDefault();
				stateRef.current = {
					...stateRef.current,
					startScreenX: e.clientX,
					startScreenY: e.clientY,
					action: "pan",
				};
				(e.target as Element).setPointerCapture(e.pointerId);
				return;
			}

			if (e.button !== 0 && !allowPathSnapWithMiddleButton) return;

			if (e.button === 0 && store.isSpacePressed) {
				e.preventDefault();
				stateRef.current = {
					...stateRef.current,
					startScreenX: e.clientX,
					startScreenY: e.clientY,
					action: "pan",
				};
				(e.target as Element).setPointerCapture(e.pointerId);
				return;
			}

			const placement = supportsAnchorSnap
				? (middleClickPathSnap ?? resolvePathPlacement(e.clientX, e.clientY))
				: null;
			const { canvas, snappedX, snappedY } = resolvePointerCanvasCoords(
				e.clientX,
				e.clientY,
				{
					placement,
					toCanvas,
					snapToGrid: store.snapToGrid.bind(store),
				},
			);

			if (
				e.button === 0 &&
				handlePlacementPointerDown({
					elements,
					snappedX,
					snappedY,
					clientX: e.clientX,
					clientY: e.clientY,
					store,
					scene,
					createElement,
					updateElements,
					resolveCenteredPlacementSnap,
					setDrawingPreview,
					clearSnapVisuals,
					theme: { resolvedTheme },
				})
			) {
				return;
			}

			stateRef.current = {
				...stateRef.current,
				startScreenX: e.clientX,
				startScreenY: e.clientY,
				startCanvasX: snappedX,
				startCanvasY: snappedY,
				freehandPoints: [],
				moveStart: new Map(),
				drawFromCenter:
					tool === "ellipse" ||
					(e.button === 1 &&
						allowPathSnapWithMiddleButton &&
						isCenterShapeTool(tool)),
			};

			if (tool === "pan") {
				stateRef.current.action = "pan";
				(e.target as Element).setPointerCapture(e.pointerId);
				return;
			}

			if (tool === "eraser") {
				stateRef.current.action = "erase";
				stateRef.current.erasedIds = new Set();
				eraseAtPoint(snappedX, snappedY);
				(e.target as Element).setPointerCapture(e.pointerId);
				return;
			}

			if (tool === "laser") {
				const trailId = store.addLaserTrailPoint(snappedX, snappedY, null);
				stateRef.current.action = "laser";
				stateRef.current.laserTrailId = trailId;
				(e.target as Element).setPointerCapture(e.pointerId);
				return;
			}

			if (tool === "eyedropper") {
				applyEyedropper(snappedX, snappedY);
				return;
			}

			if (tool === "select" || tool === "lasso") {
				const snapState = useCanvasStore.getState();
				const selectResult = handleSelectPointerDown({
					e,
					tool,
					canvas,
					elements,
					scene,
					selectedIds: store.selectedIds,
					getSelectedIds: () => useCanvasStore.getState().selectedIds,
					activePointIndex: snapState.activePointIndex,
					activeHandle: snapState.activeHandle,
					updateElement,
					duplicateSelection,
					setSelectedIds: store.setSelectedIds.bind(store),
					setSelectionBox: store.setSelectionBox.bind(store),
					setLassoPath: store.setLassoPath.bind(store),
				});
				if (selectResult.handled) {
					if ("earlyExit" in selectResult) return;
					Object.assign(stateRef.current, selectResult.patch);
					(e.target as Element).setPointerCapture(e.pointerId);
				}
				return;
			}

			const drawResult = handleDrawPointerDown({
				tool,
				snappedX,
				snappedY,
				store,
				pathDraftRef,
				setPathPreview,
				setDrawingPreview,
			});
			Object.assign(stateRef.current, drawResult.patch);
			if (drawResult.capturePointer) {
				(e.target as Element).setPointerCapture(e.pointerId);
			}
		},
		[
			toCanvas,
			storeRef,
			elements,
			scene,
			createElement,
			updateElement,
			updateElements,
			resolvePathPlacement,
			resolveCenteredPlacementSnap,
			resolvedTheme,
			pathDraftRef,
			setPathPreview,
			clearSnapVisuals,
			duplicateSelection,
			eraseAtPoint,
			applyEyedropper,
		],
	);

	const onPointerMove = useCallback(
		(e: React.PointerEvent) => {
			const store = storeRef.current;
			const state = stateRef.current;
			const tool = store.activeTool;
			const supportsAnchorSnap = supportsAnchorSnapTool(tool);
			const { canvas, snappedX, snappedY } = resolvePointerCanvasCoords(
				e.clientX,
				e.clientY,
				{
					supportsAnchorSnap,
					resolvePathPlacement,
					toCanvas,
					snapToGrid: store.snapToGrid.bind(store),
				},
			);

			const draft = pathDraftRef.current;
			if (draft && store.pathDrawMode === "multi" && isPathTool(tool)) {
				setPathPreview(
					draft.tool,
					appendPreviewPoint(
						draft.points,
						[snappedX, snappedY],
						draft.tool === "arrow" ? store.arrowMode : undefined,
					),
				);
			}

			if (store.kanbanCardPlacementDraft && state.action === "none") {
				setKanbanCardPlacementPreview(snappedX, snappedY);
				return;
			}

			if (store.stickyNotePlacementDraft && state.action === "none") {
				updateStickyNotePlacementFromScreen(e.clientX, e.clientY);
				return;
			}

			if (store.shapePlacementDraft && state.action === "none") {
				setShapePlacementPreview(snappedX, snappedY);
				return;
			}

			if (state.action === "none") return;

			if (state.action === "pan") {
				const dx = e.clientX - state.startScreenX;
				const dy = e.clientY - state.startScreenY;
				stateRef.current.startScreenX = e.clientX;
				stateRef.current.startScreenY = e.clientY;
				store.pan(dx, dy);
				return;
			}

			if (state.action === "erase") {
				eraseAtPoint(snappedX, snappedY);
				return;
			}

			if (state.action === "laser" && state.laserTrailId) {
				store.addLaserTrailPoint(snappedX, snappedY, state.laserTrailId);
				return;
			}

			if (state.action === "select-box") {
				store.setSelectionBox({
					startX: state.startCanvasX,
					startY: state.startCanvasY,
					endX: canvas.x,
					endY: canvas.y,
				});
				return;
			}

			if (state.action === "select-lasso") {
				const path = store.lassoPath ?? [];
				const last = path[path.length - 1];
				if (
					path.length === 0 ||
					Math.hypot(canvas.x - last[0], canvas.y - last[1]) >=
						LASSO_POINT_MIN_DISTANCE / Math.max(store.viewport.zoom, 0.01)
				) {
					store.setLassoPath([...path, [canvas.x, canvas.y]]);
				}
				return;
			}

			if (state.action === "move") {
				updateElements(
					buildMoveGestureUpdates(
						state,
						elements,
						store.selectedIds,
						snappedX,
						snappedY,
						store.snapToObjects,
						store.setSnapGuides.bind(store),
					),
				);
				return;
			}

			if (state.action === "drag-point") {
				const update = buildDragPointUpdate(
					state,
					elements,
					snappedX,
					snappedY,
					store.snapToObjects,
					store.setSnapGuides.bind(store),
				);
				if (update) updateElement(update.id, update.changes);
				return;
			}

			if (
				state.action === "resize" &&
				state.resizeHandle &&
				state.resizeStartBBox
			) {
				const dx = snappedX - state.startCanvasX;
				const dy = snappedY - state.startCanvasY;
				const bb = state.resizeStartBBox;
				const ids = Array.from(store.selectedIds);
				if (ids.length !== 1) return;
				updateElement(ids[0], calcResize(bb, state.resizeHandle, dx, dy));
				return;
			}

			if (state.action === "draw") {
				updateDrawingPreviewOnMove({
					state,
					store,
					snappedX,
					snappedY,
					canvas,
					shiftKey: e.shiftKey,
					elements,
					pathDraftRef,
					setPathPreview,
					setDrawingPreview,
				});
			}
		},
		[
			toCanvas,
			storeRef,
			resolvePathPlacement,
			elements,
			pathDraftRef,
			setPathPreview,
			setKanbanCardPlacementPreview,
			updateStickyNotePlacementFromScreen,
			setShapePlacementPreview,
			updateElement,
			updateElements,
			eraseAtPoint,
		],
	);

	const onPointerUp = useCallback(
		(e: React.PointerEvent) => {
			const store = storeRef.current;
			const state = stateRef.current;
			const shouldRepaintAfterGesture =
				state.action === "move" ||
				state.action === "draw" ||
				state.action === "resize" ||
				state.action === "drag-point";
			const supportsAnchorSnap = supportsAnchorSnapTool(store.activeTool);
			const { snappedX, snappedY } = resolvePointerCanvasCoords(
				e.clientX,
				e.clientY,
				{
					supportsAnchorSnap,
					resolvePathPlacement,
					toCanvas,
					snapToGrid: store.snapToGrid.bind(store),
				},
			);

			if (state.action === "move" && state.moveStart.size > 0) {
				const updates = collectMoveDropUpdates(elements, state.moveStart);
				if (updates.length > 0) {
					updateElements(updates);
				}
			}

			if (state.action === "select-box") {
				const box = store.selectionBox;
				if (box) {
					const ids = collectSelectionBoxIds(scene, box);
					if (ids.size > 0) {
						store.setSelectedIds(mergeSelectionIds(e, store.selectedIds, ids));
					}
				}
				store.setSelectionBox(null);
			}

			if (state.action === "select-lasso") {
				const ids = collectLassoSelectionIds(scene, store.lassoPath ?? []);
				if (ids) {
					store.setSelectedIds(mergeSelectionIds(e, store.selectedIds, ids));
				}
				store.setLassoPath(null);
			}

			if (state.action === "draw" && drawingPreview) {
				const { created } = finalizeDrawOnPointerUp({
					state,
					store,
					drawingPreview,
					snappedX,
					snappedY,
					pathDraftRef,
					createElement,
					setPathPreview,
					setDrawingPreview,
					startTextPlacement,
				});
				if (created) {
					store.clearSelection();
				}
			}

			if (state.action === "laser" && state.laserTrailId) {
				store.closeLaserTrail(state.laserTrailId);
			}

			if (
				state.action === "move" ||
				state.action === "draw" ||
				state.action === "resize" ||
				state.action === "drag-point" ||
				state.action === "erase"
			) {
				stopUndoCapture?.();
			}

			resetPointerGestureState(stateRef);
			store.setActiveHandle(null);
			clearSnapVisuals();
			store.setActivePointIndex(null);
			if (shouldRepaintAfterGesture) repaintCanvasAfterGesture();
		},
		[
			storeRef,
			elements,
			scene,
			drawingPreview,
			createElement,
			startTextPlacement,
			updateElements,
			pathDraftRef,
			setPathPreview,
			toCanvas,
			resolvePathPlacement,
			clearSnapVisuals,
			stopUndoCapture,
			repaintCanvasAfterGesture,
		],
	);

	const onPointerCancel = useCallback(() => {
		const store = storeRef.current;
		const state = stateRef.current;
		const shouldRepaintAfterGesture =
			state.action === "move" ||
			state.action === "draw" ||
			state.action === "resize" ||
			state.action === "drag-point";

		if (state.action === "laser" && state.laserTrailId) {
			store.closeLaserTrail(state.laserTrailId);
		}
		if (
			state.action === "move" ||
			state.action === "draw" ||
			state.action === "resize" ||
			state.action === "drag-point" ||
			state.action === "erase"
		) {
			stopUndoCapture?.();
		}

		resetPointerGestureState(stateRef);
		store.setSelectionBox(null);
		store.setLassoPath(null);
		store.setActiveHandle(null);
		store.setActivePointIndex(null);
		clearSnapVisuals();
		if (shouldRepaintAfterGesture) repaintCanvasAfterGesture();
	}, [clearSnapVisuals, repaintCanvasAfterGesture, stopUndoCapture, storeRef]);

	const onDoubleClick = useCallback(() => {
		const store = storeRef.current;
		if (store.pathDrawMode !== "multi") return false;
		if (store.activeTool !== "line" && store.activeTool !== "arrow")
			return false;
		return finalizePathDraft();
	}, [finalizePathDraft, storeRef]);

	return {
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerCancel,
		onDoubleClick,
		drawingPreview,
		showKanbanCardPlacementPreview,
		showStickyNotePlacementPreview,
	};
}
