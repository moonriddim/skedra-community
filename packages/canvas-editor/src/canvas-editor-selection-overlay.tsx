import {
	type CanvasElement,
	type HandlePosition,
	getCanvasElementCenter,
	getCombinedBBox,
	getGanttCanvasScrollbarThumbMeta,
	getGanttChartId,
	getHandlePosition,
	getSequenceDiagramId,
	getUntransformedBBox,
	isCanvasPointPathElement,
	isGanttChart,
} from "@skedra/canvas-core";
import type {
	KeyboardEvent as ReactKeyboardEvent,
	PointerEvent as ReactPointerEvent,
} from "react";
import { useOptionalCanvasEditorServices } from "./canvas-editor";
import { CanvasPathPointHandles } from "./canvas-path-point-handles";

const HANDLES: readonly HandlePosition[] = [
	"nw",
	"n",
	"ne",
	"w",
	"e",
	"sw",
	"s",
	"se",
];
const TEXT_HANDLES: readonly HandlePosition[] = ["nw", "ne", "sw", "se"];

const CURSORS: Record<HandlePosition, string> = {
	nw: "nwse-resize",
	n: "ns-resize",
	ne: "nesw-resize",
	w: "ew-resize",
	e: "ew-resize",
	sw: "nesw-resize",
	s: "ns-resize",
	se: "nwse-resize",
};

export interface CanvasEditorSelectionOverlayClasses {
	group?: string;
	outline?: string;
	handle?: string;
}

export interface CanvasEditorSelectionOverlayProps {
	selected: readonly CanvasElement[];
	zoom: number;
	readOnly?: boolean;
	outlinePadding?: number;
	handleSize?: number;
	outlineStroke?: string;
	handleFill?: string;
	handleStroke?: string;
	dashedOutline?: boolean;
	/** Optional transform pivot selected through object snap. */
	transformOrigin?: { x: number; y: number } | null;
	classes?: CanvasEditorSelectionOverlayClasses;
	onResizeStart: (
		event: ReactPointerEvent<SVGRectElement>,
		element: CanvasElement,
		handle: HandlePosition,
	) => void;
	onResizeKeyDown?: (
		event: ReactKeyboardEvent<SVGRectElement>,
		element: CanvasElement,
		handle: HandlePosition,
	) => void;
	onRotateStart?: (
		event: ReactPointerEvent<SVGCircleElement>,
		elements: readonly CanvasElement[],
		basePoint: { x: number; y: number },
	) => void;
	onRotateKeyDown?: (
		event: ReactKeyboardEvent<SVGCircleElement>,
		elements: readonly CanvasElement[],
		basePoint: { x: number; y: number },
	) => void;
	onPathPointDragStart: (
		event: ReactPointerEvent<SVGCircleElement>,
		element: CanvasElement,
		pointIndex: number,
	) => void;
	onInsertPathPoint: (
		element: CanvasElement,
		pointIndex: number,
		point: [number, number],
		event: ReactPointerEvent<SVGGElement>,
	) => void;
	pathBackground?: string;
	pathAccent?: string;
	pathControlLine?: string;
}

export function resolveCanvasEditorRotationKeyDelta(
	event: Pick<ReactKeyboardEvent<SVGCircleElement>, "key" | "shiftKey">,
): number | null {
	if (event.key === "ArrowLeft") return event.shiftKey ? -15 : -1;
	if (event.key === "ArrowRight") return event.shiftKey ? 15 : 1;
	return null;
}

