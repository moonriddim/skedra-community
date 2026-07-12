/**
 * SVG-Renderer fuer alle Canvas-Element-Typen.
 * Rendert jedes CanvasElement als entsprechendes SVG-Primitive.
 */

import {
	type CanvasScene,
	type Viewport,
	getVisibleCanvasBounds,
} from "@skedra/canvas-core";
import { memo, useMemo } from "react";
import { ElementShape } from "./canvas-renderer/element-shape";

interface CanvasRendererProps {
	scene: CanvasScene;
	selectedIds: Set<string>;
	editingTextId?: string | null;
	/** Optional: nur sichtbare Elemente rendern (Viewport-Culling) */
	viewport?: Viewport | null;
	svgSize?: { width: number; height: number } | null;
	resolveAssetUrl?: (src: string) => string;
}

export const CanvasRenderer = memo(function CanvasRenderer({
	scene,
	selectedIds,
	editingTextId = null,
	viewport = null,
	svgSize = null,
	resolveAssetUrl,
}: CanvasRendererProps) {
	const sorted = useMemo(() => {
		if (!viewport || !svgSize || svgSize.width <= 0 || svgSize.height <= 0) {
			return scene.getSortedElements();
		}

		const visibleBounds = getVisibleCanvasBounds(
			viewport,
			svgSize.width,
			svgSize.height,
		);
		const visible = scene.getVisibleElements(visibleBounds, selectedIds);
		if (!editingTextId) return visible;

		const editingElement = scene.getElement(editingTextId);
		if (
			!editingElement ||
			visible.some((element) => element.id === editingTextId)
		) {
			return visible;
		}
		const order = new Map(
			scene.getSortedElements().map((element, index) => [element.id, index]),
		);
		return [...visible, editingElement].sort(
			(left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0),
		);
	}, [editingTextId, scene, selectedIds, svgSize, viewport]);

	return (
		<g className="elements-layer">
			{sorted.map((el) => (
				<ElementShape
					key={el.id}
					element={el}
					isEditingText={editingTextId === el.id}
					resolveAssetUrl={resolveAssetUrl}
				/>
			))}
		</g>
	);
});
