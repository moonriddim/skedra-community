import { getMindmapNodeThemeOptions } from "@/lib/canvas/canvas-factory-defaults";
import { useI18n } from "@/lib/i18n";
import { useThemeStore } from "@/stores/theme";
import {
	type CanvasElement,
	MINDMAP_HORIZONTAL_GAP,
	MINDMAP_NODE_HEIGHT,
	MINDMAP_NODE_WIDTH,
	MINDMAP_VERTICAL_GAP,
	type MindmapDirection,
	type Viewport,
	buildMindmapSyncUpdates,
	collectMindmapDescendantIds,
	createMindmapEdge,
	createMindmapNode,
	createStackIndexAfter,
	createStackIndexBeforeElement,
	getMindmapBranchColorForNewNode,
	getMindmapEdgeMeta,
	getMindmapNodeMeta,
} from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
	MindmapChildOptions,
	MindmapSiblingOptions,
} from "../canvas-commands";
import type { CanvasStore, CanvasSync } from "../canvas-tool-types";

interface UseMindmapCanvasToolOptions {
	sync: CanvasSync;
	store: CanvasStore;
	viewport: Viewport;
	selectedMindmapNode: CanvasElement | null;
	textEditorOpen: boolean;
	presentationMode: boolean;
}

interface MindmapButtonModel {
	key: string;
	left: number;
	top: number;
	title: string;
	onClick: () => void;
}

