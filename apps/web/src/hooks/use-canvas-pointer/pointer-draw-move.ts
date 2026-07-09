/**
 * Zeichen-Vorschau waehrend PointerMove aktualisieren.
 */

import { calcSnap } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import type { useCanvasStore } from "../use-canvas-store";
import { appendPreviewPoint, computeElbowPoints } from "./path-helpers";
import type { PathDraftState, PointerState } from "./pointer-types";

type CanvasStoreState = ReturnType<typeof useCanvasStore.getState>;

interface DrawMoveContext {
	state: PointerState;
	store: CanvasStoreState;
	snappedX: number;
	snappedY: number;
	canvas: { x: number; y: number };
	shiftKey: boolean;
	elements: Map<string, CanvasElement>;
	pathDraftRef: React.MutableRefObject<PathDraftState | null>;
	setPathPreview: (
		tool: "line" | "arrow",
		absolutePoints: [number, number][],
	) => void;
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
		pathDraftRef,
		setPathPreview,
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

	if (tool === "arrow") {
		if (store.pathDrawMode === "multi") {
			const draftPoints =
				pathDraftRef.current?.tool === "arrow"
					? pathDraftRef.current.points
					: null;
			if (draftPoints) {
				setPathPreview(
					"arrow",
					appendPreviewPoint(
						draftPoints,
						[snappedX, snappedY],
						store.arrowMode,
					),
				);
				return;
			}
		}
		const relX = snappedX - state.startCanvasX;
		const relY = snappedY - state.startCanvasY;
		const mode = store.arrowMode;
		if (mode === "curve") {
			setDrawingPreview((prev) =>
				prev
					? {
							...prev,
							points: [
								[0, 0],
								[relX / 2, relY / 2],
								[relX, relY],
							],
							width: Math.abs(relX),
							height: Math.abs(relY),
						}
					: null,
			);
		} else if (mode === "elbow") {
			const pts = computeElbowPoints(relX, relY);
			setDrawingPreview((prev) =>
				prev
					? {
							...prev,
							points: pts,
							width: Math.abs(relX),
							height: Math.abs(relY),
						}
					: null,
			);
		} else {
			setDrawingPreview((prev) =>
				prev
					? {
							...prev,
							points: [
								[0, 0],
								[relX, relY],
							],
							width: Math.abs(relX),
							height: Math.abs(relY),
						}
					: null,
			);
		}
		return;
	}

	if (tool === "line") {
		if (store.pathDrawMode === "multi") {
			const draftPoints =
				pathDraftRef.current?.tool === "line"
					? pathDraftRef.current.points
					: null;
			if (draftPoints) {
				setPathPreview(
					"line",
					appendPreviewPoint(draftPoints, [snappedX, snappedY]),
				);
				return;
			}
		}
		const relX = snappedX - state.startCanvasX;
		const relY = snappedY - state.startCanvasY;
		setDrawingPreview((prev) =>
			prev
				? {
						...prev,
						points: [
							[0, 0],
							[relX, relY],
						],
						width: Math.abs(relX),
						height: Math.abs(relY),
					}
				: null,
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
