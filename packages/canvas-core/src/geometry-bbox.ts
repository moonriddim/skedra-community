import type { CanvasElement, Viewport } from "./types";

export interface BBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

export function getBBox(el: CanvasElement): BBox {
	if (
		(el.type === "line" || el.type === "arrow" || el.type === "freehand") &&
		el.points &&
		el.points.length > 0
	) {
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;

		for (const [px, py] of el.points) {
			const ax = el.x + px;
			const ay = el.y + py;
			if (ax < minX) minX = ax;
			if (ay < minY) minY = ay;
			if (ax > maxX) maxX = ax;
			if (ay > maxY) maxY = ay;
		}

		return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
	}

	return { x: el.x, y: el.y, width: el.width, height: el.height };
}

export function getCombinedBBox(elements: CanvasElement[]): BBox | null {
	if (elements.length === 0) return null;

	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const el of elements) {
		const bb = getBBox(el);
		if (bb.x < minX) minX = bb.x;
		if (bb.y < minY) minY = bb.y;
		if (bb.x + bb.width > maxX) maxX = bb.x + bb.width;
		if (bb.y + bb.height > maxY) maxY = bb.y + bb.height;
	}

	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function bboxInRect(
	bbox: BBox,
	rx: number,
	ry: number,
	rw: number,
	rh: number,
): boolean {
	return (
		bbox.x >= rx &&
		bbox.y >= ry &&
		bbox.x + bbox.width <= rx + rw &&
		bbox.y + bbox.height <= ry + rh
	);
}

export function getVisibleCanvasBounds(
	viewport: Viewport,
	svgWidth: number,
	svgHeight: number,
	padding = 96,
): BBox {
	const zoom = Math.max(viewport.zoom, 0.01);
	return {
		x: -viewport.x / zoom - padding,
		y: -viewport.y / zoom - padding,
		width: svgWidth / zoom + padding * 2,
		height: svgHeight / zoom + padding * 2,
	};
}

function intersectsBBox(a: BBox, b: BBox) {
	return (
		a.x < b.x + b.width &&
		a.x + a.width > b.x &&
		a.y < b.y + b.height &&
		a.y + a.height > b.y
	);
}

export function isElementVisibleInViewport(
	element: CanvasElement,
	visibleBounds: BBox,
	selectedIds: Set<string>,
) {
	if (selectedIds.has(element.id)) return true;
	return intersectsBBox(getBBox(element), visibleBounds);
}
