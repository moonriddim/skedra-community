/**
 * Element-Hit-Test und Doppelklick (Text/Kanban/Pfeil-Beschriftung).
 */

import { readElementCustomData } from "@/lib/canvas/custom-data-utils";
import {
	type ArrowTextSide,
	findGanttChartElement,
	frameLabelHitTest,
	getArrowTextSideFromPoint,
	getGanttCanvasScrollbarThumbMeta,
	getGanttChartId,
	getSequenceDiagramElementMeta,
	hitTest,
	isCanvasFrameLabelEditable,
	pathTextLabelHitTest,
} from "@skedra/canvas-core";
import { getBBox } from "@skedra/canvas-core";
import { isKanbanCard, isKanbanList } from "@skedra/canvas-core";
import type { CanvasElement, CanvasScene } from "@skedra/canvas-core";
import { expandCanvasEditorAtomicSelectionIds } from "@skedra/canvas-editor";
import { type RefObject, useCallback } from "react";
import { isTextEditableElement } from "./use-canvas-text-editing";

interface CanvasStoreSlice {
	activeTool: string;
	activePanel: string | null;
	selectedIds: Set<string>;
	viewport: { x: number; y: number; zoom: number };
	setSelectedIds: (ids: Set<string>) => void;
	setEditingTextId: (id: string | null) => void;
	setCroppingImageId: (id: string | null) => void;
	setActivePanel: (panel: "gantt" | "sequence-diagram") => void;
}

type StructuredToolPanel = "gantt" | "sequence-diagram";

function getStructuredToolPanel(
	element: CanvasElement | null | undefined,
): StructuredToolPanel | null {
	if (getGanttChartId(element) || getGanttCanvasScrollbarThumbMeta(element)) {
		return "gantt";
	}
	if (getSequenceDiagramElementMeta(element)) return "sequence-diagram";
	return null;
}

function getStructuredToolAtPosition(
	scene: CanvasScene,
	canvasX: number,
	canvasY: number,
): { element: CanvasElement; panel: StructuredToolPanel } | null {
	for (const element of scene.getHitTestOrderedElements()) {
		const hit =
			frameLabelHitTest(element, canvasX, canvasY) ||
			hitTest(element, canvasX, canvasY, { pathTextLabelHitTest });
		if (!hit) continue;
		const panel = getStructuredToolPanel(element);
		return panel ? { element, panel } : null;
	}
	return null;
}

interface UseCanvasDoubleClickOptions {
	svgRef: RefObject<SVGSVGElement | null>;
	scene: CanvasScene;
	store: CanvasStoreSlice;
	presentationMode: boolean;
	textEditorOpen: boolean;
	pointerHandlers: { onDoubleClick: () => boolean };
	handleCommitTextEditor: () => void;
	shouldSuppressTextEditOpen: () => boolean;
	setEditingArrowTextSide: (side: ArrowTextSide) => void;
	setKanbanDetailId: (id: string | null) => void;
	setKanbanListDetailId: (id: string | null) => void;
}

function openKanbanFromElement(
	el: CanvasElement,
	setKanbanDetailId: (id: string | null) => void,
	setKanbanListDetailId: (id: string | null) => void,
): boolean {
	if (isKanbanCard(el)) {
		setKanbanDetailId(el.id);
		return true;
	}
	if (isKanbanList(el)) {
		setKanbanListDetailId(el.id);
		return true;
	}
	return false;
}

/** Trefferflaeche inkl. Resize-Griffe (liegen leicht ausserhalb der Karten-BBox). */
function hitTestKanbanSelection(
	el: CanvasElement,
	canvasX: number,
	canvasY: number,
	zoom: number,
): boolean {
	const bbox = getBBox(el);
	const margin = 12 / zoom;
	return (
		canvasX >= bbox.x - margin &&
		canvasX <= bbox.x + bbox.width + margin &&
		canvasY >= bbox.y - margin &&
		canvasY <= bbox.y + bbox.height + margin
	);
}

function openKanbanAtPosition(
	scene: CanvasScene,
	canvasX: number,
	canvasY: number,
	setKanbanDetailId: (id: string | null) => void,
	setKanbanListDetailId: (id: string | null) => void,
): boolean {
	for (const el of scene.getHitTestOrderedElements()) {
		if (el.locked) continue;
		if (!hitTest(el, canvasX, canvasY, { pathTextLabelHitTest })) continue;
		if (isKanbanCard(el) || isKanbanList(el)) {
			return openKanbanFromElement(
				el,
				setKanbanDetailId,
				setKanbanListDetailId,
			);
		}
	}
	return false;
}

