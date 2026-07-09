/**
 * Selektions- und Verschiebe-Logik bei PointerDown (Select/Lasso-Tool).
 */

import {
	collectMindmapDescendantIds,
	isMindmapNode,
} from "@skedra/canvas-core";
import { createStackIndexAfter } from "@skedra/canvas-core";
import { isKanbanCard, isKanbanList } from "@skedra/canvas-core";
import { isMultiSelectModifier } from "@skedra/canvas-core";
import type { CanvasElement, CanvasScene } from "@skedra/canvas-core";
import { findElementAt } from "./geometry-helpers";
import type { PointerState } from "./pointer-types";

interface SelectPointerDownContext {
	e: React.PointerEvent;
	tool: string;
	canvas: { x: number; y: number };
	elements: Map<string, CanvasElement>;
	scene: CanvasScene;
	selectedIds: Set<string>;
	getSelectedIds: () => Set<string>;
	activePointIndex: number | null;
	activeHandle: PointerState["resizeHandle"];
	updateElement: (id: string, updates: Partial<CanvasElement>) => void;
	duplicateSelection?: () => void;
	setSelectedIds: (ids: Set<string>) => void;
	setSelectionBox: (
		box: { startX: number; startY: number; endX: number; endY: number } | null,
	) => void;
	setLassoPath: (path: [number, number][] | null) => void;
}

export type SelectPointerDownResult =
	| { handled: true; earlyExit: true }
	| {
			handled: true;
			action: "drag-point" | "resize" | "move" | "select-box" | "select-lasso";
			patch: Partial<PointerState>;
	  }
	| { handled: false };

export function handleSelectPointerDown(
	ctx: SelectPointerDownContext,
): SelectPointerDownResult {
	const {
		e,
		tool,
		canvas,
		elements,
		scene,
		selectedIds,
		getSelectedIds,
		activePointIndex,
		activeHandle,
		updateElement,
		duplicateSelection,
		setSelectedIds,
		setSelectionBox,
		setLassoPath,
	} = ctx;

	if (activePointIndex !== null && activePointIndex >= 0) {
		const selectedId = Array.from(selectedIds)[0];
		const el = selectedId ? scene.getElement(selectedId) : undefined;
		if (el?.points && activePointIndex < el.points.length) {
			return {
				handled: true,
				action: "drag-point",
				patch: {
					action: "drag-point",
					dragPointElementId: el.id,
					dragPointIndex: activePointIndex,
					dragPointStart: [...el.points[activePointIndex]],
				},
			};
		}
	}

	if (activeHandle) {
		const selected = scene.getSelectedElements(selectedIds);
		if (selected.length > 0) {
			const bb = scene.getElementBBox(selected[0]);
			return {
				handled: true,
				action: "resize",
				patch: {
					action: "resize",
					resizeHandle: activeHandle,
					resizeStartBBox: { x: bb.x, y: bb.y, w: bb.width, h: bb.height },
				},
			};
		}
	}

	const hit = findElementAt(scene, canvas.x, canvas.y);
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
		for (const id of Array.from(moveStart.keys())) {
			const el = elements.get(id);
			if (!isMindmapNode(el)) continue;
			for (const descendantId of collectMindmapDescendantIds(id, elements)) {
				if (moveStart.has(descendantId)) continue;
				const descendant = elements.get(descendantId);
				if (descendant) {
					moveStart.set(descendantId, { x: descendant.x, y: descendant.y });
				}
			}
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
