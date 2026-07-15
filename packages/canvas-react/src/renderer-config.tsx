import {
	formatKanbanDateTimeValue,
	parseKanbanDateTime,
	resolveKanbanDueKind,
} from "@skedra/canvas-core";
import { type ReactNode, createContext, useContext, useMemo } from "react";

export interface CanvasRendererDueStatus {
	label: string;
	icon: string;
	textColor: string;
	background: string;
	kind: "default" | "due-soon" | "overdue" | "overdue-long" | "complete";
}

export interface CanvasRendererActions {
	openKanbanCard: (id: string) => void;
	addKanbanCard: (listId: string) => void;
	addTemplateSticky: (sectionId: string) => void;
	toggleStickyChecklistItem: (elementId: string, itemId: string) => void;
}

export interface CanvasRendererConfig {
	defaultFontFamily?: string;
	toolFontFamily?: string;
	kanbanFontFamily?: string;
	svgIdPrefix?: string;
	interactive?: boolean;
	translate?: (key: string, params?: Record<string, string | number>) => string;
	formatDateTime?: (value: string) => string;
	getDueStatus?: (
		dueDate: string | null | undefined,
		dueComplete: boolean,
	) => CanvasRendererDueStatus;
	getUserInitials?: (name: string) => string;
	actions?: Partial<CanvasRendererActions>;
}

interface ResolvedCanvasRendererConfig
	extends Required<Omit<CanvasRendererConfig, "actions">> {
	actions: CanvasRendererActions;
}

const noop = () => undefined;

const FALLBACK_LABELS: Record<string, string> = {
	"canvas.kanban.attachmentCount": "{count} attachments",
	"canvas.kanban.moreTasks": "+{count} more",
	"canvas.kanban.newCard": "New card",
	"canvas.kanban.start": "Start",
	"canvas.kanban.tasks": "tasks",
	"canvas.properties.frameDefault": "Frame",
	"canvas.properties.listImageAlt": "List cover",
	"canvas.sticky.itemPlaceholder": "List item...",
	"canvas.sticky.notePlaceholder": "Note...",
	"canvas.templateTools.addNote": "Add note",
	"kanbanStatus.done": "Done",
	"kanbanStatus.due": "Due",
	"kanbanStatus.dueSoon": "Due soon",
	"kanbanStatus.overdue": "Overdue",
};

function defaultTranslate(
	key: string,
	params: Record<string, string | number> = {},
): string {
	const template = FALLBACK_LABELS[key] ?? key;
	return template.replace(/\{([^}]+)\}/g, (_match, name: string) =>
		String(params[name] ?? `{${name}}`),
	);
}

function defaultFormatDateTime(value: string): string {
	return formatKanbanDateTimeValue(value, "en");
}

export function resolveCanvasRendererDueStatus(
	dueDate: string | null | undefined,
	dueComplete: boolean,
	translate: CanvasRendererConfig["translate"] = defaultTranslate,
	now = new Date(),
): CanvasRendererDueStatus {
	const t = translate ?? defaultTranslate;
	const kind = resolveKanbanDueKind(dueDate, dueComplete, now);
	if (kind === "complete") {
		return {
			label: t("kanbanStatus.done"),
			icon: "✅",
			textColor: "var(--kanban-due-complete-text)",
			background: "var(--kanban-due-complete-bg)",
			kind,
		};
	}
	if (kind === "overdue" || kind === "overdue-long") {
		return {
			label: t("kanbanStatus.overdue"),
			icon: "⏰",
			textColor:
				kind === "overdue-long"
					? "var(--kanban-due-overdue-long-text)"
					: "var(--kanban-due-overdue-text)",
			background:
				kind === "overdue-long"
					? "var(--kanban-due-overdue-long-bg)"
					: "var(--kanban-due-overdue-bg)",
			kind,
		};
	}
	if (kind === "due-soon") {
		return {
			label: t("kanbanStatus.dueSoon"),
			icon: "⚠️",
			textColor: "var(--kanban-due-soon-text)",
			background: "var(--kanban-due-soon-bg)",
			kind,
		};
	}
	const hasValidDueDate = dueDate
		? parseKanbanDateTime(dueDate) != null
		: false;
	return {
		label: t("kanbanStatus.due"),
		icon: "📅",
		textColor: hasValidDueDate
			? "var(--kanban-due-default-text)"
			: "var(--kanban-card-muted)",
		background: hasValidDueDate
			? "var(--kanban-due-default-bg)"
			: "transparent",
		kind: "default",
	};
}

const defaultGetDueStatus = resolveCanvasRendererDueStatus;

function defaultGetUserInitials(name: string): string {
	return name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

const DEFAULT_CONFIG: ResolvedCanvasRendererConfig = {
	defaultFontFamily: '"Kalam", "Architects Daughter", "Segoe Print", cursive',
	toolFontFamily: '"Kalam", "Architects Daughter", "Segoe Print", cursive',
	kanbanFontFamily: "system-ui, sans-serif",
	svgIdPrefix: "skedra-canvas",
	interactive: true,
	translate: defaultTranslate,
	formatDateTime: defaultFormatDateTime,
	getDueStatus: defaultGetDueStatus,
	getUserInitials: defaultGetUserInitials,
	actions: {
		openKanbanCard: noop,
		addKanbanCard: noop,
		addTemplateSticky: noop,
		toggleStickyChecklistItem: noop,
	},
};

const CanvasRendererConfigContext =
	createContext<ResolvedCanvasRendererConfig>(DEFAULT_CONFIG);

export function CanvasRendererProvider({
	config,
	children,
}: {
	config?: CanvasRendererConfig;
	children: ReactNode;
}) {
	const value = useMemo<ResolvedCanvasRendererConfig>(
		() => ({
			...DEFAULT_CONFIG,
			...config,
			actions: {
				...DEFAULT_CONFIG.actions,
				...config?.actions,
			},
		}),
		[config],
	);
	return (
		<CanvasRendererConfigContext.Provider value={value}>
			{children}
		</CanvasRendererConfigContext.Provider>
	);
}

export function useCanvasRendererConfig(): ResolvedCanvasRendererConfig {
	return useContext(CanvasRendererConfigContext);
}
