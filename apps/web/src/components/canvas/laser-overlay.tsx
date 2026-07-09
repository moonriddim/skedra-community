import { useCanvasStore } from "@/hooks/use-canvas-store";
import { LASER_COLOR, trailToSvgPath } from "@/lib/canvas/laser-utils";
import type { LaserTrail, Viewport } from "@skedra/canvas-core";
import { useEffect, useState } from "react";

interface LaserOverlayProps {
	trails: LaserTrail[];
	viewport: Viewport;
}

/** Vergaengliche Laserpointer-Spuren mit Tail-Fade (hinten → vorne, wie Excalidraw). */
export function LaserOverlay({ trails, viewport }: LaserOverlayProps) {
	const trimLaserTrails = useCanvasStore((s) => s.trimLaserTrails);
	const [, setFrame] = useState(0);

	useEffect(() => {
		if (trails.length === 0) return;

		let frameId = 0;
		let active = true;

		const tick = () => {
			if (!active) return;
			trimLaserTrails();
			setFrame((n) => n + 1);
			if (useCanvasStore.getState().laserTrails.length > 0) {
				frameId = requestAnimationFrame(tick);
			}
		};

		frameId = requestAnimationFrame(tick);
		return () => {
			active = false;
			cancelAnimationFrame(frameId);
		};
	}, [trails.length, trimLaserTrails]);

	if (trails.length === 0) return null;

	return (
		<g pointerEvents="none" className="laser-overlay">
			{trails.map((trail) => {
				const d = trailToSvgPath(trail, viewport.zoom);
				if (!d) return null;

				return <path key={trail.id} d={d} fill={LASER_COLOR} />;
			})}
		</g>
	);
}
