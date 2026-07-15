import type { CanvasElement, Viewport } from "./types";

export interface BBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

export function getUntransformedBBox(el: CanvasElement): BBox {
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

export function getCanvasElementCenter(el: CanvasElement): {
	x: number;
	y: number;
} {
	return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
}

/** Applies the same centered flip/rotation order used by the SVG renderer. */
export function transformCanvasElementPoint(
	el: CanvasElement,
	point: { x: number; y: number },
): { x: number; y: number } {
	const center = getCanvasElementCenter(el);
	let dx = point.x - center.x;
	let dy = point.y - center.y;
	if (el.flipX) dx = -dx;
	if (el.flipY) dy = -dy;
	if (!el.rotation) return { x: center.x + dx, y: center.y + dy };
	const radians = (el.rotation * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	return {
		x: center.x + dx * cos - dy * sin,
		y: center.y + dx * sin + dy * cos,
	};
}

/** Maps a rendered canvas point back into the element's untransformed space. */
export function inverseTransformCanvasElementPoint(
	el: CanvasElement,
	point: { x: number; y: number },
): { x: number; y: number } {
	const center = getCanvasElementCenter(el);
	let dx = point.x - center.x;
	let dy = point.y - center.y;
	if (el.rotation) {
		const radians = (-el.rotation * Math.PI) / 180;
		const cos = Math.cos(radians);
		const sin = Math.sin(radians);
		const rotatedX = dx * cos - dy * sin;
		const rotatedY = dx * sin + dy * cos;
		dx = rotatedX;
		dy = rotatedY;
	}
	if (el.flipX) dx = -dx;
	if (el.flipY) dy = -dy;
	return { x: center.x + dx, y: center.y + dy };
}

export function getBBox(el: CanvasElement): BBox {
	const bbox = getUntransformedBBox(el);
	if (!el.rotation) return bbox;
	const corners = [
		{ x: bbox.x, y: bbox.y },
		{ x: bbox.x + bbox.width, y: bbox.y },
		{ x: bbox.x + bbox.width, y: bbox.y + bbox.height },
		{ x: bbox.x, y: bbox.y + bbox.height },
	].map((point) => transformCanvasElementPoint(el, point));
	const minX = Math.min(...corners.map((point) => point.x));
	const minY = Math.min(...corners.map((point) => point.y));
	const maxX = Math.max(...corners.map((point) => point.x));
	const maxY = Math.max(...corners.map((point) => point.y));
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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
