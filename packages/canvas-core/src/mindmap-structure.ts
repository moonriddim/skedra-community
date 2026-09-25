import type { CanvasMutationPlan } from "./editor-operations";
import {
	type CreateMindmapNodeOptions,
	MINDMAP_BRANCH_COLORS,
	type MindmapDirection,
	buildMindmapSyncUpdates,
	collectMindmapDescendantIds,
	createMindmapEdge,
	createMindmapNode,
	getMindmapEdgeMeta,
	getMindmapNodeMeta,
} from "./mindmap";
import type { CanvasElement } from "./types";

export type MindmapLayout = "balanced" | "right" | "left" | "down" | "up";

function withSyncedEdges(
	elements: Map<string, CanvasElement>,
	plan: CanvasMutationPlan,
): CanvasMutationPlan {
	const next = new Map(elements);
	const patches = new Map(
		plan.update.map((patch) => [patch.id, patch.changes]),
	);
	for (const patch of plan.update) {
		const element = next.get(patch.id);
		if (element) next.set(patch.id, { ...element, ...patch.changes });
	}
	for (const patch of buildMindmapSyncUpdates(next))
		patches.set(patch.id, { ...patches.get(patch.id), ...patch.changes });
	return {
		...plan,
		update: Array.from(patches, ([id, changes]) => ({ id, changes })),
	};
}

export function getMindmapHiddenIds(
	elements: Iterable<CanvasElement>,
): Set<string> {
	const all = Array.from(elements);
	const children = new Map<string, string[]>();
	const collapsed: string[] = [];
	for (const node of all) {
		const meta = getMindmapNodeMeta(node);
		if (!meta) continue;
		if (meta.mindmapParentId) {
			const siblings = children.get(meta.mindmapParentId) ?? [];
			siblings.push(node.id);
			children.set(meta.mindmapParentId, siblings);
		}
		if (node.customData?.mindmapCollapsed === true) collapsed.push(node.id);
	}
	const hidden = new Set<string>();
	const pending = collapsed.flatMap((id) => children.get(id) ?? []);
	while (pending.length) {
		const id = pending.pop();
		if (!id || hidden.has(id)) continue;
		hidden.add(id);
		pending.push(...(children.get(id) ?? []));
	}
	for (const edge of all) {
		const meta = getMindmapEdgeMeta(edge);
		if (
			meta &&
			(hidden.has(meta.mindmapSourceId) || hidden.has(meta.mindmapTargetId))
		)
			hidden.add(edge.id);
	}
	return hidden;
}

export function findMindmapRoot(
	elements: Map<string, CanvasElement>,
	id: string,
): CanvasElement | null {
	let node = elements.get(id);
	const seen = new Set<string>();
	while (node && !seen.has(node.id)) {
		seen.add(node.id);
		const meta = getMindmapNodeMeta(node);
		if (!meta) return null;
		if (!meta.mindmapParentId) return node;
		node = elements.get(meta.mindmapParentId);
	}
	return null;
}

