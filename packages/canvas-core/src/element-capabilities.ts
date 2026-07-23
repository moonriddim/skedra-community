import type { CanvasElement } from "./types";

const TEXT_EDITABLE_ELEMENT_TYPES = new Set<CanvasElement["type"]>([
	"text",
	"rectangle",
	"ellipse",
	"diamond",
	"triangle",
	"cloud",
	"frame",
	"line",
	"arrow",
]);

/** Elements whose primary label can be edited through the inline text editor. */
export function isCanvasTextEditableElement(
	element: Pick<CanvasElement, "type"> &
		Partial<Pick<CanvasElement, "customData">>,
): boolean {
	if (element.customData?.skedraType === "svg-path") return false;
	return TEXT_EDITABLE_ELEMENT_TYPES.has(element.type);
}

/** Schriftgroesse des Frame-Labels oberhalb der Frame-Kante (Canvas-Einheiten). */
export const FRAME_LABEL_FONT_SIZE = 12;
/** Horizontaler Versatz des Frame-Labels relativ zur linken Frame-Kante. */
export const FRAME_LABEL_OFFSET_X = 6;
/** Vertikaler Versatz der Label-Grundlinie oberhalb der oberen Frame-Kante. */
export const FRAME_LABEL_OFFSET_Y = 6;

/**
 * Einfacher Frame ohne Spezialrolle (keine Kanban-Liste, Template-Sektion,
 * Wireframe-Screen o. ae.). Nur solche Frames verhalten sich wie
 * Design-Frames: Label-Umbenennung, Groessen-Presets, kein Text-Editor
 * im Frame-Koerper. Frames mit skedraType behalten ihr Spezialverhalten.
 */
export function isPlainCanvasFrame(
	element: Pick<CanvasElement, "type" | "customData"> | null | undefined,
): boolean {
	if (!element || element.type !== "frame") return false;
	return element.customData?.skedraType == null;
}

/**
 * Frames whose visible label can be renamed directly on the canvas.
 * Wireframe screens keep their semantic role while sharing the canonical
 * frame-label editing behaviour with plain design frames.
 */
export function isCanvasFrameLabelEditable(
	element: Pick<CanvasElement, "type" | "customData"> | null | undefined,
): boolean {
	if (!element || element.type !== "frame") return false;
	const skedraType = element.customData?.skedraType;
	return skedraType == null || skedraType === "wireframe-screen";
}

/**
 * Trefferbereich des Frame-Labels in Canvas-Koordinaten. Das Label sitzt
 * oberhalb der Frame-Bounding-Box; die Breite wird aus der Textlaenge
 * geschaetzt (kein DOM-Zugriff noetig, damit der Hit-Test host-neutral bleibt).
 */
export function getFrameLabelHitBox(
	element: Pick<CanvasElement, "x" | "y" | "width" | "frameLabel" | "text">,
): { x: number; y: number; width: number; height: number } {
	const label = element.frameLabel || element.text || "Frame";
	/* ~0.66em mittlere Zeichenbreite bei system-ui, plus etwas Klick-Puffer. */
	const estimatedWidth =
		label.length * FRAME_LABEL_FONT_SIZE * 0.66 + FRAME_LABEL_OFFSET_X * 2;
	const width = Math.min(
		Math.max(48, estimatedWidth),
		Math.max(element.width, 48),
	);
	return {
		x: element.x,
		y: element.y - FRAME_LABEL_OFFSET_Y - FRAME_LABEL_FONT_SIZE - 4,
		width,
		height: FRAME_LABEL_FONT_SIZE + FRAME_LABEL_OFFSET_Y + 6,
	};
}

/** Prueft, ob ein Punkt (Canvas-Koordinaten) das Frame-Label trifft. */
export function frameLabelHitTest(
	element: CanvasElement,
	px: number,
	py: number,
): boolean {
	if (!isCanvasFrameLabelEditable(element)) return false;
	const box = getFrameLabelHitBox(element);
	return (
		px >= box.x &&
		px <= box.x + box.width &&
		py >= box.y &&
		py <= box.y + box.height
	);
}
