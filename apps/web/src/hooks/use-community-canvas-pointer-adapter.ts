/** Community document/state adapter for the shared canvas-editor pointer pipeline. */

import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import { ganttDateLabel } from "@/lib/templates/gantt";
import { templateText } from "@/lib/templates/shared";
import { useThemeStore } from "@/stores/theme";
import {
	type CanvasElement,
	type CanvasScene,
	type GanttChartDocument,
	type GanttChartMutationPlan,
	applyCanvasMutationPlan,
	buildGanttChartMutationPlan,
	getGanttCanvasScrollbarMetrics,
	getGanttCanvasScrollbarThumbMeta,
	getGanttChartDocument,
	getGanttTaskMeta,
	isGanttChart,
	resizeGanttChartCanvasFromEdge,
	scrollGanttChartCanvas,
} from "@skedra/canvas-core";
import {
	type CanvasEditorDocumentAdapter,
	type CanvasEditorPointerUiAdapter,
	type CanvasEditorTextPlacement,
	useCanvasEditorPointer,
} from "@skedra/canvas-editor";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
	/** Direct adapter delete for semantic rebuilds that also replace locked parts. */
	deleteElementsDirect?: (ids: string[]) => void;
	applyMutationPlan?: (plan: GanttChartMutationPlan) => void;
	startUndoCapture?: () => void;
	stopUndoCapture?: () => void;
	cancelUndoCapture?: () => void;
	startTextPlacement: (placement: CanvasEditorTextPlacement) => void;
}

