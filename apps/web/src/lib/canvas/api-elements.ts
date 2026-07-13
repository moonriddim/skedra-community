/**
 * Konvertiert API/LLM-Elemente in vollstaendige CanvasElemente.
 */

import {
	type CanvasThemeState,
	getDefaultStrokeColor,
} from "@/lib/canvas/canvas-defaults";
import { type CanvasElement, DEFAULT_FILL } from "@skedra/canvas-core";
import type { AddCanvasElementInput } from "@skedra/shared";
import { nanoid } from "nanoid";

export function apiElementsToCanvasElements(
	inputs: AddCanvasElementInput[],
	theme?: CanvasThemeState,
): CanvasElement[] {
	return inputs.map((input) => ({
		id: input.id ?? nanoid(),
		type: input.type,
		x: input.x,
		y: input.y,
		width: input.width,
		height: input.height,
		rotation: input.rotation ?? 0,
		fill: input.fill ?? DEFAULT_FILL,
		stroke: input.stroke ?? getDefaultStrokeColor(theme),
		strokeWidth: input.strokeWidth ?? 2,
		strokeStyle: "solid" as const,
		opacity: input.opacity ?? 100,
		locked: false,
		groupId: null,
		stackIndex: input.stackIndex,
		flipX: false,
		flipY: false,
		...(input.text !== undefined ? { text: input.text } : {}),
		...(input.fontSize !== undefined ? { fontSize: input.fontSize } : {}),
		...(input.fontWeight !== undefined ? { fontWeight: input.fontWeight } : {}),
		...(input.textAlign !== undefined ? { textAlign: input.textAlign } : {}),
		...(input.textColor !== undefined ? { textColor: input.textColor } : {}),
		...(input.frameId !== undefined ? { frameId: input.frameId } : {}),
		...(input.frameLabel !== undefined ? { frameLabel: input.frameLabel } : {}),
		...(input.cornerRadius !== undefined
			? { cornerRadius: input.cornerRadius }
			: {}),
		...(input.cornerRadiusPercent !== undefined
			? { cornerRadiusPercent: input.cornerRadiusPercent }
			: {}),
		...(input.arrowHeadScale !== undefined
			? { arrowHeadScale: input.arrowHeadScale }
			: {}),
		...(input.arrowHeadFilled !== undefined
			? { arrowHeadFilled: input.arrowHeadFilled }
			: {}),
		...(input.customData !== undefined ? { customData: input.customData } : {}),
		...("points" in input && Array.isArray(input.points)
			? { points: input.points as [number, number][] }
			: {}),
	}));
}
