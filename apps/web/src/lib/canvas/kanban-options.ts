import { getCurrentLocale } from "@/stores/locale";
import type { KanbanPriority } from "@skedra/canvas-core";

export function getDefaultKanbanCardTitle(): string {
	return getCurrentLocale() === "en" ? "New card" : "Neue Karte";
}

export function getDefaultKanbanListName(): string {
	return getCurrentLocale() === "en" ? "New list" : "Neue Liste";
}

export function getDefaultKanbanBoardLists(): Array<{
	name: string;
	cards: string[];
}> {
	return getCurrentLocale() === "en"
		? [
				{ name: "To do", cards: ["Task 1", "Task 2"] },
				{ name: "In progress", cards: ["Task 3"] },
				{ name: "Done", cards: [] },
			]
		: [
				{ name: "To Do", cards: ["Aufgabe 1", "Aufgabe 2"] },
				{ name: "In Bearbeitung", cards: ["Aufgabe 3"] },
				{ name: "Erledigt", cards: [] },
			];
}

export function getKanbanPriorities(): {
	value: KanbanPriority;
	label: string;
	color: string;
}[] {
	return getCurrentLocale() === "en"
		? [
				{ value: "low", label: "Low", color: "#69DB7C" },
				{ value: "medium", label: "Medium", color: "#FFD43B" },
				{ value: "high", label: "High", color: "#FFA94D" },
				{ value: "urgent", label: "Urgent", color: "#FF6B6B" },
			]
		: [
				{ value: "low", label: "Niedrig", color: "#69DB7C" },
				{ value: "medium", label: "Mittel", color: "#FFD43B" },
				{ value: "high", label: "Hoch", color: "#FFA94D" },
				{ value: "urgent", label: "Dringend", color: "#FF6B6B" },
			];
}
