/**
 * Text-Aenderungen auf Canvas-Elemente anwenden (Inline-Editor).
 */

import {
	mergeElementCustomData,
	readElementCustomData,
} from "@/lib/canvas/custom-data-utils";
import type { ArrowTextOrientation, ArrowTextSide } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";

interface ApplyTextUpdateOptions {
	element: CanvasElement;
	text: string;
	size: { width: number; height: number };
	arrowTextSide: ArrowTextSide | null;
	arrowTextOrientation: ArrowTextOrientation | null;
}

export function buildTextElementUpdate({
	element: el,
	text,
	size,
	arrowTextSide,
	arrowTextOrientation,
}: ApplyTextUpdateOptions): Partial<CanvasElement> {
	const isShape =
		el.type === "rectangle" ||
		el.type === "ellipse" ||
		el.type === "diamond" ||
		el.type === "frame";
	const isCenteredShape =
		el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond";
	const isKanbanListEl = el.customData?.skedraType === "kanban-list";
	const isPathTextElement = el.type === "arrow" || el.type === "line";

	if (isKanbanListEl) {
		return { frameLabel: text };
	}

	if (isPathTextElement) {
		const liveCustomData = readElementCustomData(el.customData);
		return {
			text,
			textColor: el.textColor ?? el.stroke,
			textAlign: "center",
			customData: mergeElementCustomData(el.customData, {
				arrowTextSide:
					arrowTextSide ??
					(liveCustomData.arrowTextSide as ArrowTextSide | undefined) ??
					"above",
				arrowTextOrientation:
					arrowTextOrientation ??
					(liveCustomData.arrowTextOrientation as
						| ArrowTextOrientation
						| undefined) ??
					"horizontal",
			}),
		};
	}

	if (isShape) {
		return {
			text,
			textColor: el.textColor ?? el.stroke,
			...(isCenteredShape ? { textAlign: "center" as const } : {}),
		};
	}

	return {
		text,
		textColor: el.textColor ?? el.stroke,
		width: size.width,
		height: size.height,
	};
}
