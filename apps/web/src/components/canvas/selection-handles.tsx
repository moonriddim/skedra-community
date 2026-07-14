/** Shared point handles for paths and bounding-box handles for other elements. */

import { useCanvasStore } from "@/hooks/use-canvas-store";
import {
	type CanvasElement,
	type HandlePosition,
	getBBox,
	getCombinedBBox,
	getHandlePosition,
	isCanvasPointPathElement,
} from "@skedra/canvas-core";
import { CanvasPathPointHandles } from "@skedra/canvas-editor";
import { memo } from "react";
import { useCanvasCommands } from "./canvas-commands";

interface SelectionHandlesProps {
	elements: Map<string, CanvasElement>;
	selectedIds: Set<string>;
	zoom: number;
}

const HANDLE_SIZE = 8;
const HANDLES: HandlePosition[] = ["nw", "n", "ne", "w", "e", "sw", "s", "se"];

const cursorMap: Record<HandlePosition, string> = {
	nw: "nwse-resize",
	n: "ns-resize",
	ne: "nesw-resize",
	w: "ew-resize",
	e: "ew-resize",
	sw: "nesw-resize",
	s: "ns-resize",
	se: "nwse-resize",
};

export const SelectionHandles = memo(function SelectionHandles({
	elements,
	selectedIds,
	zoom,
}: SelectionHandlesProps) {
	const setActiveHandle = useCanvasStore((state) => state.setActiveHandle);
	const setActivePointIndex = useCanvasStore(
		(state) => state.setActivePointIndex,
	);
	const canvasCommands = useCanvasCommands();

	if (selectedIds.size === 0) return null;
	const selectedElements = Array.from(selectedIds)
		.map((id) => elements.get(id))
		.filter(Boolean) as CanvasElement[];
	if (selectedElements.length === 0) return null;

	if (
		selectedElements.length === 1 &&
		isCanvasPointPathElement(selectedElements[0])
	) {
		return (
			<CanvasPathPointHandles
				element={selectedElements[0]}
				zoom={zoom}
				onPointPointerDown={(pointIndex) => setActivePointIndex(pointIndex)}
				onInsertPoint={(pointIndex, point) =>
					canvasCommands.insertWaypoint(
						selectedElements[0].id,
						pointIndex,
						point,
					)
				}
			/>
		);
	}

	const bbox =
		selectedElements.length === 1
			? getBBox(selectedElements[0])
			: getCombinedBBox(selectedElements);
	if (!bbox) return null;

	const handleSize = HANDLE_SIZE / zoom;
	const strokeWidth = 1.5 / zoom;
	return (
		<g className="selection-handles" pointerEvents="none">
			<rect
				x={bbox.x}
				y={bbox.y}
				width={bbox.width}
				height={bbox.height}
				fill="none"
				stroke="rgba(99, 102, 241, 0.8)"
				strokeWidth={strokeWidth}
				strokeDasharray={`${4 / zoom}`}
			/>

			{selectedElements.length === 1 &&
				HANDLES.map((handle) => {
					const position = getHandlePosition(bbox, handle);
					return (
						<rect
							key={handle}
							x={position.x - handleSize / 2}
							y={position.y - handleSize / 2}
							width={handleSize}
							height={handleSize}
							rx={1 / zoom}
							fill="white"
							stroke="rgba(99, 102, 241, 0.8)"
							strokeWidth={strokeWidth}
							pointerEvents="all"
							style={{ cursor: cursorMap[handle] }}
							onPointerDown={() => setActiveHandle(handle)}
						/>
					);
				})}
		</g>
	);
});
