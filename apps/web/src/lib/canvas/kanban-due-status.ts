import { translate } from "@/lib/i18n";
import { getCurrentLocale } from "@/stores/locale";
import { formatKanbanDateTimeValue } from "@skedra/canvas-core";
import {
	type CanvasRendererDueStatus,
	resolveCanvasRendererDueStatus,
} from "@skedra/canvas-react";

export type KanbanDueStatus = CanvasRendererDueStatus;

export function getKanbanDueStatus(
	dueDate: string | null | undefined,
	dueComplete: boolean,
): KanbanDueStatus {
	const locale = getCurrentLocale();
	return resolveCanvasRendererDueStatus(dueDate, dueComplete, (key) =>
		translate(locale, key),
	);
}

export function formatKanbanDateTime(value: string): string {
	return formatKanbanDateTimeValue(value, getCurrentLocale());
}
