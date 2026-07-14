/**
 * Verschiebe-Geste: Position-Updates inkl. Snap, Frame-Kinder, Mindmap-Kanten.
 */

import {
	buildCanvasMoveUpdates,
	buildCanvasPathPointChanges,
	calcSnap,
} from "@skedra/canvas-core";
import type { SnapGuide } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import type { PointerState } from "./pointer-types";

export function buildMoveGestureUpdates(
	state: PointerState,
	elements: Map<string, CanvasElement>,
	selectedIds: Set<string>,
	snappedX: number,
	snappedY: number,
	snapToObjects: boolean,
	setSnapGuides: (guides: SnapGuide[]) => void,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	let dx = snappedX - state.startCanvasX;
	let dy = snappedY - state.startCanvasY;

	if (snapToObjects) {
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		for (const [id, start] of state.moveStart) {
			const el = elements.get(id);
			if (!el) continue;
			minX = Math.min(minX, start.x + dx);
			minY = Math.min(minY, start.y + dy);
			maxX = Math.max(maxX, start.x + dx + el.width);
			maxY = Math.max(maxY, start.y + dy + el.height);
		}
		if (minX < Number.POSITIVE_INFINITY) {
			const snap = calcSnap(
				{ x: minX, y: minY, width: maxX - minX, height: maxY - minY },
				elements,
				selectedIds,
			);
			dx += snap.dx;
			dy += snap.dy;
			setSnapGuides(snap.guides);
		}
	}

	return buildCanvasMoveUpdates(elements, state.moveStart, dx, dy);
}

export function buildDragPointUpdate(
	state: PointerState,
	elements: Map<string, CanvasElement>,
	snappedX: number,
	snappedY: number,
	snapToObjects: boolean,
	setSnapGuides: (guides: SnapGuide[]) => void,
): { id: string; changes: Partial<CanvasElement> } | null {
	if (!state.dragPointElementId) return null;

	const dx = snappedX - state.startCanvasX;
	const dy = snappedY - state.startCanvasY;
	const el = elements.get(state.dragPointElementId);
	if (!el?.points) return null;

	let newPx = state.dragPointStart[0] + dx;
	let newPy = state.dragPointStart[1] + dy;

	if (snapToObjects) {
		const absPx = el.x + newPx;
		const absPy = el.y + newPy;
		const snap = calcSnap(
			{ x: absPx - 1, y: absPy - 1, width: 2, height: 2 },
			elements,
			new Set([state.dragPointElementId]),
		);
		newPx += snap.dx;
		newPy += snap.dy;
		setSnapGuides(snap.guides);
	}

	const changes = buildCanvasPathPointChanges(el, state.dragPointIndex, [
		newPx,
		newPy,
	]);
	return changes ? { id: state.dragPointElementId, changes } : null;
}
