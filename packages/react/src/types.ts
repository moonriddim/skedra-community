import type {
	CanvasElement as CoreCanvasElement,
	ElementType as CoreElementType,
	SavedCanvasView as CoreSavedCanvasView,
	Viewport as CoreViewport,
} from "@skedra/canvas-core";

export type ElementType =
	| "rectangle"
	| "ellipse"
	| "diamond"
	| "triangle"
	| "cloud"
	| "line"
	| "arrow"
	| "image"
	| "text"
	| "freehand"
	| "frame";

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
	cloudArcRadius?: number;
	pyramidSections?: number;
	frameId?: string;
	frameLabel?: string;
	customData?: Record<string, unknown>;
}

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

type IsExact<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends <
	Value,
>() => Value extends Right ? 1 : 2
	? true
	: false;

// Keep the published declarations self-contained while making any drift from
// canvas-core a compile error during every SDK build and watch session.
const canvasElementTypeParity: IsExact<CanvasElement, CoreCanvasElement> = true;
const elementTypeParity: IsExact<ElementType, CoreElementType> = true;
const savedCanvasViewTypeParity: IsExact<SavedCanvasView, CoreSavedCanvasView> =
	true;
const viewportTypeParity: IsExact<Viewport, CoreViewport> = true;

void canvasElementTypeParity;
void elementTypeParity;
void savedCanvasViewTypeParity;
void viewportTypeParity;
