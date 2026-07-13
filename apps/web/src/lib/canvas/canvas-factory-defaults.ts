import {
	type CanvasElementFactoryDefaults,
	type CreateMindmapNodeOptions,
	FLOWCHART_DEFAULT_STROKE,
} from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import {
	CANVAS_DEFAULT_FONT,
	type CanvasThemeState,
	KANBAN_FONT_FAMILY,
	TOOL_FONT_FAMILY,
	getDefaultMindmapChildBorder,
	getDefaultMindmapChildTextColor,
	getDefaultMindmapRootFill,
	getDefaultMindmapRootStroke,
	getDefaultMindmapRootTextColor,
	getDefaultNodeFill,
	getDefaultStrokeColor,
} from "./canvas-defaults";

export const createCanvasElementId = nanoid;

export function getCanvasElementFactoryDefaults(
	theme?: CanvasThemeState,
): CanvasElementFactoryDefaults {
	return {
		createId: createCanvasElementId,
		stroke: getDefaultStrokeColor(theme),
		fontFamily: CANVAS_DEFAULT_FONT,
		kanbanFontFamily: KANBAN_FONT_FAMILY,
	};
}

export function getFlowchartThemeStroke(theme?: CanvasThemeState): string {
	return theme?.resolvedTheme === "dark" ? "#e2e8f0" : FLOWCHART_DEFAULT_STROKE;
}

export function getMindmapNodeThemeOptions(
	theme?: CanvasThemeState,
): Pick<
	CreateMindmapNodeOptions,
	| "fontFamily"
	| "rootFill"
	| "nodeFill"
	| "rootStroke"
	| "childBorder"
	| "rootTextColor"
	| "childTextColor"
> {
	return {
		fontFamily: TOOL_FONT_FAMILY,
		rootFill: getDefaultMindmapRootFill(theme),
		nodeFill: getDefaultNodeFill(theme),
		rootStroke: getDefaultMindmapRootStroke(theme),
		childBorder: getDefaultMindmapChildBorder(theme),
		rootTextColor: getDefaultMindmapRootTextColor(theme),
		childTextColor: getDefaultMindmapChildTextColor(theme),
	};
}
