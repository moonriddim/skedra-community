import type { CanvasElement } from "./types";

export type MindmapDirection = "left" | "right" | "up" | "down";

export const MINDMAP_NODE_TYPE = "mindmap-node";
export const MINDMAP_EDGE_TYPE = "mindmap-edge";
export const MINDMAP_ROOT_WIDTH = 220;
export const MINDMAP_ROOT_HEIGHT = 64;
export const MINDMAP_NODE_WIDTH = 180;
export const MINDMAP_NODE_HEIGHT = 56;
export const MINDMAP_HORIZONTAL_GAP = 160;
export const MINDMAP_VERTICAL_GAP = 88;
export const MINDMAP_BRANCH_COLORS = [
	"#2563EB",
	"#D97706",
	"#0F766E",
	"#7C3AED",
	"#DC2626",
	"#0891B2",
	"#65A30D",
	"#DB2777",
] as const;
export const DEFAULT_MINDMAP_BRANCH_COLOR = MINDMAP_BRANCH_COLORS[0];
export const MINDMAP_DEFAULT_FONT_FAMILY =
	'"Kalam", "Architects Daughter", "Segoe Print", cursive';

export interface MindmapNodeMeta {
	skedraType: typeof MINDMAP_NODE_TYPE;
	mindmapTreeId: string;
	mindmapParentId: string | null;
	mindmapDirection: MindmapDirection;
	mindmapDepth: number;
	mindmapBranchColor: string | null;
}

export interface MindmapEdgeMeta {
	skedraType: typeof MINDMAP_EDGE_TYPE;
	mindmapTreeId: string;
	mindmapSourceId: string;
	mindmapTargetId: string;
}

export interface CreateMindmapNodeOptions {
	id: string;
	x: number;
	y: number;
	text: string;
	treeId: string;
	parentId: string | null;
	direction: MindmapDirection;
	depth: number;
	branchColor?: string;
	stroke?: string;
	fill?: string;
	stackIndex?: string;
	fontFamily?: string;
	rootFill?: string;
	nodeFill?: string;
	rootStroke?: string;
	childBorder?: string;
	rootTextColor?: string;
	childTextColor?: string;
}

export interface CreateMindmapEdgeOptions {
	id: string;
	treeId: string;
	source: CanvasElement;
	target: CanvasElement;
	stroke?: string;
	stackIndex?: string;
}

export interface MindmapTemplateBranch {
	direction: "left" | "right";
	yOffset: number;
	color: string;
	text: string;
}

export interface CreateMindmapTemplateElementsOptions
	extends Pick<
		CreateMindmapNodeOptions,
		| "fontFamily"
		| "rootFill"
		| "nodeFill"
		| "rootStroke"
		| "childBorder"
		| "rootTextColor"
		| "childTextColor"
	> {
	x: number;
	y: number;
	text: string;
	branches: readonly MindmapTemplateBranch[];
	createId: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value != null;
}

export function isHorizontalMindmapDirection(
	direction: MindmapDirection,
): boolean {
	return direction === "left" || direction === "right";
}

function getOppositeMindmapDirection(
	direction: MindmapDirection,
): MindmapDirection {
	switch (direction) {
		case "left":
			return "right";
		case "right":
			return "left";
		case "up":
			return "down";
		case "down":
			return "up";
	}
}

export function isMindmapNode(
	element: CanvasElement | null | undefined,
): boolean {
	return element?.customData?.skedraType === MINDMAP_NODE_TYPE;
}

export function isMindmapEdge(
	element: CanvasElement | null | undefined,
): boolean {
	return element?.customData?.skedraType === MINDMAP_EDGE_TYPE;
}