function isHorizontalMindmapDirection(direction: MindmapDirection) {
	return direction === "left" || direction === "right";
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

export function useMindmapCanvasTool({
	sync,
	store,
	viewport,
	selectedMindmapNode,
	textEditorOpen,
	presentationMode,
}: UseMindmapCanvasToolOptions) {
	const { t } = useI18n();
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
	const hoverLeaveTimeoutRef = useRef<number | null>(null);
	const [hoveredMindmapNodeId, setHoveredMindmapNodeId] = useState<
		string | null
	>(null);
	const [hoveredMindmapButtonId, setHoveredMindmapButtonId] = useState<
		string | null
	>(null);

	const activeMindmapNodeId =
		hoveredMindmapButtonId ??
		hoveredMindmapNodeId ??
		selectedMindmapNode?.id ??
		null;
	const activeMindmapNode = activeMindmapNodeId
		? (sync.elements.get(activeMindmapNodeId) ?? null)
		: null;
	const activeMindmapMeta = getMindmapNodeMeta(activeMindmapNode);

	useEffect(() => {
		const orphanEdgeIds: string[] = [];
		for (const element of sync.elements.values()) {
			const edgeMeta = getMindmapEdgeMeta(element);
			if (!edgeMeta) continue;
			if (
				!sync.elements.has(edgeMeta.mindmapSourceId) ||
				!sync.elements.has(edgeMeta.mindmapTargetId)
			) {
				orphanEdgeIds.push(element.id);
			}
		}
		if (orphanEdgeIds.length > 0) {
			sync.deleteElements(orphanEdgeIds);
			return;
		}

		const mindmapUpdates = buildMindmapSyncUpdates(sync.elements);
		if (mindmapUpdates.length > 0) {
			sync.updateElements(mindmapUpdates);
		}
	}, [sync.elements, sync.deleteElements, sync.updateElements]);

	const focusMindmapNode = useCallback(
		(id: string) => {
			store.setSelectedIds(new Set([id]));
			store.setEditingTextId(id);
		},
		[store],
	);

	const selectMindmapNode = useCallback(
		(id: string) => {
			store.setEditingTextId(null);
			store.setSelectedIds(new Set([id]));
		},
		[store],
	);

	const clearMindmapHoverLeaveTimeout = useCallback(() => {
		if (hoverLeaveTimeoutRef.current == null) return;
		window.clearTimeout(hoverLeaveTimeoutRef.current);
		hoverLeaveTimeoutRef.current = null;
	}, []);

	const scheduleMindmapHoverClear = useCallback(() => {
		clearMindmapHoverLeaveTimeout();
		hoverLeaveTimeoutRef.current = window.setTimeout(() => {
			setHoveredMindmapNodeId(null);
			setHoveredMindmapButtonId(null);
			hoverLeaveTimeoutRef.current = null;
		}, 120);
	}, [clearMindmapHoverLeaveTimeout]);

	const createMindmapChild = useCallback(
		(parentId: string, options?: MindmapChildOptions) => {
			const parent = sync.elements.get(parentId);
			const parentMeta = getMindmapNodeMeta(parent);
			if (!parent || !parentMeta) return;

			const position = options?.position ?? "after";
			const resolveRootDirection = () => {
				if (options?.direction) return options.direction;
				const leftChildren = sync.scene.getMindmapChildNodes(parent.id, "left");
				const rightChildren = sync.scene.getMindmapChildNodes(
					parent.id,
					"right",
				);
				if (leftChildren.length === rightChildren.length) {
					return position === "before" ? "left" : "right";
				}
				return leftChildren.length < rightChildren.length ? "left" : "right";
			};
			const direction =
				parentMeta.mindmapDepth === 0
					? resolveRootDirection()
					: (options?.direction ?? parentMeta.mindmapDirection);
			const children = sync.scene.getMindmapChildNodes(parent.id, direction);
			const isHorizontalDirection = isHorizontalMindmapDirection(direction);
			let nextX = parent.x;
			let nextY = parent.y;
			if (isHorizontalDirection) {
				if (children.length > 0) {
					if (position === "before") {
						nextY = children[0].y;
						const shiftIds = new Set<string>();
						for (const child of children) {
							for (const descendantId of collectMindmapDescendantIds(
								child.id,
								sync.elements,
							)) {
								shiftIds.add(descendantId);
							}
						}
						if (shiftIds.size > 0) {
							sync.updateElements(
								Array.from(shiftIds).map((id) => {
									const element = sync.elements.get(id);
									return {
										id,
										changes: { y: (element?.y ?? 0) + MINDMAP_VERTICAL_GAP },
									};
								}),
							);
						}
					} else {
						nextY = resolveAlternatingChildAxisPosition(
							parent,
							children,
							sync.elements,
							direction,
						);
					}
				}
				nextX =
					direction === "right"
						? parent.x + parent.width + MINDMAP_HORIZONTAL_GAP
						: parent.x - MINDMAP_HORIZONTAL_GAP - MINDMAP_NODE_WIDTH;
			} else {
				nextX = parent.x + parent.width / 2 - MINDMAP_NODE_WIDTH / 2;
				if (children.length > 0) {
					if (position === "before") {
						nextX = children[0].x;
						const shiftIds = new Set<string>();
						for (const child of children) {
							for (const descendantId of collectMindmapDescendantIds(
								child.id,
								sync.elements,
							)) {
								shiftIds.add(descendantId);
							}
						}
						if (shiftIds.size > 0) {
							sync.updateElements(
								Array.from(shiftIds).map((id) => {
									const element = sync.elements.get(id);
									return {
										id,
										changes: { x: (element?.x ?? 0) + MINDMAP_HORIZONTAL_GAP },
									};
								}),
							);
						}
					} else {
						nextX = resolveAlternatingChildAxisPosition(
							parent,
							children,
							sync.elements,
							direction,
						);
					}
				}
				nextY =
					direction === "down"
						? parent.y + parent.height + MINDMAP_VERTICAL_GAP
						: parent.y - MINDMAP_VERTICAL_GAP - MINDMAP_NODE_HEIGHT;
			}
			const branchColor = getMindmapBranchColorForNewNode(
				parent,
				sync.elements,
			);
			const nextNodeId = nanoid();
			const edgeId = nanoid();
			const nextStackIndex = createStackIndexAfter(
				sync.elements.values(),
				nextNodeId,
			);
			const nextNode = createMindmapNode({
				id: nextNodeId,
				x: nextX,
				y: nextY,
				text: t("canvas.mindmap.newChild"),
				treeId: parentMeta.mindmapTreeId,
				parentId: parent.id,
				direction,
				depth: parentMeta.mindmapDepth + 1,
				stroke: branchColor,
				stackIndex: nextStackIndex,
				...getMindmapNodeThemeOptions({ resolvedTheme }),
			});
			sync.createElement(nextNode);
			sync.createElement(
				createMindmapEdge({
					id: edgeId,
					treeId: parentMeta.mindmapTreeId,
					source: parent,
					target: nextNode,
					stroke: branchColor,
					stackIndex: createStackIndexBeforeElement(
						[...sync.elements.values(), nextNode],
						nextNode.id,
						edgeId,
					),
				}),
			);
			if (options?.preserveParentSelection) {
				selectMindmapNode(parent.id);
				return;
			}
			if (options?.startEditing === false) {
				selectMindmapNode(nextNode.id);
				return;
			}
			focusMindmapNode(nextNode.id);
		},
		[focusMindmapNode, resolvedTheme, selectMindmapNode, sync, t],
	);

	const createMindmapSibling = useCallback(
		(nodeId: string, options?: MindmapSiblingOptions) => {
			const current = sync.elements.get(nodeId);
			const currentMeta = getMindmapNodeMeta(current);
			if (!current || !currentMeta) return;
			if (currentMeta.mindmapParentId == null) {
				createMindmapChild(nodeId, {
					direction: options?.position === "before" ? "left" : "right",
					preserveParentSelection: options?.preserveAnchorSelection,
					startEditing: options?.startEditing,
				});
				return;
			}

			const position = options?.position ?? "after";

			const siblings = sync.scene.getMindmapChildNodes(
				currentMeta.mindmapParentId,
				currentMeta.mindmapDirection,
			);
			const shiftIds = new Set<string>();
			const isHorizontalDirection = isHorizontalMindmapDirection(
				currentMeta.mindmapDirection,
			);

			let insertX = current.x;
			let insertY = current.y;
			if (isHorizontalDirection) {
				if (position === "before") {
					for (const sibling of siblings) {
						if (sibling.y < current.y) continue;
						for (const descendantId of collectMindmapDescendantIds(
							sibling.id,
							sync.elements,
						)) {
							shiftIds.add(descendantId);
						}
					}
				} else {
					const subtreeIds = collectMindmapDescendantIds(nodeId, sync.elements);
					let subtreeBottom = current.y + current.height;
					for (const id of subtreeIds) {
						const descendant = sync.elements.get(id);
						if (!descendant) continue;
						subtreeBottom = Math.max(
							subtreeBottom,
							descendant.y + descendant.height,
						);
					}
					insertY = subtreeBottom + 32;
					for (const sibling of siblings) {
						if (sibling.id === current.id || sibling.y < insertY) continue;
						for (const descendantId of collectMindmapDescendantIds(
							sibling.id,
							sync.elements,
						)) {
							shiftIds.add(descendantId);
						}
					}
				}
			} else {
				if (position === "before") {
					for (const sibling of siblings) {
						if (sibling.x < current.x) continue;
						for (const descendantId of collectMindmapDescendantIds(
							sibling.id,
							sync.elements,
						)) {
							shiftIds.add(descendantId);
						}
					}
				} else {
					const subtreeIds = collectMindmapDescendantIds(nodeId, sync.elements);
					let subtreeRight = current.x + current.width;
					for (const id of subtreeIds) {
						const descendant = sync.elements.get(id);
						if (!descendant) continue;
						subtreeRight = Math.max(
							subtreeRight,
							descendant.x + descendant.width,
						);
					}
					insertX = subtreeRight + 32;
					for (const sibling of siblings) {
						if (sibling.id === current.id || sibling.x < insertX) continue;
						for (const descendantId of collectMindmapDescendantIds(
							sibling.id,
							sync.elements,
						)) {
							shiftIds.add(descendantId);
						}
					}
				}
			}

			if (shiftIds.size > 0) {
				sync.updateElements(
					Array.from(shiftIds).map((id) => {
						const element = sync.elements.get(id);
						return {
							id,
							changes: isHorizontalDirection
								? { y: (element?.y ?? 0) + MINDMAP_VERTICAL_GAP }
								: { x: (element?.x ?? 0) + MINDMAP_HORIZONTAL_GAP },
						};
					}),
				);
			}

			const parent = sync.elements.get(currentMeta.mindmapParentId);
			if (!parent) return;
			const branchColor = getMindmapBranchColorForNewNode(
				parent,
				sync.elements,
			);
			const nextNodeId = nanoid();
			const edgeId = nanoid();
			const nextStackIndex = createStackIndexAfter(
				sync.elements.values(),
				nextNodeId,
			);
			const nextNode = createMindmapNode({
				id: nextNodeId,
				x: isHorizontalDirection ? current.x : insertX,
				y: insertY,
				text: t("canvas.mindmap.newSibling"),
				treeId: currentMeta.mindmapTreeId,
				parentId: currentMeta.mindmapParentId,
				direction: currentMeta.mindmapDirection,
				depth: currentMeta.mindmapDepth,
				stroke: branchColor,
				stackIndex: nextStackIndex,
				...getMindmapNodeThemeOptions({ resolvedTheme }),
			});
			sync.createElement(nextNode);
			sync.createElement(
				createMindmapEdge({
					id: edgeId,
					treeId: currentMeta.mindmapTreeId,
					source: parent,
					target: nextNode,
					stroke: branchColor,
					stackIndex: createStackIndexBeforeElement(
						[...sync.elements.values(), nextNode],
						nextNode.id,
						edgeId,
					),
				}),
			);
			if (options?.preserveAnchorSelection) {
				selectMindmapNode(nodeId);
				return;
			}
			if (options?.startEditing === false) {
				selectMindmapNode(nextNode.id);
				return;
			}
			focusMindmapNode(nextNode.id);
		},
		[
			createMindmapChild,
			focusMindmapNode,
			resolvedTheme,
			selectMindmapNode,
			sync,
			t,
		],
	);

	useEffect(() => {
		return () => clearMindmapHoverLeaveTimeout();
	}, [clearMindmapHoverLeaveTimeout]);

	const activeMindmapCenterX = activeMindmapNode
		? viewport.x +
			(activeMindmapNode.x + activeMindmapNode.width / 2) * viewport.zoom
		: 0;
	const activeMindmapCenterY = activeMindmapNode
		? viewport.y +
			(activeMindmapNode.y + activeMindmapNode.height / 2) * viewport.zoom
		: 0;
	const activeMindmapLeftX = activeMindmapNode
		? viewport.x + activeMindmapNode.x * viewport.zoom
		: 0;
	const activeMindmapRightX = activeMindmapNode
		? viewport.x +
			(activeMindmapNode.x + activeMindmapNode.width) * viewport.zoom
		: 0;
	const activeMindmapTopY = activeMindmapNode
		? viewport.y + activeMindmapNode.y * viewport.zoom
		: 0;
	const activeMindmapBottomY = activeMindmapNode
		? viewport.y +
			(activeMindmapNode.y + activeMindmapNode.height) * viewport.zoom
		: 0;

	const mindmapButtons: MindmapButtonModel[] =
		!presentationMode &&
		!sync.isReadonly &&
		activeMindmapNode &&
		!textEditorOpen &&
		activeMindmapMeta
			? (() => {
					const directions: MindmapDirection[] =
						activeMindmapMeta.mindmapDepth === 0
							? ["left", "right", "up", "down"]
							: isHorizontalMindmapDirection(activeMindmapMeta.mindmapDirection)
								? [activeMindmapMeta.mindmapDirection, "up", "down"]
								: [activeMindmapMeta.mindmapDirection, "left", "right"];
					return directions.map((direction) => ({
						key: `mindmap-${direction}`,
						left:
							direction === "left"
								? activeMindmapLeftX
								: direction === "right"
									? activeMindmapRightX
									: activeMindmapCenterX,
						top:
							direction === "up"
								? activeMindmapTopY
								: direction === "down"
									? activeMindmapBottomY
									: activeMindmapCenterY,
						title:
							direction === "left"
								? t("canvas.flowchart.attachLeft")
								: direction === "right"
									? t("canvas.flowchart.attachRight")
									: direction === "up"
										? t("canvas.flowchart.attachTop")
										: t("canvas.flowchart.attachBottom"),
						onClick: () =>
							createMindmapChild(activeMindmapNode.id, {
								direction,
								preserveParentSelection: true,
								startEditing: false,
							}),
					}));
				})()
			: [];

	return {
		activeMindmapNode,
		createMindmapChild,
		createMindmapSibling,
		mindmapButtons,
		clearMindmapHoverLeaveTimeout,
		scheduleMindmapHoverClear,
		setHoveredMindmapNodeId,
		setHoveredMindmapButtonId,
	};
}
