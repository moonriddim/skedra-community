import {
	type CanvasElement,
	getCanvasPathSegmentMidpoints,
	isCanvasPointPathElement,
} from "@skedra/canvas-core";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface CanvasPathPointHandlesProps {
	element: CanvasElement;
	zoom: number;
	onPointPointerDown: (
		pointIndex: number,
		event: ReactPointerEvent<SVGCircleElement>,
	) => void;
	onInsertPoint: (
		pointIndex: number,
		point: [number, number],
		event: ReactPointerEvent<SVGGElement>,
	) => void;
	background?: string;
	accent?: string;
	controlLine?: string;
}

export function CanvasPathPointHandles({
	element,
	zoom,
	onPointPointerDown,
	onInsertPoint,
	background = "var(--background, white)",
	accent = "rgba(99, 102, 241, 0.9)",
	controlLine = "rgba(99, 102, 241, 0.4)",
}: CanvasPathPointHandlesProps) {
	if (!isCanvasPointPathElement(element)) return null;
	const points = element.points;
	const radius = 5 / zoom;
	const insertRadius = 4 / zoom;
	const strokeWidth = 1.5 / zoom;
	const visibleIndices =
		points.length > 10
			? [0, points.length - 1]
			: points.map((_, index) => index);
	const isBezier =
		element.arrowMode === "curve" && points.length === 3 && !element.closed;

	return (
		<g
			className="skedra-path-point-handles"
			pointerEvents="none"
			data-ui-only="true"
			data-skedra-ui="path-handles"
		>
			{isBezier && (
				<>
					<line
						x1={element.x + points[0][0]}
						y1={element.y + points[0][1]}
						x2={element.x + points[1][0]}
						y2={element.y + points[1][1]}
						stroke={controlLine}
						strokeWidth={1.5 / zoom}
						strokeDasharray={`${3 / zoom}`}
					/>
					<line
						x1={element.x + points[1][0]}
						y1={element.y + points[1][1]}
						x2={element.x + points[2][0]}
						y2={element.y + points[2][1]}
						stroke={controlLine}
						strokeWidth={1.5 / zoom}
						strokeDasharray={`${3 / zoom}`}
					/>
				</>
			)}

			{!isBezier && (
				<polyline
					points={[...points, ...(element.closed ? [points[0]] : [])]
						.map(([x, y]) => `${element.x + x},${element.y + y}`)
						.join(" ")}
					fill="none"
					stroke={controlLine}
					strokeWidth={2 / zoom}
					strokeDasharray={`${4 / zoom}`}
				/>
			)}

			{getCanvasPathSegmentMidpoints(element).map((midpoint) => (
				<g
					key={`insert-${midpoint.segmentIndex}`}
					pointerEvents="all"
					style={{ cursor: "copy" }}
					onPointerDown={(event) => {
						event.preventDefault();
						event.stopPropagation();
						onInsertPoint(midpoint.insertIndex, midpoint.point, event);
					}}
				>
					<circle
						className="canvas-editor__coarse-pointer-target"
						cx={element.x + midpoint.point[0]}
						cy={element.y + midpoint.point[1]}
						r={insertRadius}
						fill="none"
						stroke="transparent"
					/>
					<circle
						cx={element.x + midpoint.point[0]}
						cy={element.y + midpoint.point[1]}
						r={insertRadius}
						fill={background}
						stroke={accent}
						strokeWidth={strokeWidth}
					/>
					<line
						x1={element.x + midpoint.point[0] - insertRadius * 0.55}
						y1={element.y + midpoint.point[1]}
						x2={element.x + midpoint.point[0] + insertRadius * 0.55}
						y2={element.y + midpoint.point[1]}
						stroke={accent}
						strokeWidth={strokeWidth}
						strokeLinecap="round"
					/>
					<line
						x1={element.x + midpoint.point[0]}
						y1={element.y + midpoint.point[1] - insertRadius * 0.55}
						x2={element.x + midpoint.point[0]}
						y2={element.y + midpoint.point[1] + insertRadius * 0.55}
						stroke={accent}
						strokeWidth={strokeWidth}
						strokeLinecap="round"
					/>
				</g>
			))}

			{visibleIndices.map((index) => {
				const [x, y] = points[index];
				const isEndpoint = index === 0 || index === points.length - 1;
				return (
					<g key={index}>
						<circle
							className="canvas-editor__coarse-pointer-target"
							cx={element.x + x}
							cy={element.y + y}
							r={radius}
							fill="none"
							stroke="transparent"
							onPointerDown={(event) => onPointPointerDown(index, event)}
						/>
						<circle
							cx={element.x + x}
							cy={element.y + y}
							r={radius}
							fill={isEndpoint ? background : controlLine}
							stroke={accent}
							strokeWidth={strokeWidth}
							pointerEvents="all"
							style={{ cursor: "move" }}
							onPointerDown={(event) => onPointPointerDown(index, event)}
						/>
					</g>
				);
			})}
		</g>
	);
}
