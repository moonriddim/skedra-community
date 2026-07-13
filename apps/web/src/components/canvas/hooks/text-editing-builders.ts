/**
 * EditingText-Session aus einem Canvas-Element aufbauen (Inline-Editor oeffnen).
 */

import type { EditingText } from "@/components/canvas/text-editor";
import {
	CANVAS_DEFAULT_FONT,
	KANBAN_FONT_FAMILY,
	TOOL_FONT_FAMILY,
} from "@/lib/canvas/canvas-defaults";
import { readElementCustomData } from "@/lib/canvas/custom-data-utils";
import {
	STICKY_NOTE_TEXT_PADDING,
	type StickyChecklistItem,
	type StickyNoteMode,
	getStickyNoteContent,
	getStickyNotePlaceholder,
	prepareStickyChecklistForEditing,
} from "@/lib/canvas/sticky-note-utils";
import {
	type ArrowTextOrientation,
	type ArrowTextSide,
	getArrowTextMetrics,
	isMindmapNode,
	resolveArrowTextOffset,
	resolveArrowTextRotationDeg,
} from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";

export interface EditingTextSession {
	editingText: EditingText;
	stickyNoteMode?: StickyNoteMode;
	stickyChecklist?: StickyChecklistItem[];
}

interface BuildEditingTextSessionOptions {
	element: CanvasElement;
	arrowTextSide: ArrowTextSide | null;
	arrowTextOrientation: ArrowTextOrientation | null;
	translate: (key: string) => string;
}

function resolveDefaultFontFamily(el: CanvasElement): string {
	const isKanbanCardEl = el.customData?.skedraType === "kanban-card";
	const isKanbanListEl = el.customData?.skedraType === "kanban-list";
	const isToolTextEl =
		isMindmapNode(el) || el.customData?.skedraType === "flowchart-node";
	if (isKanbanCardEl || isKanbanListEl) return KANBAN_FONT_FAMILY;
	if (isToolTextEl) return TOOL_FONT_FAMILY;
	return CANVAS_DEFAULT_FONT;
}

