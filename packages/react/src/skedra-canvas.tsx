import {
	CanvasScene,
	MINDMAP_HORIZONTAL_GAP,
	MINDMAP_NODE_HEIGHT,
	MINDMAP_NODE_WIDTH,
	MINDMAP_VERTICAL_GAP,
	buildKanbanDeletionReflowUpdates,
	buildKanbanReflowUpdates,
	buildMindmapSyncUpdates,
	collectMindmapDescendantIds,
	createBaseCanvasElement,
	createMindmapEdge,
	createMindmapNode,
	createStackIndexAfter,
	createStackIndexBeforeElement,
	findListAtPoint,
	getArrowPath,
	getBBox,
	getCombinedBBox,
	getImageRenderGeometry,
	getMindmapBranchColorForNewNode,
	getMindmapEdgeMeta,
	getMindmapNodeMeta,
	isKanbanCard,
	isKanbanList,
	isMindmapNode,
	linePath,
	renderArrowHead,
	smoothPath,
} from "@skedra/canvas-core";
import {
	ArrowRight,
	Circle,
	Diamond,
	Frame,
	GitBranch,
	Hand,
	Kanban,
	LayoutTemplate,
	Minus,
	MousePointer2,
	PenLine,
	Plus,
	Square,
	StickyNote,
	TextCursorInput,
	Trash2,
} from "lucide-react";
import {
	type CSSProperties,
	type ComponentType,
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
	withSkedraStackIndexes,
} from "./factories.js";
import type { CanvasElement, Viewport } from "./types.js";

export type SkedraSdkTool =
	| "select"
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
	| "mindmap";

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
	  }
	| {
			type: "selection";
			startWorld: Point;
			currentWorld: Point;
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

const SDK_TOOLS: Array<{
	id: SkedraSdkTool;
	label: string;
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}> = [
	{ id: "select", label: "Select", icon: MousePointer2 },
	{ id: "pan", label: "Pan", icon: Hand },
	{ id: "rectangle", label: "Rectangle", icon: Square },
	{ id: "ellipse", label: "Ellipse", icon: Circle },
	{ id: "diamond", label: "Diamond", icon: Diamond },
	{ id: "line", label: "Line", icon: Minus },
	{ id: "arrow", label: "Arrow", icon: ArrowRight },
	{ id: "freehand", label: "Freehand", icon: PenLine },
	{ id: "text", label: "Text", icon: TextCursorInput },
	{ id: "frame", label: "Frame", icon: Frame },
	{ id: "sticky-note", label: "Sticky note", icon: StickyNote },
	{ id: "kanban", label: "Kanban board", icon: Kanban },
	{ id: "mindmap", label: "Mindmap", icon: GitBranch },
];

const DEFAULT_STROKE = "#17211d";
const DEFAULT_FILL = "transparent";
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

function createId() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `skedra-${Date.now().toString(36)}-${Math.random()
		.toString(36)
		.slice(2)}`;
}

