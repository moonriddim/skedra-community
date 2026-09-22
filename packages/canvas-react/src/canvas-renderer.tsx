/**
 * SVG-Renderer fuer alle Canvas-Element-Typen.
 * Rendert jedes CanvasElement als entsprechendes SVG-Primitive.
 */

import {
	type CanvasScene,
	type Viewport,
	buildLineCrossingGaps,
	getBBox,
	getVisibleCanvasBounds,
} from "@skedra/canvas-core";
import { memo, useId, useMemo } from "react";
import { ElementShape } from "./element-shape";
import {
	type CanvasRendererConfig,
	CanvasRendererProvider,
} from "./renderer-config";

export interface CanvasRendererProps {
	scene: CanvasScene;
	selectedIds: Set<string>;
	editingTextId?: string | null;
	editingPyramidSection?: number | null;
	/** Optional: nur sichtbare Elemente rendern (Viewport-Culling) */
	viewport?: Viewport | null;
	svgSize?: { width: number; height: number } | null;
	resolveAssetUrl?: (src: string) => string;
	config?: CanvasRendererConfig;
}

export const CanvasRenderer = memo(function CanvasRenderer({
	scene,
	selectedIds,
	editingTextId = null,
	editingPyramidSection,
	viewport = null,
	svgSize = null,
	resolveAssetUrl,
	config,
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

	const maskPrefix = useId();
	const crossingGaps = useMemo(() => buildLineCrossingGaps(sorted), [sorted]);
	return (
		<CanvasRendererProvider config={config}>
			<g className="elements-layer">
				{sorted.map((el) => {
					const gaps = crossingGaps.get(el.id);
					const bounds = getBBox(el);
					const padding = Math.max(
						100,
						el.strokeWidth * 10,
						(el.fontSize ?? 16) * 4,
					);
					const maskId = `${maskPrefix}-gap-${el.id}`;
					return (
						<g key={el.id}>
							{gaps && (
								<defs>
									<mask
										id={maskId}
										maskUnits="userSpaceOnUse"
										x={bounds.x - padding}
										y={bounds.y - padding}
										width={bounds.width + padding * 2}
										height={bounds.height + padding * 2}
										style={{ maskType: "luminance" }}
									>
										<rect
											x={bounds.x - padding}
											y={bounds.y - padding}
											width={bounds.width + padding * 2}
											height={bounds.height + padding * 2}
											fill="white"
										/>
										{gaps.map((gap) => (
											<circle
												key={`${gap.x},${gap.y}`}
												cx={gap.x}
												cy={gap.y}
												r={gap.radius}
												fill="black"
											/>
										))}
									</mask>
								</defs>
							)}
							<g mask={gaps ? `url(#${maskId})` : undefined}>
								<ElementShape
									key={el.id}
									element={el}
									isEditingText={editingTextId === el.id}
									editingPyramidSection={editingPyramidSection}
									resolveAssetUrl={resolveAssetUrl}
								/>
							</g>
						</g>
					);
				})}
			</g>
		</CanvasRendererProvider>
	);
});
