import { type BBox, lassoPathToSvgD } from "@skedra/canvas-core";

export interface CanvasEditorSelectionGestureOverlayProps {
	selectionRect?: BBox | null;
	lassoPath?: readonly [number, number][] | null;
	zoom: number;
	selectionClassName?: string;
	lassoClassName?: string;
	fill?: string;
	stroke?: string;
}

/** Shared transient marquee and lasso visualization. */
export function CanvasEditorSelectionGestureOverlay({
	selectionRect,
	lassoPath,
	zoom,
	selectionClassName,
	lassoClassName,
	fill = "rgba(99, 102, 241, 0.1)",
	stroke = "rgba(99, 102, 241, 0.6)",
}: CanvasEditorSelectionGestureOverlayProps) {
	const lassoD = lassoPath ? lassoPathToSvgD([...lassoPath]) : null;
	return (
		<>
			{selectionRect && (
				<rect
					className={selectionClassName}
					x={selectionRect.x}
					y={selectionRect.y}
					width={selectionRect.width}
					height={selectionRect.height}
					fill={fill}
					stroke={stroke}
					strokeWidth={1 / zoom}
					strokeDasharray={`${4 / zoom}`}
					data-ui-only="true"
					data-skedra-ui="selection-marquee"
				/>
			)}
			{lassoD && (
				<path
					className={lassoClassName}
					d={lassoD}
					fill={fill}
					stroke={stroke}
					strokeWidth={1.5 / zoom}
					strokeDasharray={`${4 / zoom}`}
					data-ui-only="true"
					data-skedra-ui="selection-lasso"
				/>
			)}
		</>
	);
}
