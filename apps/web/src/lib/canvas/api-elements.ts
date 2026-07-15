/**
 * Konvertiert API/LLM-Elemente in vollstaendige CanvasElemente.
 */

import type { CanvasThemeState } from "@/lib/canvas/canvas-defaults";
import {
	type CanvasElement,
	createCanvasElementFromBoundsInput,
} from "@skedra/canvas-core";
import type { AddCanvasElementInput } from "@skedra/shared";
import { getCanvasElementFactoryDefaults } from "./canvas-factory-defaults";

export function apiElementsToCanvasElements(
	inputs: AddCanvasElementInput[],
	theme?: CanvasThemeState,
): CanvasElement[] {
	const defaults = getCanvasElementFactoryDefaults(theme);
	return inputs.map((input) =>
		createCanvasElementFromBoundsInput(defaults, {
			...input,
			...(Array.isArray(input.points)
				? { points: input.points as [number, number][] }
				: {}),
		}),
	);
}