/** Explicit layout action. Hidden children are arranged too, ready for expansion. */
export function planMindmapLayout(
	elements: Map<string, CanvasElement>,
	rootId: string,
	layout: MindmapLayout,
): CanvasMutationPlan | null {
	const root = findMindmapRoot(elements, rootId);
	if (!root || root.locked) return null;
	const nodes = collectMindmapDescendantIds(root.id, elements);
	if (Array.from(nodes).some((id) => elements.get(id)?.locked)) return null;
	const children = new Map<string, CanvasElement[]>();
	for (const id of nodes) {
		const node = elements.get(id);
		const parentId = getMindmapNodeMeta(node)?.mindmapParentId;
		if (!node || !parentId) continue;
		const siblings = children.get(parentId) ?? [];
		siblings.push(node);
		children.set(parentId, siblings);
	}
	for (const siblings of children.values())
		siblings.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
	const vertical = layout === "down" || layout === "up";
	const spans = new Map<string, number>();
	const measure = (node: CanvasElement): number => {
		const cached = spans.get(node.id);
		if (cached !== undefined) return cached;
		// A guard also makes malformed imported cycles finite.
		spans.set(node.id, vertical ? node.width : node.height);
		const list = children.get(node.id) ?? [];
		const size = Math.max(
			vertical ? node.width : node.height,
			list.reduce((total, child) => total + measure(child), 0) +
				Math.max(0, list.length - 1) * 36,
		);
		spans.set(node.id, size);
		return size;
	};
	measure(root);
	const update: CanvasMutationPlan["update"] = [];
	const visited = new Set([root.id]);
	const arrange = (
		parent: CanvasElement,
		list: CanvasElement[],
		direction: MindmapDirection,
	) => {
		const total =
			list.reduce((sum, child) => sum + measure(child), 0) +
			Math.max(0, list.length - 1) * 36;
		let cursor =
			(vertical ? parent.x + parent.width / 2 : parent.y + parent.height / 2) -
			total / 2;
		for (const child of list) {
			if (visited.has(child.id)) continue;
			visited.add(child.id);
			const span = measure(child);
			const x = vertical
				? cursor + (span - child.width) / 2
				: direction === "left"
					? parent.x - 100 - child.width
					: parent.x + parent.width + 100;
			const y = vertical
				? direction === "up"
					? parent.y - child.height - 80
					: parent.y + parent.height + 80
				: cursor + (span - child.height) / 2;
			const placed = { ...child, x, y };
			update.push({
				id: child.id,
				changes: {
					x,
					y,
					customData: { ...child.customData, mindmapDirection: direction },
				},
			});
			arrange(placed, children.get(child.id) ?? [], direction);
			cursor += span + 36;
		}
	};
	const branches = children.get(root.id) ?? [];
	if (layout === "balanced") {
		const preserveSides = root.customData?.mindmapLayout === "balanced";
		const right = branches.filter((child, i) =>
			preserveSides
				? getMindmapNodeMeta(child)?.mindmapDirection !== "left"
				: i % 2 === 0,
		);
		const rightIds = new Set(right.map((child) => child.id));
		arrange(root, right, "right");
		arrange(
			root,
			branches.filter((child) => !rightIds.has(child.id)),
			"left",
		);
	} else arrange(root, branches, layout);
	update.push({
		id: root.id,
		changes: { customData: { ...root.customData, mindmapLayout: layout } },
	});
	return withSyncedEdges(elements, {
		create: [],
		update,
		deleteIds: [],
		selectedIds: [root.id],
	});
}

export function canReparentMindmapNode(
	elements: Map<string, CanvasElement>,
	nodeId: string,
	parentId: string,
): boolean {
	const node = elements.get(nodeId);
	const parent = elements.get(parentId);
	const meta = getMindmapNodeMeta(node);
	if (
		!node ||
		!parent ||
		node.locked ||
		parent.locked ||
		!meta?.mindmapParentId ||
		!getMindmapNodeMeta(parent) ||
		meta.mindmapParentId === parentId
	)
		return false;
	const descendants = collectMindmapDescendantIds(nodeId, elements);
	return (
		!descendants.has(parentId) &&
		!Array.from(descendants).some((id) => elements.get(id)?.locked)
	);
}

