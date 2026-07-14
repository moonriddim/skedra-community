import type { CanvasElement } from "./types";

const TEXT_EDITABLE_ELEMENT_TYPES = new Set<CanvasElement["type"]>([
	"text",
	"rectangle",
	"ellipse",
	"diamond",
	"frame",
	"line",
	"arrow",
]);

/** Elements whose primary label can be edited through the inline text editor. */
export function isCanvasTextEditableElement(
	element: Pick<CanvasElement, "type">,
): boolean {
	return TEXT_EDITABLE_ELEMENT_TYPES.has(element.type);
}
