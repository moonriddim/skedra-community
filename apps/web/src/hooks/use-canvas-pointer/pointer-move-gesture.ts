/**
 * Verschiebe-Geste: Position-Updates inkl. Snap, Frame-Kinder, Mindmap-Kanten.
 */

import {
	buildMindmapEdgeChanges,
	collectConnectedMindmapEdgeIds,
	getMindmapEdgeMeta,
} from "@skedra/canvas-core";
import { calcSnap } from "@skedra/canvas-core";
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

	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];
	const movedIds = new Set(state.moveStart.keys());
	const virtualElements = new Map(elements);

	for (const [id, start] of state.moveStart) {
		const nextX = start.x + dx;
		const nextY = start.y + dy;
		updates.push({ id, changes: { x: nextX, y: nextY } });
		const current = virtualElements.get(id);
		if (current) {
			virtualElements.set(id, { ...current, x: nextX, y: nextY });
		}
	}

	for (const [id] of state.moveStart) {
		const el = elements.get(id);
		if (el?.type === "frame") {
			for (const [childId, child] of elements) {
				if (child.frameId === id && !movedIds.has(childId)) {
					if (!state.moveStart.has(childId)) {
						state.moveStart.set(childId, { x: child.x, y: child.y });
					}
					const cStart = state.moveStart.get(childId);
					if (!cStart) continue;
					const nextX = cStart.x + dx;
					const nextY = cStart.y + dy;
					updates.push({ id: childId, changes: { x: nextX, y: nextY } });
					virtualElements.set(childId, { ...child, x: nextX, y: nextY });
					movedIds.add(childId);
				}
			}
		}
	}

	const connectedEdgeIds = collectConnectedMindmapEdgeIds(movedIds, elements);
	for (const edgeId of connectedEdgeIds) {
		const edge = elements.get(edgeId);
		const meta = getMindmapEdgeMeta(edge);
		if (!meta) continue;
		const source = virtualElements.get(meta.mindmapSourceId);
		const target = virtualElements.get(meta.mindmapTargetId);
		if (!source || !target) continue;
		updates.push({
			id: edgeId,
			changes: buildMindmapEdgeChanges(source, target),
		});
	}

	return updates;
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

	const newPoints = el.points.map((p, i) =>
		i === state.dragPointIndex ? ([newPx, newPy] as [number, number]) : p,
	);
	return { id: state.dragPointElementId, changes: { points: newPoints } };
}
