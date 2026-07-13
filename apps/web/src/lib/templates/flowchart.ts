import {
	type CanvasThemeState,
	TOOL_FONT_FAMILY,
} from "@/lib/canvas/canvas-defaults";
import {
	getCanvasElementFactoryDefaults,
	getFlowchartThemeStroke,
} from "@/lib/canvas/canvas-factory-defaults";
import {
	type CanvasElement,
	createCanvasTemplateElements,
} from "@skedra/canvas-core";
import { templateText } from "./shared";

export function createFlowchartTemplate(
	cx: number,
	cy: number,
	strokeOrOptions?: string | { stroke?: string; theme?: CanvasThemeState },
): CanvasElement[] {
	const theme =
		typeof strokeOrOptions === "string" ? undefined : strokeOrOptions?.theme;
	return createCanvasTemplateElements({
		id: "flowchart",
		x: cx,
		y: cy,
		defaults: getCanvasElementFactoryDefaults(theme),
		fontFamily: TOOL_FONT_FAMILY,
		flowchartStroke:
			typeof strokeOrOptions === "string"
				? strokeOrOptions
				: (strokeOrOptions?.stroke ?? getFlowchartThemeStroke(theme)),
		text: templateText,
	});
}