function openSelectedKanbanAtPosition(
	selectedIds: Set<string>,
	scene: CanvasScene,
	canvasX: number,
	canvasY: number,
	zoom: number,
	setKanbanDetailId: (id: string | null) => void,
	setKanbanListDetailId: (id: string | null) => void,
): boolean {
	const selectedElements = scene.getSelectedElements(selectedIds);
	const selectedSet = new Set(selectedElements.map((element) => element.id));
	const orderedSelected = scene
		.getHitTestOrderedElements()
		.filter((element) => selectedSet.has(element.id));
	for (const el of orderedSelected) {
		if (el.locked) continue;
		if (
			isKanbanCard(el) &&
			hitTestKanbanSelection(el, canvasX, canvasY, zoom)
		) {
			return openKanbanFromElement(
				el,
				setKanbanDetailId,
				setKanbanListDetailId,
			);
		}
		if (isKanbanList(el) && hitTest(el, canvasX, canvasY)) {
			return openKanbanFromElement(
				el,
				setKanbanDetailId,
				setKanbanListDetailId,
			);
		}
	}
	return false;
}

/**
 * Findet den obersten einfachen Frame, dessen Label (oberhalb der Frame-Kante)
 * am Punkt getroffen wird. Das Label liegt ausserhalb der Frame-BBox und wird
 * deshalb nicht vom regulaeren Hit-Test erfasst.
 */
function getFrameLabelAtPosition(
	scene: CanvasScene,
	canvasX: number,
	canvasY: number,
): CanvasElement | null {
	for (const el of scene.getHitTestOrderedElements()) {
		if (el.locked) continue;
		if (frameLabelHitTest(el, canvasX, canvasY)) return el;
		/*
		 * Liegt ein anderes Element (kein umbenennbarer Frame) an diesem Punkt
		 * weiter oben, gewinnt dieses Element; Frame-Koerper blockieren Labels nicht.
		 */
		if (
			!isCanvasFrameLabelEditable(el) &&
			hitTest(el, canvasX, canvasY, { pathTextLabelHitTest })
		) {
			return null;
		}
	}
	return null;
}

function getSelectedKanbanAtPosition(
	selectedIds: Set<string>,
	scene: CanvasScene,
	canvasX: number,
	canvasY: number,
	zoom: number,
): CanvasElement | null {
	const selectedElements = scene.getSelectedElements(selectedIds);
	const selectedSet = new Set(selectedElements.map((element) => element.id));
	const orderedSelected = scene
		.getHitTestOrderedElements()
		.filter((element) => selectedSet.has(element.id));
	for (const el of orderedSelected) {
		if (el.locked) continue;
		if (isKanbanCard(el) && hitTestKanbanSelection(el, canvasX, canvasY, zoom))
			return el;
		if (isKanbanList(el) && hitTest(el, canvasX, canvasY)) return el;
	}
	return null;
}

