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
import {
	CanvasEditorGridOverlay,
	CanvasEditorImageCropOverlay,
	CanvasEditorSelectionGestureOverlay,
	CanvasEditorSelectionOverlay,
	CanvasEditorSnapOverlay,
	CanvasEditorSurface,
	CanvasPathStartSnapIndicator,
} from "@skedra/canvas-editor";
import type { RefObject } from "react";
import { useLayoutEffect, useMemo, useState } from "react";
import { useCanvasCommands } from "./canvas-commands";
import { CanvasRenderer } from "./canvas-renderer";
import { LaserOverlay } from "./laser-overlay";
import { RemoteSelectionOverlays } from "./presence-overlays";
import { SavedViewOverlay } from "./saved-view-overlay";

interface CanvasStageProps {
	svgRef: RefObject<SVGSVGElement | null>;
	activeTool: ToolType;
	viewport: Viewport;
	scene: CanvasScene;
	elements: Map<string, CanvasElement>;
	selectedIds: Set<string>;
	readOnly?: boolean;
	gridEnabled: boolean;
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
	onLostPointerCapture: () => void;
	onWheel: (event: React.WheelEvent<SVGSVGElement>) => void;
	onPointerLeave: () => void;
	onDoubleClick: (event: React.MouseEvent<SVGSVGElement>) => void;
	onElementResizeStart: (
		event: React.PointerEvent<SVGRectElement>,
		element: CanvasElement,
		handle: HandlePosition,
	) => void;
	onPathPointDragStart: (
		event: React.PointerEvent<SVGCircleElement>,
		element: CanvasElement,
		pointIndex: number,
	) => void;
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
	readOnly = false,
	gridEnabled,
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
	onLostPointerCapture,
	onWheel,
	onPointerLeave,
	onDoubleClick,
	onElementResizeStart,
	onPathPointDragStart,
	onViewMoveStart,
	onViewResizeStart,
}: CanvasStageProps) {
	const canvasCommands = useCanvasCommands();
	const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
	const previewScene = useMemo(
		() => (drawingPreview ? CanvasScene.from([drawingPreview]) : null),
		[drawingPreview],
	);
	const selectedElements = useMemo(
		() =>
			Array.from(selectedIds)
				.map((id) => elements.get(id))
				.filter((element): element is CanvasElement => Boolean(element)),
		[elements, selectedIds],
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

	return (
		<CanvasEditorSurface
			svgRef={svgRef}
			viewport={viewport}
			activeTool={activeTool}
			worldDataAttribute="true"
			className="h-full w-full"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerCancel}
			onLostPointerCapture={onLostPointerCapture}
			onWheel={onWheel}
			onPointerLeave={onPointerLeave}
			onDoubleClick={onDoubleClick}
		>
			<CanvasEditorGridOverlay enabled={gridEnabled} zoom={viewport.zoom} />
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
				<CanvasEditorSelectionOverlay
					selected={selectedElements}
					zoom={viewport.zoom}
					readOnly={readOnly}
					onResizeStart={onElementResizeStart}
					onPathPointDragStart={onPathPointDragStart}
					onInsertPathPoint={(element, pointIndex, point) =>
						canvasCommands.insertWaypoint(element.id, pointIndex, point)
					}
				/>
			)}

			<CanvasEditorSelectionGestureOverlay
				selectionRect={
					selectionBox
						? {
								x: Math.min(selectionBox.startX, selectionBox.endX),
								y: Math.min(selectionBox.startY, selectionBox.endY),
								width: Math.abs(selectionBox.endX - selectionBox.startX),
								height: Math.abs(selectionBox.endY - selectionBox.startY),
							}
						: null
				}
				lassoPath={lassoPath}
				zoom={viewport.zoom}
			/>

			{viewDraft && (
				<rect
					data-ui-only="true"
					data-skedra-ui="saved-view-draft"
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
				<g data-ui-only="true" data-skedra-ui="drawing-preview">
					<CanvasRenderer
						scene={previewScene}
						selectedIds={new Set()}
						resolveAssetUrl={resolveAssetUrl}
					/>
				</g>
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
				<CanvasEditorImageCropOverlay
					element={croppingElement}
					viewport={viewport}
					onApply={onApplyImageCrop}
					onCancel={onCancelImageCrop}
				/>
			)}

			<CanvasEditorSnapOverlay
				guides={snapGuides}
				points={snapPointIndicators}
				zoom={viewport.zoom}
			/>
		</CanvasEditorSurface>
	);
}
