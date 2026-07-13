import { TOOL_FONT_FAMILY } from "@/lib/canvas/canvas-defaults";
import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import {
	type CanvasElement,
	createCanvasTemplateElements,
} from "@skedra/canvas-core";
import { templateText } from "./shared";

export function createRetrospectiveTemplate(
	cx: number,
	cy: number,
): CanvasElement[] {
	return createCanvasTemplateElements({
		id: "retrospective",
		x: cx,
		y: cy,
		defaults: getCanvasElementFactoryDefaults(),
		fontFamily: TOOL_FONT_FAMILY,
		text: templateText,
	});
}
