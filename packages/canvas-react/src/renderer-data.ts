import type { CanvasElement } from "@skedra/canvas-core";

export interface RendererStickyChecklistItem {
	id: string;
	text: string;
	completed: boolean;
}

export function getRendererStickyNoteContent(element: CanvasElement): {
	mode: "note" | "checklist";
	text: string;
	checklist: RendererStickyChecklistItem[];
} {
	const rawChecklist = element.customData?.stickyChecklist;
	const checklist = Array.isArray(rawChecklist)
		? rawChecklist.flatMap((value, index) => {
				if (!value || typeof value !== "object") return [];
				const item = value as Record<string, unknown>;
				return [
					{
						id: typeof item.id === "string" ? item.id : `item-${index}`,
						text: typeof item.text === "string" ? item.text : "",
						completed: item.completed === true,
					},
				];
			})
		: [];
	const storedMode = element.customData?.stickyNoteMode;
	const mode =
		storedMode === "checklist" ||
		(storedMode !== "note" &&
			checklist.some((item) => item.text.trim() || item.completed))
			? "checklist"
			: "note";
	return { mode, text: element.text ?? "", checklist };
}

export function getRendererStickyNoteTextStyle(element: CanvasElement) {
	return {
		color: element.textColor ?? "#1e1e1e",
		fontFamily: element.fontFamily ?? "Comic Sans MS, Comic Sans, cursive",
		fontSize: element.fontSize ?? 20,
		textAlign: (element.textAlign ?? "left") as "left" | "center" | "right",
		fontWeight: (element.fontWeight ?? "normal") as "normal" | "bold",
		fontStyle: (element.fontStyle ?? "normal") as "normal" | "italic",
		textDecoration: (element.textDecoration ?? "none") as "none" | "underline",
	};
}

export function getRendererTemplateAccent(
	element: CanvasElement | null | undefined,
): string | null {
	if (
		element?.type !== "frame" ||
		element.customData?.skedraType !== "template-section"
	) {
		return null;
	}
	const accent = element.customData.templateAccent;
	return typeof accent === "string" ? accent : null;
}