/** Shared selected bounds, resize handles and editable path points. */
export function CanvasEditorSelectionOverlay({
	selected,
	zoom,
	readOnly = false,
	outlinePadding = 0,
	handleSize = 8,
	outlineStroke = "rgba(99, 102, 241, 0.8)",
	handleFill = "white",
	handleStroke = "rgba(99, 102, 241, 0.8)",
	dashedOutline = true,
	transformOrigin = null,
	classes,
	onResizeStart,
	onResizeKeyDown,
	onRotateStart,
	onRotateKeyDown,
	onPathPointDragStart,
	onInsertPathPoint,
	pathBackground,
	pathAccent,
	pathControlLine,
}: CanvasEditorSelectionOverlayProps) {
	const services = useOptionalCanvasEditorServices();
	if (selected.length === 0) return null;
	const selectedGanttFrame = selected.find(isGanttChart) ?? null;
	const selectedGanttChartId = getGanttChartId(selectedGanttFrame);
	const isAtomicGanttSelection = Boolean(
		selectedGanttChartId &&
			selected.every(
				(element) =>
					getGanttChartId(element) === selectedGanttChartId ||
					getGanttCanvasScrollbarThumbMeta(element)?.ganttChartId ===
						selectedGanttChartId,
			),
	);
	const selectedSequenceDiagramId = getSequenceDiagramId(selected[0]);
	const isAtomicSequenceSelection = Boolean(
		selectedSequenceDiagramId &&
			selected.every(
				(element) =>
					getSequenceDiagramId(element) === selectedSequenceDiagramId,
			),
	);
	const isAtomicStructuredSelection =
		isAtomicGanttSelection || isAtomicSequenceSelection;
	const single =
		selected.length === 1 && !isAtomicSequenceSelection
			? selected[0]
			: isAtomicGanttSelection
				? selectedGanttFrame
				: null;
	const editingPathPoints = Boolean(
		!readOnly && single && !single.locked && isCanvasPointPathElement(single),
	);
	const usesDirectPathSelection = Boolean(
		single &&
			(single.type === "line" || single.type === "arrow") &&
			isCanvasPointPathElement(single),
	);

	const bbox = single
		? getUntransformedBBox(single)
		: getCombinedBBox([...selected]);
	if (!bbox) return null;
	const size = handleSize / zoom;
	const strokeWidth = 1.5 / zoom;
	const basePoint = single
		? getCanvasElementCenter(single)
		: { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
	const rotationBasePoint = transformOrigin ?? basePoint;
	const transforms: string[] = [];
	if (single?.rotation) {
		transforms.push(`rotate(${single.rotation} ${basePoint.x} ${basePoint.y})`);
	}
	if (single?.flipX || single?.flipY) {
		transforms.push(
			`translate(${basePoint.x}, ${basePoint.y}) scale(${single.flipX ? -1 : 1}, ${single.flipY ? -1 : 1}) translate(${-basePoint.x}, ${-basePoint.y})`,
		);
	}
	const selectionTransform =
		transforms.length > 0 ? transforms.join(" ") : undefined;
	const resizeHandles = single?.type === "text" ? TEXT_HANDLES : HANDLES;
	const rotateHandleY = bbox.y - 28 / zoom;
	const rotateLabel =
		services?.translations?.translate(
			"canvas.accessibility.rotateSelection",
			"Rotate selection (Left/Right Arrow)",
		) ?? "Rotate selection (Left/Right Arrow)";
	return (
		<g
			className={classes?.group ?? "selection-handles"}
			pointerEvents="none"
			data-ui-only="true"
			data-skedra-ui="selection"
		>
			<g transform={selectionTransform}>
				{editingPathPoints && single && (
					<CanvasPathPointHandles
						element={single}
						zoom={zoom}
						background={pathBackground}
						accent={pathAccent}
						controlLine={pathControlLine}
						onPointPointerDown={(pointIndex, event) =>
							onPathPointDragStart(event, single, pointIndex)
						}
						onInsertPoint={(pointIndex, point, event) =>
							onInsertPathPoint(single, pointIndex, point, event)
						}
					/>
				)}
				{!usesDirectPathSelection && (
					<rect
						className={classes?.outline}
						x={bbox.x - outlinePadding / zoom}
						y={bbox.y - outlinePadding / zoom}
						width={bbox.width + (outlinePadding * 2) / zoom}
						height={bbox.height + (outlinePadding * 2) / zoom}
						rx={outlinePadding > 0 ? 3 / zoom : undefined}
						fill="none"
						stroke={outlineStroke}
						strokeWidth={strokeWidth}
						strokeDasharray={dashedOutline ? `${4 / zoom}` : undefined}
					/>
				)}

				{!readOnly &&
					onRotateStart &&
					!usesDirectPathSelection &&
					!isAtomicStructuredSelection &&
					!selected.every((item) => item.locked) && (
						<>
							<line
								x1={basePoint.x}
								y1={bbox.y}
								x2={basePoint.x}
								y2={rotateHandleY}
								stroke={handleStroke}
								strokeWidth={strokeWidth}
							/>
							<circle
								cx={basePoint.x}
								cy={rotateHandleY}
								r={size * 0.6}
								fill={handleFill}
								stroke={handleStroke}
								strokeWidth={strokeWidth}
								pointerEvents="all"
								style={{ cursor: "grab" }}
								role="button"
								aria-label={rotateLabel}
								tabIndex={onRotateKeyDown ? 0 : undefined}
								onPointerDown={(event) => {
									const target = event.currentTarget;
									onRotateStart(event, selected, rotationBasePoint);
									window.setTimeout(() => target.focus(), 0);
								}}
								onKeyDown={
									onRotateKeyDown
										? (event) =>
												onRotateKeyDown(event, selected, rotationBasePoint)
										: undefined
								}
							/>
						</>
					)}

				{!readOnly &&
					single &&
					!single.locked &&
					!editingPathPoints &&
					resizeHandles.map((handle) => {
						const position = getHandlePosition(bbox, handle);
						const label =
							services?.translations?.translate(
								`canvas.accessibility.resize.${handle}`,
								`Resize ${handle}`,
							) ?? `Resize ${handle}`;
						return (
							<g key={handle}>
								<rect
									className="canvas-editor__coarse-pointer-target"
									x={position.x - size / 2}
									y={position.y - size / 2}
									width={size}
									height={size}
									fill="none"
									stroke="transparent"
									onPointerDown={(event) =>
										onResizeStart(event, single, handle)
									}
								/>
								<rect
									className={classes?.handle}
									x={position.x - size / 2}
									y={position.y - size / 2}
									width={size}
									height={size}
									rx={1 / zoom}
									fill={handleFill}
									stroke={handleStroke}
									strokeWidth={strokeWidth}
									pointerEvents="all"
									style={{ cursor: CURSORS[handle] }}
									role="button"
									aria-label={label}
									tabIndex={onResizeKeyDown ? 0 : undefined}
									onPointerDown={(event) =>
										onResizeStart(event, single, handle)
									}
									onKeyDown={
										onResizeKeyDown
											? (event) => onResizeKeyDown(event, single, handle)
											: undefined
									}
								/>
							</g>
						);
					})}
			</g>
		</g>
	);
}
