import { bytesToBase64 } from "@/lib/e2ee";
import { trpc } from "@/lib/trpc";
import { type CanvasScene, getCanvasPreviewBounds } from "@skedra/canvas-core";
import { exportSkedraPng } from "@skedra/canvas-io/exporters";
import { CanvasRenderer } from "@skedra/canvas-react";
import {
	type MutableRefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from "react";

export type PublishPresentationPreview = () => Promise<void>;

/** Publish the actual renderer output, independently of editor zoom or culling. */
export function PresentationPreviewPublisher({
	whiteboardId,
	scene,
	canvasBg,
	resolveAssetUrl,
	publishRef,
}: {
	whiteboardId: string;
	scene: CanvasScene;
	canvasBg: string;
	resolveAssetUrl: (src: string) => string;
	publishRef?: MutableRefObject<PublishPresentationPreview | null>;
}) {
	const svgRef = useRef<SVGSVGElement>(null);
	const inFlightRef = useRef<Promise<void> | null>(null);
	const mutation = trpc.whiteboard.updatePresentationPreview.useMutation();
	const mutateRef = useRef(mutation.mutateAsync);
	mutateRef.current = mutation.mutateAsync;
	const lastPngRef = useRef("");
	const bounds = useMemo(
		() => getCanvasPreviewBounds(scene.getDisplayElements()),
		[scene],
	);
	const scale = Math.min(1120 / bounds.width, 550 / bounds.height);
	const translateX = (1200 - bounds.width * scale) / 2 - bounds.minX * scale;
	const translateY = (630 - bounds.height * scale) / 2 - bounds.minY * scale;
	const publish = useCallback(() => {
		if (inFlightRef.current) return inFlightRef.current;
		const svg = svgRef.current;
		if (!svg) return Promise.resolve();
		inFlightRef.current = (async () => {
			await document.fonts.ready;
			const theme = getComputedStyle(svg);
			for (const key of [
				"background",
				"foreground",
				"card",
				"card-foreground",
				"muted",
				"muted-foreground",
				"border",
				"primary",
				"primary-foreground",
				"accent",
				"accent-foreground",
				"destructive",
			]) {
				svg.style.setProperty(`--${key}`, theme.getPropertyValue(`--${key}`));
			}
			const background =
				canvasBg || theme.getPropertyValue("--background").trim() || "#ffffff";
			const png = await exportSkedraPng(svg, {
				bounds: { x: 0, y: 0, width: 1200, height: 630 },
				padding: 0,
				scale: 1,
				background,
			});
			if (png.size > 4_000_000) throw new Error("Board preview is too large");
			const base64 = bytesToBase64(new Uint8Array(await png.arrayBuffer()));
			if (base64 === lastPngRef.current) return;
			await mutateRef.current({ id: whiteboardId, png: base64 });
			lastPngRef.current = base64;
		})().finally(() => {
			inFlightRef.current = null;
		});
		return inFlightRef.current;
	}, [canvasBg, whiteboardId]);

	useEffect(() => {
		if (!publishRef) return;
		publishRef.current = publish;
		return () => {
			publishRef.current = null;
		};
	}, [publish, publishRef]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: The SVG contents change with the scene and resolved image URLs.
	useEffect(() => {
		const timer = window.setTimeout(() => {
			void publish().catch(() => undefined);
		}, 2000);
		return () => window.clearTimeout(timer);
	}, [publish, scene, resolveAssetUrl]);

	return (
		<div
			aria-hidden="true"
			style={{
				position: "absolute",
				width: 0,
				height: 0,
				overflow: "hidden",
				pointerEvents: "none",
			}}
		>
			<svg ref={svgRef} width="1200" height="630" viewBox="0 0 1200 630">
				<title>Board preview</title>
				<g transform={`translate(${translateX} ${translateY}) scale(${scale})`}>
					<CanvasRenderer
						scene={scene}
						selectedIds={new Set()}
						resolveAssetUrl={resolveAssetUrl}
						config={{ interactive: false, svgIdPrefix: "share-preview" }}
					/>
				</g>
			</svg>
		</div>
	);
}