export function getMindmapNodeMeta(
	element: CanvasElement | null | undefined,
): MindmapNodeMeta | null {
	if (!element || !isMindmapNode(element) || !isRecord(element.customData)) {
		return null;
	}
	const {
		mindmapTreeId,
		mindmapParentId,
		mindmapDirection,
		mindmapDepth,
		mindmapBranchColor,
	} = element.customData;
	if (
		typeof mindmapTreeId !== "string" ||
		(mindmapParentId !== null && typeof mindmapParentId !== "string") ||
		(mindmapDirection !== "left" &&
			mindmapDirection !== "right" &&
			mindmapDirection !== "up" &&
			mindmapDirection !== "down") ||
		typeof mindmapDepth !== "number" ||
		(mindmapBranchColor != null && typeof mindmapBranchColor !== "string")
	) {
		return null;
	}
	return {
		skedraType: MINDMAP_NODE_TYPE,
		mindmapTreeId,
		mindmapParentId,
		mindmapDirection,
		mindmapDepth,
		mindmapBranchColor:
			typeof mindmapBranchColor === "string" ? mindmapBranchColor : null,
	};
}

export function getMindmapEdgeMeta(
	element: CanvasElement | null | undefined,
): MindmapEdgeMeta | null {
	if (!element || !isMindmapEdge(element) || !isRecord(element.customData)) {
		return null;
	}
	const { mindmapTreeId, mindmapSourceId, mindmapTargetId } =
		element.customData;
	if (
		typeof mindmapTreeId !== "string" ||
		typeof mindmapSourceId !== "string" ||
		typeof mindmapTargetId !== "string"
	) {
		return null;
	}
	return {
		skedraType: MINDMAP_EDGE_TYPE,
		mindmapTreeId,
		mindmapSourceId,
		mindmapTargetId,
	};
}

function getMindmapNodeDimensions(depth: number) {
	return depth === 0
		? { width: MINDMAP_ROOT_WIDTH, height: MINDMAP_ROOT_HEIGHT }
		: { width: MINDMAP_NODE_WIDTH, height: MINDMAP_NODE_HEIGHT };
}

export function createMindmapNode(
	options: CreateMindmapNodeOptions,
): CanvasElement {
	const { width, height } = getMindmapNodeDimensions(options.depth);
	const isRoot = options.depth === 0;
	const branchColor = !isRoot
		? (options.branchColor ??
			(typeof options.stroke === "string" ? options.stroke : null))
		: null;
	return {
		id: options.id,
		type: "rectangle",
		x: options.x,
		y: options.y,
		width,
		height,
		rotation: 0,
		fill:
			options.fill ??
			(isRoot
				? (options.rootFill ?? "#F8FAFC")
				: (options.nodeFill ?? "#ffffff")),
		stroke:
			options.stroke ??
			branchColor ??
			(isRoot
				? (options.rootStroke ?? "#0F172A")
				: (options.childBorder ?? "#CBD5E1")),
		strokeWidth: isRoot ? 2.5 : 1.5,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		stackIndex: options.stackIndex,
		flipX: false,
		flipY: false,
		cornerRadius: isRoot ? 20 : 18,
		text: options.text,
		textColor: isRoot
			? (options.rootTextColor ?? "#0F172A")
			: (options.childTextColor ?? "#334155"),
		fontSize: isRoot ? 24 : 18,
		fontFamily: options.fontFamily ?? MINDMAP_DEFAULT_FONT_FAMILY,
		textAlign: "center",
		fontWeight: isRoot ? "bold" : "normal",
		customData: {
			skedraType: MINDMAP_NODE_TYPE,
			mindmapTreeId: options.treeId,
			mindmapParentId: options.parentId,
			mindmapDirection: options.direction,
			mindmapDepth: options.depth,
			mindmapBranchColor: branchColor,
		},
	};
}

function getAnchor(
	element: CanvasElement,
	side: MindmapDirection,
): [number, number] {
	switch (side) {
		case "right":
			return [element.x + element.width, element.y + element.height / 2];
		case "left":
			return [element.x, element.y + element.height / 2];
		case "up":
			return [element.x + element.width / 2, element.y];
		case "down":
			return [element.x + element.width / 2, element.y + element.height];
	}
}