export function planMindmapReparent(
	elements: Map<string, CanvasElement>,
	nodeId: string,
	parentId: string,
): CanvasMutationPlan | null {
	if (!canReparentMindmapNode(elements, nodeId, parentId)) return null;
	const node = elements.get(nodeId);
	const parent = elements.get(parentId);
	const oldMeta = getMindmapNodeMeta(node);
	const parentMeta = getMindmapNodeMeta(parent);
	if (!node || !parent || !oldMeta || !parentMeta) return null;
	const moved = collectMindmapDescendantIds(nodeId, elements);
	const parentLayout = parent.customData?.mindmapLayout;
	const direction =
		parentMeta.mindmapDepth === 0
			? parentLayout === "left" ||
				parentLayout === "right" ||
				parentLayout === "down" ||
				parentLayout === "up"
				? parentLayout
				: node.x < parent.x
					? "left"
					: "right"
			: parentMeta.mindmapDirection;
	const reorient = direction !== oldMeta.mindmapDirection;
	const positioned = new Map(elements);
	if (reorient) {
		// Arrange only this subtree when it changes axis/side; the rest stays put.
		const subtree = new Map(
			Array.from(moved).flatMap((id) => {
				const child = elements.get(id);
				return child ? [[id, child] as const] : [];
			}),
		);
		subtree.set(nodeId, {
			...node,
			customData: { ...node.customData, mindmapParentId: null },
		});
		for (const patch of planMindmapLayout(subtree, nodeId, direction)?.update ??
			[]) {
			const child = positioned.get(patch.id);
			if (child)
				positioned.set(patch.id, {
					...child,
					x: patch.changes.x ?? child.x,
					y: patch.changes.y ?? child.y,
				});
		}
	}
	const color =
		parentMeta.mindmapDepth === 0
			? node.stroke
			: (parentMeta.mindmapBranchColor ?? parent.stroke);
	const depthDelta = parentMeta.mindmapDepth + 1 - oldMeta.mindmapDepth;
	const update: CanvasMutationPlan["update"] = [];
	for (const element of elements.values()) {
		const meta = getMindmapNodeMeta(element);
		if (meta && moved.has(element.id))
			update.push({
				id: element.id,
				changes: {
					stroke: color,
					customData: {
						...element.customData,
						mindmapParentId:
							element.id === nodeId ? parentId : meta.mindmapParentId,
						mindmapTreeId: parentMeta.mindmapTreeId,
						mindmapDepth: meta.mindmapDepth + depthDelta,
						mindmapDirection:
							reorient || element.id === nodeId
								? direction
								: meta.mindmapDirection,
						mindmapBranchColor: color,
					},
				},
			});
		const edge = getMindmapEdgeMeta(element);
		if (edge && moved.has(edge.mindmapTargetId))
			update.push({
				id: element.id,
				changes: {
					stroke: color,
					customData: {
						...element.customData,
						mindmapTreeId: parentMeta.mindmapTreeId,
						mindmapSourceId:
							edge.mindmapTargetId === nodeId ? parentId : edge.mindmapSourceId,
					},
				},
			});
	}
	update.push({
		id: parentId,
		changes: { customData: { ...parent.customData, mindmapCollapsed: false } },
	});
	// Move the subtree beside its new parent instead of leaving it over the drop target.
	let x =
		direction === "left"
			? parent.x - node.width - 100
			: direction === "right"
				? parent.x + parent.width + 100
				: parent.x;
	let y =
		direction === "up"
			? parent.y - node.height - 80
			: direction === "down"
				? parent.y + parent.height + 80
				: parent.y;
	const movedNodes = Array.from(moved).flatMap((id) => {
		const el = positioned.get(id);
		return el ? [el] : [];
	});
	const obstacles = Array.from(elements.values()).filter(
		(el) => !moved.has(el.id) && getMindmapNodeMeta(el),
	);
	// Keep the translated subtree clear of existing topics, including manual layouts.
	for (
		let attempt = 0;
		attempt <= obstacles.length * Math.max(1, movedNodes.length);
		attempt++
	) {
		let shift = 0;
		for (const child of movedNodes)
			for (const other of obstacles) {
				const cx = child.x + x - node.x;
				const cy = child.y + y - node.y;
				if (
					cx < other.x + other.width + 24 &&
					cx + child.width + 24 > other.x &&
					cy < other.y + other.height + 24 &&
					cy + child.height + 24 > other.y
				) {
					shift = Math.max(
						shift,
						direction === "left" || direction === "right"
							? other.y + other.height + 36 - cy
							: other.x + other.width + 36 - cx,
					);
				}
			}
		if (!shift) break;
		if (direction === "left" || direction === "right") y += shift;
		else x += shift;
	}
	for (const patch of update) {
		const element = positioned.get(patch.id);
		if (element && moved.has(patch.id))
			Object.assign(patch.changes, {
				x: element.x + x - node.x,
				y: element.y + y - node.y,
			});
	}
	return withSyncedEdges(elements, {
		create: [],
		update,
		deleteIds: [],
		selectedIds: [nodeId],
	});
}

