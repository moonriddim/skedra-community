/**
 * Pointer-Bridge zwischen SkedraCanvas-Gesten und useCanvasPointer / Saved Views.
 */

import type { CanvasStoreState } from "@/hooks/use-canvas-store";
import { getGanttCanvasScrollbarThumbMeta } from "@skedra/canvas-core";
import {
	type CanvasEditorBeginAuxiliaryPointerGesture,
	canvasEditorToolSupportsSnapOverride,
	resolveCanvasEditorContextSelectionIds,
} from "@skedra/canvas-editor";
import { useCallback, useRef } from "react";

interface PointerGestureHandlers {
	onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
	onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
	onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
	onPointerCancel: (e?: React.PointerEvent<SVGSVGElement>) => void;
	onLostPointerCapture: (e?: React.PointerEvent<SVGSVGElement>) => boolean;
	onContextMenu: (e: React.MouseEvent) => boolean;
	beginAuxiliaryPointerGesture: CanvasEditorBeginAuxiliaryPointerGesture;
	isMultiTouchGesture: () => boolean;
	isPointerGestureActive: () => boolean;
	beginGanttCanvasScroll: (chartId: string, canvasX: number) => boolean;
	updateGanttCanvasScroll: (chartId: string, canvasX: number) => boolean;
	endGanttCanvasScroll: (chartId: string) => boolean;
}

interface UseSkedraCanvasPointerBridgeOptions {
	svgRef: React.RefObject<SVGSVGElement | null>;
	store: CanvasStoreState;
	presentationMode: boolean;
	textEditorOpen: boolean;
	isCapturingView: boolean;
	startViewCapture: (
		canvasX: number,
		canvasY: number,
		pointerId: number,
	) => void;
	handleViewPointerMove: (
		canvasX: number,
		canvasY: number,
		pointerId: number,
	) => boolean;
	handleViewPointerUp: (pointerId: number) => boolean;
	cancelViewInteraction: () => boolean;
	pointerHandlers: PointerGestureHandlers;
	elements: Map<string, CanvasElement>;
	getEventElement: (target: EventTarget | null) => CanvasElement | null;
	getElementAtPosition: (
		canvasX: number,
		canvasY: number,
	) => CanvasElement | null;
	getKanbanElementAtPosition: (
		canvasX: number,
		canvasY: number,
	) => CanvasElement | null;
	clearMindmapHoverLeaveTimeout: () => void;
	setHoveredMindmapNodeId: (id: string | null) => void;
	setHoveredMindmapButtonId: (id: string | null) => void;
	scheduleMindmapHoverClear: () => void;
	setPresenceCursor: (cursor: { x: number; y: number } | null) => void;
	isMindmapNode: (el: CanvasElement) => boolean;
	openKanbanCard: (id: string) => void;
	openKanbanList: (id: string) => void;
}

type CanvasElement = import("@skedra/canvas-core").CanvasElement;
type KanbanClickTargetKind = "kanban-card" | "kanban-list";

