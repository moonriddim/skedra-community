/**
 * Geometrie-Groesse und Preset-Platzierung im Eigenschaften-Panel.
 */

import type { CanvasElement, ToolType } from "@skedra/canvas-core";
import { useCallback } from "react";
import type { PropertiesPanelStoreSlice } from "./use-properties-panel";

interface UsePropertiesPanelGeometryOptions {
	store: Pick<
		PropertiesPanelStoreSlice,
		| "shapePresetHeight"
		| "shapePresetWidth"
		| "setActiveTool"
		| "setShapePlacementDraft"
		| "setShapePresetSize"
	>;
	singleGeometryElement: CanvasElement | null;
	geometryPresetTool: Extract<
		ToolType,
		"rectangle" | "ellipse" | "diamond"
	> | null;
	onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
}

export function usePropertiesPanelGeometry({
	store,
	singleGeometryElement,
	geometryPresetTool,
	onUpdateElement,
}: UsePropertiesPanelGeometryOptions) {
	const updateSingleGeometrySize = useCallback(
		(width: number, height: number) => {
			const nextWidth = Math.max(1, Math.round(width));
			const nextHeight = Math.max(1, Math.round(height));

			if (!singleGeometryElement) {
				if (geometryPresetTool) {
					store.setShapePresetSize(nextWidth, nextHeight);
				}
				return;
			}

			const centerX = singleGeometryElement.x + singleGeometryElement.width / 2;
			const centerY =
				singleGeometryElement.y + singleGeometryElement.height / 2;

			onUpdateElement(singleGeometryElement.id, {
				x: centerX - nextWidth / 2,
				y: centerY - nextHeight / 2,
				width: nextWidth,
				height: nextHeight,
			});
		},
		[geometryPresetTool, onUpdateElement, singleGeometryElement, store],
	);

	const startPresetGeometryPlacement = useCallback(() => {
		if (!geometryPresetTool) return;
		const width = Math.max(1, Math.round(store.shapePresetWidth));
		const height = Math.max(1, Math.round(store.shapePresetHeight));
		store.setActiveTool(geometryPresetTool);
		store.setShapePlacementDraft({
			type: geometryPresetTool,
			width,
			height,
		});
	}, [geometryPresetTool, store]);

	const setSingleGeometryWidth = useCallback(
		(value: number) => {
			if (!singleGeometryElement) return;
			updateSingleGeometrySize(value, singleGeometryElement.height);
		},
		[singleGeometryElement, updateSingleGeometrySize],
	);

	const setSingleGeometryHeight = useCallback(
		(value: number) => {
			if (!singleGeometryElement) return;
			updateSingleGeometrySize(singleGeometryElement.width, value);
		},
		[singleGeometryElement, updateSingleGeometrySize],
	);

	const setPerfectCircleDiameter = useCallback(
		(value: number) => {
			updateSingleGeometrySize(value, value);
		},
		[updateSingleGeometrySize],
	);

	const currentShapeWidth = singleGeometryElement
		? Math.round(singleGeometryElement.width)
		: geometryPresetTool
			? store.shapePresetWidth
			: 0;

	const currentShapeHeight = singleGeometryElement
		? Math.round(singleGeometryElement.height)
		: geometryPresetTool
			? store.shapePresetHeight
			: 0;

	const ellipseDiameter =
		singleGeometryElement?.type === "ellipse" ||
		geometryPresetTool === "ellipse"
			? Math.round(Math.max(currentShapeWidth, currentShapeHeight))
			: 0;

	return {
		currentShapeWidth,
		currentShapeHeight,
		ellipseDiameter,
		setSingleGeometryWidth,
		setSingleGeometryHeight,
		setPerfectCircleDiameter,
		startPresetGeometryPlacement,
	};
}
