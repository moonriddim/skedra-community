/**
 * Zeichenwerkzeug-Initialisierung bei PointerDown.
 */

import type { CanvasElement } from "@skedra/canvas-core";
import type { useCanvasStore } from "../use-canvas-store";
import type { PointerState } from "./pointer-types";
import {
	buildDrawingPreview,
	buildFreehandPreview,
	buildSingleArrowPreview,
	buildTextBoxPreview,
} from "./preview-builders";

type CanvasStoreState = ReturnType<typeof useCanvasStore.getState>;

interface DrawPointerDownContext {
	tool: string;
	snappedX: number;
	snappedY: number;
	store: CanvasStoreState;
	setDrawingPreview: React.Dispatch<React.SetStateAction<CanvasElement | null>>;
}

export interface DrawPointerDownResult {
	action: "draw";
	patch: Partial<PointerState>;
	capturePointer: boolean;
}

export function handleDrawPointerDown(
	ctx: DrawPointerDownContext,
): DrawPointerDownResult {
	const { tool, snappedX, snappedY, store, setDrawingPreview } = ctx;

	if (tool === "freehand") {
		setDrawingPreview(buildFreehandPreview(snappedX, snappedY, store));
		return {
			action: "draw",
			patch: { action: "draw", freehandPoints: [[0, 0]] },
			capturePointer: true,
		};
	}

	if (tool === "arrow") {
		setDrawingPreview(buildSingleArrowPreview(snappedX, snappedY, store));
		return { action: "draw", patch: { action: "draw" }, capturePointer: true };
	}

	if (tool === "text") {
		setDrawingPreview(buildTextBoxPreview(snappedX, snappedY, store));
		return { action: "draw", patch: { action: "draw" }, capturePointer: true };
	}

	setDrawingPreview(
		buildDrawingPreview(
			tool as CanvasElement["type"],
			snappedX,
			snappedY,
			store,
		),
	);
	return { action: "draw", patch: { action: "draw" }, capturePointer: true };
}