function clampZoom(zoom: number) {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function normalizeClassName(className?: string) {
	return className ? `skedra-sdk ${className}` : "skedra-sdk";
}

function toSvgIdPart(value: string) {
	const normalized = value.replace(/[^A-Za-z0-9_-]/g, "_");
	return normalized.length > 0 ? normalized : "id";
}

function toLocalPoint(
	event:
		| ReactPointerEvent<SVGSVGElement>
		| ReactMouseEvent<SVGSVGElement>
		| WheelEvent<SVGSVGElement>,
	svg: SVGSVGElement,
) {
	const rect = svg.getBoundingClientRect();
	return {
		x: event.clientX - rect.left,
		y: event.clientY - rect.top,
	};
}

function toWorldPoint(
	event:
		| ReactPointerEvent<SVGSVGElement>
		| ReactMouseEvent<SVGSVGElement>
		| WheelEvent<SVGSVGElement>,
	svg: SVGSVGElement,
	viewport: Viewport,
) {
	const local = toLocalPoint(event, svg);
	return {
		x: (local.x - viewport.x) / viewport.zoom,
		y: (local.y - viewport.y) / viewport.zoom,
	};
}

function normalizeRect(start: Point, end: Point) {
	return {
		x: Math.min(start.x, end.x),
		y: Math.min(start.y, end.y),
		width: Math.abs(end.x - start.x),
		height: Math.abs(end.y - start.y),
	};
}

function pointToTuple(point: Point): [number, number] {
	return [point.x, point.y];
}

function makeElementDefaults(stroke: string) {
	return { createId, stroke };
}

function buildShapeElement(options: {
	type: "rectangle" | "ellipse" | "diamond";
	start: Point;
	end: Point;
	stroke: string;
	fill: string;
	stackIndex?: string;
}) {
	const rect = normalizeRect(options.start, options.end);
	return createBaseCanvasElement(makeElementDefaults(options.stroke), {
		type: options.type,
		x: rect.x,
		y: rect.y,
		width: Math.max(1, rect.width),
		height: Math.max(1, rect.height),
		fill: options.fill,
		stroke: options.stroke,
		stackIndex: options.stackIndex,
	});
}

function buildFrameElement(options: {
	start: Point;
	end: Point;
	stroke: string;
	stackIndex?: string;
}) {
	const rect = normalizeRect(options.start, options.end);
	return createSkedraFrameElement({
		x: rect.x,
		y: rect.y,
		width: Math.max(1, rect.width),
		height: Math.max(1, rect.height),
		stroke: options.stroke,
		label: "Frame",
		customData: undefined,
		createId,
	});
}

function buildLineElement(options: {
	type: "line" | "arrow";
	start: Point;
	end: Point;
	stroke: string;
	stackIndex?: string;
}) {
	const dx = options.end.x - options.start.x;
	const dy = options.end.y - options.start.y;
	return createBaseCanvasElement(makeElementDefaults(options.stroke), {
		type: options.type,
		x: options.start.x,
		y: options.start.y,
		width: Math.abs(dx),
		height: Math.abs(dy),
		fill: "transparent",
		stroke: options.stroke,
		points: [
			[0, 0],
			[dx, dy],
		],
		arrowHeadEnd: options.type === "arrow" ? "arrow" : "none",
		stackIndex: options.stackIndex,
	});
}

function buildFreehandElement(options: {
	points: Point[];
	stroke: string;
	stackIndex?: string;
}) {
	const minX = Math.min(...options.points.map((point) => point.x));
	const minY = Math.min(...options.points.map((point) => point.y));
	const maxX = Math.max(...options.points.map((point) => point.x));
	const maxY = Math.max(...options.points.map((point) => point.y));
	return createBaseCanvasElement(makeElementDefaults(options.stroke), {
		type: "freehand",
		x: minX,
		y: minY,
		width: Math.max(1, maxX - minX),
		height: Math.max(1, maxY - minY),
		fill: "transparent",
		stroke: options.stroke,
		strokeWidth: 2,
		points: options.points.map((point) => [point.x - minX, point.y - minY]),
		stackIndex: options.stackIndex,
	});
}

function buildTextElement(options: {
	point: Point;
	text: string;
	stroke: string;
	stackIndex?: string;
}) {
	const lines = options.text.split("\n");
	const longest = lines.reduce((max, line) => Math.max(max, line.length), 1);
	return createBaseCanvasElement(makeElementDefaults(options.stroke), {
		type: "text",
		x: options.point.x,
		y: options.point.y,
		width: Math.max(56, longest * 11),
		height: Math.max(28, lines.length * 24),
		fill: "transparent",
		stroke: "transparent",
		text: options.text,
		textColor: options.stroke,
		fontSize: 20,
		fontFamily: "Kalam, Comic Sans MS, Segoe Print, cursive",
		stackIndex: options.stackIndex,
	});
}

function buildDraftElement(
	drag: Extract<DragState, { type: "draw" }>,
	stroke: string,
	fill: string,
) {
	const end = drag.points[drag.points.length - 1] ?? drag.startWorld;
	if (
		drag.tool === "rectangle" ||
		drag.tool === "ellipse" ||
		drag.tool === "diamond"
	) {
		return buildShapeElement({
			type: drag.tool,
			start: drag.startWorld,
			end,
			stroke,
			fill,
		});
	}
	if (drag.tool === "frame") {
		return buildFrameElement({
			start: drag.startWorld,
			end,
			stroke,
		});
	}
	if (drag.tool === "line" || drag.tool === "arrow") {
		return buildLineElement({
			type: drag.tool,
			start: drag.startWorld,
			end,
			stroke,
		});
	}
	return buildFreehandElement({ points: drag.points, stroke });
}

function shouldKeepDraft(element: CanvasElement) {
	if (element.type === "freehand") return (element.points?.length ?? 0) > 2;
	if (element.type === "line" || element.type === "arrow") {
		const [start, end] = element.points ?? [];
		if (!start || !end) return false;
		return Math.hypot(end[0] - start[0], end[1] - start[1]) > 4;
	}
	return element.width > 4 || element.height > 4;
}

function elementMap(elements: CanvasElement[]) {
	return new Map(elements.map((element) => [element.id, element]));
}

function applyElementUpdates(
	elements: CanvasElement[],
	updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
) {
	if (updates.length === 0) return elements;
	const updatesById = new Map(
		updates.map((update) => [update.id, update.changes]),
	);
	return elements.map((element) => {
		const changes = updatesById.get(element.id);
		return changes ? { ...element, ...changes } : element;
	});
}

function collectDeletedElementIds(
	elements: CanvasElement[],
	selectedIds: Set<string>,
) {
	const map = elementMap(elements);
	const deletedIds = new Set<string>();

	for (const element of elements) {
		if (!selectedIds.has(element.id) || element.locked) continue;
		deletedIds.add(element.id);
		if (isMindmapNode(element)) {
			for (const id of collectMindmapDescendantIds(element.id, map)) {
				deletedIds.add(id);
			}
		}
	}

	return deletedIds;
}

function deleteRelatedElements(
	elements: CanvasElement[],
	deletedIds: Set<string>,
) {
	const listIds = new Set(
		elements
			.filter((element) => deletedIds.has(element.id) && isKanbanList(element))
			.map((element) => element.id),
	);
	return elements.filter((element) => {
		if (deletedIds.has(element.id)) return false;
		if (element.frameId && listIds.has(element.frameId)) return false;
		const edgeMeta = getMindmapEdgeMeta(element);
		return (
			!edgeMeta ||
			(!deletedIds.has(edgeMeta.mindmapSourceId) &&
				!deletedIds.has(edgeMeta.mindmapTargetId))
		);
	});
}

function moveElements(
	elements: CanvasElement[],
	selectedIds: Set<string>,
	dx: number,
	dy: number,
) {
	return elements.map((element) =>
		selectedIds.has(element.id) && !element.locked
			? { ...element, x: element.x + dx, y: element.y + dy }
			: element,
	);
}

function getElementText(element: CanvasElement) {
	return element.text ?? "";
}

function renderTextLines(text: string) {
	const lines = text.split("\n");
	return lines.length > 0 ? lines : [""];
}

function getElementTransform(element: CanvasElement) {
	const cx = element.x + element.width / 2;
	const cy = element.y + element.height / 2;
	const transforms: string[] = [];
	if (element.rotation)
		transforms.push(`rotate(${element.rotation} ${cx} ${cy})`);
	if (element.flipX || element.flipY) {
		transforms.push(
			`translate(${cx}, ${cy}) scale(${element.flipX ? -1 : 1}, ${element.flipY ? -1 : 1}) translate(${-cx}, ${-cy})`,
		);
	}
	return transforms.length > 0 ? transforms.join(" ") : undefined;
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
		const [stroke, setStroke] = useState(strokeColor);
		const [fill, setFill] = useState(fillColor);

		const currentElements = elements ?? internalElements;
		const scene = useMemo(
			() => CanvasScene.from(currentElements),
			[currentElements],
		);
		const sortedElements = scene.getSortedElements();
		const selectedElements = scene.getSelectedElements(selectedIds);

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
			const map = elementMap(next);
			const mindmapUpdates = buildMindmapSyncUpdates(map);
			return applyElementUpdates(next, mindmapUpdates);
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
			return {
				x: (rect.width / 2 - viewport.x) / viewport.zoom,
				y: (rect.height / 2 - viewport.y) / viewport.zoom,
			};
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
				const next = [...currentElements, card];
				const moved = new Set([card.id]);
				const target = new Map<string, string | null>([[card.id, listId]]);
				const updates = buildKanbanReflowUpdates(
					elementMap(next),
					moved,
					target,
				);
				commitCanvasElements(applyElementUpdates(next, updates));
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
				const parent = currentElements.find(
					(element) => element.id === parentId,
				);
				const parentMeta = getMindmapNodeMeta(parent);
				if (!parent || !parentMeta) return null;
				const direction =
					options.direction ??
					(parentMeta.mindmapDepth === 0
						? "right"
						: parentMeta.mindmapDirection);
				const isHorizontal = direction === "left" || direction === "right";
				const currentMap = elementMap(currentElements);
				const children = scene.getMindmapChildNodes(parent.id, direction);
				let x = parent.x;
				let y = parent.y;
				if (isHorizontal) {
					x =
						direction === "right"
							? parent.x + parent.width + MINDMAP_HORIZONTAL_GAP
							: parent.x - MINDMAP_HORIZONTAL_GAP - MINDMAP_NODE_WIDTH;
					if (children.length > 0) {
						const lastChild = children[children.length - 1];
						const subtreeIds = collectMindmapDescendantIds(
							lastChild.id,
							currentMap,
						);
						let bottom = lastChild.y + lastChild.height;
						for (const id of subtreeIds) {
							const descendant = currentMap.get(id);
							if (descendant)
								bottom = Math.max(bottom, descendant.y + descendant.height);
						}
						y = bottom + 32;
					} else {
						y = parent.y + parent.height / 2 - MINDMAP_NODE_HEIGHT / 2;
					}
				} else {
					x = parent.x + parent.width / 2 - MINDMAP_NODE_WIDTH / 2;
					y =
						direction === "down"
							? parent.y + parent.height + MINDMAP_VERTICAL_GAP
							: parent.y - MINDMAP_VERTICAL_GAP - MINDMAP_NODE_HEIGHT;
				}
				const branchColor = getMindmapBranchColorForNewNode(parent, currentMap);
				const nodeId = createId();
				const edgeId = createId();
				const node = createMindmapNode({
					id: nodeId,
					x,
					y,
					text: options.text ?? "New node",
					treeId: parentMeta.mindmapTreeId,
					parentId: parent.id,
					direction,
					depth: parentMeta.mindmapDepth + 1,
					stroke: branchColor,
					stackIndex: createStackIndexAfter(currentElements, nodeId),
				});
				const edge = createMindmapEdge({
					id: edgeId,
					treeId: parentMeta.mindmapTreeId,
					source: parent,
					target: node,
					stroke: branchColor,
					stackIndex: createStackIndexBeforeElement(
						[...currentElements, node],
						node.id,
						edgeId,
					),
				});
				commitCanvasElements([...currentElements, edge, node]);
				setSelectedIds(new Set([node.id]));
				return node;
			},
			[commitCanvasElements, currentElements, scene],
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
			const rect = svg.getBoundingClientRect();
			const padding = 72;
			const zoom = clampZoom(
				Math.min(
					(rect.width - padding * 2) / Math.max(bounds.width, 1),
					(rect.height - padding * 2) / Math.max(bounds.height, 1),
				),
			);
			setViewport({
				zoom,
				x: rect.width / 2 - (bounds.x + bounds.width / 2) * zoom,
				y: rect.height / 2 - (bounds.y + bounds.height / 2) * zoom,
			});
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
				insertStickyNote,
				insertTemplate,
				selectedIds,
			],
		);

		const resolveText = useCallback(
			(element: CanvasElement | null) => {
				const currentText = element ? getElementText(element) : "Text";
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

			if (readOnly) return;

			if (tool === "text") {
				const text = resolveText(null);
				if (!text) return;
				const nextElement = buildTextElement({
					point: world,
					text,
					stroke,
					stackIndex: createStackIndexAfter(currentElements, createId()),
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
					dragRef.current = {
						type: "select-move",
						startWorld: world,
						startElements: currentElements,
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

			if (drag.type === "selection") {
				drag.currentWorld = world;
				setSelectionBox({ start: drag.startWorld, end: world });
				const box = normalizeRect(drag.startWorld, world);
				const matches = currentElements.filter((element) => {
					if (element.locked) return false;
					const bbox = getBBox(element);
					return (
						bbox.x >= box.x &&
						bbox.y >= box.y &&
						bbox.x + bbox.width <= box.x + box.width &&
						bbox.y + bbox.height <= box.y + box.height
					);
				});
				setSelectedIds(new Set(matches.map((element) => element.id)));
				return;
			}

			if (drag.type === "select-move") {
				const dx = world.x - drag.startWorld.x;
				const dy = world.y - drag.startWorld.y;
				commitCanvasElements(
					moveElements(drag.startElements, selectedIds, dx, dy),
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

			if (drag?.type === "select-move") {
				const map = elementMap(currentElements);
				const movedCards = new Set<string>();
				const targetByCard = new Map<string, string | null>();
				for (const id of selectedIds) {
					const card = map.get(id);
					if (!card || !isKanbanCard(card)) continue;
					const center = {
						x: card.x + card.width / 2,
						y: card.y + card.height / 2,
					};
					const targetList = findListAtPoint(map, center.x, center.y);
					movedCards.add(card.id);
					targetByCard.set(card.id, targetList?.id ?? null);
				}
				if (movedCards.size > 0) {
					const updates = buildKanbanReflowUpdates(
						map,
						movedCards,
						targetByCard,
					);
					if (updates.length > 0) {
						commitCanvasElements(applyElementUpdates(currentElements, updates));
					}
				}
				setDraftElement(null);
				return;
			}

			if (!drag || drag.type !== "draw" || !draftElement) {
				setDraftElement(null);
				return;
			}

			if (!shouldKeepDraft(draftElement)) {
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
					: getElementText(hit);
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
								...(element.type === "frame"
									? { frameLabel: nextText }
									: { text: nextText }),
								...(element.type === "text"
									? { width: Math.max(56, nextText.length * 11) }
									: {}),
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
				const nextZoom = clampZoom(
					viewport.zoom * Math.exp((-event.deltaY / 100) * 0.18),
				);
				const scale = nextZoom / viewport.zoom;
				setViewport({
					zoom: nextZoom,
					x: local.x - (local.x - viewport.x) * scale,
					y: local.y - (local.y - viewport.y) * scale,
				});
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
			const deletedIds = collectDeletedElementIds(currentElements, selectedIds);
			if (deletedIds.size === 0) return;
			const reflowUpdates = buildKanbanDeletionReflowUpdates(
				elementMap(currentElements),
				deletedIds,
			);
			const nextElements = applyElementUpdates(
				deleteRelatedElements(currentElements, deletedIds),
				reflowUpdates,
			);
			if (nextElements.length !== currentElements.length) {
				commitCanvasElements(nextElements);
			}
			setSelectedIds(new Set());
		}, [commitCanvasElements, currentElements, selectedIds]);

		useEffect(() => {
			if (readOnly || selectedIds.size === 0) return;

			const handleKeyDown = (event: globalThis.KeyboardEvent) => {
				const target = event.target as HTMLElement | null;
				if (
					target?.closest("input, textarea, select, [contenteditable='true']")
				) {
					return;
				}
				if (event.key !== "Delete" && event.key !== "Backspace") return;
				event.preventDefault();
				clearSelected();
			};

			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}, [clearSelected, readOnly, selectedIds.size]);

		const insertTemplateSticky = useCallback(
			(sectionId: string) => {
				const section = currentElements.find(
					(element) =>
						element.id === sectionId &&
						element.customData?.skedraType === "template-section",
				);
				if (!section) return null;
				const existingNotes = currentElements.filter(
					(element) =>
						element.frameId === sectionId &&
						element.customData?.skedraType === "sticky-note",
				);
				const noteWidth =
					typeof section.customData?.stickyWidth === "number"
						? section.customData.stickyWidth
						: 160;
				const noteHeight =
					typeof section.customData?.stickyHeight === "number"
						? section.customData.stickyHeight
						: 124;
				const gap = 18;
				const paddingX = 18;
				const paddingTop = section.text ? 92 : 58;
				const columns = Math.max(
					1,
					Math.floor(
						(Math.max(noteWidth, section.width - paddingX * 2) + gap) /
							(noteWidth + gap),
					),
				);
				const index = existingNotes.length;
				const column = index % columns;
				const row = Math.floor(index / columns);
				const note = createSkedraStickyNoteElement({
					x: section.x + paddingX + column * (noteWidth + gap),
					y: section.y + paddingTop + row * (noteHeight + gap),
					width: noteWidth,
					height: noteHeight,
					color:
						typeof section.customData?.stickyColor === "string"
							? section.customData.stickyColor
							: "#fff3bf",
					stroke:
						typeof section.customData?.templateAccent === "string"
							? section.customData.templateAccent
							: section.stroke,
					frameId: section.id,
					theme,
					createId,
					customData: {
						templateTool: section.customData?.templateTool,
						templateSectionId: section.customData?.templateSectionId,
						templateAccent: section.customData?.templateAccent,
						stickyColor: section.customData?.stickyColor,
						stickyWidth: noteWidth,
						stickyHeight: noteHeight,
					},
				});
				const [stacked] = withSkedraStackIndexes([note], currentElements);
				const minHeight =
					stacked.y + stacked.height + gap - section.y > section.height
						? stacked.y + stacked.height + gap - section.y
						: section.height;
				const next = currentElements.map((element) =>
					element.id === section.id
						? { ...element, height: minHeight }
						: element,
				);
				commitCanvasElements([...next, stacked]);
				setSelectedIds(new Set([stacked.id]));
				return stacked;
			},
			[commitCanvasElements, currentElements, theme],
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
									disabled={
										readOnly && entry.id !== "pan" && entry.id !== "select"
									}
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
						{sortedElements.map((element) => (
							<SdkElementShape
								key={element.id}
								element={element}
								svgIdPrefix={svgIdPrefix}
								readOnly={readOnly}
								onAddKanbanCard={insertKanbanCard}
								onAddTemplateSticky={insertTemplateSticky}
							/>
						))}
						{draftElement && (
							<SdkElementShape
								element={draftElement}
								draft
								svgIdPrefix={svgIdPrefix}
								readOnly={readOnly}
								onAddKanbanCard={insertKanbanCard}
								onAddTemplateSticky={insertTemplateSticky}
							/>
						)}
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
						{selectionBox && (
							<rect
								className="skedra-sdk__selection"
								x={normalizeRect(selectionBox.start, selectionBox.end).x}
								y={normalizeRect(selectionBox.start, selectionBox.end).y}
								width={
									normalizeRect(selectionBox.start, selectionBox.end).width
								}
								height={
									normalizeRect(selectionBox.start, selectionBox.end).height
								}
								strokeWidth={1 / viewport.zoom}
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

function SdkElementShape({
	element,
	draft = false,
	svgIdPrefix,
	readOnly,
	onAddKanbanCard,
	onAddTemplateSticky,
}: {
	element: CanvasElement;
	draft?: boolean;
	svgIdPrefix: string;
	readOnly: boolean;
	onAddKanbanCard: (listId: string) => CanvasElement | null;
	onAddTemplateSticky: (sectionId: string) => CanvasElement | null;
}) {
	const opacity = (element.opacity / 100) * (draft ? 0.72 : 1);
	const transform = getElementTransform(element);
	const strokeDasharray =
		element.strokeStyle === "dashed"
			? "8 6"
			: element.strokeStyle === "dotted"
				? "2 6"
				: undefined;

	switch (element.type) {
		case "rectangle":
			if (isKanbanCard(element)) {
				return (
					<SdkKanbanCard
						element={element}
						opacity={opacity}
						transform={transform}
					/>
				);
			}
			if (element.customData?.skedraType === "sticky-note") {
				return (
					<SdkStickyNote
						element={element}
						opacity={opacity}
						transform={transform}
					/>
				);
			}
			return (
				<g opacity={opacity} transform={transform}>
					<rect
						x={element.x}
						y={element.y}
						width={Math.max(1, element.width)}
						height={Math.max(1, element.height)}
						rx={element.cornerRadius ?? 4}
						fill={element.fill}
						stroke={element.stroke}
						strokeWidth={element.strokeWidth}
						strokeDasharray={strokeDasharray}
					/>
					{element.text && <SdkTextBlock element={element} />}
				</g>
			);
		case "ellipse":
			return (
				<g opacity={opacity} transform={transform}>
					<ellipse
						cx={element.x + element.width / 2}
						cy={element.y + element.height / 2}
						rx={Math.max(1, element.width / 2)}
						ry={Math.max(1, element.height / 2)}
						fill={element.fill}
						stroke={element.stroke}
						strokeWidth={element.strokeWidth}
						strokeDasharray={strokeDasharray}
					/>
					{element.text && <SdkTextBlock element={element} />}
				</g>
			);
		case "diamond": {
			const cx = element.x + element.width / 2;
			const cy = element.y + element.height / 2;
			return (
				<g opacity={opacity} transform={transform}>
					<polygon
						points={`${cx},${element.y} ${element.x + element.width},${cy} ${cx},${element.y + element.height} ${element.x},${cy}`}
						fill={element.fill}
						stroke={element.stroke}
						strokeWidth={element.strokeWidth}
						strokeDasharray={strokeDasharray}
						strokeLinejoin="round"
					/>
					{element.text && <SdkTextBlock element={element} />}
				</g>
			);
		}
		case "line":
			if (!element.points || element.points.length < 2) return null;
			return (
				<g opacity={opacity} transform={transform}>
					<path
						d={linePath(element.points)}
						transform={`translate(${element.x}, ${element.y})`}
						fill="none"
						stroke={element.stroke}
						strokeWidth={element.strokeWidth}
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeDasharray={strokeDasharray}
					/>
				</g>
			);
		case "arrow":
			if (!element.points || element.points.length < 2) return null;
			return (
				<SdkArrowShape
					element={element}
					opacity={opacity}
					transform={transform}
				/>
			);
		case "freehand":
			if (!element.points || element.points.length < 2) return null;
			return (
				<g opacity={opacity} transform={transform}>
					<path
						d={smoothPath(element.points)}
						transform={`translate(${element.x}, ${element.y})`}
						fill="none"
						stroke={element.stroke}
						strokeWidth={element.strokeWidth}
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeDasharray={strokeDasharray}
					/>
				</g>
			);
		case "image": {
			const geometry = getImageRenderGeometry(element);
			if (!geometry.src) return null;
			const clipId = geometry.clipId
				? `${svgIdPrefix}-${toSvgIdPart(geometry.clipId)}`
				: null;
			return (
				<g opacity={opacity} transform={transform}>
					{clipId && geometry.clipRect && (
						<defs>
							<clipPath id={clipId}>
								<rect
									x={geometry.clipRect.x}
									y={geometry.clipRect.y}
									width={geometry.clipRect.width}
									height={geometry.clipRect.height}
								/>
							</clipPath>
						</defs>
					)}
					<rect
						x={geometry.x}
						y={geometry.y}
						width={Math.max(1, geometry.width)}
						height={Math.max(1, geometry.height)}
						fill={element.fill || "transparent"}
						stroke={element.stroke || "#00000020"}
						strokeWidth={element.strokeWidth ?? 1}
						rx={element.cornerRadius ?? 8}
					/>
					<image
						href={geometry.src}
						x={geometry.imageX}
						y={geometry.imageY}
						width={Math.max(1, geometry.imageWidth)}
						height={Math.max(1, geometry.imageHeight)}
						preserveAspectRatio="xMidYMid meet"
						clipPath={clipId ? `url(#${clipId})` : undefined}
					>
						<title>
							{typeof element.customData?.imageAlt === "string"
								? element.customData.imageAlt
								: "Image"}
						</title>
					</image>
				</g>
			);
		}
		case "frame":
			if (isKanbanList(element)) {
				return (
					<SdkKanbanList
						element={element}
						opacity={opacity}
						transform={transform}
						readOnly={readOnly || draft}
						onAddKanbanCard={onAddKanbanCard}
					/>
				);
			}
			if (element.customData?.skedraType === "template-section") {
				return (
					<SdkTemplateSection
						element={element}
						opacity={opacity}
						transform={transform}
						readOnly={readOnly || draft}
						onAddTemplateSticky={onAddTemplateSticky}
					/>
				);
			}
			return (
				<g opacity={opacity} transform={transform}>
					<rect
						x={element.x}
						y={element.y}
						width={Math.max(1, element.width)}
						height={Math.max(1, element.height)}
						fill="transparent"
						stroke={
							element.stroke === "transparent"
								? "var(--skedra-sdk-primary)"
								: element.stroke
						}
						strokeWidth={Math.max(1, element.strokeWidth)}
						strokeDasharray={strokeDasharray ?? "6 4"}
						rx={element.cornerRadius ?? 4}
						opacity={0.72}
					/>
					<text
						x={element.x + 6}
						y={element.y - 6}
						fill={
							element.stroke === "transparent"
								? "var(--skedra-sdk-primary)"
								: element.stroke
						}
						fontFamily="system-ui, sans-serif"
						fontSize={12}
						pointerEvents="none"
					>
						{element.frameLabel || element.text || "Frame"}
					</text>
				</g>
			);
		case "text":
			return (
				<g transform={transform}>
					<SdkTextBlock element={element} opacity={opacity} />
				</g>
			);
		default:
			return null;
	}
}

function SdkKanbanList({
	element,
	opacity,
	transform,
	readOnly,
	onAddKanbanCard,
}: {
	element: CanvasElement;
	opacity: number;
	transform?: string;
	readOnly: boolean;
	onAddKanbanCard: (listId: string) => CanvasElement | null;
}) {
	const label = element.frameLabel || element.text || "List";
	const headerHeight = 42;
	const footerHeight = 42;
	return (
		<g opacity={opacity} transform={transform}>
			<rect
				x={element.x}
				y={element.y}
				width={Math.max(1, element.width)}
				height={Math.max(1, element.height)}
				rx={10}
				fill="var(--skedra-sdk-kanban-list-bg)"
				stroke="var(--skedra-sdk-kanban-list-border)"
				strokeWidth={1}
			/>
			<rect
				x={element.x}
				y={element.y}
				width={Math.max(1, element.width)}
				height={headerHeight}
				rx={10}
				fill="var(--skedra-sdk-kanban-list-header)"
			/>
			<rect
				x={element.x}
				y={element.y + headerHeight - 10}
				width={Math.max(1, element.width)}
				height={10}
				fill="var(--skedra-sdk-kanban-list-header)"
			/>
			<text
				x={element.x + 14}
				y={element.y + 26}
				fill="var(--skedra-sdk-text)"
				fontSize={14}
				fontFamily="system-ui, sans-serif"
				fontWeight={700}
				pointerEvents="none"
			>
				{label}
			</text>
			{!readOnly && (
				<foreignObject
					x={element.x + 12}
					y={element.y + element.height - footerHeight + 6}
					width={Math.max(1, element.width - 24)}
					height={30}
					pointerEvents="auto"
				>
					<button
						type="button"
						className="skedra-sdk__inline-action"
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							onAddKanbanCard(element.id);
						}}
					>
						<Plus size={14} strokeWidth={2} />
					</button>
				</foreignObject>
			)}
		</g>
	);
}

function SdkKanbanCard({
	element,
	opacity,
	transform,
}: {
	element: CanvasElement;
	opacity: number;
	transform?: string;
}) {
	const priority = element.customData?.priority;
	const priorityColor =
		priority === "urgent"
			? "#ef4444"
			: priority === "high"
				? "#f97316"
				: priority === "medium"
					? "#eab308"
					: priority === "low"
						? "#22c55e"
						: null;
	return (
		<g opacity={opacity} transform={transform}>
			<rect
				x={element.x + 1}
				y={element.y + 2}
				width={Math.max(1, element.width)}
				height={Math.max(1, element.height)}
				rx={8}
				fill="rgba(15, 23, 42, 0.12)"
			/>
			<rect
				x={element.x}
				y={element.y}
				width={Math.max(1, element.width)}
				height={Math.max(1, element.height)}
				rx={8}
				fill="var(--skedra-sdk-kanban-card-bg)"
				stroke="var(--skedra-sdk-kanban-list-border)"
				strokeWidth={1}
			/>
			{priorityColor && (
				<rect
					x={element.x}
					y={element.y}
					width={6}
					height={Math.max(1, element.height)}
					rx={8}
					fill={priorityColor}
				/>
			)}
			<foreignObject
				x={element.x + (priorityColor ? 18 : 12)}
				y={element.y + 10}
				width={Math.max(1, element.width - (priorityColor ? 30 : 24))}
				height={Math.max(1, element.height - 20)}
				pointerEvents="none"
			>
				<div className="skedra-sdk__kanban-card-text">
					{element.text || "New card"}
				</div>
			</foreignObject>
		</g>
	);
}

function SdkStickyNote({
	element,
	opacity,
	transform,
}: {
	element: CanvasElement;
	opacity: number;
	transform?: string;
}) {
	return (
		<g opacity={opacity} transform={transform}>
			<rect
				x={element.x}
				y={element.y}
				width={Math.max(1, element.width)}
				height={Math.max(1, element.height)}
				rx={element.cornerRadius ?? 8}
				fill={element.fill || "#fff3bf"}
				stroke={element.stroke || "#ced4da"}
				strokeWidth={element.strokeWidth ?? 1}
			/>
			<foreignObject
				x={element.x + 12}
				y={element.y + 12}
				width={Math.max(1, element.width - 24)}
				height={Math.max(1, element.height - 24)}
				pointerEvents="none"
			>
				<div className="skedra-sdk__sticky-text">
					{element.text || "Sticky note"}
				</div>
			</foreignObject>
		</g>
	);
}

function SdkTemplateSection({
	element,
	opacity,
	transform,
	readOnly,
	onAddTemplateSticky,
}: {
	element: CanvasElement;
	opacity: number;
	transform?: string;
	readOnly: boolean;
	onAddTemplateSticky: (sectionId: string) => CanvasElement | null;
}) {
	const accent =
		typeof element.customData?.templateAccent === "string"
			? element.customData.templateAccent
			: element.stroke;
	return (
		<g opacity={opacity} transform={transform}>
			<rect
				x={element.x}
				y={element.y}
				width={Math.max(1, element.width)}
				height={Math.max(1, element.height)}
				rx={18}
				fill={accent}
				opacity={0.06}
			/>
			<rect
				x={element.x}
				y={element.y}
				width={Math.max(1, element.width)}
				height={Math.max(1, element.height)}
				rx={18}
				fill="transparent"
				stroke={accent}
				strokeWidth={1.5}
				strokeDasharray="8 6"
			/>
			<text
				x={element.x + 18}
				y={element.y + 30}
				fill={accent}
				fontSize={16}
				fontFamily="system-ui, sans-serif"
				fontWeight={700}
				pointerEvents="none"
			>
				{element.frameLabel || "Section"}
			</text>
			{!readOnly && (
				<foreignObject
					x={element.x + element.width - 52}
					y={element.y + 12}
					width={36}
					height={36}
					pointerEvents="auto"
				>
					<button
						type="button"
						className="skedra-sdk__round-action"
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							onAddTemplateSticky(element.id);
						}}
					>
						<Plus size={17} strokeWidth={2} />
					</button>
				</foreignObject>
			)}
		</g>
	);
}

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

function SdkArrowShape({
	element,
	opacity,
	transform,
}: {
	element: CanvasElement;
	opacity: number;
	transform?: string;
}) {
	const points = element.points ?? [];
	const start = points[0];
	const end = points[points.length - 1];
	const beforeEnd = points[points.length - 2] ?? start;
	if (!start || !end || !beforeEnd) return null;
	const arrowHead = renderArrowHead(
		element.arrowHeadEnd ?? "arrow",
		beforeEnd[0],
		beforeEnd[1],
		end[0],
		end[1],
		element.stroke,
		14 * (element.arrowHeadScale ?? 1),
	);
	return (
		<g
			opacity={opacity}
			transform={[transform, `translate(${element.x}, ${element.y})`]
				.filter(Boolean)
				.join(" ")}
		>
			<path
				d={getArrowPath(points, element.arrowMode)}
				fill="none"
				stroke={element.stroke}
				strokeWidth={element.strokeWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			{arrowHead?.type === "lines" && arrowHead.lines && (
				<path
					d={`M ${arrowHead.lines.x1} ${arrowHead.lines.y1} L ${arrowHead.lines.x2} ${arrowHead.lines.y2} L ${arrowHead.lines.x3} ${arrowHead.lines.y3}`}
					fill="none"
					stroke={element.stroke}
					strokeWidth={element.strokeWidth}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			)}
			{arrowHead?.type === "triangle" && arrowHead.polygon && (
				<polygon points={arrowHead.polygon} fill={element.stroke} />
			)}
			{arrowHead?.type === "dot" && (
				<circle
					cx={arrowHead.cx}
					cy={arrowHead.cy}
					r={arrowHead.r}
					fill={element.stroke}
				/>
			)}
		</g>
	);
}

function SdkTextBlock({
	element,
	opacity = element.opacity / 100,
}: {
	element: CanvasElement;
	opacity?: number;
}) {
	const lines = renderTextLines(element.text ?? "");
	const fontSize = element.fontSize ?? 20;
	const lineHeight = fontSize * 1.25;
	const color = element.textColor ?? element.stroke;
	const textAnchor =
		element.textAlign === "center"
			? "middle"
			: element.textAlign === "right"
				? "end"
				: "start";
	const x =
		element.textAlign === "center"
			? element.x + element.width / 2
			: element.textAlign === "right"
				? element.x + element.width
				: element.x;
	return (
		<text
			opacity={opacity}
			x={x}
			y={element.y + fontSize}
			fill={color}
			fontFamily={element.fontFamily ?? "Kalam, Comic Sans MS, cursive"}
			fontSize={fontSize}
			fontWeight={element.fontWeight}
			fontStyle={element.fontStyle}
			textDecoration={element.textDecoration}
			textAnchor={textAnchor}
			pointerEvents="none"
		>
			{lines.map((line, index) => (
				<tspan
					key={`${element.id}-${index}`}
					x={x}
					dy={index === 0 ? 0 : lineHeight}
				>
					{line}
				</tspan>
			))}
		</text>
	);
}