const DOUBLE_CLICK_MAX_MS = 450;
export function useSkedraCanvasPointerBridge({
	svgRef,
	store,
	presentationMode,
	textEditorOpen,
	isCapturingView,
	startViewCapture,
	handleViewPointerMove,
	handleViewPointerUp,
	cancelViewInteraction,
	pointerHandlers,
	elements,
	getEventElement,
	getElementAtPosition,
	getKanbanElementAtPosition,
	clearMindmapHoverLeaveTimeout,
	setHoveredMindmapNodeId,
	setHoveredMindmapButtonId,
	scheduleMindmapHoverClear,
	setPresenceCursor,
	isMindmapNode,
	openKanbanCard,
	openKanbanList,
}: UseSkedraCanvasPointerBridgeOptions) {
	const pointerGestureRef = useRef({
		downX: 0,
		downY: 0,
		dragged: false,
		suppressClickUntil: 0,
		clickTargetId: null as string | null,
		clickTargetWasSelected: false,
		kanbanClickTargetId: null as string | null,
		kanbanClickTargetKind: null as KanbanClickTargetKind | null,
		lastKanbanClickTargetId: null as string | null,
		lastKanbanClickAt: 0,
	});
	const ganttCanvasScrollRef = useRef<{
		pointerId: number;
		chartId: string;
		canvasLeft: number;
		viewportX: number;
		viewportZoom: number;
	} | null>(null);

	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			if (presentationMode) {
				e.preventDefault();
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			if (
				e.shiftKey &&
				canvasEditorToolSupportsSnapOverride(store.activeTool)
			) {
				store.setContextMenu(null);
				store.setSnapMenu({ x: e.clientX, y: e.clientY, kind: "override" });
				return;
			}
			if (pointerHandlers.onContextMenu(e)) return;
			store.setSnapMenu(null);
			const rect = svgRef.current?.getBoundingClientRect();
			if (rect) {
				const canvasX =
					(e.clientX - rect.left - store.viewport.x) / store.viewport.zoom;
				const canvasY =
					(e.clientY - rect.top - store.viewport.y) / store.viewport.zoom;
				const target =
					getEventElement(e.target) ?? getElementAtPosition(canvasX, canvasY);
				store.setSelectedIds(
					resolveCanvasEditorContextSelectionIds(
						target,
						elements,
						store.selectedIds,
					),
				);
			}
			store.setContextMenu({ x: e.clientX, y: e.clientY });
		},
		[
			pointerHandlers,
			presentationMode,
			store,
			svgRef,
			getEventElement,
			getElementAtPosition,
			elements,
		],
	);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<SVGSVGElement>) => {
			if (isCapturingView && e.button === 0) {
				if (
					!pointerHandlers.beginAuxiliaryPointerGesture(
						e,
						cancelViewInteraction,
					)
				) {
					return;
				}
				const rect = svgRef.current?.getBoundingClientRect();
				if (!rect) return;
				const canvasX =
					(e.clientX - rect.left - store.viewport.x) / store.viewport.zoom;
				const canvasY =
					(e.clientY - rect.top - store.viewport.y) / store.viewport.zoom;
				startViewCapture(canvasX, canvasY, e.pointerId);
				try {
					e.currentTarget.setPointerCapture(e.pointerId);
				} catch {
					// The browser may already have cancelled the pointer.
				}
				return;
			}

			if (!textEditorOpen && e.button === 0 && store.activeTool === "select") {
				const rect = svgRef.current?.getBoundingClientRect();
				if (rect) {
					const canvasX =
						(e.clientX - rect.left - store.viewport.x) / store.viewport.zoom;
					const canvasY =
						(e.clientY - rect.top - store.viewport.y) / store.viewport.zoom;
					const targetElement =
						getEventElement(e.target) ?? getElementAtPosition(canvasX, canvasY);
					const scrollbarThumb =
						getGanttCanvasScrollbarThumbMeta(targetElement);
					if (
						scrollbarThumb &&
						pointerHandlers.beginGanttCanvasScroll(
							scrollbarThumb.ganttChartId,
							canvasX,
						)
					) {
						e.preventDefault();
						e.stopPropagation();
						store.setContextMenu(null);
						store.setSnapMenu(null);
						ganttCanvasScrollRef.current = {
							pointerId: e.pointerId,
							chartId: scrollbarThumb.ganttChartId,
							canvasLeft: rect.left,
							viewportX: store.viewport.x,
							viewportZoom: store.viewport.zoom,
						};
						pointerGestureRef.current.dragged = true;
						try {
							e.currentTarget.setPointerCapture(e.pointerId);
						} catch {
							// The browser may already have cancelled the pointer.
						}
						return;
					}
				}
			}

			pointerGestureRef.current.downX = e.clientX;
			pointerGestureRef.current.downY = e.clientY;
			pointerGestureRef.current.dragged = pointerHandlers.isMultiTouchGesture();
			pointerGestureRef.current.clickTargetId = null;
			pointerGestureRef.current.clickTargetWasSelected = false;
			pointerGestureRef.current.kanbanClickTargetId = null;
			pointerGestureRef.current.kanbanClickTargetKind = null;

			if (textEditorOpen) return;
			store.setContextMenu(null);
			store.setSnapMenu(null);
			if (e.button === 0 && store.activeTool === "select") {
				const rect = svgRef.current?.getBoundingClientRect();
				if (rect) {
					const canvasX =
						(e.clientX - rect.left - store.viewport.x) / store.viewport.zoom;
					const canvasY =
						(e.clientY - rect.top - store.viewport.y) / store.viewport.zoom;
					const targetElement =
						getEventElement(e.target) ?? getElementAtPosition(canvasX, canvasY);
					const kanbanTarget = getKanbanElementAtPosition(canvasX, canvasY);
					pointerGestureRef.current.clickTargetId = targetElement?.id ?? null;
					pointerGestureRef.current.clickTargetWasSelected =
						targetElement != null && store.selectedIds.has(targetElement.id);
					if (
						kanbanTarget?.customData?.skedraType === "kanban-card" ||
						kanbanTarget?.customData?.skedraType === "kanban-list"
					) {
						pointerGestureRef.current.kanbanClickTargetId = kanbanTarget.id;
						pointerGestureRef.current.kanbanClickTargetKind =
							kanbanTarget.customData.skedraType;
					}
				}
			}
			pointerHandlers.onPointerDown(e);
		},
		[
			textEditorOpen,
			store,
			pointerHandlers,
			getEventElement,
			getElementAtPosition,
			getKanbanElementAtPosition,
			isCapturingView,
			cancelViewInteraction,
			startViewCapture,
			svgRef,
		],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent<SVGSVGElement>) => {
			const ganttScroll = ganttCanvasScrollRef.current;
			if (ganttScroll?.pointerId === e.pointerId) {
				const canvasX =
					(e.clientX - ganttScroll.canvasLeft - ganttScroll.viewportX) /
					ganttScroll.viewportZoom;
				e.preventDefault();
				pointerHandlers.updateGanttCanvasScroll(ganttScroll.chartId, canvasX);
				pointerGestureRef.current.dragged = true;
				return true;
			}
			pointerHandlers.onPointerMove(e);
			if (pointerHandlers.isMultiTouchGesture()) {
				pointerGestureRef.current.dragged = true;
			}
			if (pointerHandlers.isPointerGestureActive()) {
				pointerGestureRef.current.dragged = true;
				return true;
			}

			const rect = svgRef.current?.getBoundingClientRect();
			if (rect) {
				const canvasX =
					(e.clientX - rect.left - store.viewport.x) / store.viewport.zoom;
				const canvasY =
					(e.clientY - rect.top - store.viewport.y) / store.viewport.zoom;
				if (handleViewPointerMove(canvasX, canvasY, e.pointerId)) return true;
			}

			const dx = e.clientX - pointerGestureRef.current.downX;
			const dy = e.clientY - pointerGestureRef.current.downY;
			if (!pointerGestureRef.current.dragged && Math.hypot(dx, dy) > 5) {
				pointerGestureRef.current.dragged = true;
			}
			return false;
		},
		[pointerHandlers, store.viewport, handleViewPointerMove, svgRef],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent<SVGSVGElement>) => {
			const ganttScroll = ganttCanvasScrollRef.current;
			if (ganttScroll?.pointerId === e.pointerId) {
				e.preventDefault();
				e.stopPropagation();
				pointerHandlers.endGanttCanvasScroll(ganttScroll.chartId);
				ganttCanvasScrollRef.current = null;
				pointerGestureRef.current.suppressClickUntil = performance.now() + 250;
				pointerGestureRef.current.clickTargetId = null;
				pointerGestureRef.current.clickTargetWasSelected = false;
				pointerGestureRef.current.kanbanClickTargetId = null;
				pointerGestureRef.current.kanbanClickTargetKind = null;
				if (e.currentTarget.hasPointerCapture(e.pointerId)) {
					e.currentTarget.releasePointerCapture(e.pointerId);
				}
				return;
			}
			const wasMultiTouch = pointerHandlers.isMultiTouchGesture();
			pointerHandlers.onPointerUp(e);
			if (handleViewPointerUp(e.pointerId)) {
				pointerGestureRef.current.clickTargetId = null;
				pointerGestureRef.current.clickTargetWasSelected = false;
				pointerGestureRef.current.kanbanClickTargetId = null;
				pointerGestureRef.current.kanbanClickTargetKind = null;
				return;
			}

			if (pointerGestureRef.current.dragged || wasMultiTouch) {
				pointerGestureRef.current.suppressClickUntil = performance.now() + 250;
			}
			if (
				!wasMultiTouch &&
				!pointerGestureRef.current.dragged &&
				store.activeTool === "select"
			) {
				const now = performance.now();
				const targetId = pointerGestureRef.current.kanbanClickTargetId;
				const targetKind = pointerGestureRef.current.kanbanClickTargetKind;
				if (
					targetId &&
					targetKind &&
					pointerGestureRef.current.lastKanbanClickTargetId === targetId &&
					now - pointerGestureRef.current.lastKanbanClickAt <=
						DOUBLE_CLICK_MAX_MS
				) {
					if (targetKind === "kanban-card") openKanbanCard(targetId);
					else openKanbanList(targetId);
					pointerGestureRef.current.lastKanbanClickAt = 0;
					pointerGestureRef.current.lastKanbanClickTargetId = null;
				} else {
					pointerGestureRef.current.lastKanbanClickAt = now;
					pointerGestureRef.current.lastKanbanClickTargetId = targetId;
				}
			}
			pointerGestureRef.current.clickTargetId = null;
			pointerGestureRef.current.clickTargetWasSelected = false;
			pointerGestureRef.current.kanbanClickTargetId = null;
			pointerGestureRef.current.kanbanClickTargetKind = null;
		},
		[
			pointerHandlers,
			handleViewPointerUp,
			store.activeTool,
			openKanbanCard,
			openKanbanList,
		],
	);

	const handleCanvasPointerMove = useCallback(
		(event: React.PointerEvent<SVGSVGElement>) => {
			if (handlePointerMove(event)) return;

			const rect = svgRef.current?.getBoundingClientRect();
			if (!rect) return;
			const canvasX =
				(event.clientX - rect.left - store.viewport.x) / store.viewport.zoom;
			const canvasY =
				(event.clientY - rect.top - store.viewport.y) / store.viewport.zoom;
			const hoveredElement =
				getEventElement(event.target) ?? getElementAtPosition(canvasX, canvasY);
			const hoveredMindmap =
				hoveredElement && isMindmapNode(hoveredElement) ? hoveredElement : null;
			const hoveredMindmapId = hoveredMindmap?.id ?? null;
			clearMindmapHoverLeaveTimeout();
			setHoveredMindmapNodeId(hoveredMindmapId);
			if (!hoveredMindmapId) {
				setHoveredMindmapButtonId(null);
			}

			setPresenceCursor({ x: canvasX, y: canvasY });
		},
		[
			clearMindmapHoverLeaveTimeout,
			getElementAtPosition,
			getEventElement,
			handlePointerMove,
			setHoveredMindmapButtonId,
			setHoveredMindmapNodeId,
			isMindmapNode,
			setPresenceCursor,
			store.viewport,
			svgRef,
		],
	);

	const handleCanvasPointerLeave = useCallback(() => {
		scheduleMindmapHoverClear();
		setPresenceCursor(null);
	}, [scheduleMindmapHoverClear, setPresenceCursor]);

	const clearPointerGestureState = useCallback(() => {
		pointerGestureRef.current.clickTargetId = null;
		pointerGestureRef.current.clickTargetWasSelected = false;
		pointerGestureRef.current.kanbanClickTargetId = null;
		pointerGestureRef.current.kanbanClickTargetKind = null;
		scheduleMindmapHoverClear();
		setPresenceCursor(null);
	}, [scheduleMindmapHoverClear, setPresenceCursor]);

	const handlePointerCancel = useCallback(
		(event: React.PointerEvent<SVGSVGElement>) => {
			const ganttScroll = ganttCanvasScrollRef.current;
			if (ganttScroll?.pointerId === event.pointerId) {
				pointerHandlers.endGanttCanvasScroll(ganttScroll.chartId);
				ganttCanvasScrollRef.current = null;
				clearPointerGestureState();
				return;
			}
			pointerHandlers.onPointerCancel(event);
			clearPointerGestureState();
		},
		[clearPointerGestureState, pointerHandlers],
	);

	const handleLostPointerCapture = useCallback(
		(event: React.PointerEvent<SVGSVGElement>) => {
			const ganttScroll = ganttCanvasScrollRef.current;
			if (ganttScroll?.pointerId === event.pointerId) {
				pointerHandlers.endGanttCanvasScroll(ganttScroll.chartId);
				ganttCanvasScrollRef.current = null;
				clearPointerGestureState();
				return;
			}
			const gestureCancelled = pointerHandlers.onLostPointerCapture(event);
			if (gestureCancelled) {
				clearPointerGestureState();
			}
		},
		[clearPointerGestureState, pointerHandlers],
	);

	return {
		pointerGestureRef,
		handleContextMenu,
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
		handlePointerCancel,
		handleLostPointerCapture,
		handleCanvasPointerMove,
		handleCanvasPointerLeave,
	};
}
