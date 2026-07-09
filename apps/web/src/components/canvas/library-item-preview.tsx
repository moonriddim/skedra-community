/**
 * Mini-Vorschau eines Bibliotheks-Items (SVG, viewBox aus Element-BBox).
 */

import { CanvasRenderer } from "@/components/canvas/canvas-renderer";
import { cn } from "@/lib/utils";
import { CanvasScene, getCombinedBBox } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { useMemo } from "react";

interface LibraryItemPreviewProps {
	elements: CanvasElement[];
	className?: string;
}

export function LibraryItemPreview({
	elements,
	className,
}: LibraryItemPreviewProps) {
	const { scene, viewBox } = useMemo(() => {
		const bbox = getCombinedBBox(elements);
		const padding = 10;
		const vb = bbox
			? `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`
			: "0 0 48 48";
		return { scene: CanvasScene.from(elements), viewBox: vb };
	}, [elements]);

	if (elements.length === 0) {
		return (
			<div
				className={cn(
					"aspect-square w-full rounded-md border border-dashed border-border/50 bg-muted/20",
					className,
				)}
			/>
		);
	}

	return (
		<div
			className={cn(
				"flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-border/50 bg-[#252525] p-1 dark:bg-[#1a1a1a]",
				className,
			)}
		>
			<svg
				viewBox={viewBox}
				className="h-full w-full max-h-full max-w-full"
				preserveAspectRatio="xMidYMid meet"
				aria-hidden
			>
				<title>Library item preview</title>
				<CanvasRenderer scene={scene} selectedIds={new Set()} />
			</svg>
		</div>
	);
}
