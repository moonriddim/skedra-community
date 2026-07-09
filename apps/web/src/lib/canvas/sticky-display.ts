import { getCurrentLocale } from "@/stores/locale";
import {
	type CanvasElement,
	STICKY_NOTE_TEXT_PADDING,
} from "@skedra/canvas-core";
import { nanoid } from "nanoid";
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
		: "Ãœberschrift (optional)";
}

export function getStickyNoteItemPlaceholder(): string {
	return getCurrentLocale() === "en" ? "List itemâ€¦" : "Eintragâ€¦";
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

function parseLegacyStickyText(text: string): {
	mode: StickyNoteMode;
	text: string;
	checklist: StickyChecklistItem[];
} {
	const trimmed = text.trim();
	if (!trimmed) {
		return { mode: "note", text: "", checklist: [] };
	}

	const lines = text.split(/\r?\n/);
	const firstLine = lines[0]?.trim() ?? "";
	const bodyLines = lines
		.slice(1)
		.map((line) => line.trim())
		.filter(Boolean);

	if (bodyLines.length === 0) {
		return { mode: "note", text: trimmed, checklist: [] };
	}

	const hasListSyntax = bodyLines.some(
		(line) => /^\[( |x|X)\]\s*/.test(line) || /^[-*â€¢]\s+/.test(line),
	);
	if (!hasListSyntax) {
		return { mode: "note", text: trimmed, checklist: [] };
	}

	const checklist = bodyLines.map((line) => {
		const checkboxMatch = line.match(/^\[( |x|X)\]\s*(.*)$/);
		if (checkboxMatch) {
			return {
				id: nanoid(),
				text: checkboxMatch[2] ?? "",
				completed: checkboxMatch[1]?.toLowerCase() === "x",
			};
		}
		const bulletMatch = line.match(/^[-*â€¢]\s+(.*)$/);
		return {
			id: nanoid(),
			text: bulletMatch ? (bulletMatch[1] ?? "") : line,
			completed: false,
		};
	});

	return {
		mode: "checklist",
		text: firstLine,
		checklist: sanitizeStickyChecklistForStorage(checklist),
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

	if (element.customData?.stickyChecklist !== undefined) {
		return "note";
	}

	return parseLegacyStickyText(element.text ?? "").mode;
}

/** Liest Modus, Text und optionale Checkliste */
export function getStickyNoteContent(element: CanvasElement): {
	mode: StickyNoteMode;
	text: string;
	checklist: StickyChecklistItem[];
} {
	const mode = getStickyNoteMode(element);

	if (
		element.customData?.stickyNoteMode !== undefined ||
		element.customData?.stickyChecklist !== undefined
	) {
		return {
			mode,
			text: element.text ?? "",
			checklist:
				mode === "checklist"
					? normalizeStickyChecklist(element.customData?.stickyChecklist)
					: [],
		};
	}

	return parseLegacyStickyText(element.text ?? "");
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
		.map((item) => `â€¢ ${item.text.trim()}`);
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