export function useCanvasDoubleClick({
	svgRef,
	scene,
	store,
	presentationMode,
	textEditorOpen,
	pointerHandlers,
	handleCommitTextEditor,
	shouldSuppressTextEditOpen,
	setEditingArrowTextSide,
	setKanbanDetailId,
	setKanbanListDetailId,
}: UseCanvasDoubleClickOptions) {
	const getSelectedElementAt = useCallback(
		(canvasX: number, canvasY: number) => {
			const selectedElements = scene.getSelectedElements(store.selectedIds);
			const selectedSet = new Set(
				selectedElements.map((element) => element.id),
			);
			const orderedSelected = scene
				.getHitTestOrderedElements()
				.filter((element) => selectedSet.has(element.id));
			for (const el of orderedSelected) {
				if (el.locked) continue;
				if (hitTest(el, canvasX, canvasY, { pathTextLabelHitTest })) return el;
			}
			return null;
		},
		[scene, store.selectedIds],
	);

	const getEventElement = useCallback(
		(target: EventTarget | null) => {
			if (!(target instanceof Element)) return null;
			const owner = target.closest("[data-element-id]");
			if (!owner) return null;
			const id = owner.getAttribute("data-element-id");
			if (!id) return null;
			return scene.getElement(id);
		},
		[scene],
	);

	const getElementAtPosition = useCallback(
		(canvasX: number, canvasY: number) => {
			return scene.getElementAtPosition(canvasX, canvasY, {
				pathTextLabelHitTest,
			});
		},
		[scene],
	);

	const getKanbanElementAtPosition = useCallback(
		(canvasX: number, canvasY: number) => {
			const selectedHit = getSelectedKanbanAtPosition(
				store.selectedIds,
				scene,
				canvasX,
				canvasY,
				store.viewport.zoom,
			);
			if (selectedHit) return selectedHit;

			for (const el of scene.getHitTestOrderedElements()) {
				if (el.locked) continue;
				if (!hitTest(el, canvasX, canvasY, { pathTextLabelHitTest })) continue;
				if (isKanbanCard(el) || isKanbanList(el)) return el;
			}
			return null;
		},
		[scene, store.selectedIds, store.viewport.zoom],
	);

	const handleDoubleClick = useCallback(
		(e: React.MouseEvent) => {
			if (presentationMode) return;
			if (pointerHandlers.onDoubleClick()) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}
			if (textEditorOpen) {
				handleCommitTextEditor();
				e.preventDefault();
				e.stopPropagation();
				return;
			}
			if (store.activeTool !== "select") return;

			const rect = svgRef.current?.getBoundingClientRect();
			if (!rect) return;
			const canvasX =
				(e.clientX - rect.left - store.viewport.x) / store.viewport.zoom;
			const canvasY =
				(e.clientY - rect.top - store.viewport.y) / store.viewport.zoom;

			/* Structured diagrams reopen their editor instead of a shape text field. */
			const eventElement = getEventElement(e.target);
			const eventPanel = getStructuredToolPanel(eventElement);
			const structuredTool = eventPanel
				? { element: eventElement as CanvasElement, panel: eventPanel }
				: getStructuredToolAtPosition(scene, canvasX, canvasY);
			if (structuredTool) {
				const selectionTarget =
					structuredTool.panel === "gantt"
						? (findGanttChartElement(
								scene.getSortedElements(),
								structuredTool.element,
							) ?? structuredTool.element)
						: structuredTool.element;
				const diagramElements = new Map(
					scene
						.getSortedElements()
						.map((element) => [element.id, element] as const),
				);
				store.setSelectedIds(
					expandCanvasEditorAtomicSelectionIds(
						new Set([selectionTarget.id]),
						diagramElements,
					),
				);
				if (store.activePanel !== structuredTool.panel) {
					store.setActivePanel(structuredTool.panel);
				}
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			/* Selektierte Kanban-Karten zuerst: Griffe/Rand koennen sonst die Liste treffen. */
			if (
				openSelectedKanbanAtPosition(
					store.selectedIds,
					scene,
					canvasX,
					canvasY,
					store.viewport.zoom,
					setKanbanDetailId,
					setKanbanListDetailId,
				)
			) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			/* Kanban per Canvas-Koordinaten (Karten vor Listen; unabhaengig von foreignObject-DOM). */
			if (
				openKanbanAtPosition(
					scene,
					canvasX,
					canvasY,
					setKanbanDetailId,
					setKanbanListDetailId,
				)
			) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			if (shouldSuppressTextEditOpen()) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			/* Doppelklick auf das Frame-Label: Frame-Namen inline umbenennen. */
			const labelFrame = getFrameLabelAtPosition(scene, canvasX, canvasY);
			if (labelFrame) {
				store.setSelectedIds(new Set([labelFrame.id]));
				store.setEditingTextId(labelFrame.id);
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			const targetElement = eventElement;
			if (
				targetElement &&
				openKanbanFromElement(
					targetElement,
					setKanbanDetailId,
					setKanbanListDetailId,
				)
			) {
				return;
			}
			const selectedHit = getSelectedElementAt(canvasX, canvasY);
			if (
				selectedHit &&
				openKanbanFromElement(
					selectedHit,
					setKanbanDetailId,
					setKanbanListDetailId,
				)
			) {
				return;
			}

			for (const el of scene.getHitTestOrderedElements()) {
				if (el.locked) continue;
				/*
				 * Doppelklick in den Frame-Koerper oeffnet keinen Text-Editor mehr:
				 * Umbenennen laeuft ueber das Label, Inhalte ueber die Elemente im Frame.
				 */
				if (isCanvasFrameLabelEditable(el)) continue;
				if (!hitTest(el, canvasX, canvasY, { pathTextLabelHitTest })) continue;
				if (
					openKanbanFromElement(el, setKanbanDetailId, setKanbanListDetailId)
				) {
					return;
				}
				if (el.type === "image") {
					store.setSelectedIds(new Set([el.id]));
					store.setCroppingImageId(el.id);
					return;
				}
				if ((el.type === "arrow" || el.type === "line") && el.points) {
					if (pathTextLabelHitTest(el, canvasX, canvasY)) {
						const customData = readElementCustomData(el.customData);
						setEditingArrowTextSide(
							(customData.arrowTextSide as ArrowTextSide | undefined) ??
								"above",
						);
					} else {
						setEditingArrowTextSide(
							getArrowTextSideFromPoint(
								el.points,
								el.type === "arrow" ? el.arrowMode : undefined,
								canvasX - el.x,
								canvasY - el.y,
							),
						);
					}
				}
				if (isTextEditableElement(el)) {
					store.setEditingTextId(el.id);
					return;
				}
			}
		},
		[
			presentationMode,
			textEditorOpen,
			store,
			scene,
			svgRef,
			getSelectedElementAt,
			getEventElement,
			pointerHandlers,
			handleCommitTextEditor,
			shouldSuppressTextEditOpen,
			setEditingArrowTextSide,
			setKanbanDetailId,
			setKanbanListDetailId,
		],
	);

	return {
		getEventElement,
		getElementAtPosition,
		getKanbanElementAtPosition,
		getSelectedElementAt,
		handleDoubleClick,
	};
}
