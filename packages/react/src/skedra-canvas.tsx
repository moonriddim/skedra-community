import {
	CanvasScene,
	GRID_SIZE,
	applyCanvasElementUpdates,
	applyCanvasMutationPlan,
	buildBringForwardUpdates,
	buildBringToFrontUpdates,
	buildCanvasDrawingElement,
	buildCanvasMoveUpdates,
	buildCanvasTextElement,
	buildCanvasTextUpdate,
	buildFlowchartNodeKindChanges,
	buildKanbanDropUpdates,
	buildSendBackwardUpdates,
	buildSendToBackUpdates,
	buildTemplateDropUpdates,
	buildTemplateSectionLayoutSyncUpdates,
	clientPointToCanvas,
	cloneCanvasSelection,
	collectCanvasSelectionRectIds,
	computeViewportForBounds,
	createCanvasTemplateStickyNote,
	createStackIndexAfter,
	getAlignmentUpdates,
	getBBox,
	getCanvasKeyboardCommand,
	getCanvasKeyboardResizeChanges,
	getCanvasViewportCenter,
	getCombinedBBox,
	getDistributionUpdates,
	getFlipUpdates,
	getGroupUpdates,
	getLockUpdates,
	isKanbanCard,
	isKanbanList,
	isMindmapNode,
	lassoPathToSvgD,
	normalizeCanvasRect,
	planCanvasDeletion,
	planFlowchartStepMutation,
	planKanbanCardInsertion,
	planMindmapChildMutation,
	planMindmapSiblingMutation,
	resizeCanvasElement,
	shouldKeepCanvasDrawing,
	toCanvasElementMap,
	zoomCanvasViewportAtPoint,
} from "@skedra/canvas-core";
import type { ToolType } from "@skedra/canvas-core";
import {
	CanvasElementRenderer,
	type CanvasRendererConfig,
	CanvasRendererProvider,
} from "@skedra/canvas-react";
import {
	ArrowRight,
	Circle,
	Copy,
	Diamond,
	Download,
	Eraser,
	Frame,
	GitBranch,
	Grid3X3,
	Hand,
	ImagePlus,
	Kanban,
	Lasso,
	LayoutTemplate,
	Library,
	Minus,
	MousePointer2,
	PenLine,
	Pipette,
	Plus,
	Redo2,
	Square,
	StickyNote,
	TextCursorInput,
	Trash2,
	Undo2,
	Zap,
} from "lucide-react";
import {
	type CSSProperties,
	type ComponentType,
	type KeyboardEvent as ReactKeyboardEvent,
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
	type WheelEvent,
	forwardRef,
	useCallback,
	useEffect,
	useId,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	SkedraAlignment,
	SkedraCanvasCommandId,
	SkedraCanvasExtendedApi,
	SkedraDistribution,
	SkedraFlowchartStepOptions,
	SkedraKanbanCardDetails,
	SkedraLayerCommand,
} from "./commands.js";
import { exportSkedraVisual } from "./exporters.js";
import {
	SKEDRA_TEMPLATES,
	type SkedraSdkTemplateId,
	createSkedraFrameElement,
	createSkedraKanbanBoardElements,
	createSkedraKanbanCardElement,
	createSkedraMindmapElements,
	createSkedraStickyNoteElement,
	createSkedraTemplateElements,
	getSkedraElementFactoryDefaults,
	getSkedraMindmapAppearance,
	withSkedraStackIndexes,
} from "./factories.js";
import {
	createSkedraFile,
	createSkedraImageElement,
	createSkedraLibraryFile,
	createSkedraLibraryItem,
	cropSkedraImage,
	downloadSkedraBlob,
	encryptSkedraFile,
	instantiateSkedraLibraryItem,
	parseSkedraClipboard,
	parseSkedraFileContents,
	parseSkedraLibrary,
	serializeSkedraClipboard,
	serializeSkedraFile,
	serializeSkedraLibrary,
} from "./io.js";
import type {
	SkedraFile,
	SkedraImageOptions,
	SkedraLibraryFile,
	SkedraLibraryItem,
} from "./io.js";
import { SdkMindmapActions } from "./mindmap-actions.js";
import { SkedraPropertiesPanel } from "./properties-panel.js";
import type { CanvasElement, SavedCanvasView, Viewport } from "./types.js";

export type SkedraSdkTool =
	| "select"
	| "lasso"
	| "pan"
	| "rectangle"
	| "ellipse"
	| "diamond"
	| "line"
	| "arrow"
	| "freehand"
	| "text"
	| "frame"
	| "sticky-note"
	| "kanban"
	| "mindmap"
	| "eraser"
	| "laser"
	| "eyedropper";

export type SkedraCanvasTheme = "light" | "dark";

export type SkedraCanvasChangeHandler = (elements: CanvasElement[]) => void;

export interface SkedraCanvasApi extends SkedraCanvasExtendedApi {
	getElements: () => CanvasElement[];
	setElements: (elements: CanvasElement[]) => void;
	addElements: (elements: CanvasElement[]) => void;
	insertFrame: (
		options?: Partial<Parameters<typeof createSkedraFrameElement>[0]>,
	) => CanvasElement;
	insertStickyNote: (
		options?: Partial<Parameters<typeof createSkedraStickyNoteElement>[0]>,
	) => CanvasElement;
	insertKanbanBoard: (
		options?: Partial<Parameters<typeof createSkedraKanbanBoardElements>[0]>,
	) => CanvasElement[];
	insertKanbanCard: (
		listId: string,
		options?: Partial<Parameters<typeof createSkedraKanbanCardElement>[0]>,
	) => CanvasElement | null;
	insertMindmap: (
		options?: Partial<Parameters<typeof createSkedraMindmapElements>[0]>,
	) => CanvasElement[];
	insertMindmapChild: (
		parentId: string,
		options?: { direction?: "left" | "right" | "up" | "down"; text?: string },
	) => CanvasElement | null;
	insertMindmapSibling: (
		nodeId: string,
		options?: { position?: "before" | "after"; text?: string },
	) => CanvasElement | null;
	insertTemplate: (
		templateId: SkedraSdkTemplateId,
		options?: { x?: number; y?: number },
	) => CanvasElement[];
	clear: () => void;
	getSelectedIds: () => string[];
	setTool: (tool: SkedraSdkTool) => void;
	fitToContent: () => void;
}

export interface SkedraCanvasProps {
	elements?: CanvasElement[];
	defaultElements?: CanvasElement[];
	onChange?: SkedraCanvasChangeHandler;
	readOnly?: boolean;
	showToolbar?: boolean;
	showProperties?: boolean;
	showGrid?: boolean;
	onGridChange?: (enabled: boolean) => void;
	views?: SavedCanvasView[];
	defaultViews?: SavedCanvasView[];
	onViewsChange?: (views: SavedCanvasView[]) => void;
	libraries?: SkedraLibraryFile[];
	defaultLibraries?: SkedraLibraryFile[];
	onLibrariesChange?: (libraries: SkedraLibraryFile[]) => void;
	onSelectionChange?: (selectedIds: string[]) => void;
	onToolChange?: (tool: SkedraSdkTool) => void;
	onViewportChange?: (viewport: Viewport) => void;
	initialTool?: SkedraSdkTool;
	theme?: SkedraCanvasTheme;
	className?: string;
	style?: CSSProperties;
	strokeColor?: string;
	fillColor?: string;
	textPrompt?: (context: {
		currentText: string;
		element: CanvasElement | null;
	}) => string | null;
}

interface Point {
	x: number;
	y: number;
}

type DragState =
	| {
			type: "pan";
			startClient: Point;
			startViewport: Viewport;
	  }
	| {
			type: "select-move";
			startWorld: Point;
			startElements: CanvasElement[];
			moveStart: Map<string, Point>;
	  }
	| {
			type: "selection";
			startWorld: Point;
			currentWorld: Point;
	  }
	| {
			type: "lasso";
			points: Point[];
	  }
	| {
			type: "erase";
			startElements: CanvasElement[];
			erasedIds: Set<string>;
	  }
	| {
			type: "laser";
			points: Point[];
	  }
	| {
			type: "resize";
			handle: "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";
			startWorld: Point;
			startElement: CanvasElement;
	  }
	| {
			type: "draw";
			tool: DrawingTool;
			startWorld: Point;
			points: Point[];
	  };

type DrawingTool =
	| "rectangle"
	| "ellipse"
	| "diamond"
	| "line"
	| "arrow"
	| "freehand"
	| "frame";

interface SdkToolDefinition {
	id: SkedraSdkTool;
	label: string;
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}

// This exhaustive record is the compile-time parity gate for the web/core tool
// contract. Adding a ToolType to canvas-core requires an SDK implementation.
const SDK_CORE_TOOLS: Record<ToolType, SdkToolDefinition> = {
	select: { id: "select", label: "Select", icon: MousePointer2 },
	lasso: { id: "lasso", label: "Lasso", icon: Lasso },
	pan: { id: "pan", label: "Pan", icon: Hand },
	rectangle: { id: "rectangle", label: "Rectangle", icon: Square },
	ellipse: { id: "ellipse", label: "Ellipse", icon: Circle },
	diamond: { id: "diamond", label: "Diamond", icon: Diamond },
	line: { id: "line", label: "Line", icon: Minus },
	arrow: { id: "arrow", label: "Arrow", icon: ArrowRight },
	freehand: { id: "freehand", label: "Freehand", icon: PenLine },
	text: { id: "text", label: "Text", icon: TextCursorInput },
	frame: { id: "frame", label: "Frame", icon: Frame },
	eraser: { id: "eraser", label: "Eraser", icon: Eraser },
	laser: { id: "laser", label: "Laser", icon: Zap },
	eyedropper: { id: "eyedropper", label: "Eyedropper", icon: Pipette },
};

