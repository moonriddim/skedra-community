import type { CanvasThemeState } from "@/lib/canvas/canvas-defaults";
import {
	getCanvasElementFactoryDefaults,
	getMindmapNodeThemeOptions,
} from "@/lib/canvas/canvas-factory-defaults";
import {
	type CanvasElement,
	createCanvasTemplateElements,
} from "@skedra/canvas-core";
import { templateText } from "./shared";

export function createMindmapTemplate(
	cx: number,
	cy: number,
	theme?: CanvasThemeState,
): CanvasElement[] {
	return createCanvasTemplateElements({
		id: "mindmap",
		x: cx,
		y: cy,
		defaults: getCanvasElementFactoryDefaults(theme),
		mindmapAppearance: getMindmapNodeThemeOptions(theme),
		text: templateText,
	});
}
