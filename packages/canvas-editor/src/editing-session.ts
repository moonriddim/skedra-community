import {
	type ArrowTextOrientation,
	type ArrowTextSide,
	type CanvasElement,
	DEFAULT_FONT_FAMILY,
	FRAME_LABEL_FONT_SIZE,
	FRAME_LABEL_OFFSET_X,
	STICKY_NOTE_TEXT_PADDING,
	getArrowTextMetrics,
	getStickyNoteContent,
	isCanvasCenteredTextShape,
	isCanvasFrameLabelEditable,
	isMindmapNode,
	resolveArrowTextOffset,
	resolveArrowTextRotationDeg,
	resolveCanvasElementTextLineHeight,
	resolveCanvasRectTextLayout,
	resolveCanvasTextRenderedHeight,
} from "@skedra/canvas-core";
import type { CanvasEditorEditingText } from "./canvas-editor-text-overlay";
import {
	type CanvasEditorStickyChecklistItem,
	type CanvasEditorStickyNoteMode,
	prepareCanvasEditorStickyChecklistForEditing,
} from "./sticky-editor-data";

export interface CanvasEditorEditingSession {
	editingText: CanvasEditorEditingText;
	stickyNoteMode?: CanvasEditorStickyNoteMode;
	stickyChecklist?: CanvasEditorStickyChecklistItem[];
}

export interface BuildCanvasEditorEditingSessionOptions {
	element: CanvasElement;
	arrowTextSide?: ArrowTextSide | null;
	arrowTextOrientation?: ArrowTextOrientation | null;
	defaultFontFamily?: string;
	kanbanFontFamily?: string;
	toolFontFamily?: string;
	textPlaceholder?: string;
	arrowTextPlaceholder?: string;
}