const SDK_TOOLS: SdkToolDefinition[] = [
	...Object.values(SDK_CORE_TOOLS),
	{ id: "sticky-note", label: "Sticky note", icon: StickyNote },
	{ id: "kanban", label: "Kanban board", icon: Kanban },
	{ id: "mindmap", label: "Mindmap", icon: GitBranch },
];

export const SKEDRA_SDK_TOOL_IDS: readonly SkedraSdkTool[] = SDK_TOOLS.map(
	(tool) => tool.id,
);

const SDK_READ_ONLY_TOOLS = new Set<SkedraSdkTool>([
	"select",
	"lasso",
	"pan",
	"laser",
	"eyedropper",
]);

const DEFAULT_STROKE = "#17211d";
const DEFAULT_FILL = "transparent";
const SDK_RESIZE_HANDLES = [
	"nw",
	"n",
	"ne",
	"w",
	"e",
	"sw",
	"s",
	"se",
] as const;
function createId() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `skedra-${Date.now().toString(36)}-${Math.random()
		.toString(36)
		.slice(2)}`;
}

function normalizeClassName(className?: string) {
	return className ? `skedra-sdk ${className}` : "skedra-sdk";
}

function toSvgIdPart(value: string) {
	const normalized = value.replace(/[^A-Za-z0-9_-]/g, "_");
	return normalized.length > 0 ? normalized : "id";
}

function toLocalPoint(
	event: { clientX: number; clientY: number },
	svg: SVGSVGElement,
) {
	const rect = svg.getBoundingClientRect();
	return {
		x: event.clientX - rect.left,
		y: event.clientY - rect.top,
	};
}

function toWorldPoint(
	event: { clientX: number; clientY: number },
	svg: SVGSVGElement,
	viewport: Viewport,
) {
	const rect = svg.getBoundingClientRect();
	return clientPointToCanvas(
		{ x: event.clientX, y: event.clientY },
		{ left: rect.left, top: rect.top },
		viewport,
	);
}

function snapWorldPoint(point: Point, enabled: boolean): Point {
	if (!enabled) return point;
	return {
		x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
		y: Math.round(point.y / GRID_SIZE) * GRID_SIZE,
	};
}

function buildDraftElement(
	drag: Extract<DragState, { type: "draw" }>,
	stroke: string,
	fill: string,
) {
	const end = drag.points[drag.points.length - 1] ?? drag.startWorld;
	return buildCanvasDrawingElement({
		id: "__draft",
		tool: drag.tool,
		start: drag.startWorld,
		end,
		points: drag.points,
		style: { stroke, fill },
	});
}

function pickBrowserFile(accept: string): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = accept;
		input.onchange = () => resolve(input.files?.[0] ?? null);
		input.oncancel = () => resolve(null);
		input.click();
	});
}

