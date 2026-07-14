import type { SnapGuide, SnapPointIndicator } from "@skedra/canvas-core";

export interface CanvasEditorSnapOverlayProps {
	guides: SnapGuide[];
	points: SnapPointIndicator[];
	zoom: number;
	guideStroke?: string;
	activeFill?: string;
	inactiveFill?: string;
	pointStroke?: string;
}

export function CanvasEditorSnapOverlay({
	guides,
	points,
	zoom,
	guideStroke = "rgba(99, 102, 241, 0.8)",
	activeFill = "rgba(16, 185, 129, 0.95)",
	inactiveFill = "rgba(99, 102, 241, 0.92)",
	pointStroke = "rgba(255, 255, 255, 0.9)",
}: CanvasEditorSnapOverlayProps) {
	return (
		<g data-ui-only="true" data-skedra-ui="snap-overlay" pointerEvents="none">
			{guides.map((guide, index) => (
				<line
					// biome-ignore lint/suspicious/noArrayIndexKey: transient ordered slots
					key={`snap-guide-${index}`}
					x1={guide.orientation === "v" ? guide.pos : guide.from}
					y1={guide.orientation === "h" ? guide.pos : guide.from}
					x2={guide.orientation === "v" ? guide.pos : guide.to}
					y2={guide.orientation === "h" ? guide.pos : guide.to}
					stroke={guideStroke}
					strokeWidth={1 / zoom}
					strokeDasharray={`${3 / zoom}`}
					pointerEvents="none"
				/>
			))}
			{points.map((point, index) => {
				const size = (point.active ? 10 : 7) / zoom;
				const strokeWidth = 1.5 / zoom;
				const round =
					point.kind === "center" ||
					point.kind === "edge-midpoint" ||
					point.kind === "segment-midpoint";
				return (
					<g
						// biome-ignore lint/suspicious/noArrayIndexKey: transient ordered slots
						key={`snap-point-${index}`}
						pointerEvents="none"
					>
						{round ? (
							<circle
								cx={point.x}
								cy={point.y}
								r={size / 2}
								fill={point.active ? activeFill : inactiveFill}
								stroke={pointStroke}
								strokeWidth={strokeWidth}
							/>
						) : (
							<rect
								x={point.x - size / 2}
								y={point.y - size / 2}
								width={size}
								height={size}
								rx={1.5 / zoom}
								fill={point.active ? activeFill : inactiveFill}
								stroke={pointStroke}
								strokeWidth={strokeWidth}
							/>
						)}
					</g>
				);
			})}
		</g>
	);
}
