import type { CanvasElement } from "./types";

export type CanvasSearchMatchKind = "frame" | "text";

export interface CanvasSearchMatch {
	key: string;
	elementId: string;
	kind: CanvasSearchMatchKind;
	sourceText: string;
	matchStart: number;
	matchLength: number;
	previewStart: number;
	previewEnd: number;
}

const PREVIEW_BEFORE_CHARS = 24;
const PREVIEW_AFTER_CHARS = 48;

function getSearchableText(element: CanvasElement): {
	kind: CanvasSearchMatchKind;
	text: string;
} | null {
	if (element.type === "frame") {
		const text = element.frameLabel?.trim();
		return text ? { kind: "frame", text: element.frameLabel ?? text } : null;
	}

	const text = element.text?.trim();
	return text ? { kind: "text", text: element.text ?? text } : null;
}

function createPreviewRange(
	text: string,
	matchStart: number,
	matchLength: number,
) {
	let previewStart = Math.max(0, matchStart - PREVIEW_BEFORE_CHARS);
	let previewEnd = Math.min(
		text.length,
		matchStart + matchLength + PREVIEW_AFTER_CHARS,
	);

	const precedingSpace = text.lastIndexOf(" ", previewStart);
	if (previewStart > 0 && precedingSpace >= Math.max(0, previewStart - 12)) {
		previewStart = precedingSpace + 1;
	}
	const followingSpace = text.indexOf(" ", previewEnd);
	if (previewEnd < text.length && followingSpace <= previewEnd + 12) {
		previewEnd = followingSpace;
	}

	return { previewStart, previewEnd };
}

function compareSearchableElements(
	left: CanvasElement,
	right: CanvasElement,
): number {
	const leftFrame = left.type === "frame";
	const rightFrame = right.type === "frame";
	if (leftFrame !== rightFrame) return leftFrame ? -1 : 1;
	return (
		left.y - right.y || left.x - right.x || left.id.localeCompare(right.id)
	);
}

/**
 * Finds every case-insensitive occurrence in frame names and element text.
 * Results are stable and spatially ordered, with frames first to mirror the
 * canvas search grouping used by Excalidraw.
 */
export function findCanvasSearchMatches(
	elements: Iterable<CanvasElement>,
	query: string,
): CanvasSearchMatch[] {
	const normalizedQuery = query.trim().toLocaleLowerCase();
	if (!normalizedQuery) return [];

	const searchableElements = Array.from(elements)
		.filter((element) => getSearchableText(element) !== null)
		.sort(compareSearchableElements);
	const matches: CanvasSearchMatch[] = [];

	for (const element of searchableElements) {
		const searchable = getSearchableText(element);
		if (!searchable) continue;

		const normalizedText = searchable.text.toLocaleLowerCase();
		let matchStart = normalizedText.indexOf(normalizedQuery);
		while (matchStart !== -1) {
			const { previewStart, previewEnd } = createPreviewRange(
				searchable.text,
				matchStart,
				normalizedQuery.length,
			);
			matches.push({
				key: `${element.id}:${searchable.kind}:${matchStart}`,
				elementId: element.id,
				kind: searchable.kind,
				sourceText: searchable.text,
				matchStart,
				matchLength: normalizedQuery.length,
				previewStart,
				previewEnd,
			});
			matchStart = normalizedText.indexOf(
				normalizedQuery,
				matchStart + normalizedQuery.length,
			);
		}
	}

	return matches;
}
