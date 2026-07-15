export const CANVAS_ELEMENT_TYPES = [
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
] as const;

export type ElementType = (typeof CANVAS_ELEMENT_TYPES)[number];

/** Element types that can be created from a rectangular bounds contract. */
export const CANVAS_BOUNDS_ELEMENT_TYPES = [
	"rectangle",
	"ellipse",
	"diamond",
	"triangle",
	"cloud",
	"line",
	"arrow",
	"text",
	"frame",
] as const satisfies readonly ElementType[];

export type ToolType =
	| "select"
	| "lasso"
	| "rectangle"
	| "ellipse"
	| "diamond"
	| "triangle"
	| "cloud"
	| "line"
	| "arrow"
	| "text"
	| "freehand"
	| "frame"
	| "pan"
	| "eraser"
	| "laser"
	| "eyedropper";

export interface LaserTrailPoint {
	x: number;
	y: number;
	t: number;
}

export interface LaserTrail {
	id: string;
	points: LaserTrailPoint[];
	createdAt: number;
	closed?: boolean;
}

export type StrokeStyle = "solid" | "dashed" | "dotted";
export type RoughFillStyle =
	| "solid"
	| "hachure"
	| "cross-hatch"
	| "dots"
	| "dashed";
export type ArrowMode = "straight" | "curve" | "elbow";
export type ArrowHead = "none" | "arrow" | "triangle" | "dot";

export interface CanvasElement {
	id: string;
	type: ElementType;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	fill: string;
	stroke: string;
	strokeWidth: number;
	strokeStyle: StrokeStyle;
	opacity: number;
	locked: boolean;
	groupId: string | null;
	/** Stable, lexicographically sortable stack order. */
	stackIndex?: string;
	flipX: boolean;
	flipY: boolean;
	link?: string;
	text?: string;
	textColor?: string;
	fontSize?: number;
	fontFamily?: string;
	textAlign?: "left" | "center" | "right";
	fontWeight?: "normal" | "bold";
	fontStyle?: "normal" | "italic";
	textDecoration?: "none" | "underline";
	points?: [number, number][];
	/** Closes a multi-point line back to its first point so it can be filled. */
	closed?: boolean;
	arrowMode?: ArrowMode;
	arrowHeadStart?: ArrowHead;
	arrowHeadEnd?: ArrowHead;
	arrowHeadScale?: number;
	arrowHeadFilled?: boolean;
	cornerRadius?: number;
	cornerRadiusPercent?: number;
	roughness?: number;
	roughFillStyle?: RoughFillStyle;
	roughFillScale?: number;
	/** Radius/depth of the repeating revision-cloud arcs in canvas units. */
	cloudArcRadius?: number;
	/** 1 renders a regular triangle; larger values render a divided pyramid. */
	pyramidSections?: number;
	frameId?: string;
	frameLabel?: string;
	customData?: Record<string, unknown>;
}

export type HandlePosition = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";

export interface Viewport {
	x: number;
	y: number;
	zoom: number;
}

export interface SavedCanvasView {
	id: string;
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	createdAt: number;
	updatedAt: number;
	/** Explicit slide ordering. Legacy views without an order fall back to createdAt. */
	order?: number;
	/** Slides default to a stable widescreen frame. */
	aspectRatio?: "16:9" | "4:3" | "free";
}

export interface SelectionBox {
	startX: number;
	startY: number;
	endX: number;
	endY: number;
}

export const DEFAULT_FILL = "transparent";
export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_STROKE_STYLE: StrokeStyle = "solid";
export const DEFAULT_ARROW_HEAD_SCALE = 1;
export const DEFAULT_ARROW_HEAD_FILLED = true;
export const MIN_ARROW_HEAD_SCALE = 0.25;
export const MAX_ARROW_HEAD_SCALE = 4;
export const DEFAULT_ROUGH_FILL_STYLE: RoughFillStyle = "solid";
export const DEFAULT_ROUGH_FILL_SCALE = 1;
export const MIN_ROUGH_FILL_SCALE = 0.25;
export const MAX_ROUGH_FILL_SCALE = 4;
export const DEFAULT_FONT_SIZE = 16;
export const DEFAULT_FONT_FAMILY = "Comic Sans MS, Comic Sans, cursive";
export const GRID_SIZE = 20;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 30;

const ROUGH_FILL_GAP_BASE = 8;

function roughFillGapForScale(scale = DEFAULT_ROUGH_FILL_SCALE): number {
	const clamped = Math.min(
		MAX_ROUGH_FILL_SCALE,
		Math.max(MIN_ROUGH_FILL_SCALE, scale),
	);
	return ROUGH_FILL_GAP_BASE * clamped;
}

export function roughPatternFillGaps(scale?: number): {
	hachureGap: number;
	dotGap: number;
	dashGap: number;
} {
	const gap = roughFillGapForScale(scale);
	return { hachureGap: gap, dotGap: gap, dashGap: gap };
}
