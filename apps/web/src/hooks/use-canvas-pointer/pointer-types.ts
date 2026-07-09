import type { HandlePosition } from "@skedra/canvas-core";

export interface PointerState {
	startScreenX: number;
	startScreenY: number;
	startCanvasX: number;
	startCanvasY: number;
	action:
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
	freehandPoints: [number, number][];
	moveStart: Map<string, { x: number; y: number }>;
	resizeHandle: HandlePosition | null;
	resizeStartBBox: { x: number; y: number; w: number; h: number } | null;
	dragPointElementId: string | null;
	dragPointIndex: number;
	dragPointStart: [number, number];
	drawFromCenter: boolean;
	erasedIds: Set<string>;
	laserTrailId: string | null;
}

export interface PathDraftState {
	tool: "line" | "arrow";
	points: [number, number][];
}

export const ERASER_RADIUS = 18;
export const LASSO_POINT_MIN_DISTANCE = 2;

const INITIAL_POINTER_STATE: PointerState = {
	startScreenX: 0,
	startScreenY: 0,
	startCanvasX: 0,
	startCanvasY: 0,
	action: "none",
	freehandPoints: [],
	moveStart: new Map(),
	resizeHandle: null,
	resizeStartBBox: null,
	dragPointElementId: null,
	dragPointIndex: -1,
	dragPointStart: [0, 0],
	drawFromCenter: false,
	erasedIds: new Set(),
	laserTrailId: null,
};
