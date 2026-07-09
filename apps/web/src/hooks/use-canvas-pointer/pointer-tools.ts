/**
 * Radierer und Pipette.
 */

import { pickColorAtPoint } from "@/lib/canvas/color-picker-utils";
import type { CanvasElement, CanvasScene } from "@skedra/canvas-core";
import { ERASER_RADIUS } from "./pointer-types";

export function findElementsToEraseAtPoint(
	scene: CanvasScene,
	x: number,
	y: number,
	alreadyErased: Set<string>,
): string[] {
	return scene
		.getElementsToEraseAtPosition(x, y, ERASER_RADIUS, alreadyErased)
		.map((element) => element.id);
}

export function pickEyedropperColor(
	elements: Map<string, CanvasElement>,
	x: number,
	y: number,
	target: "fill" | "stroke",
): string | null {
	return pickColorAtPoint(elements, x, y, target);
}
