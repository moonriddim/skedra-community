/**
 * Normalisierung von Bibliotheks-Symbolen (Ursprung, Gruppe).
 * Ausgelagert, um Zirkular-Imports zwischen library-utils und excalidraw-import zu vermeiden.
 */

import type { CanvasElement } from "@skedra/canvas-core";
import { getCombinedBBox } from "@skedra/canvas-core";
import { nanoid } from "nanoid";

/** Elemente auf lokalen Ursprung (0,0) verschieben — für Bibliotheks-Speicherung. */
function normalizeElementsForLibrary(
	elements: CanvasElement[],
): CanvasElement[] {
	const bbox = getCombinedBBox(elements);
	if (!bbox) return elements.map((el) => ({ ...el }));

	const offsetX = bbox.x;
	const offsetY = bbox.y;
	const groupMap = new Map<string, string>();

	return elements.map((el) => {
		const next: CanvasElement = {
			...el,
			x: el.x - offsetX,
			y: el.y - offsetY,
			groupId: el.groupId ? remapGroupId(el.groupId, groupMap) : null,
			frameId: undefined,
			locked: false,
		};
		return next;
	});
}

function remapGroupId(oldId: string, map: Map<string, string>): string {
	let next = map.get(oldId);
	if (!next) {
		next = nanoid(8);
		map.set(oldId, next);
	}
	return next;
}

/** Ein Bibliotheks-Symbol: lokaler Ursprung + gemeinsame groupId für alle Teile. */
export function prepareLibraryItemForStorage(
	elements: CanvasElement[],
): CanvasElement[] {
	if (elements.length === 0) return [];
	const symbolGroupId = nanoid(8);
	const normalized = normalizeElementsForLibrary(elements);
	return normalized.map((el) => ({ ...el, groupId: symbolGroupId }));
}
