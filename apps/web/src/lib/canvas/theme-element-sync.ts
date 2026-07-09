import {
	type CanvasElement,
	getMindmapNodeMeta,
	isFlowchartNode,
	isMindmapNode,
} from "@skedra/canvas-core";
import {
	CANVAS_HAND_FONT,
	type CanvasThemeState,
	KANBAN_FONT_FAMILY,
	LEGACY_TOOL_FONT_DEFAULTS,
	THEME_FILL_DEFAULTS,
	THEME_MINDMAP_BORDER_DEFAULTS,
	THEME_MINDMAP_CHILD_TEXT_DEFAULTS,
	THEME_MINDMAP_ROOT_STROKE_DEFAULTS,
	THEME_MINDMAP_ROOT_TEXT_DEFAULTS,
	THEME_MUTED_TEXT_DEFAULTS,
	THEME_STROKE_DEFAULTS,
	getDefaultMindmapChildBorder,
	getDefaultMindmapChildTextColor,
	getDefaultMindmapRootFill,
	getDefaultMindmapRootStroke,
	getDefaultMindmapRootTextColor,
	getDefaultMutedTextColor,
	getDefaultNodeFill,
	getDefaultStrokeColor,
} from "./canvas-defaults";

function isThemeDefault(
	value: string | undefined,
	alternatives: readonly string[],
): boolean {
	return value != null && (alternatives as readonly string[]).includes(value);
}

function isHandwritingToolElement(skedraType: unknown): boolean {
	return skedraType === "mindmap-node" || skedraType === "flowchart-node";
}

function isKanbanElement(skedraType: unknown): boolean {
	return skedraType === "kanban-card" || skedraType === "kanban-list";
}

/** Berechnet Theme-Patches fuer ein einzelnes Canvas-Element */
function getThemeElementPatch(
	element: CanvasElement,
	theme?: CanvasThemeState,
): Partial<CanvasElement> | null {
	const changes: Partial<CanvasElement> = {};
	const skedraType = element.customData?.skedraType;

	if (isHandwritingToolElement(skedraType)) {
		if (
			isThemeDefault(element.fontFamily, LEGACY_TOOL_FONT_DEFAULTS) &&
			element.fontFamily !== CANVAS_HAND_FONT
		) {
			changes.fontFamily = CANVAS_HAND_FONT;
		}
	}

	if (isKanbanElement(skedraType) && element.fontFamily === CANVAS_HAND_FONT) {
		changes.fontFamily = KANBAN_FONT_FAMILY;
	}

	if (isMindmapNode(element)) {
		const meta = getMindmapNodeMeta(element);
		const isRoot = meta?.mindmapDepth === 0;

		if (isThemeDefault(element.fill, THEME_FILL_DEFAULTS)) {
			changes.fill = isRoot
				? getDefaultMindmapRootFill(theme)
				: getDefaultNodeFill(theme);
		}

		if (isRoot) {
			if (isThemeDefault(element.stroke, THEME_MINDMAP_ROOT_STROKE_DEFAULTS)) {
				changes.stroke = getDefaultMindmapRootStroke(theme);
			}
			if (isThemeDefault(element.textColor, THEME_MINDMAP_ROOT_TEXT_DEFAULTS)) {
				changes.textColor = getDefaultMindmapRootTextColor(theme);
			}
		} else {
			const branchColor = meta?.mindmapBranchColor;
			const usesBranchStroke =
				typeof branchColor === "string" &&
				branchColor.length > 0 &&
				element.stroke === branchColor;

			if (
				!usesBranchStroke &&
				isThemeDefault(element.stroke, THEME_MINDMAP_BORDER_DEFAULTS)
			) {
				changes.stroke = getDefaultMindmapChildBorder(theme);
			}
			if (
				isThemeDefault(element.textColor, THEME_MINDMAP_CHILD_TEXT_DEFAULTS)
			) {
				changes.textColor = getDefaultMindmapChildTextColor(theme);
			}
		}
	}

	if (
		isFlowchartNode(element) ||
		element.customData?.skedraType === "flowchart-connector"
	) {
		if (isThemeDefault(element.stroke, THEME_STROKE_DEFAULTS)) {
			changes.stroke = getDefaultStrokeColor(theme);
		}
	}

	if (
		element.type === "text" &&
		isThemeDefault(element.stroke, THEME_MUTED_TEXT_DEFAULTS)
	) {
		changes.stroke = getDefaultMutedTextColor(theme);
	}

	return Object.keys(changes).length > 0 ? changes : null;
}

/** Sammelt Theme-Patches fuer alle Canvas-Elemente */
export function collectThemeElementPatches(
	elements: Iterable<CanvasElement>,
	theme?: CanvasThemeState,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const patches: Array<{ id: string; changes: Partial<CanvasElement> }> = [];
	for (const element of elements) {
		const patch = getThemeElementPatch(element, theme);
		if (patch) {
			patches.push({ id: element.id, changes: patch });
		}
	}
	return patches;
}
