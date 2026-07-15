import {
	type CanvasElement,
	type CanvasSearchMatch,
	getBBox,
} from "@skedra/canvas-core";
import { useMemo } from "react";

interface CanvasSearchOverlayProps {
	matches: readonly CanvasSearchMatch[];
	activeIndex: number | null;
	elements: Map<string, CanvasElement>;
	zoom: number;
}

export function CanvasSearchOverlay({
	matches,
	activeIndex,
	elements,
	zoom,
}: CanvasSearchOverlayProps) {
	const highlightedElements = useMemo(() => {
		const byElement = new Map<
			string,
			{ element: CanvasElement; focused: boolean; count: number }
		>();
		matches.forEach((match, index) => {
			const element = elements.get(match.elementId);
			if (!element) return;
			const existing = byElement.get(match.elementId);
			if (existing) {
				existing.count += 1;
				existing.focused ||= index === activeIndex;
			} else {
				byElement.set(match.elementId, {
					element,
					focused: index === activeIndex,
					count: 1,
				});
			}
		});
		return Array.from(byElement.values());
	}, [activeIndex, elements, matches]);

	if (highlightedElements.length === 0) return null;

	return (
		<g
			data-ui-only="true"
			data-skedra-ui="canvas-search-matches"
			pointerEvents="none"
		>
			{highlightedElements.map(({ element, focused, count }) => {
				const bounds = getBBox(element);
				const padding = (focused ? 6 : 3) / zoom;
				const centerX = bounds.x + bounds.width / 2;
				const centerY = bounds.y + bounds.height / 2;
				return (
					<g
						key={element.id}
						transform={
							element.rotation
								? `rotate(${element.rotation} ${centerX} ${centerY})`
								: undefined
						}
					>
						<rect
							x={bounds.x - padding}
							y={bounds.y - padding}
							width={Math.max(bounds.width, 1) + padding * 2}
							height={Math.max(bounds.height, 1) + padding * 2}
							rx={6 / zoom}
							fill={
								focused ? "rgba(250, 204, 21, 0.2)" : "rgba(250, 204, 21, 0.1)"
							}
							stroke={focused ? "#eab308" : "rgba(234, 179, 8, 0.72)"}
							strokeWidth={(focused ? 3 : 1.5) / zoom}
							strokeDasharray={focused ? undefined : `${5 / zoom} ${3 / zoom}`}
						/>
						{focused && count > 1 && (
							<g
								transform={`translate(${bounds.x + bounds.width} ${bounds.y})`}
							>
								<circle r={10 / zoom} fill="#eab308" />
								<text
									x={0}
									y={3.5 / zoom}
									textAnchor="middle"
									fontSize={10 / zoom}
									fontWeight={700}
									fill="#422006"
								>
									{count}
								</text>
							</g>
						)}
					</g>
				);
			})}
		</g>
	);
}
