import type { CanvasElement } from "./types";

export type StickyNoteMode = "note" | "checklist";

export interface StickyChecklistItem {
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

export function createStickyChecklistItem(text = ""): StickyChecklistItem {
	return { id: createStickyItemId(), text, completed: false };
}

export function normalizeStickyChecklist(
	value: unknown,
): StickyChecklistItem[] {
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

export function sanitizeStickyChecklistForStorage(
	items: StickyChecklistItem[],
): StickyChecklistItem[] {
	return items.filter((item) => item.text.trim().length > 0 || item.completed);
}

export function prepareStickyChecklistForEditing(
	items: StickyChecklistItem[],
): StickyChecklistItem[] {
	const stored = sanitizeStickyChecklistForStorage(items);
	if (stored.length === 0) return [createStickyChecklistItem()];
	const last = stored[stored.length - 1];
	return last?.text.trim().length
		? [...stored, createStickyChecklistItem()]
		: stored;
}

export function toggleStickyChecklistItem(
	checklist: StickyChecklistItem[],
	itemId: string,
): StickyChecklistItem[] {
	return checklist.map((item) =>
		item.id === itemId ? { ...item, completed: !item.completed } : item,
	);
}

export function isStickyNote(
	element: { customData?: Record<string, unknown> } | undefined | null,
): boolean {
	return element?.customData?.skedraType === "sticky-note";
}

export function getStickyNoteMode(element: CanvasElement): StickyNoteMode {
	const stored = element.customData?.stickyNoteMode;
	if (stored === "note" || stored === "checklist") return stored;

	const checklist = normalizeStickyChecklist(
		element.customData?.stickyChecklist,
	);
	if (checklist.some((item) => item.text.trim() || item.completed)) {
		return "checklist";
	}

	return "note";
}

export function getStickyNoteContent(element: CanvasElement): {
	mode: StickyNoteMode;
	text: string;
	checklist: StickyChecklistItem[];
} {
	const mode = getStickyNoteMode(element);
	return {
		mode,
		text: element.text ?? "",
		checklist:
			mode === "checklist"
				? normalizeStickyChecklist(element.customData?.stickyChecklist)
				: [],
	};
}

/** Preserves the approved Web migration when switching sticky-note modes. */
export function buildStickyNoteModeChange(
	element: CanvasElement,
	nextMode: StickyNoteMode,
): Partial<CanvasElement> {
	const current = getStickyNoteContent(element);
	if (current.mode === nextMode) {
		return {
			customData: {
				...readStickyCustomData(element),
				skedraType: "sticky-note",
				stickyNoteMode: nextMode,
			},
		};
	}

	if (nextMode === "checklist") {
		return {
			text: current.text.trim(),
			customData: {
				...readStickyCustomData(element),
				skedraType: "sticky-note",
				stickyNoteMode: "checklist",
				stickyChecklist:
					current.mode === "checklist" && current.checklist.length > 0
						? sanitizeStickyChecklistForStorage(current.checklist)
						: [],
			},
		};
	}

	const itemLines = current.checklist
		.filter((item) => item.text.trim())
		.map((item) => `- ${item.text.trim()}`);
	const merged = [current.text.trim(), ...itemLines].filter(Boolean).join("\n");

	return {
		text: merged,
		customData: {
			...readStickyCustomData(element),
			skedraType: "sticky-note",
			stickyNoteMode: "note",
			stickyChecklist: [],
		},
	};
}

function readStickyCustomData(element: CanvasElement): Record<string, unknown> {
	const raw = element.customData;
	if (!raw || typeof raw !== "object") return {};
	return { ...raw };
}
