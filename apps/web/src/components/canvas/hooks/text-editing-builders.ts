/** Community localization/font adapter for the shared inline-editing session. */

import {
	CANVAS_DEFAULT_FONT,
	KANBAN_FONT_FAMILY,
	TOOL_FONT_FAMILY,
} from "@/lib/canvas/canvas-defaults";
import type {
	ArrowTextOrientation,
	ArrowTextSide,
	CanvasElement,
} from "@skedra/canvas-core";
import {
	type CanvasEditorEditingSession,
	buildCanvasEditorEditingSession,
} from "@skedra/canvas-editor";

export type EditingTextSession = CanvasEditorEditingSession;

interface BuildEditingTextSessionOptions {
	element: CanvasElement;
	arrowTextSide: ArrowTextSide | null;
	arrowTextOrientation: ArrowTextOrientation | null;
	translate: (key: string) => string;
}

export function buildEditingTextSession({
	element,
	arrowTextSide,
	arrowTextOrientation,
	translate,
}: BuildEditingTextSessionOptions): EditingTextSession {
	return buildCanvasEditorEditingSession({
		element,
		arrowTextSide,
		arrowTextOrientation,
		defaultFontFamily: CANVAS_DEFAULT_FONT,
		kanbanFontFamily: KANBAN_FONT_FAMILY,
		toolFontFamily: TOOL_FONT_FAMILY,
		textPlaceholder: translate("canvas.textPlaceholder"),
		arrowTextPlaceholder: translate("canvas.arrowTextPlaceholder"),
	});
}
