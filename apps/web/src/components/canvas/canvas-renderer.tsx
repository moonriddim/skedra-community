import {
	CANVAS_DEFAULT_FONT,
	KANBAN_FONT_FAMILY,
	TOOL_FONT_FAMILY,
} from "@/lib/canvas/canvas-defaults";
import {
	formatKanbanDateTime,
	getKanbanDueStatus,
} from "@/lib/canvas/kanban-due-status";
import { translate } from "@/lib/i18n";
import { getUserInitials } from "@/lib/user-initials";
import { getCurrentLocale } from "@/stores/locale";
import {
	type CanvasRendererConfig,
	type CanvasRendererProps,
	CanvasRenderer as SharedCanvasRenderer,
} from "@skedra/canvas-react";
import { useMemo } from "react";
import { useCanvasCommands } from "./canvas-commands";

export function CanvasRenderer(props: CanvasRendererProps) {
	const commands = useCanvasCommands();
	const config = useMemo<CanvasRendererConfig>(
		() => ({
			defaultFontFamily: CANVAS_DEFAULT_FONT,
			toolFontFamily: TOOL_FONT_FAMILY,
			kanbanFontFamily: KANBAN_FONT_FAMILY,
			translate: (key, params) => translate(getCurrentLocale(), key, params),
			formatDateTime: formatKanbanDateTime,
			getDueStatus: getKanbanDueStatus,
			getUserInitials,
			actions: {
				openKanbanCard: commands.openKanbanCard,
				addKanbanCard: commands.addKanbanCard,
				addTemplateSticky: commands.addTemplateSticky,
				toggleStickyChecklistItem: commands.toggleStickyChecklistItem,
			},
		}),
		[commands],
	);
	return <SharedCanvasRenderer {...props} config={config} />;
}
