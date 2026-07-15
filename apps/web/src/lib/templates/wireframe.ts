import { TOOL_FONT_FAMILY } from "@/lib/canvas/canvas-defaults";
import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import {
	type CanvasElement,
	createCanvasTemplateElements,
} from "@skedra/canvas-core";
import { templateText } from "./shared";

export function createWireframeTemplate(
	cx: number,
	cy: number,
): CanvasElement[] {
	return createCanvasTemplateElements({
		id: "wireframe",
		x: cx,
		y: cy,
		defaults: getCanvasElementFactoryDefaults(),
		fontFamily: TOOL_FONT_FAMILY,
		text: templateText,
	});
}
