/**
 * Rubber-Band- und Lasso-Selektion abschliessen.
 */

import {
	collectCanvasSelectionRectIds,
	isLassoPathLargeEnough,
	isMultiSelectModifier,
} from "@skedra/canvas-core";
import type { CanvasScene } from "@skedra/canvas-core";

export function collectSelectionBoxIds(
	scene: CanvasScene,
	box: { startX: number; startY: number; endX: number; endY: number },
): Set<string> {
	return collectCanvasSelectionRectIds(
		scene.getElementsMap().values(),
		{ x: box.startX, y: box.startY },
		{ x: box.endX, y: box.endY },
	);
}

export function collectLassoSelectionIds(
	scene: CanvasScene,
	path: [number, number][],
): Set<string> | null {
	if (!isLassoPathLargeEnough(path)) return null;

	return new Set(
		scene.getElementsInLassoPath(path).map((element) => element.id),
	);
}

export function mergeSelectionIds(
	event: React.PointerEvent | React.MouseEvent,
	currentSelection: Set<string>,
	newIds: Set<string>,
): Set<string> {
	if (!isMultiSelectModifier(event)) return newIds;
	const merged = new Set(currentSelection);
	for (const id of newIds) merged.add(id);
	return merged;
}
