/**
 * Hilfsfunktionen fuer das Eigenschaften-Panel.
 */

import type { CanvasElement } from "@skedra/canvas-core";
import type { CanvasEditorPendingText as PendingText } from "@skedra/canvas-editor";

function buildPendingTextElement(pendingText: PendingText): CanvasElement {
	return {
		id: "__pending-text__",
		type: "text",
		x: pendingText.x,
		y: pendingText.y,
		width: pendingText.width ?? 200,
		height: pendingText.height ?? 40,
		rotation: 0,
		fill: "transparent",
		stroke: pendingText.stroke,
		strokeWidth: 1,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		text: "",
		textColor: pendingText.textColor ?? pendingText.stroke,
		fontSize: pendingText.fontSize,
		fontFamily: pendingText.fontFamily,
		textAlign: pendingText.textAlign ?? "left",
		fontWeight: pendingText.fontWeight ?? "normal",
		fontStyle: pendingText.fontStyle ?? "normal",
		textDecoration: pendingText.textDecoration ?? "none",
	} as CanvasElement;
}

export const isGenericGeometry = (el: CanvasElement) =>
	(el.type === "rectangle" ||
		el.type === "ellipse" ||
		el.type === "diamond" ||
		el.type === "triangle" ||
		el.type === "cloud") &&
	el.customData?.skedraType !== "sticky-note";

export function resolveInspectedElements(options: {
	pendingText: PendingText | null | undefined;
	editingTextId: string | null | undefined;
	elements: Map<string, CanvasElement>;
	selected: CanvasElement[];
}): CanvasElement[] {
	const { pendingText, editingTextId, elements, selected } = options;
	if (pendingText) return [buildPendingTextElement(pendingText)];
	if (editingTextId) {
		const editingElement = elements.get(editingTextId);
		return editingElement ? [editingElement] : [];
	}
	return selected;
}
