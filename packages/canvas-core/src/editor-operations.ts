import { createBaseCanvasElement } from "./element-factory";
import { getBBox } from "./geometry";
import {
	buildKanbanDeletionReflowUpdates,
	buildKanbanReflowUpdates,
	elementCenter,
	findListAtPoint,
	isKanbanCard,
	isKanbanList,
} from "./kanban";
import {
	buildMindmapEdgeChanges,
	buildMindmapSyncUpdates,
	collectConnectedMindmapEdgeIds,
	collectMindmapDescendantIds,
	createMindmapEdge,
	createMindmapNode,
	getMindmapBranchColorForNewNode,
	getMindmapEdgeMeta,
	getMindmapNodeMeta,
	isMindmapNode,
	planMindmapChildInsertion,
	planMindmapSiblingInsertion,
} from "./mindmap";
import {
	createStackIndexAfter,
	createStackIndexBeforeElement,
} from "./ordering";
import type { ArrowTextOrientation, ArrowTextSide } from "./path-rendering";
import {
	buildTemplateSectionLayoutSyncUpdates,
	findTemplateSectionAtPoint,
	getTemplateStickyAssignmentChanges,
	getTemplateStickyNoteMeta,
} from "./templates";
import {
	type CanvasElement,
	DEFAULT_FONT_FAMILY,
	MAX_ZOOM,
	MIN_ZOOM,
	type Viewport,
} from "./types";

export interface CanvasPoint {
	x: number;
	y: number;
}

export interface CanvasRect extends CanvasPoint {
	width: number;
	height: number;
}

export interface CanvasElementUpdate {
	id: string;
	changes: Partial<CanvasElement>;
}

export interface CanvasMutationPlan {
	create: CanvasElement[];
	update: CanvasElementUpdate[];
	deleteIds: string[];
	selectedIds?: string[];
	editingTextId?: string | null;
}

export interface CanvasMutationAdapter {
	createElement: (element: CanvasElement) => void;
	updateElements: (updates: CanvasElementUpdate[]) => void;
	deleteElements: (ids: string[]) => void;
	setSelectedIds?: (ids: Set<string>) => void;
	setEditingTextId?: (id: string | null) => void;
}

export const EMPTY_CANVAS_MUTATION: CanvasMutationPlan = {
	create: [],
	update: [],
	deleteIds: [],
};

export type CanvasDrawingTool =
	| "rectangle"
	| "ellipse"
	| "diamond"
	| "line"
	| "arrow"
	| "freehand"
	| "frame";

export interface CanvasDrawingStyle {
	stroke: string;
	fill?: string;
	strokeWidth?: number;
	strokeStyle?: CanvasElement["strokeStyle"];
	cornerRadiusPercent?: number;
	roughness?: number;
	roughFillStyle?: CanvasElement["roughFillStyle"];
	roughFillScale?: number;
	arrowMode?: CanvasElement["arrowMode"];
	arrowHeadStart?: CanvasElement["arrowHeadStart"];
	arrowHeadEnd?: CanvasElement["arrowHeadEnd"];
	arrowHeadScale?: number;
	arrowHeadFilled?: boolean;
	fontFamily?: string;
}

export interface CanvasMindmapNodeAppearance {
	fontFamily?: string;
	rootFill?: string;
	nodeFill?: string;
	rootStroke?: string;
	childBorder?: string;
	rootTextColor?: string;
	childTextColor?: string;
}

interface MindmapMutationOptions {
	elements: Map<string, CanvasElement>;
	createId: () => string;
	text: string;
	appearance?: CanvasMindmapNodeAppearance;
	startEditing?: boolean;
}

export interface MindmapChildMutationOptions extends MindmapMutationOptions {
	parentId: string;
	direction?: "left" | "right" | "up" | "down";
	position?: "before" | "after";
	preserveParentSelection?: boolean;
}

export interface MindmapSiblingMutationOptions extends MindmapMutationOptions {
	nodeId: string;
	position?: "before" | "after";
	preserveAnchorSelection?: boolean;
}

