/**
 * SVG-Grid-Overlay fuer optionales Snap-to-Grid.
 * Rendert ein wiederholendes Punkt-Muster als Hintergrund.
 */

import { useCanvasStore } from "@/hooks/use-canvas-store";
import { GRID_SIZE } from "@skedra/canvas-core";

interface GridOverlayProps {
	zoom: number;
}

export function GridOverlay({ zoom }: GridOverlayProps) {
	const gridEnabled = useCanvasStore((s) => s.gridEnabled);
	if (!gridEnabled) return null;

	const dotRadius = Math.max(1, 1.5 / zoom);
	const patternSize = GRID_SIZE;

	return (
		<>
			<defs>
				<pattern
					id="skedra-grid"
					width={patternSize}
					height={patternSize}
					patternUnits="userSpaceOnUse"
				>
					<circle
						cx={0}
						cy={0}
						r={dotRadius}
						fill="var(--foreground)"
						opacity={0.15}
					/>
				</pattern>
			</defs>
			<rect
				x={-10000}
				y={-10000}
				width={20000}
				height={20000}
				fill="url(#skedra-grid)"
				pointerEvents="none"
			/>
		</>
	);
}
