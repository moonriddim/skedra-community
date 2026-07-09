/**
 * Zeichenwerkzeug-Initialisierung bei PointerDown.
 */

import type { CanvasElement } from "@skedra/canvas-core";
import type { useCanvasStore } from "../use-canvas-store";
import { appendPreviewPoint } from "./path-helpers";
import type { PathDraftState, PointerState } from "./pointer-types";
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
	pathDraftRef: React.MutableRefObject<PathDraftState | null>;
	setPathPreview: (
		tool: "line" | "arrow",
		absolutePoints: [number, number][],
	) => void;
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
	const {
		tool,
		snappedX,
		snappedY,
		store,
		pathDraftRef,
		setPathPreview,
		setDrawingPreview,
	} = ctx;

	if (tool === "freehand") {
		setDrawingPreview(buildFreehandPreview(snappedX, snappedY, store));
		return {
			action: "draw",
			patch: { action: "draw", freehandPoints: [[0, 0]] },
			capturePointer: true,
		};
	}

	if (tool === "arrow") {
		if (store.pathDrawMode === "multi") {
			const existingDraft = pathDraftRef.current;
			if (existingDraft?.tool === "arrow") {
				const lastPoint = existingDraft.points[existingDraft.points.length - 1];
				setPathPreview(
					"arrow",
					appendPreviewPoint(existingDraft.points, lastPoint, store.arrowMode),
				);
				return {
					action: "draw",
					patch: {
						action: "draw",
						startCanvasX: lastPoint[0],
						startCanvasY: lastPoint[1],
					},
					capturePointer: true,
				};
			}
			pathDraftRef.current = { tool: "arrow", points: [[snappedX, snappedY]] };
			setPathPreview("arrow", [
				[snappedX, snappedY],
				[snappedX, snappedY],
			]);
			return {
				action: "draw",
				patch: { action: "draw" },
				capturePointer: true,
			};
		}
		setDrawingPreview(buildSingleArrowPreview(snappedX, snappedY, store));
		return { action: "draw", patch: { action: "draw" }, capturePointer: true };
	}

	if (tool === "text") {
		setDrawingPreview(buildTextBoxPreview(snappedX, snappedY, store));
		return { action: "draw", patch: { action: "draw" }, capturePointer: true };
	}

	if (tool === "line" && store.pathDrawMode === "multi") {
		const existingDraft = pathDraftRef.current;
		if (existingDraft?.tool === "line") {
			const lastPoint = existingDraft.points[existingDraft.points.length - 1];
			setPathPreview(
				"line",
				appendPreviewPoint(existingDraft.points, lastPoint),
			);
			return {
				action: "draw",
				patch: {
					action: "draw",
					startCanvasX: lastPoint[0],
					startCanvasY: lastPoint[1],
				},
				capturePointer: true,
			};
		}
		pathDraftRef.current = { tool: "line", points: [[snappedX, snappedY]] };
		setPathPreview("line", [
			[snappedX, snappedY],
			[snappedX, snappedY],
		]);
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
