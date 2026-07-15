import { getCurrentLocale } from "@/stores/locale";
import {
	buildStickyNoteModeChange,
	getStickyNoteContent,
	getStickyNoteMode,
	isStickyNote,
} from "@skedra/canvas-core";

export {
	buildStickyNoteModeChange,
	getStickyNoteContent,
	getStickyNoteMode,
	isStickyNote,
};

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
