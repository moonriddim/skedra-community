import { trpc } from "@/lib/trpc";
import { CanvasScene, getCombinedBBox } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { decodeCanvasElements } from "@skedra/canvas-io";
import { CanvasRenderer } from "@skedra/canvas-react";
import { useMemo } from "react";

const EMPTY_SELECTED_IDS = new Set<string>();
const MAX_VISIBLE_ITEMS = 12;
const LOADING_PREVIEW_KEYS = ["one", "two", "three", "four", "five", "six"];

interface LibraryPackagePreviewProps {
	slug: string;
	loadingLabel: string;
	unavailableLabel: string;
	moreLabel: (count: number) => string;
}

export function LibraryPackagePreview({
	slug,
	loadingLabel,
	unavailableLabel,
	moreLabel,
}: LibraryPackagePreviewProps) {
	const { data, isLoading, isError } =
		trpc.shapeLibrary.getPublicPreview.useQuery(
			{ slug },
			{ staleTime: 5 * 60 * 1000 },
		);

	const previewItems = useMemo(
		() =>
			(data?.items ?? [])
				.slice(0, MAX_VISIBLE_ITEMS)
				.map((item) => ({
					id: item.id,
					name: item.name,
					elements: decodeCanvasElements(item.elements),
				}))
				.filter((item) => item.elements.length > 0),
		[data],
	);

	if (isLoading) {
		return (
			<div
				className="mt-3 grid grid-cols-6 gap-1 rounded-xl border border-border/50 bg-background/50 p-2"
				aria-label={loadingLabel}
			>
				{LOADING_PREVIEW_KEYS.map((key) => (
					<div
						key={`${slug}-preview-loading-${key}`}
						className="aspect-square animate-pulse rounded-md bg-muted"
					/>
				))}
			</div>
		);
	}

	if (isError || previewItems.length === 0) {
		return (
			<p className="mt-3 rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
				{unavailableLabel}
			</p>
		);
	}

	const hiddenCount = Math.max(
		0,
		(data?.totalItemCount ?? 0) - previewItems.length,
	);

	return (
		<div className="mt-3 rounded-xl border border-border/50 bg-background/50 p-2">
			<div className="grid grid-cols-6 gap-1.5">
				{previewItems.map((item) => (
					<LibraryItemPreview
						key={item.id}
						id={`${slug}-${item.id}`}
						name={item.name}
						elements={item.elements}
					/>
				))}
			</div>
			{hiddenCount > 0 && (
				<p className="mt-1.5 text-right text-[10px] font-medium text-muted-foreground">
					{moreLabel(hiddenCount)}
				</p>
			)}
		</div>
	);
}

function LibraryItemPreview({
	id,
	name,
	elements,
}: {
	id: string;
	name?: string;
	elements: CanvasElement[];
}) {
	const { scene, viewBox, rendererConfig } = useMemo(() => {
		const bbox = getCombinedBBox(elements);
		const padding = 10;
		return {
			scene: CanvasScene.from(elements),
			viewBox: bbox
				? `${bbox.x - padding} ${bbox.y - padding} ${Math.max(1, bbox.width + padding * 2)} ${Math.max(1, bbox.height + padding * 2)}`
				: "0 0 48 48",
			rendererConfig: {
				interactive: false,
				svgIdPrefix: `catalog-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
			},
		};
	}, [elements, id]);

	return (
		<div
			className="flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-md border border-border/50 bg-[#f7faf8] p-0.5"
			title={name}
		>
			<svg
				viewBox={viewBox}
				className="h-full w-full"
				preserveAspectRatio="xMidYMid meet"
				aria-hidden="true"
			>
				<CanvasRenderer
					scene={scene}
					selectedIds={EMPTY_SELECTED_IDS}
					config={rendererConfig}
				/>
			</svg>
		</div>
	);
}
