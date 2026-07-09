import type {
	CanvasElement,
	CanvasScene,
	HandlePosition,
} from "@skedra/canvas-core";

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
	let { x, y, w, h } = bounds;

	switch (handle) {
		case "se":
			w += dx;
			h += dy;
			break;
		case "s":
			h += dy;
			break;
		case "e":
			w += dx;
			break;
		case "nw":
			x += dx;
			y += dy;
			w -= dx;
			h -= dy;
			break;
		case "n":
			y += dy;
			h -= dy;
			break;
		case "ne":
			y += dy;
			w += dx;
			h -= dy;
			break;
		case "w":
			x += dx;
			w -= dx;
			break;
		case "sw":
			x += dx;
			w -= dx;
			h += dy;
			break;
	}

	if (w < 5) {
		w = 5;
	}
	if (h < 5) {
		h = 5;
	}

	return { x, y, width: w, height: h };
}
