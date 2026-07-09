import { nanoid } from "nanoid";

export type StickyNoteMode = "note" | "checklist";

export interface StickyChecklistItem {
	id: string;
	text: string;
	completed: boolean;
}

export function createStickyChecklistItem(text = ""): StickyChecklistItem {
	return { id: nanoid(), text, completed: false };
}

export function normalizeStickyChecklist(
	value: unknown,
): StickyChecklistItem[] {
	if (!Array.isArray(value)) return [];

	return value.flatMap((entry, index) => {
		if (!entry || typeof entry !== "object") return [];
		const item = entry as Record<string, unknown>;
		const text = typeof item.text === "string" ? item.text : "";
		return [
			{
				id:
					typeof item.id === "string" && item.id
						? item.id
						: `sticky-item-${index}`,
				text,
				completed: Boolean(item.completed),
			} satisfies StickyChecklistItem,
		];
	});
}

/** Beim Speichern: leere Zeilen entfernen */
export function sanitizeStickyChecklistForStorage(
	items: StickyChecklistItem[],
): StickyChecklistItem[] {
	return items.filter((item) => item.text.trim().length > 0 || item.completed);
}

/** Im Editor: eine leere Schlusszeile zum Weiterschreiben */
export function prepareStickyChecklistForEditing(
	items: StickyChecklistItem[],
): StickyChecklistItem[] {
	const stored = sanitizeStickyChecklistForStorage(items);
	if (stored.length === 0) return [createStickyChecklistItem()];
	const last = stored[stored.length - 1];
	if (last?.text.trim().length) {
		return [...stored, createStickyChecklistItem()];
	}
	return stored;
}

export function toggleStickyChecklistItem(
	checklist: StickyChecklistItem[],
	itemId: string,
): StickyChecklistItem[] {
	return checklist.map((item) =>
		item.id === itemId ? { ...item, completed: !item.completed } : item,
	);
}