export type CanvasKeyboardCommand =
	| "delete-selection"
	| "clear-canvas"
	| "select-all"
	| "escape"
	| "undo"
	| "redo";

export function toCanvasElementMap(
	elements: Iterable<CanvasElement>,
): Map<string, CanvasElement> {
	return new Map(Array.from(elements, (element) => [element.id, element]));
}

export function applyCanvasElementUpdates(
	elements: readonly CanvasElement[],
	updates: readonly CanvasElementUpdate[],
): CanvasElement[] {
	if (updates.length === 0) return [...elements];
	const updatesById = new Map<string, Partial<CanvasElement>>();
	for (const update of updates) {
		updatesById.set(update.id, {
			...(updatesById.get(update.id) ?? {}),
			...update.changes,
		});
	}
	return elements.map((element) => {
		const changes = updatesById.get(element.id);
		return changes ? { ...element, ...changes } : element;
	});
}

/** Applies a storage-independent mutation plan and normalizes derived mindmap data. */
export function applyCanvasMutationPlan(
	elements: readonly CanvasElement[],
	plan: CanvasMutationPlan,
): CanvasElement[] {
	const deleted = new Set(plan.deleteIds);
	const createdIds = new Set(plan.create.map((element) => element.id));
	const next = applyCanvasElementUpdates(
		[
			...elements.filter(
				(element) => !deleted.has(element.id) && !createdIds.has(element.id),
			),
			...plan.create,
		],
		plan.update,
	);
	const normalization = planCanvasNormalization(toCanvasElementMap(next));
	const normalizedDeletes = new Set(normalization.deleteIds);
	return applyCanvasElementUpdates(
		next.filter((element) => !normalizedDeletes.has(element.id)),
		normalization.update,
	);
}

/** Executes the same mutation plan against a collaborative or local storage adapter. */
export function executeCanvasMutationPlan(
	plan: CanvasMutationPlan,
	adapter: CanvasMutationAdapter,
): void {
	if (plan.deleteIds.length > 0) adapter.deleteElements(plan.deleteIds);
	for (const element of plan.create) adapter.createElement(element);
	if (plan.update.length > 0) adapter.updateElements(plan.update);
	if (plan.selectedIds) adapter.setSelectedIds?.(new Set(plan.selectedIds));
	if (plan.editingTextId !== undefined) {
		adapter.setEditingTextId?.(plan.editingTextId);
	}
}

export function planCanvasNormalization(
	elements: Map<string, CanvasElement>,
): CanvasMutationPlan {
	const orphanEdges: string[] = [];
	for (const element of elements.values()) {
		const edge = getMindmapEdgeMeta(element);
		if (
			edge &&
			(!elements.has(edge.mindmapSourceId) ||
				!elements.has(edge.mindmapTargetId))
		) {
			orphanEdges.push(element.id);
		}
	}
	return {
		create: [],
		update: [
			...buildMindmapSyncUpdates(elements).filter(
				(update) => !orphanEdges.includes(update.id),
			),
			...buildTemplateSectionLayoutSyncUpdates(elements, {
				excludeIds: orphanEdges,
			}),
		],
		deleteIds: orphanEdges,
	};
}

export function normalizeCanvasRect(
	start: CanvasPoint,
	end: CanvasPoint,
): CanvasRect {
	return {
		x: Math.min(start.x, end.x),
		y: Math.min(start.y, end.y),
		width: Math.abs(end.x - start.x),
		height: Math.abs(end.y - start.y),
	};
}

export function clientPointToCanvas(
	client: CanvasPoint,
	bounds: { left: number; top: number },
	viewport: Viewport,
): CanvasPoint {
	return {
		x: (client.x - bounds.left - viewport.x) / viewport.zoom,
		y: (client.y - bounds.top - viewport.y) / viewport.zoom,
	};
}

export function isCanvasPathTool(tool: string): boolean {
	return tool === "line" || tool === "arrow";
}

export function isCanvasCenterShapeTool(tool: string): boolean {
	return tool === "rectangle" || tool === "ellipse" || tool === "diamond";
}

