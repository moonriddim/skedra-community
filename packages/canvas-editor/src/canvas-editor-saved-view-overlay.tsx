import { getHandlePosition } from "@skedra/canvas-core";
import type { HandlePosition, SavedCanvasView } from "@skedra/canvas-core";

export interface CanvasEditorSavedViewOverlayProps {
	view: SavedCanvasView;
	zoom: number;
	onMoveStart: (event: React.PointerEvent<SVGRectElement>) => void;
	onResizeStart: (
		handle: HandlePosition,
		event: React.PointerEvent<SVGRectElement>,
	) => void;
}

const HANDLES: HandlePosition[] = ["nw", "n", "ne", "w", "e", "sw", "s", "se"];

const CURSOR_MAP: Record<HandlePosition, string> = {
	nw: "nwse-resize",
	n: "ns-resize",
	ne: "nesw-resize",
	w: "ew-resize",
	e: "ew-resize",
	sw: "nesw-resize",
	s: "ns-resize",
	se: "nwse-resize",
};

export function CanvasEditorSavedViewOverlay({
	view,
	zoom,
	onMoveStart,
	onResizeStart,
}: CanvasEditorSavedViewOverlayProps) {
	const bounds = {
		x: view.x,
		y: view.y,
		width: view.width,
		height: view.height,
	};
	const handleSize = 10 / zoom;
	const strokeWidth = 1.5 / zoom;
	const labelHeight = 24 / zoom;

	return (
		<g
			className="canvas-editor__saved-view-overlay"
			data-ui-only="true"
			data-skedra-ui="saved-view"
			pointerEvents="none"
		>
			<rect
				x={bounds.x}
				y={bounds.y}
				width={bounds.width}
				height={bounds.height}
				fill="rgba(20, 184, 166, 0.08)"
				stroke="rgba(20, 184, 166, 0.95)"
				strokeWidth={strokeWidth}
				strokeDasharray={`${6 / zoom}`}
				pointerEvents="all"
				style={{ cursor: "move" }}
				onPointerDown={onMoveStart}
			/>
			<rect
				x={bounds.x}
				y={bounds.y - labelHeight - 8 / zoom}
				width={Math.max(bounds.width, 140 / zoom)}
				height={labelHeight}
				rx={8 / zoom}
				fill="rgba(15, 23, 42, 0.92)"
				stroke="rgba(20, 184, 166, 0.7)"
				strokeWidth={strokeWidth}
			/>
			<text
				x={bounds.x + 10 / zoom}
				y={bounds.y - 8 / zoom - labelHeight / 2}
				fill="white"
				fontSize={12 / zoom}
				dominantBaseline="middle"
			>
				{view.name}
			</text>
			{HANDLES.map((handle) => {
				const position = getHandlePosition(bounds, handle);
				return (
					<g key={handle}>
						<rect
							className="canvas-editor__coarse-pointer-target"
							x={position.x - handleSize / 2}
							y={position.y - handleSize / 2}
							width={handleSize}
							height={handleSize}
							fill="none"
							stroke="transparent"
							onPointerDown={(event) => onResizeStart(handle, event)}
						/>
						<rect
							x={position.x - handleSize / 2}
							y={position.y - handleSize / 2}
							width={handleSize}
							height={handleSize}
							rx={2 / zoom}
							fill="white"
							stroke="rgba(20, 184, 166, 0.95)"
							strokeWidth={strokeWidth}
							pointerEvents="all"
							style={{ cursor: CURSOR_MAP[handle] }}
							onPointerDown={(event) => onResizeStart(handle, event)}
						/>
					</g>
				);
			})}
		</g>
	);
}
