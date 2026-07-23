import * as LaserPointerPackage from "@excalidraw/laser-pointer";
import type { LaserPointerOptions } from "@excalidraw/laser-pointer";
import { useEffect, useState } from "react";

type LaserPointerConstructor = typeof LaserPointerPackage.LaserPointer;
const laserPointerModule = LaserPointerPackage as unknown as {
	LaserPointer?: LaserPointerConstructor;
	default?: { LaserPointer: LaserPointerConstructor };
	"module.exports"?: { LaserPointer: LaserPointerConstructor };
};
const LaserPointer = (laserPointerModule.LaserPointer ??
	laserPointerModule.default?.LaserPointer ??
	laserPointerModule["module.exports"]
		?.LaserPointer) as LaserPointerConstructor;

export interface CanvasEditorEraserTrailPoint {
	x: number;
	y: number;
	t: number;
}

export interface CanvasEditorEraserTrailOverlayProps {
	points: readonly CanvasEditorEraserTrailPoint[];
	zoom: number;
	className?: string;
	fill?: string;
}

const ERASER_TRAIL_SIZE = 5;
const ERASER_TRAIL_DECAY_MS = 200;
const ERASER_TRAIL_DECAY_LENGTH = 10;

function average(a: number, b: number): number {
	return (a + b) / 2;
}

function easeOut(value: number): number {
	const clamped = Math.min(1, Math.max(0, value));
	return 1 - (1 - clamped) * (1 - clamped);
}

function eraserSizeMapping(context: {
	pressure: number;
	currentIndex: number;
	totalLength: number;
}): number {
	const timeFade = Math.max(
		0,
		1 - (performance.now() - context.pressure) / ERASER_TRAIL_DECAY_MS,
	);
	const lengthFade =
		(ERASER_TRAIL_DECAY_LENGTH -
			Math.min(
				ERASER_TRAIL_DECAY_LENGTH,
				context.totalLength - context.currentIndex,
			)) /
		ERASER_TRAIL_DECAY_LENGTH;
	return Math.min(easeOut(lengthFade), easeOut(timeFade));
}

function getSvgPathFromStroke(points: number[][]): string {
	if (points.length < 4) return "";
	const first = points[0];
	const second = points[1];
	const third = points[2];
	let path = `M${first[0].toFixed(2)},${first[1].toFixed(2)} Q${second[0].toFixed(2)},${second[1].toFixed(2)} ${average(second[0], third[0]).toFixed(2)},${average(second[1], third[1]).toFixed(2)} T`;

	for (let index = 2; index < points.length - 1; index += 1) {
		const current = points[index];
		const next = points[index + 1];
		path += `${average(current[0], next[0]).toFixed(2)},${average(current[1], next[1]).toFixed(2)} `;
	}

	return `${path}Z`;
}

function eraserTrailToSvgPath(
	points: readonly CanvasEditorEraserTrailPoint[],
	zoom: number,
): string {
	const options: Partial<LaserPointerOptions> = {
		streamline: 0.2,
		keepHead: true,
		sizeMapping: eraserSizeMapping,
	};
	const trail = new LaserPointer(options);
	for (const point of points) {
		trail.addPoint([point.x, point.y, point.t]);
	}
	const outline = trail.getStrokeOutline(
		ERASER_TRAIL_SIZE / Math.max(zoom, 0.01),
	);
	return getSvgPathFromStroke(outline.map(([x, y]) => [x, y]));
}

/**
 * Short-lived neutral trail shown while erasing. Its taper and 200 ms tail
 * mirror Excalidraw's eraser feedback without becoming document content.
 */
export function CanvasEditorEraserTrailOverlay({
	points,
	zoom,
	className,
	fill = "currentColor",
}: CanvasEditorEraserTrailOverlayProps) {
	const [, setFrame] = useState(0);

	useEffect(() => {
		if (points.length === 0) return;
		let active = true;
		let frameId = 0;
		const tick = () => {
			if (!active) return;
			setFrame((frame) => frame + 1);
			frameId = requestAnimationFrame(tick);
		};
		frameId = requestAnimationFrame(tick);
		return () => {
			active = false;
			cancelAnimationFrame(frameId);
		};
	}, [points.length]);

	const path = eraserTrailToSvgPath(points, zoom);
	if (!path) return null;

	return (
		<path
			className={className}
			d={path}
			fill={fill}
			opacity={0.2}
			pointerEvents="none"
			data-ui-only="true"
			data-skedra-ui="eraser-trail"
		/>
	);
}
