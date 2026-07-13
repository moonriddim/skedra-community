import {
	CanvasScene,
	applyCanvasElementUpdates,
	applyCanvasMutationPlan,
	buildCanvasDrawingElement,
	buildCanvasMoveUpdates,
	buildCanvasTextElement,
	buildCanvasTextUpdate,
	buildKanbanDropUpdates,
	buildTemplateDropUpdates,
	buildTemplateSectionLayoutSyncUpdates,
	clientPointToCanvas,
	collectCanvasSelectionRectIds,
	computeViewportForBounds,
	createCanvasTemplateStickyNote,
	createStackIndexAfter,
	getBBox,
	getCanvasKeyboardCommand,
	getCanvasKeyboardResizeChanges,
	getCanvasViewportCenter,
	getCombinedBBox,
	isKanbanCard,
	isKanbanList,
	isMindmapNode,
	lassoPathToSvgD,
	normalizeCanvasRect,
	planCanvasDeletion,
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
	Diamond,
	Eraser,
	Frame,
	GitBranch,
	Hand,
	Kanban,
	Lasso,
	LayoutTemplate,
	Minus,
	MousePointer2,
	PenLine,
	Pipette,
	Plus,
	Square,
	StickyNote,
	TextCursorInput,
	Trash2,
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
import type { CanvasElement, Viewport } from "./types.js";

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

export interface SkedraCanvasApi {
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

export const SkedraCanvas = forwardRef<SkedraCanvasApi, SkedraCanvasProps>(
	function SkedraCanvas(
		{
			elements,
			defaultElements = [],
			onChange,
			readOnly = false,
			showToolbar = true,
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
		const reactId = useId();
		const svgIdPrefix = useMemo(
			() => `skedra-sdk-${toSvgIdPart(reactId)}`,
			[reactId],
		);
		const gridPatternId = `${svgIdPrefix}-grid`;
		const isControlled = elements != null;
		const [internalElements, setInternalElements] =
			useState<CanvasElement[]>(defaultElements);
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

		const commitElements = useCallback(
			(next: CanvasElement[]) => {
				if (!isControlled) {
					setInternalElements(next);
				}
				onChange?.(next);
			},
			[isControlled, onChange],
		);

		const applyDerivedUpdates = useCallback((next: CanvasElement[]) => {
			return applyCanvasMutationPlan(next, {
				create: [],
				update: [],
				deleteIds: [],
			});
		}, []);

		const commitCanvasElements = useCallback(
			(next: CanvasElement[]) => {
				commitElements(applyDerivedUpdates(next));
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
				setTool,
				fitToContent,
			}),
			[
				commitCanvasElements,
				commitElements,
				currentElements,
				fitToContent,
				insertFrame,
				insertKanbanBoard,
				insertKanbanCard,
				insertMindmap,
				insertMindmapChild,
				insertMindmapSibling,
				insertStickyNote,
				insertTemplate,
				selectedIds,
			],
		);

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
					point: world,
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
						x: world.x - 100,
						y: world.y - 100,
						text: "",
						theme,
						createId,
					}),
				]);
				setSelectedIds(new Set([note.id]));
				return;
			}

			if (tool === "kanban") {
				insertKanbanBoard({ x: world.x, y: world.y });
				return;
			}

			if (tool === "mindmap") {
				insertMindmap({ x: world.x, y: world.y });
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
				startWorld: world,
				points: [world],
			};
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

			const world = toWorldPoint(event, svg, viewport);

			if (drag.type === "resize") {
				const changes = resizeCanvasElement(
					drag.startElement,
					drag.handle,
					world.x - drag.startWorld.x,
					world.y - drag.startWorld.y,
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
				const dx = world.x - drag.startWorld.x;
				const dy = world.y - drag.startWorld.y;
				const startMap = toCanvasElementMap(drag.startElements);
				commitElements(
					applyCanvasElementUpdates(
						drag.startElements,
						buildCanvasMoveUpdates(startMap, drag.moveStart, dx, dy),
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
				return;
			}

			if (!drag || drag.type !== "draw" || !draftElement) {
				setDraftElement(null);
				return;
			}

			if (!shouldKeepCanvasDrawing(draftElement)) {
				setDraftElement(null);
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

		const clearSelected = useCallback(() => {
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

		useEffect(() => {
			if (readOnly) return;

			const handleKeyDown = (event: globalThis.KeyboardEvent) => {
				const target = event.target as HTMLElement | null;
				if (
					target?.closest("input, textarea, select, [contenteditable='true']")
				) {
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
				}
			};

			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}, [
			clearSelected,
			commitElements,
			currentElements,
			readOnly,
			selectedIds.size,
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

		return (
			<div
				className={normalizeClassName(className)}
				style={style}
				data-theme={theme}
			>
				{showToolbar && (
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
							width="24"
							height="24"
							patternUnits="userSpaceOnUse"
						>
							<path
								d="M 24 0 L 0 0 0 24"
								fill="none"
								stroke="currentColor"
								strokeOpacity="0.08"
								strokeWidth="1"
							/>
						</pattern>
					</defs>
					<rect width="100%" height="100%" fill={`url(#${gridPatternId})`} />
					<g
						transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}
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
			</div>
		);
	},
);

function SdkMindmapActions({
	element,
	viewport,
	onInsertChild,
}: {
	element: CanvasElement;
	viewport: Viewport;
	onInsertChild: (
		parentId: string,
		options?: { direction?: "left" | "right" | "up" | "down"; text?: string },
	) => CanvasElement | null;
}) {
	const directions: Array<"left" | "right" | "up" | "down"> = [
		"left",
		"right",
		"up",
		"down",
	];
	const points = directions.map((direction) => ({
		direction,
		x:
			direction === "left"
				? element.x
				: direction === "right"
					? element.x + element.width
					: element.x + element.width / 2,
		y:
			direction === "up"
				? element.y
				: direction === "down"
					? element.y + element.height
					: element.y + element.height / 2,
	}));
	return (
		<g>
			{points.map((point) => (
				<g
					key={`${element.id}-${point.direction}`}
					transform={`translate(${point.x}, ${point.y}) scale(${1 / viewport.zoom})`}
				>
					<foreignObject x={-10} y={-10} width={20} height={20}>
						<button
							type="button"
							className="skedra-sdk__mindmap-action"
							aria-label={`Add mindmap node ${point.direction}`}
							onPointerDown={(event) => event.stopPropagation()}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onInsertChild(element.id, { direction: point.direction });
							}}
						>
							<Plus size={13} strokeWidth={2.2} />
						</button>
					</foreignObject>
				</g>
			))}
		</g>
	);
}
