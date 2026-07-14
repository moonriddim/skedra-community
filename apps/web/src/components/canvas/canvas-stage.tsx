import type { RemoteCanvasPresence } from "@/hooks/canvas-sync-types";
import type { BBox } from "@skedra/canvas-core";
import type { SnapGuide, SnapPointIndicator } from "@skedra/canvas-core";
import { CanvasScene } from "@skedra/canvas-core";
import type {
	CanvasElement,
	CanvasPathStartSnapState,
	HandlePosition,
	LaserTrail,
	SavedCanvasView,
	SelectionBox,
	ToolType,
	Viewport,
} from "@skedra/canvas-core";
import type { ImageCropRect } from "@skedra/canvas-core";
import { lassoPathToSvgD } from "@skedra/canvas-core";
import { CanvasPathStartSnapIndicator } from "@skedra/canvas-editor";
import type { RefObject } from "react";
import { useLayoutEffect, useMemo, useState } from "react";
import { CanvasRenderer } from "./canvas-renderer";
import { GridOverlay } from "./grid-overlay";
import { ImageCropOverlay } from "./image-crop-overlay";
import { LaserOverlay } from "./laser-overlay";
import { RemoteSelectionOverlays } from "./presence-overlays";
import { SavedViewOverlay } from "./saved-view-overlay";
import { SelectionHandles } from "./selection-handles";

interface CanvasStageProps {
	svgRef: RefObject<SVGSVGElement | null>;
	activeTool: ToolType;
	viewport: Viewport;
	scene: CanvasScene;
	elements: Map<string, CanvasElement>;
	selectedIds: Set<string>;
	editingTextId: string | null;
	remotePresence: RemoteCanvasPresence[];
	editingView: SavedCanvasView | null;
	textEditorOpen: boolean;
	selectionBox: SelectionBox | null;
	lassoPath: [number, number][] | null;
	viewDraft: BBox | null;
	drawingPreview: CanvasElement | null;
	pathStartSnap: CanvasPathStartSnapState | null;
	snapGuides: SnapGuide[];
	snapPointIndicators: SnapPointIndicator[];
	laserTrails?: LaserTrail[];
	croppingElement?: CanvasElement | null;
	resolveAssetUrl?: (src: string) => string;
	onApplyImageCrop?: (crop: ImageCropRect) => void;
	onCancelImageCrop?: () => void;
	onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
	onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => void;
	onPointerUp: (event: React.PointerEvent<SVGSVGElement>) => void;
	onPointerCancel: () => void;
	onPointerLeave: () => void;
	onDoubleClick: (event: React.MouseEvent<SVGSVGElement>) => void;
	onViewMoveStart: (event: React.PointerEvent<SVGRectElement>) => void;
	onViewResizeStart: (
		handle: HandlePosition,
		event: React.PointerEvent<SVGRectElement>,
	) => void;
}

