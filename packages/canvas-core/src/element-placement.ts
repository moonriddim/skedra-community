import { type BBox, getCombinedBBox } from "./geometry";
import type { CanvasElement } from "./types";

export interface ElementPlacementDraft {
	elements: CanvasElement[];
	bounds: BBox;
}

export function createElementPlacementDraft(
	elements: CanvasElement[],
): ElementPlacementDraft | null {
	const bounds = getCombinedBBox(elements);
	return bounds ? { elements, bounds } : null;
}

/** Move the whole template, including locked parts, without changing its links. */
export function placeElementDraft(
	draft: ElementPlacementDraft,
	centerX: number,
	centerY: number,
): CanvasElement[] {
	const dx = centerX - draft.bounds.x - draft.bounds.width / 2;
	const dy = centerY - draft.bounds.y - draft.bounds.height / 2;
	return draft.elements.map((element) => ({
		...element,
		x: element.x + dx,
		y: element.y + dy,
	}));
}
