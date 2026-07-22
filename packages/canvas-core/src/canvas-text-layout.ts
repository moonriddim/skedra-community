import { STICKY_NOTE_TEXT_PADDING } from "./element-factory";
import type { CanvasElement } from "./types";

export interface CanvasRectTextLayout {
	fontSize: number;
	lineHeight: number;
	horizontalPadding: number;
	verticalPadding: number;
}

export function isCanvasCenteredTextShape(element: CanvasElement) {
	return (
		element.type === "rectangle" ||
		element.type === "ellipse" ||
		element.type === "diamond" ||
		element.type === "triangle" ||
		element.type === "cloud"
	);
}

export function resolveCanvasElementTextLineHeight(
	element: CanvasElement,
	fontSize = element.fontSize ?? 16,
) {
	if (element.lineHeight != null && element.lineHeight > 0) {
		return element.lineHeight;
	}
	if (element.customData?.skedraType !== "wireframe-node") return 1.4;
	const heightRatio = element.height / Math.max(1, fontSize);
	if (heightRatio <= 1.25) return 1;
	if (heightRatio <= 2.4) return 1.1;
	return 1.2;
}

export function resolveCanvasTextRenderedHeight(element: CanvasElement) {
	const fontSize = element.fontSize ?? 16;
	const lineHeight = resolveCanvasElementTextLineHeight(element, fontSize);
	return element.customData?.skedraType === "wireframe-node"
		? Math.max(20, element.height, Math.ceil(fontSize * lineHeight + 6))
		: Math.max(20, element.height);
}

export function resolveCanvasRectTextLayout(
	element: CanvasElement,
): CanvasRectTextLayout {
	const fontSize = element.fontSize ?? 16;
	const lineHeight = resolveCanvasElementTextLineHeight(element, fontSize);
	const isStickyNote = element.customData?.skedraType === "sticky-note";
	const isCenteredShape = isCanvasCenteredTextShape(element);
	const isWireframeNode = element.customData?.skedraType === "wireframe-node";
	const horizontalPadding = isStickyNote
		? STICKY_NOTE_TEXT_PADDING
		: isCenteredShape
			? isWireframeNode
				? Math.min(12, Math.max(4, element.width * 0.08))
				: 12
			: 8;
	const verticalPadding = isStickyNote
		? STICKY_NOTE_TEXT_PADDING
		: isCenteredShape
			? isWireframeNode
				? Math.min(
						12,
						Math.max(0, (element.height - fontSize * lineHeight) / 2),
					)
				: 12
			: 8;

	return { fontSize, lineHeight, horizontalPadding, verticalPadding };
}
