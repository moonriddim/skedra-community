import {
	type CanvasElement,
	type HandlePosition,
	getBBox,
	getCombinedBBox,
	getHandlePosition,
	isCanvasPointPathElement,
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
	classes,
	onResizeStart,
	onResizeKeyDown,
	onPathPointDragStart,
	onInsertPathPoint,
	pathBackground,
	pathAccent,
	pathControlLine,
}: CanvasEditorSelectionOverlayProps) {
	const services = useOptionalCanvasEditorServices();
	if (selected.length === 0) return null;
	const single = selected.length === 1 ? selected[0] : null;

	if (
		!readOnly &&
		single &&
		!single.locked &&
		isCanvasPointPathElement(single)
	) {
		return (
			<g
				className={classes?.group ?? "selection-handles"}
				data-ui-only="true"
				data-skedra-ui="selection"
			>
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
			</g>
		);
	}

	const bbox = single ? getBBox(single) : getCombinedBBox([...selected]);
	if (!bbox) return null;
	const size = handleSize / zoom;
	const strokeWidth = 1.5 / zoom;
	return (
		<g
			className={classes?.group ?? "selection-handles"}
			pointerEvents="none"
			data-ui-only="true"
			data-skedra-ui="selection"
		>
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

			{!readOnly &&
				single &&
				!single.locked &&
				HANDLES.map((handle) => {
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
								onPointerDown={(event) => onResizeStart(event, single, handle)}
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
								onPointerDown={(event) => onResizeStart(event, single, handle)}
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
	);
}
