import type { BBox } from "./geometry";
import { getCombinedBBox } from "./geometry";
import { type CanvasElement, MAX_ZOOM, MIN_ZOOM, type Viewport } from "./types";

export interface ViewportFitRect {
	width: number;
	height: number;
}

export function computeViewportForBounds(
	svgRect: ViewportFitRect,
	bounds: BBox,
	padding: number,
): Viewport {
	const contentWidth = Math.max(bounds.width, 1);
	const contentHeight = Math.max(bounds.height, 1);
	const availableWidth = Math.max(svgRect.width - padding * 2, 1);
	const availableHeight = Math.max(svgRect.height - padding * 2, 1);
	const zoom = Math.min(
		MAX_ZOOM,
		Math.max(
			MIN_ZOOM,
			Math.min(availableWidth / contentWidth, availableHeight / contentHeight),
		),
	);

	return {
		x: svgRect.width / 2 - (bounds.x + bounds.width / 2) * zoom,
		y: svgRect.height / 2 - (bounds.y + bounds.height / 2) * zoom,
		zoom,
	};
}

export interface CanvasPreviewBounds {
	minX: number;
	minY: number;
	width: number;
	height: number;
}

const DEFAULT_CANVAS_PREVIEW_BOUNDS: CanvasPreviewBounds = {
	minX: 0,
	minY: 0,
	width: 320,
	height: 180,
};

/** Stable padded viewBox bounds for thumbnails and embedded previews. */
export function getCanvasPreviewBounds(
	elements: Iterable<CanvasElement>,
): CanvasPreviewBounds {
	const visibleElements = Array.from(elements).filter(
		(element) => Number.isFinite(element.x) && Number.isFinite(element.y),
	);
	const bounds = getCombinedBBox(visibleElements);
	if (!bounds) return { ...DEFAULT_CANVAS_PREVIEW_BOUNDS };

	const dominantSize = Math.max(bounds.width, bounds.height, 1);
	const padding = Math.min(Math.max(dominantSize * 0.12, 24), 96);
	return {
		minX: bounds.x - padding,
		minY: bounds.y - padding,
		width: Math.max(bounds.width + padding * 2, 120),
		height: Math.max(bounds.height + padding * 2, 80),
	};
}
