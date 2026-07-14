import type { Viewport } from "@skedra/canvas-core";
import type { CSSProperties, ReactNode, RefObject, SVGProps } from "react";
import { useOptionalCanvasEditorServices } from "./canvas-editor";

export interface CanvasEditorSurfaceProps
	extends Omit<SVGProps<SVGSVGElement>, "children" | "ref"> {
	svgRef: RefObject<SVGSVGElement | null>;
	viewport: Viewport;
	activeTool: string;
	children: ReactNode;
	screenLayer?: ReactNode;
	worldClassName?: string;
	worldDataAttribute?: string;
	title?: string;
}

export function resolveCanvasEditorCursor(
	activeTool: string,
): CSSProperties["cursor"] {
	if (activeTool === "select") return "default";
	if (activeTool === "pan") return "grab";
	if (activeTool === "eraser") return "cell";
	if (activeTool === "eyedropper") return "copy";
	return "crosshair";
}

/** Shared SVG event surface and viewport transform for every editor host. */
export function CanvasEditorSurface({
	svgRef,
	viewport,
	activeTool,
	children,
	screenLayer,
	worldClassName,
	worldDataAttribute,
	title,
	style,
	onPointerCancel,
	onLostPointerCapture,
	...svgProps
}: CanvasEditorSurfaceProps) {
	const services = useOptionalCanvasEditorServices();
	const accessibleTitle =
		title ??
		services?.translations?.translate(
			"canvas.accessibility.canvas",
			"Skedra canvas",
		) ??
		"Skedra canvas";
	return (
		<svg
			ref={svgRef}
			style={{
				cursor: resolveCanvasEditorCursor(activeTool),
				touchAction: "none",
				backgroundColor: "inherit",
				...style,
			}}
			onPointerCancel={onPointerCancel}
			onLostPointerCapture={onLostPointerCapture}
			{...svgProps}
		>
			<title>{accessibleTitle}</title>
			{screenLayer}
			<g
				className={worldClassName}
				transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}
				data-skedra-elements={worldDataAttribute}
			>
				{children}
			</g>
		</svg>
	);
}