export function buildMindmapEdgeChanges(
	source: CanvasElement,
	target: CanvasElement,
): Partial<CanvasElement> {
	const sourceMeta = getMindmapNodeMeta(source);
	const targetMeta = getMindmapNodeMeta(target);
	const direction =
		targetMeta?.mindmapDirection ?? sourceMeta?.mindmapDirection ?? "right";
	const start = getAnchor(source, direction);
	const end = getAnchor(target, getOppositeMindmapDirection(direction));
	const absolutePoints: [number, number][] = isHorizontalMindmapDirection(
		direction,
	)
		? (() => {
				const deltaX = Math.abs(end[0] - start[0]);
				const handleOffset = Math.min(
					Math.max(36, deltaX * 0.5),
					Math.max(36, deltaX - 24),
				);
				const handleX =
					direction === "right"
						? start[0] + handleOffset
						: start[0] - handleOffset;
				return [
					[start[0], start[1]],
					[handleX, start[1]],
					[handleX, end[1]],
					[end[0], end[1]],
				];
			})()
		: (() => {
				const deltaY = Math.abs(end[1] - start[1]);
				const handleOffset = Math.min(
					Math.max(36, deltaY * 0.5),
					Math.max(36, deltaY - 24),
				);
				const handleY =
					direction === "down"
						? start[1] + handleOffset
						: start[1] - handleOffset;
				return [
					[start[0], start[1]],
					[start[0], handleY],
					[end[0], handleY],
					[end[0], end[1]],
				];
			})();
	const minX = Math.min(...absolutePoints.map(([x]) => x));
	const minY = Math.min(...absolutePoints.map(([, y]) => y));
	const maxX = Math.max(...absolutePoints.map(([x]) => x));
	const maxY = Math.max(...absolutePoints.map(([, y]) => y));
	return {
		x: minX,
		y: minY,
		width: Math.max(1, maxX - minX),
		height: Math.max(1, maxY - minY),
		points: absolutePoints.map(
			([x, y]) => [x - minX, y - minY] as [number, number],
		),
		arrowMode: "curve",
		arrowHeadStart: "none",
		arrowHeadEnd: "none",
	};
}

export function createMindmapEdge(
	options: CreateMindmapEdgeOptions,
): CanvasElement {
	const geometry = buildMindmapEdgeChanges(options.source, options.target);
	return {
		id: options.id,
		type: "arrow",
		x: geometry.x ?? 0,
		y: geometry.y ?? 0,
		width: geometry.width ?? 1,
		height: geometry.height ?? 1,
		rotation: 0,
		fill: "transparent",
		stroke: options.stroke ?? "#94A3B8",
		strokeWidth: 2,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		stackIndex: options.stackIndex,
		flipX: false,
		flipY: false,
		customData: {
			skedraType: MINDMAP_EDGE_TYPE,
			mindmapTreeId: options.treeId,
			mindmapSourceId: options.source.id,
			mindmapTargetId: options.target.id,
		},
		points: geometry.points,
		arrowMode: geometry.arrowMode,
		arrowHeadStart: geometry.arrowHeadStart,
		arrowHeadEnd: geometry.arrowHeadEnd,
	};
}

export function createMindmapTemplateElements(
	options: CreateMindmapTemplateElementsOptions,
): CanvasElement[] {
	const treeId = options.createId();
	const themeOptions = {
		fontFamily: options.fontFamily,
		rootFill: options.rootFill,
		nodeFill: options.nodeFill,
		rootStroke: options.rootStroke,
		childBorder: options.childBorder,
		rootTextColor: options.rootTextColor,
		childTextColor: options.childTextColor,
	};
	const root = createMindmapNode({
		id: options.createId(),
		x: options.x - MINDMAP_ROOT_WIDTH / 2,
		y: options.y - MINDMAP_ROOT_HEIGHT / 2,
		text: options.text,
		treeId,
		parentId: null,
		direction: "right",
		depth: 0,
		...themeOptions,
	});
	const nodes = [root];
	const edges: CanvasElement[] = [];

	for (const branch of options.branches) {
		const node = createMindmapNode({
			id: options.createId(),
			x:
				branch.direction === "right"
					? root.x + root.width + MINDMAP_HORIZONTAL_GAP
					: root.x - MINDMAP_HORIZONTAL_GAP - MINDMAP_NODE_WIDTH,
			y: options.y + branch.yOffset,
			text: branch.text,
			treeId,
			parentId: root.id,
			direction: branch.direction,
			depth: 1,
			stroke: branch.color,
			...themeOptions,
		});
		nodes.push(node);
		edges.push(
			createMindmapEdge({
				id: options.createId(),
				treeId,
				source: root,
				target: node,
				stroke: branch.color,
			}),
		);
	}

	return [...edges, ...nodes];
}

