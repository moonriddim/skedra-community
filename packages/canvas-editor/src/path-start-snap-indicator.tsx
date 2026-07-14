import type { CanvasPathStartSnapState } from "@skedra/canvas-core";

export interface CanvasPathStartSnapIndicatorProps {
	snap: CanvasPathStartSnapState | null;
	zoom: number;
	className?: string;
	activeFill?: string;
	inactiveFill?: string;
	stroke?: string;
}

export function CanvasPathStartSnapIndicator({
	snap,
	zoom,
	className,
	activeFill,
	inactiveFill,
	stroke,
}: CanvasPathStartSnapIndicatorProps) {
	if (!snap) return null;
	return (
		<circle
			className={className}
			data-active={snap.active}
			data-ui-only="true"
			data-skedra-ui="path-start-snap"
			cx={snap.point[0]}
			cy={snap.point[1]}
			r={(snap.active ? 7 : 5) / Math.max(zoom, 0.01)}
			strokeWidth={1.75 / Math.max(zoom, 0.01)}
			fill={snap.active ? activeFill : inactiveFill}
			stroke={stroke}
			pointerEvents="none"
		/>
	);
}
