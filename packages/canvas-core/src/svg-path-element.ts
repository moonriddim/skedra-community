import type { CanvasElement } from "./types";

export type SvgMatrix = [number, number, number, number, number, number];

export interface SvgImportedLineData {
	fillRule?: "nonzero" | "evenodd";
	fillOpacity?: number;
	strokeOpacity?: number;
	strokeLinecap?: "butt" | "round" | "square";
	strokeLinejoin?: "miter" | "round" | "bevel";
	strokeDasharray?: string;
	strokeStyle?: CanvasElement["strokeStyle"];
	strokeWidth?: number;
}

export interface SvgImportedRectData {
	rxRatio: number;
	ryRatio: number;
}

export interface SvgPathElementData {
	d: string;
	transform: SvgMatrix;
	sourceBounds: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	subpaths: [number, number][][];
	fillRule?: "nonzero" | "evenodd";
	fillOpacity?: number;
	strokeOpacity?: number;
	strokeLinecap?: "butt" | "round" | "square";
	strokeLinejoin?: "miter" | "round" | "bevel";
	strokeDasharray?: string;
	strokeStyle?: CanvasElement["strokeStyle"];
	strokeWidth?: number;
	sourceStrokeWidth?: number;
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isSvgMatrix(value: unknown): value is SvgMatrix {
	return (
		Array.isArray(value) && value.length === 6 && value.every(isFiniteNumber)
	);
}

function isPoint(value: unknown): value is [number, number] {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		isFiniteNumber(value[0]) &&
		isFiniteNumber(value[1])
	);
}

function readImportedPresentationData(
	data: Record<string, unknown>,
): SvgImportedLineData {
	return {
		fillRule:
			data.fillRule === "evenodd" || data.fillRule === "nonzero"
				? data.fillRule
				: undefined,
		fillOpacity: isFiniteNumber(data.fillOpacity)
			? data.fillOpacity
			: undefined,
		strokeOpacity: isFiniteNumber(data.strokeOpacity)
			? data.strokeOpacity
			: undefined,
		strokeLinecap:
			data.strokeLinecap === "butt" ||
			data.strokeLinecap === "round" ||
			data.strokeLinecap === "square"
				? data.strokeLinecap
				: undefined,
		strokeLinejoin:
			data.strokeLinejoin === "miter" ||
			data.strokeLinejoin === "round" ||
			data.strokeLinejoin === "bevel"
				? data.strokeLinejoin
				: undefined,
		strokeDasharray:
			typeof data.strokeDasharray === "string"
				? data.strokeDasharray
				: undefined,
		strokeStyle:
			data.strokeStyle === "solid" ||
			data.strokeStyle === "dashed" ||
			data.strokeStyle === "dotted"
				? data.strokeStyle
				: undefined,
		strokeWidth: isFiniteNumber(data.strokeWidth)
			? Math.max(0, data.strokeWidth)
			: undefined,
	};
}

/** Reads exact SVG presentation values retained on editable straight paths. */
export function getSvgImportedLineData(
	element: Pick<CanvasElement, "customData">,
): SvgImportedLineData | null {
	const value = element.customData?.svgImportedLine;
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	return readImportedPresentationData(value as Record<string, unknown>);
}

/** Reads normalized, independently scalable SVG rectangle corner radii. */
export function getSvgImportedRectData(
	element: Pick<
		CanvasElement,
		"cornerRadius" | "cornerRadiusPercent" | "customData"
	>,
): SvgImportedRectData | null {
	if (
		element.cornerRadius !== undefined ||
		element.cornerRadiusPercent !== undefined
	) {
		return null;
	}
	const value = element.customData?.svgImportedRect;
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const data = value as Record<string, unknown>;
	if (
		!isFiniteNumber(data.rxRatio) ||
		!isFiniteNumber(data.ryRatio) ||
		data.rxRatio < 0 ||
		data.ryRatio < 0
	) {
		return null;
	}
	return {
		rxRatio: Math.min(0.5, data.rxRatio),
		ryRatio: Math.min(0.5, data.ryRatio),
	};
}

/** Keeps imported dash lengths proportional when the editor changes stroke width. */
export function getSvgImportedStrokeDasharray(
	element: Pick<CanvasElement, "strokeStyle" | "strokeWidth" | "customData">,
	data: SvgImportedLineData,
): string | undefined {
	if (
		!data.strokeDasharray ||
		!data.strokeStyle ||
		element.strokeStyle !== data.strokeStyle
	) {
		return undefined;
	}
	const scale =
		data.strokeWidth && data.strokeWidth > 0
			? Math.max(0, element.strokeWidth) / data.strokeWidth
			: 1;
	return data.strokeDasharray.replace(
		/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi,
		(token) => String(Number(token) * scale),
	);
}

/**
 * Reads the deliberately small, JSON-safe SVG path payload stored on imported
 * canvas elements. Invalid custom data is ignored instead of reaching the DOM.
 */
export function getSvgPathElementData(
	element: Pick<CanvasElement, "customData">,
): SvgPathElementData | null {
	if (element.customData?.skedraType !== "svg-path") return null;
	const value = element.customData.svgPath;
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const data = value as Record<string, unknown>;
	const bounds = data.sourceBounds;
	if (
		typeof data.d !== "string" ||
		!isSvgMatrix(data.transform) ||
		!bounds ||
		typeof bounds !== "object" ||
		Array.isArray(bounds)
	) {
		return null;
	}
	const sourceBounds = bounds as Record<string, unknown>;
	if (
		!isFiniteNumber(sourceBounds.x) ||
		!isFiniteNumber(sourceBounds.y) ||
		!isFiniteNumber(sourceBounds.width) ||
		!isFiniteNumber(sourceBounds.height) ||
		sourceBounds.width <= 0 ||
		sourceBounds.height <= 0 ||
		!Array.isArray(data.subpaths)
	) {
		return null;
	}
	const subpaths = data.subpaths.filter(
		(path): path is [number, number][] =>
			Array.isArray(path) && path.length >= 2 && path.every(isPoint),
	);
	return {
		d: data.d,
		transform: data.transform,
		sourceBounds: {
			x: sourceBounds.x,
			y: sourceBounds.y,
			width: sourceBounds.width,
			height: sourceBounds.height,
		},
		subpaths,
		...readImportedPresentationData(data),
		sourceStrokeWidth: isFiniteNumber(data.sourceStrokeWidth)
			? Math.max(0, data.sourceStrokeWidth)
			: undefined,
	};
}

/** Returns imported SVG contour samples in the element's current local size. */
export function getSvgPathElementSubpaths(
	element: Pick<CanvasElement, "width" | "height" | "customData">,
): [number, number][][] | null {
	const data = getSvgPathElementData(element);
	if (!data) return null;
	return data.subpaths.map((path) =>
		path.map(
			([x, y]) => [x * element.width, y * element.height] as [number, number],
		),
	);
}

/** Builds the exact local-SVG-to-current-canvas transform used by the renderer. */
export function getSvgPathRenderMatrix(
	element: Pick<CanvasElement, "x" | "y" | "width" | "height" | "customData">,
): SvgMatrix | null {
	const data = getSvgPathElementData(element);
	if (!data) return null;
	const sx = element.width / data.sourceBounds.width;
	const sy = element.height / data.sourceBounds.height;
	const [a, b, c, d, e, f] = data.transform;
	return [
		sx * a,
		sy * b,
		sx * c,
		sy * d,
		element.x + sx * (e - data.sourceBounds.x),
		element.y + sy * (f - data.sourceBounds.y),
	];
}
