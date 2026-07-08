export type ElementType =
	| "rectangle"
	| "ellipse"
	| "diamond"
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
	arrowMode?: ArrowMode;
	arrowHeadStart?: ArrowHead;
	arrowHeadEnd?: ArrowHead;
	arrowHeadScale?: number;
	cornerRadius?: number;
	cornerRadiusPercent?: number;
	roughness?: number;
	roughFillStyle?: RoughFillStyle;
	roughFillScale?: number;
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
	presenterNotes?: string;
}