export function buildEditingTextSession({
	element: el,
	arrowTextSide,
	arrowTextOrientation,
	translate: t,
}: BuildEditingTextSessionOptions): EditingTextSession {
	const isShape =
		el.type === "rectangle" ||
		el.type === "ellipse" ||
		el.type === "diamond" ||
		el.type === "frame";
	const isPathTextElement = el.type === "arrow" || el.type === "line";
	const isCenteredShape =
		el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond";
	const isKanbanCardEl = el.customData?.skedraType === "kanban-card";
	const isKanbanListEl = el.customData?.skedraType === "kanban-list";
	const isStickyNoteEl = el.customData?.skedraType === "sticky-note";
	const defaultFontFamily = resolveDefaultFontFamily(el);
	const pathCustomData = readElementCustomData(el.customData);
	const resolvedArrowTextSide =
		arrowTextSide ??
		(pathCustomData.arrowTextSide as ArrowTextSide | undefined) ??
		"above";
	const resolvedArrowTextOrientation =
		arrowTextOrientation ??
		(pathCustomData.arrowTextOrientation as ArrowTextOrientation | undefined) ??
		"horizontal";
	const editorVariant = isStickyNoteEl
		? "sticky-note"
		: isMindmapNode(el)
			? "mindmap-node"
			: el.type === "text"
				? "canvas-text"
				: isCenteredShape
					? "shape"
					: isKanbanListEl
						? "frame-label"
						: "default";

	if (isKanbanListEl) {
		return {
			editingText: {
				id: el.id,
				x: el.x,
				y: el.y,
				width: el.width,
				height: 40,
				text: el.frameLabel ?? "",
				stroke: el.stroke,
				textColor: el.textColor ?? el.stroke,
				fontSize: 14,
				fontFamily: el.fontFamily ?? KANBAN_FONT_FAMILY,
				textAlign: "left",
				fontWeight: "bold",
				fontStyle: "normal",
				textDecoration: "none",
			},
		};
	}

	if (isPathTextElement && el.points) {
		const pathCustomDataForOffset = readElementCustomData(el.customData);
		const pathOrientation =
			(pathCustomDataForOffset.arrowTextOrientation as
				| ArrowTextOrientation
				| undefined) ?? "horizontal";
		const pathFontSize = el.fontSize ?? 16;
		const labelOffset = resolveArrowTextOffset(
			pathFontSize,
			el.strokeWidth,
			pathOrientation,
			el.text ?? "",
		);
		const { anchor, tangentAngle } = getArrowTextMetrics(
			el.points,
			el.type === "arrow" ? el.arrowMode : undefined,
			resolvedArrowTextSide,
			labelOffset,
		);
		const pathLength = el.points.reduce((length, point, index) => {
			if (index === 0) return 0;
			const previous = el.points?.[index - 1] ?? point;
			return (
				length + Math.hypot(point[0] - previous[0], point[1] - previous[1])
			);
		}, 0);
		const editorWidth = Math.max(160, Math.min(320, pathLength * 0.4));
		const editorHeight = 44;
		return {
			editingText: {
				id: el.id,
				x: el.x + anchor[0] - editorWidth / 2,
				y: el.y + anchor[1] - editorHeight / 2,
				width: editorWidth,
				height: editorHeight,
				text: el.text ?? "",
				textColor: el.textColor ?? el.stroke,
				fontSize: el.fontSize ?? 16,
				fontFamily: el.fontFamily ?? defaultFontFamily,
				textAlign: "center",
				fontWeight: (el.fontWeight as "normal" | "bold") ?? "normal",
				fontStyle: (el.fontStyle as "normal" | "italic") ?? "normal",
				textDecoration: (el.textDecoration as "none" | "underline") ?? "none",
				placeholder: t("canvas.arrowTextPlaceholder"),
				variant: "arrow",
				rotationDeg: resolveArrowTextRotationDeg(tangentAngle, pathOrientation),
				stroke: el.stroke,
			},
		};
	}

	if (isStickyNoteEl) {
		const content = getStickyNoteContent(el);
		return {
			editingText: {
				id: el.id,
				x: el.x,
				y: el.y,
				width: el.width,
				height: el.height,
				text: content.text,
				textColor: el.textColor ?? "#1e1e1e",
				fontSize: el.fontSize ?? 20,
				fontFamily: el.fontFamily ?? defaultFontFamily,
				textAlign: (el.textAlign as "left" | "center" | "right") ?? "left",
				fontWeight: (el.fontWeight as "normal" | "bold") ?? "normal",
				fontStyle: (el.fontStyle as "normal" | "italic") ?? "normal",
				textDecoration: (el.textDecoration as "none" | "underline") ?? "none",
				padding: STICKY_NOTE_TEXT_PADDING,
				variant: "sticky-note",
				stroke: el.textColor ?? "#1e1e1e",
			},
			stickyNoteMode: content.mode,
			stickyChecklist:
				content.mode === "checklist"
					? prepareStickyChecklistForEditing(content.checklist)
					: [],
		};
	}

	return {
		editingText: {
			id: el.id,
			x: el.x,
			y: el.y,
			width: el.width,
			height: el.height,
			text: el.text ?? "",
			textColor: el.textColor ?? el.stroke,
			fontSize: el.fontSize ?? (isShape ? 16 : 18),
			fontFamily: el.fontFamily ?? defaultFontFamily,
			textAlign:
				(el.textAlign as "left" | "center" | "right") ??
				(isKanbanCardEl ? "left" : isCenteredShape ? "center" : "left"),
			fontWeight:
				(el.fontWeight as "normal" | "bold") ??
				(isKanbanCardEl ? "bold" : "normal"),
			fontStyle: (el.fontStyle as "normal" | "italic") ?? "normal",
			textDecoration: (el.textDecoration as "none" | "underline") ?? "none",
			padding: isStickyNoteEl ? STICKY_NOTE_TEXT_PADDING : 0,
			placeholder: isStickyNoteEl
				? getStickyNotePlaceholder()
				: t("canvas.textPlaceholder"),
			variant: editorVariant,
			stroke: isStickyNoteEl ? "#1e1e1e" : el.stroke,
		},
	};
}
