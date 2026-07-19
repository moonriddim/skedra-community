/**
 * Selektions- und Verschiebe-Logik bei PointerDown (Select/Lasso-Tool).
 */

import { createStackIndexAfter } from "@skedra/canvas-core";
import { getGanttCanvasScrollbarThumbMeta } from "@skedra/canvas-core";
import { getGanttChartId } from "@skedra/canvas-core";
import { getSequenceDiagramId } from "@skedra/canvas-core";
import { isKanbanCard, isKanbanList } from "@skedra/canvas-core";
import { isMultiSelectModifier } from "@skedra/canvas-core";
import type { CanvasElement, CanvasScene } from "@skedra/canvas-core";

export interface CanvasEditorPointerSelectionState {
	action: "move" | "select-box" | "select-lasso";
	moveStart: Map<string, { x: number; y: number }>;
}

export interface CanvasEditorSelectPointerEvent {
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
}

export interface CanvasEditorSelectPointerDownContext {
	e: CanvasEditorSelectPointerEvent;
	tool: string;
	canvas: { x: number; y: number };
	elements: Map<string, CanvasElement>;
	scene: CanvasScene;
	selectedIds: Set<string>;
	getSelectedIds: () => Set<string>;
	readOnly?: boolean;
	updateElement: (id: string, updates: Partial<CanvasElement>) => void;
	duplicateSelection?: () => void;
	setSelectedIds: (ids: Set<string>) => void;
	setSelectionBox: (
		box: { startX: number; startY: number; endX: number; endY: number } | null,
	) => void;
	setLassoPath: (path: [number, number][] | null) => void;
}

export type CanvasEditorSelectPointerDownResult =
	| { handled: true; earlyExit: true }
	| {
			handled: true;
			action: "move" | "select-box" | "select-lasso";
			patch: Partial<CanvasEditorPointerSelectionState>;
	  }
	| { handled: false };

/**
 * Structured diagrams are atomic canvas objects. Selecting any generated part
 * expands to the complete diagram so lines, labels and shapes cannot drift
 * apart during move, duplicate, delete, or context-menu operations.
 */
export function expandCanvasEditorAtomicSelectionIds(
	selectedIds: ReadonlySet<string>,
	elements: ReadonlyMap<string, CanvasElement>,
) {
	const expanded = new Set(selectedIds);
	const ganttChartIds = new Set<string>();
	const sequenceDiagramIds = new Set<string>();
	for (const id of selectedIds) {
		const chartId = getGanttChartId(elements.get(id));
		if (chartId) ganttChartIds.add(chartId);
		const diagramId = getSequenceDiagramId(elements.get(id));
		if (diagramId) sequenceDiagramIds.add(diagramId);
	}
	if (ganttChartIds.size === 0 && sequenceDiagramIds.size === 0)
		return expanded;
	for (const [id, element] of elements) {
		const chartId = getGanttChartId(element);
		if (chartId && ganttChartIds.has(chartId)) expanded.add(id);
		const scrollbarThumb = getGanttCanvasScrollbarThumbMeta(element);
		if (scrollbarThumb && ganttChartIds.has(scrollbarThumb.ganttChartId)) {
			expanded.add(id);
		}
		const diagramId = getSequenceDiagramId(element);
		if (diagramId && sequenceDiagramIds.has(diagramId)) expanded.add(id);
	}
	return expanded;
}

/**
 * Expands a context-click target to the canonical selection a host should
 * mutate: its group, or its complete frame relationship.
 */
export function getCanvasEditorContextSelectionIds(
	target: CanvasElement,
	elements: ReadonlyMap<string, CanvasElement>,
) {
	const ids = expandCanvasEditorAtomicSelectionIds(
		new Set([target.id]),
		elements,
	);
	if (getGanttChartId(target) || getSequenceDiagramId(target)) return ids;
	if (target.groupId) {
		for (const [id, element] of elements) {
			if (element.groupId === target.groupId) ids.add(id);
		}
		return ids;
	}
	if (target.type === "frame") {
		for (const [id, element] of elements) {
			if (element.frameId === target.id) ids.add(id);
		}
		return ids;
	}
	if (target.frameId) {
		ids.add(target.frameId);
		for (const [id, element] of elements) {
			if (element.frameId === target.frameId) ids.add(id);
		}
	}
	return ids;
}

/** Keeps an existing context selection, expands a new target, or clears it. */
export function resolveCanvasEditorContextSelectionIds(
	target: CanvasElement | null,
	elements: ReadonlyMap<string, CanvasElement>,
	selectedIds: ReadonlySet<string>,
) {
	if (!target) return new Set<string>();
	if (selectedIds.has(target.id)) {
		return expandCanvasEditorAtomicSelectionIds(selectedIds, elements);
	}
	return getCanvasEditorContextSelectionIds(target, elements);
}