function resolveMindmapBranchColor(
	element: CanvasElement | null | undefined,
	elements: Map<string, CanvasElement>,
): string | null {
	let current = element;
	let fallbackColor: string | null = null;
	const visited = new Set<string>();

	while (current) {
		if (visited.has(current.id)) break;
		visited.add(current.id);

		const meta = getMindmapNodeMeta(current);
		if (!meta) break;

		if (meta.mindmapDepth === 1) {
			return fallbackColor || current.stroke || meta.mindmapBranchColor;
		}

		if (!fallbackColor && meta.mindmapBranchColor) {
			fallbackColor = meta.mindmapBranchColor;
		}

		if (meta.mindmapParentId == null) break;
		current = elements.get(meta.mindmapParentId);
	}

	return fallbackColor;
}

export function getMindmapBranchRootIdForElement(
	element: CanvasElement | null | undefined,
	elements: Map<string, CanvasElement>,
): string | null {
	if (!element) return null;

	const edgeMeta = getMindmapEdgeMeta(element);
	if (edgeMeta) {
		return getMindmapBranchRootIdForElement(
			elements.get(edgeMeta.mindmapTargetId),
			elements,
		);
	}

	const nodeMeta = getMindmapNodeMeta(element);
	if (!nodeMeta || nodeMeta.mindmapDepth === 0) return null;
	return element.id;
}

export function buildMindmapBranchColorUpdates(
	element: CanvasElement | null | undefined,
	elements: Map<string, CanvasElement>,
	color: string,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const branchRootId = getMindmapBranchRootIdForElement(element, elements);
	if (!branchRootId) return [];

	const branchNodeIds = collectMindmapDescendantIds(branchRootId, elements);
	const branchEdgeIds = collectConnectedMindmapEdgeIds(branchNodeIds, elements);
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];

	for (const nodeId of branchNodeIds) {
		const branchNode = elements.get(nodeId);
		if (!branchNode) continue;
		updates.push({
			id: nodeId,
			changes: {
				stroke: color,
				customData: {
					...(isRecord(branchNode.customData) ? branchNode.customData : {}),
					mindmapBranchColor: color,
				},
			},
		});
	}

	for (const edgeId of branchEdgeIds) {
		updates.push({
			id: edgeId,
			changes: { stroke: color },
		});
	}

	return updates;
}

function getNextMindmapBranchColor(
	rootId: string,
	elements: Map<string, CanvasElement>,
): string {
	const usedColors = new Set<string>();
	let branchCount = 0;

	for (const element of elements.values()) {
		const meta = getMindmapNodeMeta(element);
		if (meta?.mindmapParentId !== rootId) continue;
		branchCount += 1;
		const branchColor =
			resolveMindmapBranchColor(element, elements) ?? element.stroke;
		if (branchColor) usedColors.add(branchColor);
	}

	for (const color of MINDMAP_BRANCH_COLORS) {
		if (!usedColors.has(color)) return color;
	}

	return (
		MINDMAP_BRANCH_COLORS[branchCount % MINDMAP_BRANCH_COLORS.length] ??
		DEFAULT_MINDMAP_BRANCH_COLOR
	);
}

export function getMindmapBranchColorForNewNode(
	parent: CanvasElement,
	elements: Map<string, CanvasElement>,
): string {
	const parentMeta = getMindmapNodeMeta(parent);
	if (!parentMeta) return DEFAULT_MINDMAP_BRANCH_COLOR;
	if (parentMeta.mindmapDepth === 0) {
		return getNextMindmapBranchColor(parent.id, elements);
	}
	return (
		resolveMindmapBranchColor(parent, elements) ?? DEFAULT_MINDMAP_BRANCH_COLOR
	);
}