export function supportsCanvasAnchorSnapTool(tool: string): boolean {
	return isCanvasPathTool(tool) || isCanvasCenterShapeTool(tool);
}

export function resolveCanvasPointerCoordinates(
	clientX: number,
	clientY: number,
	options: {
		placement?: {
			canvas: CanvasPoint;
			x: number;
			y: number;
			anchor?: unknown;
		} | null;
		supportsAnchorSnap?: boolean;
		resolvePathPlacement?: (
			screenX: number,
			screenY: number,
			options?: { forceAnchor?: boolean },
		) => {
			canvas: CanvasPoint;
			x: number;
			y: number;
			anchor?: unknown;
		};
		toCanvas: (screenX: number, screenY: number) => CanvasPoint;
		snapToGrid: (value: number) => number;
	},
) {
	const placement =
		options.placement !== undefined
			? options.placement
			: options.supportsAnchorSnap && options.resolvePathPlacement
				? options.resolvePathPlacement(clientX, clientY)
				: null;
	const canvas = placement?.canvas ?? options.toCanvas(clientX, clientY);
	return {
		canvas,
		snappedX: placement?.x ?? options.snapToGrid(canvas.x),
		snappedY: placement?.y ?? options.snapToGrid(canvas.y),
		placement,
	};
}

export function getCanvasViewportCenter(
	bounds: { width: number; height: number },
	viewport: Viewport,
): CanvasPoint {
	return {
		x: (bounds.width / 2 - viewport.x) / viewport.zoom,
		y: (bounds.height / 2 - viewport.y) / viewport.zoom,
	};
}