interface GanttCanvasScrollSession {
	chartId: string;
	source: Map<string, CanvasElement>;
	document: GanttChartDocument;
	pointerOffset: number;
	lastViewportStartDay: number;
	lastRequestedViewportStartDay: number;
	pendingViewportStartDay: number | null;
	animationFrameId: number | null;
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
	deleteElementsDirect,
	applyMutationPlan,
	startUndoCapture,
	stopUndoCapture,
	cancelUndoCapture,
	startTextPlacement,
}: UseCommunityCanvasPointerAdapterOptions) {
	const storeRef = useCanvasStoreRef();
	const activeTool = useCanvasStore((state) => state.activeTool);
	const pathDrawMode = useCanvasStore((state) => state.pathDrawMode);
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
	const ganttFactoryDefaults = useMemo(
		() => getCanvasElementFactoryDefaults({ resolvedTheme }),
		[resolvedTheme],
	);
	const [placementPreview, setPlacementPreview] =
		useState<CanvasElement | null>(null);
	const ganttCanvasScrollRef = useRef<GanttCanvasScrollSession | null>(null);

	useEffect(
		() => () => {
			const session = ganttCanvasScrollRef.current;
			if (session?.animationFrameId != null) {
				window.cancelAnimationFrame(session.animationFrameId);
			}
		},
		[],
	);

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
		(
			clientX: number,
			clientY: number,
			options?: {
				forceAnchor?: boolean;
				objectSnap?: boolean;
				excludeIds?: Set<string>;
			},
		) => {
			const placement = resolvePathPlacement(clientX, clientY, options);
			return {
				raw: placement.canvas,
				snapped: { x: placement.x, y: placement.y },
				snapAnchor: placement.anchor,
			};
		},
		[resolvePathPlacement],
	);

	/** Applies a Gantt rebuild plan (delete → update → create → select). */
	const applyGanttMutationPlan = useCallback(
		(plan: GanttChartMutationPlan, options: { select?: boolean } = {}) => {
			if (applyMutationPlan) {
				applyMutationPlan(plan);
			} else {
				if (plan.deleteIds.length > 0) deleteElementsDirect?.(plan.deleteIds);
				if (plan.update.length > 0) updateElements(plan.update);
				for (const element of plan.create) createElement(element);
			}
			if (options.select !== false) {
				storeRef.current.setSelectedIds(new Set(plan.selectedIds));
			}
		},
		[
			applyMutationPlan,
			createElement,
			deleteElementsDirect,
			storeRef,
			updateElements,
		],
	);

	/**
	 * Folds free-hand canvas edits (moved/resized task bars) back into the
	 * chart document and rebuilds it. This is what makes bars snap to whole
	 * days after a direct drag on the canvas.
	 */
	const rebuildGanttChartFromCanvas = useCallback(
		(chartId: string, virtualElements?: Map<string, CanvasElement>) => {
			if (!deleteElementsDirect) return false;
			const source = virtualElements ?? elements;
			const document = getGanttChartDocument(source.values(), chartId);
			if (!document) return false;
			applyGanttMutationPlan(
				buildGanttChartMutationPlan(
					ganttFactoryDefaults,
					source.values(),
					chartId,
					document,
					{ dateLabel: ganttDateLabel, text: templateText },
				),
			);
			return true;
		},
		[
			applyGanttMutationPlan,
			deleteElementsDirect,
			elements,
			ganttFactoryDefaults,
		],
	);

	const beginGanttCanvasScroll = useCallback(
		(chartId: string, canvasX: number) => {
			if (readOnly || !deleteElementsDirect) return false;
			const source = new Map(elements);
			const frame = source.get(chartId);
			const document = getGanttChartDocument(source.values(), chartId);
			const metrics = document
				? getGanttCanvasScrollbarMetrics(document)
				: null;
			if (!frame || !document || !metrics) return false;
			const thumbX =
				frame.x +
				document.labelWidth +
				metrics.trackInset +
				metrics.thumbOffset;
			ganttCanvasScrollRef.current = {
				chartId,
				source,
				document,
				pointerOffset: Math.max(
					0,
					Math.min(metrics.thumbWidth, canvasX - thumbX),
				),
				lastViewportStartDay: document.canvasViewportStartDay ?? 0,
				lastRequestedViewportStartDay: document.canvasViewportStartDay ?? 0,
				pendingViewportStartDay: null,
				animationFrameId: null,
			};
			(startUndoCapture ?? stopUndoCapture)?.();
			const selectedScrollbar = [...storeRef.current.selectedIds].some((id) =>
				getGanttCanvasScrollbarThumbMeta(source.get(id)),
			);
			if (selectedScrollbar) {
				storeRef.current.setSelectedIds(new Set([chartId]));
			}
			return true;
		},
		[
			deleteElementsDirect,
			elements,
			readOnly,
			startUndoCapture,
			stopUndoCapture,
			storeRef,
		],
	);

	const commitGanttCanvasScroll = useCallback(
		(session: GanttCanvasScrollSession, viewportStartDay: number) => {
			if (viewportStartDay === session.lastViewportStartDay) return true;
			const frame = session.source.get(session.chartId);
			if (!frame) return false;
			const nextDocument = scrollGanttChartCanvas(
				session.document,
				viewportStartDay,
			);
			const plan = buildGanttChartMutationPlan(
				ganttFactoryDefaults,
				session.source.values(),
				frame,
				nextDocument,
				{ dateLabel: ganttDateLabel, text: templateText },
			);
			applyGanttMutationPlan(plan, { select: false });
			const applied = applyCanvasMutationPlan(
				Array.from(session.source.values()),
				plan,
			);
			session.source = new Map(applied.map((element) => [element.id, element]));
			session.document = nextDocument;
			session.lastViewportStartDay = viewportStartDay;
			return true;
		},
		[applyGanttMutationPlan, ganttFactoryDefaults],
	);

	const updateGanttCanvasScroll = useCallback(
		(chartId: string, canvasX: number) => {
			const session = ganttCanvasScrollRef.current;
			if (!session || session.chartId !== chartId) return false;
			const frame = session.source.get(chartId);
			const metrics = getGanttCanvasScrollbarMetrics(session.document);
			if (!frame || !metrics) return false;
			const trackStart =
				frame.x + session.document.labelWidth + metrics.trackInset;
			const travel = Math.max(1, metrics.trackWidth - metrics.thumbWidth);
			const thumbX = canvasX - session.pointerOffset;
			const ratio = Math.max(0, Math.min(1, (thumbX - trackStart) / travel));
			const viewportStartDay = Math.round(ratio * metrics.maxViewportStartDay);
			if (viewportStartDay === session.lastRequestedViewportStartDay)
				return true;
			session.lastRequestedViewportStartDay = viewportStartDay;
			session.pendingViewportStartDay = viewportStartDay;
			if (session.animationFrameId == null) {
				session.animationFrameId = window.requestAnimationFrame(() => {
					const activeSession = ganttCanvasScrollRef.current;
					if (!activeSession || activeSession !== session) return;
					activeSession.animationFrameId = null;
					const pending = activeSession.pendingViewportStartDay;
					activeSession.pendingViewportStartDay = null;
					if (pending != null) commitGanttCanvasScroll(activeSession, pending);
				});
			}
			return true;
		},
		[commitGanttCanvasScroll],
	);

	const endGanttCanvasScroll = useCallback(
		(chartId: string) => {
			const session = ganttCanvasScrollRef.current;
			if (session?.chartId !== chartId) return false;
			if (session.animationFrameId != null) {
				window.cancelAnimationFrame(session.animationFrameId);
				session.animationFrameId = null;
			}
			const pending = session.pendingViewportStartDay;
			session.pendingViewportStartDay = null;
			if (pending != null) commitGanttCanvasScroll(session, pending);
			ganttCanvasScrollRef.current = null;
			stopUndoCapture?.();
			return true;
		},
		[commitGanttCanvasScroll, stopUndoCapture],
	);

	const finishMove = useCallback(
		(moveStart: Map<string, { x: number; y: number }>) => {
			// Detect moved Gantt task bars and snap them back to the day grid.
			// Whole-chart moves (frame included) keep bars in place relative to
			// the frame, so those charts are skipped.
			const movedFrameCharts = new Set<string>();
			const candidateCharts = new Set<string>();
			for (const id of moveStart.keys()) {
				const element = elements.get(id);
				if (!element) continue;
				if (isGanttChart(element)) {
					const chartId = element.customData?.ganttChartId;
					if (typeof chartId === "string") movedFrameCharts.add(chartId);
					continue;
				}
				const meta = getGanttTaskMeta(element);
				if (meta) candidateCharts.add(meta.ganttChartId);
			}
			for (const chartId of candidateCharts) {
				if (!movedFrameCharts.has(chartId)) {
					rebuildGanttChartFromCanvas(chartId);
				}
			}
		},
		[elements, rebuildGanttChartFromCanvas],
	);
	const documentAdapter = useMemo<CanvasEditorDocumentAdapter>(
		() => ({
			kind: "community",
			getElements: () => elements,
			getScene: () => scene,
			createId: nanoid,
			createElement,
			updateElement,
			updateElements,
			deleteElements,
			duplicateSelection,
			beginHistory: startUndoCapture ?? stopUndoCapture,
			finishHistory: stopUndoCapture,
			cancelHistory: cancelUndoCapture,
			finishMove,
		}),
		[
			cancelUndoCapture,
			createElement,
			deleteElements,
			duplicateSelection,
			elements,
			finishMove,
			scene,
			startUndoCapture,
			stopUndoCapture,
			updateElement,
			updateElements,
		],
	);
	const uiAdapter = useMemo<CanvasEditorPointerUiAdapter>(
		() => ({
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
					cloudArcRadius: store.cloudArcRadius,
					pyramidSections: store.pyramidSections,
					polygonSides: store.polygonSides,
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
				storeRef.current.setSnapVisuals(guides, points);
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
		}),
		[readOnly, storeRef],
	);

	const shared = useCanvasEditorPointer({
		svgRef,
		activeTool,
		pathDrawMode,
		documentAdapter,
		uiAdapter,
		resolvePoint,
		startTextPlacement,
		onBeforePointerDown: (point, event) => {
			const store = storeRef.current;
			const consumeOverride =
				event.button === 0 && store.snapOverrideMode != null;
			const handled = handlePlacementPointerDown({
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
			});
			if (consumeOverride) store.setSnapOverrideMode(null);
			return handled;
		},
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
		onElementResizeFinished: ({ start, resized }) => {
			if (!deleteElementsDirect) return false;
			// Resizing a single task bar: fold the new geometry back into the
			// document and rebuild, which snaps the duration to whole days.
			const taskMeta = getGanttTaskMeta(start);
			if (taskMeta) {
				const virtualElements = new Map(elements);
				virtualElements.set(resized.id, resized);
				return rebuildGanttChartFromCanvas(
					taskMeta.ganttChartId,
					virtualElements,
				);
			}
			if (!isGanttChart(start)) return false;
			// Read task dates against the original frame. Using the already-resized
			// frame here would reinterpret every unchanged bar relative to the new
			// left edge and make the full plan jump.
			const semanticSource = new Map(elements);
			semanticSource.set(start.id, start);
			const document = getGanttChartDocument(semanticSource.values(), start);
			if (!document) return false;
			const widthChanged = Math.abs(resized.width - start.width) > 0.5;
			const heightChanged = Math.abs(resized.height - start.height) > 0.5;
			const leftEdgeMoved = widthChanged && Math.abs(resized.x - start.x) > 0.5;
			const resizeResult = resizeGanttChartCanvasFromEdge(
				document,
				{
					...(widthChanged ? { width: resized.width } : {}),
					...(heightChanged ? { height: resized.height } : {}),
				},
				leftEdgeMoved ? "start" : "end",
			);
			const nextDocument = resizeResult.document;
			const planFrame = {
				...resized,
				x: start.x + resizeResult.frameOffsetX,
			};
			const virtualElements = new Map(elements);
			virtualElements.set(planFrame.id, planFrame);
			applyGanttMutationPlan(
				buildGanttChartMutationPlan(
					ganttFactoryDefaults,
					virtualElements.values(),
					planFrame,
					nextDocument,
					{ dateLabel: ganttDateLabel, text: templateText },
				),
			);
			return true;
		},
		onGestureFinished: (action) => {
			if (action === "rotate") storeRef.current.setTransformOrigin(null);
		},
	});
	const showKanbanCardPlacementPreview = useCallback(
		(point: { clientX: number; clientY: number }) => {
			const resolved = resolvePoint(point.clientX, point.clientY);
			setKanbanCardPlacementPreview(resolved.snapped.x, resolved.snapped.y);
		},
		[resolvePoint, setKanbanCardPlacementPreview],
	);
	const showStickyNotePlacementPreview = useCallback(
		(point: { clientX: number; clientY: number }) =>
			updateStickyNotePlacementFromScreen(point.clientX, point.clientY),
		[updateStickyNotePlacementFromScreen],
	);

	return {
		...shared,
		documentAdapter,
		beginGanttCanvasScroll,
		updateGanttCanvasScroll,
		endGanttCanvasScroll,
		drawingPreview: shared.drawingPreview ?? placementPreview,
		showKanbanCardPlacementPreview,
		showStickyNotePlacementPreview,
	};
}
