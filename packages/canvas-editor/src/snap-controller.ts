import {
	type CanvasElement,
	type SnapAnchor,
	type SnapGuide,
	type SnapPointIndicator,
	calcSnap,
	findClosestSnapAnchor,
	getVisibleSnapPointIndicators,
} from "@skedra/canvas-core";

export interface CanvasEditorSnapOptions {
	enabled: boolean;
	includeCenters?: boolean;
	includeMidpoints?: boolean;
	showInactivePoints?: boolean;
}

export interface CanvasEditorPointSnapResult {
	point: { x: number; y: number };
	anchor: SnapAnchor | null;
	guides: SnapGuide[];
	indicators: SnapPointIndicator[];
}

export function resolveCanvasEditorPointSnap(options: {
	point: { x: number; y: number };
	elements: Map<string, CanvasElement>;
	excludeIds?: Set<string>;
	snap: CanvasEditorSnapOptions;
	forceAnchor?: boolean;
}): CanvasEditorPointSnapResult {
	const { point, elements, snap } = options;
	const excludeIds = options.excludeIds ?? new Set<string>();
	if (!snap.enabled) {
		return { point, anchor: null, guides: [], indicators: [] };
	}
	const pointOptions = {
		includeCenters: snap.includeCenters ?? true,
		includeMidpoints: snap.includeMidpoints ?? true,
	};
	const anchor = findClosestSnapAnchor(
		point,
		elements,
		excludeIds,
		pointOptions,
		options.forceAnchor ? 18 : undefined,
	);
	const indicators = getVisibleSnapPointIndicators(
		point,
		elements,
		excludeIds,
		pointOptions,
		anchor,
		snap.showInactivePoints ?? true,
	);
	if (anchor) {
		return {
			point: { x: anchor.x, y: anchor.y },
			anchor,
			guides: [],
			indicators,
		};
	}
	const aligned = calcSnap(
		{ x: point.x - 1, y: point.y - 1, width: 2, height: 2 },
		elements,
		excludeIds,
	);
	return {
		point: { x: point.x + aligned.dx, y: point.y + aligned.dy },
		anchor: null,
		guides: aligned.guides,
		indicators,
	};
}

export function resolveCanvasEditorRectSnap(options: {
	rect: { x: number; y: number; width: number; height: number };
	elements: Map<string, CanvasElement>;
	excludeIds?: Set<string>;
	snap: CanvasEditorSnapOptions;
}): CanvasEditorPointSnapResult & {
	rect: { x: number; y: number; width: number; height: number };
} {
	const { rect, elements, snap } = options;
	const excludeIds = options.excludeIds ?? new Set<string>();
	if (!snap.enabled) {
		return {
			rect,
			point: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
			anchor: null,
			guides: [],
			indicators: [],
		};
	}
	const aligned = calcSnap(rect, elements, excludeIds);
	const snappedRect = {
		...rect,
		x: rect.x + aligned.dx,
		y: rect.y + aligned.dy,
	};
	const point = {
		x: snappedRect.x + snappedRect.width / 2,
		y: snappedRect.y + snappedRect.height / 2,
	};
	const pointOptions = {
		includeCenters: snap.includeCenters ?? true,
		includeMidpoints: snap.includeMidpoints ?? true,
	};
	const anchor = findClosestSnapAnchor(
		point,
		elements,
		excludeIds,
		pointOptions,
	);
	return {
		rect: snappedRect,
		point,
		anchor,
		guides: aligned.guides,
		indicators: getVisibleSnapPointIndicators(
			point,
			elements,
			excludeIds,
			pointOptions,
			anchor,
			snap.showInactivePoints ?? true,
		),
	};
}
