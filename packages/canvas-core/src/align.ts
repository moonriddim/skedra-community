import { getBBox } from "./geometry";
import type { CanvasElement } from "./types";

export type AlignEdge = "top" | "bottom" | "left" | "right";

export function getAlignmentUpdates(
	elements: CanvasElement[],
	edge: AlignEdge,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	if (elements.length < 2) return [];

	const items = elements.map((el) => ({ el, box: getBBox(el) }));

	let target = 0;
	switch (edge) {
		case "top":
			target = Math.min(...items.map((item) => item.box.y));
			return items.map(({ el, box }) => ({
				id: el.id,
				changes: { y: el.y + (target - box.y) },
			}));
		case "bottom":
			target = Math.max(...items.map((item) => item.box.y + item.box.height));
			return items.map(({ el, box }) => ({
				id: el.id,
				changes: { y: el.y + (target - (box.y + box.height)) },
			}));
		case "left":
			target = Math.min(...items.map((item) => item.box.x));
			return items.map(({ el, box }) => ({
				id: el.id,
				changes: { x: el.x + (target - box.x) },
			}));
		case "right":
			target = Math.max(...items.map((item) => item.box.x + item.box.width));
			return items.map(({ el, box }) => ({
				id: el.id,
				changes: { x: el.x + (target - (box.x + box.width)) },
			}));
	}
}
