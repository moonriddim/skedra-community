import {
	type CanvasElement,
	type CanvasObjectSnapMode,
	type SnapAnchor,
	type SnapGuide,
	type SnapPointIndicator,
	calcSnap,
	findClosestSnapAnchor,
	getVisibleSnapPointIndicators,
} from "@skedra/canvas-core";
import type { CanvasEditorToolId } from "./editor-contract";

export const CANVAS_EDITOR_OBJECT_SNAP_MODES = [
	"endpoint",
	"midpoint",
	"division",
	"center",
	"geometric-center",
	"quadrant",
	"intersection",
	"extension",
	"insertion",
	"nearest",
] as const satisfies readonly CanvasObjectSnapMode[];

export const CANVAS_EDITOR_SNAP_OVERRIDE_TOOL_IDS = [
	"line",
	"arrow",
	"rectangle",
	"ellipse",
	"diamond",
	"triangle",
	"cloud",
	"freehand",
] as const satisfies readonly CanvasEditorToolId[];

const SNAP_OVERRIDE_TOOLS = new Set<CanvasEditorToolId>(
	CANVAS_EDITOR_SNAP_OVERRIDE_TOOL_IDS,
);

export function canvasEditorToolSupportsSnapOverride(
	tool: CanvasEditorToolId,
): boolean {
	return SNAP_OVERRIDE_TOOLS.has(tool);
}

export function getCanvasEditorSnapModeOptions(
	mode: CanvasObjectSnapMode | null,
): Omit<CanvasEditorSnapOptions, "enabled"> | null {
	if (!mode) return null;
	return {
		includeEndpoints: mode === "endpoint",
		includeMidpoints: mode === "midpoint",
		includeDivisions: mode === "division",
		includeCenters: mode === "center",
		includeGeometricCenters: mode === "geometric-center",
		includeQuadrants: mode === "quadrant",
		includeIntersections: mode === "intersection",
		includeExtensions: mode === "extension",
		includeInsertions: mode === "insertion",
		includeNearest: mode === "nearest",
	};
}

export interface CanvasEditorSnapOptions {
	enabled: boolean;
	includeEndpoints?: boolean;
	includeCenters?: boolean;
	includeMidpoints?: boolean;
	includeDivisions?: boolean;
	divisionCount?: number;
	includeNearest?: boolean;
	includeGeometricCenters?: boolean;
	includeQuadrants?: boolean;
	includeIntersections?: boolean;
	includeExtensions?: boolean;
	includeInsertions?: boolean;
	showInactivePoints?: boolean;
	threshold?: number;
}

export interface CanvasEditorPointSnapResult {
	point: { x: number; y: number };
	anchor: SnapAnchor | null;
	guides: SnapGuide[];
	indicators: SnapPointIndicator[];
}

/** Object anchors take precedence; grid coordinates are only the fallback. */
export function resolveCanvasEditorPlacementPoint(
	result: Pick<CanvasEditorPointSnapResult, "point" | "anchor">,
	fallback: { x: number; y: number },
): { x: number; y: number } {
	return result.anchor ? result.point : fallback;
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
		includeEndpoints: snap.includeEndpoints ?? true,
		includeCenters: snap.includeCenters ?? true,
		includeMidpoints: snap.includeMidpoints ?? true,
		includeDivisions: snap.includeDivisions ?? false,
		divisionCount: snap.divisionCount,
		includeNearest: snap.includeNearest ?? false,
		includeGeometricCenters: snap.includeGeometricCenters ?? true,
		includeQuadrants: snap.includeQuadrants ?? true,
		includeIntersections: snap.includeIntersections ?? true,
		includeExtensions: snap.includeExtensions ?? false,
		includeInsertions: snap.includeInsertions ?? false,
	};
	const anchor = findClosestSnapAnchor(
		point,
		elements,
		excludeIds,
		pointOptions,
		options.forceAnchor ? (snap.threshold ?? 12) * 1.5 : snap.threshold,
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
		includeEndpoints: snap.includeEndpoints ?? true,
		includeCenters: snap.includeCenters ?? true,
		includeMidpoints: snap.includeMidpoints ?? true,
		includeDivisions: snap.includeDivisions ?? false,
		divisionCount: snap.divisionCount,
		includeNearest: snap.includeNearest ?? false,
		includeGeometricCenters: snap.includeGeometricCenters ?? true,
		includeQuadrants: snap.includeQuadrants ?? true,
		includeIntersections: snap.includeIntersections ?? true,
		includeExtensions: snap.includeExtensions ?? false,
		includeInsertions: snap.includeInsertions ?? false,
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
