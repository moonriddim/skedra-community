import { CanvasScene, getCanvasPreviewBounds } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { CanvasRenderer } from "@skedra/canvas-react";
import { Presentation } from "lucide-react";
import { useMemo } from "react";

interface WhiteboardCardPreviewProps {
	boardId: string;
	elements: Map<string, CanvasElement>;
	canvasBg: string;
	emptyLabel: string;
}

export function WhiteboardCardPreview({
	boardId,
	elements,
	canvasBg,
	emptyLabel,
}: WhiteboardCardPreviewProps) {
	const scene = useMemo(() => CanvasScene.from(elements), [elements]);
	const bounds = useMemo(
		() => getCanvasPreviewBounds(elements.values()),
		[elements],
	);
	const hasContent = elements.size > 0;
	const background = canvasBg || "var(--background)";
	const rendererConfig = useMemo(
		() => ({
			interactive: false,
			svgIdPrefix: `board-preview-${boardId}`,
		}),
		[boardId],
	);

	return (
		<div
			className="relative h-48 overflow-hidden rounded-[22px] border border-border/70"
			style={{ backgroundColor: background }}
		>
			{hasContent ? (
				<svg
					className="h-full w-full"
					viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
					preserveAspectRatio="xMidYMid meet"
					aria-label="Board preview"
				>
					<title>Board preview</title>
					<rect
						x={bounds.minX}
						y={bounds.minY}
						width={bounds.width}
						height={bounds.height}
						style={{ fill: background }}
					/>
					<CanvasRenderer
						scene={scene}
						selectedIds={new Set()}
						config={rendererConfig}
					/>
				</svg>
			) : (
				<div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
					<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card/70 shadow-sm">
						<Presentation className="h-5 w-5" />
					</div>
					<p className="text-sm font-medium">{emptyLabel}</p>
				</div>
			)}
		</div>
	);
}
