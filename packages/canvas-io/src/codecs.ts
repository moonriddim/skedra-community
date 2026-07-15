import type {
	ArrowHead,
	ArrowMode,
	CanvasElement,
	ElementType,
	RoughFillStyle,
	SavedCanvasView,
	StrokeStyle,
} from "@skedra/canvas-core";
import {
	MAX_CLOUD_ARC_RADIUS,
	MAX_PYRAMID_SECTIONS,
	MIN_CLOUD_ARC_RADIUS,
	MIN_PYRAMID_SECTIONS,
} from "@skedra/canvas-core";

const ELEMENT_TYPES = new Set<ElementType>([
	"rectangle",
	"ellipse",
	"diamond",
	"triangle",
	"cloud",
	"line",
	"arrow",
	"image",
	"text",
	"freehand",
	"frame",
]);

const STROKE_STYLES = new Set<StrokeStyle>(["solid", "dashed", "dotted"]);
const TEXT_ALIGNS = new Set(["left", "center", "right"] as const);
const FONT_WEIGHTS = new Set(["normal", "bold"] as const);
const FONT_STYLES = new Set(["normal", "italic"] as const);
const TEXT_DECORATIONS = new Set(["none", "underline"] as const);
const ARROW_MODES = new Set<ArrowMode>(["straight", "curve", "elbow"]);
const ARROW_HEADS = new Set<ArrowHead>(["none", "arrow", "triangle", "dot"]);
const ROUGH_FILL_STYLES = new Set<RoughFillStyle>([
	"solid",
	"hachure",
	"cross-hatch",
	"dots",
	"dashed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value != null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isOptionalString(value: unknown): value is string | undefined {
	return value === undefined || typeof value === "string";
}

function isOptionalNumber(value: unknown): value is number | undefined {
	return value === undefined || isFiniteNumber(value);
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
	return value === undefined || typeof value === "boolean";
}

function isStringOrNull(value: unknown): value is string | null {
	return value === null || typeof value === "string";
}

function decodePoints(value: unknown): [number, number][] | undefined {
	if (value === undefined) return undefined;
	if (!Array.isArray(value)) return undefined;
	const points: [number, number][] = [];
	for (const point of value) {
		if (
			!Array.isArray(point) ||
			point.length !== 2 ||
			!isFiniteNumber(point[0]) ||
			!isFiniteNumber(point[1])
		) {
			return undefined;
		}
		points.push([point[0], point[1]]);
	}
	return points;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
	return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export function encodeCanvasElement(
	element: CanvasElement,
): Record<string, unknown> {
	return cloneRecord(element as unknown as Record<string, unknown>);
}

export function encodeCanvasElements(
	elements: Iterable<CanvasElement>,
): Record<string, unknown>[] {
	return Array.from(elements, encodeCanvasElement);
}

export function encodeSavedCanvasView(
	view: SavedCanvasView,
): Record<string, unknown> {
	return cloneRecord(view as unknown as Record<string, unknown>);
}

export function encodeSavedCanvasViews(
	views: Iterable<SavedCanvasView>,
): Record<string, unknown>[] {
	return Array.from(views, encodeSavedCanvasView);
}

export function decodeCanvasElement(value: unknown): CanvasElement | null {
	if (!isRecord(value)) return null;
	const type = value.type;
	const strokeStyle = value.strokeStyle;
	const groupId = value.groupId;
	if (
		typeof value.id !== "string" ||
		!ELEMENT_TYPES.has(type as ElementType) ||
		!isFiniteNumber(value.x) ||
		!isFiniteNumber(value.y) ||
		!isFiniteNumber(value.width) ||
		!isFiniteNumber(value.height) ||
		!isFiniteNumber(value.rotation) ||
		typeof value.fill !== "string" ||
		typeof value.stroke !== "string" ||
		!isFiniteNumber(value.strokeWidth) ||
		!STROKE_STYLES.has(strokeStyle as StrokeStyle) ||
		!isFiniteNumber(value.opacity) ||
		typeof value.locked !== "boolean" ||
		!isStringOrNull(groupId) ||
		typeof value.flipX !== "boolean" ||
		typeof value.flipY !== "boolean"
	) {
		return null;
	}

	const points = decodePoints(value.points);
	if (value.points !== undefined && !points) return null;
	if (
		!isOptionalString(value.stackIndex) ||
		!isOptionalString(value.link) ||
		!isOptionalString(value.text) ||
		!isOptionalString(value.textColor) ||
		!isOptionalNumber(value.fontSize) ||
		!isOptionalString(value.fontFamily) ||
		(value.textAlign !== undefined &&
			!TEXT_ALIGNS.has(value.textAlign as never)) ||
		(value.fontWeight !== undefined &&
			!FONT_WEIGHTS.has(value.fontWeight as never)) ||
		(value.fontStyle !== undefined &&
			!FONT_STYLES.has(value.fontStyle as never)) ||
		(value.textDecoration !== undefined &&
			!TEXT_DECORATIONS.has(value.textDecoration as never)) ||
		!isOptionalBoolean(value.closed) ||
		(value.arrowMode !== undefined &&
			!ARROW_MODES.has(value.arrowMode as ArrowMode)) ||
		(value.arrowHeadStart !== undefined &&
			!ARROW_HEADS.has(value.arrowHeadStart as ArrowHead)) ||
		(value.arrowHeadEnd !== undefined &&
			!ARROW_HEADS.has(value.arrowHeadEnd as ArrowHead)) ||
		!isOptionalNumber(value.arrowHeadScale) ||
		!isOptionalBoolean(value.arrowHeadFilled) ||
		!isOptionalNumber(value.cornerRadius) ||
		!isOptionalNumber(value.cornerRadiusPercent) ||
		!isOptionalNumber(value.roughness) ||
		(value.roughFillStyle !== undefined &&
			!ROUGH_FILL_STYLES.has(value.roughFillStyle as RoughFillStyle)) ||
		!isOptionalNumber(value.roughFillScale) ||
		!isOptionalNumber(value.cloudArcRadius) ||
		(value.cloudArcRadius !== undefined &&
			(value.cloudArcRadius < MIN_CLOUD_ARC_RADIUS ||
				value.cloudArcRadius > MAX_CLOUD_ARC_RADIUS)) ||
		!isOptionalNumber(value.pyramidSections) ||
		(value.pyramidSections !== undefined &&
			(!Number.isInteger(value.pyramidSections) ||
				value.pyramidSections < MIN_PYRAMID_SECTIONS ||
				value.pyramidSections > MAX_PYRAMID_SECTIONS)) ||
		!isOptionalString(value.frameId) ||
		!isOptionalString(value.frameLabel) ||
		(value.customData !== undefined && !isRecord(value.customData))
	) {
		return null;
	}

	return {
		...(cloneRecord(value) as Partial<CanvasElement>),
		id: value.id,
		type: type as ElementType,
		x: value.x,
		y: value.y,
		width: value.width,
		height: value.height,
		rotation: value.rotation,
		fill: value.fill,
		stroke: value.stroke,
		strokeWidth: value.strokeWidth,
		strokeStyle: strokeStyle as StrokeStyle,
		opacity: value.opacity,
		locked: value.locked,
		groupId,
		flipX: value.flipX,
		flipY: value.flipY,
		points,
		customData: value.customData ? cloneRecord(value.customData) : undefined,
	} as CanvasElement;
}

export function decodeCanvasElements(value: unknown): CanvasElement[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		const decoded = decodeCanvasElement(entry);
		return decoded ? [decoded] : [];
	});
}

