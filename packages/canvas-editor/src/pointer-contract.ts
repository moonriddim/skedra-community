import {
	type CanvasPathDrawMode,
	type Viewport,
	zoomCanvasViewportAtPoint,
} from "@skedra/canvas-core";
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
	| "rotate"
	| "drag-point"
	| "erase"
	| "laser";

/** Tap-like tools commit on touch-up so a second finger can start Pinch safely. */
export function shouldDeferCanvasEditorTouchAction(
	action: CanvasEditorPointerAction,
): boolean {
	return (
		action === "eyedropper" ||
		action === "insert-sticky-note" ||
		action === "insert-kanban" ||
		action === "insert-mindmap"
	);
}

/** Restores the original Web UX: every vertical wheel gesture zooms at the pointer. */
export function resolveCanvasEditorWheelViewport(
	viewport: Viewport,
	pointer: { x: number; y: number },
	deltaY: number,
): Viewport {
	if (deltaY === 0) return viewport;
	return zoomCanvasViewportAtPoint(
		viewport,
		pointer,
		viewport.zoom * (deltaY > 0 ? 0.92 : 1.08),
	);
}

export interface CanvasEditorScreenPoint {
	x: number;
	y: number;
}

export interface CanvasEditorTouchRegistration {
	startedMultiTouch: boolean;
	isMultiTouch: boolean;
}

export interface CanvasEditorTouchRelease {
	wasMultiTouch: boolean;
	remainingPointers: number;
}

export interface CanvasEditorTouchSession {
	register: (
		pointerId: number,
		point: CanvasEditorScreenPoint,
	) => CanvasEditorTouchRegistration;
	move: (pointerId: number, point: CanvasEditorScreenPoint) => boolean;
	release: (pointerId: number) => CanvasEditorTouchRelease;
	clear: () => void;
	get: (pointerId: number) => CanvasEditorScreenPoint | undefined;
	has: (pointerId: number) => boolean;
	isEmpty: () => boolean;
	isMultiTouch: () => boolean;
	entries: () => Array<[number, CanvasEditorScreenPoint]>;
}

/**
 * Stateful touch arbitration shared by every editor host. Multi-touch remains
 * active until every finger has lifted, preventing the remaining finger from
 * accidentally starting a new edit after a pinch.
 */
export function createCanvasEditorTouchSession(): CanvasEditorTouchSession {
	const pointers = new Map<number, CanvasEditorScreenPoint>();
	let multiTouch = false;

	return {
		register(pointerId, point) {
			pointers.set(pointerId, point);
			const startedMultiTouch = !multiTouch && pointers.size >= 2;
			if (startedMultiTouch) multiTouch = true;
			return { startedMultiTouch, isMultiTouch: multiTouch };
		},
		move(pointerId, point) {
			if (!pointers.has(pointerId)) return false;
			pointers.set(pointerId, point);
			return true;
		},
		release(pointerId) {
			const wasMultiTouch = multiTouch;
			pointers.delete(pointerId);
			if (pointers.size === 0) multiTouch = false;
			return { wasMultiTouch, remainingPointers: pointers.size };
		},
		clear() {
			pointers.clear();
			multiTouch = false;
		},
		get: (pointerId) => pointers.get(pointerId),
		has: (pointerId) => pointers.has(pointerId),
		isEmpty: () => pointers.size === 0,
		isMultiTouch: () => multiTouch,
		entries: () => [...pointers.entries()],
	};
}

export type CanvasEditorPinchPoints = readonly [
	CanvasEditorScreenPoint,
	CanvasEditorScreenPoint,
];

/**
 * Resolves a two-finger gesture from its initial points and viewport.
 * The canvas position below the initial midpoint stays below the moving
 * midpoint, so zooming and panning can happen in one natural gesture.
 */
export function resolveCanvasEditorPinchViewport(
	viewport: Viewport,
	start: CanvasEditorPinchPoints,
	current: CanvasEditorPinchPoints,
): Viewport {
	const startCenter = {
		x: (start[0].x + start[1].x) / 2,
		y: (start[0].y + start[1].y) / 2,
	};
	const currentCenter = {
		x: (current[0].x + current[1].x) / 2,
		y: (current[0].y + current[1].y) / 2,
	};
	const startDistance = Math.hypot(
		start[1].x - start[0].x,
		start[1].y - start[0].y,
	);
	const currentDistance = Math.hypot(
		current[1].x - current[0].x,
		current[1].y - current[0].y,
	);
	const nextZoom =
		startDistance > 0
			? viewport.zoom * (currentDistance / startDistance)
			: viewport.zoom;
	const zoomed = zoomCanvasViewportAtPoint(viewport, startCenter, nextZoom);

	return {
		...zoomed,
		x: zoomed.x + currentCenter.x - startCenter.x,
		y: zoomed.y + currentCenter.y - startCenter.y,
	};
}

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
	triangle: { action: "draw", availableReadOnly: false },
	cloud: { action: "draw", availableReadOnly: false },
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
	/** Host supports a middle-button snap for eligible drawing tools. */
	allowMiddleButtonDraw?: boolean;
}

/** Uses a tentative middle-button snap for exactly one primary data point. */
export function resolveCanvasEditorTentativeDataPoint<T>(options: {
	button: number;
	tentative: T | null;
	resolveCurrent: () => T;
}): { point: T; nextTentative: T | null } {
	if (options.button === 0 && options.tentative) {
		return { point: options.tentative, nextTentative: null };
	}
	return {
		point: options.resolveCurrent(),
		nextTentative: options.tentative,
	};
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
	const behavior = CANVAS_EDITOR_POINTER_BEHAVIORS[tool];
	const middleButtonDraw =
		button === 1 && allowMiddleButtonDraw && behavior.action === "draw";
	if (button === 1 && !middleButtonDraw) return "pan";
	if (button !== 0 && !middleButtonDraw) return "ignore";
	if (spacePressed) return "pan";

	if (readOnly && !behavior.availableReadOnly) return "ignore";
	if (behavior.action === "select" && altKey) return "lasso";
	if (
		behavior.action === "draw" &&
		(tool === "line" || tool === "arrow" || tool === "cloud") &&
		pathDrawMode === "multi"
	) {
		return "path";
	}
	return behavior.action;
}
