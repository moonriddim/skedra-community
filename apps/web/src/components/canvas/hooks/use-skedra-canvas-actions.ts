/**
 * Canvas-Aktionen fuer Tastatur, Kontextmenue und Command-Palette.
 */

import type { CanvasStoreState } from "@/hooks/use-canvas-store";
import { CANVAS_DEFAULT_FONT } from "@/lib/canvas/canvas-defaults";
import type { ImageUploadOptions } from "@/lib/canvas/image-utils";
import { pickAndBuildImageElements } from "@/lib/canvas/insert-image";
import { useThemeStore } from "@/stores/theme";
import {
	type FlowchartDirection,
	type ImageCropRect,
	buildCroppedImageUpdate,
	createStackIndexAfter,
	getFlowchartRouteForDirection,
	isFlowchartNode,
	navigateFlowchartInDirection,
} from "@skedra/canvas-core";
import { DEFAULT_FONT_SIZE } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import type { CanvasScene } from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import { useCallback } from "react";
import type { AddFlowchartStepOptions } from "../canvas-commands";

type CanvasSyncApi = {
	elements: Map<string, CanvasElement>;
	scene: CanvasScene;
	createElement: (element: CanvasElement) => void;
	updateElement: (id: string, updates: Partial<CanvasElement>) => void;
	clearCanvas?: () => void;
};

interface UseSkedraCanvasActionsOptions {
	svgRef: React.RefObject<SVGSVGElement | null>;
	sync: CanvasSyncApi;
	store: CanvasStoreState;
	localMode: boolean;
	localClearCanvas?: () => void;
	onRequestClearCanvas?: () => void;
	imageUploadOptions?: ImageUploadOptions;
	deleteElementsWithKanbanReflow: (ids: string[]) => void;
	fitViewportToBounds: (
		bounds: { x: number; y: number; width: number; height: number },
		padding?: number,
	) => void;
	addFlowchartStep: (nodeId: string, options?: AddFlowchartStepOptions) => void;
}

export function useSkedraCanvasActions({
	svgRef,
	sync,
	store,
	localMode,
	localClearCanvas,
	onRequestClearCanvas,
	imageUploadOptions,
	deleteElementsWithKanbanReflow,
	fitViewportToBounds,
	addFlowchartStep,
}: UseSkedraCanvasActionsOptions) {
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
	const screenToCanvas = useCallback(
		(screenX: number, screenY: number): { x: number; y: number } => {
			const rect = svgRef.current?.getBoundingClientRect();
			if (!rect) return { x: screenX, y: screenY };
			return {
				x: (screenX - rect.left - store.viewport.x) / store.viewport.zoom,
				y: (screenY - rect.top - store.viewport.y) / store.viewport.zoom,
			};
		},
		[store.viewport, svgRef],
	);

	const getViewportCenter = useCallback(() => {
		const rect = svgRef.current?.getBoundingClientRect();
		if (!rect) return { x: 400, y: 300 };
		return screenToCanvas(
			rect.left + rect.width / 2,
			rect.top + rect.height / 2,
		);
	}, [screenToCanvas, svgRef]);

	const fitSelectionViewport = useCallback(() => {
		const selected = sync.scene.getSelectedElements(store.selectedIds);
		if (selected.length === 0) return;
		const bounds = sync.scene.getCombinedBBox(selected);
		if (bounds) fitViewportToBounds(bounds, 80);
	}, [fitViewportToBounds, store.selectedIds, sync.scene]);

	const handleInsertImage = useCallback(async () => {
		const elementsToAdd = await pickAndBuildImageElements(
			getViewportCenter(),
			{ resolvedTheme },
			imageUploadOptions,
		);
		if (elementsToAdd.length === 0) return;
		for (const el of elementsToAdd) sync.createElement(el);
		store.setSelectedIds(new Set([elementsToAdd[0].id]));
	}, [getViewportCenter, imageUploadOptions, resolvedTheme, store, sync]);

	const handlePastePlainText = useCallback(
		(text: string) => {
			const center = getViewportCenter();
			const id = nanoid();
			sync.createElement({
				id,
				type: "text",
				x: center.x - 120,
				y: center.y - 20,
				width: 240,
				height: 40,
				rotation: 0,
				fill: "transparent",
				stroke: store.strokeColor,
				strokeWidth: 1,
				strokeStyle: "solid",
				opacity: 100,
				locked: false,
				groupId: null,
				stackIndex: createStackIndexAfter(sync.elements.values(), id),
				flipX: false,
				flipY: false,
				text,
				textColor: store.strokeColor,
				fontSize: DEFAULT_FONT_SIZE,
				fontFamily: CANVAS_DEFAULT_FONT,
				textAlign: "left",
				fontWeight: "normal",
				fontStyle: "normal",
				textDecoration: "none",
			});
			store.setSelectedIds(new Set([id]));
			store.setEditingTextId(id);
		},
		[getViewportCenter, store, sync],
	);

	const handleToggleTheme = useCallback(() => {
		const { resolvedTheme, setTheme } = useThemeStore.getState();
		setTheme(resolvedTheme === "dark" ? "light" : "dark");
	}, []);

	const handleRequestClearCanvas = useCallback(() => {
		if (onRequestClearCanvas) {
			onRequestClearCanvas();
			return;
		}
		if (localMode) {
			localClearCanvas?.();
		} else {
			const ids = Array.from(sync.elements.keys());
			if (ids.length > 0) deleteElementsWithKanbanReflow(ids);
		}
		store.clearSelection();
		store.setCanvasBg("");
	}, [
		deleteElementsWithKanbanReflow,
		localClearCanvas,
		localMode,
		onRequestClearCanvas,
		store,
		sync.elements,
	]);

	const handleStartImageCrop = useCallback(() => {
		const id = Array.from(store.selectedIds)[0];
		if (!id) return;
		if (sync.elements.get(id)?.type === "image") store.setCroppingImageId(id);
	}, [store, sync.elements]);

	const handleFlowchartCreateStep = useCallback(
		(direction: FlowchartDirection) => {
			const id = Array.from(store.selectedIds)[0];
			if (!id) return;
			const node = sync.elements.get(id);
			if (!node || !isFlowchartNode(node)) return;
			const branch =
				direction === "down" ? "no" : direction === "right" ? "yes" : "next";
			addFlowchartStep(id, {
				branch,
				route: getFlowchartRouteForDirection(direction),
			});
		},
		[addFlowchartStep, store.selectedIds, sync.elements],
	);

	const handleFlowchartNavigate = useCallback(
		(direction: FlowchartDirection) => {
			const id = Array.from(store.selectedIds)[0];
			if (!id) return;
			const target = navigateFlowchartInDirection(id, direction, sync.elements);
			if (target) store.setSelectedIds(new Set([target.id]));
		},
		[store, sync.elements],
	);

	const handleApplyImageCrop = useCallback(
		(crop: ImageCropRect) => {
			const id = store.croppingImageId;
			if (!id) return;
			const element = sync.elements.get(id);
			if (!element) return;
			sync.updateElement(id, buildCroppedImageUpdate(element, crop));
			store.setCroppingImageId(null);
		},
		[store, sync.elements, sync.updateElement],
	);

	return {
		screenToCanvas,
		getViewportCenter,
		fitSelectionViewport,
		handleInsertImage,
		handlePastePlainText,
		handleToggleTheme,
		handleRequestClearCanvas,
		handleStartImageCrop,
		handleFlowchartCreateStep,
		handleFlowchartNavigate,
		handleApplyImageCrop,
	};
}
