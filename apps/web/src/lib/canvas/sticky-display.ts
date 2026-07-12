import { getCurrentLocale } from "@/stores/locale";
import {
	type CanvasElement,
	STICKY_NOTE_TEXT_PADDING,
} from "@skedra/canvas-core";
import {
	type StickyChecklistItem,
	type StickyNoteMode,
	normalizeStickyChecklist,
	sanitizeStickyChecklistForStorage,
} from "./sticky-checklist";

export { STICKY_NOTE_TEXT_PADDING };

export function getStickyNoteNotePlaceholder(): string {
	return getCurrentLocale() === "en" ? "Note..." : "Notiz...";
}

export function getStickyNotePlaceholder(): string {
	return getStickyNoteNotePlaceholder();
}

export function getStickyColors() {
	const locale = getCurrentLocale();
	return locale === "en"
		? [
				{ name: "Yellow", value: "#FFF3BF" },
				{ name: "Green", value: "#D3F9D8" },
				{ name: "Blue", value: "#D0EBFF" },
				{ name: "Pink", value: "#FFD6E0" },
				{ name: "Orange", value: "#FFE0CC" },
				{ name: "Purple", value: "#E5DBFF" },
			]
		: [
				{ name: "Gelb", value: "#FFF3BF" },
				{ name: "Gruen", value: "#D3F9D8" },
				{ name: "Blau", value: "#D0EBFF" },
				{ name: "Rosa", value: "#FFD6E0" },
				{ name: "Orange", value: "#FFE0CC" },
				{ name: "Lila", value: "#E5DBFF" },
			];
}

export function isStickyNote(
	element: { customData?: Record<string, unknown> } | undefined | null,
): boolean {
	return element?.customData?.skedraType === "sticky-note";
}

export function getStickyNoteOptionalTitlePlaceholder(): string {
	return getCurrentLocale() === "en"
		? "Title (optional)"
		: "Ueberschrift (optional)";
}

export function getStickyNoteItemPlaceholder(): string {
	return getCurrentLocale() === "en" ? "List item..." : "Eintrag...";
}

export function getStickyNoteTextStyle(el: CanvasElement) {
	return {
		color: el.textColor ?? "#1e1e1e",
		fontFamily: el.fontFamily ?? "Comic Sans MS, Comic Sans, cursive",
		fontSize: el.fontSize ?? 20,
		textAlign: (el.textAlign ?? "left") as "left" | "center" | "right",
		fontWeight: (el.fontWeight ?? "normal") as "normal" | "bold",
		fontStyle: (el.fontStyle ?? "normal") as "normal" | "italic",
		textDecoration: (el.textDecoration ?? "none") as "none" | "underline",
	};
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

/** Liest Modus, Text und optionale Checkliste */
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

/** Wechsel zwischen Notiz- und Checklisten-Modus inkl. Inhalts-Migration */
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
	return { ...(raw as Record<string, unknown>) };
}
