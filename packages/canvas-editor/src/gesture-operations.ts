import {
	type CanvasElement,
	type SnapGuide,
	buildCanvasMoveUpdates,
	buildCanvasPathPointChanges,
	calcSnap,
} from "@skedra/canvas-core";

export interface CanvasEditorMoveGestureOptions {
	elements: Map<string, CanvasElement>;
	moveStart: Map<string, { x: number; y: number }>;
	selectedIds: Set<string>;
	start: { x: number; y: number };
	current: { x: number; y: number };
	snapToObjects: boolean;
	/** The grabbed snap base point already resolved to an exact target anchor. */
	anchorSnapped?: boolean;
}

export function resolveCanvasEditorMoveGesture({
	elements,
	moveStart,
	selectedIds,
	start,
	current,
	snapToObjects,
	anchorSnapped = false,
}: CanvasEditorMoveGestureOptions): {
	updates: Array<{ id: string; changes: Partial<CanvasElement> }>;
	guides: SnapGuide[];
} {
	let dx = current.x - start.x;
	let dy = current.y - start.y;
	let guides: SnapGuide[] = [];

	if (snapToObjects && !anchorSnapped) {
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		for (const [id, origin] of moveStart) {
			const element = elements.get(id);
			if (!element) continue;
			minX = Math.min(minX, origin.x + dx);
			minY = Math.min(minY, origin.y + dy);
			maxX = Math.max(maxX, origin.x + dx + element.width);
			maxY = Math.max(maxY, origin.y + dy + element.height);
		}
		if (Number.isFinite(minX)) {
			const snap = calcSnap(
				{ x: minX, y: minY, width: maxX - minX, height: maxY - minY },
				elements,
				selectedIds,
			);
			dx += snap.dx;
			dy += snap.dy;
			guides = snap.guides;
		}
	}

	return {
		updates: buildCanvasMoveUpdates(elements, moveStart, dx, dy),
		guides,
	};
}

export interface CanvasEditorPathPointGestureOptions {
	elements: Map<string, CanvasElement>;
	elementId: string;
	pointIndex: number;
	pointStart: [number, number];
	start: { x: number; y: number };
	current: { x: number; y: number };
	snapToObjects: boolean;
}

export function resolveCanvasEditorPathPointGesture({
	elements,
	elementId,
	pointIndex,
	pointStart,
	start,
	current,
	snapToObjects,
}: CanvasEditorPathPointGestureOptions): {
	update: { id: string; changes: Partial<CanvasElement> } | null;
	guides: SnapGuide[];
} {
	const element = elements.get(elementId);
	if (!element?.points) return { update: null, guides: [] };
	let x = pointStart[0] + current.x - start.x;
	let y = pointStart[1] + current.y - start.y;
	let guides: SnapGuide[] = [];
	if (snapToObjects) {
		const snap = calcSnap(
			{ x: element.x + x - 1, y: element.y + y - 1, width: 2, height: 2 },
			elements,
			new Set([elementId]),
		);
		x += snap.dx;
		y += snap.dy;
		guides = snap.guides;
	}
	const changes = buildCanvasPathPointChanges(element, pointIndex, [x, y]);
	return {
		update: changes ? { id: elementId, changes } : null,
		guides,
	};
}
