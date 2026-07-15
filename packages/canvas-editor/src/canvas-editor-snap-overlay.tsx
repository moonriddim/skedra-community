import type { SnapGuide, SnapPointIndicator } from "@skedra/canvas-core";

export interface CanvasEditorSnapOverlayProps {
	guides: SnapGuide[];
	points: SnapPointIndicator[];
	zoom: number;
	origin?: { x: number; y: number } | null;
	guideStroke?: string;
	activeFill?: string;
	inactiveFill?: string;
	pointStroke?: string;
}

export function CanvasEditorSnapOverlay({
	guides,
	points,
	zoom,
	origin,
	guideStroke = "rgba(99, 102, 241, 0.8)",
	activeFill = "rgba(16, 185, 129, 0.95)",
	inactiveFill = "rgba(99, 102, 241, 0.92)",
	pointStroke = "rgba(255, 255, 255, 0.9)",
}: CanvasEditorSnapOverlayProps) {
	return (
		<g data-ui-only="true" data-skedra-ui="snap-overlay" pointerEvents="none">
			{origin && (
				<circle
					data-skedra-ui="transform-origin"
					cx={origin.x}
					cy={origin.y}
					r={5 / zoom}
					fill="none"
					stroke={activeFill}
					strokeWidth={1.5 / zoom}
				/>
			)}
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
				const midpoint =
					point.kind === "edge-midpoint" || point.kind === "segment-midpoint";
				return (
					<g
						// biome-ignore lint/suspicious/noArrayIndexKey: transient ordered slots
						key={`snap-point-${index}`}
						pointerEvents="none"
					>
						{point.kind === "center" ? (
							<circle
								cx={point.x}
								cy={point.y}
								r={size / 2}
								fill={point.active ? activeFill : inactiveFill}
								stroke={pointStroke}
								strokeWidth={strokeWidth}
							/>
						) : point.kind === "geometric-center" ? (
							<g>
								<rect
									x={point.x - size / 2}
									y={point.y - size / 2}
									width={size}
									height={size}
									fill="none"
									stroke={point.active ? activeFill : inactiveFill}
									strokeWidth={strokeWidth}
								/>
								<circle
									cx={point.x}
									cy={point.y}
									r={1.75 / zoom}
									fill={point.active ? activeFill : inactiveFill}
								/>
							</g>
						) : midpoint ? (
							<path
								d={`M ${point.x} ${point.y - size / 2} L ${point.x + size / 2} ${point.y + size / 2} L ${point.x - size / 2} ${point.y + size / 2} Z`}
								fill={point.active ? activeFill : inactiveFill}
								stroke={pointStroke}
								strokeWidth={strokeWidth}
							/>
						) : point.kind === "division" ? (
							<circle
								cx={point.x}
								cy={point.y}
								r={size / 2}
								fill="none"
								stroke={point.active ? activeFill : inactiveFill}
								strokeWidth={2 / zoom}
							/>
						) : point.kind === "nearest" || point.kind === "intersection" ? (
							<g
								stroke={point.active ? activeFill : inactiveFill}
								strokeWidth={2 / zoom}
							>
								<line
									x1={point.x - size / 2}
									y1={point.y - size / 2}
									x2={point.x + size / 2}
									y2={point.y + size / 2}
								/>
								<line
									x1={point.x + size / 2}
									y1={point.y - size / 2}
									x2={point.x - size / 2}
									y2={point.y + size / 2}
								/>
							</g>
						) : point.kind === "quadrant" || point.kind === "insertion" ? (
							<rect
								x={point.x - size / 2}
								y={point.y - size / 2}
								width={size}
								height={size}
								transform={`rotate(45 ${point.x} ${point.y})`}
								fill={point.active ? activeFill : inactiveFill}
								stroke={pointStroke}
								strokeWidth={strokeWidth}
							/>
						) : point.kind === "extension" ? (
							<g
								stroke={point.active ? activeFill : inactiveFill}
								strokeWidth={strokeWidth}
							>
								<line
									x1={point.x - size / 2}
									y1={point.y}
									x2={point.x + size / 2}
									y2={point.y}
								/>
								<line
									x1={point.x}
									y1={point.y - size / 2}
									x2={point.x}
									y2={point.y + size / 2}
								/>
							</g>
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