export function resolveCanvasEditorSelectPointerDown(
	ctx: CanvasEditorSelectPointerDownContext,
): CanvasEditorSelectPointerDownResult {
	const {
		e,
		tool,
		canvas,
		elements,
		scene,
		selectedIds,
		getSelectedIds,
		readOnly = false,
		updateElement,
		duplicateSelection,
		setSelectedIds,
		setSelectionBox,
		setLassoPath,
	} = ctx;

	const hit = scene.getElementAtPosition(canvas.x, canvas.y);
	if (hit) {
		const ganttChartId = getGanttChartId(hit);
		const sequenceDiagramId = getSequenceDiagramId(hit);
		const isAtomicDiagramHit = Boolean(ganttChartId || sequenceDiagramId);
		const atomicHitIds = expandCanvasEditorAtomicSelectionIds(
			new Set([hit.id]),
			elements,
		);
		if (
			e.altKey &&
			!isAtomicDiagramHit &&
			hit.groupId &&
			!isMultiSelectModifier(e)
		) {
			setSelectedIds(new Set([hit.id]));
			return { handled: true, earlyExit: true };
		}

		let selectionForMove = new Set(selectedIds);
		if (isMultiSelectModifier(e)) {
			if (selectionForMove.has(hit.id)) {
				for (const id of atomicHitIds) selectionForMove.delete(id);
			} else {
				for (const id of atomicHitIds) selectionForMove.add(id);
			}
			selectionForMove = expandCanvasEditorAtomicSelectionIds(
				selectionForMove,
				elements,
			);
			setSelectedIds(selectionForMove);
		} else if (selectedIds.has(hit.id)) {
			selectionForMove = expandCanvasEditorAtomicSelectionIds(
				selectedIds,
				elements,
			);
			setSelectedIds(selectionForMove);
		} else if (isAtomicDiagramHit) {
			selectionForMove = atomicHitIds;
			setSelectedIds(selectionForMove);
		} else if (hit.groupId) {
			selectionForMove = new Set([hit.id]);
			for (const [cId, cEl] of elements) {
				if (cEl.groupId === hit.groupId) selectionForMove.add(cId);
			}
			setSelectedIds(selectionForMove);
		} else if (isKanbanCard(hit) || isKanbanList(hit)) {
			selectionForMove = new Set([hit.id]);
			setSelectedIds(selectionForMove);
		} else if (!selectedIds.has(hit.id)) {
			selectionForMove = new Set([hit.id]);
			if (hit.type === "frame") {
				for (const [cId, cEl] of elements) {
					if (cEl.frameId === hit.id) selectionForMove.add(cId);
				}
			}
			if (hit.frameId) {
				selectionForMove.add(hit.frameId);
				for (const [cId, cEl] of elements) {
					if (cEl.frameId === hit.frameId) selectionForMove.add(cId);
				}
			}
			if (hit.groupId) {
				for (const [cId, cEl] of elements) {
					if (cEl.groupId === hit.groupId) selectionForMove.add(cId);
				}
			}
			setSelectedIds(selectionForMove);
		}

		if (readOnly || (hit.locked && !isAtomicDiagramHit)) {
			return { handled: true, earlyExit: true };
		}

		if (e.altKey && duplicateSelection) {
			duplicateSelection();
			selectionForMove = expandCanvasEditorAtomicSelectionIds(
				getSelectedIds(),
				elements,
			);
		}

		if (isKanbanCard(hit)) {
			updateElement(hit.id, {
				stackIndex: createStackIndexAfter(elements.values(), hit.id),
			});
		}

		const moveStart = new Map<string, { x: number; y: number }>();
		for (const id of selectionForMove) {
			const el = elements.get(id);
			if (el) moveStart.set(id, { x: el.x, y: el.y });
		}
		if (!moveStart.has(hit.id)) {
			moveStart.set(hit.id, { x: hit.x, y: hit.y });
		}

		return {
			handled: true,
			action: "move",
			patch: { action: "move", moveStart },
		};
	}

	if (!isMultiSelectModifier(e)) {
		setSelectedIds(new Set());
	}
	const useLasso = tool === "lasso" || (tool === "select" && e.altKey);
	if (useLasso) {
		setSelectionBox(null);
		setLassoPath([[canvas.x, canvas.y]]);
		return {
			handled: true,
			action: "select-lasso",
			patch: { action: "select-lasso" },
		};
	}

	setLassoPath(null);
	setSelectionBox({
		startX: canvas.x,
		startY: canvas.y,
		endX: canvas.x,
		endY: canvas.y,
	});
	return {
		handled: true,
		action: "select-box",
		patch: { action: "select-box" },
	};
}
