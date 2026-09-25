import type { RemoteCanvasPresence } from "@/hooks/canvas-sync-types";
import { useI18n } from "@/lib/i18n";
import type { BBox } from "@skedra/canvas-core";
import type {
	SnapGuide,
	SnapPointIndicator,
	SnapPointOptions,
} from "@skedra/canvas-core";
import {
	CanvasScene,
	collectMindmapDescendantIds,
	getMindmapNodeMeta,
} from "@skedra/canvas-core";
import { getCanvasSelectionSnapPointIndicators } from "@skedra/canvas-core";
import type {
	CanvasElement,
	CanvasPathStartSnapState,
	CanvasSearchMatch,
	EllipseArcEndpoint,
	HandlePosition,
	KanbanDropTarget,
	LaserTrail,
	SavedCanvasView,
	SelectionBox,
	ToolType,
	Viewport,
} from "@skedra/canvas-core";
import type { ImageCropRect } from "@skedra/canvas-core";
import {
	CanvasEditorEllipseTrimOverlay,
	type CanvasEditorEllipseTrimPreview,
	CanvasEditorEraserTrailOverlay,
	type CanvasEditorEraserTrailPoint,
	CanvasEditorGridOverlay,
	CanvasEditorImageCropOverlay,
	CanvasEditorKanbanDropOverlay,
	CanvasEditorSavedViewDraft,
	CanvasEditorSavedViewOverlay,
	CanvasEditorSelectionGestureOverlay,
	CanvasEditorSelectionOverlay,
	CanvasEditorSnapOverlay,
	CanvasEditorSurface,
	CanvasPathStartSnapIndicator,
} from "@skedra/canvas-editor";
import type { CanvasEditorBeginAuxiliaryPointerGesture } from "@skedra/canvas-editor";
import type { RefObject } from "react";
import { useLayoutEffect, useMemo, useState } from "react";
import { useCanvasCommands } from "./canvas-commands";
import { CanvasRenderer } from "./canvas-renderer";
import { CanvasSearchOverlay } from "./canvas-search-overlay";
import { LaserOverlay } from "./laser-overlay";
import { RemoteSelectionOverlays } from "./presence-overlays";

