export type CanvasEditorStickyNoteMode = "note" | "checklist";

export interface CanvasEditorStickyChecklistItem {
	id: string;
	text: string;
	completed: boolean;
}

function createStickyItemId() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `sticky-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createCanvasEditorStickyChecklistItem(
	text = "",
): CanvasEditorStickyChecklistItem {
	return { id: createStickyItemId(), text, completed: false };
}

export function normalizeCanvasEditorStickyChecklist(
	value: unknown,
): CanvasEditorStickyChecklistItem[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry, index) => {
		if (!entry || typeof entry !== "object") return [];
		const item = entry as Record<string, unknown>;
		return [
			{
				id:
					typeof item.id === "string" && item.id
						? item.id
						: `sticky-item-${index}`,
				text: typeof item.text === "string" ? item.text : "",
				completed: Boolean(item.completed),
			},
		];
	});
}

export function sanitizeCanvasEditorStickyChecklistForStorage(
	items: CanvasEditorStickyChecklistItem[],
): CanvasEditorStickyChecklistItem[] {
	return items.filter((item) => item.text.trim().length > 0 || item.completed);
}

export function prepareCanvasEditorStickyChecklistForEditing(
	items: CanvasEditorStickyChecklistItem[],
): CanvasEditorStickyChecklistItem[] {
	const stored = sanitizeCanvasEditorStickyChecklistForStorage(items);
	if (stored.length === 0) return [createCanvasEditorStickyChecklistItem()];
	const last = stored[stored.length - 1];
	return last?.text.trim().length
		? [...stored, createCanvasEditorStickyChecklistItem()]
		: stored;
}

export function toggleCanvasEditorStickyChecklistItem(
	checklist: CanvasEditorStickyChecklistItem[],
	itemId: string,
): CanvasEditorStickyChecklistItem[] {
	return checklist.map((item) =>
		item.id === itemId ? { ...item, completed: !item.completed } : item,
	);
}