export function clampCanvasZoom(zoom: number): number {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function zoomCanvasViewportAtPoint(
	viewport: Viewport,
	point: CanvasPoint,
	nextZoom: number,
): Viewport {
	const zoom = clampCanvasZoom(nextZoom);
	const scale = zoom / viewport.zoom;
	return {
		zoom,
		x: point.x - (point.x - viewport.x) * scale,
		y: point.y - (point.y - viewport.y) * scale,
	};
}

export function resizeCanvasElement(
	bounds: { x: number; y: number; width: number; height: number },
	handle: "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se",
	dx: number,
	dy: number,
	minimumSize = 5,
): Pick<CanvasElement, "x" | "y" | "width" | "height"> {
	let { x, y, width, height } = bounds;
	switch (handle) {
		case "se":
			width += dx;
			height += dy;
			break;
		case "s":
			height += dy;
			break;
		case "e":
			width += dx;
			break;
		case "nw":
			x += dx;
			y += dy;
			width -= dx;
			height -= dy;
			break;
		case "n":
			y += dy;
			height -= dy;
			break;
		case "ne":
			y += dy;
			width += dx;
			height -= dy;
			break;
		case "w":
			x += dx;
			width -= dx;
			break;
		case "sw":
			x += dx;
			width -= dx;
			height += dy;
			break;
	}
	return {
		x,
		y,
		width: Math.max(minimumSize, width),
		height: Math.max(minimumSize, height),
	};
}

export function getCanvasKeyboardResizeChanges(options: {
	element: CanvasElement;
	handle: "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";
	key: string;
	shiftKey?: boolean;
	readOnly?: boolean;
}): Pick<CanvasElement, "x" | "y" | "width" | "height"> | null {
	if (options.readOnly || options.element.locked) return null;
	const step = options.shiftKey ? 10 : 1;
	const dx =
		options.key === "ArrowLeft"
			? -step
			: options.key === "ArrowRight"
				? step
				: 0;
	const dy =
		options.key === "ArrowUp" ? -step : options.key === "ArrowDown" ? step : 0;
	if (dx === 0 && dy === 0) return null;
	return resizeCanvasElement(options.element, options.handle, dx, dy);
}

export function translateCanvasElements(
	elements: readonly CanvasElement[],
	selectedIds: ReadonlySet<string>,
	dx: number,
	dy: number,
): CanvasElement[] {
	return elements.map((element) =>
		selectedIds.has(element.id) && !element.locked
			? { ...element, x: element.x + dx, y: element.y + dy }
			: element,
	);
}

/**
 * Builds the shared movement updates used by both canvas consumers.
 * The supplied start map is expanded in place so drop handling can use the
 * complete set of moved frame children and mindmap descendants.
 */
export function buildCanvasMoveUpdates(
	elements: Map<string, CanvasElement>,
	moveStart: Map<string, CanvasPoint>,
	dx: number,
	dy: number,
): CanvasElementUpdate[] {
	const pendingIds = Array.from(moveStart.keys());
	for (let index = 0; index < pendingIds.length; index++) {
		const id = pendingIds[index];
		const element = elements.get(id);
		if (!element) continue;

		if (isMindmapNode(element)) {
			for (const descendantId of collectMindmapDescendantIds(id, elements)) {
				if (moveStart.has(descendantId)) continue;
				const descendant = elements.get(descendantId);
				if (!descendant) continue;
				moveStart.set(descendantId, { x: descendant.x, y: descendant.y });
				pendingIds.push(descendantId);
			}
		}

		if (element.type === "frame") {
			for (const [childId, child] of elements) {
				if (child.frameId !== id || moveStart.has(childId)) continue;
				moveStart.set(childId, { x: child.x, y: child.y });
				pendingIds.push(childId);
			}
		}
	}

	const movedIds = new Set(moveStart.keys());
	const virtualElements = new Map(elements);
	const updates: CanvasElementUpdate[] = [];
	for (const [id, start] of moveStart) {
		const current = virtualElements.get(id);
		if (!current) continue;
		const changes = { x: start.x + dx, y: start.y + dy };
		updates.push({ id, changes });
		virtualElements.set(id, { ...current, ...changes });
	}

	for (const edgeId of collectConnectedMindmapEdgeIds(movedIds, elements)) {
		const edge = elements.get(edgeId);
		const meta = getMindmapEdgeMeta(edge);
		if (!meta) continue;
		const source = virtualElements.get(meta.mindmapSourceId);
		const target = virtualElements.get(meta.mindmapTargetId);
		if (!source || !target) continue;
		updates.push({
			id: edgeId,
			changes: buildMindmapEdgeChanges(source, target),
		});
	}

	return updates;
}

export function collectCanvasSelectionRectIds(
	elements: Iterable<CanvasElement>,
	start: CanvasPoint,
	end: CanvasPoint,
): Set<string> {
	const rect = normalizeCanvasRect(start, end);
	const ids = new Set<string>();
	if (rect.width <= 3 && rect.height <= 3) return ids;
	for (const element of elements) {
		if (element.locked) continue;
		const bbox = getBBox(element);
		if (
			bbox.x >= rect.x &&
			bbox.y >= rect.y &&
			bbox.x + bbox.width <= rect.x + rect.width &&
			bbox.y + bbox.height <= rect.y + rect.height
		) {
			ids.add(element.id);
		}
	}
	return ids;
}

export function buildCanvasDrawingElement(options: {
	id: string;
	tool: CanvasDrawingTool;
	start: CanvasPoint;
	end?: CanvasPoint;
	points?: CanvasPoint[];
	style: CanvasDrawingStyle;
	stackIndex?: string;
}): CanvasElement {
	const { id, tool, start, style, stackIndex } = options;
	const end = options.end ?? options.points?.at(-1) ?? start;
	const defaults = { createId: () => id, stroke: style.stroke };
	const common = {
		id,
		stroke: style.stroke,
		strokeWidth: style.strokeWidth ?? (tool === "frame" ? 1.5 : 2),
		strokeStyle: style.strokeStyle ?? "solid",
		roughness: tool === "frame" ? 0 : style.roughness,
		roughFillStyle: tool === "frame" ? undefined : style.roughFillStyle,
		roughFillScale: tool === "frame" ? undefined : style.roughFillScale,
		stackIndex,
	};

	if (tool === "freehand") {
		const points = options.points?.length ? options.points : [start];
		const minX = Math.min(...points.map((point) => point.x));
		const minY = Math.min(...points.map((point) => point.y));
		const maxX = Math.max(...points.map((point) => point.x));
		const maxY = Math.max(...points.map((point) => point.y));
		return createBaseCanvasElement(defaults, {
			...common,
			type: "freehand",
			x: minX,
			y: minY,
			width: Math.max(0, maxX - minX),
			height: Math.max(0, maxY - minY),
			fill: "transparent",
			points: points.map((point) => [point.x - minX, point.y - minY]),
		});
	}

	if (tool === "line" || tool === "arrow") {
		const dx = end.x - start.x;
		const dy = end.y - start.y;
		return createBaseCanvasElement(defaults, {
			...common,
			type: tool,
			x: start.x,
			y: start.y,
			width: Math.abs(dx),
			height: Math.abs(dy),
			fill: "transparent",
			points: [
				[0, 0],
				[dx, dy],
			],
			arrowMode: style.arrowMode,
			arrowHeadStart: style.arrowHeadStart,
			arrowHeadEnd: style.arrowHeadEnd ?? (tool === "arrow" ? "arrow" : "none"),
			arrowHeadScale: style.arrowHeadScale,
			arrowHeadFilled: style.arrowHeadFilled,
		});
	}

	const rect = normalizeCanvasRect(start, end);
	return createBaseCanvasElement(defaults, {
		...common,
		type: tool,
		x: rect.x,
		y: rect.y,
		width: rect.width,
		height: rect.height,
		fill: tool === "frame" ? "transparent" : (style.fill ?? "transparent"),
		cornerRadiusPercent:
			tool === "rectangle" ? style.cornerRadiusPercent : undefined,
		frameLabel: tool === "frame" ? "Frame" : undefined,
	});
}

export function buildCanvasTextElement(options: {
	id: string;
	point: CanvasPoint;
	text: string;
	stroke: string;
	fontFamily?: string;
	stackIndex?: string;
}): CanvasElement {
	const lines = options.text.split("\n");
	const longest = lines.reduce((max, line) => Math.max(max, line.length), 1);
	return createBaseCanvasElement(
		{ createId: () => options.id, stroke: options.stroke },
		{
			id: options.id,
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
			fontFamily: options.fontFamily ?? DEFAULT_FONT_FAMILY,
			stackIndex: options.stackIndex,
		},
	);
}

export function shouldKeepCanvasDrawing(element: CanvasElement): boolean {
	if (element.type === "freehand") return (element.points?.length ?? 0) > 2;
	if (element.type === "line" || element.type === "arrow") {
		const [start, end] = element.points ?? [];
		if (!start || !end) return false;
		return Math.hypot(end[0] - start[0], end[1] - start[1]) > 3;
	}
	return element.width > 3 || element.height > 3;
}

export function planCanvasDeletion(
	elements: Map<string, CanvasElement>,
	requestedIds: Iterable<string>,
	options: { respectLocked?: boolean } = {},
): CanvasMutationPlan {
	const respectLocked = options.respectLocked ?? true;
	const deleteIds = new Set<string>();
	for (const id of requestedIds) {
		const element = elements.get(id);
		if (!element || (respectLocked && element.locked)) continue;
		deleteIds.add(id);
		if (isMindmapNode(element)) {
			for (const descendantId of collectMindmapDescendantIds(id, elements)) {
				const descendant = elements.get(descendantId);
				if (!respectLocked || !descendant?.locked) deleteIds.add(descendantId);
			}
		}
	}

	const deletedListIds = new Set(
		Array.from(deleteIds).filter((id) => isKanbanList(elements.get(id))),
	);
	for (const element of elements.values()) {
		if (element.frameId && deletedListIds.has(element.frameId)) {
			deleteIds.add(element.id);
		}
		const edge = getMindmapEdgeMeta(element);
		if (
			edge &&
			(deleteIds.has(edge.mindmapSourceId) ||
				deleteIds.has(edge.mindmapTargetId))
		) {
			deleteIds.add(element.id);
		}
	}

	return {
		create: [],
		deleteIds: [...deleteIds],
		update: buildKanbanDeletionReflowUpdates(elements, deleteIds),
		selectedIds: [],
		editingTextId: null,
	};
}

export function buildKanbanDropUpdates(
	elements: Map<string, CanvasElement>,
	movedIds: Iterable<string>,
): CanvasElementUpdate[] {
	const movedCards = new Set<string>();
	const targetByCard = new Map<string, string | null>();
	for (const id of movedIds) {
		const card = elements.get(id);
		if (!card || !isKanbanCard(card)) continue;
		movedCards.add(id);
		const centerX = card.x + card.width / 2;
		const centerY = card.y + card.height / 2;
		targetByCard.set(
			id,
			findListAtPoint(elements, centerX, centerY)?.id ?? null,
		);
	}
	return movedCards.size > 0
		? buildKanbanReflowUpdates(elements, movedCards, targetByCard)
		: [];
}

export function buildTemplateDropUpdates(
	elements: Map<string, CanvasElement>,
	movedIds: Iterable<string>,
): CanvasElementUpdate[] {
	const updates: CanvasElementUpdate[] = [];
	for (const id of movedIds) {
		const note = elements.get(id);
		if (!note || !getTemplateStickyNoteMeta(note)) continue;
		const center = elementCenter(note);
		const section = findTemplateSectionAtPoint(
			elements.values(),
			center.x,
			center.y,
		);
		const changes = getTemplateStickyAssignmentChanges(note, section);
		if (Object.keys(changes).length > 0) updates.push({ id, changes });
	}
	return updates;
}

export function planKanbanCardInsertion(options: {
	elements: Map<string, CanvasElement>;
	listId: string;
	card: CanvasElement;
}): CanvasMutationPlan | null {
	const list = options.elements.get(options.listId);
	if (!list || !isKanbanList(list) || !isKanbanCard(options.card)) return null;
	const card = { ...options.card, frameId: list.id };
	const nextElements = new Map(options.elements);
	nextElements.set(card.id, card);
	return {
		create: [card],
		update: buildKanbanReflowUpdates(
			nextElements,
			new Set([card.id]),
			new Map([[card.id, list.id]]),
		),
		deleteIds: [],
		selectedIds: [card.id],
		editingTextId: null,
	};
}

export function buildCanvasTextUpdate(options: {
	element: CanvasElement;
	text: string;
	size?: { width: number; height: number };
	fontFamily?: string;
	arrowTextSide?: ArrowTextSide | null;
	arrowTextOrientation?: ArrowTextOrientation | null;
}): Partial<CanvasElement> {
	const { element, text } = options;
	const fontFamily =
		options.fontFamily ?? element.fontFamily ?? DEFAULT_FONT_FAMILY;
	if (isKanbanList(element)) return { frameLabel: text };
	if (element.type === "arrow" || element.type === "line") {
		return {
			text,
			textColor: element.textColor ?? element.stroke,
			fontFamily,
			textAlign: "center",
			customData: {
				...(element.customData ?? {}),
				arrowTextSide:
					options.arrowTextSide ?? element.customData?.arrowTextSide ?? "above",
				arrowTextOrientation:
					options.arrowTextOrientation ??
					element.customData?.arrowTextOrientation ??
					"horizontal",
			},
		};
	}
	const isCenteredShape =
		element.type === "rectangle" ||
		element.type === "ellipse" ||
		element.type === "diamond";
	if (isCenteredShape || element.type === "frame") {
		return {
			text,
			textColor: element.textColor ?? element.stroke,
			fontFamily,
			...(isCenteredShape ? { textAlign: "center" as const } : {}),
		};
	}
	return {
		text,
		textColor: element.textColor ?? element.stroke,
		fontFamily,
		...(options.size ?? {}),
	};
}

export function planMindmapChildMutation(
	options: MindmapChildMutationOptions,
): CanvasMutationPlan | null {
	const parent = options.elements.get(options.parentId);
	const parentMeta = getMindmapNodeMeta(parent);
	if (!parent || !parentMeta) return null;
	const placement = planMindmapChildInsertion({
		parent,
		elements: options.elements,
		direction: options.direction,
		position: options.position,
	});
	if (!placement) return null;
	return buildMindmapInsertionMutation({
		...options,
		parent,
		treeId: parentMeta.mindmapTreeId,
		parentId: parent.id,
		depth: parentMeta.mindmapDepth + 1,
		x: placement.x,
		y: placement.y,
		direction: placement.direction,
		updates: placement.shifts,
		selectedId: options.preserveParentSelection ? parent.id : undefined,
	});
}

export function planMindmapSiblingMutation(
	options: MindmapSiblingMutationOptions,
): CanvasMutationPlan | null {
	const node = options.elements.get(options.nodeId);
	const nodeMeta = getMindmapNodeMeta(node);
	if (!node || !nodeMeta) return null;
	if (nodeMeta.mindmapParentId == null) {
		return planMindmapChildMutation({
			...options,
			parentId: node.id,
			direction: options.position === "before" ? "left" : "right",
			preserveParentSelection: options.preserveAnchorSelection,
		});
	}
	const placement = planMindmapSiblingInsertion({
		node,
		elements: options.elements,
		position: options.position,
	});
	const parent = options.elements.get(nodeMeta.mindmapParentId);
	if (!placement || !parent) return null;
	return buildMindmapInsertionMutation({
		...options,
		parent,
		treeId: nodeMeta.mindmapTreeId,
		parentId: nodeMeta.mindmapParentId,
		depth: nodeMeta.mindmapDepth,
		x: placement.x,
		y: placement.y,
		direction: placement.direction,
		updates: placement.shifts,
		selectedId: options.preserveAnchorSelection ? node.id : undefined,
	});
}

function buildMindmapInsertionMutation(
	options: MindmapMutationOptions & {
		parent: CanvasElement;
		treeId: string;
		parentId: string;
		depth: number;
		x: number;
		y: number;
		direction: "left" | "right" | "up" | "down";
		updates: CanvasElementUpdate[];
		selectedId?: string;
	},
): CanvasMutationPlan {
	const nodeId = options.createId();
	const edgeId = options.createId();
	const branchColor = getMindmapBranchColorForNewNode(
		options.parent,
		options.elements,
	);
	const node = createMindmapNode({
		id: nodeId,
		x: options.x,
		y: options.y,
		text: options.text,
		treeId: options.treeId,
		parentId: options.parentId,
		direction: options.direction,
		depth: options.depth,
		stroke: branchColor,
		stackIndex: createStackIndexAfter(options.elements.values(), nodeId),
		...(options.appearance ?? {}),
	});
	const edge = createMindmapEdge({
		id: edgeId,
		treeId: options.treeId,
		source: options.parent,
		target: node,
		stroke: branchColor,
		stackIndex: createStackIndexBeforeElement(
			[...options.elements.values(), node],
			node.id,
			edgeId,
		),
	});
	const selectedId = options.selectedId ?? node.id;
	return {
		create: [node, edge],
		update: options.updates,
		deleteIds: [],
		selectedIds: [selectedId],
		editingTextId:
			options.startEditing === false || selectedId !== node.id ? null : node.id,
	};
}

export function getCanvasKeyboardCommand(event: {
	key: string;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
}): CanvasKeyboardCommand | null {
	const ctrl = event.ctrlKey || event.metaKey;
	if (ctrl && (event.key === "Delete" || event.key === "Backspace")) {
		return "clear-canvas";
	}
	if (event.key === "Delete" || event.key === "Backspace") {
		return "delete-selection";
	}
	const key = event.key.toLowerCase();
	if (ctrl && key === "z" && !event.shiftKey) return "undo";
	if ((ctrl && key === "z" && event.shiftKey) || (ctrl && key === "y")) {
		return "redo";
	}
	if (ctrl && key === "a" && !event.shiftKey && !event.altKey) {
		return "select-all";
	}
	if (event.key === "Escape") return "escape";
	return null;
}
