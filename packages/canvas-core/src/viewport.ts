import type { BBox } from "./geometry";
import { MAX_ZOOM, MIN_ZOOM, type Viewport } from "./types";

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
