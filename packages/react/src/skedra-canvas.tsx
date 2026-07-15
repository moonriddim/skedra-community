import {
	CanvasScene,
	GRID_SIZE,
	type HandlePosition,
	type SnapGuide,
	type SnapPointIndicator,
	applyCanvasElementUpdates,
	applyCanvasMutationPlan,
	buildBringForwardUpdates,
	buildBringToFrontUpdates,
	buildCanvasPathInsertPointChanges,
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
	computeViewportForBounds,
	createCanvasTemplateStickyNote,
	createStackIndexAfter,
	getAlignmentUpdates,
	getCanvasKeyboardResizeChanges,
	getCanvasViewportCenter,
	getCombinedBBox,
	getCornerRadiusPercent,
	getDistributionUpdates,
	getFlipUpdates,
	getFlowchartRouteForDirection,
	getGroupUpdates,
	getLockUpdates,
	isCanvasTextEditableElement,
	isFlowchartNode,
	isKanbanCard,
	isKanbanList,
	isMindmapNode,
	navigateFlowchartInDirection,
	normalizeCanvasRect,
	planCanvasDeletion,
	planFlowchartStepMutation,
	planKanbanCardInsertion,
	planMindmapChildMutation,
	planMindmapSiblingMutation,
	toCanvasElementMap,
	zoomCanvasViewportAtPoint,
} from "@skedra/canvas-core";
import type { CanvasPathDrawMode as CoreCanvasPathDrawMode } from "@skedra/canvas-core";
import {
	CANVAS_EDITOR_TOOL_IDS,
	CanvasEditor,
	CanvasEditorGridOverlay,
	CanvasEditorImageCropOverlay,
	CanvasEditorSavedViewDraft,
	CanvasEditorSavedViewOverlay,
	CanvasEditorSavedViewsBar,
	CanvasEditorSelectionGestureOverlay,
	CanvasEditorSelectionOverlay,
	CanvasEditorSnapOverlay,
	CanvasEditorStickyNoteOverlay,
	CanvasEditorSurface,
	CanvasEditorTextOverlay,
	CanvasEditorToolbar,
	CanvasPathStartSnapIndicator,
	buildCanvasEditorDefaultsElement,
	buildCanvasEditorEditingSession,
	isCanvasEditorToolAvailableReadOnly,
	normalizeCanvasEditorStickyChecklist,
	resolveCanvasEditorPointSnap,
	toggleCanvasEditorStickyChecklistItem,
	useCanvasEditorKeyboard,
	useCanvasEditorPointer,
	useCanvasEditorSavedViews,
} from "@skedra/canvas-editor";
import type {
	CanvasEditorDocumentAdapter,
	CanvasEditorElementStyle,
	CanvasEditorSavedViewPreviewRenderer,
	CanvasEditorToolId,
	CanvasEditorToolbarItem,
} from "@skedra/canvas-editor";
import type {
	CanvasEditorPendingText,
	CanvasEditorStickyChecklistItem,
	CanvasEditorStickyNoteMode,
} from "@skedra/canvas-editor";
import {
	CanvasElementRenderer,
	CanvasRenderer,
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
	Lock,
	Magnet,
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
	Unlock,
	Zap,
} from "lucide-react";
import {
	type CSSProperties,
	type ComponentType,
	type KeyboardEvent as ReactKeyboardEvent,
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
	forwardRef,
	useCallback,
	useEffect,
	useId,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { flushSync } from "react-dom";
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
import {
	type SkedraSdkKeyboardActionHandlers,
	handleSkedraSdkKeyboardAction,
} from "./keyboard-actions.js";
import { SdkMindmapActions } from "./mindmap-actions.js";
import { SkedraPropertiesPanel } from "./properties-panel.js";
import type {
	ArrowMode,
	CanvasElement,
	SavedCanvasView,
	Viewport,
} from "./types.js";

export type SkedraSdkTool =
	| "select"
	| "lasso"
	| "pan"
	| "rectangle"
	| "diamond"
	| "ellipse"
	| "arrow"
	| "line"
	| "freehand"
	| "text"
	| "frame"
	| "eraser"
	| "laser"
	| "eyedropper"
	| "sticky-note"
	| "kanban"
	| "mindmap";

type IsExact<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends <
	Value,
>() => Value extends Right ? 1 : 2
	? true
	: false;
const sdkToolParity: IsExact<SkedraSdkTool, CanvasEditorToolId> = true;
void sdkToolParity;

export type SkedraCanvasTheme = "light" | "dark";
export type SkedraPathDrawMode = "normal" | "multi";

const sdkPathDrawModeParity: Record<
	SkedraPathDrawMode,
	CoreCanvasPathDrawMode
> = {
	normal: "normal",
	multi: "multi",
};
const corePathDrawModeParity: Record<
	CoreCanvasPathDrawMode,
	SkedraPathDrawMode
> = sdkPathDrawModeParity;
void sdkPathDrawModeParity;
void corePathDrawModeParity;

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
	setPathDrawMode: (mode: SkedraPathDrawMode) => void;
	setPathMode: (mode: ArrowMode) => void;
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
	onPathDrawModeChange?: (mode: SkedraPathDrawMode) => void;
	onPathModeChange?: (mode: ArrowMode) => void;
	onViewportChange?: (viewport: Viewport) => void;
	onThemeChange?: (theme: SkedraCanvasTheme) => void;
	onZenModeChange?: (enabled: boolean) => void;
	onHelpRequest?: () => void;
	onCommandPaletteRequest?: () => void;
	onFindOnCanvasRequest?: () => void;
	initialTool?: SkedraSdkTool;
	initialPathDrawMode?: SkedraPathDrawMode;
	initialPathMode?: ArrowMode;
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

type SdkFormatClipboard = Pick<
	CanvasElement,
	| "stroke"
	| "fill"
	| "strokeWidth"
	| "strokeStyle"
	| "opacity"
	| "fontSize"
	| "fontFamily"
	| "arrowHeadScale"
	| "arrowHeadFilled"
> & { cornerRadiusPercent?: number };

interface SdkToolDefinition {
	id: SkedraSdkTool;
	label: string;
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}

const SDK_TOOL_ICONS: Record<CanvasEditorToolId, SdkToolDefinition["icon"]> = {
	select: MousePointer2,
	lasso: Lasso,
	pan: Hand,
	rectangle: Square,
	ellipse: Circle,
	diamond: Diamond,
	line: Minus,
	arrow: ArrowRight,
	freehand: PenLine,
	text: TextCursorInput,
	frame: Frame,
	eraser: Eraser,
	laser: Zap,
	eyedropper: Pipette,
	"sticky-note": StickyNote,
	kanban: Kanban,
	mindmap: GitBranch,
};

export const SKEDRA_SDK_TOOL_IDS: readonly SkedraSdkTool[] =
	CANVAS_EDITOR_TOOL_IDS;

const DEFAULT_STROKE = "#17211d";
const DEFAULT_FILL = "transparent";
const EMPTY_SAVED_VIEW_SELECTION = new Set<string>();
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
			onPathDrawModeChange,
			onPathModeChange,
			onViewportChange,
			onThemeChange,
			onZenModeChange,
			onHelpRequest,
			onCommandPaletteRequest,
			onFindOnCanvasRequest,
			initialTool = "select",
			initialPathDrawMode = "normal",
			initialPathMode = "straight",
			theme: themeProp = "light",
			className,
			style,
			strokeColor = DEFAULT_STROKE,
			fillColor = DEFAULT_FILL,
			textPrompt,
		},
		ref,
	) {
		const svgRef = useRef<SVGSVGElement | null>(null);
		const rootRef = useRef<HTMLDivElement | null>(null);
		const spacePressedRef = useRef(false);
		const clipboardRef = useRef<CanvasElement[]>([]);
		const formatClipboardRef = useRef<SdkFormatClipboard | null>(null);
		const eyedropperTargetRef = useRef<"stroke" | "fill">("stroke");
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
		const [theme, setTheme] = useState(themeProp);
		const [zenMode, setZenMode] = useState(false);
		const [snapToObjects, setSnapToObjects] = useState(true);
		const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
		const [snapPointIndicators, setSnapPointIndicators] = useState<
			SnapPointIndicator[]
		>([]);
		const [presentationViewId, setPresentationViewId] = useState<string | null>(
			null,
		);
		const [tool, setTool] = useState<SkedraSdkTool>(initialTool);
		const [toolLocked, setToolLocked] = useState(false);
		const [pathDrawMode, setPathDrawMode] =
			useState<SkedraPathDrawMode>(initialPathDrawMode);
		const [pathMode, setPathMode] = useState<ArrowMode>(initialPathMode);
		const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
		const [viewport, setViewport] = useState<Viewport>({
			x: 0,
			y: 0,
			zoom: 1,
		});
		const [croppingImageId, setCroppingImageId] = useState<string | null>(null);
		const [pendingText, setPendingText] =
			useState<CanvasEditorPendingText | null>(null);
		const [editingTextId, setEditingTextId] = useState<string | null>(null);
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
		const [drawingDefaults, setDrawingDefaults] = useState<
			Omit<CanvasEditorElementStyle, "stroke" | "fill" | "arrowMode">
		>({
			strokeWidth: 2,
			strokeStyle: "solid",
			opacity: 100,
			cornerRadiusPercent: 0,
			roughness: 0,
			roughFillStyle: "solid",
			roughFillScale: 1,
			arrowHeadStart: "none",
			arrowHeadEnd: "arrow",
			arrowHeadScale: 1,
			arrowHeadFilled: true,
			fontFamily: "Kalam, Comic Sans MS, Segoe Print, cursive",
			fontSize: 20,
			textColor: strokeColor,
			textAlign: "left",
			fontWeight: "normal",
			fontStyle: "normal",
			textDecoration: "none",
		});
		const [defaultElementSize, setDefaultElementSize] = useState({
			width: 100,
			height: 100,
		});
		const drawingStyle = useMemo<CanvasEditorElementStyle>(
			() => ({
				...drawingDefaults,
				stroke,
				fill,
				arrowMode: pathMode,
			}),
			[drawingDefaults, fill, pathMode, stroke],
		);

		const currentElements = elements ?? internalElements;
		const currentViews = views ?? internalViews;
		const currentLibraries = libraries ?? internalLibraries;
		const scene = useMemo(
			() => CanvasScene.from(currentElements),
			[currentElements],
		);
		const elementMap = useMemo(
			() => toCanvasElementMap(currentElements),
			[currentElements],
		);
		const sortedElements = scene.getSortedElements();
		const selectedElements = scene.getSelectedElements(selectedIds);
		const editingTextElement = editingTextId
			? (currentElements.find((element) => element.id === editingTextId) ??
				null)
			: null;
		const editingSession = useMemo(
			() =>
				editingTextElement
					? buildCanvasEditorEditingSession({
							element: editingTextElement,
							defaultFontFamily: "Kalam, Comic Sans MS, Segoe Print, cursive",
						})
					: null,
			[editingTextElement],
		);
		const croppingImage = croppingImageId
			? (currentElements.find(
					(element) =>
						element.id === croppingImageId && element.type === "image",
				) ?? null)
			: null;
		const selectionRect = selectionBox
			? normalizeCanvasRect(selectionBox.start, selectionBox.end)
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
		useEffect(
			() => onPathDrawModeChange?.(pathDrawMode),
			[onPathDrawModeChange, pathDrawMode],
		);
		useEffect(() => onPathModeChange?.(pathMode), [onPathModeChange, pathMode]);
		useEffect(() => onViewportChange?.(viewport), [onViewportChange, viewport]);
		useEffect(() => onGridChange?.(gridEnabled), [gridEnabled, onGridChange]);
		useEffect(() => setGridEnabled(showGrid), [showGrid]);
		useEffect(() => setTheme(themeProp), [themeProp]);

		const resolveEditorPoint = useCallback(
			(
				point: Point,
				options: { objectSnap?: boolean; excludeIds?: Set<string> } = {},
			) => {
				const gridPoint = snapWorldPoint(point, gridEnabled);
				const result = resolveCanvasEditorPointSnap({
					point: gridPoint,
					elements: elementMap,
					excludeIds: options.excludeIds ?? new Set(["__draft"]),
					snap: {
						enabled: snapToObjects && options.objectSnap !== false,
						includeCenters: true,
						includeMidpoints: true,
						showInactivePoints: true,
					},
				});
				setSnapGuides(result.guides);
				setSnapPointIndicators(result.indicators);
				return result.point;
			},
			[elementMap, gridEnabled, snapToObjects],
		);

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

		const fitToSelection = useCallback(() => {
			const svg = svgRef.current;
			const bounds = getCombinedBBox(selectedElements);
			if (!svg || !bounds) return;
			setViewport(
				computeViewportForBounds(svg.getBoundingClientRect(), bounds, 72),
			);
		}, [selectedElements]);

		const zoomViewport = useCallback((factor: number) => {
			const rect = svgRef.current?.getBoundingClientRect();
			if (!rect) return;
			setViewport((current) =>
				zoomCanvasViewportAtPoint(
					current,
					{ x: rect.width / 2, y: rect.height / 2 },
					current.zoom * factor,
				),
			);
		}, []);

		const toggleSdkTheme = useCallback(() => {
			const next = theme === "dark" ? "light" : "dark";
			setTheme(next);
			onThemeChange?.(next);
		}, [onThemeChange, theme]);

		const toggleSdkZen = useCallback(() => {
			const next = !zenMode;
			setZenMode(next);
			onZenModeChange?.(next);
		}, [onZenModeChange, zenMode]);

		const requestSdkHostAction = useCallback(
			(
				eventName:
					| "skedra:help-request"
					| "skedra:command-palette-request"
					| "skedra:find-on-canvas-request",
				callback?: () => void,
			) => {
				if (callback) callback();
				else {
					rootRef.current?.dispatchEvent(
						new CustomEvent(eventName, { bubbles: true }),
					);
				}
			},
			[],
		);

		const focusSdkProperty = useCallback(
			(property: "stroke" | "fill" | "font") => {
				rootRef.current
					?.querySelector<HTMLElement>(`[data-skedra-property="${property}"]`)
					?.focus();
			},
			[],
		);

		const commitViews = useCallback(
			(next: SavedCanvasView[]) => {
				if (views == null) setInternalViews(next);
				onViewsChange?.(next);
			},
			[onViewsChange, views],
		);
		const getSavedViewsContentBounds = useCallback(
			() => getCombinedBBox(currentElements),
			[currentElements],
		);
		const resetSavedViewsViewport = useCallback(
			() => setViewport({ x: 0, y: 0, zoom: 1 }),
			[],
		);
		const {
			orderedViews: savedViewList,
			activeViewId,
			setActiveViewId,
			editingViewId,
			isCapturingView,
			viewDraft,
			createView: createSavedView,
			updateView,
			deleteView,
			selectView: goToView,
			startEditingView,
			stopEditingView,
			renameView,
			duplicateView,
			moveView,
			fitViewport: fitSavedViewsViewport,
			zoomBy: zoomSavedViewsBy,
			startCaptureView,
			cancelCaptureView,
			beginViewMove,
			beginViewResize,
			startViewCapture,
			handleViewPointerMove,
			handleViewPointerUp,
			cancelViewInteraction,
		} = useCanvasEditorSavedViews({
			svgRef,
			views: currentViews,
			viewport,
			onViewportChange: setViewport,
			onViewsChange: commitViews,
			createId,
			getContentBounds: getSavedViewsContentBounds,
			onResetViewport: resetSavedViewsViewport,
		});
		const createView = useCallback<SkedraCanvasApi["createView"]>(
			(view) => {
				const created = createSavedView(view);
				if (!created) {
					throw new Error("Saved views are read-only.");
				}
				return created;
			},
			[createSavedView],
		);

		useEffect(() => {
			if (
				presentationViewId &&
				!savedViewList.some((view) => view.id === presentationViewId)
			) {
				setPresentationViewId(null);
			}
		}, [presentationViewId, savedViewList]);

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

		const copySelectionFormat = useCallback(() => {
			const element = selectedElements[0];
			if (!element) return;
			formatClipboardRef.current = {
				stroke: element.stroke,
				fill: element.fill,
				strokeWidth: element.strokeWidth,
				strokeStyle: element.strokeStyle,
				opacity: element.opacity,
				cornerRadiusPercent:
					element.type === "rectangle"
						? getCornerRadiusPercent(element)
						: undefined,
				arrowHeadScale:
					element.type === "arrow" ? (element.arrowHeadScale ?? 1) : undefined,
				arrowHeadFilled:
					element.type === "arrow"
						? (element.arrowHeadFilled ?? true)
						: undefined,
				fontSize: element.fontSize,
				fontFamily: element.fontFamily,
			};
		}, [selectedElements]);

		const pasteSelectionFormat = useCallback(() => {
			const format = formatClipboardRef.current;
			if (!format) return;
			applySelectedUpdates(
				selectedElements.map((element) => ({
					id: element.id,
					changes: {
						stroke: format.stroke,
						fill: format.fill,
						strokeWidth: format.strokeWidth,
						strokeStyle: format.strokeStyle,
						opacity: format.opacity,
						...(element.type === "rectangle" &&
						format.cornerRadiusPercent !== undefined
							? {
									cornerRadiusPercent: format.cornerRadiusPercent,
									cornerRadius: undefined,
								}
							: {}),
						...(element.type === "arrow" && format.arrowHeadScale !== undefined
							? { arrowHeadScale: format.arrowHeadScale }
							: {}),
						...(element.type === "arrow" && format.arrowHeadFilled !== undefined
							? { arrowHeadFilled: format.arrowHeadFilled }
							: {}),
						...(element.fontSize !== undefined && format.fontSize !== undefined
							? { fontSize: format.fontSize }
							: {}),
						...(element.fontFamily !== undefined &&
						format.fontFamily !== undefined
							? { fontFamily: format.fontFamily }
							: {}),
					},
				})),
			);
		}, [applySelectedUpdates, selectedElements]);

		const addSelectionLink = useCallback(() => {
			const element = selectedElements[0];
			if (!element) return;
			const url = window.prompt("Link URL:", element.link ?? "");
			if (url == null) return;
			applySelectedUpdates(
				selectedElements.map((selected) => ({
					id: selected.id,
					changes: { link: url || undefined },
				})),
			);
		}, [applySelectedUpdates, selectedElements]);

		const adjustSelectionFontSize = useCallback(
			(delta: number) => {
				applySelectedUpdates(
					selectedElements
						.filter(
							(element) =>
								element.fontSize != null ||
								element.text != null ||
								element.type === "text",
						)
						.map((element) => ({
							id: element.id,
							changes: {
								fontSize: Math.max(
									8,
									Math.min(128, (element.fontSize ?? 16) + delta),
								),
							},
						})),
				);
			},
			[applySelectedUpdates, selectedElements],
		);

		const setDrawingDefaultProperties = useCallback(
			(properties: Partial<CanvasElement>) => {
				if (properties.stroke !== undefined) setStroke(properties.stroke);
				if (properties.fill !== undefined) setFill(properties.fill);
				if (properties.arrowMode !== undefined) {
					setPathMode(properties.arrowMode);
				}
				if (properties.width !== undefined || properties.height !== undefined) {
					setDefaultElementSize((current) => ({
						width: properties.width ?? current.width,
						height: properties.height ?? current.height,
					}));
				}
				setDrawingDefaults((current) => ({
					...current,
					...(properties.strokeWidth !== undefined
						? { strokeWidth: properties.strokeWidth }
						: {}),
					...(properties.strokeStyle !== undefined
						? { strokeStyle: properties.strokeStyle }
						: {}),
					...(properties.opacity !== undefined
						? { opacity: properties.opacity }
						: {}),
					...(properties.cornerRadiusPercent !== undefined
						? { cornerRadiusPercent: properties.cornerRadiusPercent }
						: {}),
					...(properties.roughness !== undefined
						? { roughness: properties.roughness }
						: {}),
					...(properties.roughFillStyle !== undefined
						? { roughFillStyle: properties.roughFillStyle }
						: {}),
					...(properties.roughFillScale !== undefined
						? { roughFillScale: properties.roughFillScale }
						: {}),
					...(properties.arrowHeadStart !== undefined
						? { arrowHeadStart: properties.arrowHeadStart }
						: {}),
					...(properties.arrowHeadEnd !== undefined
						? { arrowHeadEnd: properties.arrowHeadEnd }
						: {}),
					...(properties.arrowHeadScale !== undefined
						? { arrowHeadScale: properties.arrowHeadScale }
						: {}),
					...(properties.arrowHeadFilled !== undefined
						? { arrowHeadFilled: properties.arrowHeadFilled }
						: {}),
					...(properties.fontFamily !== undefined
						? { fontFamily: properties.fontFamily }
						: {}),
					...(properties.fontSize !== undefined
						? { fontSize: properties.fontSize }
						: {}),
					...(properties.textColor !== undefined
						? { textColor: properties.textColor }
						: {}),
					...(properties.textAlign !== undefined
						? { textAlign: properties.textAlign }
						: {}),
					...(properties.fontWeight !== undefined
						? { fontWeight: properties.fontWeight }
						: {}),
					...(properties.fontStyle !== undefined
						? { fontStyle: properties.fontStyle }
						: {}),
					...(properties.textDecoration !== undefined
						? { textDecoration: properties.textDecoration }
						: {}),
				}));
			},
			[],
		);

		const defaultPropertiesElement = useMemo(
			() =>
				buildCanvasEditorDefaultsElement({
					tool,
					style: drawingStyle,
					width: defaultElementSize.width,
					height: defaultElementSize.height,
				}),
			[defaultElementSize.height, defaultElementSize.width, drawingStyle, tool],
		);
		const propertiesSelection =
			selectedElements.length > 0
				? selectedElements
				: defaultPropertiesElement
					? [defaultPropertiesElement]
					: [];

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

		const movePresentation = useCallback(
			(direction: 1 | -1) => {
				if (savedViewList.length === 0) return;
				const currentIndex = savedViewList.findIndex(
					(view) => view.id === presentationViewId,
				);
				const nextIndex =
					currentIndex < 0
						? 0
						: Math.max(
								0,
								Math.min(savedViewList.length - 1, currentIndex + direction),
							);
				const next = savedViewList[nextIndex];
				setPresentationViewId(next.id);
				goToView(next.id);
			},
			[goToView, presentationViewId, savedViewList],
		);

		const startPresentation = useCallback(
			(startViewId?: string) => {
				const id = startViewId ?? savedViewList[0]?.id;
				if (!id) return;
				setPresentationViewId(id);
				goToView(id);
			},
			[goToView, savedViewList],
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
					case "toggle-object-snap":
						setSnapToObjects((enabled) => !enabled);
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
				setPathDrawMode,
				setPathMode,
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
				setObjectSnap: setSnapToObjects,
				getObjectSnap: () => snapToObjects,
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
				getViews: () => savedViewList,
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
				savedViewList,
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
				snapToObjects,
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

		const beginHistoryTransaction = useCallback(() => {
			if (!historyTransactionRef.current) {
				historyTransactionRef.current = currentElements.map((element) => ({
					...element,
				}));
			}
		}, [currentElements]);

		const finishHistoryTransaction = useCallback(() => {
			const snapshot = historyTransactionRef.current;
			historyTransactionRef.current = null;
			if (!snapshot) return;
			undoStackRef.current.push(snapshot);
			if (undoStackRef.current.length > 100) undoStackRef.current.shift();
			redoStackRef.current = [];
			setHistoryRevision((value) => value + 1);
		}, []);

		const laserPointsRef = useRef<Point[]>([]);
		const editorDocumentAdapter: CanvasEditorDocumentAdapter = {
			kind: isControlled ? "controlled" : "local",
			getElements: () => elementMap,
			getScene: () => scene,
			createId,
			createElement: (element) => {
				commitCanvasElements([
					...currentElements,
					{
						...element,
						stackIndex: createStackIndexAfter(currentElements, element.id),
					},
				]);
			},
			updateElement: (id, changes) => {
				if (readOnly) return;
				commitCanvasElements(
					currentElements.map((element) =>
						element.id === id ? { ...element, ...changes } : element,
					),
				);
			},
			updateElements: (updates) => {
				if (readOnly || updates.length === 0) return;
				commitCanvasElements(
					applyCanvasElementUpdates(currentElements, updates),
				);
			},
			deleteElements: (ids) => {
				if (readOnly || ids.length === 0) return;
				commitCanvasElements(
					applyCanvasMutationPlan(
						currentElements,
						planCanvasDeletion(elementMap, new Set(ids)),
					),
				);
			},
			duplicateSelection: readOnly
				? undefined
				: () => {
						duplicateSelection();
					},
			beginHistory: beginHistoryTransaction,
			finishHistory: finishHistoryTransaction,
			cancelHistory: () => {
				const snapshot = historyTransactionRef.current;
				historyTransactionRef.current = null;
				if (snapshot) commitCanvasElements(snapshot, false);
			},
			finishMove: (moveStart) => {
				const liveMap = toCanvasElementMap(currentElements);
				const updates = [
					...buildKanbanDropUpdates(liveMap, moveStart.keys()),
					...buildTemplateDropUpdates(liveMap, moveStart.keys()),
				];
				if (updates.length > 0) {
					commitCanvasElements(
						applyCanvasElementUpdates(currentElements, updates),
					);
				}
			},
		};

		const editorPointer = useCanvasEditorPointer({
			svgRef,
			activeTool: tool,
			pathDrawMode,
			documentAdapter: editorDocumentAdapter,
			uiAdapter: {
				getState: () => ({
					activeTool: tool,
					pathDrawMode,
					toolLocked,
					readOnly,
					spacePressed: spacePressedRef.current,
					viewport,
					selectedIds,
					snapToObjects,
					selectionBox: selectionBox
						? {
								startX: selectionBox.start.x,
								startY: selectionBox.start.y,
								endX: selectionBox.end.x,
								endY: selectionBox.end.y,
							}
						: null,
					lassoPath: lassoPath?.map((point) => [point.x, point.y]) ?? null,
				}),
				getStyle: () => drawingStyle,
				getDefaultElementSize: () => defaultElementSize,
				setActiveTool: setTool,
				setSelectedIds,
				clearSelection: () => setSelectedIds(new Set()),
				pan: (dx, dy) =>
					setViewport((current) => ({
						...current,
						x: current.x + dx,
						y: current.y + dy,
					})),
				setViewport,
				setSelectionBox: (box) =>
					setSelectionBox(
						box
							? {
									start: { x: box.startX, y: box.startY },
									end: { x: box.endX, y: box.endY },
								}
							: null,
					),
				setLassoPath: (path) =>
					setLassoPath(path?.map(([x, y]) => ({ x, y })) ?? null),
				setSnapVisuals: (guides, points = []) => {
					setSnapGuides(guides);
					setSnapPointIndicators(points);
				},
				setEyedropperColors: (colors) => {
					if (eyedropperTargetRef.current === "fill") setFill(colors.fill);
					else setStroke(colors.stroke);
				},
				beginLaser: (point) => {
					laserPointsRef.current = [point];
					setLaserTrail({ points: [point], finished: false });
					return "sdk-laser";
				},
				appendLaser: (_id, point) => {
					const previous = laserPointsRef.current.at(-1);
					if (
						previous &&
						Math.hypot(point.x - previous.x, point.y - previous.y) <= 2
					) {
						return;
					}
					laserPointsRef.current = [...laserPointsRef.current, point];
					setLaserTrail({
						points: laserPointsRef.current,
						finished: false,
					});
				},
				finishLaser: () => {
					setLaserTrail({ points: laserPointsRef.current, finished: true });
				},
			},
			resolvePoint: (clientX, clientY) => {
				const svg = svgRef.current;
				if (!svg) {
					return {
						raw: { x: clientX, y: clientY },
						snapped: { x: clientX, y: clientY },
					};
				}
				const raw = toWorldPoint({ clientX, clientY }, svg, viewport);
				const snapped = resolveEditorPoint(raw, {
					objectSnap:
						tool === "line" ||
						tool === "arrow" ||
						tool === "rectangle" ||
						tool === "ellipse" ||
						tool === "diamond",
				});
				return { raw, snapped };
			},
			startTextPlacement: (placement) => {
				if (textPrompt) {
					const text = textPrompt({ currentText: "Text", element: null });
					if (!text) return;
					const id = createId();
					commitCanvasElements([
						...currentElements,
						{
							...buildCanvasTextElement({
								id,
								point: { x: placement.x, y: placement.y },
								text,
								stroke: placement.stroke,
								fontFamily: placement.fontFamily,
								stackIndex: createStackIndexAfter(currentElements, id),
							}),
							fontSize: placement.fontSize,
							textAlign: placement.textAlign,
							fontWeight: placement.fontWeight,
							fontStyle: placement.fontStyle,
							textDecoration: placement.textDecoration,
						},
					]);
					setSelectedIds(new Set([id]));
					return;
				}
				flushSync(() => {
					setPendingText({
						...placement,
						textColor: drawingStyle.textColor ?? placement.stroke,
					});
				});
			},
			onPlacement: ({ action, point }) => {
				if (action === "insert-sticky-note") {
					const [note] = addSdkElements([
						createSkedraStickyNoteElement({
							x: point.x - 100,
							y: point.y - 100,
							text: "",
							theme,
							createId,
						}),
					]);
					setSelectedIds(new Set([note.id]));
				} else if (action === "insert-kanban") {
					insertKanbanBoard(point);
				} else {
					insertMindmap(point);
				}
				if (!toolLocked) setTool("select");
				return true;
			},
		});
		const onSdkSurfacePointerDown = useCallback(
			(event: ReactPointerEvent<SVGSVGElement>) => {
				if (isCapturingView && event.button === 0) {
					if (
						!editorPointer.beginAuxiliaryPointerGesture(
							event,
							cancelViewInteraction,
						)
					) {
						return;
					}
					const rect = event.currentTarget.getBoundingClientRect();
					if (rect.width <= 0 || rect.height <= 0) {
						editorPointer.onPointerCancel(event);
						return;
					}
					startViewCapture(
						(event.clientX - rect.left - viewport.x) / viewport.zoom,
						(event.clientY - rect.top - viewport.y) / viewport.zoom,
						event.pointerId,
					);
					try {
						event.currentTarget.setPointerCapture(event.pointerId);
					} catch {
						// The browser may already have cancelled the pointer.
					}
					return;
				}
				editorPointer.onPointerDown(event);
			},
			[
				cancelViewInteraction,
				editorPointer,
				isCapturingView,
				startViewCapture,
				viewport,
			],
		);
		const onSdkSurfacePointerMove = useCallback(
			(event: ReactPointerEvent<SVGSVGElement>) => {
				editorPointer.onPointerMove(event);
				const rect = event.currentTarget.getBoundingClientRect();
				handleViewPointerMove(
					(event.clientX - rect.left - viewport.x) / viewport.zoom,
					(event.clientY - rect.top - viewport.y) / viewport.zoom,
					event.pointerId,
				);
			},
			[editorPointer, handleViewPointerMove, viewport],
		);
		const onSdkSurfacePointerUp = useCallback(
			(event: ReactPointerEvent<SVGSVGElement>) => {
				editorPointer.onPointerUp(event);
				handleViewPointerUp(event.pointerId);
			},
			[editorPointer, handleViewPointerUp],
		);

		const insertPathPoint = (
			element: CanvasElement,
			pointIndex: number,
			point: [number, number],
		) => {
			if (readOnly || element.locked) return;
			const changes = buildCanvasPathInsertPointChanges(
				element,
				pointIndex,
				point,
			);
			if (!changes) return;
			commitCanvasElements(
				currentElements.map((current) =>
					current.id === element.id ? { ...current, ...changes } : current,
				),
			);
			setSelectedIds(new Set([element.id]));
		};

		const resizeWithKeyboard = (
			event: ReactKeyboardEvent<SVGRectElement>,
			element: CanvasElement,
			handle: HandlePosition,
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
			if (hit.type === "image" && !readOnly) {
				setCroppingImageId(hit.id);
				setSelectedIds(new Set([hit.id]));
				return;
			}
			if (!isCanvasTextEditableElement(hit)) return;
			if (!textPrompt) {
				beginHistoryTransaction();
				setPendingText(null);
				setEditingTextId(hit.id);
				setSelectedIds(new Set([hit.id]));
				return;
			}
			const currentText =
				hit.type === "frame"
					? (hit.frameLabel ?? hit.text ?? "")
					: (hit.text ?? "");
			const nextText = textPrompt({ currentText, element: hit });
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

		const createInlineText = useCallback(
			(
				text: string,
				position: CanvasEditorPendingText,
				size: { width: number; height: number },
			) => {
				const id = createId();
				const element = {
					...buildCanvasTextElement({
						id,
						point: { x: position.x, y: position.y },
						text,
						stroke: position.textColor ?? position.stroke,
						fontFamily: position.fontFamily,
						stackIndex: createStackIndexAfter(currentElements, id),
					}),
					width: size.width,
					height: size.height,
					fontSize: position.fontSize,
					textAlign: position.textAlign ?? "left",
					fontWeight: position.fontWeight ?? "normal",
					fontStyle: position.fontStyle ?? "normal",
					textDecoration: position.textDecoration ?? "none",
				};
				commitCanvasElements([...currentElements, element]);
				setSelectedIds(new Set([id]));
				setPendingText(null);
				if (!toolLocked) setTool("select");
			},
			[commitCanvasElements, currentElements, toolLocked],
		);

		const updateInlineText = useCallback(
			(id: string, text: string, size: { width: number; height: number }) => {
				const element = currentElements.find(
					(candidate) => candidate.id === id,
				);
				if (!element) return;
				const changes = buildCanvasTextUpdate({
					element,
					text,
					size,
					fontFamily:
						element.fontFamily ?? "Kalam, Comic Sans MS, Segoe Print, cursive",
				});
				commitCanvasElements(
					currentElements.map((candidate) =>
						candidate.id === id ? { ...candidate, ...changes } : candidate,
					),
					false,
				);
			},
			[commitCanvasElements, currentElements],
		);

		const updateInlineStickyNote = useCallback(
			(
				id: string,
				mode: CanvasEditorStickyNoteMode,
				text: string,
				checklist: CanvasEditorStickyChecklistItem[],
			) => {
				const element = currentElements.find(
					(candidate) => candidate.id === id,
				);
				if (!element) return;
				commitCanvasElements(
					currentElements.map((candidate) =>
						candidate.id === id
							? {
									...candidate,
									text,
									customData: {
										...(candidate.customData ?? {}),
										skedraType: "sticky-note",
										stickyNoteMode: mode,
										stickyChecklist: checklist,
									},
								}
							: candidate,
					),
					false,
				);
			},
			[commitCanvasElements, currentElements],
		);

		const closeInlineTextEditor = useCallback(() => {
			if (editingTextId) finishHistoryTransaction();
			setPendingText(null);
			setEditingTextId(null);
		}, [editingTextId, finishHistoryTransaction]);

		const pickAndInsertImage = useCallback(async () => {
			const file = await pickBrowserFile("image/*");
			if (file) await insertImage(file, { name: file.name });
		}, [insertImage]);

		const pastePlainText = useCallback(async () => {
			if (readOnly || !navigator.clipboard?.readText) return;
			const text = await navigator.clipboard.readText().catch(() => "");
			if (!text.trim()) return;
			const id = createId();
			const center = getViewportCenter();
			const element = {
				...buildCanvasTextElement({
					id,
					point: center,
					text,
					stroke: drawingStyle.textColor ?? drawingStyle.stroke,
					fontFamily: drawingStyle.fontFamily,
					stackIndex: createStackIndexAfter(currentElements, id),
				}),
				fontSize: drawingStyle.fontSize,
				fontWeight: drawingStyle.fontWeight,
				fontStyle: drawingStyle.fontStyle,
				textDecoration: drawingStyle.textDecoration,
			};
			commitCanvasElements([...currentElements, element]);
			setSelectedIds(new Set([id]));
		}, [
			commitCanvasElements,
			currentElements,
			drawingStyle,
			getViewportCenter,
			readOnly,
		]);

		const createFlowchartFromSelection = useCallback(
			(direction: "up" | "right" | "down" | "left") => {
				const node = selectedElements.length === 1 ? selectedElements[0] : null;
				if (!node || !isFlowchartNode(node)) return;
				addFlowchartStep(node.id, {
					route: getFlowchartRouteForDirection(direction),
				});
			},
			[addFlowchartStep, selectedElements],
		);

		const navigateFlowchartSelection = useCallback(
			(direction: "up" | "right" | "down" | "left") => {
				const node = selectedElements.length === 1 ? selectedElements[0] : null;
				if (!node || !isFlowchartNode(node)) return;
				const target = navigateFlowchartInDirection(
					node.id,
					direction,
					elementMap,
				);
				if (target) setSelectedIds(new Set([target.id]));
			},
			[elementMap, selectedElements],
		);

		const activateSelection = useCallback(() => {
			const element =
				selectedElements.length === 1 ? selectedElements[0] : null;
			if (!element) return;
			if (element.type === "image") {
				setCroppingImageId(element.id);
				return;
			}
			if (isFlowchartNode(element)) {
				addFlowchartStep(element.id);
				return;
			}
			if (isMindmapNode(element)) {
				insertMindmapSibling(element.id);
				return;
			}
			if (!isCanvasTextEditableElement(element)) return;
			beginHistoryTransaction();
			setPendingText(null);
			setEditingTextId(element.id);
		}, [
			addFlowchartStep,
			beginHistoryTransaction,
			insertMindmapSibling,
			selectedElements,
		]);

		const clearSelected = deleteSelection;
		const keyboardActionHandlers: SkedraSdkKeyboardActionHandlers = {
			command: (command) => {
				if (command === "paste") void pasteFromClipboard();
				else executeCommand(command);
			},
			tool: setTool,
			toggleToolLock: () => setToolLocked((locked) => !locked),
			toggleObjectSnap: () => setSnapToObjects((enabled) => !enabled),
			insertImage: () => void pickAndInsertImage(),
			openHelp: () =>
				requestSdkHostAction("skedra:help-request", onHelpRequest),
			openCommandPalette: () =>
				requestSdkHostAction(
					"skedra:command-palette-request",
					onCommandPaletteRequest,
				),
			openCanvasSearch: () =>
				requestSdkHostAction(
					"skedra:find-on-canvas-request",
					onFindOnCanvasRequest,
				),
			focusProperty: focusSdkProperty,
			eyedropper: (target) => {
				eyedropperTargetRef.current = target;
				setTool("eyedropper");
			},
			pastePlainText: () => void pastePlainText(),
			copyFormat: copySelectionFormat,
			pasteFormat: pasteSelectionFormat,
			addLink: addSelectionLink,
			adjustFontSize: adjustSelectionFontSize,
			align: alignSelection,
			flowchartCreate: createFlowchartFromSelection,
			flowchartNavigate: navigateFlowchartSelection,
			zoom: zoomViewport,
			resetZoom: () => setViewport({ x: 0, y: 0, zoom: 1 }),
			fit: (target) => {
				if (target === "selection") fitToSelection();
				else fitToContent();
			},
			panViewport: (x, y) =>
				setViewport((current) => ({
					...current,
					x: current.x + x,
					y: current.y + y,
				})),
			toggleTheme: toggleSdkTheme,
			toggleZen: toggleSdkZen,
			toggleGrid: () => setGridEnabled((enabled) => !enabled),
			activateSelection,
		};

		useCanvasEditorKeyboard({
			getState: () => ({
				enabled: true,
				readOnly,
				editingText: editingTextId != null || pendingText != null,
				hasSelection: selectedIds.size > 0,
			}),
			onEditorAction: (action) =>
				handleSkedraSdkKeyboardAction(action, keyboardActionHandlers),
			onCommand: (command) => {
				if (command === "escape" && editorPointer.isPathActive()) {
					editorPointer.cancelPath();
					setSelectedIds(new Set());
					setTool("select");
					return true;
				}
				if (command === "delete-selection") {
					if (selectedIds.size > 0) clearSelected();
					return true;
				}
				if (command === "clear-canvas") {
					commitElements([]);
					setSelectedIds(new Set());
					return true;
				}
				if (command === "select-all") {
					setSelectedIds(new Set(currentElements.map((element) => element.id)));
					return true;
				}
				if (command === "escape") {
					setSelectedIds(new Set());
					setTool("select");
					return true;
				}
				if (command === "undo") {
					undo();
					return true;
				}
				if (command === "redo") {
					redo();
					return true;
				}
				return false;
			},
			setTemporaryPan: (pressed) => {
				spacePressedRef.current = pressed;
			},
			onUnhandledKeyDown: (event) => {
				if (event.key === "Enter" && editorPointer.isPathActive()) {
					editorPointer.finishPath({ selectCreated: true });
					return true;
				}
				return false;
			},
		});

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

		const toggleStickyChecklistItem = useCallback(
			(elementId: string, itemId: string) => {
				const element = currentElements.find(
					(candidate) => candidate.id === elementId,
				);
				if (!element || readOnly) return;
				const checklist = normalizeCanvasEditorStickyChecklist(
					element.customData?.stickyChecklist,
				);
				commitCanvasElements(
					currentElements.map((candidate) =>
						candidate.id === elementId
							? {
									...candidate,
									customData: {
										...(candidate.customData ?? {}),
										stickyChecklist: toggleCanvasEditorStickyChecklistItem(
											checklist,
											itemId,
										),
									},
								}
							: candidate,
					),
				);
			},
			[commitCanvasElements, currentElements, readOnly],
		);

		const rendererConfig = useMemo<CanvasRendererConfig>(
			() => ({
				interactive: !readOnly,
				svgIdPrefix,
				actions: {
					addKanbanCard: insertKanbanCard,
					addTemplateSticky: insertTemplateSticky,
					toggleStickyChecklistItem,
				},
			}),
			[
				insertKanbanCard,
				insertTemplateSticky,
				readOnly,
				svgIdPrefix,
				toggleStickyChecklistItem,
			],
		);
		const draftRendererConfig = useMemo<CanvasRendererConfig>(
			() => ({ ...rendererConfig, interactive: false }),
			[rendererConfig],
		);
		const renderSavedViewPreview =
			useCallback<CanvasEditorSavedViewPreviewRenderer>(
				(scene) => (
					<CanvasRenderer
						scene={scene}
						selectedIds={EMPTY_SAVED_VIEW_SELECTION}
						config={draftRendererConfig}
					/>
				),
				[draftRendererConfig],
			);
		const editingView = editingViewId
			? (savedViewList.find((view) => view.id === editingViewId) ?? null)
			: null;

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

		const toolbarItems: CanvasEditorToolbarItem[] = [
			{
				type: "menu",
				id: "templates",
				label: "Templates",
				icon: <LayoutTemplate size={17} strokeWidth={2} />,
				disabled: readOnly,
				onOpen: () => setTool("select"),
				items: SKEDRA_TEMPLATES.map((template) => ({
					id: template.id,
					label: template.name,
					trailingIcon: <Plus size={14} strokeWidth={2} />,
					onSelect: () => {
						insertTemplate(template.id);
					},
				})),
			},
			{
				type: "action",
				id: "insert-image",
				label: "Insert image",
				icon: <ImagePlus size={17} strokeWidth={2} />,
				disabled: readOnly,
				onSelect: pickAndInsertImage,
			},
			{
				type: "menu",
				id: "libraries",
				label: "Shape libraries",
				icon: <Library size={17} strokeWidth={2} />,
				popoverClassName: "skedra-sdk__menu-wide",
				items: [
					{
						id: "import-library",
						label: "Import library",
						onSelect: pickAndAddLibrary,
					},
					{
						id: "export-libraries",
						label: "Export libraries",
						disabled: currentLibraries.length === 0,
						onSelect: downloadLibraries,
					},
					{
						id: "save-selection",
						label: "Save selection",
						disabled: selectedElements.length === 0,
						onSelect: saveSelectionToLibrary,
					},
					...currentLibraries.flatMap((library) =>
						library.items.map((item) => ({
							id: `${library.name ?? library.source ?? "library"}-${item.id}`,
							label: item.name ?? "Shape",
							trailingIcon: <Plus size={14} />,
							onSelect: () => {
								insertLibraryItem(item);
							},
						})),
					),
				],
			},
			{
				type: "menu",
				id: "commands",
				label: "Edit commands",
				icon: <Copy size={17} />,
				popoverClassName: "skedra-sdk__command-grid",
				items: (
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
				).map(([label, command]) => ({
					id: command,
					label,
					onSelect: () => executeCommand(command),
				})),
			},
			{
				type: "menu",
				id: "import-export",
				label: "Import and export",
				icon: <Download size={17} />,
				popoverClassName: "skedra-sdk__export-menu",
				items: [
					{
						id: "import-skedra",
						label: "Import .skedra",
						onSelect: pickAndImportDocument,
					},
					{
						id: "export-skedra",
						label: "Export .skedra",
						onSelect: () => downloadDocument(false),
					},
					{
						id: "export-encrypted",
						label: "Export encrypted",
						onSelect: () => downloadDocument(true),
					},
					...(["svg", "png", "pdf", "pptx"] as const).map((format) => ({
						id: `export-${format}`,
						label: `Export ${format.toUpperCase()}`,
						onSelect: () => downloadVisual(format),
					})),
				],
			},
			{
				type: "action",
				id: "undo",
				label: "Undo",
				icon: <Undo2 size={17} />,
				disabled: undoStackRef.current.length === 0,
				onSelect: undo,
			},
			{
				type: "action",
				id: "redo",
				label: "Redo",
				icon: <Redo2 size={17} />,
				disabled: redoStackRef.current.length === 0,
				onSelect: redo,
			},
			{
				type: "action",
				id: "grid",
				label: "Grid",
				icon: <Grid3X3 size={17} />,
				active: gridEnabled,
				onSelect: () => setGridEnabled((enabled) => !enabled),
			},
			{
				type: "action",
				id: "object-snapping",
				label: "Object snapping (Alt+S)",
				icon: <Magnet size={17} />,
				active: snapToObjects,
				onSelect: () => setSnapToObjects((enabled) => !enabled),
			},
			{ type: "separator", id: "style-separator" },
			{
				type: "color",
				id: "stroke-color",
				label: "Stroke color",
				value: stroke,
				onChange: setStroke,
			},
			{
				type: "color",
				id: "fill-color",
				label: "Fill color",
				value: fill === "transparent" ? "#ffffff" : fill,
				onChange: setFill,
			},
			{
				type: "action",
				id: "transparent-fill",
				label: "Transparent fill",
				icon: "/",
				className: "skedra-sdk__clear-fill",
				onSelect: () => setFill("transparent"),
			},
			{ type: "separator", id: "delete-separator" },
			{
				type: "action",
				id: "delete",
				label: "Delete selection",
				icon: <Trash2 size={17} strokeWidth={2} />,
				disabled: readOnly || selectedIds.size === 0,
				onSelect: clearSelected,
			},
		];

		return (
			<CanvasEditor
				rootRef={rootRef}
				documentAdapter={editorDocumentAdapter}
				collaboration={{ enabled: false }}
				className={normalizeClassName(className)}
				style={style}
				data-theme={theme}
				data-history-revision={historyRevision}
			>
				{showToolbar && !zenMode && !presentationViewId && (
					<CanvasEditorToolbar
						toolStrip={{
							activeTool: tool,
							onToolSelect: setTool,
							renderIcon: (toolId) => {
								const Icon = SDK_TOOL_ICONS[toolId];
								return <Icon size={17} strokeWidth={2} />;
							},
							isToolDisabled: (toolId) =>
								readOnly && !isCanvasEditorToolAvailableReadOnly(toolId),
							classes: {
								button: "skedra-sdk__tool",
								divider: "skedra-sdk__divider",
								pathSelect: "skedra-sdk__path-control",
							},
							pathDrawMode,
							pathMode,
							onPathDrawModeChange: setPathDrawMode,
							onPathModeChange: setPathMode,
							toolLocked,
							onToolLockChange: setToolLocked,
							renderToolLockIcon: (locked) =>
								locked ? (
									<Lock size={17} strokeWidth={2} />
								) : (
									<Unlock size={17} strokeWidth={2} />
								),
						}}
						items={toolbarItems}
						classes={{
							root: "skedra-sdk__toolbar",
							action: "skedra-sdk__tool",
							separator: "skedra-sdk__divider",
							menu: "skedra-sdk__template-menu",
							popover: "skedra-sdk__template-popover",
							menuItem: "skedra-sdk__template-item",
							menuRow: "skedra-sdk__view-row",
							color: "skedra-sdk__color",
						}}
					/>
				)}
				<CanvasEditorSurface
					svgRef={svgRef}
					viewport={viewport}
					activeTool={tool}
					className="skedra-sdk__surface"
					data-tool={tool}
					onPointerDown={onSdkSurfacePointerDown}
					onPointerMove={onSdkSurfacePointerMove}
					onPointerUp={onSdkSurfacePointerUp}
					onPointerCancel={editorPointer.onPointerCancel}
					onLostPointerCapture={editorPointer.onLostPointerCapture}
					onContextMenu={editorPointer.onContextMenu}
					onDoubleClick={(event) => {
						if (!editorPointer.onDoubleClick()) handleDoubleClick(event);
					}}
					onWheel={editorPointer.onWheel}
					worldDataAttribute="true"
				>
					<CanvasEditorGridOverlay
						enabled={gridEnabled}
						zoom={viewport.zoom}
						patternId={gridPatternId}
						color="currentColor"
						opacity={0.08}
					/>
					<CanvasRendererProvider config={rendererConfig}>
						{sortedElements.map((element) => (
							<CanvasElementRenderer
								key={element.id}
								element={element}
								isEditingText={element.id === editingTextId}
							/>
						))}
						{editorPointer.drawingPreview && (
							<g data-ui-only="true" data-skedra-ui="drawing-preview">
								<CanvasRendererProvider config={draftRendererConfig}>
									<CanvasElementRenderer
										element={{
											...editorPointer.drawingPreview,
											opacity: editorPointer.drawingPreview.opacity * 0.72,
										}}
										isEditingText={false}
									/>
								</CanvasRendererProvider>
							</g>
						)}
					</CanvasRendererProvider>
					<CanvasPathStartSnapIndicator
						snap={editorPointer.pathStartSnap}
						zoom={viewport.zoom}
						className="skedra-sdk__path-start-snap"
					/>
					<CanvasEditorSnapOverlay
						guides={snapGuides}
						points={snapPointIndicators}
						zoom={viewport.zoom}
					/>
					{editingView && !pendingText && !editingSession && (
						<CanvasEditorSavedViewOverlay
							view={editingView}
							zoom={viewport.zoom}
							onMoveStart={(event) => {
								if (
									editorPointer.beginAuxiliaryPointerGesture(
										event,
										cancelViewInteraction,
									)
								) {
									beginViewMove(editingView.id, event);
								}
							}}
							onResizeStart={(handle, event) => {
								if (
									editorPointer.beginAuxiliaryPointerGesture(
										event,
										cancelViewInteraction,
									)
								) {
									beginViewResize(handle, editingView.id, event);
								}
							}}
						/>
					)}
					{viewDraft && (
						<CanvasEditorSavedViewDraft
							bounds={viewDraft}
							zoom={viewport.zoom}
						/>
					)}
					<CanvasEditorSelectionOverlay
						selected={selectedElements}
						zoom={viewport.zoom}
						readOnly={readOnly}
						outlinePadding={4}
						handleSize={10}
						outlineStroke="var(--skedra-sdk-accent, #2563eb)"
						handleFill="var(--skedra-sdk-background, #fff)"
						handleStroke="var(--skedra-sdk-accent, #2563eb)"
						dashedOutline={false}
						classes={{
							outline: "skedra-sdk__selected-outline",
							handle: "skedra-sdk__resize-handle",
						}}
						onResizeStart={editorPointer.beginResize}
						onResizeKeyDown={resizeWithKeyboard}
						onPathPointDragStart={editorPointer.beginPathPointDrag}
						onInsertPathPoint={(element, pointIndex, point, event) =>
							editorPointer.runPointerUpAction(event, () =>
								insertPathPoint(element, pointIndex, point),
							)
						}
						pathBackground="var(--skedra-sdk-panel)"
						pathAccent="var(--skedra-sdk-primary)"
						pathControlLine="color-mix(in srgb, var(--skedra-sdk-primary) 55%, transparent)"
					/>
					<CanvasEditorSelectionGestureOverlay
						selectionRect={selectionRect}
						lassoPath={lassoPath?.map((point): [number, number] => [
							point.x,
							point.y,
						])}
						zoom={viewport.zoom}
						selectionClassName="skedra-sdk__selection"
						lassoClassName="skedra-sdk__lasso"
					/>
					{laserTrail && laserTrail.points.length > 1 && (
						<polyline
							className="skedra-sdk__laser"
							data-ui-only="true"
							data-skedra-ui="laser"
							data-finished={laserTrail.finished}
							points={laserTrail.points
								.map((point) => `${point.x},${point.y}`)
								.join(" ")}
							strokeWidth={4 / viewport.zoom}
						/>
					)}
					{croppingImage && (
						<CanvasEditorImageCropOverlay
							element={croppingImage}
							viewport={viewport}
							beginAuxiliaryPointerGesture={
								editorPointer.beginAuxiliaryPointerGesture
							}
							onApply={(crop) => {
								cropImage(croppingImage.id, crop);
								setCroppingImageId(null);
							}}
							onCancel={() => setCroppingImageId(null)}
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
				</CanvasEditorSurface>
				{(pendingText || editingSession) &&
					(editingSession?.editingText.variant === "sticky-note" ? (
						<CanvasEditorStickyNoteOverlay
							editing={editingSession.editingText}
							stickyNoteMode={editingSession.stickyNoteMode ?? "note"}
							stickyChecklist={editingSession.stickyChecklist ?? []}
							viewport={viewport}
							svgRef={svgRef}
							onUpdateStickyNote={updateInlineStickyNote}
							onClose={closeInlineTextEditor}
						/>
					) : (
						<CanvasEditorTextOverlay
							pending={pendingText}
							editing={editingSession?.editingText}
							viewport={viewport}
							svgRef={svgRef}
							onCreateText={createInlineText}
							onUpdateText={updateInlineText}
							onClose={closeInlineTextEditor}
						/>
					))}
				{showProperties && !zenMode && !presentationViewId && (
					<SkedraPropertiesPanel
						selected={propertiesSelection}
						mode={selectedElements.length > 0 ? "selection" : "defaults"}
						readOnly={readOnly}
						pathDrawMode={pathDrawMode}
						onPathDrawModeChange={setPathDrawMode}
						onSetProperties={
							selectedElements.length > 0
								? setSelectionProperties
								: setDrawingDefaultProperties
						}
						onSetGeometryWidth={
							selectedElements.length === 0
								? (width) => setDrawingDefaultProperties({ width })
								: undefined
						}
						onSetGeometryHeight={
							selectedElements.length === 0
								? (height) => setDrawingDefaultProperties({ height })
								: undefined
						}
						onSetEllipseDiameter={(diameter) =>
							selectedElements.length === 0
								? setDrawingDefaultProperties({
										width: diameter,
										height: diameter,
									})
								: setSelectionProperties({ width: diameter, height: diameter })
						}
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
						onStartImageCrop={setCroppingImageId}
						onAddFlowchartStep={(nodeId, options) => {
							addFlowchartStep(nodeId, options);
						}}
						onSetFlowchartNodeKind={setFlowchartNodeKind}
						onUpdateKanbanCard={updateKanbanCard}
						onUpdateKanbanList={updateKanbanList}
					/>
				)}
				{!zenMode && (
					<CanvasEditorSavedViewsBar
						canUndo={undoStackRef.current.length > 0}
						canRedo={redoStackRef.current.length > 0}
						readOnly={readOnly}
						presentationMode={presentationViewId != null}
						presenterMode={presentationViewId != null}
						onUndo={undo}
						onRedo={redo}
						onFitViewport={fitSavedViewsViewport}
						onZoomBy={zoomSavedViewsBy}
						zoom={viewport.zoom}
						views={savedViewList}
						elements={elementMap}
						activeViewId={activeViewId}
						editingViewId={editingViewId}
						isCapturingView={isCapturingView}
						onStartCaptureView={startCaptureView}
						onCancelCaptureView={cancelCaptureView}
						onSelectView={(id) => {
							goToView(id);
							if (presentationViewId) setPresentationViewId(id);
						}}
						onStartEditView={startEditingView}
						onStopEditView={stopEditingView}
						onDeleteView={deleteView}
						onDuplicateView={duplicateView}
						onMoveView={moveView}
						onRenameView={renameView}
						renderPreview={renderSavedViewPreview}
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
							{savedViewList.find((view) => view.id === presentationViewId)
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
			</CanvasEditor>
		);
	},
);
