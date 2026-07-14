import type { RemoteCanvasPresence } from "@/hooks/canvas-sync-types";
import { getCombinedBBox } from "@skedra/canvas-core";
import type { CanvasElement, Viewport } from "@skedra/canvas-core";
import { MousePointer2 } from "lucide-react";

interface RemoteSelectionOverlaysProps {
	peers: RemoteCanvasPresence[];
	elements: Map<string, CanvasElement>;
	zoom: number;
}

interface RemoteCursorOverlayProps {
	peers: RemoteCanvasPresence[];
	viewport: Viewport;
}

function hexToRgba(hex: string, alpha: number) {
	const sanitized = hex.replace("#", "");
	if (sanitized.length !== 6) return `rgba(99, 102, 241, ${alpha})`;
	const red = Number.parseInt(sanitized.slice(0, 2), 16);
	const green = Number.parseInt(sanitized.slice(2, 4), 16);
	const blue = Number.parseInt(sanitized.slice(4, 6), 16);
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function RemoteSelectionOverlays({
	peers,
	elements,
	zoom,
}: RemoteSelectionOverlaysProps) {
	return (
		<g
			className="remote-selection-overlays"
			data-ui-only="true"
			data-skedra-ui="remote-selection"
			pointerEvents="none"
		>
			{peers.map((peer) => {
				if (peer.selection.length === 0) return null;

				const selectedElements = peer.selection
					.map((id) => elements.get(id))
					.filter(Boolean) as CanvasElement[];

				const bbox = getCombinedBBox(selectedElements);
				if (!bbox) return null;

				const strokeWidth = 1.5 / zoom;
				const labelHeight = 18 / zoom;
				const fontSize = 11 / zoom;
				const labelWidth = Math.max(
					(peer.user.name.length * 7 + 16) / zoom,
					54 / zoom,
				);

				return (
					<g key={`selection-${peer.clientId}`}>
						<rect
							x={bbox.x}
							y={bbox.y}
							width={bbox.width}
							height={bbox.height}
							fill={hexToRgba(peer.user.color, 0.08)}
							stroke={peer.user.color}
							strokeWidth={strokeWidth}
							strokeDasharray={`${5 / zoom}`}
							rx={5 / zoom}
						/>
						<rect
							x={bbox.x}
							y={bbox.y - labelHeight - 6 / zoom}
							width={labelWidth}
							height={labelHeight}
							rx={labelHeight / 2}
							fill={peer.user.color}
							opacity={0.94}
						/>
						<text
							x={bbox.x + 8 / zoom}
							y={bbox.y - 6 / zoom - labelHeight / 2 + fontSize / 3}
							fill="#ffffff"
							fontSize={fontSize}
							fontWeight={600}
						>
							{peer.user.name}
						</text>
					</g>
				);
			})}
		</g>
	);
}

export function RemoteCursorOverlay({
	peers,
	viewport,
}: RemoteCursorOverlayProps) {
	return (
		<div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
			{peers.map((peer) => {
				if (!peer.cursor) return null;

				const screenX = viewport.x + peer.cursor.x * viewport.zoom;
				const screenY = viewport.y + peer.cursor.y * viewport.zoom;

				return (
					<div
						key={`cursor-${peer.clientId}`}
						className="absolute left-0 top-0"
						style={{ transform: `translate(${screenX}px, ${screenY}px)` }}
					>
						<div className="relative -translate-x-1/2 -translate-y-1/2">
							<MousePointer2
								className="h-6 w-6 fill-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.75)]"
								style={{ color: peer.user.color }}
								strokeWidth={2.5}
							/>
							<div
								className="ml-4 mt-0.5 inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium text-white shadow-lg"
								style={{ backgroundColor: peer.user.color }}
							>
								{peer.user.name}
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
