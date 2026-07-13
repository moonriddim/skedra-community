import { getMindmapNodeThemeOptions } from "@/lib/canvas/canvas-factory-defaults";
import { useI18n } from "@/lib/i18n";
import { useThemeStore } from "@/stores/theme";
import {
	type CanvasElement,
	type MindmapDirection,
	type Viewport,
	executeCanvasMutationPlan,
	getMindmapNodeMeta,
	isHorizontalMindmapDirection,
	planCanvasNormalization,
	planMindmapChildMutation,
	planMindmapSiblingMutation,
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
		executeCanvasMutationPlan(planCanvasNormalization(sync.elements), sync);
	}, [sync]);

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
			const plan = planMindmapChildMutation({
				parentId,
				elements: sync.elements,
				direction: options?.direction,
				position: options?.position,
				text: t("canvas.mindmap.newChild"),
				createId: nanoid,
				appearance: getMindmapNodeThemeOptions({ resolvedTheme }),
				preserveParentSelection: options?.preserveParentSelection,
				startEditing: options?.startEditing,
			});
			if (!plan) return;
			executeCanvasMutationPlan(plan, {
				...sync,
				setSelectedIds: store.setSelectedIds,
				setEditingTextId: store.setEditingTextId,
			});
		},
		[resolvedTheme, store, sync, t],
	);

	const createMindmapSibling = useCallback(
		(nodeId: string, options?: MindmapSiblingOptions) => {
			const plan = planMindmapSiblingMutation({
				nodeId,
				elements: sync.elements,
				position: options?.position,
				text: t("canvas.mindmap.newSibling"),
				createId: nanoid,
				appearance: getMindmapNodeThemeOptions({ resolvedTheme }),
				preserveAnchorSelection: options?.preserveAnchorSelection,
				startEditing: options?.startEditing,
			});
			if (!plan) return;
			executeCanvasMutationPlan(plan, {
				...sync,
				setSelectedIds: store.setSelectedIds,
				setEditingTextId: store.setEditingTextId,
			});
		},
		[resolvedTheme, store, sync, t],
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
