/**
 * Selektions- und Verschiebe-Logik bei PointerDown (Select/Lasso-Tool).
 */

import { createStackIndexAfter } from "@skedra/canvas-core";
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
 * Expands a context-click target to the canonical selection a host should
 * mutate: its group, or its complete frame relationship.
 */
export function getCanvasEditorContextSelectionIds(
	target: CanvasElement,
	elements: ReadonlyMap<string, CanvasElement>,
) {
	const ids = new Set([target.id]);
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
	if (selectedIds.has(target.id)) return new Set(selectedIds);
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
		if (e.altKey && hit.groupId && !isMultiSelectModifier(e)) {
			setSelectedIds(new Set([hit.id]));
			return { handled: true, earlyExit: true };
		}

		let selectionForMove = new Set(selectedIds);
		if (isMultiSelectModifier(e)) {
			if (selectionForMove.has(hit.id)) selectionForMove.delete(hit.id);
			else selectionForMove.add(hit.id);
			setSelectedIds(selectionForMove);
		} else if (selectedIds.has(hit.id)) {
			selectionForMove = new Set(selectedIds);
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

		if (readOnly || hit.locked) {
			return { handled: true, earlyExit: true };
		}

		if (e.altKey && duplicateSelection) {
			duplicateSelection();
			selectionForMove = new Set(getSelectedIds());
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
