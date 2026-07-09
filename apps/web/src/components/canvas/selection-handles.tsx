/**
 * Resize-Handles fuer selektierte Elemente.
 * Fuer Formen: 8 quadratische Griffe (Ecken + Kanten) um die BBox.
 * Fuer Linien/Pfeile: Kreisfoermige Griffe an jedem Punkt des Pfads.
 */

import { useCanvasStore } from "@/hooks/use-canvas-store";
import {
	getBBox,
	getCombinedBBox,
	getHandlePosition,
} from "@skedra/canvas-core";
import type { CanvasElement, HandlePosition } from "@skedra/canvas-core";
import { memo } from "react";
import { useCanvasCommands } from "./canvas-commands";

interface SelectionHandlesProps {
	elements: Map<string, CanvasElement>;
	selectedIds: Set<string>;
	zoom: number;
}

const HANDLE_SIZE = 8;
const POINT_RADIUS = 5;
const INSERT_HANDLE_RADIUS = 4;
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

/** Prueft ob ein Element Punkt-basiert bearbeitet wird */
function isPointBasedElement(el: CanvasElement): boolean {
	return (
		(el.type === "line" || el.type === "arrow") &&
		!!el.points &&
		el.points.length >= 2
	);
}

export const SelectionHandles = memo(function SelectionHandles({
	elements,
	selectedIds,
	zoom,
}: SelectionHandlesProps) {
	const setActiveHandle = useCanvasStore((s) => s.setActiveHandle);
	const setActivePointIndex = useCanvasStore((s) => s.setActivePointIndex);

	if (selectedIds.size === 0) return null;

	const selectedEls = Array.from(selectedIds)
		.map((id) => elements.get(id))
		.filter(Boolean) as CanvasElement[];

	if (selectedEls.length === 0) return null;

	/* Einzelne Linie/Pfeil -> Punkt-Handles */
	if (selectedEls.length === 1 && isPointBasedElement(selectedEls[0])) {
		return (
			<PointHandles
				element={selectedEls[0]}
				zoom={zoom}
				setActivePointIndex={setActivePointIndex}
			/>
		);
	}

	/* Standard: BBox-Handles */
	const bbox =
		selectedEls.length === 1
			? getBBox(selectedEls[0])
			: getCombinedBBox(selectedEls);

	if (!bbox) return null;

	const hs = HANDLE_SIZE / zoom;
	const strokeW = 1.5 / zoom;

	return (
		<g className="selection-handles" pointerEvents="none">
			<rect
				x={bbox.x}
				y={bbox.y}
				width={bbox.width}
				height={bbox.height}
				fill="none"
				stroke="rgba(99, 102, 241, 0.8)"
				strokeWidth={strokeW}
				strokeDasharray={`${4 / zoom}`}
				pointerEvents="none"
			/>

			{selectedEls.length === 1 &&
				HANDLES.map((handle) => {
					const pos = getHandlePosition(bbox, handle);
					return (
						<rect
							key={handle}
							x={pos.x - hs / 2}
							y={pos.y - hs / 2}
							width={hs}
							height={hs}
							rx={1 / zoom}
							fill="white"
							stroke="rgba(99, 102, 241, 0.8)"
							strokeWidth={strokeW}
							pointerEvents="all"
							style={{ cursor: cursorMap[handle] }}
							onPointerDown={() => {
								setActiveHandle(handle);
							}}
						/>
					);
				})}
		</g>
	);
});

/**
 * Punkt-basierte Handles fuer Linien und Pfeile.
 * Freehand mit vielen Punkten: nur Start + Ende.
 * Alle anderen (straight, curve, elbow, line): alle Kontrollpunkte.
 */