export function buildCanvasEditorEditingSession({
	element,
	arrowTextSide,
	arrowTextOrientation,
	defaultFontFamily = DEFAULT_FONT_FAMILY,
	kanbanFontFamily = "Aptos, Segoe UI, system-ui, sans-serif",
	toolFontFamily = DEFAULT_FONT_FAMILY,
	textPlaceholder = "Text...",
	arrowTextPlaceholder = "Label...",
}: BuildCanvasEditorEditingSessionOptions): CanvasEditorEditingSession {
	const isCenteredShape = isCanvasCenteredTextShape(element);
	const isPath = element.type === "arrow" || element.type === "line";
	const isKanbanCard = element.customData?.skedraType === "kanban-card";
	const isKanbanList = element.customData?.skedraType === "kanban-list";
	const isStickyNote = element.customData?.skedraType === "sticky-note";
	const isToolText =
		isMindmapNode(element) ||
		element.customData?.skedraType === "flowchart-node";
	const fontFamily =
		element.fontFamily ??
		(isKanbanCard || isKanbanList
			? kanbanFontFamily
			: isToolText
				? toolFontFamily
				: defaultFontFamily);

	if (isKanbanList) {
		return {
			editingText: {
				id: element.id,
				x: element.x,
				y: element.y,
				width: element.width,
				height: 40,
				text: element.frameLabel ?? "",
				stroke: element.stroke,
				textColor: element.textColor ?? element.stroke,
				fontSize: 14,
				fontFamily,
				textAlign: "left",
				fontWeight: "bold",
				fontStyle: "normal",
				textDecoration: "none",
				variant: "frame-label",
				placeholder: textPlaceholder,
			},
		};
	}

	/*
	 * Umbenennbare Frames (Design- und Wireframe-Screens): Der Inline-Editor
	 * bearbeitet den Frame-Namen und sitzt am Label oberhalb der Frame-Kante,
	 * nicht ueber der gesamten Frame-Flaeche.
	 */
	if (isCanvasFrameLabelEditable(element)) {
		return {
			editingText: {
				id: element.id,
				x: element.x + FRAME_LABEL_OFFSET_X,
				y: element.y - FRAME_LABEL_FONT_SIZE - 10,
				width: Math.max(160, Math.min(element.width, 320)),
				height: FRAME_LABEL_FONT_SIZE + 10,
				text: element.frameLabel ?? "",
				stroke: element.stroke,
				textColor: element.textColor ?? element.stroke,
				fontSize: FRAME_LABEL_FONT_SIZE,
				fontFamily: "system-ui, sans-serif",
				textAlign: "left",
				fontWeight: "normal",
				fontStyle: "normal",
				textDecoration: "none",
				variant: "frame-label",
				placeholder: textPlaceholder,
			},
		};
	}

	if (isPath && element.points) {
		const orientation =
			arrowTextOrientation ??
			(element.customData?.arrowTextOrientation as
				| ArrowTextOrientation
				| undefined) ??
			"horizontal";
		const side =
			arrowTextSide ??
			(element.customData?.arrowTextSide as ArrowTextSide | undefined) ??
			"above";
		const fontSize = element.fontSize ?? 16;
		const offset = resolveArrowTextOffset(
			fontSize,
			element.strokeWidth,
			orientation,
			element.text ?? "",
		);
		const { anchor, tangentAngle } = getArrowTextMetrics(
			element.points,
			element.type === "arrow" ? element.arrowMode : undefined,
			side,
			offset,
		);
		const length = element.points.reduce((total, point, index) => {
			if (index === 0) return 0;
			const previous = element.points?.[index - 1] ?? point;
			return total + Math.hypot(point[0] - previous[0], point[1] - previous[1]);
		}, 0);
		const width = Math.max(160, Math.min(320, length * 0.4));
		return {
			editingText: {
				id: element.id,
				x: element.x + anchor[0] - width / 2,
				y: element.y + anchor[1] - 22,
				width,
				height: 44,
				text: element.text ?? "",
				stroke: element.stroke,
				textColor: element.textColor ?? element.stroke,
				fontSize,
				fontFamily,
				textAlign: "center",
				fontWeight: element.fontWeight ?? "normal",
				fontStyle: element.fontStyle ?? "normal",
				textDecoration: element.textDecoration ?? "none",
				placeholder: arrowTextPlaceholder,
				variant: "arrow",
				rotationDeg: resolveArrowTextRotationDeg(tangentAngle, orientation),
			},
		};
	}

	if (isStickyNote) {
		const content = getStickyNoteContent(element);
		return {
			editingText: {
				id: element.id,
				x: element.x,
				y: element.y,
				width: element.width,
				height: element.height,
				text: content.text,
				stroke: element.textColor ?? "#1e1e1e",
				textColor: element.textColor ?? "#1e1e1e",
				fontSize: element.fontSize ?? 20,
				fontFamily,
				textAlign: element.textAlign ?? "left",
				fontWeight: element.fontWeight ?? "normal",
				fontStyle: element.fontStyle ?? "normal",
				textDecoration: element.textDecoration ?? "none",
				padding: STICKY_NOTE_TEXT_PADDING,
				variant: "sticky-note",
				placeholder: textPlaceholder,
			},
			stickyNoteMode: content.mode,
			stickyChecklist:
				content.mode === "checklist"
					? prepareCanvasEditorStickyChecklistForEditing(content.checklist)
					: [],
		};
	}

	const shapeTextLayout = isCenteredShape
		? resolveCanvasRectTextLayout(element)
		: null;
	const isCanvasText = element.type === "text";
	const canvasTextHeight = isCanvasText
		? resolveCanvasTextRenderedHeight(element)
		: element.height;
	const isWireframeText =
		isCanvasText && element.customData?.skedraType === "wireframe-node";

	return {
		editingText: {
			id: element.id,
			x: element.x,
			y: isCanvasText
				? element.y - (canvasTextHeight - element.height) / 2
				: element.y,
			width: isCanvasText ? Math.max(20, element.width) : element.width,
			height: canvasTextHeight,
			text: element.text ?? "",
			stroke: element.stroke,
			textColor: element.textColor ?? element.stroke,
			fontSize: element.fontSize ?? (isCenteredShape ? 16 : 18),
			fontFamily,
			textAlign:
				element.textAlign ??
				(isKanbanCard ? "left" : isCenteredShape ? "center" : "left"),
			verticalAlign:
				element.verticalAlign ?? (isCenteredShape ? "middle" : "top"),
			fontWeight: element.fontWeight ?? (isKanbanCard ? "bold" : "normal"),
			fontStyle: element.fontStyle ?? "normal",
			textDecoration: element.textDecoration ?? "none",
			sourceWidth: element.width,
			sourceHeight: element.height,
			preserveBounds: isWireframeText,
			paddingX: shapeTextLayout?.horizontalPadding ?? (isCanvasText ? 4 : 0),
			paddingY:
				shapeTextLayout?.verticalPadding ??
				(isCanvasText ? (isWireframeText ? 0 : 2) : 0),
			lineHeight:
				shapeTextLayout?.lineHeight ??
				resolveCanvasElementTextLineHeight(element),
			placeholder: textPlaceholder,
			variant: isMindmapNode(element)
				? "mindmap-node"
				: isCanvasText
					? "canvas-text"
					: isCenteredShape
						? "shape"
						: "default",
		},
	};
}