export function collectMindmapDescendantIds(
	nodeId: string,
	elements: Map<string, CanvasElement>,
): Set<string> {
	const ids = new Set<string>();
	const queue = [nodeId];
	while (queue.length > 0) {
		const currentId = queue.shift();
		if (!currentId || ids.has(currentId)) continue;
		ids.add(currentId);
		for (const element of elements.values()) {
			const meta = getMindmapNodeMeta(element);
			if (meta?.mindmapParentId === currentId) {
				queue.push(element.id);
			}
		}
	}
	return ids;
}

export function collectConnectedMindmapEdgeIds(
	nodeIds: Iterable<string>,
	elements: Map<string, CanvasElement>,
): Set<string> {
	const nodeIdSet = new Set(nodeIds);
	const edgeIds = new Set<string>();
	for (const element of elements.values()) {
		const meta = getMindmapEdgeMeta(element);
		if (!meta) continue;
		if (
			nodeIdSet.has(meta.mindmapSourceId) ||
			nodeIdSet.has(meta.mindmapTargetId)
		) {
			edgeIds.add(element.id);
		}
	}
	return edgeIds;
}

export interface MindmapInsertionShift {
	id: string;
	changes: Pick<Partial<CanvasElement>, "x" | "y">;
}

export interface MindmapInsertionPlan {
	x: number;
	y: number;
	direction: MindmapDirection;
	shifts: MindmapInsertionShift[];
}

export interface PlanMindmapChildInsertionOptions {
	parent: CanvasElement;
	elements: Map<string, CanvasElement>;
	direction?: MindmapDirection;
	position?: "before" | "after";
}

export interface PlanMindmapSiblingInsertionOptions {
	node: CanvasElement;
	elements: Map<string, CanvasElement>;
	position?: "before" | "after";
}

function getMindmapSubtreeBounds(
	node: CanvasElement,
	elements: Map<string, CanvasElement>,
) {
	let minX = node.x;
	let minY = node.y;
	let maxX = node.x + node.width;
	let maxY = node.y + node.height;
	for (const id of collectMindmapDescendantIds(node.id, elements)) {
		const descendant = elements.get(id);
		if (!descendant) continue;
		minX = Math.min(minX, descendant.x);
		minY = Math.min(minY, descendant.y);
		maxX = Math.max(maxX, descendant.x + descendant.width);
		maxY = Math.max(maxY, descendant.y + descendant.height);
	}
	return { minX, minY, maxX, maxY };
}

function resolveAlternatingChildAxisPosition(
	parent: CanvasElement,
	children: CanvasElement[],
	elements: Map<string, CanvasElement>,
	direction: MindmapDirection,
): number {
	const horizontalDirection = isHorizontalMindmapDirection(direction);
	const parentCenter = horizontalDirection
		? parent.y + parent.height / 2
		: parent.x + parent.width / 2;
	let negativeSideCount = 0;
	let positiveSideCount = 0;
	let minimum = Number.POSITIVE_INFINITY;
	let maximum = Number.NEGATIVE_INFINITY;

	for (const child of children) {
		const bounds = getMindmapSubtreeBounds(child, elements);
		const childCenter = horizontalDirection
			? child.y + child.height / 2
			: child.x + child.width / 2;
		if (childCenter < parentCenter) negativeSideCount++;
		else if (childCenter > parentCenter) positiveSideCount++;
		minimum = Math.min(
			minimum,
			horizontalDirection ? bounds.minY : bounds.minX,
		);
		maximum = Math.max(
			maximum,
			horizontalDirection ? bounds.maxY : bounds.maxX,
		);
	}

	const placeOnNegativeSide = negativeSideCount <= positiveSideCount;
	if (horizontalDirection) {
		return placeOnNegativeSide
			? minimum - 32 - MINDMAP_NODE_HEIGHT
			: maximum + 32;
	}
	return placeOnNegativeSide ? minimum - 32 - MINDMAP_NODE_WIDTH : maximum + 32;
}