function PointHandles({
	element: el,
	zoom,
	setActivePointIndex,
}: {
	element: CanvasElement;
	zoom: number;
	setActivePointIndex: (idx: number | null) => void;
}) {
	const canvasCommands = useCanvasCommands();
	const pts = el.points;
	if (!pts || pts.length < 2) return null;
	const r = POINT_RADIUS / zoom;
	const insertR = INSERT_HANDLE_RADIUS / zoom;
	const strokeW = 1.5 / zoom;

	const hasManyPoints = pts.length > 10;

	let visibleIndices: number[];
	if (hasManyPoints) {
		visibleIndices = [0, pts.length - 1];
	} else {
		visibleIndices = pts.map((_, i) => i);
	}

	const isBezier =
		el.type === "arrow" && el.arrowMode === "curve" && pts.length === 3;
	const segmentMidpoints = pts.slice(0, -1).map(([x1, y1], index) => {
		const [x2, y2] = pts[index + 1];
		return {
			index,
			x: (x1 + x2) / 2,
			y: (y1 + y2) / 2,
		};
	});

	return (
		<g className="point-handles" pointerEvents="none">
			{/* Fuer Bezier: Tangent-Linien vom Kontrollpunkt zu Start/Ende */}
			{isBezier && (
				<>
					<line
						x1={el.x + pts[0][0]}
						y1={el.y + pts[0][1]}
						x2={el.x + pts[1][0]}
						y2={el.y + pts[1][1]}
						stroke="rgba(99, 102, 241, 0.35)"
						strokeWidth={1.5 / zoom}
						strokeDasharray={`${3 / zoom}`}
						pointerEvents="none"
					/>
					<line
						x1={el.x + pts[1][0]}
						y1={el.y + pts[1][1]}
						x2={el.x + pts[2][0]}
						y2={el.y + pts[2][1]}
						stroke="rgba(99, 102, 241, 0.35)"
						strokeWidth={1.5 / zoom}
						strokeDasharray={`${3 / zoom}`}
						pointerEvents="none"
					/>
				</>
			)}

			{/* Fuer andere: Polyline-Verbindung */}
			{!isBezier && pts.length >= 2 && (
				<polyline
					points={pts.map(([px, py]) => `${el.x + px},${el.y + py}`).join(" ")}
					fill="none"
					stroke="rgba(99, 102, 241, 0.4)"
					strokeWidth={2 / zoom}
					strokeDasharray={`${4 / zoom}`}
					pointerEvents="none"
				/>
			)}

			{segmentMidpoints.map((midpoint) => (
				<g
					key={`insert-${midpoint.x}-${midpoint.y}`}
					pointerEvents="all"
					style={{ cursor: "copy" }}
					onPointerDown={(event) => {
						event.preventDefault();
						event.stopPropagation();
						canvasCommands.insertWaypoint(el.id, midpoint.index + 1, [
							midpoint.x,
							midpoint.y,
						]);
					}}
				>
					<circle
						cx={el.x + midpoint.x}
						cy={el.y + midpoint.y}
						r={insertR}
						fill="var(--background, white)"
						stroke="rgba(99, 102, 241, 0.9)"
						strokeWidth={strokeW}
					/>
					<line
						x1={el.x + midpoint.x - insertR * 0.55}
						y1={el.y + midpoint.y}
						x2={el.x + midpoint.x + insertR * 0.55}
						y2={el.y + midpoint.y}
						stroke="rgba(99, 102, 241, 0.95)"
						strokeWidth={strokeW}
						strokeLinecap="round"
						pointerEvents="none"
					/>
					<line
						x1={el.x + midpoint.x}
						y1={el.y + midpoint.y - insertR * 0.55}
						x2={el.x + midpoint.x}
						y2={el.y + midpoint.y + insertR * 0.55}
						stroke="rgba(99, 102, 241, 0.95)"
						strokeWidth={strokeW}
						strokeLinecap="round"
						pointerEvents="none"
					/>
				</g>
			))}

			{visibleIndices.map((i) => {
				const [px, py] = pts[i];
				const isEndpoint = i === 0 || i === pts.length - 1;
				return (
					<circle
						key={i}
						cx={el.x + px}
						cy={el.y + py}
						r={r}
						fill={isEndpoint ? "white" : "rgba(99, 102, 241, 0.6)"}
						stroke="rgba(99, 102, 241, 0.9)"
						strokeWidth={strokeW}
						pointerEvents="all"
						style={{ cursor: "move" }}
						onPointerDown={() => {
							setActivePointIndex(i);
						}}
					/>
				);
			})}
		</g>
	);
}
