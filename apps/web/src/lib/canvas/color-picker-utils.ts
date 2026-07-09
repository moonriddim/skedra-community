/**
 * Eyedropper: Farbe von einem Element an einer Canvas-Position auslesen.
 */

import {
	type CanvasElement,
	hitTest,
	sortCanvasElements,
} from "@skedra/canvas-core";

export type EyedropperTarget = "stroke" | "fill";

function isVisibleFill(fill: string | undefined): fill is string {
	return !!fill && fill !== "transparent" && fill !== "none";
}

/** Liefert die sinnvollste Farbe eines Elements fuer Stroke/Fill */
function getElementColor(
	element: CanvasElement,
	target: EyedropperTarget,
): string | null {
	if (target === "fill") {
		if (isVisibleFill(element.fill)) return element.fill;
		if (element.type === "text" && element.textColor) return element.textColor;
		return element.stroke || null;
	}

	if (element.stroke) return element.stroke;
	if (element.type === "text" && element.textColor) return element.textColor;
	if (isVisibleFill(element.fill)) return element.fill;
	return null;
}

/** Topmost Element an Position finden und Farbe zurueckgeben */
export function pickColorAtPoint(
	elements: Map<string, CanvasElement>,
	x: number,
	y: number,
	target: EyedropperTarget,
): string | null {
	const sorted = sortCanvasElements(elements.values()).reverse();

	for (const element of sorted) {
		if (element.locked) continue;
		if (!hitTest(element, x, y)) continue;
		return getElementColor(element, target);
	}

	return null;
}
