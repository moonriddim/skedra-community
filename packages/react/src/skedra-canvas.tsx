import {
	type CanvasMutationPlan,
	CanvasScene,
	DEFAULT_CANVAS_SNAP_DIVISION_COUNT,
	DEFAULT_CLOUD_ARC_RADIUS,
	DEFAULT_POLYGON_SIDES,
	GRID_SIZE,
	type HandlePosition,
	type SnapGuide,
	type SnapPointIndicator,
	applyCanvasElementUpdates,
	applyCanvasMutationPlan,
	buildBringForwardUpdates,
	buildBringToFrontUpdates,
	buildCanvasBindingSyncUpdates,
	buildCanvasElementFormatUpdates,
	buildCanvasPathInsertPointChanges,
	buildCanvasTextElement,
	buildCanvasTextUpdate,
	buildCloudArcRadiusChanges,
	buildFlowchartNodeKindChanges,
	buildFrameResizeChildUpdates,
	buildGanttChartMutationPlan,
	buildKanbanDropUpdates,
	buildSendBackwardUpdates,
	buildSendToBackUpdates,
	buildTemplateDropUpdates,
	buildTemplateSectionLayoutSyncUpdates,
	canTrimCanvasShape,
	clientPointToCanvas,
	cloneCanvasSelection,
	cloneTransformedCanvasSelection,
	computeViewportForBounds,
	createCanvasTemplateStickyNote,
	createSelectionFrame,
	createStackIndexAfter,
	findGanttChartElement,
	getAlignmentUpdates,
	getCanvasElementFormat,
	getCanvasKeyboardResizeChanges,
	getCanvasPasteOffset,
	getCanvasSelectionSnapPointIndicators,
	getCanvasViewportCenter,
	getCombinedBBox,
	getDistributionUpdates,
	getFlipUpdates,
	getFlowchartRouteForDirection,
	getGanttChartDocument,
	getGanttChartId,
	getGanttChartMeta,
	getGanttChartSize,
	getGroupUpdates,
	getLockUpdates,
	getRotateUpdates,
	getSequenceDiagramId,
	isCanvasTextEditableElement,
	isFlowchartNode,
	isKanbanCard,
	isKanbanList,
	isMindmapNode,
	navigateFlowchartInDirection,
	normalizeCanvasGridSize,
	normalizeCanvasRect,
	normalizeCanvasSnapDivisionCount,
	parseSvgToCanvasElements,
	planCanvasDeletion,
	planFlowchartStepMutation,
	planKanbanCardInsertion,
	planMindmapChildMutation,
	planMindmapSiblingMutation,
	planSequenceDiagramActivationInsertion,
	planSequenceDiagramFragmentInsertion,
	planSequenceDiagramMessageInsertion,
	planSequenceDiagramParticipantInsertion,
	snapCanvasPointToGrid,
	toCanvasElementMap,
	zoomCanvasViewportAtPoint,
} from "@skedra/canvas-core";
import type {
	CanvasElementFormat,
	CanvasPathDrawMode as CoreCanvasPathDrawMode,
} from "@skedra/canvas-core";
import {
	CANVAS_EDITOR_TOOL_IDS,
	CanvasEditor,
	CanvasEditorContextMenu,
	CanvasEditorEraserTrailOverlay,
	CanvasEditorGanttStudio,
	CanvasEditorGridOverlay,
	CanvasEditorImageCropOverlay,
	CanvasEditorSavedViewDraft,
	CanvasEditorSavedViewOverlay,
	CanvasEditorSavedViewsBar,
	CanvasEditorSelectionGestureOverlay,
	CanvasEditorSelectionOverlay,
	CanvasEditorSequenceDiagramPanel,
	CanvasEditorShapeTrimOverlay,
	CanvasEditorSnapOverlay,
	CanvasEditorStickyNoteOverlay,
	CanvasEditorSurface,
	CanvasEditorTextOverlay,
	CanvasEditorToolbar,
	CanvasPathStartSnapIndicator,
	buildCanvasEditorDefaultsElement,
	buildCanvasEditorEditingSession,
	canvasEditorToolSupportsSnapOverride,
	expandCanvasEditorAtomicSelectionIds,
	getCanvasEditorSnapModeOptions,
	isCanvasEditorToolAvailableReadOnly,
	normalizeCanvasEditorStickyChecklist,
	resolveCanvasEditorContextSelectionIds,
	resolveCanvasEditorPlacementPoint,
	resolveCanvasEditorPointSnap,
	resolveCanvasEditorRotationKeyDelta,
	toggleCanvasEditorStickyChecklistItem,
	useCanvasEditorClipboard,
	useCanvasEditorKeyboard,
	useCanvasEditorPointer,
	useCanvasEditorSavedViews,
	useCanvasEditorShapeTrim,
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
	copySkedraVisualToClipboard,
	writeCanvasClipboardDataTransfer,
} from "@skedra/canvas-io/clipboard";
import {
	CanvasElementRenderer,
	CanvasRenderer,
	type CanvasRendererConfig,
	CanvasRendererProvider,
} from "@skedra/canvas-react";
import {
	ArrowRight,
	Circle,
	Cloud,
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
	Triangle,
	Undo2,
	Unlock,
	Workflow,
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
	SkedraGridSettings,
	SkedraKanbanCardDetails,
	SkedraLayerCommand,
	SkedraObjectSnapMode,
	SkedraObjectSnapSettings,
	SkedraSelectionTransform,
} from "./commands.js";
import {
	exportSkedraFrame as exportSdkFrame,
	exportSkedraVisual,
	getSkedraFrameExportFilename,
} from "./exporters.js";
import {
	SKEDRA_TEMPLATES,
	type SkedraGanttChartDocument,
	type SkedraSdkTemplateId,
	type SkedraSequenceVisualPreset,
	createSkedraFrameElement,
	createSkedraGanttChartElements,
	createSkedraKanbanBoardElements,
	createSkedraKanbanCardElement,
	createSkedraMindmapElements,
	createSkedraSequenceDiagramElements,
	createSkedraStickyNoteElement,
	createSkedraTemplateElements,
	createSkedraVisualSequenceDiagramElements,
	getSkedraElementFactoryDefaults,
	getSkedraMindmapAppearance,
	getSkedraSequenceDiagramAppearance,
	withSkedraStackIndexes,
} from "./factories.js";
import {
	createExcalidrawFile,
	createSkedraFile,
	createSkedraImageElement,
	createSkedraLibraryFile,
	createSkedraLibraryItem,
	cropSkedraImage,
	downloadSkedraBlob,
	encryptSkedraFile,
	instantiateSkedraLibraryItem,
	parseSkedraClipboard,
	parseSkedraClipboardDataTransfer,
	parseSkedraFileContents,
	parseSkedraLibrary,
	serializeExcalidrawClipboard,
	serializeExcalidrawFile,
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
	| "triangle"
	| "cloud"
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
	insertGanttChart: (
		options?: Partial<Parameters<typeof createSkedraGanttChartElements>[0]>,
	) => CanvasElement[];
	getGanttChartDocument: (chartId?: string) => SkedraGanttChartDocument | null;
	updateGanttChart: (
		chartId: string,
		document: SkedraGanttChartDocument,
	) => CanvasElement[];
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
	insertSequenceDiagram: (
		source: string,
		options?: { x?: number; y?: number; participantGap?: number },
	) => CanvasElement[];
	insertVisualSequenceDiagram: (
		preset: SkedraSequenceVisualPreset,
		options?: { x?: number; y?: number },
	) => CanvasElement[];
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
	canvasBackground?: string;
	defaultCanvasBackground?: string;
	canvasBackgroundOptions?: readonly string[];
	onCanvasBackgroundChange?: (background: string) => void;
	showGrid?: boolean;
	onGridChange?: (enabled: boolean) => void;
	initialGridSnap?: boolean;
	initialGridSize?: number;
	initialObjectSnapSettings?: Partial<SkedraObjectSnapSettings>;
	onGridSettingsChange?: (settings: SkedraGridSettings) => void;
	onObjectSnapSettingsChange?: (settings: SkedraObjectSnapSettings) => void;
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
	triangle: Triangle,
	cloud: Cloud,
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
const DEFAULT_CANVAS_BACKGROUND_OPTIONS = [
	"",
	"#fffef9",
	"#f8fafc",
	"#f0fdf4",
	"#eff6ff",
	"#fdf4ff",
	"#18181b",
] as const;
const DEFAULT_OBJECT_SNAP_SETTINGS: SkedraObjectSnapSettings = {
	enabled: true,
	endpoints: true,
	midpoints: true,
	divisions: false,
	divisionCount: DEFAULT_CANVAS_SNAP_DIVISION_COUNT,
	centers: true,
	nearest: false,
	geometricCenters: true,
	quadrants: true,
	intersections: true,
	extensions: true,
	insertions: false,
	showPoints: true,
};
const OBJECT_SNAP_SETTING_KEYS: Record<
	SkedraObjectSnapMode,
	keyof SkedraObjectSnapSettings
> = {
	endpoint: "endpoints",
	midpoint: "midpoints",
	division: "divisions",
	center: "centers",
	"geometric-center": "geometricCenters",
	quadrant: "quadrants",
	intersection: "intersections",
	extension: "extensions",
	insertion: "insertions",
	nearest: "nearest",
};
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
			canvasBackground: canvasBackgroundProp,
			defaultCanvasBackground = "",
			canvasBackgroundOptions = DEFAULT_CANVAS_BACKGROUND_OPTIONS,
			onCanvasBackgroundChange,
			showGrid = true,
			onGridChange,
			initialGridSnap = showGrid,
			initialGridSize = GRID_SIZE,
			initialObjectSnapSettings,
			onGridSettingsChange,
			onObjectSnapSettingsChange,
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
		const lastCanvasPointerClientRef = useRef<{
			clientX: number;
			clientY: number;
		} | null>(null);
		const clipboardRef = useRef<CanvasElement[]>([]);
		const formatClipboardRef = useRef<CanvasElementFormat | null>(null);
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
		const [gridSnapEnabled, setGridSnapEnabled] = useState(initialGridSnap);
		const [gridSize, setGridSize] = useState(() =>
			normalizeCanvasGridSize(initialGridSize),
		);
		const [theme, setTheme] = useState(themeProp);
		const [internalCanvasBackground, setInternalCanvasBackground] = useState(
			defaultCanvasBackground,
		);
		const canvasBackground = canvasBackgroundProp ?? internalCanvasBackground;
		const setCanvasBackground = useCallback(
			(background: string) => {
				if (canvasBackgroundProp === undefined) {
					setInternalCanvasBackground(background);
				}
				onCanvasBackgroundChange?.(background);
			},
			[canvasBackgroundProp, onCanvasBackgroundChange],
		);
		const [zenMode, setZenMode] = useState(false);
		const [objectSnapSettings, setObjectSnapSettingsState] =
			useState<SkedraObjectSnapSettings>(() => {
				const initial = {
					...DEFAULT_OBJECT_SNAP_SETTINGS,
					...initialObjectSnapSettings,
				};
				return {
					...initial,
					divisionCount: normalizeCanvasSnapDivisionCount(
						initial.divisionCount,
					),
				};
			});
		const snapToObjects = objectSnapSettings.enabled;
		const setSnapToObjects = useCallback((enabled: boolean) => {
			setObjectSnapSettingsState((current) => ({ ...current, enabled }));
		}, []);
		const [transformOrigin, setTransformOrigin] = useState<Point | null>(null);
		const [snapMenu, setSnapMenu] = useState<{
			x: number;
			y: number;
			kind: "running" | "override";
		} | null>(null);
		const [contextMenu, setContextMenu] = useState<{
			x: number;
			y: number;
		} | null>(null);
		const [snapOverrideMode, setSnapOverrideMode] =
			useState<SkedraObjectSnapMode | null>(null);
		const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
		const [snapPointIndicators, setSnapPointIndicators] = useState<
			SnapPointIndicator[]
		>([]);
		const [presentationViewId, setPresentationViewId] = useState<string | null>(
			null,
		);
		const [tool, setTool] = useState<SkedraSdkTool>(initialTool);
		const [sequenceDiagramOpen, setSequenceDiagramOpen] = useState(false);
		const [ganttPanelOpen, setGanttPanelOpen] = useState(false);
		const [activeGanttChartId, setActiveGanttChartId] = useState<string | null>(
			null,
		);
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
			cloudArcRadius: DEFAULT_CLOUD_ARC_RADIUS,
			pyramidSections: 1,
			polygonSides: DEFAULT_POLYGON_SIDES,
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
		const selectedElements = useMemo(
			() => scene.getSelectedElements(selectedIds),
			[scene, selectedIds],
		);
		const selectionGanttFrame = useMemo(
			() =>
				selectedElements[0]
					? findGanttChartElement(currentElements, selectedElements[0])
					: null,
			[currentElements, selectedElements],
		);
		const ganttCharts = useMemo(
			() =>
				currentElements
					.filter((element) => getGanttChartMeta(element) !== null)
					.map((element) => ({
						id: element.id,
						title: element.frameLabel?.trim() || "Project timeline",
					})),
			[currentElements],
		);
		useEffect(() => {
			if (selectionGanttFrame) setActiveGanttChartId(selectionGanttFrame.id);
		}, [selectionGanttFrame]);
		const resolvedActiveGanttChartId = ganttCharts.some(
			(chart) => chart.id === activeGanttChartId,
		)
			? activeGanttChartId
			: (ganttCharts[0]?.id ?? null);
		const selectedGanttFrame = useMemo(
			() =>
				selectionGanttFrame ??
				(resolvedActiveGanttChartId
					? findGanttChartElement(currentElements, resolvedActiveGanttChartId)
					: null),
			[currentElements, resolvedActiveGanttChartId, selectionGanttFrame],
		);
		const selectedGanttDocument = useMemo(
			() =>
				selectedGanttFrame
					? getGanttChartDocument(currentElements, selectedGanttFrame)
					: null,
			[currentElements, selectedGanttFrame],
		);
		const visibleSnapPointIndicators = useMemo(() => {
			const selectedOptions =
				snapToObjects && objectSnapSettings.showPoints
					? {
							includeEndpoints: objectSnapSettings.endpoints,
							includeCenters: objectSnapSettings.centers,
							includeMidpoints: objectSnapSettings.midpoints,
							includeDivisions: objectSnapSettings.divisions,
							divisionCount: objectSnapSettings.divisionCount,
							includeNearest: objectSnapSettings.nearest,
							includeGeometricCenters: objectSnapSettings.geometricCenters,
							includeQuadrants: objectSnapSettings.quadrants,
							includeIntersections: objectSnapSettings.intersections,
							includeExtensions: objectSnapSettings.extensions,
							includeInsertions: objectSnapSettings.insertions,
						}
					: null;
			return getCanvasSelectionSnapPointIndicators(
				selectedElements,
				selectedOptions,
				snapPointIndicators,
			);
		}, [
			objectSnapSettings,
			selectedElements,
			snapPointIndicators,
			snapToObjects,
		]);
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
		useEffect(
			() =>
				onGridSettingsChange?.({
					visible: gridEnabled,
					snap: gridSnapEnabled,
					size: gridSize,
				}),
			[gridEnabled, gridSize, gridSnapEnabled, onGridSettingsChange],
		);
		useEffect(
			() => onObjectSnapSettingsChange?.(objectSnapSettings),
			[objectSnapSettings, onObjectSnapSettingsChange],
		);
		useEffect(() => setGridEnabled(showGrid), [showGrid]);
		useEffect(() => setTheme(themeProp), [themeProp]);

		const resolveEditorSnap = useCallback(
			(
				point: Point,
				options: {
					objectSnap?: boolean;
					excludeIds?: Set<string>;
					forceAnchor?: boolean;
				} = {},
			) => {
				const overrideOptions =
					getCanvasEditorSnapModeOptions(snapOverrideMode);
				const gridPoint =
					gridSnapEnabled && !overrideOptions
						? snapCanvasPointToGrid(point, gridSize)
						: point;
				const result = resolveCanvasEditorPointSnap({
					point,
					elements: elementMap,
					excludeIds: options.excludeIds ?? new Set(["__draft"]),
					snap: {
						enabled:
							options.forceAnchor === true ||
							((snapToObjects || overrideOptions != null) &&
								options.objectSnap !== false),
						includeEndpoints:
							overrideOptions?.includeEndpoints ?? objectSnapSettings.endpoints,
						includeCenters:
							overrideOptions?.includeCenters ?? objectSnapSettings.centers,
						includeMidpoints:
							overrideOptions?.includeMidpoints ?? objectSnapSettings.midpoints,
						includeDivisions:
							overrideOptions?.includeDivisions ?? objectSnapSettings.divisions,
						divisionCount: objectSnapSettings.divisionCount,
						includeNearest:
							overrideOptions?.includeNearest ?? objectSnapSettings.nearest,
						includeGeometricCenters:
							overrideOptions?.includeGeometricCenters ??
							objectSnapSettings.geometricCenters,
						includeQuadrants:
							overrideOptions?.includeQuadrants ?? objectSnapSettings.quadrants,
						includeIntersections:
							overrideOptions?.includeIntersections ??
							objectSnapSettings.intersections,
						includeExtensions:
							overrideOptions?.includeExtensions ??
							objectSnapSettings.extensions,
						includeInsertions:
							overrideOptions?.includeInsertions ??
							objectSnapSettings.insertions,
						showInactivePoints: objectSnapSettings.showPoints,
						threshold: 12 / Math.max(viewport.zoom, 0.01),
					},
					forceAnchor: options.forceAnchor,
				});
				setSnapGuides(result.guides);
				setSnapPointIndicators(result.indicators);
				return {
					...result,
					point: resolveCanvasEditorPlacementPoint(result, gridPoint),
				};
			},
			[
				elementMap,
				gridSize,
				gridSnapEnabled,
				objectSnapSettings,
				snapOverrideMode,
				snapToObjects,
				viewport.zoom,
			],
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
		const rememberCanvasPointer = useCallback(
			(point: { clientX: number; clientY: number }) => {
				lastCanvasPointerClientRef.current = {
					clientX: point.clientX,
					clientY: point.clientY,
				};
			},
			[],
		);
		const getPastePoint = useCallback((): Point => {
			const svg = svgRef.current;
			const pointer = lastCanvasPointerClientRef.current;
			if (!svg || !pointer) return getViewportCenter();
			return toWorldPoint(pointer, svg, viewport);
		}, [getViewportCenter, viewport]);

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

		const insertGanttChart = useCallback(
			(
				options: Partial<
					Parameters<typeof createSkedraGanttChartElements>[0]
				> = {},
			) => {
				const size = getGanttChartSize({
					dayCount: options.dayCount,
					dayWidth: options.dayWidth,
					labelWidth: options.labelWidth,
					rowHeight: options.rowHeight,
					headerHeight: options.headerHeight,
					tasks: options.tasks,
				});
				const point =
					options.x != null && options.y != null
						? { x: options.x, y: options.y }
						: selectedGanttFrame
							? {
									x:
										selectedGanttFrame.x +
										selectedGanttFrame.width +
										80 +
										size.width / 2,
									y: selectedGanttFrame.y + size.height / 2,
								}
							: getViewportCenter();
				const created = addSdkElements(
					createSkedraGanttChartElements({
						x: point.x - size.width / 2,
						y: point.y - size.height / 2,
						title:
							options.title ??
							(ganttCharts.length === 0
								? "Project timeline"
								: `Project timeline ${ganttCharts.length + 1}`),
						startDate: options.startDate,
						dayCount: options.dayCount,
						dayWidth: options.dayWidth,
						labelWidth: options.labelWidth,
						rowHeight: options.rowHeight,
						headerHeight: options.headerHeight,
						tasks: options.tasks,
						dependencies: options.dependencies,
						dateLabel: options.dateLabel,
						appearance: options.appearance,
						theme,
						createId,
					}),
				);
				if (created[0]) setSelectedIds(new Set([created[0].id]));
				if (created[0]) setActiveGanttChartId(created[0].id);
				setTool("select");
				setGanttPanelOpen(true);
				return created;
			},
			[
				addSdkElements,
				ganttCharts.length,
				getViewportCenter,
				selectedGanttFrame,
				theme,
			],
		);

		const readGanttChartDocument = useCallback(
			(chartId?: string): SkedraGanttChartDocument | null =>
				getGanttChartDocument(currentElements, chartId ?? selectedGanttFrame),
			[currentElements, selectedGanttFrame],
		);

		const updateGanttChart = useCallback(
			(chartId: string, document: SkedraGanttChartDocument) => {
				const frame = findGanttChartElement(currentElements, chartId);
				if (!frame) return [];
				const plan = buildGanttChartMutationPlan(
					getSkedraElementFactoryDefaults({ theme, createId }),
					currentElements,
					frame,
					document,
				);
				const retained = currentElements.filter(
					(element) => !plan.deleteIds.includes(element.id),
				);
				const create = withSkedraStackIndexes(plan.create, retained);
				const next = applyCanvasMutationPlan(currentElements, {
					...plan,
					create,
				});
				commitCanvasElements(next);
				setSelectedIds(new Set(plan.selectedIds));
				return next.filter(
					(element) =>
						element.id === frame.id || getGanttChartId(element) === frame.id,
				);
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

		const insertSequenceDiagram = useCallback(
			(
				source: string,
				options: { x?: number; y?: number; participantGap?: number } = {},
			) => {
				const point =
					options.x != null && options.y != null
						? { x: options.x, y: options.y }
						: getViewportCenter();
				return addSdkElements(
					createSkedraSequenceDiagramElements({
						source,
						x: point.x,
						y: point.y,
						participantGap: options.participantGap,
						theme,
						createId,
					}),
				);
			},
			[addSdkElements, getViewportCenter, theme],
		);

		const insertVisualSequenceDiagram = useCallback(
			(
				preset: SkedraSequenceVisualPreset,
				options: { x?: number; y?: number } = {},
			) => {
				const point =
					options.x != null && options.y != null
						? { x: options.x, y: options.y }
						: getViewportCenter();
				return addSdkElements(
					createSkedraVisualSequenceDiagramElements({
						preset,
						x: point.x,
						y: point.y,
						theme,
						createId,
					}),
				);
			},
			[addSdkElements, getViewportCenter, theme],
		);

		const applySequenceDiagramMutation = useCallback(
			(plan: CanvasMutationPlan | null) => {
				if (!plan) return;
				const create = withSkedraStackIndexes(plan.create, currentElements);
				const next = applyCanvasMutationPlan(currentElements, {
					...plan,
					create,
				});
				commitCanvasElements(next);
				setSelectedIds(
					expandCanvasEditorAtomicSelectionIds(
						new Set(plan.selectedIds ?? create.map((element) => element.id)),
						new Map(next.map((element) => [element.id, element])),
					),
				);
			},
			[commitCanvasElements, currentElements],
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

		const copySelection = useCallback(
			(dataTransfer?: Pick<DataTransfer, "setData">) => {
				const copied = currentElements
					.filter((element) => selectedIds.has(element.id))
					.map((element) => structuredClone(element));
				if (copied.length > 0) {
					clipboardRef.current = copied;
					if (dataTransfer) {
						writeCanvasClipboardDataTransfer(dataTransfer, copied);
					} else if (
						typeof navigator !== "undefined" &&
						navigator.clipboard?.writeText
					) {
						void navigator.clipboard
							.writeText(serializeExcalidrawClipboard(copied))
							.catch(() => undefined);
					}
				}
				return copied;
			},
			[currentElements, selectedIds],
		);

		const pasteElements = useCallback(
			(
				source: CanvasElement[],
				placement: "pointer" | "offset" = "pointer",
			) => {
				if (source.length === 0 || readOnly) return [];
				const cloned = cloneCanvasSelection({
					elements: source,
					existingElements: currentElements,
					createId,
					offset:
						placement === "pointer"
							? getCanvasPasteOffset(source, getPastePoint())
							: undefined,
				});
				clipboardRef.current = cloned.elements.map((element) =>
					structuredClone(element),
				);
				commitCanvasElements([...currentElements, ...cloned.elements]);
				setSelectedIds(new Set(cloned.elements.map((element) => element.id)));
				return cloned.elements;
			},
			[commitCanvasElements, currentElements, getPastePoint, readOnly],
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

		const cutSelection = useCallback(
			(dataTransfer?: Pick<DataTransfer, "setData">) => {
				const copied = copySelection(dataTransfer);
				if (copied.length > 0) deleteSelection();
				return copied;
			},
			[copySelection, deleteSelection],
		);

		const duplicateSelection = useCallback(() => {
			const copied = copySelection();
			return pasteElements(copied, "offset");
		}, [copySelection, pasteElements]);

		const applySelectedUpdates = useCallback(
			(updates: Array<{ id: string; changes: Partial<CanvasElement> }>) => {
				if (readOnly || updates.length === 0) return;
				const allUpdates = [
					...updates,
					...buildCanvasBindingSyncUpdates(
						toCanvasElementMap(currentElements),
						updates,
					),
				];
				commitCanvasElements(
					applyCanvasElementUpdates(currentElements, allUpdates),
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
				applySelectedUpdates(
					getFlipUpdates(selectedElements, axis, transformOrigin ?? undefined),
				);
				if (transformOrigin) setTransformOrigin(null);
			},
			[applySelectedUpdates, selectedElements, transformOrigin],
		);

		const rotateSelection = useCallback(
			(angle: number) => {
				if (!Number.isFinite(angle)) return;
				applySelectedUpdates(
					getRotateUpdates(
						selectedElements,
						angle,
						transformOrigin ?? undefined,
					),
				);
				if (transformOrigin) setTransformOrigin(null);
			},
			[applySelectedUpdates, selectedElements, transformOrigin],
		);

		const cloneTransformedSelection = useCallback(
			(transform: SkedraSelectionTransform) => {
				if (readOnly || selectedElements.length === 0) return [];
				const cloned = cloneTransformedCanvasSelection({
					elements: selectedElements,
					existingElements: currentElements,
					createId,
					transform,
					origin: transformOrigin ?? undefined,
				});
				commitCanvasElements([...currentElements, ...cloned.elements]);
				setSelectedIds(new Set(cloned.elements.map((element) => element.id)));
				if (transformOrigin) setTransformOrigin(null);
				return cloned.elements;
			},
			[
				commitCanvasElements,
				currentElements,
				readOnly,
				selectedElements,
				transformOrigin,
			],
		);

		const lockSelection = useCallback(
			(locked?: boolean) => {
				applySelectedUpdates(getLockUpdates(selectedElements, locked));
			},
			[applySelectedUpdates, selectedElements],
		);

		const setSelectionProperties = useCallback(
			(properties: Partial<CanvasElement>) => {
				const updates = selectedElements.flatMap((element) => {
					const ownUpdate = {
						id: element.id,
						changes: {
							...properties,
							...(element.type === "cloud" &&
							properties.cloudArcRadius !== undefined
								? buildCloudArcRadiusChanges(element, properties.cloudArcRadius)
								: {}),
						},
					};
					if (
						element.type !== "frame" ||
						(properties.x === undefined &&
							properties.y === undefined &&
							properties.width === undefined &&
							properties.height === undefined)
					) {
						return [ownUpdate];
					}
					return [
						ownUpdate,
						...buildFrameResizeChildUpdates(
							elementMap,
							element.id,
							{
								x: element.x,
								y: element.y,
								width: element.width,
								height: element.height,
							},
							{
								x: properties.x ?? element.x,
								y: properties.y ?? element.y,
								width: properties.width ?? element.width,
								height: properties.height ?? element.height,
							},
						),
					];
				});
				applySelectedUpdates(updates);
			},
			[applySelectedUpdates, elementMap, selectedElements],
		);

		const copySelectionFormat = useCallback(() => {
			const element = selectedElements[0];
			if (!element) return;
			formatClipboardRef.current = getCanvasElementFormat(element);
		}, [selectedElements]);

		const pasteSelectionFormat = useCallback(() => {
			const format = formatClipboardRef.current;
			if (!format) return;
			applySelectedUpdates(
				buildCanvasElementFormatUpdates(selectedElements, format),
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

		const embedSelectionInFrame = useCallback(() => {
			if (readOnly || selectedElements.length === 0) return;
			const planned = createSelectionFrame({
				elements: selectedElements,
				existingElements: currentElements,
				createId,
			});
			if (!planned) return;
			commitCanvasElements(
				applyCanvasElementUpdates(
					[...currentElements, planned.frame],
					planned.updates,
				),
			);
			setSelectedIds(
				new Set([
					planned.frame.id,
					...selectedElements.map((element) => element.id),
				]),
			);
		}, [commitCanvasElements, currentElements, readOnly, selectedElements]);

		const removeSelectionFromFrame = useCallback(() => {
			applySelectedUpdates(
				selectedElements
					.filter((element) => element.frameId)
					.map((element) => ({
						id: element.id,
						changes: { frameId: undefined },
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
					...(properties.cloudArcRadius !== undefined
						? { cloudArcRadius: properties.cloudArcRadius }
						: {}),
					...(properties.pyramidSections !== undefined
						? { pyramidSections: properties.pyramidSections }
						: {}),
					...(properties.polygonSides !== undefined
						? { polygonSides: properties.polygonSides }
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
		const hasOnlyStructuredDiagramSelection =
			selectedElements.length > 0 &&
			selectedElements.every(
				(element) =>
					getGanttChartId(element) != null ||
					getSequenceDiagramId(element) != null,
			);

		const setGrid = useCallback(
			(enabled: boolean) => setGridEnabled(enabled),
			[],
		);
		const setGridSettings = useCallback(
			(settings: Partial<SkedraGridSettings>) => {
				if (settings.visible !== undefined) setGridEnabled(settings.visible);
				if (settings.snap !== undefined) setGridSnapEnabled(settings.snap);
				if (settings.size !== undefined) {
					setGridSize(normalizeCanvasGridSize(settings.size));
				}
			},
			[],
		);
		const setObjectSnapSettings = useCallback(
			(settings: Partial<SkedraObjectSnapSettings>) => {
				setObjectSnapSettingsState((current) => ({
					...current,
					...settings,
					divisionCount:
						settings.divisionCount === undefined
							? current.divisionCount
							: normalizeCanvasSnapDivisionCount(settings.divisionCount),
				}));
			},
			[],
		);
		const toggleObjectSnapMode = useCallback((mode: SkedraObjectSnapMode) => {
			const key = OBJECT_SNAP_SETTING_KEYS[mode];
			setObjectSnapSettingsState((current) => ({
				...current,
				[key]: !current[key],
			}));
		}, []);
		const objectSnapModes = useMemo(
			() =>
				Object.fromEntries(
					Object.entries(OBJECT_SNAP_SETTING_KEYS).map(([mode, key]) => [
						mode,
						objectSnapSettings[key],
					]),
				) as Record<SkedraObjectSnapMode, boolean>,
			[objectSnapSettings],
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
					canvasBg: canvasBackground,
				}),
			[canvasBackground, currentElements, currentViews, viewport],
		);

		const exportFrame = useCallback(
			async (frameId: string, format: "svg" | "png" | "pdf" | "pptx") => {
				const svg = svgRef.current;
				const frame = currentElements.find(
					(element) => element.id === frameId && element.type === "frame",
				);
				if (!svg || !frame) return null;
				return exportSdkFrame(svg, frame, format);
			},
			[currentElements],
		);

		const importFile = useCallback(
			(file: SkedraFile) => {
				commitCanvasElements(file.elements);
				commitViews(file.views ?? []);
				if (file.appState?.viewport) setViewport(file.appState.viewport);
				setCanvasBackground(file.appState?.canvasBg ?? "");
				setSelectedIds(new Set());
			},
			[commitCanvasElements, commitViews, setCanvasBackground],
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
						setSnapToObjects(!snapToObjects);
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
				setSnapToObjects,
				snapToObjects,
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
				insertGanttChart,
				getGanttChartDocument: readGanttChartDocument,
				updateGanttChart,
				insertMindmap,
				insertMindmapChild,
				insertMindmapSibling,
				insertSequenceDiagram,
				insertVisualSequenceDiagram,
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
				rotateSelection,
				cloneTransformedSelection,
				setTransformOrigin,
				getTransformOrigin: () => transformOrigin,
				setLocked: lockSelection,
				setProperties: setSelectionProperties,
				setCanvasBackground,
				getCanvasBackground: () => canvasBackground,
				setGrid,
				getGrid: () => gridEnabled,
				setGridSettings,
				getGridSettings: () => ({
					visible: gridEnabled,
					snap: gridSnapEnabled,
					size: gridSize,
				}),
				setObjectSnap: setSnapToObjects,
				getObjectSnap: () => snapToObjects,
				setObjectSnapSettings,
				getObjectSnapSettings: () => objectSnapSettings,
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
				exportFrame,
				importFile,
				executeCommand,
			}),
			[
				addFlowchartStep,
				alignSelection,
				canvasBackground,
				commitCanvasElements,
				commitElements,
				commitLibraries,
				cloneTransformedSelection,
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
				exportFrame,
				fitToContent,
				flipSelection,
				goToView,
				gridEnabled,
				gridSize,
				gridSnapEnabled,
				snapToObjects,
				objectSnapSettings,
				groupSelection,
				importFile,
				insertImage,
				insertFrame,
				insertKanbanBoard,
				insertKanbanCard,
				insertGanttChart,
				readGanttChartDocument,
				updateGanttChart,
				insertMindmap,
				insertMindmapChild,
				insertMindmapSibling,
				insertSequenceDiagram,
				insertVisualSequenceDiagram,
				insertStickyNote,
				insertTemplate,
				insertLibraryItem,
				layerSelection,
				lockSelection,
				movePresentation,
				pasteSelection,
				pasteFromClipboard,
				redo,
				rotateSelection,
				selectedIds,
				setFlowchartNodeKind,
				setCanvasBackground,
				setGrid,
				setGridSettings,
				setObjectSnapSettings,
				setSnapToObjects,
				setSelectionProperties,
				startPresentation,
				undo,
				ungroupSelection,
				updateKanbanCard,
				updateKanbanList,
				updateView,
				viewport,
				transformOrigin,
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
			applyMutationPlan: (plan) => {
				if (readOnly) return;
				commitCanvasElements(applyCanvasMutationPlan(currentElements, plan));
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
			resolvePoint: (clientX, clientY, options) => {
				const svg = svgRef.current;
				if (!svg) {
					return {
						raw: { x: clientX, y: clientY },
						snapped: { x: clientX, y: clientY },
					};
				}
				const raw = toWorldPoint({ clientX, clientY }, svg, viewport);
				const snap = resolveEditorSnap(raw, {
					objectSnap:
						tool === "line" ||
						tool === "arrow" ||
						tool === "rectangle" ||
						tool === "ellipse" ||
						tool === "diamond" ||
						tool === "triangle" ||
						tool === "cloud" ||
						options?.objectSnap === true ||
						(options?.forceAnchor && tool === "select"),
					forceAnchor: options?.forceAnchor,
					excludeIds: options?.excludeIds,
				});
				return {
					raw,
					snapped: snap.point,
					snapAnchor: snap.anchor,
				};
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
			onTentativeSnap: (point) => {
				if (!point.snapAnchor) return false;
				setTransformOrigin({ ...point.snapped });
				return true;
			},
			isTentativeSnapActive: () => transformOrigin != null,
			onTentativeSnapConsumed: () => setTransformOrigin(null),
			onGestureFinished: (action) => {
				if (action === "rotate") setTransformOrigin(null);
			},
		});
		const shapeTrim = useCanvasEditorShapeTrim({
			svgRef,
			viewport,
			elements: elementMap,
			snapToObjects,
			createId,
			applyMutationPlan: (plan) => {
				if (readOnly) return;
				beginHistoryTransaction();
				commitCanvasElements(applyCanvasMutationPlan(currentElements, plan));
				finishHistoryTransaction();
			},
			onActivate: () => {
				setTool("select");
				setContextMenu(null);
				setSnapMenu(null);
			},
		});
		const onSdkSurfacePointerDown = useCallback(
			(event: ReactPointerEvent<SVGSVGElement>) => {
				rememberCanvasPointer(event);
				if (shapeTrim.handlePointerDown(event)) return;
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
				const consumeSnapOverride =
					event.button === 0 && snapOverrideMode != null;
				editorPointer.onPointerDown(event);
				if (consumeSnapOverride) setSnapOverrideMode(null);
			},
			[
				cancelViewInteraction,
				editorPointer,
				isCapturingView,
				rememberCanvasPointer,
				snapOverrideMode,
				shapeTrim.handlePointerDown,
				startViewCapture,
				viewport,
			],
		);
		const onSdkSurfacePointerMove = useCallback(
			(event: ReactPointerEvent<SVGSVGElement>) => {
				rememberCanvasPointer(event);
				if (shapeTrim.handlePointerMove(event)) return;
				editorPointer.onPointerMove(event);
				const rect = event.currentTarget.getBoundingClientRect();
				handleViewPointerMove(
					(event.clientX - rect.left - viewport.x) / viewport.zoom,
					(event.clientY - rect.top - viewport.y) / viewport.zoom,
					event.pointerId,
				);
			},
			[
				editorPointer,
				handleViewPointerMove,
				rememberCanvasPointer,
				shapeTrim.handlePointerMove,
				viewport,
			],
		);
		const onSdkSurfaceContextMenu = useCallback(
			(event: ReactMouseEvent<SVGSVGElement>) => {
				rememberCanvasPointer(event);
				if (shapeTrim.active) {
					event.preventDefault();
					shapeTrim.cancel();
					return;
				}
				if (presentationViewId) {
					event.preventDefault();
					return;
				}
				if (event.shiftKey && canvasEditorToolSupportsSnapOverride(tool)) {
					event.preventDefault();
					setContextMenu(null);
					setSnapMenu({
						x: event.clientX,
						y: event.clientY,
						kind: "override",
					});
					return;
				}
				if (editorPointer.onContextMenu(event)) return;
				event.preventDefault();
				event.stopPropagation();
				setSnapMenu(null);
				const point = toWorldPoint(event, event.currentTarget, viewport);
				const target = scene.getElementAtPosition(point.x, point.y);
				setSelectedIds(
					resolveCanvasEditorContextSelectionIds(
						target,
						elementMap,
						selectedIds,
					),
				);
				setContextMenu({ x: event.clientX, y: event.clientY });
			},
			[
				editorPointer,
				elementMap,
				presentationViewId,
				rememberCanvasPointer,
				scene,
				selectedIds,
				shapeTrim.active,
				shapeTrim.cancel,
				tool,
				viewport,
			],
		);
		const onSdkSurfacePointerUp = useCallback(
			(event: ReactPointerEvent<SVGSVGElement>) => {
				rememberCanvasPointer(event);
				if (shapeTrim.handlePointerUp(event)) return;
				editorPointer.onPointerUp(event);
				handleViewPointerUp(event.pointerId);
			},
			[
				editorPointer,
				handleViewPointerUp,
				rememberCanvasPointer,
				shapeTrim.handlePointerUp,
			],
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
			const directUpdates = [{ id: element.id, changes }];
			const updates = [
				...directUpdates,
				...buildCanvasBindingSyncUpdates(
					toCanvasElementMap(currentElements),
					directUpdates,
				),
			];
			commitCanvasElements(applyCanvasElementUpdates(currentElements, updates));
		};

		const rotateWithKeyboard = (
			event: ReactKeyboardEvent<SVGCircleElement>,
		) => {
			const angle = resolveCanvasEditorRotationKeyDelta(event);
			if (angle == null) return;
			event.preventDefault();
			event.stopPropagation();
			rotateSelection(angle);
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
			if (!file) return;
			if (
				file.type.toLowerCase() === "image/svg+xml" ||
				file.name.toLowerCase().endsWith(".svg")
			) {
				const imported = parseSvgToCanvasElements(await file.text(), {
					createId,
					stroke,
					fontFamily: drawingStyle.fontFamily,
					target: getViewportCenter(),
					maxWidth: 1200,
					maxHeight: 900,
					sourceName: file.name,
				});
				if (imported) {
					const added = addSdkElements(imported.elements);
					setSelectedIds(new Set(added.map((element) => element.id)));
					return;
				}
			}
			await insertImage(file, { name: file.name });
		}, [
			addSdkElements,
			drawingStyle.fontFamily,
			getViewportCenter,
			insertImage,
			stroke,
		]);

		const pastePlainText = useCallback(async () => {
			if (readOnly || !navigator.clipboard?.readText) return;
			const text = await navigator.clipboard.readText().catch(() => "");
			if (!text.trim()) return;
			const id = createId();
			const center = getPastePoint();
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
			getPastePoint,
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
		const copyCanvasToClipboard = useCallback(async (format: "png" | "svg") => {
			const svg = svgRef.current;
			if (!svg) return;
			try {
				await copySkedraVisualToClipboard(svg, format);
			} catch (error) {
				console.error(
					`Could not copy the canvas as ${format.toUpperCase()}`,
					error,
				);
			}
		}, []);
		const keyboardActionHandlers: SkedraSdkKeyboardActionHandlers = {
			command: (command) => {
				if (command === "paste") void pasteFromClipboard();
				else executeCommand(command);
			},
			tool: setTool,
			toggleToolLock: () => setToolLocked((locked) => !locked),
			toggleObjectSnap: () => setSnapToObjects(!snapToObjects),
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
			copyCanvasAsPng: () => void copyCanvasToClipboard("png"),
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

		const getClipboardState = () => ({
			enabled: true,
			readOnly,
			editingText: editingTextId != null || pendingText != null,
			hasSelection: selectedIds.size > 0,
		});
		useCanvasEditorClipboard({
			getState: getClipboardState,
			onCopy: (dataTransfer) => copySelection(dataTransfer).length > 0,
			onCut: (dataTransfer) => cutSelection(dataTransfer).length > 0,
			onPaste: (dataTransfer) => {
				try {
					const parsed = parseSkedraClipboardDataTransfer(dataTransfer);
					clipboardRef.current = parsed;
					if (parsed.length > 0) pasteElements(parsed);
					return true;
				} catch {
					if (clipboardRef.current.length === 0) return false;
					pasteElements(clipboardRef.current);
					return true;
				}
			},
		});
		useCanvasEditorKeyboard({
			getState: getClipboardState,
			onEditorAction: (action) => {
				if (
					action.type === "command" &&
					(action.command === "copy" ||
						action.command === "cut" ||
						action.command === "paste")
				) {
					return false;
				}
				return handleSkedraSdkKeyboardAction(action, keyboardActionHandlers);
			},
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
				".skedra,.skedra.enc,.excalidraw,application/json,application/vnd.skedra+json,application/vnd.excalidraw+json",
			);
			if (!file) return;
			const raw = await file.text();
			const encrypted = raw.includes("skedra-encrypted");
			const passphrase = encrypted
				? (window.prompt("Passphrase") ?? undefined)
				: undefined;
			importFile(await parseSkedraFileContents(raw, passphrase));
		};

		const downloadExcalidrawDocument = () => {
			const file = createExcalidrawFile({
				elements: currentElements,
				viewport,
				canvasBg: canvasBackground,
			});
			downloadSkedraBlob(
				new Blob([serializeExcalidrawFile(file)], {
					type: "application/vnd.excalidraw+json",
				}),
				"skedra-whiteboard.excalidraw",
			);
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

		const downloadFrame = async (
			frame: CanvasElement,
			format: "svg" | "png",
		) => {
			const blob = await exportFrame(frame.id, format);
			if (!blob) return;
			downloadSkedraBlob(blob, getSkedraFrameExportFilename(frame, format));
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
				type: "action",
				id: "sequence-diagram",
				label: "Sequence diagram",
				icon: <Workflow size={17} strokeWidth={2} />,
				disabled: readOnly,
				onSelect: () => {
					setTool("select");
					setSequenceDiagramOpen(true);
				},
			},
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
					secondaryActions:
						template.id === "gantt"
							? [
									{
										id: "gantt-new",
										label: "New plan",
										onSelect: () => {
											insertGanttChart();
										},
									},
								]
							: undefined,
					onSelect: () => {
						if (template.id === "gantt") {
							if (selectedGanttFrame) {
								setSelectedIds(new Set([selectedGanttFrame.id]));
								setActiveGanttChartId(selectedGanttFrame.id);
								setGanttPanelOpen(true);
							} else {
								insertGanttChart();
							}
							return;
						}
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
						label: "Import .skedra or .excalidraw",
						onSelect: pickAndImportDocument,
					},
					{
						id: "export-skedra",
						label: "Export .skedra",
						onSelect: () => downloadDocument(false),
					},
					{
						id: "export-excalidraw",
						label: "Export .excalidraw",
						onSelect: downloadExcalidrawDocument,
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
				onSelect: () => setSnapToObjects(!snapToObjects),
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
				style={{
					...style,
					...(canvasBackground ? { backgroundColor: canvasBackground } : {}),
				}}
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
						responsive={{
							moreLabel: "More tools and actions",
							moreIcon: <LayoutTemplate size={17} strokeWidth={2} />,
							popoverClassName: "skedra-sdk__menu-wide",
						}}
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
					onContextMenu={onSdkSurfaceContextMenu}
					onDoubleClick={(event) => {
						if (!editorPointer.onDoubleClick()) handleDoubleClick(event);
					}}
					onWheel={editorPointer.onWheel}
					worldDataAttribute="true"
				>
					<CanvasEditorGridOverlay
						enabled={gridEnabled}
						zoom={viewport.zoom}
						gridSize={gridSize}
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
						points={visibleSnapPointIndicators}
						zoom={viewport.zoom}
						origin={transformOrigin}
					/>
					{shapeTrim.preview && (
						<CanvasEditorShapeTrimOverlay
							preview={shapeTrim.preview}
							zoom={viewport.zoom}
							instruction="Choose second cut point · Shift = long path · Esc = cancel"
						/>
					)}
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
					{!shapeTrim.preview && (
						<CanvasEditorSelectionOverlay
							selected={selectedElements}
							zoom={viewport.zoom}
							readOnly={readOnly}
							transformOrigin={transformOrigin}
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
							onRotateStart={editorPointer.beginRotate}
							onRotateKeyDown={rotateWithKeyboard}
							onPathPointDragStart={editorPointer.beginPathPointDrag}
							onShapeTrimEndpointDragStart={
								editorPointer.beginShapeTrimEndpointDrag
							}
							onInsertPathPoint={(element, pointIndex, point, event) =>
								editorPointer.runPointerUpAction(event, () =>
									insertPathPoint(element, pointIndex, point),
								)
							}
							pathBackground="var(--skedra-sdk-panel)"
							pathAccent="var(--skedra-sdk-primary)"
							pathControlLine="color-mix(in srgb, var(--skedra-sdk-primary) 55%, transparent)"
						/>
					)}
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
					<CanvasEditorEraserTrailOverlay
						points={editorPointer.eraserTrail}
						zoom={viewport.zoom}
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
				{ganttPanelOpen && !readOnly && !presentationViewId && (
					<CanvasEditorGanttStudio
						document={selectedGanttDocument}
						charts={ganttCharts}
						activeChartId={selectedGanttFrame?.id ?? null}
						onSelectChart={(chartId) => {
							const chart = findGanttChartElement(currentElements, chartId);
							if (!chart) return;
							setActiveGanttChartId(chart.id);
							setSelectedIds(new Set([chart.id]));
						}}
						onCreate={() => insertGanttChart()}
						onChange={(document) => {
							if (selectedGanttFrame) {
								updateGanttChart(selectedGanttFrame.id, document);
							}
						}}
						onDelete={
							selectedGanttFrame
								? () => {
										const chartId = selectedGanttFrame.id;
										commitCanvasElements(
											currentElements.filter(
												(element) =>
													element.id !== chartId &&
													getGanttChartId(element) !== chartId &&
													element.frameId !== chartId,
											),
										);
										setSelectedIds(new Set());
										setActiveGanttChartId(null);
										setGanttPanelOpen(false);
									}
								: undefined
						}
						onClose={() => setGanttPanelOpen(false)}
					/>
				)}
				{sequenceDiagramOpen && !readOnly && !presentationViewId && (
					<CanvasEditorSequenceDiagramPanel
						elements={elementMap}
						selectedElements={selectedElements}
						onCreateVisualDiagram={(preset) =>
							insertVisualSequenceDiagram(preset)
						}
						onAddParticipant={(diagramId, input) =>
							applySequenceDiagramMutation(
								planSequenceDiagramParticipantInsertion({
									...input,
									elements: elementMap,
									diagramId,
									defaults: getSkedraElementFactoryDefaults({
										theme,
										createId,
									}),
									appearance: getSkedraSequenceDiagramAppearance({ theme }),
								}),
							)
						}
						onAddMessage={(diagramId, input) =>
							applySequenceDiagramMutation(
								planSequenceDiagramMessageInsertion({
									...input,
									elements: elementMap,
									diagramId,
									defaults: getSkedraElementFactoryDefaults({
										theme,
										createId,
									}),
									appearance: getSkedraSequenceDiagramAppearance({ theme }),
								}),
							)
						}
						onAddActivation={(diagramId, participantId) =>
							applySequenceDiagramMutation(
								planSequenceDiagramActivationInsertion({
									participantId,
									elements: elementMap,
									diagramId,
									defaults: getSkedraElementFactoryDefaults({
										theme,
										createId,
									}),
									appearance: getSkedraSequenceDiagramAppearance({ theme }),
								}),
							)
						}
						onAddFragment={(diagramId, input) =>
							applySequenceDiagramMutation(
								planSequenceDiagramFragmentInsertion({
									...input,
									elements: elementMap,
									diagramId,
									defaults: getSkedraElementFactoryDefaults({
										theme,
										createId,
									}),
									appearance: getSkedraSequenceDiagramAppearance({ theme }),
									wrapCurrentFlow: true,
								}),
							)
						}
						onInsert={(source) => {
							insertSequenceDiagram(source);
							setSequenceDiagramOpen(false);
						}}
						onClose={() => setSequenceDiagramOpen(false)}
					/>
				)}
				{contextMenu && !zenMode && !presentationViewId && (
					<CanvasEditorContextMenu
						x={contextMenu.x}
						y={contextMenu.y}
						hasSelection={selectedIds.size > 0}
						selectionCount={selectedIds.size}
						isLocked={
							selectedElements.length > 0 &&
							selectedElements.every((element) => element.locked)
						}
						isInFrame={selectedElements.some((element) => !!element.frameId)}
						isGrouped={selectedElements.some((element) => !!element.groupId)}
						readOnly={readOnly}
						canPaste={clipboardRef.current.length > 0}
						canPasteFormat={formatClipboardRef.current != null}
						onCopy={copySelection}
						onCut={cutSelection}
						onPaste={() => {
							void pasteFromClipboard();
						}}
						onCopyAsPng={() => copyCanvasToClipboard("png")}
						onCopyAsSvg={() => copyCanvasToClipboard("svg")}
						onDuplicate={duplicateSelection}
						onDelete={deleteSelection}
						onSelectAll={() =>
							setSelectedIds(
								new Set(currentElements.map((element) => element.id)),
							)
						}
						onToggleLock={() => lockSelection()}
						onCopyFormat={copySelectionFormat}
						onPasteFormat={pasteSelectionFormat}
						onBringForward={() => layerSelection("bring-forward")}
						onSendBackward={() => layerSelection("send-backward")}
						onBringToFront={() => layerSelection("bring-to-front")}
						onSendToBack={() => layerSelection("send-to-back")}
						onFlipHorizontal={() => flipSelection("horizontal")}
						onFlipVertical={() => flipSelection("vertical")}
						onCopyMirrorHorizontal={() =>
							cloneTransformedSelection({
								type: "flip",
								axis: "horizontal",
							})
						}
						onCopyMirrorVertical={() =>
							cloneTransformedSelection({
								type: "flip",
								axis: "vertical",
							})
						}
						onRotate={rotateSelection}
						onCopyRotate={(angle) =>
							cloneTransformedSelection({ type: "rotate", angle })
						}
						onAddLink={addSelectionLink}
						onEmbedInFrame={embedSelectionInFrame}
						onRemoveFromFrame={removeSelectionFromFrame}
						onGroup={groupSelection}
						onUngroup={ungroupSelection}
						canTrimShape={
							selectedElements.length === 1 &&
							selectedElements[0] !== undefined &&
							canTrimCanvasShape(selectedElements[0])
						}
						onTrimShape={() => {
							const shape = selectedElements[0];
							if (!shape) return;
							shapeTrim.start(shape, {
								clientX: contextMenu.x,
								clientY: contextMenu.y,
							});
						}}
						snapToObjects={snapToObjects}
						onToggleSnap={() => setSnapToObjects(!snapToObjects)}
						showSnapPoints={objectSnapSettings.showPoints}
						onToggleSnapPoints={() =>
							setObjectSnapSettings({
								showPoints: !objectSnapSettings.showPoints,
							})
						}
						snapModes={objectSnapModes}
						onToggleSnapMode={toggleObjectSnapMode}
						snapDivisionCount={objectSnapSettings.divisionCount}
						onSnapDivisionCountChange={(divisionCount) =>
							setObjectSnapSettings({ divisionCount })
						}
						gridEnabled={gridEnabled}
						onToggleGrid={() => setGridEnabled((enabled) => !enabled)}
						gridSnapEnabled={gridSnapEnabled}
						onToggleGridSnap={() => setGridSnapEnabled((enabled) => !enabled)}
						gridSize={gridSize}
						onGridSizeChange={(size) =>
							setGridSize(normalizeCanvasGridSize(size))
						}
						onClose={() => setContextMenu(null)}
					/>
				)}
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
				{showProperties &&
					!hasOnlyStructuredDiagramSelection &&
					!zenMode &&
					!presentationViewId && (
						<SkedraPropertiesPanel
							selected={propertiesSelection}
							mode={selectedElements.length > 0 ? "selection" : "defaults"}
							readOnly={readOnly}
							canvasBackground={{
								value: canvasBackground,
								options: canvasBackgroundOptions,
								onChange: setCanvasBackground,
							}}
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
									: setSelectionProperties({
											width: diameter,
											height: diameter,
										})
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
							onExportFrame={
								selectedElements.length === 1 &&
								selectedElements[0]?.type === "frame"
									? (format) => {
											void downloadFrame(selectedElements[0], format);
										}
									: undefined
							}
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
