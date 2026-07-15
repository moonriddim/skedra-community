import type { SkedraSdkTemplateId } from "./factories.js";
import type {
	SkedraFile,
	SkedraImageOptions,
	SkedraLibraryFile,
	SkedraLibraryItem,
} from "./io.js";
import type { CanvasElement, SavedCanvasView, Viewport } from "./types.js";

export const SKEDRA_CANVAS_COMMAND_IDS = [
	"undo",
	"redo",
	"copy",
	"cut",
	"paste",
	"duplicate",
	"delete",
	"select-all",
	"group",
	"ungroup",
	"align-top",
	"align-bottom",
	"align-left",
	"align-right",
	"align-horizontal-center",
	"align-vertical-center",
	"distribute-horizontal",
	"distribute-vertical",
	"bring-forward",
	"send-backward",
	"bring-to-front",
	"send-to-back",
	"flip-horizontal",
	"flip-vertical",
	"toggle-lock",
	"toggle-grid",
	"toggle-object-snap",
	"fit-to-content",
] as const;

export type SkedraCanvasCommandId = (typeof SKEDRA_CANVAS_COMMAND_IDS)[number];

type IsExact<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends <
	Value,
>() => Value extends Right ? 1 : 2
	? true
	: false;

// Adding a command to canvas-core is a build error until the public SDK follows.
const canvasCommandParity: IsExact<
	SkedraCanvasCommandId,
	CoreCanvasEditorCommandId
> = true;
void canvasCommandParity;
export type SkedraAlignment =
	| "top"
	| "bottom"
	| "left"
	| "right"
	| "horizontal-center"
	| "vertical-center";
export type SkedraDistribution = "horizontal" | "vertical";
export type SkedraLayerCommand =
	| "bring-forward"
	| "send-backward"
	| "bring-to-front"
	| "send-to-back";

export type SkedraObjectSnapMode =
	| "endpoint"
	| "midpoint"
	| "division"
	| "center"
	| "geometric-center"
	| "quadrant"
	| "intersection"
	| "extension"
	| "insertion"
	| "nearest";

export interface SkedraObjectSnapSettings {
	enabled: boolean;
	endpoints: boolean;
	midpoints: boolean;
	divisions: boolean;
	/** Evenly spaced interior division points per straight side (2-8). */
	divisionCount: number;
	centers: boolean;
	nearest: boolean;
	geometricCenters: boolean;
	quadrants: boolean;
	intersections: boolean;
	extensions: boolean;
	insertions: boolean;
	showPoints: boolean;
}

export interface SkedraGridSettings {
	visible: boolean;
	snap: boolean;
	size: number;
}

export type SkedraSelectionTransform =
	| { type: "flip"; axis: "horizontal" | "vertical" }
	| { type: "rotate"; angle: number };

export interface SkedraFlowchartStepOptions {
	branch?: "next" | "yes" | "no";
	route?: "up" | "right" | "down" | "left" | "left-up";
	nodeKind?: "start" | "step" | "decision" | "end";
	label?: string;
}

export interface SkedraKanbanCardDetails {
	title?: string;
	description?: string;
	priority?: "low" | "medium" | "high" | "urgent" | null;
	startDate?: string | null;
	dueDate?: string | null;
	assigneeId?: string | null;
	assigneeName?: string | null;
	roleId?: string | null;
	roleName?: string | null;
	groupId?: string | null;
	groupName?: string | null;
	checklist?: Array<{ id: string; text: string; completed: boolean }>;
	attachments?: Array<{
		id: string;
		src: string;
		name: string;
		width: number;
		height: number;
	}>;
	coverImage?: {
		id: string;
		src: string;
		name: string;
		width: number;
		height: number;
	} | null;
}

export interface SkedraCanvasDocumentSnapshot {
	elements: CanvasElement[];
	views: SavedCanvasView[];
	viewport: Viewport;
}

