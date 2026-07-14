import { GRID_SIZE } from "@skedra/canvas-core";
import { useId } from "react";

export interface CanvasEditorGridOverlayProps {
	enabled: boolean;
	zoom: number;
	patternId?: string;
	color?: string;
	opacity?: number;
	extent?: number;
}

/** Shared zoom-aware canvas grid that is excluded from exported documents. */
export function CanvasEditorGridOverlay({
	enabled,
	zoom,
	patternId,
	color = "var(--foreground, currentColor)",
	opacity = 0.15,
	extent = 10000,
}: CanvasEditorGridOverlayProps) {
	const generatedId = useId();
	if (!enabled) return null;
	const id =
		patternId ?? `canvas-editor-grid-${generatedId.replaceAll(":", "")}`;
	return (
		<g data-ui-only="true" data-skedra-ui="grid">
			<defs>
				<pattern
					id={id}
					width={GRID_SIZE}
					height={GRID_SIZE}
					patternUnits="userSpaceOnUse"
				>
					<circle
						cx={0}
						cy={0}
						r={Math.max(1, 1.5 / zoom)}
						fill={color}
						opacity={opacity}
					/>
				</pattern>
			</defs>
			<rect
				x={-extent}
				y={-extent}
				width={extent * 2}
				height={extent * 2}
				fill={`url(#${id})`}
				pointerEvents="none"
			/>
		</g>
	);
}
