import {
	getCanvasShapePointAtTrimPosition,
	getCanvasShapeTrimChanges,
	getCanvasShapeTrimSvgPath,
	getRetainedCanvasShapeTrim,
} from "@skedra/canvas-core";
import type { CanvasEditorShapeTrimPreview } from "./use-canvas-editor-ellipse-trim";

export interface CanvasEditorShapeTrimOverlayProps {
	preview: CanvasEditorShapeTrimPreview;
	zoom: number;
	instruction: string;
}
/** @deprecated Use CanvasEditorShapeTrimOverlayProps. */
export type CanvasEditorEllipseTrimOverlayProps =
	CanvasEditorShapeTrimOverlayProps;

/** Zoom-stable cut points, retained-contour preview, and interaction hint. */
export function CanvasEditorShapeTrimOverlay({
	preview,
	zoom,
	instruction,
}: CanvasEditorShapeTrimOverlayProps) {
	const { element } = preview;
	const trim = getRetainedCanvasShapeTrim(
		element,
		preview.firstPosition,
		preview.secondPosition,
		preview.preferLongPath,
	);
	const firstPoint = getCanvasShapePointAtTrimPosition(
		element,
		preview.firstPosition,
		true,
	);
	const secondPoint = getCanvasShapePointAtTrimPosition(
		element,
		preview.secondPosition,
		true,
	);
	if (!firstPoint || !secondPoint) return null;
	const previewElement = trim
		? { ...element, ...getCanvasShapeTrimChanges(element, trim) }
		: element;
	const centerX = element.x + element.width / 2;
	const centerY = element.y + element.height / 2;
	const transformParts: string[] = [];
	if (element.rotation) {
		transformParts.push(`rotate(${element.rotation} ${centerX} ${centerY})`);
	}
	if (element.flipX || element.flipY) {
		transformParts.push(
			`translate(${centerX}, ${centerY}) scale(${element.flipX ? -1 : 1}, ${element.flipY ? -1 : 1}) translate(${-centerX}, ${-centerY})`,
		);
	}
	const transform =
		transformParts.length > 0 ? transformParts.join(" ") : undefined;
	const inverseZoom = 1 / Math.max(zoom, 0.01);
	const labelWidth = 250 * inverseZoom;
	const labelHeight = 30 * inverseZoom;
	const labelX = secondPoint.x + 12 * inverseZoom;
	const labelY = secondPoint.y - 42 * inverseZoom;

	return (
		<g
			data-ui-only="true"
			data-skedra-ui="shape-trim-preview"
			pointerEvents="none"
		>
			{trim && (
				<path
					d={getCanvasShapeTrimSvgPath(previewElement)}
					transform={transform}
					fill="none"
					stroke="var(--primary, #6366f1)"
					strokeWidth={3 * inverseZoom}
					strokeLinecap="round"
				/>
			)}
			<circle
				cx={firstPoint.x}
				cy={firstPoint.y}
				r={5 * inverseZoom}
				fill="var(--primary, #6366f1)"
				stroke="white"
				strokeWidth={1.5 * inverseZoom}
			/>
			<circle
				cx={secondPoint.x}
				cy={secondPoint.y}
				r={5 * inverseZoom}
				fill="white"
				stroke="var(--primary, #6366f1)"
				strokeWidth={2 * inverseZoom}
			/>
			{preview.snapAnchor && (
				<circle
					cx={preview.snapAnchor.x}
					cy={preview.snapAnchor.y}
					r={8 * inverseZoom}
					fill="none"
					stroke="var(--primary, #6366f1)"
					strokeWidth={2 * inverseZoom}
				/>
			)}
			<rect
				x={labelX}
				y={labelY}
				width={labelWidth}
				height={labelHeight}
				rx={6 * inverseZoom}
				fill="var(--popover, #111827)"
				stroke="var(--border, #374151)"
				strokeWidth={inverseZoom}
			/>
			<text
				x={labelX + 10 * inverseZoom}
				y={labelY + 19 * inverseZoom}
				fill="var(--popover-foreground, white)"
				fontSize={12 * inverseZoom}
				fontFamily="system-ui, sans-serif"
			>
				{instruction}
			</text>
		</g>
	);
}

/** @deprecated Use CanvasEditorShapeTrimOverlay. */
export function CanvasEditorEllipseTrimOverlay(
	props: CanvasEditorEllipseTrimOverlayProps,
) {
	return <CanvasEditorShapeTrimOverlay {...props} />;
}

export type { CanvasEditorShapeTrimPreview };