export function applyCanvasElementUpdates(
	element: CanvasElement,
	updates: Partial<CanvasElement>,
): CanvasElement | null {
	return decodeCanvasElement({
		...encodeCanvasElement(element),
		...encodePartialUpdates(updates),
	});
}

export function decodeSavedCanvasView(value: unknown): SavedCanvasView | null {
	if (!isRecord(value)) return null;
	if (
		typeof value.id !== "string" ||
		typeof value.name !== "string" ||
		!isFiniteNumber(value.x) ||
		!isFiniteNumber(value.y) ||
		!isFiniteNumber(value.width) ||
		!isFiniteNumber(value.height) ||
		!isFiniteNumber(value.createdAt) ||
		!isFiniteNumber(value.updatedAt) ||
		!isOptionalNumber(value.order) ||
		(value.aspectRatio !== undefined &&
			value.aspectRatio !== "16:9" &&
			value.aspectRatio !== "4:3" &&
			value.aspectRatio !== "free")
	) {
		return null;
	}

	return {
		id: value.id,
		name: value.name,
		x: value.x,
		y: value.y,
		width: value.width,
		height: value.height,
		createdAt: value.createdAt,
		updatedAt: value.updatedAt,
		order: value.order,
		aspectRatio: value.aspectRatio as SavedCanvasView["aspectRatio"],
	};
}

export function decodeSavedCanvasViews(value: unknown): SavedCanvasView[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		const decoded = decodeSavedCanvasView(entry);
		return decoded ? [decoded] : [];
	});
}

export function applySavedCanvasViewUpdates(
	view: SavedCanvasView,
	updates: Partial<SavedCanvasView>,
): SavedCanvasView | null {
	return decodeSavedCanvasView({
		...encodeSavedCanvasView(view),
		...encodePartialUpdates(updates),
	});
}

function encodePartialUpdates<T extends object>(
	updates: Partial<T>,
): Record<string, unknown> {
	const encoded: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(updates)) {
		encoded[key] = value === undefined ? undefined : cloneValue(value);
	}
	return encoded;
}

function cloneValue(value: unknown): unknown {
	if (value == null || typeof value !== "object") return value;
	return JSON.parse(JSON.stringify(value));
}
