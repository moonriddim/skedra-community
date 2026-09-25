import type { KanbanDropTarget } from "@skedra/canvas-core";
import { useOptionalCanvasEditorServices } from "./canvas-editor";

export function CanvasEditorKanbanDropOverlay({
	target,
	zoom,
}: {
	target: KanbanDropTarget | null;
	zoom: number;
}) {
	const services = useOptionalCanvasEditorServices();
	if (!target) return null;
	const scale = Math.max(zoom, 0.01);
	return (
		<g
			data-ui-only="true"
			data-skedra-ui="kanban-drop-overlay"
			data-kanban-drop-list={target.listId}
			data-kanban-drop-index={target.index}
			data-kanban-drop-mode={target.mode}
			pointerEvents="none"
		>
			<rect
				{...target.listBounds}
				rx={10}
				fill="none"
				stroke="#14b8a6"
				strokeWidth={2 / scale}
				strokeDasharray={`${6 / scale} ${4 / scale}`}
			/>
			{target.mode === "beside" ? (
				<>
					<rect
						x={target.x}
						y={target.y}
						width={target.width}
						height={target.cardHeight}
						rx={8}
						fill="rgba(20,184,166,0.18)"
						stroke="#2dd4bf"
						strokeWidth={2 / scale}
						strokeDasharray={`${6 / scale} ${4 / scale}`}
					/>
					<text
						x={target.x + target.width / 2}
						y={target.y + 26 / scale}
						textAnchor="middle"
						fill="#2dd4bf"
						fontSize={12 / scale}
						fontFamily="system-ui"
					>
						{services?.translations?.translate(
							"canvas.kanban.insertBeside",
							"Place beside",
						) ?? "Place beside"}
					</text>
				</>
			) : (
				<>
					<line
						x1={target.x}
						y1={target.y}
						x2={target.x + target.width}
						y2={target.y}
						stroke="#0f172a"
						strokeWidth={7 / scale}
						strokeLinecap="round"
					/>
					<line
						x1={target.x}
						y1={target.y}
						x2={target.x + target.width}
						y2={target.y}
						stroke="#2dd4bf"
						strokeWidth={3 / scale}
						strokeLinecap="round"
					/>
					<circle cx={target.x} cy={target.y} r={4 / scale} fill="#2dd4bf" />
					<circle
						cx={target.x + target.width}
						cy={target.y}
						r={4 / scale}
						fill="#2dd4bf"
					/>
				</>
			)}
		</g>
	);
}