export interface SkedraCanvasExtendedApi {
	canUndo: () => boolean;
	canRedo: () => boolean;
	undo: () => void;
	redo: () => void;
	copy: () => CanvasElement[];
	cut: () => CanvasElement[];
	paste: () => CanvasElement[];
	pasteFromClipboard: () => Promise<CanvasElement[]>;
	duplicate: () => CanvasElement[];
	selectAll: () => void;
	setSelectedIds: (ids: Iterable<string>) => void;
	deleteSelection: () => void;
	group: () => void;
	ungroup: () => void;
	align: (alignment: SkedraAlignment) => void;
	distribute: (axis: SkedraDistribution) => void;
	layer: (command: SkedraLayerCommand) => void;
	flip: (axis: "horizontal" | "vertical") => void;
	rotateSelection: (angle: number) => void;
	cloneTransformedSelection: (
		transform: SkedraSelectionTransform,
	) => CanvasElement[];
	setTransformOrigin: (origin: { x: number; y: number } | null) => void;
	getTransformOrigin: () => { x: number; y: number } | null;
	setLocked: (locked?: boolean) => void;
	setProperties: (properties: Partial<CanvasElement>) => void;
	setCanvasBackground: (background: string) => void;
	getCanvasBackground: () => string;
	setGrid: (enabled: boolean) => void;
	getGrid: () => boolean;
	setGridSettings: (settings: Partial<SkedraGridSettings>) => void;
	getGridSettings: () => SkedraGridSettings;
	setObjectSnap: (enabled: boolean) => void;
	getObjectSnap: () => boolean;
	setObjectSnapSettings: (settings: Partial<SkedraObjectSnapSettings>) => void;
	getObjectSnapSettings: () => SkedraObjectSnapSettings;
	getViewport: () => Viewport;
	setViewport: (viewport: Viewport) => void;
	insertImage: (
		source: Blob | string,
		options?: SkedraImageOptions,
	) => Promise<CanvasElement>;
	cropImage: (
		id: string,
		crop: { x: number; y: number; width: number; height: number },
	) => CanvasElement | null;
	getLibraries: () => SkedraLibraryFile[];
	setLibraries: (libraries: SkedraLibraryFile[]) => void;
	insertLibraryItem: (
		item: SkedraLibraryItem,
		options?: { x?: number; y?: number },
	) => CanvasElement[];
	addFlowchartStep: (
		nodeId: string,
		options?: SkedraFlowchartStepOptions,
	) => CanvasElement[];
	setFlowchartNodeKind: (
		nodeId: string,
		kind: "start" | "step" | "decision" | "end",
	) => void;
	updateKanbanCard: (cardId: string, details: SkedraKanbanCardDetails) => void;
	updateKanbanList: (
		listId: string,
		details: { name?: string; description?: string; wipLimit?: number | null },
	) => void;
	getViews: () => SavedCanvasView[];
	createView: (
		view: Omit<SavedCanvasView, "id" | "createdAt" | "updatedAt"> &
			Partial<Pick<SavedCanvasView, "id" | "createdAt" | "updatedAt">>,
	) => SavedCanvasView;
	updateView: (id: string, updates: Partial<SavedCanvasView>) => void;
	deleteView: (id: string) => void;
	goToView: (id: string) => void;
	startPresentation: (startViewId?: string) => void;
	nextView: () => void;
	previousView: () => void;
	stopPresentation: () => void;
	exportFile: () => SkedraFile;
	exportFrame: (
		frameId: string,
		format: "svg" | "png" | "pdf" | "pptx",
	) => Promise<Blob | null>;
	importFile: (file: SkedraFile) => void;
	executeCommand: (command: SkedraCanvasCommandId) => void;
	insertTemplate: (
		templateId: SkedraSdkTemplateId,
		options?: { x?: number; y?: number },
	) => CanvasElement[];
}
import type { CanvasEditorCommandId as CoreCanvasEditorCommandId } from "@skedra/canvas-core";
