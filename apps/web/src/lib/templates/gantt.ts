import type { CanvasThemeState } from "@/lib/canvas/canvas-defaults";
import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import { getCurrentLocale } from "@/stores/locale";
import {
	type CanvasElement,
	type GanttAppearance,
	createCanvasTemplateElements,
} from "@skedra/canvas-core";
import { templateText } from "./shared";

export function ganttAppearance(
	theme?: CanvasThemeState,
): Partial<GanttAppearance> {
	if (theme?.resolvedTheme !== "dark") return {};
	return {
		background: "#111915",
		headerFill: "#1D2A23",
		rowFill: "#111915",
		alternateRowFill: "#16211B",
		gridStroke: "#3A4A41",
		textColor: "#E6EFE8",
		mutedTextColor: "#B7C5BC",
		dependencyStroke: "#94A3B8",
	};
}

export function ganttDateLabel(startDate: string, endDate: string): string {
	const locale = getCurrentLocale() === "de" ? "de-CH" : "en-US";
	const formatter = new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});
	const format = (value: string) =>
		formatter.format(new Date(`${value}T00:00:00.000Z`));
	return startDate === endDate
		? format(startDate)
		: `${format(startDate)}–${format(endDate)}`;
}

export function createGanttTemplate(
	cx: number,
	cy: number,
	theme?: CanvasThemeState,
): CanvasElement[] {
	const today = new Date().toISOString().slice(0, 10);
	return createCanvasTemplateElements({
		id: "gantt",
		x: cx,
		y: cy,
		defaults: getCanvasElementFactoryDefaults(theme),
		text: templateText,
		gantt: {
			anchorDefaultTasksToToday: true,
			appearance: ganttAppearance(theme),
			dateLabel: ganttDateLabel,
			today,
		},
	});
}
