import type {
	BBox,
	HandlePosition,
	SavedCanvasView,
	Viewport,
} from "@skedra/canvas-core";

export const CANVAS_EDITOR_VIEW_PADDING = 96;
export const CANVAS_EDITOR_MIN_VIEW_SIZE = 48;

export type CanvasEditorViewInteractionState = {
	mode: "create" | "move" | "resize";
	pointerId: number;
	startCanvasX: number;
	startCanvasY: number;
	viewId: string | null;
	startBounds: BBox;
	handle: HandlePosition | null;
} | null;

export function isCanvasEditorViewInteractionPointer(
	interaction: CanvasEditorViewInteractionState,
	pointerId: number,
): interaction is NonNullable<CanvasEditorViewInteractionState> {
	return interaction?.pointerId === pointerId;
}

export function orderCanvasEditorSavedViews(
	views: Iterable<SavedCanvasView>,
): SavedCanvasView[] {
	return Array.from(views).sort(
		(a, b) =>
			(a.order ?? a.createdAt) - (b.order ?? b.createdAt) ||
			a.createdAt - b.createdAt,
	);
}

export function normalizeCanvasEditorViewBounds(
	startX: number,
	startY: number,
	endX: number,
	endY: number,
): BBox {
	return {
		x: Math.min(startX, endX),
		y: Math.min(startY, endY),
		width: Math.abs(endX - startX),
		height: Math.abs(endY - startY),
	};
}

export function resizeCanvasEditorViewBounds(
	bounds: BBox,
	handle: HandlePosition,
	dx: number,
	dy: number,
): BBox {
	let left = bounds.x;
	let right = bounds.x + bounds.width;
	let top = bounds.y;
	let bottom = bounds.y + bounds.height;

	if (handle.includes("w")) {
		left = Math.min(left + dx, right - CANVAS_EDITOR_MIN_VIEW_SIZE);
	}
	if (handle.includes("e")) {
		right = Math.max(right + dx, left + CANVAS_EDITOR_MIN_VIEW_SIZE);
	}
	if (handle.includes("n")) {
		top = Math.min(top + dy, bottom - CANVAS_EDITOR_MIN_VIEW_SIZE);
	}
	if (handle.includes("s")) {
		bottom = Math.max(bottom + dy, top + CANVAS_EDITOR_MIN_VIEW_SIZE);
	}

	return {
		x: left,
		y: top,
		width: right - left,
		height: bottom - top,
	};
}

export function constrainCanvasEditorViewBoundsToAspectRatio(
	bounds: BBox,
	aspectRatio: number,
	handle: HandlePosition = "se",
): BBox {
	if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return bounds;
	let width = Math.max(bounds.width, CANVAS_EDITOR_MIN_VIEW_SIZE);
	let height = Math.max(bounds.height, CANVAS_EDITOR_MIN_VIEW_SIZE);
	if (handle === "n" || handle === "s") {
		width = height * aspectRatio;
	} else if (handle === "e" || handle === "w") {
		height = width / aspectRatio;
	} else if (width / height > aspectRatio) {
		height = width / aspectRatio;
	} else {
		width = height * aspectRatio;
	}

	let x = bounds.x;
	let y = bounds.y;
	if (handle.includes("w")) x = bounds.x + bounds.width - width;
	if (handle.includes("n")) y = bounds.y + bounds.height - height;
	if (handle === "e" || handle === "w") {
		y = bounds.y + (bounds.height - height) / 2;
	}
	if (handle === "n" || handle === "s") {
		x = bounds.x + (bounds.width - width) / 2;
	}
	return { x, y, width, height };
}

export function getCanvasEditorCapturedViewBounds(
	bounds: BBox,
	presentationPreparationMode: boolean,
): BBox {
	return presentationPreparationMode
		? constrainCanvasEditorViewBoundsToAspectRatio(bounds, 16 / 9)
		: bounds;
}

export function getCanvasEditorViewResizeAspectRatio(
	aspectRatio: SavedCanvasView["aspectRatio"],
	presentationPreparationMode: boolean,
): number | null {
	if (!presentationPreparationMode || aspectRatio === "free") return null;
	return aspectRatio === "4:3" ? 4 / 3 : 16 / 9;
}

export function areCanvasEditorViewportsEqual(
	left: Viewport | null,
	right: Viewport | null,
): boolean {
	if (!left && !right) return true;
	if (!left || !right) return false;
	return left.x === right.x && left.y === right.y && left.zoom === right.zoom;
}
