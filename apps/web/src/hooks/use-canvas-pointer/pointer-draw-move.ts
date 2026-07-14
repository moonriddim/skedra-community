/**
 * Zeichen-Vorschau waehrend PointerMove aktualisieren.
 */

import { type CanvasElement, calcSnap } from "@skedra/canvas-core";
import type { useCanvasStore } from "../use-canvas-store";
import type { PointerState } from "./pointer-types";
import { buildSinglePathPreview } from "./preview-builders";

type CanvasStoreState = ReturnType<typeof useCanvasStore.getState>;

interface DrawMoveContext {
	state: PointerState;
	store: CanvasStoreState;
	snappedX: number;
	snappedY: number;
	canvas: { x: number; y: number };
	shiftKey: boolean;
	elements: Map<string, CanvasElement>;
	setDrawingPreview: React.Dispatch<React.SetStateAction<CanvasElement | null>>;
}

export function updateDrawingPreviewOnMove(ctx: DrawMoveContext): void {
	const {
		state,
		store,
		snappedX,
		snappedY,
		canvas,
		shiftKey,
		elements,
		setDrawingPreview,
	} = ctx;
	const tool = store.activeTool;

	if (tool === "freehand") {
		const relX = canvas.x - state.startCanvasX;
		const relY = canvas.y - state.startCanvasY;
		state.freehandPoints.push([relX, relY]);
		setDrawingPreview((prev) =>
			prev ? { ...prev, points: [...state.freehandPoints] } : null,
		);
		return;
	}

	if (tool === "arrow" || tool === "line") {
		setDrawingPreview(
			buildSinglePathPreview(
				tool,
				state.startCanvasX,
				state.startCanvasY,
				snappedX,
				snappedY,
				store,
			),
		);
		return;
	}

	const constrainAspect =
		shiftKey &&
		(tool === "rectangle" || tool === "ellipse" || tool === "diamond");
	let dx = snappedX - state.startCanvasX;
	let dy = snappedY - state.startCanvasY;

	if (constrainAspect) {
		const size = Math.max(Math.abs(dx), Math.abs(dy));
		dx = Math.sign(dx || 1) * size;
		dy = Math.sign(dy || 1) * size;
	}

	let x = 0;
	let y = 0;
	let w = 0;
	let h = 0;

	if (state.drawFromCenter) {
		w = Math.abs(dx) * 2;
		h = Math.abs(dy) * 2;
		x = state.startCanvasX - w / 2;
		y = state.startCanvasY - h / 2;
	} else {
		const endX = state.startCanvasX + dx;
		const endY = state.startCanvasY + dy;
		x = Math.min(state.startCanvasX, endX);
		y = Math.min(state.startCanvasY, endY);
		w = Math.abs(dx);
		h = Math.abs(dy);
	}

	if (store.snapToObjects) {
		const snap = calcSnap(
			{ x, y, width: w, height: h },
			elements,
			new Set(["__preview"]),
		);
		x += snap.dx;
		y += snap.dy;
		w = Math.abs(w);
		h = Math.abs(h);
		store.setSnapGuides(snap.guides);
	}

	setDrawingPreview((prev) =>
		prev ? { ...prev, x, y, width: w, height: h } : null,
	);
}