function buildMindmapShifts(
	ids: Iterable<string>,
	elements: Map<string, CanvasElement>,
	direction: MindmapDirection,
): MindmapInsertionShift[] {
	const horizontalDirection = isHorizontalMindmapDirection(direction);
	return Array.from(new Set(ids)).flatMap((id) => {
		const element = elements.get(id);
		if (!element) return [];
		return [
			{
				id,
				changes: horizontalDirection
					? { y: element.y + MINDMAP_VERTICAL_GAP }
					: { x: element.x + MINDMAP_HORIZONTAL_GAP },
			},
		];
	});
}

export function planMindmapChildInsertion({
	parent,
	elements,
	direction: requestedDirection,
	position = "after",
}: PlanMindmapChildInsertionOptions): MindmapInsertionPlan | null {
	const parentMeta = getMindmapNodeMeta(parent);
	if (!parentMeta) return null;
	const resolveRootDirection = (): MindmapDirection => {
		if (requestedDirection) return requestedDirection;
		const leftChildren = getMindmapChildNodes(parent.id, "left", elements);
		const rightChildren = getMindmapChildNodes(parent.id, "right", elements);
		if (leftChildren.length === rightChildren.length) {
			return position === "before" ? "left" : "right";
		}
		return leftChildren.length < rightChildren.length ? "left" : "right";
	};
	const direction =
		parentMeta.mindmapDepth === 0
			? resolveRootDirection()
			: (requestedDirection ?? parentMeta.mindmapDirection);
	const children = getMindmapChildNodes(parent.id, direction, elements);
	const horizontalDirection = isHorizontalMindmapDirection(direction);
	const shiftedIds = new Set<string>();
	let x = parent.x;
	let y = parent.y;

	if (horizontalDirection) {
		if (children.length > 0) {
			if (position === "before") {
				y = children[0].y;
				for (const child of children) {
					for (const id of collectMindmapDescendantIds(child.id, elements)) {
						shiftedIds.add(id);
					}
				}
			} else {
				y = resolveAlternatingChildAxisPosition(
					parent,
					children,
					elements,
					direction,
				);
			}
		} else {
			y = parent.y + parent.height / 2 - MINDMAP_NODE_HEIGHT / 2;
		}
		x =
			direction === "right"
				? parent.x + parent.width + MINDMAP_HORIZONTAL_GAP
				: parent.x - MINDMAP_HORIZONTAL_GAP - MINDMAP_NODE_WIDTH;
	} else {
		x = parent.x + parent.width / 2 - MINDMAP_NODE_WIDTH / 2;
		if (children.length > 0) {
			if (position === "before") {
				x = children[0].x;
				for (const child of children) {
					for (const id of collectMindmapDescendantIds(child.id, elements)) {
						shiftedIds.add(id);
					}
				}
			} else {
				x = resolveAlternatingChildAxisPosition(
					parent,
					children,
					elements,
					direction,
				);
			}
		}
		y =
			direction === "down"
				? parent.y + parent.height + MINDMAP_VERTICAL_GAP
				: parent.y - MINDMAP_VERTICAL_GAP - MINDMAP_NODE_HEIGHT;
	}

	return {
		x,
		y,
		direction,
		shifts: buildMindmapShifts(shiftedIds, elements, direction),
	};
}

