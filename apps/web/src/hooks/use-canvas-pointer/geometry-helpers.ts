import type {
	CanvasElement,
	CanvasScene,
	HandlePosition,
} from "@skedra/canvas-core";
import { resizeCanvasElement } from "@skedra/canvas-core";

export function findElementAt(
	scene: CanvasScene,
	x: number,
	y: number,
): CanvasElement | null {
	return scene.getElementAtPosition(x, y);
}

export function calcResize(
	bounds: { x: number; y: number; w: number; h: number },
	handle: HandlePosition,
	dx: number,
	dy: number,
): Partial<CanvasElement> {
	return resizeCanvasElement(
		{ x: bounds.x, y: bounds.y, width: bounds.w, height: bounds.h },
		handle,
		dx,
		dy,
	);
}