export function CanvasStage({
	svgRef,
	activeTool,
	viewport,
	scene,
	elements,
	selectedIds,
	editingTextId,
	remotePresence,
	editingView,
	textEditorOpen,
	selectionBox,
	lassoPath,
	viewDraft,
	drawingPreview,
	pathStartSnap,
	snapGuides,
	snapPointIndicators,
	laserTrails = [],
	croppingElement = null,
	resolveAssetUrl,
	onApplyImageCrop,
	onCancelImageCrop,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onPointerCancel,
	onPointerLeave,
	onDoubleClick,
	onViewMoveStart,
	onViewResizeStart,
}: CanvasStageProps) {
	const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
	const previewScene = useMemo(
		() => (drawingPreview ? CanvasScene.from([drawingPreview]) : null),
		[drawingPreview],
	);

	useLayoutEffect(() => {
		const svg = svgRef.current;
		if (!svg) return;

		const updateSize = () => {
			setSvgSize({ width: svg.clientWidth, height: svg.clientHeight });
		};

		updateSize();
		const observer = new ResizeObserver(updateSize);
		observer.observe(svg);
		return () => observer.disconnect();
	}, [svgRef]);

	const cursor =
		activeTool === "select"
			? "default"
			: activeTool === "lasso"
				? "crosshair"
				: activeTool === "pan"
					? "grab"
					: activeTool === "eraser"
						? "cell"
						: activeTool === "laser"
							? "crosshair"
							: activeTool === "eyedropper"
								? "copy"
								: "crosshair";

	const lassoPreviewPath = lassoPath ? lassoPathToSvgD(lassoPath) : null;

	return (
		<svg
			ref={svgRef}
			className="h-full w-full"
			style={{
				cursor,
				touchAction: "none",
				backgroundColor: "inherit",
			}}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerCancel}
			onLostPointerCapture={onPointerCancel}
			onPointerLeave={onPointerLeave}
			onDoubleClick={onDoubleClick}
		>
			<title>Skedra canvas</title>
			<g
				transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}
			>
				<GridOverlay zoom={viewport.zoom} />
				<CanvasRenderer
					scene={scene}
					selectedIds={selectedIds}
					editingTextId={editingTextId}
					viewport={viewport}
					svgSize={svgSize}
					resolveAssetUrl={resolveAssetUrl}
				/>
				<RemoteSelectionOverlays
					peers={remotePresence}
					elements={elements}
					zoom={viewport.zoom}
				/>
				{editingView && !textEditorOpen && (
					<SavedViewOverlay
						view={editingView}
						zoom={viewport.zoom}
						onMoveStart={onViewMoveStart}
						onResizeStart={onViewResizeStart}
					/>
				)}
				{!textEditorOpen && !croppingElement && (
					<SelectionHandles
						elements={elements}
						selectedIds={selectedIds}
						zoom={viewport.zoom}
					/>
				)}

				{selectionBox && (
					<rect
						x={Math.min(selectionBox.startX, selectionBox.endX)}
						y={Math.min(selectionBox.startY, selectionBox.endY)}
						width={Math.abs(selectionBox.endX - selectionBox.startX)}
						height={Math.abs(selectionBox.endY - selectionBox.startY)}
						fill="rgba(99, 102, 241, 0.1)"
						stroke="rgba(99, 102, 241, 0.6)"
						strokeWidth={1 / viewport.zoom}
						strokeDasharray={`${4 / viewport.zoom}`}
					/>
				)}

				{lassoPreviewPath && (
					<path
						d={lassoPreviewPath}
						fill="rgba(99, 102, 241, 0.1)"
						stroke="rgba(99, 102, 241, 0.6)"
						strokeWidth={1 / viewport.zoom}
						strokeDasharray={`${4 / viewport.zoom}`}
						data-ui-only
					/>
				)}

				{viewDraft && (
					<rect
						x={viewDraft.x}
						y={viewDraft.y}
						width={viewDraft.width}
						height={viewDraft.height}
						fill="rgba(16, 185, 129, 0.12)"
						stroke="rgba(16, 185, 129, 0.9)"
						strokeWidth={1.5 / viewport.zoom}
						strokeDasharray={`${5 / viewport.zoom}`}
					/>
				)}

				{previewScene && (
					<CanvasRenderer
						scene={previewScene}
						selectedIds={new Set()}
						resolveAssetUrl={resolveAssetUrl}
					/>
				)}

				<CanvasPathStartSnapIndicator
					snap={pathStartSnap}
					zoom={viewport.zoom}
					activeFill="rgba(16, 185, 129, 0.95)"
					inactiveFill="rgba(99, 102, 241, 0.92)"
					stroke="rgba(255, 255, 255, 0.9)"
				/>

				<LaserOverlay trails={laserTrails} viewport={viewport} />

				{croppingElement && onApplyImageCrop && onCancelImageCrop && (
					<ImageCropOverlay
						element={croppingElement}
						viewport={viewport}
						onApply={onApplyImageCrop}
						onCancel={onCancelImageCrop}
					/>
				)}

				{snapGuides.map((guide, index) => (
					<line
						// biome-ignore lint/suspicious/noArrayIndexKey: Snap guides are ordered transient render slots whose coordinates must not define their identity.
						key={`snap-guide-${index}`}
						x1={guide.orientation === "v" ? guide.pos : guide.from}
						y1={guide.orientation === "h" ? guide.pos : guide.from}
						x2={guide.orientation === "v" ? guide.pos : guide.to}
						y2={guide.orientation === "h" ? guide.pos : guide.to}
						stroke="rgba(99, 102, 241, 0.8)"
						strokeWidth={1 / viewport.zoom}
						strokeDasharray={`${3 / viewport.zoom}`}
						pointerEvents="none"
					/>
				))}

				{snapPointIndicators.map((point, index) => {
					const size = (point.active ? 10 : 7) / viewport.zoom;
					const strokeWidth = 1.5 / viewport.zoom;
					const isRoundPoint =
						point.kind === "center" ||
						point.kind === "edge-midpoint" ||
						point.kind === "segment-midpoint";

					return (
						<g
							// biome-ignore lint/suspicious/noArrayIndexKey: Snap points use stable transient slots so moving coordinates do not remount SVG nodes.
							key={`snap-point-${index}`}
							pointerEvents="none"
						>
							{isRoundPoint ? (
								<circle
									cx={point.x}
									cy={point.y}
									r={size / 2}
									fill={
										point.active
											? "rgba(16, 185, 129, 0.95)"
											: "rgba(99, 102, 241, 0.92)"
									}
									stroke="rgba(255, 255, 255, 0.9)"
									strokeWidth={strokeWidth}
								/>
							) : (
								<rect
									x={point.x - size / 2}
									y={point.y - size / 2}
									width={size}
									height={size}
									rx={1.5 / viewport.zoom}
									fill={
										point.active
											? "rgba(16, 185, 129, 0.95)"
											: "rgba(99, 102, 241, 0.92)"
									}
									stroke="rgba(255, 255, 255, 0.9)"
									strokeWidth={strokeWidth}
								/>
							)}
						</g>
					);
				})}
			</g>
		</svg>
	);
}
