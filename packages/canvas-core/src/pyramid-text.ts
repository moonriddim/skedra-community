import {
	inverseTransformCanvasElementPoint,
	transformCanvasElementPoint,
} from "./geometry-bbox";
import { MAX_PYRAMID_SECTIONS, clampPyramidSections } from "./shape-geometry";
import type { CanvasElement } from "./types";

export function hasPyramidSectionText(element: CanvasElement): boolean {
	return (
		element.type === "triangle" &&
		(clampPyramidSections(element.pyramidSections) > 1 ||
			Array.isArray(element.customData?.pyramidSectionTexts))
	);
}

/** Section indices run from the tip to the base, including flipped pyramids. */
export function getPyramidSectionAtPoint(
	element: CanvasElement,
	x: number,
	y: number,
): number | null {
	if (!hasPyramidSectionText(element) || element.height <= 0) return null;
	const point = inverseTransformCanvasElementPoint(element, { x, y });
	const count = clampPyramidSections(element.pyramidSections);
	return Math.max(
		0,
		Math.min(
			count - 1,
			Math.floor(((point.y - element.y) / element.height) * count),
		),
	);
}

/** Keep hidden sections when the divider count is reduced and later restored. */
export function getPyramidSectionTexts(element: CanvasElement): string[] {
	const stored = element.customData?.pyramidSectionTexts;
	if (Array.isArray(stored)) {
		return stored
			.slice(0, MAX_PYRAMID_SECTIONS)
			.map((value) => (typeof value === "string" ? value : ""));
	}
	const texts: string[] = [];
	if (element.text) {
		texts[Math.floor(clampPyramidSections(element.pyramidSections) / 2)] =
			element.text;
	}
	return texts;
}

/** A virtual rectangle shares typography with the pyramid and follows its size. */
export function getPyramidSectionTextElement(
	element: CanvasElement,
	section: number,
	forEditing = false,
): CanvasElement {
	const count = clampPyramidSections(element.pyramidSections);
	const index = Math.max(0, Math.min(count - 1, Math.floor(section)));
	const height = element.height / count;
	const width = element.width * ((index + 0.5) / count);
	const center = {
		x: element.x + element.width / 2,
		y: element.y + height * (index + 0.5),
	};
	const anchor = forEditing
		? transformCanvasElementPoint(element, center)
		: center;
	return {
		...element,
		type: "rectangle",
		x: anchor.x - width / 2,
		y: anchor.y - height / 2,
		width,
		height,
		text: getPyramidSectionTexts(element)[index] ?? "",
		textAlign: element.textAlign ?? "center",
		verticalAlign: element.verticalAlign ?? "middle",
	};
}

export function buildPyramidSectionTextUpdate(
	element: CanvasElement,
	section: number,
	text: string,
): Partial<CanvasElement> {
	const texts = getPyramidSectionTexts(element);
	const index = Number.isFinite(section)
		? Math.max(
				0,
				Math.min(
					clampPyramidSections(element.pyramidSections) - 1,
					Math.floor(section),
				),
			)
		: 0;
	texts[index] = text;
	return {
		text: "",
		customData: {
			...element.customData,
			pyramidSectionTexts: Array.from(texts, (value) => value ?? ""),
		},
	};
}
