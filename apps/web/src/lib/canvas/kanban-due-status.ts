import { translate } from "@/lib/i18n";
import { getCurrentLocale } from "@/stores/locale";

export interface KanbanDueStatus {
	label: string;
	icon: string;
	textColor: string;
	background: string;
	kind: "default" | "due-soon" | "overdue" | "overdue-long" | "complete";
}

export function getKanbanDueStatus(
	dueDate: string | null | undefined,
	dueComplete: boolean,
): KanbanDueStatus {
	const locale = getCurrentLocale();

	if (!dueDate) {
		return {
			label: translate(locale, "kanbanStatus.due"),
			icon: "📅",
			textColor: "var(--kanban-card-muted)",
			background: "transparent",
			kind: "default",
		};
	}

	if (dueComplete) {
		return {
			label: translate(locale, "kanbanStatus.done"),
			icon: "✅",
			textColor: "var(--kanban-due-complete-text)",
			background: "var(--kanban-due-complete-bg)",
			kind: "complete",
		};
	}

	const parsedDate = parseDateTimeValue(dueDate);
	if (!parsedDate) {
		return {
			label: translate(locale, "kanbanStatus.due"),
			icon: "📅",
			textColor: "var(--kanban-card-muted)",
			background: "transparent",
			kind: "default",
		};
	}

	const now = new Date();
	const diffMs = parsedDate.getTime() - now.getTime();
	if (diffMs < 0) {
		const overdueForMs = Math.abs(diffMs);
		const longOverdue = overdueForMs > 24 * 60 * 60 * 1000;
		return {
			label: translate(locale, "kanbanStatus.overdue"),
			icon: "⏰",
			textColor: longOverdue
				? "var(--kanban-due-overdue-long-text)"
				: "var(--kanban-due-overdue-text)",
			background: longOverdue
				? "var(--kanban-due-overdue-long-bg)"
				: "var(--kanban-due-overdue-bg)",
			kind: longOverdue ? "overdue-long" : "overdue",
		};
	}

	if (diffMs <= 24 * 60 * 60 * 1000) {
		return {
			label: translate(locale, "kanbanStatus.dueSoon"),
			icon: "⚠️",
			textColor: "var(--kanban-due-soon-text)",
			background: "var(--kanban-due-soon-bg)",
			kind: "due-soon",
		};
	}

	return {
		label: translate(locale, "kanbanStatus.due"),
		icon: "📅",
		textColor: "var(--kanban-due-default-text)",
		background: "var(--kanban-due-default-bg)",
		kind: "default",
	};
}

export function formatKanbanDateTime(value: string): string {
	const locale = getCurrentLocale();
	const match = value.match(
		/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/,
	);
	if (match) {
		const [, year, month, day, hours, minutes] = match;
		if (hours && minutes) {
			return locale === "en"
				? `${month}/${day}/${year}, ${hours}:${minutes}`
				: `${day}.${month}.${year}, ${hours}:${minutes}`;
		}
		return locale === "en"
			? `${month}/${day}/${year}`
			: `${day}.${month}.${year}`;
	}

	try {
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return value;
		return parsed.toLocaleString(locale === "en" ? "en-US" : "de-DE", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return value;
	}
}

function parseDateTimeValue(value: string): Date | null {
	const match = value.match(
		/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/,
	);
	if (match) {
		const [, year, month, day, hours = "0", minutes = "0"] = match;
		const date = new Date(
			Number(year),
			Number(month) - 1,
			Number(day),
			Number(hours),
			Number(minutes),
		);
		return Number.isNaN(date.getTime()) ? null : date;
	}

	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}
