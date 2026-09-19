import type { Viewport } from "@skedra/canvas-core";
import type { CSSProperties, ReactNode, RefObject, SVGProps } from "react";
import { useEffect, useRef } from "react";
import { useOptionalCanvasEditorServices } from "./canvas-editor";

export type CanvasEditorWheelEvent = WheelEvent & {
	currentTarget: SVGSVGElement;
};

export interface CanvasEditorSurfaceProps
	extends Omit<SVGProps<SVGSVGElement>, "children" | "ref" | "onWheel"> {
	/** Native, non-passive event so canvas zoom can prevent page scrolling. */
	onWheel?: (event: CanvasEditorWheelEvent) => void;
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
	onWheel,
	...svgProps
}: CanvasEditorSurfaceProps) {
	const onWheelRef = useRef(onWheel);
	onWheelRef.current = onWheel;
	const hasWheelHandler = onWheel != null;
	useEffect(() => {
		const svg = svgRef.current;
		if (!svg || !hasWheelHandler) return;
		const handleWheel = (event: WheelEvent) => {
			// The listener is attached to this SVG, so currentTarget is the surface.
			onWheelRef.current?.(event as CanvasEditorWheelEvent);
		};
		svg.addEventListener("wheel", handleWheel, { passive: false });
		return () => svg.removeEventListener("wheel", handleWheel);
	}, [hasWheelHandler, svgRef]);
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
