/**
 * Mehrpunkt-Pfad-Zeichnen (Linie/Pfeil im Multi-Modus).
 */

import type { CanvasElement } from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef } from "react";
import { useCanvasStore, useCanvasStoreRef } from "../use-canvas-store";
import {
	buildPathElement,
	buildPathPreview,
	dedupeSequentialPoints,
} from "./path-helpers";
import type { PathDraftState } from "./pointer-types";

interface UsePathDraftOptions {
	createElement: (el: CanvasElement) => void;
	stopUndoCapture?: () => void;
	drawingPreview: CanvasElement | null;
	setDrawingPreview: React.Dispatch<React.SetStateAction<CanvasElement | null>>;
	clearSnapVisuals: () => void;
}

export function usePathDraft({
	createElement,
	stopUndoCapture,
	drawingPreview,
	setDrawingPreview,
	clearSnapVisuals,
}: UsePathDraftOptions) {
	const activeTool = useCanvasStore((state) => state.activeTool);
	const storeRef = useCanvasStoreRef();
	const pathDraftRef = useRef<PathDraftState | null>(null);

	const setPathPreview = useCallback(
		(tool: "line" | "arrow", absolutePoints: [number, number][]) => {
			const store = storeRef.current;
			setDrawingPreview(buildPathPreview(tool, absolutePoints, store));
		},
		[setDrawingPreview, storeRef],
	);

	const resetPathDraft = useCallback(() => {
		pathDraftRef.current = null;
		setDrawingPreview((prev) => (prev ? null : prev));
		clearSnapVisuals();
	}, [clearSnapVisuals, setDrawingPreview]);

	const finalizePathDraft = useCallback(() => {
		const draft = pathDraftRef.current;
		if (!draft) return false;

		const points = dedupeSequentialPoints(draft.points);
		if (points.length < 2) {
			resetPathDraft();
			return true;
		}

		const store = storeRef.current;
		const element = buildPathElement(draft.tool, points, store);
		const id = nanoid();
		createElement({ ...element, id });
		store.clearSelection();
		stopUndoCapture?.();
		resetPathDraft();
		if (!store.toolLocked) {
			store.setActiveTool("select");
		}
		return true;
	}, [createElement, resetPathDraft, stopUndoCapture, storeRef]);

	useEffect(() => {
		if (activeTool === "line" || activeTool === "arrow") {
			return;
		}

		const {
			snapGuides,
			setSnapGuides,
			snapPointIndicators,
			setSnapPointIndicators,
		} = useCanvasStore.getState();
		const hasPathPreview =
			drawingPreview?.type === "line" || drawingPreview?.type === "arrow";
		if (pathDraftRef.current || hasPathPreview) {
			resetPathDraft();
			return;
		}

		if (!drawingPreview && snapGuides.length > 0) {
			setSnapGuides([]);
		}
		if (!drawingPreview && snapPointIndicators.length > 0) {
			setSnapPointIndicators([]);
		}
	}, [activeTool, drawingPreview, resetPathDraft]);

	return {
		pathDraftRef,
		setPathPreview,
		resetPathDraft,
		finalizePathDraft,
	};
}