/** Two spaces or one tab per level; Markdown list markers are optional. */
export function parseMindmapOutline(
	text: string,
): { depth: number; text: string }[] {
	const rows = text.split(/\r?\n/).filter((line) => line.trim());
	if (!rows.length) throw new Error("empty");
	if (rows.length > 500) throw new Error("too-many");
	const result: { depth: number; text: string }[] = [];
	const baseIndent =
		rows[0].match(/^\s*/)?.[0].replaceAll("\t", "  ").length ?? 0;
	for (const row of rows) {
		const whitespace = row.match(/^\s*/)?.[0] ?? "";
		const indent = whitespace.replaceAll("\t", "  ").length - baseIndent;
		const depth = indent / 2;
		const label = row
			.trim()
			.replace(/^(?:[-*+]\s+|\d+[.)]\s+)/, "")
			.trim();
		if (
			!label ||
			label.length > 500 ||
			depth < 0 ||
			!Number.isInteger(depth) ||
			depth > 30 ||
			(result.length > 0 &&
				(depth === 0 || depth > result[result.length - 1].depth + 1))
		)
			throw new Error("indent");
		result.push({ depth, text: label });
	}
	return result;
}

export function createMindmapFromOutline(
	text: string,
	createId: () => string,
	appearance: Partial<CreateMindmapNodeOptions> = {},
): CanvasElement[] {
	const rows = parseMindmapOutline(text);
	const treeId = createId();
	const result: CanvasElement[] = [];
	const ancestors: CanvasElement[] = [];
	let branchIndex = -1;
	for (const row of rows) {
		if (row.depth === 1) branchIndex++;
		const parent = row.depth > 0 ? ancestors[row.depth - 1] : null;
		const color =
			MINDMAP_BRANCH_COLORS[
				Math.max(0, branchIndex) % MINDMAP_BRANCH_COLORS.length
			];
		const node = createMindmapNode({
			...appearance,
			id: createId(),
			x: row.depth * 300,
			y: result.length * 100,
			text: row.text,
			treeId,
			parentId: parent?.id ?? null,
			direction: "right",
			depth: row.depth,
			branchColor: color,
		});
		// Conservative wrapping estimate works in both headless imports and browsers.
		// Leave an extra line for word boundaries once a label needs wrapping.
		const fontSize = node.fontSize ?? 18;
		const estimatedWidth = Array.from(row.text).reduce(
			(width, char) =>
				width +
				fontSize *
					(/\s/.test(char)
						? 0.35
						: /[MW@#\u2e80-\uffff]/u.test(char)
							? 1
							: 0.7),
			0,
		);
		node.width = Math.max(
			node.width,
			Math.min(360, Math.ceil(estimatedWidth + 24)),
		);
		const lines = Math.ceil(estimatedWidth / (node.width - 24));
		node.height = Math.max(
			node.height,
			Math.ceil((lines > 1 ? lines + 1 : lines) * fontSize * 1.4 + 24),
		);
		result.push(node);
		if (parent)
			result.push(
				createMindmapEdge({
					id: createId(),
					treeId,
					source: parent,
					target: node,
					stroke: color,
				}),
			);
		ancestors[row.depth] = node;
	}
	const map = new Map(result.map((el) => [el.id, el]));
	const plan = planMindmapLayout(map, result[0].id, "balanced");
	for (const patch of plan?.update ?? []) {
		const element = map.get(patch.id);
		if (element) map.set(patch.id, { ...element, ...patch.changes });
	}
	return Array.from(map.values());
}

export function exportMindmapOutline(
	elements: Map<string, CanvasElement>,
	nodeId: string,
): string {
	const root = elements.get(nodeId);
	if (!getMindmapNodeMeta(root) || !root) return "";
	const lines: string[] = [];
	const seen = new Set<string>();
	const walk = (node: CanvasElement, depth: number) => {
		if (seen.has(node.id)) return;
		seen.add(node.id);
		lines.push(
			`${"  ".repeat(depth)}${(node.text || "…").replace(/\s*\n\s*/g, " ")}`,
		);
		const children = Array.from(elements.values())
			.filter((el) => getMindmapNodeMeta(el)?.mindmapParentId === node.id)
			.sort((a, b) => a.y - b.y || a.x - b.x);
		for (const child of children) walk(child, depth + 1);
	};
	walk(root, 0);
	return lines.join("\n");
}

/** Mindmap edges share source metadata; only cards are task links. */
export function getMindmapLinkedCards(
	elements: Iterable<CanvasElement>,
	nodeIds: Iterable<string>,
): CanvasElement[] {
	const ids = new Set(nodeIds);
	return Array.from(elements).filter(
		(el) =>
			el.customData?.skedraType === "kanban-card" &&
			typeof el.customData.mindmapSourceId === "string" &&
			ids.has(el.customData.mindmapSourceId),
	);
}
