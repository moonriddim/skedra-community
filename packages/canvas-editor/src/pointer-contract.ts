import type { CanvasPathDrawMode } from "@skedra/canvas-core";
import type { CanvasEditorToolId } from "./editor-contract";

export type CanvasEditorPointerAction =
	| "ignore"
	| "pan"
	| "select"
	| "lasso"
	| "draw"
	| "path"
	| "text"
	| "erase"
	| "laser"
	| "eyedropper"
	| "insert-sticky-note"
	| "insert-kanban"
	| "insert-mindmap";

export type CanvasEditorPointerGestureAction =
	| "none"
	| "draw"
	| "select-box"
	| "select-lasso"
	| "move"
	| "pan"
	| "resize"
	| "drag-point"
	| "erase"
	| "laser";

/** Normal pointer-up releases capture after the gesture has already been reset. */
export function shouldCancelCanvasEditorLostPointerCapture(
	action: CanvasEditorPointerGestureAction,
): boolean {
	return action !== "none";
}

interface CanvasEditorPointerBehavior {
	action: Exclude<CanvasEditorPointerAction, "ignore" | "path">;
	availableReadOnly: boolean;
}

const CANVAS_EDITOR_POINTER_BEHAVIORS: Record<
	CanvasEditorToolId,
	CanvasEditorPointerBehavior
> = {
	select: { action: "select", availableReadOnly: true },
	lasso: { action: "lasso", availableReadOnly: true },
	pan: { action: "pan", availableReadOnly: true },
	rectangle: { action: "draw", availableReadOnly: false },
	diamond: { action: "draw", availableReadOnly: false },
	ellipse: { action: "draw", availableReadOnly: false },
	arrow: { action: "draw", availableReadOnly: false },
	line: { action: "draw", availableReadOnly: false },
	freehand: { action: "draw", availableReadOnly: false },
	text: { action: "text", availableReadOnly: false },
	frame: { action: "draw", availableReadOnly: false },
	eraser: { action: "erase", availableReadOnly: false },
	laser: { action: "laser", availableReadOnly: true },
	eyedropper: { action: "eyedropper", availableReadOnly: true },
	"sticky-note": { action: "insert-sticky-note", availableReadOnly: false },
	kanban: { action: "insert-kanban", availableReadOnly: false },
	mindmap: { action: "insert-mindmap", availableReadOnly: false },
};

export function isCanvasEditorToolAvailableReadOnly(
	tool: CanvasEditorToolId,
): boolean {
	return CANVAS_EDITOR_POINTER_BEHAVIORS[tool].availableReadOnly;
}

export interface ResolveCanvasEditorPointerDownOptions {
	tool: CanvasEditorToolId;
	button: number;
	altKey?: boolean;
	spacePressed?: boolean;
	readOnly?: boolean;
	pathDrawMode?: CanvasPathDrawMode;
	/** Web supports a middle-click anchor placement for eligible drawing tools. */
	allowMiddleButtonDraw?: boolean;
}

/**
 * Resolves browser pointer input to one editor action for every host surface.
 * Host adapters own persistence and coordinate conversion, not tool routing.
 */
export function resolveCanvasEditorPointerDown({
	tool,
	button,
	altKey = false,
	spacePressed = false,
	readOnly = false,
	pathDrawMode = "normal",
	allowMiddleButtonDraw = false,
}: ResolveCanvasEditorPointerDownOptions): CanvasEditorPointerAction {
	if (button === 1 && !allowMiddleButtonDraw) return "pan";
	if (button !== 0 && !(button === 1 && allowMiddleButtonDraw)) return "ignore";
	if (spacePressed) return "pan";

	const behavior = CANVAS_EDITOR_POINTER_BEHAVIORS[tool];
	if (readOnly && !behavior.availableReadOnly) return "ignore";
	if (behavior.action === "select" && altKey) return "lasso";
	if (
		behavior.action === "draw" &&
		(tool === "line" || tool === "arrow") &&
		pathDrawMode === "multi"
	) {
		return "path";
	}
	return behavior.action;
}
