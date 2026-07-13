import { Plus } from "lucide-react";
import type { CanvasElement, Viewport } from "./types.js";

export interface SdkMindmapActionsProps {
	element: CanvasElement;
	viewport: Viewport;
	onInsertChild: (
		parentId: string,
		options?: { direction?: "left" | "right" | "up" | "down"; text?: string },
	) => CanvasElement | null;
}

export function SdkMindmapActions({
	element,
	viewport,
	onInsertChild,
}: SdkMindmapActionsProps) {
	const directions = ["left", "right", "up", "down"] as const;
	const points = directions.map((direction) => ({
		direction,
		x:
			direction === "left"
				? element.x
				: direction === "right"
					? element.x + element.width
					: element.x + element.width / 2,
		y:
			direction === "up"
				? element.y
				: direction === "down"
					? element.y + element.height
					: element.y + element.height / 2,
	}));
	return (
		<g data-skedra-ui="mindmap-actions">
			{points.map((point) => (
				<g
					key={`${element.id}-${point.direction}`}
					transform={`translate(${point.x}, ${point.y}) scale(${1 / viewport.zoom})`}
				>
					<foreignObject x={-10} y={-10} width={20} height={20}>
						<button
							type="button"
							className="skedra-sdk__mindmap-action"
							aria-label={`Add mindmap node ${point.direction}`}
							onPointerDown={(event) => event.stopPropagation()}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onInsertChild(element.id, { direction: point.direction });
							}}
						>
							<Plus size={13} strokeWidth={2.2} />
						</button>
					</foreignObject>
				</g>
			))}
		</g>
	);
}