export const SkedraCanvas = forwardRef<SkedraCanvasApi, SkedraCanvasProps>(
	function SkedraCanvas(
		{
			elements,
			defaultElements = [],
			onChange,
			readOnly = false,
			showToolbar = true,
			showProperties = true,
			showGrid = true,
			onGridChange,
			views,
			defaultViews = [],
			onViewsChange,
			libraries,
			defaultLibraries = [],
			onLibrariesChange,
			onSelectionChange,
			onToolChange,
			onViewportChange,
			initialTool = "select",
			theme = "light",
			className,
			style,
			strokeColor = DEFAULT_STROKE,
			fillColor = DEFAULT_FILL,
			textPrompt,
		},
		ref,
	) {
		const svgRef = useRef<SVGSVGElement | null>(null);
		const dragRef = useRef<DragState | null>(null);
		const clipboardRef = useRef<CanvasElement[]>([]);
		const historyTransactionRef = useRef<CanvasElement[] | null>(null);
		const undoStackRef = useRef<CanvasElement[][]>([]);
		const redoStackRef = useRef<CanvasElement[][]>([]);
		const reactId = useId();
		const svgIdPrefix = useMemo(
			() => `skedra-sdk-${toSvgIdPart(reactId)}`,
			[reactId],
		);
		const gridPatternId = `${svgIdPrefix}-grid`;
		const isControlled = elements != null;
		const [internalElements, setInternalElements] =
			useState<CanvasElement[]>(defaultElements);
		const [historyRevision, setHistoryRevision] = useState(0);
		const [internalViews, setInternalViews] =
			useState<SavedCanvasView[]>(defaultViews);
		const [internalLibraries, setInternalLibraries] =
			useState<SkedraLibraryFile[]>(defaultLibraries);
		const [gridEnabled, setGridEnabled] = useState(showGrid);
		const [activeViewId, setActiveViewId] = useState<string | null>(null);
		const [presentationViewId, setPresentationViewId] = useState<string | null>(
			null,
		);
		const [tool, setTool] = useState<SkedraSdkTool>(initialTool);
		const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
		const [viewport, setViewport] = useState<Viewport>({
			x: 0,
			y: 0,
			zoom: 1,
		});
		const [draftElement, setDraftElement] = useState<CanvasElement | null>(
			null,
		);
		const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
		const [commandMenuOpen, setCommandMenuOpen] = useState(false);
		const [libraryMenuOpen, setLibraryMenuOpen] = useState(false);
		const [viewMenuOpen, setViewMenuOpen] = useState(false);
		const [exportMenuOpen, setExportMenuOpen] = useState(false);
		const [selectionBox, setSelectionBox] = useState<{
			start: Point;
			end: Point;
		} | null>(null);
		const [lassoPath, setLassoPath] = useState<Point[] | null>(null);
		const [laserTrail, setLaserTrail] = useState<{
			points: Point[];
			finished: boolean;
		} | null>(null);
		const [stroke, setStroke] = useState(strokeColor);
		const [fill, setFill] = useState(fillColor);

		const currentElements = elements ?? internalElements;
		const currentViews = views ?? internalViews;
		const currentLibraries = libraries ?? internalLibraries;
		const scene = useMemo(
			() => CanvasScene.from(currentElements),
			[currentElements],
		);
		const sortedElements = scene.getSortedElements();
		const selectedElements = scene.getSelectedElements(selectedIds);
		const selectionRect = selectionBox
			? normalizeCanvasRect(selectionBox.start, selectionBox.end)
			: null;
		const lassoPathData = lassoPath
			? lassoPathToSvgD(lassoPath.map((point) => [point.x, point.y]))
			: null;

		useEffect(() => {
			if (!laserTrail?.finished) return;
			const timeout = window.setTimeout(() => setLaserTrail(null), 450);
			return () => window.clearTimeout(timeout);
		}, [laserTrail?.finished]);

		useEffect(
			() => onSelectionChange?.([...selectedIds]),
			[onSelectionChange, selectedIds],
		);
		useEffect(() => onToolChange?.(tool), [onToolChange, tool]);
		useEffect(() => onViewportChange?.(viewport), [onViewportChange, viewport]);
		useEffect(() => onGridChange?.(gridEnabled), [gridEnabled, onGridChange]);
		useEffect(() => setGridEnabled(showGrid), [showGrid]);

		const commitElements = useCallback(
			(next: CanvasElement[], recordHistory = true) => {
				if (recordHistory && !historyTransactionRef.current) {
					undoStackRef.current.push(
						currentElements.map((element) => ({ ...element })),
					);
					if (undoStackRef.current.length > 100) undoStackRef.current.shift();
					redoStackRef.current = [];
					setHistoryRevision((value) => value + 1);
				}
				if (!isControlled) {
					setInternalElements(next);
				}
				onChange?.(next);
			},
			[currentElements, isControlled, onChange],
		);

		const applyDerivedUpdates = useCallback((next: CanvasElement[]) => {
			return applyCanvasMutationPlan(next, {
				create: [],
				update: [],
				deleteIds: [],
			});
		}, []);

		const commitCanvasElements = useCallback(
			(next: CanvasElement[], recordHistory = true) => {
				commitElements(applyDerivedUpdates(next), recordHistory);
			},
			[applyDerivedUpdates, commitElements],
		);

		const getViewportCenter = useCallback((): Point => {
			const svg = svgRef.current;
			if (!svg) return { x: 0, y: 0 };
			const rect = svg.getBoundingClientRect();
			return getCanvasViewportCenter(rect, viewport);
		}, [viewport]);

		const addSdkElements = useCallback(
			(nextElements: CanvasElement[]) => {
				const stacked = withSkedraStackIndexes(nextElements, currentElements);
				commitCanvasElements([...currentElements, ...stacked]);
				setSelectedIds(new Set(stacked.map((element) => element.id)));
				return stacked;
			},
			[commitCanvasElements, currentElements],
		);

		const insertFrame = useCallback(
			(
				options: Partial<Parameters<typeof createSkedraFrameElement>[0]> = {},
			) => {
				const point =
					options.x != null && options.y != null
						? { x: options.x, y: options.y }
						: getViewportCenter();
				const [frame] = addSdkElements([
					createSkedraFrameElement({
						x: point.x - (options.width ?? 420) / 2,
						y: point.y - (options.height ?? 280) / 2,
						width: options.width,
						height: options.height,
						label: options.label,
						text: options.text,
						stroke: options.stroke ?? stroke,
						theme,
						createId,
						customData: options.customData,
					}),
				]);
				return frame;
			},
			[addSdkElements, getViewportCenter, stroke, theme],
		);

		const insertStickyNote = useCallback(
			(
				options: Partial<
					Parameters<typeof createSkedraStickyNoteElement>[0]
				> = {},
			) => {
				const point =
					options.x != null && options.y != null
						? { x: options.x, y: options.y }
						: getViewportCenter();
				const [note] = addSdkElements([
					createSkedraStickyNoteElement({
						x: point.x - (options.width ?? 200) / 2,
						y: point.y - (options.height ?? 200) / 2,
						width: options.width,
						height: options.height,
						text: options.text,
						color: options.color,
						frameId: options.frameId,
						theme,
						createId,
						customData: options.customData,
					}),
				]);
				return note;
			},
			[addSdkElements, getViewportCenter, theme],
		);

		const insertKanbanBoard = useCallback(
			(
				options: Partial<
					Parameters<typeof createSkedraKanbanBoardElements>[0]
				> = {},
			) => {
				const point =
					options.x != null && options.y != null
						? { x: options.x, y: options.y }
						: getViewportCenter();
				return addSdkElements(
					createSkedraKanbanBoardElements({
						x: point.x - 450,
						y: point.y - 200,
						lists: options.lists,
						defaultCardTitle: options.defaultCardTitle,
						theme,
						createId,
					}),
				);
			},
			[addSdkElements, getViewportCenter, theme],
		);

		const insertKanbanCard = useCallback(
			(
				listId: string,
				options: Partial<
					Parameters<typeof createSkedraKanbanCardElement>[0]
				> = {},
			) => {
				const list = currentElements.find(
					(element) => element.id === listId && isKanbanList(element),
				);
				if (!list) return null;
				const card = withSkedraStackIndexes(
					[
						createSkedraKanbanCardElement({
							x: list.x + 12,
							y: list.y + list.height + 1000,
							title: options.title,
							listId,
							theme,
							createId,
						}),
					],
					currentElements,
				)[0];
				const plan = planKanbanCardInsertion({
					elements: toCanvasElementMap(currentElements),
					listId,
					card,
				});
				if (!plan) return null;
				commitCanvasElements(applyCanvasMutationPlan(currentElements, plan));
				setSelectedIds(new Set([card.id]));
				return card;
			},
			[commitCanvasElements, currentElements, theme],
		);

		const insertMindmap = useCallback(
			(
				options: Partial<
					Parameters<typeof createSkedraMindmapElements>[0]
				> = {},
			) => {
				const point =
					options.x != null && options.y != null
						? { x: options.x, y: options.y }
						: getViewportCenter();
				return addSdkElements(
					createSkedraMindmapElements({
						x: point.x,
						y: point.y,
						text: options.text,
						branches: options.branches,
						theme,
						createId,
					}),
				);
			},
			[addSdkElements, getViewportCenter, theme],
		);

		const insertMindmapChild = useCallback(
			(
				parentId: string,
				options: {
					direction?: "left" | "right" | "up" | "down";
					text?: string;
				} = {},
			) => {
				const plan = planMindmapChildMutation({
					parentId,
					elements: toCanvasElementMap(currentElements),
					direction: options.direction,
					text: options.text ?? "New node",
					createId,
					appearance: getSkedraMindmapAppearance({ theme }),
					startEditing: false,
				});
				if (!plan) return null;
				const node = plan.create.find(isMindmapNode);
				if (!node) return null;
				commitCanvasElements(applyCanvasMutationPlan(currentElements, plan));
				setSelectedIds(new Set([node.id]));
				return node;
			},
			[commitCanvasElements, currentElements, theme],
		);

		const insertMindmapSibling = useCallback(
			(
				nodeId: string,
				options: { position?: "before" | "after"; text?: string } = {},
			) => {
				const plan = planMindmapSiblingMutation({
					nodeId,
					elements: toCanvasElementMap(currentElements),
					position: options.position,
					text: options.text ?? "New node",
					createId,
					appearance: getSkedraMindmapAppearance({ theme }),
					startEditing: false,
				});
				if (!plan) return null;
				const node = plan.create.find(isMindmapNode);
				if (!node) return null;
				commitCanvasElements(applyCanvasMutationPlan(currentElements, plan));
				setSelectedIds(new Set([node.id]));
				return node;
			},
			[commitCanvasElements, currentElements, theme],
		);

		const insertTemplate = useCallback(
			(
				templateId: SkedraSdkTemplateId,
				options: { x?: number; y?: number } = {},
			) => {
				const point =
					options.x != null && options.y != null
						? { x: options.x, y: options.y }
						: getViewportCenter();
				const inserted = addSdkElements(
					createSkedraTemplateElements(templateId, {
						x: point.x,
						y: point.y,
						theme,
						createId,
					}),
				);
				setTemplateMenuOpen(false);
				return inserted;
			},
			[addSdkElements, getViewportCenter, theme],
		);

		const fitToContent = useCallback(() => {
			const svg = svgRef.current;
			if (!svg) return;
			const bounds = getCombinedBBox(currentElements);
			if (!bounds) {
				setViewport({ x: 0, y: 0, zoom: 1 });
				return;
			}
			setViewport(
				computeViewportForBounds(svg.getBoundingClientRect(), bounds, 72),
			);
		}, [currentElements]);

		const commitViews = useCallback(
			(next: SavedCanvasView[]) => {
				if (views == null) setInternalViews(next);
				onViewsChange?.(next);
			},
			[onViewsChange, views],
		);

		const commitLibraries = useCallback(
			(next: SkedraLibraryFile[]) => {
				if (libraries == null) setInternalLibraries(next);
				onLibrariesChange?.(next);
			},
			[libraries, onLibrariesChange],
		);

		const deleteSelection = useCallback(() => {
			if (selectedIds.size === 0) return;
			const plan = planCanvasDeletion(
				toCanvasElementMap(currentElements),
				selectedIds,
			);
			if (plan.deleteIds.length > 0) {
				commitCanvasElements(applyCanvasMutationPlan(currentElements, plan));
			}
			setSelectedIds(new Set());
		}, [commitCanvasElements, currentElements, selectedIds]);

		const undo = useCallback(() => {
			const previous = undoStackRef.current.pop();
			if (!previous) return;
			redoStackRef.current.push(
				currentElements.map((element) => ({ ...element })),
			);
			commitElements(previous, false);
			setSelectedIds(new Set());
			setHistoryRevision((value) => value + 1);
		}, [commitElements, currentElements]);

		const redo = useCallback(() => {
			const next = redoStackRef.current.pop();
			if (!next) return;
			undoStackRef.current.push(
				currentElements.map((element) => ({ ...element })),
			);
			commitElements(next, false);
			setSelectedIds(new Set());
			setHistoryRevision((value) => value + 1);
		}, [commitElements, currentElements]);

		const copySelection = useCallback(() => {
			const copied = currentElements
				.filter((element) => selectedIds.has(element.id))
				.map((element) => structuredClone(element));
			if (copied.length > 0) {
				clipboardRef.current = copied;
				if (
					typeof navigator !== "undefined" &&
					navigator.clipboard?.writeText
				) {
					void navigator.clipboard
						.writeText(serializeSkedraClipboard(copied))
						.catch(() => undefined);
				}
			}
			return copied;
		}, [currentElements, selectedIds]);

		const pasteElements = useCallback(
			(source: CanvasElement[]) => {
				if (source.length === 0 || readOnly) return [];
				const cloned = cloneCanvasSelection({
					elements: source,
					existingElements: currentElements,
					createId,
				});
				clipboardRef.current = cloned.elements.map((element) =>
					structuredClone(element),
				);
				commitCanvasElements([...currentElements, ...cloned.elements]);
				setSelectedIds(new Set(cloned.elements.map((element) => element.id)));
				return cloned.elements;
			},
			[commitCanvasElements, currentElements, readOnly],
		);

		const pasteSelection = useCallback(
			() => pasteElements(clipboardRef.current),
			[pasteElements],
		);

		const pasteFromClipboard = useCallback(async () => {
			if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
				try {
					const text = await navigator.clipboard.readText();
					clipboardRef.current = parseSkedraClipboard(text);
				} catch {
					// Browser permission or non-Skedra clipboard: use the internal clipboard.
				}
			}
			return pasteElements(clipboardRef.current);
		}, [pasteElements]);

		const cutSelection = useCallback(() => {
			const copied = copySelection();
			if (copied.length > 0) deleteSelection();
			return copied;
		}, [copySelection, deleteSelection]);

		const duplicateSelection = useCallback(() => {
			copySelection();
			return pasteSelection();
		}, [copySelection, pasteSelection]);

		const applySelectedUpdates = useCallback(
			(updates: Array<{ id: string; changes: Partial<CanvasElement> }>) => {
				if (readOnly || updates.length === 0) return;
				commitCanvasElements(
					applyCanvasElementUpdates(currentElements, updates),
				);
			},
			[commitCanvasElements, currentElements, readOnly],
		);

		const alignSelection = useCallback(
			(alignment: SkedraAlignment) => {
				applySelectedUpdates(getAlignmentUpdates(selectedElements, alignment));
			},
			[applySelectedUpdates, selectedElements],
		);

		const distributeSelection = useCallback(
			(axis: SkedraDistribution) => {
				applySelectedUpdates(getDistributionUpdates(selectedElements, axis));
			},
			[applySelectedUpdates, selectedElements],
		);

		const layerSelection = useCallback(
			(command: SkedraLayerCommand) => {
				const builders = {
					"bring-forward": buildBringForwardUpdates,
					"send-backward": buildSendBackwardUpdates,
					"bring-to-front": buildBringToFrontUpdates,
					"send-to-back": buildSendToBackUpdates,
				} as const;
				applySelectedUpdates(builders[command](currentElements, selectedIds));
			},
			[applySelectedUpdates, currentElements, selectedIds],
		);

		const groupSelection = useCallback(() => {
			if (selectedElements.length < 2) return;
			applySelectedUpdates(getGroupUpdates(selectedElements, createId()));
		}, [applySelectedUpdates, selectedElements]);

		const ungroupSelection = useCallback(() => {
			applySelectedUpdates(getGroupUpdates(selectedElements, null));
		}, [applySelectedUpdates, selectedElements]);

		const flipSelection = useCallback(
			(axis: "horizontal" | "vertical") => {
				applySelectedUpdates(getFlipUpdates(selectedElements, axis));
			},
			[applySelectedUpdates, selectedElements],
		);

		const lockSelection = useCallback(
			(locked?: boolean) => {
				applySelectedUpdates(getLockUpdates(selectedElements, locked));
			},
			[applySelectedUpdates, selectedElements],
		);

		const setSelectionProperties = useCallback(
			(properties: Partial<CanvasElement>) => {
				applySelectedUpdates(
					selectedElements.map((element) => ({
						id: element.id,
						changes: properties,
					})),
				);
			},
			[applySelectedUpdates, selectedElements],
		);

		const setGrid = useCallback(
			(enabled: boolean) => setGridEnabled(enabled),
			[],
		);

		const insertImage = useCallback(
			async (source: Blob | string, options: SkedraImageOptions = {}) => {
				const center = getViewportCenter();
				const image = await createSkedraImageElement(source, {
					...options,
					createId: options.createId ?? createId,
				});
				const placed = {
					...image,
					x: options.x ?? center.x - image.width / 2,
					y: options.y ?? center.y - image.height / 2,
				};
				return addSdkElements([placed])[0];
			},
			[addSdkElements, getViewportCenter],
		);

		const cropImage = useCallback(
			(
				id: string,
				crop: { x: number; y: number; width: number; height: number },
			) => {
				const image = currentElements.find((element) => element.id === id);
				if (!image || image.type !== "image") return null;
				const cropped = cropSkedraImage(image, crop);
				commitCanvasElements(
					currentElements.map((element) =>
						element.id === id ? cropped : element,
					),
				);
				return cropped;
			},
			[commitCanvasElements, currentElements],
		);

		const insertLibraryItem = useCallback(
			(item: SkedraLibraryItem, options: { x?: number; y?: number } = {}) => {
				const center = getViewportCenter();
				return addSdkElements(
					instantiateSkedraLibraryItem({
						item,
						existingElements: currentElements,
						x: options.x ?? center.x,
						y: options.y ?? center.y,
						createId,
					}),
				);
			},
			[addSdkElements, currentElements, getViewportCenter],
		);

		const addFlowchartStep = useCallback(
			(nodeId: string, options: SkedraFlowchartStepOptions = {}) => {
				const plan = planFlowchartStepMutation({
					elements: toCanvasElementMap(currentElements),
					nodeId,
					createId,
					...options,
					stroke,
					fontFamily: "Kalam, Comic Sans MS, Segoe Print, cursive",
					startEditing: false,
				});
				if (!plan) return [];
				commitCanvasElements(applyCanvasMutationPlan(currentElements, plan));
				setSelectedIds(new Set(plan.selectedIds ?? []));
				return plan.create;
			},
			[commitCanvasElements, currentElements, stroke],
		);

		const setFlowchartNodeKind = useCallback(
			(nodeId: string, kind: "start" | "step" | "decision" | "end") => {
				const node = currentElements.find((element) => element.id === nodeId);
				if (!node) return;
				applySelectedUpdates([
					{ id: nodeId, changes: buildFlowchartNodeKindChanges(node, kind) },
				]);
			},
			[applySelectedUpdates, currentElements],
		);

		const updateKanbanCard = useCallback(
			(cardId: string, details: SkedraKanbanCardDetails) => {
				const card = currentElements.find((element) => element.id === cardId);
				if (!card || !isKanbanCard(card)) return;
				const { title, ...custom } = details;
				applySelectedUpdates([
					{
						id: cardId,
						changes: {
							text: title ?? card.text,
							customData: { ...(card.customData ?? {}), ...custom },
						},
					},
				]);
			},
			[applySelectedUpdates, currentElements],
		);

		const updateKanbanList = useCallback(
			(
				listId: string,
				details: {
					name?: string;
					description?: string;
					wipLimit?: number | null;
				},
			) => {
				const list = currentElements.find((element) => element.id === listId);
				if (!list || !isKanbanList(list)) return;
				const { name, ...custom } = details;
				applySelectedUpdates([
					{
						id: listId,
						changes: {
							frameLabel: name ?? list.frameLabel,
							customData: { ...(list.customData ?? {}), ...custom },
						},
					},
				]);
			},
			[applySelectedUpdates, currentElements],
		);

		const createView = useCallback(
			(
				view: Omit<SavedCanvasView, "id" | "createdAt" | "updatedAt"> &
					Partial<Pick<SavedCanvasView, "id" | "createdAt" | "updatedAt">>,
			) => {
				const now = Date.now();
				const next: SavedCanvasView = {
					...view,
					id: view.id ?? createId(),
					createdAt: view.createdAt ?? now,
					updatedAt: view.updatedAt ?? now,
				};
				commitViews([...currentViews, next]);
				setActiveViewId(next.id);
				return next;
			},
			[commitViews, currentViews],
		);

		const updateView = useCallback(
			(id: string, updates: Partial<SavedCanvasView>) => {
				commitViews(
					currentViews.map((view) =>
						view.id === id
							? { ...view, ...updates, updatedAt: Date.now() }
							: view,
					),
				);
			},
			[commitViews, currentViews],
		);

		const deleteView = useCallback(
			(id: string) => {
				commitViews(currentViews.filter((view) => view.id !== id));
				if (activeViewId === id) setActiveViewId(null);
				if (presentationViewId === id) setPresentationViewId(null);
			},
			[activeViewId, commitViews, currentViews, presentationViewId],
		);

		const goToView = useCallback(
			(id: string) => {
				const view = currentViews.find((candidate) => candidate.id === id);
				const svg = svgRef.current;
				if (!view || !svg) return;
				setViewport(
					computeViewportForBounds(svg.getBoundingClientRect(), view, 32),
				);
				setActiveViewId(id);
			},
			[currentViews],
		);

		const movePresentation = useCallback(
			(direction: 1 | -1) => {
				if (currentViews.length === 0) return;
				const currentIndex = currentViews.findIndex(
					(view) => view.id === presentationViewId,
				);
				const nextIndex =
					currentIndex < 0
						? 0
						: Math.max(
								0,
								Math.min(currentViews.length - 1, currentIndex + direction),
							);
				const next = currentViews[nextIndex];
				setPresentationViewId(next.id);
				goToView(next.id);
			},
			[currentViews, goToView, presentationViewId],
		);

		const startPresentation = useCallback(
			(startViewId?: string) => {
				const id = startViewId ?? currentViews[0]?.id;
				if (!id) return;
				setPresentationViewId(id);
				goToView(id);
			},
			[currentViews, goToView],
		);

		const exportFile = useCallback(
			() =>
				createSkedraFile({
					elements: currentElements,
					views: currentViews,
					viewport,
				}),
			[currentElements, currentViews, viewport],
		);

		const importFile = useCallback(
			(file: SkedraFile) => {
				commitCanvasElements(file.elements);
				commitViews(file.views ?? []);
				if (file.appState?.viewport) setViewport(file.appState.viewport);
				setSelectedIds(new Set());
			},
			[commitCanvasElements, commitViews],
		);

		const executeCommand = useCallback(
			(command: SkedraCanvasCommandId) => {
				switch (command) {
					case "undo":
						undo();
						break;
					case "redo":
						redo();
						break;
					case "copy":
						copySelection();
						break;
					case "cut":
						cutSelection();
						break;
					case "paste":
						pasteSelection();
						break;
					case "duplicate":
						duplicateSelection();
						break;
					case "delete":
						deleteSelection();
						break;
					case "select-all":
						setSelectedIds(
							new Set(currentElements.map((element) => element.id)),
						);
						break;
					case "group":
						groupSelection();
						break;
					case "ungroup":
						ungroupSelection();
						break;
					case "align-top":
						alignSelection("top");
						break;
					case "align-bottom":
						alignSelection("bottom");
						break;
					case "align-left":
						alignSelection("left");
						break;
					case "align-right":
						alignSelection("right");
						break;
					case "align-horizontal-center":
						alignSelection("horizontal-center");
						break;
					case "align-vertical-center":
						alignSelection("vertical-center");
						break;
					case "distribute-horizontal":
						distributeSelection("horizontal");
						break;
					case "distribute-vertical":
						distributeSelection("vertical");
						break;
					case "bring-forward":
						layerSelection("bring-forward");
						break;
					case "send-backward":
						layerSelection("send-backward");
						break;
					case "bring-to-front":
						layerSelection("bring-to-front");
						break;
					case "send-to-back":
						layerSelection("send-to-back");
						break;
					case "flip-horizontal":
						flipSelection("horizontal");
						break;
					case "flip-vertical":
						flipSelection("vertical");
						break;
					case "toggle-lock":
						lockSelection();
						break;
					case "toggle-grid":
						setGridEnabled((enabled) => !enabled);
						break;
					case "fit-to-content":
						fitToContent();
						break;
				}
			},
			[
				alignSelection,
				copySelection,
				currentElements,
				cutSelection,
				deleteSelection,
				distributeSelection,
				duplicateSelection,
				fitToContent,
				flipSelection,
				groupSelection,
				layerSelection,
				lockSelection,
				pasteSelection,
				redo,
				undo,
				ungroupSelection,
			],
		);

		useImperativeHandle(
			ref,
			() => ({
				getElements: () => currentElements,
				setElements: (next) => {
					commitCanvasElements(next);
					setSelectedIds(new Set());
				},
				addElements: (next) => {
					const stacked = withSkedraStackIndexes(next, currentElements);
					commitCanvasElements([...currentElements, ...stacked]);
					setSelectedIds(new Set(stacked.map((element) => element.id)));
				},
				insertFrame,
				insertStickyNote,
				insertKanbanBoard,
				insertKanbanCard,
				insertMindmap,
				insertMindmapChild,
				insertMindmapSibling,
				insertTemplate,
				clear: () => {
					commitElements([]);
					setSelectedIds(new Set());
				},
				getSelectedIds: () => Array.from(selectedIds),
				setSelectedIds: (ids) => setSelectedIds(new Set(ids)),
				setTool,
				fitToContent,
				canUndo: () => undoStackRef.current.length > 0,
				canRedo: () => redoStackRef.current.length > 0,
				undo,
				redo,
				copy: copySelection,
				cut: cutSelection,
				paste: pasteSelection,
				pasteFromClipboard,
				duplicate: duplicateSelection,
				selectAll: () =>
					setSelectedIds(new Set(currentElements.map((element) => element.id))),
				deleteSelection,
				group: groupSelection,
				ungroup: ungroupSelection,
				align: alignSelection,
				distribute: distributeSelection,
				layer: layerSelection,
				flip: flipSelection,
				setLocked: lockSelection,
				setProperties: setSelectionProperties,
				setGrid,
				getGrid: () => gridEnabled,
				getViewport: () => viewport,
				setViewport,
				insertImage,
				cropImage,
				getLibraries: () => currentLibraries,
				setLibraries: commitLibraries,
				insertLibraryItem,
				addFlowchartStep,
				setFlowchartNodeKind,
				updateKanbanCard,
				updateKanbanList,
				getViews: () => currentViews,
				createView,
				updateView,
				deleteView,
				goToView,
				startPresentation,
				nextView: () => movePresentation(1),
				previousView: () => movePresentation(-1),
				stopPresentation: () => setPresentationViewId(null),
				exportFile,
				importFile,
				executeCommand,
			}),
			[
				addFlowchartStep,
				alignSelection,
				commitCanvasElements,
				commitElements,
				commitLibraries,
				copySelection,
				createView,
				currentElements,
				currentLibraries,
				currentViews,
				cropImage,
				cutSelection,
				deleteSelection,
				deleteView,
				distributeSelection,
				duplicateSelection,
				executeCommand,
				exportFile,
				fitToContent,
				flipSelection,
				goToView,
				gridEnabled,
				groupSelection,
				importFile,
				insertImage,
				insertFrame,
				insertKanbanBoard,
				insertKanbanCard,
				insertMindmap,
				insertMindmapChild,
				insertMindmapSibling,
				insertStickyNote,
				insertTemplate,
				insertLibraryItem,
				layerSelection,
				lockSelection,
				movePresentation,
				pasteSelection,
				pasteFromClipboard,
				redo,
				selectedIds,
				setFlowchartNodeKind,
				setGrid,
				setSelectionProperties,
				startPresentation,
				undo,
				ungroupSelection,
				updateKanbanCard,
				updateKanbanList,
				updateView,
				viewport,
			],
		);

		const beginHistoryTransaction = () => {
			if (!historyTransactionRef.current) {
				historyTransactionRef.current = currentElements.map((element) => ({
					...element,
				}));
			}
		};

		const finishHistoryTransaction = () => {
			const snapshot = historyTransactionRef.current;
			historyTransactionRef.current = null;
			if (!snapshot) return;
			undoStackRef.current.push(snapshot);
			if (undoStackRef.current.length > 100) undoStackRef.current.shift();
			redoStackRef.current = [];
			setHistoryRevision((value) => value + 1);
		};

		const resolveText = useCallback(
			(element: CanvasElement | null) => {
				const currentText = element?.text ?? "Text";
				if (textPrompt) return textPrompt({ currentText, element });
				if (typeof window === "undefined") return currentText;
				return window.prompt("Text", currentText);
			},
			[textPrompt],
		);

		const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
			if (event.button !== 0) return;
			const svg = svgRef.current;
			if (!svg) return;
			svg.setPointerCapture(event.pointerId);
			const world = toWorldPoint(event, svg, viewport);
			const placementWorld = snapWorldPoint(world, gridEnabled);

			if (tool === "pan" || event.altKey) {
				dragRef.current = {
					type: "pan",
					startClient: { x: event.clientX, y: event.clientY },
					startViewport: viewport,
				};
				return;
			}

			if (tool === "laser") {
				const points = [world];
				dragRef.current = { type: "laser", points };
				setLaserTrail({ points, finished: false });
				return;
			}

			if (tool === "eyedropper") {
				const hit = scene.getElementAtPosition(world.x, world.y, {
					tolerance: 6 / viewport.zoom,
				});
				if (hit) {
					setStroke(hit.stroke);
					setFill(hit.fill);
				}
				setTool("select");
				return;
			}

			if (tool === "lasso" || (tool === "select" && event.altKey)) {
				const points = [world];
				dragRef.current = { type: "lasso", points };
				setLassoPath(points);
				setSelectedIds(new Set());
				return;
			}

			if (readOnly && tool !== "select") return;

			if (tool === "eraser") {
				beginHistoryTransaction();
				const drag: Extract<DragState, { type: "erase" }> = {
					type: "erase",
					startElements: currentElements,
					erasedIds: new Set(),
				};
				dragRef.current = drag;
				for (const element of scene.getElementsToEraseAtPosition(
					world.x,
					world.y,
					12 / viewport.zoom,
					drag.erasedIds,
				)) {
					drag.erasedIds.add(element.id);
				}
				if (drag.erasedIds.size > 0) {
					commitCanvasElements(
						applyCanvasMutationPlan(
							drag.startElements,
							planCanvasDeletion(
								toCanvasElementMap(drag.startElements),
								drag.erasedIds,
							),
						),
					);
				}
				setSelectedIds(new Set());
				return;
			}

			if (tool === "text") {
				const text = resolveText(null);
				if (!text) return;
				const id = createId();
				const nextElement = buildCanvasTextElement({
					id,
					point: placementWorld,
					text,
					stroke,
					fontFamily: "Kalam, Comic Sans MS, Segoe Print, cursive",
					stackIndex: createStackIndexAfter(currentElements, id),
				});
				commitCanvasElements([...currentElements, nextElement]);
				setSelectedIds(new Set([nextElement.id]));
				return;
			}

			if (tool === "sticky-note") {
				const [note] = addSdkElements([
					createSkedraStickyNoteElement({
						x: placementWorld.x - 100,
						y: placementWorld.y - 100,
						text: "",
						theme,
						createId,
					}),
				]);
				setSelectedIds(new Set([note.id]));
				return;
			}

			if (tool === "kanban") {
				insertKanbanBoard({ x: placementWorld.x, y: placementWorld.y });
				return;
			}

			if (tool === "mindmap") {
				insertMindmap({ x: placementWorld.x, y: placementWorld.y });
				return;
			}

			if (tool === "select") {
				const hit = scene.getElementAtPosition(world.x, world.y, {
					tolerance: 6 / viewport.zoom,
				});
				if (hit) {
					const nextSelection = selectedIds.has(hit.id)
						? selectedIds
						: new Set([hit.id]);
					setSelectedIds(nextSelection);
					if (readOnly) return;
					beginHistoryTransaction();
					dragRef.current = {
						type: "select-move",
						startWorld: world,
						startElements: currentElements,
						moveStart: new Map(
							Array.from(nextSelection).flatMap((id) => {
								const element = currentElements.find(
									(candidate) => candidate.id === id,
								);
								return element && !element.locked
									? [[id, { x: element.x, y: element.y }] as const]
									: [];
							}),
						),
					};
					return;
				}
				setSelectedIds(new Set());
				dragRef.current = {
					type: "selection",
					startWorld: world,
					currentWorld: world,
				};
				setSelectionBox({ start: world, end: world });
				return;
			}

			if (
				tool !== "rectangle" &&
				tool !== "ellipse" &&
				tool !== "diamond" &&
				tool !== "line" &&
				tool !== "arrow" &&
				tool !== "freehand" &&
				tool !== "frame"
			) {
				return;
			}

			dragRef.current = {
				type: "draw",
				tool,
				startWorld: placementWorld,
				points: [placementWorld],
			};
			beginHistoryTransaction();
			setDraftElement(buildDraftElement(dragRef.current, stroke, fill));
		};

		const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
			const svg = svgRef.current;
			const drag = dragRef.current;
			if (!svg || !drag) return;

			if (drag.type === "pan") {
				setViewport({
					...drag.startViewport,
					x: drag.startViewport.x + event.clientX - drag.startClient.x,
					y: drag.startViewport.y + event.clientY - drag.startClient.y,
				});
				return;
			}

			const rawWorld = toWorldPoint(event, svg, viewport);
			const world = snapWorldPoint(
				rawWorld,
				gridEnabled &&
					(drag.type === "draw" ||
						drag.type === "resize" ||
						drag.type === "select-move"),
			);

			if (drag.type === "resize") {
				const delta = snapWorldPoint(
					{
						x: rawWorld.x - drag.startWorld.x,
						y: rawWorld.y - drag.startWorld.y,
					},
					gridEnabled,
				);
				const changes = resizeCanvasElement(
					drag.startElement,
					drag.handle,
					delta.x,
					delta.y,
				);
				commitCanvasElements(
					currentElements.map((element) =>
						element.id === drag.startElement.id
							? { ...element, ...changes }
							: element,
					),
				);
				return;
			}

			if (drag.type === "laser") {
				const previous = drag.points[drag.points.length - 1];
				if (
					!previous ||
					Math.hypot(world.x - previous.x, world.y - previous.y) > 2
				) {
					drag.points.push(world);
					setLaserTrail({ points: [...drag.points], finished: false });
				}
				return;
			}

			if (drag.type === "lasso") {
				const previous = drag.points[drag.points.length - 1];
				if (
					!previous ||
					Math.hypot(world.x - previous.x, world.y - previous.y) > 2
				) {
					drag.points.push(world);
					const points = [...drag.points];
					setLassoPath(points);
					setSelectedIds(
						new Set(
							CanvasScene.from(currentElements)
								.getElementsInLassoPath(
									points.map((point) => [point.x, point.y]),
								)
								.map((element) => element.id),
						),
					);
				}
				return;
			}

			if (drag.type === "erase") {
				const startScene = CanvasScene.from(drag.startElements);
				for (const element of startScene.getElementsToEraseAtPosition(
					world.x,
					world.y,
					12 / viewport.zoom,
					drag.erasedIds,
				)) {
					drag.erasedIds.add(element.id);
				}
				if (drag.erasedIds.size > 0) {
					commitCanvasElements(
						applyCanvasMutationPlan(
							drag.startElements,
							planCanvasDeletion(
								toCanvasElementMap(drag.startElements),
								drag.erasedIds,
							),
						),
					);
				}
				return;
			}

			if (drag.type === "selection") {
				drag.currentWorld = world;
				setSelectionBox({ start: drag.startWorld, end: world });
				setSelectedIds(
					collectCanvasSelectionRectIds(
						currentElements,
						drag.startWorld,
						world,
					),
				);
				return;
			}

			if (drag.type === "select-move") {
				const delta = snapWorldPoint(
					{
						x: rawWorld.x - drag.startWorld.x,
						y: rawWorld.y - drag.startWorld.y,
					},
					gridEnabled,
				);
				const startMap = toCanvasElementMap(drag.startElements);
				commitElements(
					applyCanvasElementUpdates(
						drag.startElements,
						buildCanvasMoveUpdates(startMap, drag.moveStart, delta.x, delta.y),
					),
				);
				return;
			}

			if (drag.type === "draw") {
				if (drag.tool === "freehand") {
					const previous = drag.points[drag.points.length - 1];
					if (
						!previous ||
						Math.hypot(world.x - previous.x, world.y - previous.y) > 2
					) {
						drag.points.push(world);
					}
				} else {
					drag.points = [drag.startWorld, world];
				}
				setDraftElement(buildDraftElement(drag, stroke, fill));
			}
		};

		const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
			const svg = svgRef.current;
			if (svg?.hasPointerCapture(event.pointerId)) {
				svg.releasePointerCapture(event.pointerId);
			}
			const drag = dragRef.current;
			dragRef.current = null;
			setSelectionBox(null);
			setLassoPath(null);

			if (drag?.type === "laser") {
				setLaserTrail({ points: [...drag.points], finished: true });
				return;
			}

			if (drag?.type === "erase" || drag?.type === "lasso") {
				finishHistoryTransaction();
				return;
			}

			if (drag?.type === "select-move") {
				const elementMap = toCanvasElementMap(currentElements);
				const updates = [
					...buildKanbanDropUpdates(elementMap, drag.moveStart.keys()),
					...buildTemplateDropUpdates(elementMap, drag.moveStart.keys()),
				];
				commitCanvasElements(
					applyCanvasMutationPlan(currentElements, {
						create: [],
						update: updates,
						deleteIds: [],
					}),
				);
				setDraftElement(null);
				finishHistoryTransaction();
				return;
			}

			if (!drag || drag.type !== "draw" || !draftElement) {
				setDraftElement(null);
				finishHistoryTransaction();
				return;
			}

			if (!shouldKeepCanvasDrawing(draftElement)) {
				setDraftElement(null);
				finishHistoryTransaction();
				return;
			}

			const id = createId();
			const nextElement = {
				...draftElement,
				id,
				stackIndex: createStackIndexAfter(currentElements, id),
			};
			commitCanvasElements([...currentElements, nextElement]);
			setSelectedIds(new Set([nextElement.id]));
			setDraftElement(null);
			finishHistoryTransaction();
		};

		const startResize = (
			event: ReactPointerEvent<SVGCircleElement>,
			element: CanvasElement,
			handle: (typeof SDK_RESIZE_HANDLES)[number],
		) => {
			if (readOnly || element.locked) return;
			event.preventDefault();
			event.stopPropagation();
			const svg = svgRef.current;
			if (!svg) return;
			beginHistoryTransaction();
			dragRef.current = {
				type: "resize",
				handle,
				startWorld: toWorldPoint(event, svg, viewport),
				startElement: element,
			};
		};

		const resizeWithKeyboard = (
			event: ReactKeyboardEvent<SVGCircleElement>,
			element: CanvasElement,
			handle: (typeof SDK_RESIZE_HANDLES)[number],
		) => {
			const changes = getCanvasKeyboardResizeChanges({
				element,
				handle,
				key: event.key,
				shiftKey: event.shiftKey,
				readOnly,
			});
			if (!changes) return;
			event.preventDefault();
			commitCanvasElements(
				currentElements.map((current) =>
					current.id === element.id ? { ...current, ...changes } : current,
				),
			);
		};

		const handleDoubleClick = (event: ReactMouseEvent<SVGSVGElement>) => {
			if (readOnly) return;
			const svg = svgRef.current;
			if (!svg) return;
			const world = toWorldPoint(event, svg, viewport);
			const hit = scene.getElementAtPosition(world.x, world.y, {
				tolerance: 6 / viewport.zoom,
			});
			if (!hit) return;
			const currentText =
				hit.type === "frame"
					? (hit.frameLabel ?? hit.text ?? "")
					: (hit.text ?? "");
			const nextText = textPrompt
				? textPrompt({ currentText, element: hit })
				: typeof window === "undefined"
					? currentText
					: window.prompt(
							isKanbanCard(hit)
								? "Card title"
								: isKanbanList(hit)
									? "List title"
									: isMindmapNode(hit)
										? "Mindmap node"
										: "Text",
							currentText,
						);
			if (nextText == null) return;
			commitCanvasElements(
				currentElements.map((element) =>
					element.id === hit.id
						? {
								...element,
								...buildCanvasTextUpdate({
									element,
									text: nextText,
									fontFamily: "Kalam, Comic Sans MS, Segoe Print, cursive",
									size:
										element.type === "text"
											? {
													width: Math.max(56, nextText.length * 11),
													height: element.height,
												}
											: undefined,
								}),
							}
						: element,
				),
			);
		};

		const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
			const svg = svgRef.current;
			if (!svg) return;
			event.preventDefault();
			if (event.ctrlKey || event.metaKey) {
				const local = toLocalPoint(event, svg);
				setViewport(
					zoomCanvasViewportAtPoint(
						viewport,
						local,
						viewport.zoom * Math.exp((-event.deltaY / 100) * 0.18),
					),
				);
				return;
			}
			setViewport((current) => ({
				...current,
				x: current.x - event.deltaX,
				y: current.y - event.deltaY,
			}));
		};

		const clearSelected = deleteSelection;

		useEffect(() => {
			if (readOnly) return;

			const handleKeyDown = (event: globalThis.KeyboardEvent) => {
				const target = event.target as HTMLElement | null;
				if (
					target?.closest("input, textarea, select, [contenteditable='true']")
				) {
					return;
				}
				const ctrl = event.ctrlKey || event.metaKey;
				const key = event.key.toLowerCase();
				let sdkCommand: SkedraCanvasCommandId | null = null;
				if (ctrl && key === "c" && !event.altKey) sdkCommand = "copy";
				else if (ctrl && key === "x" && !event.altKey) sdkCommand = "cut";
				else if (ctrl && key === "v" && !event.altKey) sdkCommand = "paste";
				else if (ctrl && key === "d" && !event.altKey) sdkCommand = "duplicate";
				else if (ctrl && !event.shiftKey && key === "g") sdkCommand = "group";
				else if (ctrl && event.shiftKey && key === "g") sdkCommand = "ungroup";
				else if (ctrl && event.shiftKey && key === "l")
					sdkCommand = "toggle-lock";
				else if (ctrl && event.key === "]") {
					sdkCommand = event.shiftKey ? "bring-to-front" : "bring-forward";
				} else if (ctrl && event.key === "[") {
					sdkCommand = event.shiftKey ? "send-to-back" : "send-backward";
				} else if (!ctrl && event.shiftKey && key === "h") {
					sdkCommand = "flip-horizontal";
				} else if (!ctrl && event.shiftKey && key === "v") {
					sdkCommand = "flip-vertical";
				}
				if (sdkCommand) {
					event.preventDefault();
					if (sdkCommand === "paste") void pasteFromClipboard();
					else executeCommand(sdkCommand);
					return;
				}
				const command = getCanvasKeyboardCommand(event);
				if (!command) return;
				if (command === "delete-selection" && selectedIds.size > 0) {
					event.preventDefault();
					clearSelected();
				} else if (command === "clear-canvas") {
					event.preventDefault();
					commitElements([]);
					setSelectedIds(new Set());
				} else if (command === "select-all") {
					event.preventDefault();
					setSelectedIds(new Set(currentElements.map((element) => element.id)));
				} else if (command === "escape") {
					setSelectedIds(new Set());
					setTool("select");
				} else if (command === "undo") {
					event.preventDefault();
					undo();
				} else if (command === "redo") {
					event.preventDefault();
					redo();
				}
			};

			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}, [
			clearSelected,
			commitElements,
			currentElements,
			executeCommand,
			pasteFromClipboard,
			readOnly,
			redo,
			selectedIds.size,
			undo,
		]);

		const insertTemplateSticky = useCallback(
			(sectionId: string) => {
				const section = currentElements.find(
					(element) =>
						element.id === sectionId &&
						element.customData?.skedraType === "template-section",
				);
				if (!section) return null;
				const note = createCanvasTemplateStickyNote({
					defaults: getSkedraElementFactoryDefaults({ theme, createId }),
					section,
					existingElements: currentElements,
				});
				if (!note) return null;
				const [stacked] = withSkedraStackIndexes([note], currentElements);
				const next = [...currentElements, stacked];
				const updates = buildTemplateSectionLayoutSyncUpdates(
					toCanvasElementMap(next),
				);
				commitCanvasElements(
					applyCanvasMutationPlan(next, {
						create: [],
						update: updates,
						deleteIds: [],
					}),
				);
				setSelectedIds(new Set([stacked.id]));
				return stacked;
			},
			[commitCanvasElements, currentElements, theme],
		);

		const rendererConfig = useMemo<CanvasRendererConfig>(
			() => ({
				interactive: !readOnly,
				svgIdPrefix,
				actions: {
					addKanbanCard: insertKanbanCard,
					addTemplateSticky: insertTemplateSticky,
				},
			}),
			[insertKanbanCard, insertTemplateSticky, readOnly, svgIdPrefix],
		);
		const draftRendererConfig = useMemo<CanvasRendererConfig>(
			() => ({ ...rendererConfig, interactive: false }),
			[rendererConfig],
		);

		const pickAndInsertImage = async () => {
			const file = await pickBrowserFile("image/*");
			if (file) await insertImage(file, { name: file.name });
		};

		const pickAndImportDocument = async () => {
			const file = await pickBrowserFile(
				".skedra,.skedra.enc,application/json,application/vnd.skedra+json",
			);
			if (!file) return;
			const raw = await file.text();
			const encrypted = raw.includes("skedra-encrypted");
			const passphrase = encrypted
				? (window.prompt("Passphrase") ?? undefined)
				: undefined;
			importFile(await parseSkedraFileContents(raw, passphrase));
		};

		const downloadDocument = async (encrypted: boolean) => {
			const file = exportFile();
			if (!encrypted) {
				downloadSkedraBlob(
					new Blob([serializeSkedraFile(file)], {
						type: "application/vnd.skedra+json",
					}),
					"skedra-whiteboard.skedra",
				);
				return;
			}
			const passphrase = window.prompt("Passphrase for encrypted export");
			if (!passphrase) return;
			const secured = await encryptSkedraFile(file, passphrase);
			downloadSkedraBlob(
				new Blob([JSON.stringify(secured, null, 2)], {
					type: "application/vnd.skedra+json",
				}),
				"skedra-whiteboard.skedra.enc",
			);
		};

		const downloadVisual = async (format: "svg" | "png" | "pdf" | "pptx") => {
			const svg = svgRef.current;
			if (!svg) return;
			const blob = await exportSkedraVisual(svg, format);
			downloadSkedraBlob(blob, `skedra-whiteboard.${format}`);
		};

		const pickAndAddLibrary = async () => {
			const file = await pickBrowserFile(
				".skedralib,.excalidrawlib,application/json",
			);
			if (!file) return;
			commitLibraries([
				...currentLibraries,
				parseSkedraLibrary(await file.text()),
			]);
		};

		const saveSelectionToLibrary = () => {
			if (selectedElements.length === 0) return;
			const name = window.prompt("Shape name", "New shape") ?? "New shape";
			const item = createSkedraLibraryItem({
				elements: selectedElements,
				name,
			});
			const personal = currentLibraries.find(
				(library) => library.name === "Personal",
			);
			if (personal) {
				commitLibraries(
					currentLibraries.map((library) =>
						library === personal
							? { ...library, items: [...library.items, item] }
							: library,
					),
				);
			} else {
				commitLibraries([
					...currentLibraries,
					createSkedraLibraryFile([item], { name: "Personal" }),
				]);
			}
		};

		const downloadLibraries = () => {
			const combined = createSkedraLibraryFile(
				currentLibraries.flatMap((library) => library.items),
				{ name: "Skedra libraries" },
			);
			downloadSkedraBlob(
				new Blob([serializeSkedraLibrary(combined)], {
					type: "application/vnd.skedra.library+json",
				}),
				"skedra-library.skedralib",
			);
		};

		const captureCurrentView = () => {
			const rect = svgRef.current?.getBoundingClientRect();
			if (!rect) return;
			createView({
				name: `View ${currentViews.length + 1}`,
				x: -viewport.x / viewport.zoom,
				y: -viewport.y / viewport.zoom,
				width: rect.width / viewport.zoom,
				height: rect.height / viewport.zoom,
			});
		};

		return (
			<div
				className={normalizeClassName(className)}
				style={style}
				data-theme={theme}
				data-history-revision={historyRevision}
			>
				{showToolbar && !presentationViewId && (
					<div className="skedra-sdk__toolbar" role="toolbar">
						{SDK_TOOLS.map((entry) => {
							const Icon = entry.icon;
							return (
								<button
									key={entry.id}
									type="button"
									className="skedra-sdk__tool"
									data-active={tool === entry.id}
									title={entry.label}
									aria-label={entry.label}
									disabled={readOnly && !SDK_READ_ONLY_TOOLS.has(entry.id)}
									onClick={() => {
										setTemplateMenuOpen(false);
										setTool(entry.id);
									}}
								>
									<Icon size={17} strokeWidth={2} />
								</button>
							);
						})}
						<div className="skedra-sdk__template-menu">
							<button
								type="button"
								className="skedra-sdk__tool"
								title="Templates"
								aria-label="Templates"
								disabled={readOnly}
								data-active={templateMenuOpen}
								onClick={() => {
									setTool("select");
									setTemplateMenuOpen((open) => !open);
								}}
							>
								<LayoutTemplate size={17} strokeWidth={2} />
							</button>
							{templateMenuOpen && (
								<div className="skedra-sdk__template-popover">
									{SKEDRA_TEMPLATES.map((template) => (
										<button
											key={template.id}
											type="button"
											className="skedra-sdk__template-item"
											onClick={() => insertTemplate(template.id)}
										>
											<span>{template.name}</span>
											<Plus size={14} strokeWidth={2} />
										</button>
									))}
								</div>
							)}
						</div>
						<button
							type="button"
							className="skedra-sdk__tool"
							title="Insert image"
							aria-label="Insert image"
							disabled={readOnly}
							onClick={() => void pickAndInsertImage()}
						>
							<ImagePlus size={17} strokeWidth={2} />
						</button>
						<div className="skedra-sdk__template-menu">
							<button
								type="button"
								className="skedra-sdk__tool"
								title="Shape libraries"
								aria-label="Shape libraries"
								data-active={libraryMenuOpen}
								onClick={() => setLibraryMenuOpen((open) => !open)}
							>
								<Library size={17} strokeWidth={2} />
							</button>
							{libraryMenuOpen && (
								<div className="skedra-sdk__template-popover skedra-sdk__menu-wide">
									<button
										type="button"
										className="skedra-sdk__template-item"
										onClick={() => void pickAndAddLibrary()}
									>
										Import library
									</button>
									<button
										type="button"
										className="skedra-sdk__template-item"
										disabled={currentLibraries.length === 0}
										onClick={downloadLibraries}
									>
										Export libraries
									</button>
									<button
										type="button"
										className="skedra-sdk__template-item"
										disabled={selectedElements.length === 0}
										onClick={saveSelectionToLibrary}
									>
										Save selection
									</button>
									{currentLibraries.flatMap((library) =>
										library.items.map((item) => (
											<button
												key={`${library.name ?? library.source ?? "library"}-${item.id}`}
												type="button"
												className="skedra-sdk__template-item"
												onClick={() => {
													insertLibraryItem(item);
													setLibraryMenuOpen(false);
												}}
											>
												{item.name ?? "Shape"}
												<Plus size={14} />
											</button>
										)),
									)}
								</div>
							)}
						</div>
						<div className="skedra-sdk__template-menu">
							<button
								type="button"
								className="skedra-sdk__tool"
								title="Edit commands"
								aria-label="Edit commands"
								data-active={commandMenuOpen}
								onClick={() => setCommandMenuOpen((open) => !open)}
							>
								<Copy size={17} />
							</button>
							{commandMenuOpen && (
								<div className="skedra-sdk__template-popover skedra-sdk__command-grid">
									{(
										[
											["Copy", "copy"],
											["Cut", "cut"],
											["Paste", "paste"],
											["Duplicate", "duplicate"],
											["Group", "group"],
											["Ungroup", "ungroup"],
											["Align left", "align-left"],
											["Align right", "align-right"],
											["Align top", "align-top"],
											["Align bottom", "align-bottom"],
											["Distribute horizontal", "distribute-horizontal"],
											["Distribute vertical", "distribute-vertical"],
											["Bring forward", "bring-forward"],
											["Send backward", "send-backward"],
											["Bring to front", "bring-to-front"],
											["Send to back", "send-to-back"],
											["Flip horizontal", "flip-horizontal"],
											["Flip vertical", "flip-vertical"],
										] as const
									).map(([label, command]) => (
										<button
											key={command}
											type="button"
											className="skedra-sdk__template-item"
											onClick={() => executeCommand(command)}
										>
											{label}
										</button>
									))}
								</div>
							)}
						</div>
						<div className="skedra-sdk__template-menu">
							<button
								type="button"
								className="skedra-sdk__tool"
								title="Saved views and presentation"
								aria-label="Saved views and presentation"
								data-active={viewMenuOpen}
								onClick={() => setViewMenuOpen((open) => !open)}
							>
								<Frame size={17} />
							</button>
							{viewMenuOpen && (
								<div className="skedra-sdk__template-popover skedra-sdk__menu-wide">
									<button
										type="button"
										className="skedra-sdk__template-item"
										onClick={captureCurrentView}
									>
										Save current view
									</button>
									<button
										type="button"
										className="skedra-sdk__template-item"
										disabled={currentViews.length === 0}
										onClick={() => startPresentation()}
									>
										Start presentation
									</button>
									{currentViews.map((view) => (
										<div key={view.id} className="skedra-sdk__view-row">
											<button type="button" onClick={() => goToView(view.id)}>
												{view.name}
											</button>
											<button
												type="button"
												aria-label={`Rename ${view.name}`}
												onClick={() => {
													const name = window.prompt("View name", view.name);
													if (name?.trim())
														updateView(view.id, { name: name.trim() });
												}}
											>
												Rename
											</button>
											<button
												type="button"
												aria-label={`Edit notes for ${view.name}`}
												onClick={() => {
													const notes = window.prompt(
														"Presenter notes",
														view.presenterNotes ?? "",
													);
													if (notes != null)
														updateView(view.id, {
															presenterNotes: notes || undefined,
														});
												}}
											>
												Notes
											</button>
											<button
												type="button"
												aria-label={`Delete ${view.name}`}
												onClick={() => deleteView(view.id)}
											>
												Delete
											</button>
										</div>
									))}
								</div>
							)}
						</div>
						<div className="skedra-sdk__template-menu">
							<button
								type="button"
								className="skedra-sdk__tool"
								title="Import and export"
								aria-label="Import and export"
								data-active={exportMenuOpen}
								onClick={() => setExportMenuOpen((open) => !open)}
							>
								<Download size={17} />
							</button>
							{exportMenuOpen && (
								<div className="skedra-sdk__template-popover skedra-sdk__export-menu">
									<button
										type="button"
										className="skedra-sdk__template-item"
										onClick={() => void pickAndImportDocument()}
									>
										Import .skedra
									</button>
									<button
										type="button"
										className="skedra-sdk__template-item"
										onClick={() => void downloadDocument(false)}
									>
										Export .skedra
									</button>
									<button
										type="button"
										className="skedra-sdk__template-item"
										onClick={() => void downloadDocument(true)}
									>
										Export encrypted
									</button>
									{(["svg", "png", "pdf", "pptx"] as const).map((format) => (
										<button
											key={format}
											type="button"
											className="skedra-sdk__template-item"
											onClick={() => void downloadVisual(format)}
										>
											Export {format.toUpperCase()}
										</button>
									))}
								</div>
							)}
						</div>
						<button
							type="button"
							className="skedra-sdk__tool"
							title="Undo"
							aria-label="Undo"
							disabled={undoStackRef.current.length === 0}
							onClick={undo}
						>
							<Undo2 size={17} />
						</button>
						<button
							type="button"
							className="skedra-sdk__tool"
							title="Redo"
							aria-label="Redo"
							disabled={redoStackRef.current.length === 0}
							onClick={redo}
						>
							<Redo2 size={17} />
						</button>
						<button
							type="button"
							className="skedra-sdk__tool"
							title="Grid"
							aria-label="Grid"
							data-active={gridEnabled}
							onClick={() => setGridEnabled((enabled) => !enabled)}
						>
							<Grid3X3 size={17} />
						</button>
						<div className="skedra-sdk__divider" />
						<label className="skedra-sdk__color" title="Stroke color">
							<input
								type="color"
								value={stroke}
								aria-label="Stroke color"
								onChange={(event) => setStroke(event.target.value)}
							/>
						</label>
						<label className="skedra-sdk__color" title="Fill color">
							<input
								type="color"
								value={fill === "transparent" ? "#ffffff" : fill}
								aria-label="Fill color"
								onChange={(event) => setFill(event.target.value)}
							/>
						</label>
						<button
							type="button"
							className="skedra-sdk__clear-fill"
							title="Transparent fill"
							aria-label="Transparent fill"
							onClick={() => setFill("transparent")}
						>
							/
						</button>
						<div className="skedra-sdk__divider" />
						<button
							type="button"
							className="skedra-sdk__tool"
							title="Delete selection"
							aria-label="Delete selection"
							disabled={readOnly || selectedIds.size === 0}
							onClick={clearSelected}
						>
							<Trash2 size={17} strokeWidth={2} />
						</button>
					</div>
				)}
				<svg
					ref={svgRef}
					className="skedra-sdk__surface"
					data-tool={tool}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onDoubleClick={handleDoubleClick}
					onWheel={handleWheel}
				>
					<title>Skedra canvas</title>
					<defs>
						<pattern
							id={gridPatternId}
							width={GRID_SIZE}
							height={GRID_SIZE}
							patternUnits="userSpaceOnUse"
						>
							<path
								d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
								fill="none"
								stroke="currentColor"
								strokeOpacity="0.08"
								strokeWidth="1"
							/>
						</pattern>
					</defs>
					{gridEnabled && (
						<rect
							width="100%"
							height="100%"
							fill={`url(#${gridPatternId})`}
							data-skedra-ui="grid"
						/>
					)}
					<g
						transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}
						data-skedra-elements="true"
					>
						<CanvasRendererProvider config={rendererConfig}>
							{sortedElements.map((element) => (
								<CanvasElementRenderer
									key={element.id}
									element={element}
									isEditingText={false}
								/>
							))}
							{draftElement && (
								<CanvasRendererProvider config={draftRendererConfig}>
									<CanvasElementRenderer
										element={{
											...draftElement,
											opacity: draftElement.opacity * 0.72,
										}}
										isEditingText={false}
									/>
								</CanvasRendererProvider>
							)}
						</CanvasRendererProvider>
						{selectedElements.map((element) => {
							const bbox = getBBox(element);
							return (
								<rect
									key={`selected-${element.id}`}
									className="skedra-sdk__selected-outline"
									x={bbox.x - 4 / viewport.zoom}
									y={bbox.y - 4 / viewport.zoom}
									width={bbox.width + 8 / viewport.zoom}
									height={bbox.height + 8 / viewport.zoom}
									strokeWidth={1.5 / viewport.zoom}
									rx={3 / viewport.zoom}
								/>
							);
						})}
						{!readOnly &&
							selectedElements.length === 1 &&
							!selectedElements[0].locked &&
							SDK_RESIZE_HANDLES.map((handle) => {
								const element = selectedElements[0];
								const bbox = getBBox(element);
								const x = handle.includes("w")
									? bbox.x
									: handle.includes("e")
										? bbox.x + bbox.width
										: bbox.x + bbox.width / 2;
								const y = handle.includes("n")
									? bbox.y
									: handle.includes("s")
										? bbox.y + bbox.height
										: bbox.y + bbox.height / 2;
								return (
									<circle
										key={`resize-${element.id}-${handle}`}
										cx={x}
										cy={y}
										r={5 / viewport.zoom}
										fill="var(--skedra-sdk-background, #fff)"
										stroke="var(--skedra-sdk-accent, #2563eb)"
										strokeWidth={1.5 / viewport.zoom}
										role="button"
										data-skedra-ui="resize-handle"
										tabIndex={0}
										aria-label={`Resize ${handle}`}
										onPointerDown={(event) =>
											startResize(event, element, handle)
										}
										onKeyDown={(event) =>
											resizeWithKeyboard(event, element, handle)
										}
									/>
								);
							})}
						{selectionRect && (
							<rect
								className="skedra-sdk__selection"
								x={selectionRect.x}
								y={selectionRect.y}
								width={selectionRect.width}
								height={selectionRect.height}
								strokeWidth={1 / viewport.zoom}
							/>
						)}
						{lassoPathData && (
							<path
								className="skedra-sdk__lasso"
								d={lassoPathData}
								strokeWidth={1.5 / viewport.zoom}
							/>
						)}
						{laserTrail && laserTrail.points.length > 1 && (
							<polyline
								className="skedra-sdk__laser"
								data-finished={laserTrail.finished}
								points={laserTrail.points
									.map((point) => `${point.x},${point.y}`)
									.join(" ")}
								strokeWidth={4 / viewport.zoom}
							/>
						)}
						{!readOnly &&
							selectedElements.map((element) =>
								isMindmapNode(element) ? (
									<SdkMindmapActions
										key={`mindmap-actions-${element.id}`}
										element={element}
										viewport={viewport}
										onInsertChild={insertMindmapChild}
									/>
								) : null,
							)}
					</g>
				</svg>
				{showProperties && !presentationViewId && (
					<SkedraPropertiesPanel
						selected={selectedElements}
						readOnly={readOnly}
						onSetProperties={setSelectionProperties}
						onDelete={deleteSelection}
						onGroup={groupSelection}
						onUngroup={ungroupSelection}
						onAlign={alignSelection}
						onDistribute={distributeSelection}
						onLayer={layerSelection}
						onFlip={flipSelection}
						onLock={lockSelection}
						onCropImage={(id, crop) => {
							cropImage(id, crop);
						}}
						onAddFlowchartStep={(nodeId, options) => {
							addFlowchartStep(nodeId, options);
						}}
						onSetFlowchartNodeKind={setFlowchartNodeKind}
						onUpdateKanbanCard={updateKanbanCard}
						onUpdateKanbanList={updateKanbanList}
					/>
				)}
				{presentationViewId && (
					<div
						className="skedra-sdk__presentation"
						role="toolbar"
						aria-label="Presentation controls"
					>
						<button type="button" onClick={() => movePresentation(-1)}>
							Previous
						</button>
						<span>
							{currentViews.find((view) => view.id === presentationViewId)
								?.name ?? "Presentation"}
						</span>
						<button type="button" onClick={() => movePresentation(1)}>
							Next
						</button>
						<button type="button" onClick={() => setPresentationViewId(null)}>
							Exit
						</button>
					</div>
				)}
			</div>
		);
	},
);