interface CanvasStageProps {
	svgRef: RefObject<SVGSVGElement | null>;
	activeTool: ToolType;
	viewport: Viewport;
	scene: CanvasScene;
	elements: Map<string, CanvasElement>;
	selectedIds: Set<string>;
	searchMatches?: readonly CanvasSearchMatch[];
	searchActiveIndex?: number | null;
	readOnly?: boolean;
	gridEnabled: boolean;
	gridSize: number;
	editingTextId: string | null;
	editingPyramidSection?: number | null;
	remotePresence: RemoteCanvasPresence[];
	editingView: SavedCanvasView | null;
	textEditorOpen: boolean;
	selectionBox: SelectionBox | null;
	lassoPath: [number, number][] | null;
	viewDraft: BBox | null;
	drawingPreview: CanvasElement | null;
	onExpandMindmap?: (id: string) => void;
	mindmapDropTarget?: { nodeId: string; parentId: string } | null;
	elementPlacementPreview?: CanvasElement[] | null;
	pathStartSnap: CanvasPathStartSnapState | null;
	kanbanDropTarget: KanbanDropTarget | null;
	snapGuides: SnapGuide[];
	snapPointIndicators: SnapPointIndicator[];
	selectedSnapOptions?: SnapPointOptions | null;
	transformOrigin?: { x: number; y: number } | null;
	laserTrails?: LaserTrail[];
	eraserTrail?: readonly CanvasEditorEraserTrailPoint[];
	croppingElement?: CanvasElement | null;
	ellipseTrimPreview?:
		| (CanvasEditorEllipseTrimPreview & {
				instruction: string;
		  })
		| null;
	resolveAssetUrl?: (src: string) => string;
	onApplyImageCrop?: (crop: ImageCropRect) => void;
	onCancelImageCrop?: () => void;
	beginAuxiliaryPointerGesture: CanvasEditorBeginAuxiliaryPointerGesture;
	onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
	onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => void;
	onPointerUp: (event: React.PointerEvent<SVGSVGElement>) => void;
	onPointerCancel: (event: React.PointerEvent<SVGSVGElement>) => void;
	onLostPointerCapture: (event: React.PointerEvent<SVGSVGElement>) => void;
	onWheel: NonNullable<
		React.ComponentProps<typeof CanvasEditorSurface>["onWheel"]
	>;
	onPointerLeave: () => void;
	onDoubleClick: (event: React.MouseEvent<SVGSVGElement>) => void;
	onElementResizeStart: (
		event: React.PointerEvent<SVGRectElement>,
		element: CanvasElement,
		handle: HandlePosition,
	) => void;
	onElementRotateStart: (
		event: React.PointerEvent<SVGCircleElement>,
		elements: readonly CanvasElement[],
		basePoint: { x: number; y: number },
	) => void;
	onElementRotateKeyDown: (
		event: React.KeyboardEvent<SVGCircleElement>,
		elements: readonly CanvasElement[],
		basePoint: { x: number; y: number },
	) => void;
	onPathPointDragStart: (
		event: React.PointerEvent<SVGCircleElement>,
		element: CanvasElement,
		pointIndex: number,
	) => void;
	onEllipseArcEndpointDragStart: (
		event: React.PointerEvent<SVGCircleElement>,
		element: CanvasElement,
		endpoint: EllipseArcEndpoint,
	) => void;
	runPointerUpAction: (
		event: React.PointerEvent<SVGElement>,
		action: () => void,
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
	searchMatches = [],
	searchActiveIndex = null,
	readOnly = false,
	gridEnabled,
	gridSize,
	editingTextId,
	editingPyramidSection,
	remotePresence,
	editingView,
	textEditorOpen,
	selectionBox,
	lassoPath,
	viewDraft,
	drawingPreview,
	elementPlacementPreview,
	mindmapDropTarget,
	onExpandMindmap,
	pathStartSnap,
	kanbanDropTarget,
	snapGuides,
	snapPointIndicators,
	selectedSnapOptions = null,
	transformOrigin = null,
	laserTrails = [],
	eraserTrail = [],
	croppingElement = null,
	ellipseTrimPreview = null,
	resolveAssetUrl,
	onApplyImageCrop,
	onCancelImageCrop,
	beginAuxiliaryPointerGesture,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onPointerCancel,
	onLostPointerCapture,
	onWheel,
	onPointerLeave,
	onDoubleClick,
	onElementResizeStart,
	onElementRotateStart,
	onElementRotateKeyDown,
	onPathPointDragStart,
	onEllipseArcEndpointDragStart,
	runPointerUpAction,
	onViewMoveStart,
	onViewResizeStart,
}: CanvasStageProps) {
	const canvasCommands = useCanvasCommands();
	const { t } = useI18n();
	const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
	const previewScene = useMemo(
		() =>
			elementPlacementPreview
				? CanvasScene.from(elementPlacementPreview)
				: drawingPreview
					? CanvasScene.from([drawingPreview])
					: null,
		[drawingPreview, elementPlacementPreview],
	);
	const selectedElements = useMemo(
		() =>
			Array.from(selectedIds)
				.map((id) => elements.get(id))
				.filter((element): element is CanvasElement => Boolean(element)),
		[elements, selectedIds],
	);
	const visibleSnapPointIndicators = useMemo(() => {
		return getCanvasSelectionSnapPointIndicators(
			selectedElements,
			selectedSnapOptions,
			snapPointIndicators,
		);
	}, [selectedElements, selectedSnapOptions, snapPointIndicators]);

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
			<CanvasEditorGridOverlay
				enabled={gridEnabled}
				zoom={viewport.zoom}
				gridSize={gridSize}
			/>
			<CanvasRenderer
				scene={scene}
				selectedIds={selectedIds}
				editingTextId={editingTextId}
				editingPyramidSection={editingPyramidSection}
				viewport={viewport}
				svgSize={svgSize}
				resolveAssetUrl={resolveAssetUrl}
			/>
			{ellipseTrimPreview && (
				<CanvasEditorEllipseTrimOverlay
					preview={ellipseTrimPreview}
					zoom={viewport.zoom}
					instruction={ellipseTrimPreview.instruction}
				/>
			)}
			<CanvasSearchOverlay
				matches={searchMatches}
				activeIndex={searchActiveIndex}
				elements={elements}
				zoom={viewport.zoom}
			/>
			<RemoteSelectionOverlays
				peers={remotePresence}
				elements={elements}
				zoom={viewport.zoom}
			/>
			{editingView && !textEditorOpen && (
				<CanvasEditorSavedViewOverlay
					view={editingView}
					zoom={viewport.zoom}
					onMoveStart={onViewMoveStart}
					onResizeStart={onViewResizeStart}
				/>
			)}
			{!textEditorOpen && !croppingElement && !ellipseTrimPreview && (
				<CanvasEditorSelectionOverlay
					selected={selectedElements}
					zoom={viewport.zoom}
					readOnly={readOnly}
					transformOrigin={transformOrigin}
					onResizeStart={onElementResizeStart}
					onRotateStart={onElementRotateStart}
					onRotateKeyDown={onElementRotateKeyDown}
					onPathPointDragStart={onPathPointDragStart}
					onEllipseArcEndpointDragStart={onEllipseArcEndpointDragStart}
					onInsertPathPoint={(element, pointIndex, point, event) =>
						runPointerUpAction(event, () =>
							canvasCommands.insertWaypoint(element.id, pointIndex, point),
						)
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
				<CanvasEditorSavedViewDraft bounds={viewDraft} zoom={viewport.zoom} />
			)}

			{scene
				.getDisplayElements()
				.filter(
					(el) => getMindmapNodeMeta(el) && el.customData?.mindmapCollapsed,
				)
				.map((node) => {
					const count = collectMindmapDescendantIds(node.id, elements).size - 1;
					if (!count) return null;
					return (
						<foreignObject
							key={`collapsed-${node.id}`}
							x={node.x + node.width - 14 / viewport.zoom}
							y={node.y + node.height + 5 / viewport.zoom}
							width={52 / viewport.zoom}
							height={28 / viewport.zoom}
							data-ui-only="true"
						>
							<button
								type="button"
								disabled={readOnly}
								style={{
									fontSize: 12 / viewport.zoom,
									height: 24 / viewport.zoom,
									paddingInline: 6 / viewport.zoom,
									borderRadius: 12 / viewport.zoom,
								}}
								className="border border-border bg-background text-foreground shadow-sm"
								aria-label={t("mindmapStudio.hidden", { count })}
								onPointerDown={(event) => event.stopPropagation()}
								onClick={(event) => {
									event.stopPropagation();
									onExpandMindmap?.(node.id);
								}}
							>
								+{count}
							</button>
						</foreignObject>
					);
				})}
			{mindmapDropTarget &&
				(() => {
					const parent = scene.getElement(mindmapDropTarget.parentId);
					const node = scene.getElement(mindmapDropTarget.nodeId);
					if (!parent || !node) return null;
					return (
						<g
							pointerEvents="none"
							data-ui-only="true"
							stroke="#6366f1"
							strokeWidth={2 / viewport.zoom}
						>
							<rect
								x={parent.x - 6 / viewport.zoom}
								y={parent.y - 6 / viewport.zoom}
								width={parent.width + 12 / viewport.zoom}
								height={parent.height + 12 / viewport.zoom}
								rx={10}
								fill="#6366f1"
								fillOpacity={0.12}
							/>
							<path
								d={`M ${parent.x + parent.width / 2} ${parent.y + parent.height / 2} L ${node.x + node.width / 2} ${node.y + node.height / 2}`}
								strokeDasharray={`${6 / viewport.zoom} ${4 / viewport.zoom}`}
							/>
						</g>
					);
				})()}
			{previewScene && (
				<g
					data-ui-only="true"
					data-skedra-ui="drawing-preview"
					pointerEvents="none"
					opacity={elementPlacementPreview ? 0.65 : 1}
				>
					<CanvasRenderer
						scene={previewScene}
						config={{ interactive: false }}
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

			<CanvasEditorEraserTrailOverlay
				points={eraserTrail}
				zoom={viewport.zoom}
			/>
			<LaserOverlay trails={laserTrails} viewport={viewport} />

			{croppingElement && onApplyImageCrop && onCancelImageCrop && (
				<CanvasEditorImageCropOverlay
					element={croppingElement}
					viewport={viewport}
					onApply={onApplyImageCrop}
					onCancel={onCancelImageCrop}
					beginAuxiliaryPointerGesture={beginAuxiliaryPointerGesture}
				/>
			)}

			<CanvasEditorSnapOverlay
				guides={snapGuides}
				points={visibleSnapPointIndicators}
				zoom={viewport.zoom}
				origin={transformOrigin}
			/>
			<CanvasEditorKanbanDropOverlay
				target={kanbanDropTarget}
				zoom={viewport.zoom}
			/>
		</CanvasEditorSurface>
	);
}
