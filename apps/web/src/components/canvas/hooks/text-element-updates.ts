import { CANVAS_DEFAULT_FONT } from "@/lib/canvas/canvas-defaults";
import {
	type ArrowTextOrientation,
	type ArrowTextSide,
	type CanvasElement,
	buildCanvasTextUpdate,
} from "@skedra/canvas-core";

interface ApplyTextUpdateOptions {
	element: CanvasElement;
	text: string;
	size: { width: number; height: number };
	arrowTextSide: ArrowTextSide | null;
	arrowTextOrientation: ArrowTextOrientation | null;
}

export function buildTextElementUpdate(options: ApplyTextUpdateOptions) {
	return buildCanvasTextUpdate({
		...options,
		fontFamily: options.element.fontFamily ?? CANVAS_DEFAULT_FONT,
	});
}
