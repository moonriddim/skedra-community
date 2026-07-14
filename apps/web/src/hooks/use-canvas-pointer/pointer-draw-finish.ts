/**
 * Zeichnen abschliessen bei PointerUp.
 */

import { CANVAS_DEFAULT_FONT } from "@/lib/canvas/canvas-defaults";
import type { CanvasElement } from "@skedra/canvas-core";
import {
	DEFAULT_FONT_SIZE,
	shouldKeepCanvasDrawing,
} from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import type { useCanvasStore } from "../use-canvas-store";
import type { PointerState } from "./pointer-types";

type CanvasStoreState = ReturnType<typeof useCanvasStore.getState>;

interface DrawFinishContext {
	state: PointerState;
	store: CanvasStoreState;
	drawingPreview: CanvasElement;
	snappedX: number;
	snappedY: number;
	createElement: (el: CanvasElement) => void;
	setDrawingPreview: React.Dispatch<React.SetStateAction<CanvasElement | null>>;
	startTextPlacement: (text: TextPlacementDraft) => void;
}

export interface DrawFinishResult {
	created: boolean;
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
		createElement,
		setDrawingPreview,
		startTextPlacement,
	} = ctx;
	const tool = store.activeTool;
	const id = nanoid();
	let created = false;

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
		if (
			shouldKeepCanvasDrawing({
				...drawingPreview,
				points: state.freehandPoints,
			})
		) {
			createElement({ ...drawingPreview, id, points: state.freehandPoints });
			created = true;
		}
	} else if (tool === "arrow") {
		if (shouldKeepCanvasDrawing(drawingPreview)) {
			createElement({ ...drawingPreview, id });
			created = true;
		}
	} else if (tool === "line") {
		if (shouldKeepCanvasDrawing(drawingPreview)) {
			createElement({ ...drawingPreview, id });
			created = true;
		}
	} else {
		if (shouldKeepCanvasDrawing(drawingPreview)) {
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

	setDrawingPreview(null);
	if (!store.toolLocked) {
		store.setActiveTool("select");
	}

	return { created };
}