export function planMindmapSiblingInsertion({
	node,
	elements,
	position = "after",
}: PlanMindmapSiblingInsertionOptions): MindmapInsertionPlan | null {
	const nodeMeta = getMindmapNodeMeta(node);
	if (!nodeMeta || nodeMeta.mindmapParentId == null) return null;
	const direction = nodeMeta.mindmapDirection;
	const siblings = getMindmapChildNodes(
		nodeMeta.mindmapParentId,
		direction,
		elements,
	);
	const horizontalDirection = isHorizontalMindmapDirection(direction);
	const shiftedIds = new Set<string>();
	let x = node.x;
	let y = node.y;

	if (horizontalDirection) {
		if (position === "before") {
			for (const sibling of siblings) {
				if (sibling.y < node.y) continue;
				for (const id of collectMindmapDescendantIds(sibling.id, elements)) {
					shiftedIds.add(id);
				}
			}
		} else {
			const subtree = getMindmapSubtreeBounds(node, elements);
			y = subtree.maxY + 32;
			for (const sibling of siblings) {
				if (sibling.id === node.id || sibling.y < y) continue;
				for (const id of collectMindmapDescendantIds(sibling.id, elements)) {
					shiftedIds.add(id);
				}
			}
		}
	} else if (position === "before") {
		for (const sibling of siblings) {
			if (sibling.x < node.x) continue;
			for (const id of collectMindmapDescendantIds(sibling.id, elements)) {
				shiftedIds.add(id);
			}
		}
	} else {
		const subtree = getMindmapSubtreeBounds(node, elements);
		x = subtree.maxX + 32;
		for (const sibling of siblings) {
			if (sibling.id === node.id || sibling.x < x) continue;
			for (const id of collectMindmapDescendantIds(sibling.id, elements)) {
				shiftedIds.add(id);
			}
		}
	}

	return {
		x,
		y,
		direction,
		shifts: buildMindmapShifts(shiftedIds, elements, direction),
	};
}

export function getMindmapChildNodes(
	parentId: string | null,
	direction: MindmapDirection,
	elements: Map<string, CanvasElement>,
): CanvasElement[] {
	return Array.from(elements.values())
		.filter((element) => {
			const meta = getMindmapNodeMeta(element);
			return (
				meta?.mindmapParentId === parentId &&
				meta.mindmapDirection === direction
			);
		})
		.sort((left, right) =>
			isHorizontalMindmapDirection(direction)
				? left.y - right.y
				: left.x - right.x,
		);
}

export function buildMindmapSyncUpdates(elements: Map<string, CanvasElement>) {
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];
	for (const element of elements.values()) {
		const nodeMeta = getMindmapNodeMeta(element);
		if (nodeMeta && nodeMeta.mindmapDepth > 0) {
			const branchColor = resolveMindmapBranchColor(element, elements);
			const nextCustomData =
				branchColor && nodeMeta.mindmapBranchColor !== branchColor
					? {
							...(isRecord(element.customData) ? element.customData : {}),
							mindmapBranchColor: branchColor,
						}
					: null;
			if (branchColor && (element.stroke !== branchColor || nextCustomData)) {
				updates.push({
					id: element.id,
					changes: {
						...(element.stroke !== branchColor ? { stroke: branchColor } : {}),
						...(nextCustomData ? { customData: nextCustomData } : {}),
					},
				});
			}
			continue;
		}

		const edgeMeta = getMindmapEdgeMeta(element);
		if (!edgeMeta) continue;
		const source = elements.get(edgeMeta.mindmapSourceId);
		const target = elements.get(edgeMeta.mindmapTargetId);
		if (
			!source ||
			!target ||
			!isMindmapNode(source) ||
			!isMindmapNode(target)
		) {
			continue;
		}

		const next = buildMindmapEdgeChanges(source, target);
		const branchColor =
			resolveMindmapBranchColor(target, elements) ??
			resolveMindmapBranchColor(source, elements) ??
			element.stroke;
		const currentPoints = JSON.stringify(element.points ?? []);
		const nextPoints = JSON.stringify(next.points ?? []);
		const geometryChanged =
			element.x !== next.x ||
			element.y !== next.y ||
			element.width !== next.width ||
			element.height !== next.height ||
			currentPoints !== nextPoints;

		const changes: Partial<CanvasElement> = {};
		if (geometryChanged) {
			Object.assign(changes, next);
		}
		if (branchColor && element.stroke !== branchColor) {
			changes.stroke = branchColor;
		}

		if (Object.keys(changes).length > 0) {
			updates.push({ id: element.id, changes });
		}
	}
	return updates;
}
