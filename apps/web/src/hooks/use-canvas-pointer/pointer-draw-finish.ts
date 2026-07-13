/**
 * Zeichnen abschliessen bei PointerUp.
 */

import { CANVAS_DEFAULT_FONT } from "@/lib/canvas/canvas-defaults";
import type { CanvasElement } from "@skedra/canvas-core";
import { DEFAULT_FONT_SIZE } from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import type { useCanvasStore } from "../use-canvas-store";
import { appendPreviewPoint, commitPathPoint } from "./path-helpers";
import type { PathDraftState, PointerState } from "./pointer-types";

type CanvasStoreState = ReturnType<typeof useCanvasStore.getState>;

interface DrawFinishContext {
	state: PointerState;
	store: CanvasStoreState;
	drawingPreview: CanvasElement;
	snappedX: number;
	snappedY: number;
	pathDraftRef: React.MutableRefObject<PathDraftState | null>;
	createElement: (el: CanvasElement) => void;
	setPathPreview: (
		tool: "line" | "arrow",
		absolutePoints: [number, number][],
	) => void;
	setDrawingPreview: React.Dispatch<React.SetStateAction<CanvasElement | null>>;
	startTextPlacement: (text: TextPlacementDraft) => void;
}

export interface DrawFinishResult {
	created: boolean;
	/** Multi-Punkt-Pfad: Vorschau bleibt aktiv */
	keepPathPreview: boolean;
}

interface TextPlacementDraft {
	x: number;
	y: number;
	width: number;
	height: number;
	stroke: string;
	fontSize: number;
	fontFamily: string;
	textAlign: "left" | "center" | "right";
	fontWeight: "normal" | "bold";
	fontStyle: "normal" | "italic";
	textDecoration: "none" | "underline";
}

export function finalizeDrawOnPointerUp(
	ctx: DrawFinishContext,
): DrawFinishResult {
	const {
		state,
		store,
		drawingPreview,
		snappedX,
		snappedY,
		pathDraftRef,
		createElement,
		setPathPreview,
		setDrawingPreview,
		startTextPlacement,
	} = ctx;
	const tool = store.activeTool;
	const id = nanoid();
	let created = false;
	let keepPathPreview = false;

	if (tool === "text") {
		const w = Math.max(100, drawingPreview.width);
		const h = Math.max(40, drawingPreview.height);
		startTextPlacement({
			x: drawingPreview.x,
			y: drawingPreview.y,
			width: w,
			height: h,
			stroke: drawingPreview.stroke,
			fontSize: drawingPreview.fontSize ?? DEFAULT_FONT_SIZE,
			fontFamily: drawingPreview.fontFamily ?? CANVAS_DEFAULT_FONT,
			textAlign: "left",
			fontWeight: "normal",
			fontStyle: "normal",
			textDecoration: "none",
		});
	} else if (tool === "freehand") {
		if (state.freehandPoints.length > 2) {
			createElement({ ...drawingPreview, id, points: state.freehandPoints });
			created = true;
		}
	} else if (tool === "arrow") {
		if (store.pathDrawMode === "multi") {
			const draft = pathDraftRef.current;
			if (draft?.tool === "arrow") {
				const nextPoints = commitPathPoint(
					draft.points,
					[snappedX, snappedY],
					store.arrowMode,
				);
				pathDraftRef.current = { ...draft, points: nextPoints };
				setPathPreview(
					"arrow",
					appendPreviewPoint(
						nextPoints,
						nextPoints[nextPoints.length - 1],
						store.arrowMode,
					),
				);
				keepPathPreview = true;
			}
		} else {
			const pts = drawingPreview.points;
			if (pts && pts.length >= 2) {
				const last = pts[pts.length - 1];
				if (Math.abs(last[0]) > 3 || Math.abs(last[1]) > 3) {
					createElement({ ...drawingPreview, id });
					created = true;
				}
			}
		}
	} else if (tool === "line") {
		if (store.pathDrawMode === "multi") {
			const draft = pathDraftRef.current;
			if (draft?.tool === "line") {
				const nextPoints = commitPathPoint(draft.points, [snappedX, snappedY]);
				pathDraftRef.current = { ...draft, points: nextPoints };
				setPathPreview(
					"line",
					appendPreviewPoint(nextPoints, nextPoints[nextPoints.length - 1]),
				);
				keepPathPreview = true;
			}
		} else {
			const pts = drawingPreview.points;
			if (pts && pts.length >= 2) {
				const [, end] = pts;
				if (Math.abs(end[0]) > 3 || Math.abs(end[1]) > 3) {
					createElement({ ...drawingPreview, id });
					created = true;
				}
			}
		}
	} else {
		if (drawingPreview.width > 3 && drawingPreview.height > 3) {
			createElement({ ...drawingPreview, id });
			created = true;
		} else if (tool === "ellipse") {
			const presetWidth = Math.max(1, store.shapePresetWidth);
			const presetHeight = Math.max(1, store.shapePresetHeight);
			createElement({
				...drawingPreview,
				id,
				x: state.startCanvasX - presetWidth / 2,
				y: state.startCanvasY - presetHeight / 2,
				width: presetWidth,
				height: presetHeight,
			});
			created = true;
		}
	}

	if (!keepPathPreview) {
		if (tool !== "line" && tool !== "arrow") {
			setDrawingPreview(null);
			if (!store.toolLocked) {
				store.setActiveTool("select");
			}
		} else if (store.pathDrawMode === "normal") {
			setDrawingPreview(null);
			if (!store.toolLocked) {
				store.setActiveTool("select");
			}
		}
	}

	return { created, keepPathPreview };
}
