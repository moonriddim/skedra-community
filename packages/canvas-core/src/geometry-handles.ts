import type { BBox } from "./geometry-bbox";
import type { HandlePosition } from "./types";

export function getHandlePosition(
	bbox: BBox,
	handle: HandlePosition,
): { x: number; y: number } {
	const { x, y, width: w, height: h } = bbox;

	switch (handle) {
		case "nw":
			return { x, y };
		case "n":
			return { x: x + w / 2, y };
		case "ne":
			return { x: x + w, y };
		case "w":
			return { x, y: y + h / 2 };
		case "e":
			return { x: x + w, y: y + h / 2 };
		case "sw":
			return { x, y: y + h };
		case "s":
			return { x: x + w / 2, y: y + h };
		case "se":
			return { x: x + w, y: y + h };
	}
}
