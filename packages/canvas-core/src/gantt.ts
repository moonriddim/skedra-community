import {
	type CanvasElementFactoryDefaults,
	createBaseCanvasElement,
} from "./element-factory";
import type { CanvasElement } from "./types";

export const GANTT_CHART_TYPE = "gantt-chart";
export const GANTT_TASK_TYPE = "gantt-task";
export const GANTT_DEPENDENCY_TYPE = "gantt-dependency";

export const GANTT_DEFAULT_DAY_WIDTH = 28;
export const GANTT_DEFAULT_LABEL_WIDTH = 260;
export const GANTT_DEFAULT_ROW_HEIGHT = 58;
export const GANTT_DEFAULT_HEADER_HEIGHT = 56;
/** Every new plan starts with a full year that can be navigated by scrolling. */
export const GANTT_DEFAULT_DAY_COUNT = 365;
/** Up to ten complete calendar years can be exposed incrementally. */
export const GANTT_MAX_DAY_COUNT = 3660;
/** New charts stay compact at six weeks until the frame is widened. */
export const GANTT_CANVAS_DEFAULT_VISIBLE_DAYS = 42;
/** A chart frame may be widened to twelve weeks before internal scrolling. */
export const GANTT_CANVAS_MAX_VISIBLE_DAYS = 84;
export const GANTT_CANVAS_SCROLLBAR_HEIGHT = 18;

/**
 * Clean UI font for all Gantt text. The canvas' default hand-drawn font
 * renders small numbers (progress %, day numbers) illegibly, so charts opt
 * into a legible sans-serif — a caller can still override via `fontFamily`.
 */
export const GANTT_DEFAULT_FONT_FAMILY =
	"system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Empty timeline columns kept after the last task so bars never touch the edge. */
const GANTT_TRAILING_DAYS = 1;
/** Places the current day inside the active part of a newly-created example. */
const GANTT_DEFAULT_TODAY_TASK_OFFSET = 12;

export type GanttTaskStatus = "planned" | "active" | "completed" | "delayed";

/**
 * Semantic row type used when a timeline also acts as a team availability
 * calendar. `project` keeps the classic status-driven Gantt behaviour while
 * the other categories receive stable colors across the canvas and editor.
 */
export type GanttBuiltInTaskCategory =
	| "project"
	| "vacation"
	| "absence"
	| "construction-site"
	| "home-office";

/**
 * Entry categories are intentionally open-ended. The built-in values above
 * are optional presets; hosts may persist any stable custom id here.
 */
export type GanttTaskCategory = string;

export type GanttDependencyKind =
	| "finish-to-start"
	| "start-to-start"
	| "finish-to-finish"
	| "start-to-finish";

export interface GanttTaskInput {
	id: string;
	title: string;
	/** Zero-based offset from the chart start date. */
	startDay: number;
	durationDays: number;
	progress?: number;
	status?: GanttTaskStatus;
	category?: GanttTaskCategory;
	categoryLabel?: string;
	owner?: string;
	color?: string;
	milestone?: boolean;
	/** Marks work that directly affects the project end date. */
	critical?: boolean;
	/** Summary row (phase) that aggregates its child tasks. */
	group?: boolean;
	/** Id of the parent group. Only one nesting level is supported. */
	parentId?: string;
	/** Collapsed groups hide their children in every rendering. */
	collapsed?: boolean;
}

export interface GanttDependencyInput {
	fromTaskId: string;
	toTaskId: string;
	type?: GanttDependencyKind;
}

export interface GanttChartTask extends GanttTaskInput {
	progress: number;
	status: GanttTaskStatus;
	milestone: boolean;
	critical: boolean;
	group: boolean;
	collapsed: boolean;
}

export interface GanttAppearance {
	background: string;
	headerFill: string;
	rowFill: string;
	alternateRowFill: string;
	gridStroke: string;
	textColor: string;
	mutedTextColor: string;
	dependencyStroke: string;
}

export interface CreateGanttChartOptions {
	x: number;
	y: number;
	title?: string;
	startDate?: string;
	dayCount?: number;
	canvasViewportStartDay?: number;
	canvasViewportDayCount?: number;
	dayWidth?: number;
	labelWidth?: number;
	rowHeight?: number;
	headerHeight?: number;
	tasks?: readonly GanttTaskInput[];
	dependencies?: readonly GanttDependencyInput[];
	fontFamily?: string;
	text?: (key: string) => string;
	dateLabel?: (startDate: string, endDate: string) => string;
	appearance?: Partial<GanttAppearance>;
	/** Reuse an existing frame id when rebuilding an editable chart. */
	chartId?: string;
	/** Shows a marker for the current day when it is inside the timeline. */
	showToday?: boolean;
	today?: string;
	/** Centers the built-in example tasks around `today` for a newly placed chart. */
	anchorDefaultTasksToToday?: boolean;
}

export interface GanttChartDocument {
	title: string;
	startDate: string;
	dayCount: number;
	/** First semantic calendar day rendered inside the compact canvas frame. */
	canvasViewportStartDay?: number;
	/** Number of calendar days rendered inside the compact canvas frame. */
	canvasViewportDayCount?: number;
	dayWidth: number;
	labelWidth: number;
	rowHeight: number;
	headerHeight: number;
	showToday: boolean;
	tasks: GanttChartTask[];
	dependencies: GanttDependencyInput[];
	appearance: GanttAppearance;
}

export type GanttTaskEditableChanges = Partial<
	Pick<
		GanttTaskInput,
		| "title"
		| "startDay"
		| "durationDays"
		| "progress"
		| "status"
		| "category"
		| "categoryLabel"
		| "owner"
		| "color"
		| "critical"
	>
>;

/** Transport-neutral actions shared by the Gantt studio, AI and MCP. */
export type GanttChartEditAction =
	| {
			operation: "update_chart";
			changes: Partial<
				Pick<
					GanttChartDocument,
					"title" | "startDate" | "dayCount" | "showToday"
				>
			>;
	  }
	| {
			operation: "add_task";
			kind: "task" | "milestone" | "group";
			task?: GanttTaskEditableChanges;
			parentId?: string;
			afterTaskId?: string;
	  }
	| {
			operation: "update_task";
			taskId: string;
			changes: GanttTaskEditableChanges;
	  }
	| {
			operation: "shift_task";
			taskId: string;
			deltaDays: number;
	  }
	| {
			operation: "delete_task";
			taskId: string;
	  }
	| {
			operation: "move_task";
			taskId: string;
			targetIndex: number;
			parentId?: string | null;
	  }
	| {
			operation: "set_group_collapsed";
			groupId: string;
			collapsed: boolean;
	  }
	| {
			operation: "add_dependency";
			fromTaskId: string;
			toTaskId: string;
			type?: GanttDependencyKind;
	  }
	| {
			operation: "delete_dependency";
			dependencyIndex: number;
	  };

export interface GanttChartSummary {
	id: string;
	title: string;
	startDate: string;
	dayCount: number;
	showToday: boolean;
	tasks: GanttChartTask[];
	dependencies: GanttDependencyInput[];
}

export interface PlanGanttChartEditOptions {
	defaults: CanvasElementFactoryDefaults;
	elements: Iterable<CanvasElement>;
	chartId: string;
	action: GanttChartEditAction;
	buildOptions?: Pick<
		CreateGanttChartOptions,
		"fontFamily" | "text" | "dateLabel" | "today"
	>;
}

export interface PlannedGanttChartEdit {
	plan: GanttChartMutationPlan;
	document: GanttChartDocument;
	affectedTaskId?: string;
}

/** A host-neutral replacement plan that can be applied by Web, React or MCP hosts. */
export interface GanttChartMutationPlan {
	create: CanvasElement[];
	update: Array<{ id: string; changes: Partial<CanvasElement> }>;
	deleteIds: string[];
	selectedIds: string[];
}

export interface GanttChartMeta {
	skedraType: typeof GANTT_CHART_TYPE;
	ganttChartId: string;
	startDate: string;
	dayCount: number;
	canvasViewportStartDay: number;
	canvasViewportDayCount: number;
	dayWidth: number;
	labelWidth: number;
	rowHeight: number;
	headerHeight: number;
	showToday: boolean;
}

export interface GanttTaskMeta {
	skedraType: typeof GANTT_TASK_TYPE;
	ganttChartId: string;
	ganttTaskId: string;
	startDay: number;
	durationDays: number;
	startDate: string;
	endDate: string;
	progress: number;
	status: GanttTaskStatus;
	category: GanttTaskCategory;
	categoryLabel?: string;
	owner?: string;
	milestone: boolean;
	critical: boolean;
}

export interface GanttDependencyMeta {
	skedraType: typeof GANTT_DEPENDENCY_TYPE;
	ganttChartId: string;
	ganttSourceTaskId: string;
	ganttTargetTaskId: string;
	ganttDependencyType: GanttDependencyKind;
}

const DEFAULT_APPEARANCE: GanttAppearance = {
	background: "#FFFFFF",
	headerFill: "#F1F5F9",
	rowFill: "#FFFFFF",
	alternateRowFill: "#F8FAFC",
	gridStroke: "#CBD5E1",
	textColor: "#0F172A",
	mutedTextColor: "#475569",
	dependencyStroke: "#64748B",
};

/** Default bar colors per status, shared by canvas rendering and editors. */
export const GANTT_STATUS_COLORS: Record<GanttTaskStatus, string> = {
	planned: "#64748B",
	active: "#2563EB",
	completed: "#16A34A",
	delayed: "#DC2626",
};

/** Colors reserved for team availability and location rows. */
export const GANTT_CATEGORY_COLORS: Record<GanttBuiltInTaskCategory, string> = {
	project: GANTT_STATUS_COLORS.planned,
	vacation: "#D97706",
	absence: "#E11D48",
	"construction-site": "#EA580C",
	"home-office": "#7C3AED",
};

export function getGanttTaskDefaultColor(
	task: Pick<GanttTaskInput, "category" | "milestone" | "status">,
): string {
	if (task.milestone) return "#D97706";
	const category = task.category ?? "project";
	if (category !== "project" && isGanttBuiltInTaskCategory(category)) {
		return GANTT_CATEGORY_COLORS[category];
	}
	return GANTT_STATUS_COLORS[task.status ?? "planned"];
}

function fitGanttBarLabel(
	title: string,
	availableWidth: number,
	fontSize: number,
): string {
	const maxCharacters = Math.floor(
		Math.max(0, availableWidth - 8) / (fontSize * 0.58),
	);
	if (maxCharacters < 4) return "";
	if (title.length <= maxCharacters) return title;
	return `${title.slice(0, Math.max(1, maxCharacters - 1)).trimEnd()}…`;
}

const MONTH_NAMES = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function positiveInteger(value: number | undefined, fallback: number): number {
	return Number.isFinite(value)
		? Math.max(1, Math.round(value as number))
		: fallback;
}

function parseIsoDate(value: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		return null;
	}
	return date;
}

function toIsoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function addGanttDays(date: string, days: number): string {
	const parsed = parseIsoDate(date);
	if (!parsed) throw new Error(`Invalid Gantt date: ${date}`);
	parsed.setUTCDate(parsed.getUTCDate() + Math.round(days));
	return toIsoDate(parsed);
}

export function getGanttDayOffset(startDate: string, date: string): number {
	const start = parseIsoDate(startDate);
	const target = parseIsoDate(date);
	if (!start || !target) throw new Error("Invalid Gantt date offset");
	return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

/** ISO-8601 calendar week with a stable Monday-Sunday date range. */
export function getGanttCalendarWeek(date: string): {
	year: number;
	week: number;
	startDate: string;
	endDate: string;
	dayIndex: number;
} {
	const parsed = parseIsoDate(date);
	if (!parsed) throw new Error(`Invalid Gantt date: ${date}`);
	const dayIndex = (parsed.getUTCDay() + 6) % 7;
	const startDate = addGanttDays(date, -dayIndex);
	const endDate = addGanttDays(startDate, 6);
	const thursday = new Date(parsed);
	thursday.setUTCDate(thursday.getUTCDate() - dayIndex + 3);
	const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
	const firstDayIndex = (firstThursday.getUTCDay() + 6) % 7;
	firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayIndex + 3);
	const week =
		1 +
		Math.round(
			(thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000),
		);
	return {
		year: thursday.getUTCFullYear(),
		week,
		startDate,
		endDate,
		dayIndex,
	};
}

export function getDefaultGanttStartDate(now = new Date()): string {
	return `${now.getUTCFullYear()}-01-01`;
}

export interface GanttCalendarYearRange {
	startYear: number;
	endYear: number;
	startDate: string;
	endDate: string;
}

function calendarYearStart(year: number): string {
	return `${year.toString().padStart(4, "0")}-01-01`;
}

function calendarYearEnd(year: number): string {
	return `${year.toString().padStart(4, "0")}-12-31`;
}

function isoYear(date: string): number {
	const parsed = parseIsoDate(date);
	if (!parsed) throw new Error(`Invalid Gantt date: ${date}`);
	return parsed.getUTCFullYear();
}

function resolveStartDate(value: string | undefined): string {
	const startDate = value ?? getDefaultGanttStartDate();
	if (!parseIsoDate(startDate)) {
		throw new Error(
			`Invalid Gantt startDate "${startDate}". Expected YYYY-MM-DD.`,
		);
	}
	return startDate;
}

function formatDatePart(isoDate: string): string {
	const date = parseIsoDate(isoDate);
	if (!date) return isoDate;
	return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function defaultDateLabel(startDate: string, endDate: string): string {
	return startDate === endDate
		? formatDatePart(startDate)
		: `${formatDatePart(startDate)}–${formatDatePart(endDate)}`;
}

function resolveText(
	options: Pick<CreateGanttChartOptions, "text">,
	key: string,
	fallback: string,
) {
	return options.text?.(key) ?? fallback;
}

function defaultTasks(
	options: Pick<
		CreateGanttChartOptions,
		"text" | "today" | "anchorDefaultTasksToToday"
	>,
	startDate: string,
): GanttTaskInput[] {
	const todayOffset =
		options.anchorDefaultTasksToToday &&
		options.today &&
		parseIsoDate(options.today)
			? getGanttDayOffset(startDate, options.today)
			: 0;
	const taskOffset = Math.max(0, todayOffset - GANTT_DEFAULT_TODAY_TASK_OFFSET);
	return [
		{
			id: "discovery",
			title: resolveText(options, "gantt.discovery", "Discovery"),
			startDay: taskOffset,
			durationDays: 7,
			progress: 100,
			status: "completed",
		},
		{
			id: "design",
			title: resolveText(options, "gantt.design", "Design"),
			startDay: taskOffset + 5,
			durationDays: 7,
			progress: 65,
			status: "active",
		},
		{
			id: "implementation",
			title: resolveText(options, "gantt.implementation", "Implementation"),
			startDay: taskOffset + 10,
			durationDays: 10,
			progress: 35,
			status: "active",
		},
		{
			id: "quality",
			title: resolveText(options, "gantt.quality", "Quality assurance"),
			startDay: taskOffset + 18,
			durationDays: 6,
			progress: 0,
			status: "planned",
		},
		{
			id: "launch",
			title: resolveText(options, "gantt.launch", "Launch"),
			startDay: taskOffset + 24,
			durationDays: 1,
			progress: 0,
			status: "planned",
			milestone: true,
		},
	];
}

function defaultDependencies(): GanttDependencyInput[] {
	return [
		{ fromTaskId: "design", toTaskId: "implementation" },
		{ fromTaskId: "quality", toTaskId: "launch" },
	];
}

type NormalizedTask = GanttChartTask;

function normalizeTasks(tasks: readonly GanttTaskInput[]): NormalizedTask[] {
	const seen = new Set<string>();
	// First pass: per-task cleanup (ids, ranges, derived status).
	const cleaned = tasks.map((task, index): NormalizedTask => {
		const id = task.id.trim() || `task-${index + 1}`;
		if (seen.has(id)) throw new Error(`Duplicate Gantt task id: ${id}`);
		seen.add(id);
		const progress = clamp(Math.round(task.progress ?? 0), 0, 100);
		const group = task.group ?? false;
		return {
			...task,
			id,
			title: task.title.trim() || `Task ${index + 1}`,
			startDay: Math.max(0, Math.round(task.startDay)),
			durationDays: positiveInteger(task.durationDays, 1),
			progress,
			status:
				task.status ??
				(progress >= 100 ? "completed" : progress > 0 ? "active" : "planned"),
			category: group ? "project" : task.category?.trim() || "project",
			categoryLabel:
				group || !task.categoryLabel?.trim()
					? undefined
					: task.categoryLabel.trim(),
			// A group renders as a summary bar and can never be a milestone.
			milestone: group ? false : (task.milestone ?? false),
			critical: group ? false : (task.critical ?? false),
			group,
			collapsed: group ? (task.collapsed ?? false) : false,
			parentId: task.parentId,
		};
	});
	// Second pass: drop invalid parent references (missing parent, parent is
	// not a group, self-reference). Groups always stay top-level.
	const byId = new Map(cleaned.map((task) => [task.id, task]));
	for (const task of cleaned) {
		const parent = task.parentId ? byId.get(task.parentId) : undefined;
		if (task.group || !parent || !parent.group || parent.id === task.id) {
			task.parentId = undefined;
		}
	}
	// Third pass: display order keeps children directly behind their group,
	// preserving the relative order of roots and of siblings.
	const ordered: NormalizedTask[] = [];
	for (const root of cleaned) {
		if (root.parentId) continue;
		ordered.push(root);
		if (root.group) {
			for (const child of cleaned) {
				if (child.parentId === root.id) ordered.push(child);
			}
		}
	}
	// Fourth pass: groups aggregate schedule, progress and status from children.
	for (const task of ordered) {
		if (!task.group) continue;
		const children = ordered.filter((child) => child.parentId === task.id);
		if (children.length === 0) continue;
		const start = Math.min(...children.map((child) => child.startDay));
		const end = Math.max(
			...children.map(
				(child) => child.startDay + Math.max(1, child.durationDays),
			),
		);
		const total = children.reduce(
			(sum, child) => sum + Math.max(1, child.durationDays),
			0,
		);
		task.startDay = start;
		task.durationDays = Math.max(1, end - start);
		// Progress is weighted by duration so long tasks dominate the summary.
		task.progress = clamp(
			Math.round(
				children.reduce(
					(sum, child) =>
						sum + child.progress * Math.max(1, child.durationDays),
					0,
				) / total,
			),
			0,
			100,
		);
		task.status = children.some((child) => child.status === "delayed")
			? "delayed"
			: children.every((child) => child.status === "completed")
				? "completed"
				: children.some(
							(child) => child.status === "active" || child.progress > 0,
						)
					? "active"
					: "planned";
	}
	return ordered;
}

/** Display list that hides children of collapsed groups. */
function visibleTaskList(tasks: readonly NormalizedTask[]): NormalizedTask[] {
	const collapsed = new Set(
		tasks.filter((task) => task.group && task.collapsed).map((task) => task.id),
	);
	return tasks.filter(
		(task) => !(task.parentId && collapsed.has(task.parentId)),
	);
}

/** Tasks that are visible as rows, in display order (collapsed children hidden). */
export function getGanttVisibleTasks(
	document: GanttChartDocument,
): GanttChartTask[] {
	return visibleTaskList(normalizeGanttChartDocument(document).tasks);
}

/** Direct children of a group, in display order. */
export function getGanttTaskChildren(
	document: GanttChartDocument,
	groupId: string,
): GanttChartTask[] {
	return normalizeGanttChartDocument(document).tasks.filter(
		(task) => task.parentId === groupId,
	);
}

function normalizeDependencies(
	dependencies: readonly GanttDependencyInput[],
	tasks: readonly Pick<GanttTaskInput, "id" | "group">[],
): GanttDependencyInput[] {
	// Summary rows derive their schedule, so they cannot take part in links.
	const taskIds = new Set(
		tasks.filter((task) => !task.group).map((task) => task.id),
	);
	const seen = new Set<string>();
	const normalized: GanttDependencyInput[] = [];
	for (const dependency of dependencies) {
		const type = dependency.type ?? "finish-to-start";
		if (
			!taskIds.has(dependency.fromTaskId) ||
			!taskIds.has(dependency.toTaskId) ||
			dependency.fromTaskId === dependency.toTaskId
		) {
			continue;
		}
		const key = `${dependency.fromTaskId}:${dependency.toTaskId}:${type}`;
		if (seen.has(key)) continue;
		seen.add(key);
		normalized.push({
			fromTaskId: dependency.fromTaskId,
			toTaskId: dependency.toTaskId,
			type,
		});
	}
	return normalized;
}

export function normalizeGanttChartDocument(
	document: GanttChartDocument,
): GanttChartDocument {
	const tasks = normalizeTasks(document.tasks);
	const startDate = resolveStartDate(document.startDate);
	const dayCount = resolveDayCount(document.dayCount, tasks);
	const canvasViewportDayCount = clamp(
		positiveInteger(
			document.canvasViewportDayCount,
			Math.min(dayCount, GANTT_CANVAS_DEFAULT_VISIBLE_DAYS),
		),
		Math.min(7, dayCount),
		Math.min(dayCount, GANTT_CANVAS_MAX_VISIBLE_DAYS),
	);
	const canvasViewportStartDay = clamp(
		Math.round(document.canvasViewportStartDay ?? 0),
		0,
		Math.max(0, dayCount - canvasViewportDayCount),
	);
	return {
		title: document.title.trim() || "Project timeline",
		startDate,
		dayCount,
		canvasViewportStartDay,
		canvasViewportDayCount,
		dayWidth: clamp(
			positiveInteger(document.dayWidth, GANTT_DEFAULT_DAY_WIDTH),
			16,
			64,
		),
		labelWidth: clamp(
			positiveInteger(document.labelWidth, GANTT_DEFAULT_LABEL_WIDTH),
			180,
			480,
		),
		rowHeight: clamp(
			positiveInteger(document.rowHeight, GANTT_DEFAULT_ROW_HEIGHT),
			42,
			96,
		),
		headerHeight: clamp(
			positiveInteger(document.headerHeight, GANTT_DEFAULT_HEADER_HEIGHT),
			42,
			96,
		),
		showToday: document.showToday,
		tasks,
		dependencies: normalizeDependencies(document.dependencies, tasks),
		appearance: { ...DEFAULT_APPEARANCE, ...document.appearance },
	};
}

export function createDefaultGanttChartDocument(
	options: Pick<
		CreateGanttChartOptions,
		| "title"
		| "startDate"
		| "dayCount"
		| "canvasViewportStartDay"
		| "canvasViewportDayCount"
		| "dayWidth"
		| "labelWidth"
		| "rowHeight"
		| "headerHeight"
		| "tasks"
		| "dependencies"
		| "appearance"
		| "showToday"
		| "today"
		| "anchorDefaultTasksToToday"
		| "text"
	> = {},
): GanttChartDocument {
	const startDate = resolveStartDate(options.startDate);
	const tasks = normalizeTasks(
		options.tasks ?? defaultTasks(options, startDate),
	);
	const calendarYearDayCount = startDate.endsWith("-01-01")
		? getGanttDayOffset(startDate, calendarYearStart(isoYear(startDate) + 1))
		: undefined;
	const document = normalizeGanttChartDocument({
		title:
			options.title ?? resolveText(options, "gantt.title", "Project timeline"),
		startDate,
		dayCount: resolveDayCount(options.dayCount ?? calendarYearDayCount, tasks),
		canvasViewportStartDay: options.canvasViewportStartDay,
		canvasViewportDayCount: options.canvasViewportDayCount,
		dayWidth: options.dayWidth ?? GANTT_DEFAULT_DAY_WIDTH,
		labelWidth: options.labelWidth ?? GANTT_DEFAULT_LABEL_WIDTH,
		rowHeight: options.rowHeight ?? GANTT_DEFAULT_ROW_HEIGHT,
		headerHeight: options.headerHeight ?? GANTT_DEFAULT_HEADER_HEIGHT,
		showToday: options.showToday ?? true,
		tasks,
		dependencies: [
			...(options.dependencies ?? (options.tasks ? [] : defaultDependencies())),
		],
		appearance: { ...DEFAULT_APPEARANCE, ...options.appearance },
	});
	return options.anchorDefaultTasksToToday &&
		options.today &&
		parseIsoDate(options.today) &&
		options.canvasViewportStartDay == null
		? focusGanttChartOnDate(document, options.today)
		: document;
}

/** Calendar-year boundaries currently stored by a Gantt document. */
export function getGanttCalendarYearRange(
	document: GanttChartDocument,
): GanttCalendarYearRange {
	const normalized = normalizeGanttChartDocument(document);
	const endDate = addGanttDays(normalized.startDate, normalized.dayCount - 1);
	return {
		startYear: isoYear(normalized.startDate),
		endYear: isoYear(endDate),
		startDate: normalized.startDate,
		endDate,
	};
}

function rebaseGanttCalendarYears(
	document: GanttChartDocument,
	startYear: number,
	endYear: number,
	viewportDate?: string,
): GanttChartDocument {
	const normalized = normalizeGanttChartDocument(document);
	if (endYear < startYear) return normalized;
	const startDate = calendarYearStart(startYear);
	const endDate = calendarYearEnd(endYear);
	const dayCount = getGanttDayOffset(startDate, endDate) + 1;
	if (dayCount > GANTT_MAX_DAY_COUNT) return normalized;
	const previousViewportDate = addGanttDays(
		normalized.startDate,
		normalized.canvasViewportStartDay ?? 0,
	);
	const requestedViewportDate = viewportDate ?? previousViewportDate;
	return normalizeGanttChartDocument({
		...normalized,
		startDate,
		dayCount,
		canvasViewportStartDay: getGanttDayOffset(startDate, requestedViewportDate),
		tasks: normalized.tasks.map((task) => ({
			...task,
			startDay: getGanttDayOffset(
				startDate,
				addGanttDays(normalized.startDate, task.startDay),
			),
		})),
	});
}

/**
 * Converts a legacy rolling-day timeline to complete January-December years.
 * Every task keeps its absolute start and end date.
 */
export function alignGanttChartToCalendarYears(
	document: GanttChartDocument,
): GanttChartDocument {
	const normalized = normalizeGanttChartDocument(document);
	const range = getGanttCalendarYearRange(normalized);
	if (
		normalized.startDate === calendarYearStart(range.startYear) &&
		range.endDate === calendarYearEnd(range.endYear)
	) {
		return normalized;
	}
	const taskStarts = normalized.tasks.map((task) =>
		addGanttDays(normalized.startDate, task.startDay),
	);
	const taskEnds = normalized.tasks.map((task) =>
		addGanttDays(
			normalized.startDate,
			task.startDay + Math.max(1, task.durationDays) - 1,
		),
	);
	const startsOnJanuaryFirst = normalized.startDate.endsWith("-01-01");
	const startYear = startsOnJanuaryFirst
		? range.startYear
		: taskStarts.length > 0
			? Math.min(...taskStarts.map(isoYear))
			: range.startYear;
	const endYear = Math.max(
		startsOnJanuaryFirst ? range.endYear : startYear,
		...(taskEnds.length > 0 ? taskEnds.map(isoYear) : [startYear]),
	);
	return rebaseGanttCalendarYears(
		normalized,
		startYear,
		endYear,
		calendarYearStart(startYear),
	);
}

/** Adds exactly one complete calendar year at the requested edge. */
export function addGanttCalendarYear(
	document: GanttChartDocument,
	edge: "past" | "future",
): GanttChartDocument {
	const aligned = alignGanttChartToCalendarYears(document);
	const range = getGanttCalendarYearRange(aligned);
	const startYear = edge === "past" ? range.startYear - 1 : range.startYear;
	const endYear = edge === "future" ? range.endYear + 1 : range.endYear;
	return rebaseGanttCalendarYears(
		aligned,
		startYear,
		endYear,
		edge === "past" ? calendarYearStart(startYear) : calendarYearStart(endYear),
	);
}

/**
 * Removes one empty boundary year. A year containing any part of a task is
 * protected so removing calendar space can never delete or move task dates.
 */
export function removeGanttCalendarYear(
	document: GanttChartDocument,
	edge: "past" | "future",
): GanttChartDocument | null {
	const aligned = alignGanttChartToCalendarYears(document);
	const range = getGanttCalendarYearRange(aligned);
	if (range.startYear >= range.endYear) return null;
	const startYear = edge === "past" ? range.startYear + 1 : range.startYear;
	const endYear = edge === "future" ? range.endYear - 1 : range.endYear;
	const nextStartDate = calendarYearStart(startYear);
	const nextEndDate = calendarYearEnd(endYear);
	const taskOutsideRange = aligned.tasks.some((task) => {
		const taskStart = addGanttDays(aligned.startDate, task.startDay);
		const taskEnd = addGanttDays(
			aligned.startDate,
			task.startDay + Math.max(1, task.durationDays) - 1,
		);
		return taskStart < nextStartDate || taskEnd > nextEndDate;
	});
	if (taskOutsideRange) return null;
	return rebaseGanttCalendarYears(
		aligned,
		startYear,
		endYear,
		edge === "past" ? nextStartDate : calendarYearStart(endYear),
	);
}

/** Expands to the complete calendar year containing `date`, when needed. */
export function ensureGanttCalendarIncludesDate(
	document: GanttChartDocument,
	date: string,
): GanttChartDocument {
	const targetYear = isoYear(date);
	const aligned = alignGanttChartToCalendarYears(document);
	const range = getGanttCalendarYearRange(aligned);
	if (targetYear >= range.startYear && targetYear <= range.endYear) {
		return aligned;
	}
	return rebaseGanttCalendarYears(
		aligned,
		Math.min(range.startYear, targetYear),
		Math.max(range.endYear, targetYear),
	);
}

/** Centers the compact canvas viewport on a date without moving any task. */
export function focusGanttChartOnDate(
	document: GanttChartDocument,
	date: string,
): GanttChartDocument {
	const expanded = ensureGanttCalendarIncludesDate(document, date);
	const visibleDays =
		expanded.canvasViewportDayCount ??
		Math.min(expanded.dayCount, GANTT_CANVAS_DEFAULT_VISIBLE_DAYS);
	const dateOffset = getGanttDayOffset(expanded.startDate, date);
	return scrollGanttChartCanvas(
		expanded,
		dateOffset - Math.floor(visibleDays / 2),
	);
}

function resolveDayCount(
	requested: number | undefined,
	tasks: readonly NormalizedTask[],
): number {
	// The floor is exactly the last task's end plus a small trailing margin, so
	// dragging the frame narrower can trim every empty column the user added.
	const required = tasks.reduce(
		(maximum, task) =>
			Math.max(
				maximum,
				task.startDay + Math.max(1, task.durationDays) + GANTT_TRAILING_DAYS,
			),
		7,
	);
	return clamp(
		Math.max(
			GANTT_DEFAULT_DAY_COUNT,
			positiveInteger(requested, GANTT_DEFAULT_DAY_COUNT),
			required,
		),
		7,
		GANTT_MAX_DAY_COUNT,
	);
}

export function getGanttChartSize(
	options: {
		dayCount?: number;
		canvasViewportDayCount?: number;
		dayWidth?: number;
		labelWidth?: number;
		rowHeight?: number;
		headerHeight?: number;
		taskCount?: number;
		tasks?: readonly (Pick<GanttTaskInput, "startDay" | "durationDays"> &
			Partial<Pick<GanttTaskInput, "parentId" | "group" | "collapsed">>)[];
	} = {},
): { width: number; height: number } {
	const dayWidth = positiveInteger(options.dayWidth, GANTT_DEFAULT_DAY_WIDTH);
	const labelWidth = positiveInteger(
		options.labelWidth,
		GANTT_DEFAULT_LABEL_WIDTH,
	);
	const rowHeight = positiveInteger(
		options.rowHeight,
		GANTT_DEFAULT_ROW_HEIGHT,
	);
	const headerHeight = positiveInteger(
		options.headerHeight,
		GANTT_DEFAULT_HEADER_HEIGHT,
	);
	const taskCount = options.taskCount ?? options.tasks?.length ?? 5;
	const requiredDays = (options.tasks ?? []).reduce(
		(maximum, task) =>
			Math.max(
				maximum,
				Math.max(0, Math.round(task.startDay)) +
					positiveInteger(task.durationDays, 1) +
					2,
			),
		7,
	);
	const dayCount = clamp(
		Math.max(
			GANTT_DEFAULT_DAY_COUNT,
			positiveInteger(options.dayCount, GANTT_DEFAULT_DAY_COUNT),
			requiredDays,
		),
		7,
		GANTT_MAX_DAY_COUNT,
	);
	const canvasViewportDayCount = clamp(
		positiveInteger(
			options.canvasViewportDayCount,
			Math.min(dayCount, GANTT_CANVAS_DEFAULT_VISIBLE_DAYS),
		),
		Math.min(7, dayCount),
		Math.min(dayCount, GANTT_CANVAS_MAX_VISIBLE_DAYS),
	);
	return {
		width: labelWidth + canvasViewportDayCount * dayWidth,
		height:
			headerHeight +
			Math.max(1, taskCount) * rowHeight +
			(dayCount > canvasViewportDayCount ? GANTT_CANVAS_SCROLLBAR_HEIGHT : 0),
	};
}

/**
 * Converts a resized chart frame back into its compact canvas viewport.
 * Width changes the number of visible days without compressing the calendar;
 * height still snaps to the shared task-row scale.
 */
export function resizeGanttChartDocument(
	document: GanttChartDocument,
	bounds: { width?: number; height?: number },
): GanttChartDocument {
	const normalized = normalizeGanttChartDocument(document);
	let nextDayCount = normalized.dayCount;
	let nextViewportDayCount =
		normalized.canvasViewportDayCount ??
		Math.min(normalized.dayCount, GANTT_CANVAS_DEFAULT_VISIBLE_DAYS);

	if (bounds.width !== undefined) {
		const requestedCount = Math.max(
			7,
			Math.round(
				Math.max(normalized.dayWidth, bounds.width - normalized.labelWidth) /
					normalized.dayWidth,
			),
		);
		nextDayCount = Math.max(
			nextDayCount,
			Math.min(requestedCount, GANTT_CANVAS_MAX_VISIBLE_DAYS),
		);
		nextViewportDayCount = clamp(
			requestedCount,
			7,
			Math.min(nextDayCount, GANTT_CANVAS_MAX_VISIBLE_DAYS),
		);
	}

	const taskRows = Math.max(1, visibleTaskList(normalized.tasks).length);
	const scrollbarHeight =
		nextDayCount > nextViewportDayCount ? GANTT_CANVAS_SCROLLBAR_HEIGHT : 0;
	const nextRowHeight =
		bounds.height === undefined
			? normalized.rowHeight
			: Math.round(
					(bounds.height - normalized.headerHeight - scrollbarHeight) /
						taskRows,
				);

	return normalizeGanttChartDocument({
		...normalized,
		dayCount: nextDayCount,
		canvasViewportDayCount: nextViewportDayCount,
		rowHeight: nextRowHeight,
	});
}

/**
 * Adds calendar space before or after a plan without changing any task's
 * absolute date. Extending into the past shifts all task offsets forward.
 */
export function extendGanttChartCalendar(
	document: GanttChartDocument,
	edge: "past" | "future",
	days = 14,
): GanttChartDocument {
	const normalized = normalizeGanttChartDocument(document);
	const extension = Math.min(
		Math.max(1, Math.round(days)),
		GANTT_MAX_DAY_COUNT - normalized.dayCount,
	);
	if (extension <= 0) return normalized;
	return normalizeGanttChartDocument({
		...normalized,
		startDate:
			edge === "past"
				? addGanttDays(normalized.startDate, -extension)
				: normalized.startDate,
		dayCount: normalized.dayCount + extension,
		canvasViewportStartDay:
			edge === "past"
				? (normalized.canvasViewportStartDay ?? 0) + extension
				: normalized.canvasViewportStartDay,
		tasks:
			edge === "past"
				? normalized.tasks.map((task) => ({
						...task,
						startDay: task.startDay + extension,
					}))
				: normalized.tasks,
	});
}

export interface GanttCanvasScrollbarMetrics {
	trackInset: number;
	trackWidth: number;
	thumbWidth: number;
	thumbOffset: number;
	maxViewportStartDay: number;
}

/** Geometry shared by the canvas renderer and its scrollbar interaction. */
export function getGanttCanvasScrollbarMetrics(
	document: GanttChartDocument,
): GanttCanvasScrollbarMetrics | null {
	const normalized = normalizeGanttChartDocument(document);
	const visibleDays = normalized.canvasViewportDayCount ?? normalized.dayCount;
	const maxViewportStartDay = Math.max(0, normalized.dayCount - visibleDays);
	if (maxViewportStartDay === 0) return null;
	const trackInset = 8;
	const trackWidth = Math.max(1, visibleDays * normalized.dayWidth - 16);
	const thumbWidth = clamp(
		(trackWidth * visibleDays) / normalized.dayCount,
		32,
		trackWidth,
	);
	const travel = Math.max(0, trackWidth - thumbWidth);
	const thumbOffset =
		travel * ((normalized.canvasViewportStartDay ?? 0) / maxViewportStartDay);
	return {
		trackInset,
		trackWidth,
		thumbWidth,
		thumbOffset,
		maxViewportStartDay,
	};
}

/** Moves only the canvas viewport; dates and task offsets remain unchanged. */
export function scrollGanttChartCanvas(
	document: GanttChartDocument,
	viewportStartDay: number,
): GanttChartDocument {
	const normalized = normalizeGanttChartDocument(document);
	return normalizeGanttChartDocument({
		...normalized,
		canvasViewportStartDay: viewportStartDay,
	});
}

export interface GanttCanvasResizeResult {
	document: GanttChartDocument;
	/** Horizontal frame correction that keeps existing dates fixed on canvas. */
	frameOffsetX: number;
}

/**
 * Resizes the compact canvas window from either edge. A start-edge resize
 * reveals or creates earlier days and returns the snapped frame offset needed
 * to keep every existing date at the same world-space x coordinate.
 */
export function resizeGanttChartCanvasFromEdge(
	document: GanttChartDocument,
	bounds: { width?: number; height?: number },
	edge: "start" | "end",
): GanttCanvasResizeResult {
	const normalized = normalizeGanttChartDocument(document);
	if (edge === "end" || bounds.width === undefined) {
		return {
			document: resizeGanttChartDocument(normalized, bounds),
			frameOffsetX: 0,
		};
	}
	const previousViewportDayCount =
		normalized.canvasViewportDayCount ?? normalized.dayCount;
	const widthPreview = resizeGanttChartDocument(normalized, {
		width: bounds.width,
	});
	const nextViewportDayCount =
		widthPreview.canvasViewportDayCount ?? widthPreview.dayCount;
	const viewportDelta = nextViewportDayCount - previousViewportDayCount;
	const previousViewportStart = normalized.canvasViewportStartDay ?? 0;
	if (viewportDelta > 0) {
		const revealedExistingDays = Math.min(viewportDelta, previousViewportStart);
		const newPastDays = viewportDelta - revealedExistingDays;
		let adjustedDocument =
			newPastDays > 0
				? extendGanttChartCalendar(normalized, "past", newPastDays)
				: normalized;
		adjustedDocument = resizeGanttChartDocument(adjustedDocument, {
			width:
				adjustedDocument.labelWidth +
				nextViewportDayCount * adjustedDocument.dayWidth,
			...(bounds.height !== undefined ? { height: bounds.height } : {}),
		});
		return {
			document: scrollGanttChartCanvas(
				adjustedDocument,
				previousViewportStart - revealedExistingDays,
			),
			frameOffsetX: -viewportDelta * normalized.dayWidth,
		};
	}
	if (viewportDelta < 0) {
		const removedDays = -viewportDelta;
		const adjustedDocument = resizeGanttChartDocument(normalized, {
			width: normalized.labelWidth + nextViewportDayCount * normalized.dayWidth,
			...(bounds.height !== undefined ? { height: bounds.height } : {}),
		});
		const nextDocument = scrollGanttChartCanvas(
			adjustedDocument,
			previousViewportStart + removedDays,
		);
		const actualViewportShift =
			(nextDocument.canvasViewportStartDay ?? 0) - previousViewportStart;
		return {
			document: nextDocument,
			frameOffsetX: actualViewportShift * normalized.dayWidth,
		};
	}
	return {
		document: resizeGanttChartDocument(normalized, {
			...(bounds.height !== undefined ? { height: bounds.height } : {}),
		}),
		frameOffsetX: 0,
	};
}

export function isGanttChart(
	element: CanvasElement | null | undefined,
): boolean {
	return element?.customData?.skedraType === GANTT_CHART_TYPE;
}

export function isGanttTask(
	element: CanvasElement | null | undefined,
): boolean {
	return element?.customData?.skedraType === GANTT_TASK_TYPE;
}

export interface GanttCanvasScrollbarThumbMeta {
	ganttChartId: string;
}

export function getGanttCanvasScrollbarThumbMeta(
	element: CanvasElement | null | undefined,
): GanttCanvasScrollbarThumbMeta | null {
	if (element?.customData?.ganttRole !== "canvas-scroll-thumb") return null;
	const ganttChartId = element.customData.ganttChartId;
	return typeof ganttChartId === "string" ? { ganttChartId } : null;
}

export function getGanttChartMeta(
	element: CanvasElement | null | undefined,
): GanttChartMeta | null {
	if (!element || !isGanttChart(element) || !isRecord(element.customData)) {
		return null;
	}
	const {
		ganttChartId,
		startDate,
		dayCount,
		canvasViewportStartDay,
		canvasViewportDayCount,
		dayWidth,
		labelWidth,
		rowHeight,
		headerHeight,
		showToday,
	} = element.customData;
	if (
		typeof ganttChartId !== "string" ||
		typeof startDate !== "string" ||
		!parseIsoDate(startDate) ||
		typeof dayCount !== "number" ||
		typeof dayWidth !== "number" ||
		typeof labelWidth !== "number" ||
		typeof rowHeight !== "number" ||
		typeof headerHeight !== "number" ||
		(showToday !== undefined && typeof showToday !== "boolean")
	) {
		return null;
	}
	const widthDerivedViewportDayCount = Math.round(
		(element.width - labelWidth) / dayWidth,
	);
	const resolvedViewportDayCount = clamp(
		typeof canvasViewportDayCount === "number"
			? Math.round(canvasViewportDayCount)
			: widthDerivedViewportDayCount >= 7
				? widthDerivedViewportDayCount
				: Math.min(dayCount, GANTT_CANVAS_DEFAULT_VISIBLE_DAYS),
		Math.min(7, dayCount),
		Math.min(dayCount, GANTT_CANVAS_MAX_VISIBLE_DAYS),
	);
	return {
		skedraType: GANTT_CHART_TYPE,
		ganttChartId,
		startDate,
		dayCount,
		canvasViewportStartDay: clamp(
			typeof canvasViewportStartDay === "number"
				? Math.round(canvasViewportStartDay)
				: 0,
			0,
			Math.max(0, dayCount - resolvedViewportDayCount),
		),
		canvasViewportDayCount: resolvedViewportDayCount,
		dayWidth,
		labelWidth,
		rowHeight,
		headerHeight,
		showToday: showToday ?? true,
	};
}

function isGanttStatus(value: unknown): value is GanttTaskStatus {
	return (
		value === "planned" ||
		value === "active" ||
		value === "completed" ||
		value === "delayed"
	);
}

export function isGanttBuiltInTaskCategory(
	value: unknown,
): value is GanttBuiltInTaskCategory {
	return (
		value === "project" ||
		value === "vacation" ||
		value === "absence" ||
		value === "construction-site" ||
		value === "home-office"
	);
}

function isGanttTaskCategory(value: unknown): value is GanttTaskCategory {
	return (
		typeof value === "string" &&
		value.trim().length > 0 &&
		value.trim().length <= 80
	);
}

export function getGanttTaskMeta(
	element: CanvasElement | null | undefined,
): GanttTaskMeta | null {
	if (!element || !isGanttTask(element) || !isRecord(element.customData)) {
		return null;
	}
	const {
		ganttChartId,
		ganttTaskId,
		startDay,
		durationDays,
		startDate,
		endDate,
		progress,
		status,
		category,
		categoryLabel,
		owner,
		milestone,
		critical,
	} = element.customData;
	if (
		typeof ganttChartId !== "string" ||
		typeof ganttTaskId !== "string" ||
		typeof startDay !== "number" ||
		typeof durationDays !== "number" ||
		typeof startDate !== "string" ||
		typeof endDate !== "string" ||
		typeof progress !== "number" ||
		!isGanttStatus(status) ||
		(category !== undefined && !isGanttTaskCategory(category)) ||
		(categoryLabel !== undefined && typeof categoryLabel !== "string") ||
		(owner !== undefined && typeof owner !== "string") ||
		typeof milestone !== "boolean" ||
		(critical !== undefined && typeof critical !== "boolean")
	) {
		return null;
	}
	return {
		skedraType: GANTT_TASK_TYPE,
		ganttChartId,
		ganttTaskId,
		startDay,
		durationDays,
		startDate,
		endDate,
		progress,
		status,
		category: category ?? "project",
		categoryLabel,
		owner,
		milestone,
		critical: critical ?? false,
	};
}

function isDependencyKind(value: unknown): value is GanttDependencyKind {
	return (
		value === "finish-to-start" ||
		value === "start-to-start" ||
		value === "finish-to-finish" ||
		value === "start-to-finish"
	);
}

export function getGanttDependencyMeta(
	element: CanvasElement | null | undefined,
): GanttDependencyMeta | null {
	if (
		!element ||
		element.customData?.skedraType !== GANTT_DEPENDENCY_TYPE ||
		!isRecord(element.customData)
	) {
		return null;
	}
	const {
		ganttChartId,
		ganttSourceTaskId,
		ganttTargetTaskId,
		ganttDependencyType,
	} = element.customData;
	if (
		typeof ganttChartId !== "string" ||
		typeof ganttSourceTaskId !== "string" ||
		typeof ganttTargetTaskId !== "string" ||
		!isDependencyKind(ganttDependencyType)
	) {
		return null;
	}
	return {
		skedraType: GANTT_DEPENDENCY_TYPE,
		ganttChartId,
		ganttSourceTaskId,
		ganttTargetTaskId,
		ganttDependencyType,
	};
}

export function getGanttChartId(
	element: CanvasElement | null | undefined,
): string | null {
	if (!element) return null;
	const chart = getGanttChartMeta(element);
	if (chart) return chart.ganttChartId;
	const task = getGanttTaskMeta(element);
	if (task) return task.ganttChartId;
	const dependency = getGanttDependencyMeta(element);
	if (dependency) return dependency.ganttChartId;
	const value = element.customData?.ganttChartId;
	return typeof value === "string" ? value : null;
}

export function findGanttChartElement(
	elements: Iterable<CanvasElement>,
	elementOrId?: CanvasElement | string | null,
): CanvasElement | null {
	const list = Array.from(elements);
	const selected =
		typeof elementOrId === "string"
			? list.find((element) => element.id === elementOrId)
			: elementOrId;
	if (elementOrId != null && !selected) return null;
	const chartId = getGanttChartId(selected);
	if (chartId) {
		return (
			list.find(
				(element) =>
					element.id === chartId && getGanttChartMeta(element) !== null,
			) ?? null
		);
	}
	if (selected) return null;
	return list.find((element) => getGanttChartMeta(element) !== null) ?? null;
}

function taskFromUnknown(value: unknown): GanttTaskInput | null {
	if (!isRecord(value)) return null;
	const {
		id,
		title,
		startDay,
		durationDays,
		progress,
		status,
		category,
		categoryLabel,
		owner,
		color,
		milestone,
		critical,
		group,
		parentId,
		collapsed,
	} = value;
	if (
		typeof id !== "string" ||
		typeof title !== "string" ||
		typeof startDay !== "number" ||
		typeof durationDays !== "number" ||
		(progress !== undefined && typeof progress !== "number") ||
		(status !== undefined && !isGanttStatus(status)) ||
		(category !== undefined && !isGanttTaskCategory(category)) ||
		(categoryLabel !== undefined && typeof categoryLabel !== "string") ||
		(owner !== undefined && typeof owner !== "string") ||
		(color !== undefined && typeof color !== "string") ||
		(milestone !== undefined && typeof milestone !== "boolean") ||
		(critical !== undefined && typeof critical !== "boolean") ||
		(group !== undefined && typeof group !== "boolean") ||
		(parentId !== undefined && typeof parentId !== "string") ||
		(collapsed !== undefined && typeof collapsed !== "boolean")
	) {
		return null;
	}
	return {
		id,
		title,
		startDay,
		durationDays,
		progress,
		status,
		category,
		categoryLabel,
		owner,
		color,
		milestone,
		critical,
		group,
		parentId,
		collapsed,
	};
}

function dependencyFromUnknown(value: unknown): GanttDependencyInput | null {
	if (!isRecord(value)) return null;
	const { fromTaskId, toTaskId, type } = value;
	if (
		typeof fromTaskId !== "string" ||
		typeof toTaskId !== "string" ||
		(type !== undefined && !isDependencyKind(type))
	) {
		return null;
	}
	return { fromTaskId, toTaskId, type };
}

/** Removes collapse markers and indentation added by the canvas renderer. */
function stripGanttLabelDecorations(value: string): string {
	return value.replace(/^[▸▾]\s*/u, "").trim();
}

function appearanceFromUnknown(value: unknown): GanttAppearance {
	if (!isRecord(value)) return { ...DEFAULT_APPEARANCE };
	const appearance = { ...DEFAULT_APPEARANCE };
	for (const key of Object.keys(appearance) as Array<keyof GanttAppearance>) {
		if (typeof value[key] === "string") appearance[key] = value[key];
	}
	return appearance;
}

/**
 * Reads the complete editable chart state. Bar moves/resizes and label edits made
 * directly on the canvas are folded back into the returned document.
 */
export function getGanttChartDocument(
	elements: Iterable<CanvasElement>,
	chartOrElement?: CanvasElement | string | null,
): GanttChartDocument | null {
	const list = Array.from(elements);
	const frame = findGanttChartElement(list, chartOrElement);
	const meta = getGanttChartMeta(frame);
	if (!frame || !meta) return null;

	const storedTasks = Array.isArray(frame.customData?.ganttTasks)
		? frame.customData.ganttTasks
				.map(taskFromUnknown)
				.filter((task): task is GanttTaskInput => task !== null)
		: [];
	const storedDependencies = Array.isArray(frame.customData?.ganttDependencies)
		? frame.customData.ganttDependencies
				.map(dependencyFromUnknown)
				.filter(
					(dependency): dependency is GanttDependencyInput =>
						dependency !== null,
				)
		: [];
	const labels = new Map<string, CanvasElement>();
	const bars = new Map<string, CanvasElement>();
	for (const element of list) {
		if (getGanttChartId(element) !== meta.ganttChartId) continue;
		if (element.customData?.ganttRole === "task-label") {
			const taskId = element.customData.ganttTaskId;
			if (typeof taskId === "string") labels.set(taskId, element);
		}
		const taskMeta = getGanttTaskMeta(element);
		if (taskMeta) bars.set(taskMeta.ganttTaskId, element);
	}

	const fallbackTasks = Array.from(bars.values())
		.sort((left, right) => left.y - right.y)
		.map((element, index): GanttTaskInput => {
			const taskMeta = getGanttTaskMeta(element);
			const label = taskMeta ? labels.get(taskMeta.ganttTaskId) : undefined;
			const [title = `Task ${index + 1}`, ...ownerLines] =
				label?.text?.split("\n") ?? [];
			return {
				id: taskMeta?.ganttTaskId ?? `task-${index + 1}`,
				title: stripGanttLabelDecorations(title) || title,
				startDay: taskMeta?.startDay ?? 0,
				durationDays: taskMeta?.durationDays ?? 1,
				progress: taskMeta?.progress ?? 0,
				status: taskMeta?.status ?? "planned",
				category: taskMeta?.category ?? "project",
				categoryLabel: taskMeta?.categoryLabel,
				owner: taskMeta?.owner ?? (ownerLines.join(" ").trim() || undefined),
				color: element.fill,
				milestone: taskMeta?.milestone ?? false,
				critical: taskMeta?.critical ?? false,
			};
		});
	const sourceTasks = storedTasks.length > 0 ? storedTasks : fallbackTasks;
	const tasks = normalizeTasks(
		sourceTasks.map((task) => {
			const element = bars.get(task.id);
			const label = labels.get(task.id);
			if (!element) return task;
			const taskMeta = getGanttTaskMeta(element);
			const milestone = task.milestone ?? element.type === "diamond";
			const leftInset = milestone ? 2 : 4;
			const viewportClipped = element.customData?.ganttViewportClipped === true;
			const startDay = viewportClipped
				? (taskMeta?.startDay ?? task.startDay)
				: Math.max(
						0,
						meta.canvasViewportStartDay +
							Math.round(
								(element.x - (frame.x + meta.labelWidth) - leftInset) /
									meta.dayWidth,
							),
					);
			const durationDays = viewportClipped
				? (taskMeta?.durationDays ?? task.durationDays)
				: milestone
					? 1
					: Math.max(1, Math.round((element.width + 8) / meta.dayWidth));
			const [labelTitle, ...ownerLines] = label?.text?.split("\n") ?? [];
			const progressFromText = Number.parseInt(element.text ?? "", 10);
			// Only bake the bar fill in as an explicit color when it differs from
			// what the renderer derived — otherwise status changes could no longer
			// recolor the bar automatically.
			const derivedColor =
				task.color ??
				getGanttTaskDefaultColor({
					category: task.category,
					milestone,
					status: task.status,
				});
			return {
				...task,
				title: stripGanttLabelDecorations(labelTitle ?? "") || task.title,
				owner: ownerLines.join(" ").trim() || task.owner,
				startDay,
				durationDays,
				progress: Number.isFinite(progressFromText)
					? clamp(progressFromText, 0, 100)
					: task.progress,
				color: element.fill === derivedColor ? task.color : element.fill,
				milestone,
			};
		}),
	);

	const canvasDependencies = list
		.map(getGanttDependencyMeta)
		.filter(
			(dependency): dependency is GanttDependencyMeta =>
				dependency !== null && dependency.ganttChartId === meta.ganttChartId,
		)
		.map(
			(dependency): GanttDependencyInput => ({
				fromTaskId: dependency.ganttSourceTaskId,
				toTaskId: dependency.ganttTargetTaskId,
				type: dependency.ganttDependencyType,
			}),
		);

	return normalizeGanttChartDocument({
		title: frame.frameLabel?.trim() || "Project timeline",
		startDate: meta.startDate,
		dayCount: meta.dayCount,
		canvasViewportStartDay: meta.canvasViewportStartDay,
		canvasViewportDayCount: meta.canvasViewportDayCount,
		dayWidth: meta.dayWidth,
		labelWidth: meta.labelWidth,
		rowHeight: meta.rowHeight,
		headerHeight: meta.headerHeight,
		showToday: meta.showToday,
		tasks,
		dependencies:
			storedDependencies.length > 0 ? storedDependencies : canvasDependencies,
		appearance: appearanceFromUnknown(frame.customData?.ganttAppearance),
	});
}

/**
 * Returns the semantic document needed to repair a legacy or incomplete
 * canvas rendering. This includes scrollbars whose generated child elements
 * were omitted by an older persisted board snapshot.
 */
export function getGanttChartRepairDocument(
	elements: Iterable<CanvasElement>,
	chartOrElement: CanvasElement | string,
): GanttChartDocument | null {
	const list = Array.from(elements);
	const frame = findGanttChartElement(list, chartOrElement);
	if (!frame) return null;
	const document = getGanttChartDocument(list, frame);
	if (!document) return null;
	const aligned = alignGanttChartToCalendarYears(document);
	const needsCalendarAlignment =
		aligned.startDate !== document.startDate ||
		aligned.dayCount !== document.dayCount ||
		aligned.tasks.some(
			(task, index) => task.startDay !== document.tasks[index]?.startDay,
		);
	const hasPersistedViewport =
		typeof frame.customData?.dayCount === "number" &&
		frame.customData.dayCount >= GANTT_DEFAULT_DAY_COUNT &&
		typeof frame.customData?.canvasViewportStartDay === "number" &&
		typeof frame.customData?.canvasViewportDayCount === "number";
	const expectedScrollbar = getGanttCanvasScrollbarMetrics(aligned) !== null;
	const scrollbarRoles = new Set(
		list
			.filter((element) => getGanttChartId(element) === frame.id)
			.map((element) => element.customData?.ganttRole),
	);
	const hasCompleteScrollbar =
		scrollbarRoles.has("canvas-scrollbar-background") &&
		scrollbarRoles.has("canvas-scroll-track") &&
		scrollbarRoles.has("canvas-scroll-thumb");
	if (
		!needsCalendarAlignment &&
		hasPersistedViewport &&
		(!expectedScrollbar || hasCompleteScrollbar)
	) {
		return null;
	}
	return aligned;
}

export interface AddGanttTaskOptions {
	/** Insert the task as a child of this group. */
	parentId?: string;
	/** Insert directly after this task in display order (defaults to the end). */
	afterTaskId?: string;
	title?: string;
	category?: GanttTaskCategory;
	categoryLabel?: string;
	color?: string;
	durationDays?: number;
}

export function addGanttTask(
	document: GanttChartDocument,
	kind: "task" | "milestone" | "group" = "task",
	options: AddGanttTaskOptions = {},
): GanttChartDocument {
	const normalized = normalizeGanttChartDocument(document);
	let sequence = normalized.tasks.length + 1;
	let id = `task-${sequence}`;
	while (normalized.tasks.some((task) => task.id === id)) {
		sequence += 1;
		id = `task-${sequence}`;
	}
	const parentId =
		kind === "group"
			? undefined
			: (normalized.tasks.find(
					(task) => task.id === options.parentId && task.group,
				)?.id ?? undefined);
	// Schedule the new entry after its closest predecessor: the last sibling
	// inside the same group, or the last task overall.
	const siblings = parentId
		? normalized.tasks.filter((task) => task.parentId === parentId)
		: normalized.tasks;
	const previous = siblings.at(-1) ?? normalized.tasks.at(-1);
	const startDay = previous
		? previous.startDay + Math.max(1, previous.durationDays) + 1
		: 0;
	const category =
		kind === "task" ? (options.category ?? "project") : "project";
	const categoryDuration: Record<GanttBuiltInTaskCategory, number> = {
		project: 3,
		vacation: 5,
		absence: 1,
		"construction-site": 5,
		"home-office": 1,
	};
	const created: GanttChartTask = {
		id,
		title:
			options.title ??
			(kind === "milestone"
				? "New milestone"
				: kind === "group"
					? "New phase"
					: "New task"),
		startDay,
		durationDays:
			options.durationDays ??
			(kind === "task"
				? isGanttBuiltInTaskCategory(category)
					? categoryDuration[category]
					: 1
				: kind === "group"
					? 5
					: 1),
		progress: 0,
		status: "planned",
		category,
		categoryLabel: options.categoryLabel,
		color: options.color,
		milestone: kind === "milestone",
		critical: false,
		group: kind === "group",
		collapsed: false,
		parentId,
	};
	// Insert after the requested anchor so new rows appear where the user works.
	const anchorIndex = options.afterTaskId
		? normalized.tasks.findIndex((task) => task.id === options.afterTaskId)
		: -1;
	const tasks =
		anchorIndex >= 0
			? [
					...normalized.tasks.slice(0, anchorIndex + 1),
					created,
					...normalized.tasks.slice(anchorIndex + 1),
				]
			: [...normalized.tasks, created];
	return normalizeGanttChartDocument({ ...normalized, tasks });
}

export function updateGanttTask(
	document: GanttChartDocument,
	taskId: string,
	changes: Partial<Omit<GanttTaskInput, "id">>,
): GanttChartDocument {
	const normalized = normalizeGanttChartDocument(document);
	const target = normalized.tasks.find((task) => task.id === taskId);
	if (!target) return normalized;
	const children = normalized.tasks.filter((task) => task.parentId === taskId);
	// Moving a summary bar shifts the whole phase: children move by the same
	// day delta while everything else about them stays untouched.
	if (target.group && children.length > 0 && changes.startDay !== undefined) {
		const minChildStart = Math.min(...children.map((task) => task.startDay));
		const delta = Math.max(
			Math.round(changes.startDay) - target.startDay,
			-minChildStart,
		);
		const { startDay: _start, durationDays: _duration, ...rest } = changes;
		return normalizeGanttChartDocument({
			...normalized,
			tasks: normalized.tasks.map((task) => {
				if (task.id === taskId) return { ...task, ...rest };
				if (task.parentId === taskId) {
					return { ...task, startDay: task.startDay + delta };
				}
				return task;
			}),
		});
	}
	return normalizeGanttChartDocument({
		...normalized,
		tasks: normalized.tasks.map((task) =>
			task.id === taskId ? { ...task, ...changes } : task,
		),
	});
}

export function removeGanttTask(
	document: GanttChartDocument,
	taskId: string,
): GanttChartDocument {
	return normalizeGanttChartDocument({
		...document,
		// Removing a group keeps its children and promotes them to top level.
		tasks: document.tasks
			.filter((task) => task.id !== taskId)
			.map((task) =>
				task.parentId === taskId ? { ...task, parentId: undefined } : task,
			),
		dependencies: document.dependencies.filter(
			(dependency) =>
				dependency.fromTaskId !== taskId && dependency.toTaskId !== taskId,
		),
	});
}

/**
 * Moves a task (or a whole group block) to a new display position.
 * `targetIndex` addresses the flat task list after the moved block was
 * removed. `parentId` re-parents the task: a string assigns a group,
 * `null` promotes to top level, `undefined` keeps the current parent.
 */
export function moveGanttTask(
	document: GanttChartDocument,
	taskId: string,
	targetIndex: number,
	parentId?: string | null,
): GanttChartDocument {
	const normalized = normalizeGanttChartDocument(document);
	const moved = normalized.tasks.find((task) => task.id === taskId);
	if (!moved) return normalized;
	// Groups always drag their whole block of children with them.
	const blockIds = new Set(
		normalized.tasks
			.filter(
				(task) =>
					task.id === taskId || (moved.group && task.parentId === taskId),
			)
			.map((task) => task.id),
	);
	const block = normalized.tasks.filter((task) => blockIds.has(task.id));
	const rest = normalized.tasks.filter((task) => !blockIds.has(task.id));
	const index = clamp(Math.round(targetIndex), 0, rest.length);
	const nextParent =
		moved.group || parentId === undefined
			? moved.parentId
			: (parentId ?? undefined);
	const reparented = block.map((task) =>
		task.id === taskId ? { ...task, parentId: nextParent } : task,
	);
	return normalizeGanttChartDocument({
		...normalized,
		tasks: [...rest.slice(0, index), ...reparented, ...rest.slice(index)],
	});
}

/** Toggles (or sets) the collapsed state of a group row. */
export function toggleGanttGroupCollapsed(
	document: GanttChartDocument,
	groupId: string,
	collapsed?: boolean,
): GanttChartDocument {
	const normalized = normalizeGanttChartDocument(document);
	return normalizeGanttChartDocument({
		...normalized,
		tasks: normalized.tasks.map((task) =>
			task.id === groupId && task.group
				? { ...task, collapsed: collapsed ?? !task.collapsed }
				: task,
		),
	});
}

export function addGanttDependency(
	document: GanttChartDocument,
	dependency: GanttDependencyInput,
): GanttChartDocument {
	return normalizeGanttChartDocument({
		...document,
		dependencies: [...document.dependencies, dependency],
	});
}

export function removeGanttDependency(
	document: GanttChartDocument,
	index: number,
): GanttChartDocument {
	return normalizeGanttChartDocument({
		...document,
		dependencies: document.dependencies.filter(
			(_dependency, dependencyIndex) => dependencyIndex !== index,
		),
	});
}

export interface GanttDependencyBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

function dependencyAnchor(
	element: GanttDependencyBox,
	position: "start" | "finish",
): [number, number] {
	return [
		position === "start" ? element.x : element.x + element.width,
		element.y + element.height / 2,
	];
}

const GANTT_DEPENDENCY_CLEARANCE = 18;
const GANTT_DEPENDENCY_TARGET_GAP = 3;
const GANTT_DEPENDENCY_LANE_GAP = 8;

function compactDependencyPoints(
	points: [number, number][],
): [number, number][] {
	const unique = points.filter(
		(point, index) =>
			index === 0 ||
			point[0] !== points[index - 1]?.[0] ||
			point[1] !== points[index - 1]?.[1],
	);
	return unique.filter((point, index) => {
		const previous = unique[index - 1];
		const next = unique[index + 1];
		if (!previous || !next) return true;
		return !(
			(previous[0] === point[0] && point[0] === next[0]) ||
			(previous[1] === point[1] && point[1] === next[1])
		);
	});
}

/** Shared route used by both the canvas chart and the interactive Gantt studio. */
export function buildGanttDependencyRoute(
	source: GanttDependencyBox,
	target: GanttDependencyBox,
	type: GanttDependencyKind,
): [number, number][] {
	const sourcePosition =
		type === "finish-to-start" || type === "finish-to-finish"
			? "finish"
			: "start";
	const targetPosition =
		type === "finish-to-start" || type === "start-to-start"
			? "start"
			: "finish";
	const [sourceX, sourceY] = dependencyAnchor(source, sourcePosition);
	const [targetX, targetY] = dependencyAnchor(target, targetPosition);
	const sourceOutsideDirection = sourcePosition === "start" ? -1 : 1;
	const targetOutsideDirection = targetPosition === "start" ? -1 : 1;
	const rowDirection = targetY >= sourceY ? 1 : -1;
	const sourceClearX =
		sourceX + sourceOutsideDirection * GANTT_DEPENDENCY_CLEARANCE;
	const targetClearX =
		targetX + targetOutsideDirection * GANTT_DEPENDENCY_CLEARANCE;
	const targetTipX =
		targetX + targetOutsideDirection * GANTT_DEPENDENCY_TARGET_GAP;
	const laneY =
		sourceY + rowDirection * (source.height / 2 + GANTT_DEPENDENCY_LANE_GAP);
	return compactDependencyPoints([
		[sourceX, sourceY],
		[sourceClearX, sourceY],
		[sourceClearX, laneY],
		[targetClearX, laneY],
		[targetClearX, targetY],
		[targetTipX, targetY],
	]);
}

export function buildGanttDependencyChanges(
	source: CanvasElement,
	target: CanvasElement,
	type: GanttDependencyKind,
): Partial<CanvasElement> {
	const absolutePoints = buildGanttDependencyRoute(source, target, type);
	const minX = Math.min(...absolutePoints.map(([x]) => x));
	const minY = Math.min(...absolutePoints.map(([, y]) => y));
	const maxX = Math.max(...absolutePoints.map(([x]) => x));
	const maxY = Math.max(...absolutePoints.map(([, y]) => y));
	return {
		x: minX,
		y: minY,
		width: Math.max(1, maxX - minX),
		height: Math.max(1, maxY - minY),
		points: absolutePoints.map(
			([x, y]) => [x - minX, y - minY] as [number, number],
		),
		arrowMode: "elbow",
		arrowHeadStart: "none",
		arrowHeadEnd: "arrow",
	};
}

function geometryEquals(
	element: CanvasElement,
	changes: Partial<CanvasElement>,
): boolean {
	if (
		element.x !== changes.x ||
		element.y !== changes.y ||
		element.width !== changes.width ||
		element.height !== changes.height
	) {
		return false;
	}
	const left = element.points ?? [];
	const right = changes.points ?? [];
	return (
		left.length === right.length &&
		left.every(
			(point, index) =>
				point[0] === right[index]?.[0] && point[1] === right[index]?.[1],
		)
	);
}

export function buildGanttDependencySyncUpdates(
	elements: Map<string, CanvasElement>,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const tasks = new Map<string, CanvasElement>();
	for (const element of elements.values()) {
		const meta = getGanttTaskMeta(element);
		if (meta) tasks.set(`${meta.ganttChartId}:${meta.ganttTaskId}`, element);
	}
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];
	for (const element of elements.values()) {
		const meta = getGanttDependencyMeta(element);
		if (!meta) continue;
		const source = tasks.get(`${meta.ganttChartId}:${meta.ganttSourceTaskId}`);
		const target = tasks.get(`${meta.ganttChartId}:${meta.ganttTargetTaskId}`);
		if (!source || !target) continue;
		const changes = buildGanttDependencyChanges(
			source,
			target,
			meta.ganttDependencyType,
		);
		if (!geometryEquals(element, changes))
			updates.push({ id: element.id, changes });
	}
	return updates;
}

export function createGanttChartElements(
	defaults: CanvasElementFactoryDefaults,
	options: CreateGanttChartOptions,
): CanvasElement[] {
	const document = createDefaultGanttChartDocument(options);
	const {
		tasks,
		dependencies,
		startDate,
		dayCount,
		canvasViewportStartDay: storedCanvasViewportStartDay,
		canvasViewportDayCount: storedCanvasViewportDayCount,
		dayWidth,
		labelWidth,
		rowHeight,
		headerHeight,
		appearance,
		showToday,
	} = document;
	const canvasViewportDayCount =
		storedCanvasViewportDayCount ??
		Math.min(dayCount, GANTT_CANVAS_DEFAULT_VISIBLE_DAYS);
	const canvasViewportStartDay = storedCanvasViewportStartDay ?? 0;
	const canvasViewportEndDay = canvasViewportStartDay + canvasViewportDayCount;
	const scrollbarMetrics = getGanttCanvasScrollbarMetrics(document);
	// Gantt text always uses a legible sans-serif, ignoring the canvas' default
	// hand-drawn font, unless the caller explicitly overrides it.
	const fontFamily = options.fontFamily ?? GANTT_DEFAULT_FONT_FAMILY;
	const title = document.title;
	const chartId = options.chartId ?? defaults.createId();
	// Collapsed groups hide their children, so all row math uses visible tasks.
	const visibleTasks = visibleTaskList(tasks);
	const rowsHeight = Math.max(1, visibleTasks.length) * rowHeight;
	const scrollbarHeight = scrollbarMetrics ? GANTT_CANVAS_SCROLLBAR_HEIGHT : 0;
	const width = labelWidth + canvasViewportDayCount * dayWidth;
	const height = headerHeight + rowsHeight + scrollbarHeight;
	const timelineX = options.x + labelWidth;
	const bodyY = options.y + headerHeight;
	const bodyHeight = rowsHeight;
	const taskById = new Map<string, CanvasElement>();
	const staticElements: CanvasElement[] = [];
	const taskElements: CanvasElement[] = [];
	// Progress fills render on top of the bars, so they are collected
	// separately and appended after the bars.
	const progressElements: CanvasElement[] = [];
	// Text is a separate overlay so the generic rectangle padding cannot
	// squeeze labels inside the compact 28px bars.
	const taskBarLabelElements: CanvasElement[] = [];
	const scrollbarElements: CanvasElement[] = [];

	const frame = createBaseCanvasElement(defaults, {
		id: chartId,
		type: "frame",
		x: options.x,
		y: options.y,
		width,
		height,
		fill: appearance.background,
		stroke: appearance.gridStroke,
		strokeWidth: 1.5,
		frameLabel: title,
		customData: {
			skedraType: GANTT_CHART_TYPE,
			ganttChartId: chartId,
			startDate,
			dayCount,
			canvasViewportStartDay,
			canvasViewportDayCount,
			dayWidth,
			labelWidth,
			rowHeight,
			headerHeight,
			showToday,
			ganttTasks: tasks,
			ganttDependencies: dependencies,
			ganttAppearance: appearance,
		},
	});

	staticElements.push(
		createBaseCanvasElement(defaults, {
			type: "rectangle",
			x: options.x,
			y: options.y,
			width: labelWidth,
			height: headerHeight,
			fill: appearance.headerFill,
			stroke: appearance.gridStroke,
			strokeWidth: 1,
			text: resolveText(options, "gantt.taskColumn", "Task"),
			textColor: appearance.textColor,
			fontFamily,
			fontSize: 16,
			fontWeight: "bold",
			textAlign: "left",
			frameId: chartId,
			locked: true,
			customData: { ganttChartId: chartId, ganttRole: "task-header" },
		}),
	);

	const labelDateRange = options.dateLabel ?? defaultDateLabel;
	const calendarWeekLabel = resolveText(options, "gantt.calendarWeek", "CW");
	for (let offset = 0; offset < canvasViewportDayCount; ) {
		const semanticOffset = canvasViewportStartDay + offset;
		const visibleDate = addGanttDays(startDate, semanticOffset);
		const calendarWeek = getGanttCalendarWeek(visibleDate);
		const days = Math.min(
			7 - calendarWeek.dayIndex,
			canvasViewportDayCount - offset,
		);
		staticElements.push(
			createBaseCanvasElement(defaults, {
				type: "rectangle",
				x: timelineX + offset * dayWidth,
				y: options.y,
				width: days * dayWidth,
				height: headerHeight,
				fill: appearance.headerFill,
				stroke: appearance.gridStroke,
				strokeWidth: 1,
				text: `${calendarWeekLabel} ${calendarWeek.week} \u00b7 ${labelDateRange(
					calendarWeek.startDate,
					calendarWeek.endDate,
				)}`,
				textColor: appearance.mutedTextColor,
				fontFamily,
				fontSize: 13,
				fontWeight: "bold",
				textAlign: "center",
				frameId: chartId,
				locked: true,
				customData: {
					ganttChartId: chartId,
					ganttRole: "time-header",
					ganttStartDay: getGanttDayOffset(startDate, calendarWeek.startDate),
				},
			}),
		);
		offset += days;
	}

	for (const [index, task] of visibleTasks.entries()) {
		const rowY = bodyY + index * rowHeight;
		const rowFill = task.group
			? appearance.headerFill
			: index % 2 === 0
				? appearance.rowFill
				: appearance.alternateRowFill;
		// Groups carry a collapse marker, children an em-space indent. Both are
		// stripped again when canvas label edits are folded back.
		const decoratedTitle = task.group
			? `${task.collapsed ? "▸" : "▾"} ${task.title}`
			: task.parentId
				? ` ${task.title}`
				: task.title;
		staticElements.push(
			createBaseCanvasElement(defaults, {
				type: "rectangle",
				x: options.x,
				y: rowY,
				width: labelWidth,
				height: rowHeight,
				fill: rowFill,
				stroke: appearance.gridStroke,
				strokeWidth: 1,
				text: task.owner ? `${decoratedTitle}\n${task.owner}` : decoratedTitle,
				textColor: appearance.textColor,
				fontFamily,
				fontSize: task.owner ? 13 : 14,
				fontWeight: "bold",
				textAlign: "left",
				frameId: chartId,
				customData: {
					ganttChartId: chartId,
					ganttTaskId: task.id,
					ganttRole: "task-label",
				},
			}),
			createBaseCanvasElement(defaults, {
				type: "rectangle",
				x: timelineX,
				y: rowY,
				width: canvasViewportDayCount * dayWidth,
				height: rowHeight,
				fill: rowFill,
				stroke: appearance.gridStroke,
				strokeWidth: 1,
				frameId: chartId,
				locked: true,
				customData: {
					ganttChartId: chartId,
					ganttTaskId: task.id,
					ganttRole: "timeline-row",
				},
			}),
		);

		const taskStartDay = task.startDay;
		const taskEndDay = task.startDay + Math.max(1, task.durationDays);
		const visibleTaskStartDay = Math.max(taskStartDay, canvasViewportStartDay);
		const visibleTaskEndDay = Math.min(taskEndDay, canvasViewportEndDay);
		const taskIsVisible = visibleTaskStartDay < visibleTaskEndDay;
		const start = visibleTaskStartDay - canvasViewportStartDay;
		const duration = Math.max(1, visibleTaskEndDay - visibleTaskStartDay);
		const viewportClipped =
			visibleTaskStartDay !== taskStartDay || visibleTaskEndDay !== taskEndDay;
		const taskStartDate = addGanttDays(startDate, task.startDay);
		const taskEndDate = addGanttDays(
			startDate,
			task.startDay + task.durationDays - 1,
		);
		if (task.group) {
			if (!taskIsVisible) continue;
			// Summary bar: a slim, locked span. It is intentionally not tagged as
			// GANTT_TASK_TYPE so canvas fold-back and dependency sync skip it —
			// its schedule is always derived from the children.
			staticElements.push(
				createBaseCanvasElement(defaults, {
					type: "rectangle",
					x: timelineX + start * dayWidth + 2,
					y: rowY + (rowHeight - 12) / 2,
					width: Math.max(14, duration * dayWidth - 4),
					height: 12,
					fill: task.color ?? "#475569",
					stroke: task.color ?? "#475569",
					strokeWidth: 1,
					cornerRadius: 4,
					frameId: chartId,
					locked: true,
					customData: {
						ganttChartId: chartId,
						ganttTaskId: task.id,
						ganttRole: "group-bar",
					},
				}),
			);
			continue;
		}
		if (!taskIsVisible) continue;
		const barHeight = task.milestone ? 24 : 28;
		const barX = timelineX + start * dayWidth + (task.milestone ? 2 : 4);
		const barY = rowY + (rowHeight - barHeight) / 2;
		const barWidth = task.milestone
			? barHeight
			: Math.max(18, duration * dayWidth - 8);
		const color = task.color ?? getGanttTaskDefaultColor(task);
		const element = createBaseCanvasElement(defaults, {
			type: task.milestone ? "diamond" : "rectangle",
			x: barX,
			y: barY,
			width: barWidth,
			height: barHeight,
			fill: color,
			stroke: task.critical ? "#EF4444" : color,
			strokeWidth: task.critical ? 2 : 1.5,
			strokeStyle: task.critical ? "dashed" : "solid",
			cornerRadius: task.milestone ? undefined : 7,
			// No text inside the bar: a small bold label inside a ~28px bar gets
			// clipped and looks garbled. Progress is shown as a fill overlay
			// instead, and the exact value lives in the editor grid.
			text: "",
			frameId: chartId,
			locked: viewportClipped,
			customData: {
				skedraType: GANTT_TASK_TYPE,
				ganttChartId: chartId,
				ganttTaskId: task.id,
				startDay: task.startDay,
				durationDays: task.durationDays,
				startDate: taskStartDate,
				endDate: taskEndDate,
				progress: task.progress,
				status: task.status,
				category: task.category,
				categoryLabel: task.categoryLabel,
				owner: task.owner,
				milestone: task.milestone,
				critical: task.critical,
				ganttViewportClipped: viewportClipped,
			},
		});
		taskById.set(task.id, element);
		taskElements.push(element);

		const barLabelFontSize = task.milestone ? 10 : 11;
		const labelX = task.milestone ? barX + barWidth + 7 : barX + 6;
		const barLabelWidth = task.milestone
			? Math.max(0, timelineX + canvasViewportDayCount * dayWidth - labelX - 4)
			: Math.max(0, barWidth - 12);
		const fittedBarLabel = fitGanttBarLabel(
			task.title,
			barLabelWidth,
			barLabelFontSize,
		);
		if (fittedBarLabel) {
			taskBarLabelElements.push(
				createBaseCanvasElement(defaults, {
					type: "text",
					x: labelX,
					y: barY + (barHeight - 18) / 2,
					width: barLabelWidth,
					height: 18,
					fill: "transparent",
					stroke: task.milestone ? appearance.mutedTextColor : "#FFFFFF",
					strokeWidth: 0,
					text: fittedBarLabel,
					textColor: task.milestone ? appearance.mutedTextColor : "#FFFFFF",
					fontFamily,
					fontSize: barLabelFontSize,
					fontWeight: "bold",
					textAlign: "left",
					frameId: chartId,
					locked: true,
					customData: {
						ganttChartId: chartId,
						ganttTaskId: task.id,
						ganttRole: "task-bar-label",
					},
				}),
			);
		}

		// Progress fill: a translucent overlay covering the completed share of
		// the bar. Locked, so it never intercepts the bar's drag/selection.
		if (!task.milestone && task.progress > 0) {
			const innerWidth = Math.max(0, barWidth - 4);
			const fillWidth = Math.max(
				3,
				(innerWidth * clamp(task.progress, 0, 100)) / 100,
			);
			progressElements.push(
				createBaseCanvasElement(defaults, {
					type: "rectangle",
					x: barX + 2,
					y: barY + 2,
					width: fillWidth,
					height: barHeight - 4,
					fill: "rgba(255, 255, 255, 0.30)",
					stroke: "transparent",
					strokeWidth: 0,
					cornerRadius: 5,
					frameId: chartId,
					locked: true,
					customData: {
						ganttChartId: chartId,
						ganttTaskId: task.id,
						ganttRole: "task-progress",
					},
				}),
			);
		}
	}

	for (let day = 1; day < canvasViewportDayCount; day++) {
		const semanticDay = canvasViewportStartDay + day;
		const isWeekStart =
			getGanttCalendarWeek(addGanttDays(startDate, semanticDay)).dayIndex === 0;
		staticElements.push(
			createBaseCanvasElement(defaults, {
				type: "line",
				x: timelineX + day * dayWidth,
				y: bodyY,
				width: 1,
				height: bodyHeight,
				points: [
					[0, 0],
					[0, bodyHeight],
				],
				stroke: appearance.gridStroke,
				strokeWidth: isWeekStart ? 1.5 : 0.75,
				opacity: isWeekStart ? 75 : 35,
				frameId: chartId,
				locked: true,
				customData: { ganttChartId: chartId, ganttRole: "day-grid" },
			}),
		);
	}

	const today = options.today ?? toIsoDate(new Date());
	if (showToday && parseIsoDate(today)) {
		const todayOffset =
			getGanttDayOffset(startDate, today) - canvasViewportStartDay;
		if (todayOffset >= 0 && todayOffset < canvasViewportDayCount) {
			const todayX = timelineX + (todayOffset + 0.5) * dayWidth;
			const todayLabel = resolveText(options, "gantt.today", "Today");
			staticElements.push(
				createBaseCanvasElement(defaults, {
					type: "line",
					x: todayX,
					y: options.y + headerHeight - 16,
					width: 1,
					height: bodyHeight + 16,
					points: [
						[0, 0],
						[0, bodyHeight + 16],
					],
					stroke: "#F43F5E",
					strokeWidth: 2,
					frameId: chartId,
					locked: true,
					customData: {
						ganttChartId: chartId,
						ganttRole: "today-line",
					},
				}),
				createBaseCanvasElement(defaults, {
					type: "rectangle",
					x: todayX - 28,
					y: options.y + headerHeight - 19,
					width: 56,
					height: 18,
					fill: "#F43F5E",
					stroke: "#F43F5E",
					strokeWidth: 1,
					cornerRadius: 5,
					text: "",
					frameId: chartId,
					locked: true,
					customData: {
						ganttChartId: chartId,
						ganttRole: "today-label-background",
					},
				}),
				createBaseCanvasElement(defaults, {
					type: "text",
					x: todayX - 28,
					y: options.y + headerHeight - 19,
					width: 56,
					height: 18,
					fill: "transparent",
					stroke: "#FFFFFF",
					strokeWidth: 0,
					text: todayLabel,
					textColor: "#FFFFFF",
					fontFamily,
					fontSize: 10,
					fontWeight: "bold",
					textAlign: "center",
					frameId: chartId,
					locked: true,
					customData: {
						ganttChartId: chartId,
						ganttRole: "today-label",
					},
				}),
			);
		}
	}

	if (scrollbarMetrics) {
		const scrollbarY = options.y + headerHeight + rowsHeight;
		staticElements.push(
			createBaseCanvasElement(defaults, {
				type: "rectangle",
				x: options.x,
				y: scrollbarY,
				width,
				height: GANTT_CANVAS_SCROLLBAR_HEIGHT,
				fill: appearance.headerFill,
				stroke: appearance.gridStroke,
				strokeWidth: 1,
				frameId: chartId,
				locked: true,
				customData: {
					ganttChartId: chartId,
					ganttRole: "canvas-scrollbar-background",
				},
			}),
			createBaseCanvasElement(defaults, {
				type: "rectangle",
				x: timelineX + scrollbarMetrics.trackInset,
				y: scrollbarY + 5,
				width: scrollbarMetrics.trackWidth,
				height: 8,
				fill: appearance.gridStroke,
				stroke: "transparent",
				strokeWidth: 0,
				cornerRadius: 4,
				opacity: 45,
				frameId: chartId,
				locked: true,
				customData: {
					ganttChartId: chartId,
					ganttRole: "canvas-scroll-track",
				},
			}),
		);
		scrollbarElements.push(
			createBaseCanvasElement(defaults, {
				type: "rectangle",
				x:
					timelineX +
					scrollbarMetrics.trackInset +
					scrollbarMetrics.thumbOffset,
				y: scrollbarY + 4,
				width: scrollbarMetrics.thumbWidth,
				height: 10,
				fill: appearance.mutedTextColor,
				stroke: appearance.mutedTextColor,
				strokeWidth: 1,
				cornerRadius: 5,
				frameId: chartId,
				locked: true,
				customData: {
					ganttChartId: chartId,
					ganttRole: "canvas-scroll-thumb",
				},
			}),
		);
	}

	const dependencyElements: CanvasElement[] = [];
	for (const dependency of dependencies) {
		const source = taskById.get(dependency.fromTaskId);
		const target = taskById.get(dependency.toTaskId);
		if (!source || !target || source === target) continue;
		const type = dependency.type ?? "finish-to-start";
		const geometry = buildGanttDependencyChanges(source, target, type);
		dependencyElements.push(
			createBaseCanvasElement(defaults, {
				type: "arrow",
				x: geometry.x,
				y: geometry.y,
				width: geometry.width,
				height: geometry.height,
				points: geometry.points,
				arrowMode: "elbow",
				arrowHeadStart: "none",
				arrowHeadEnd: "arrow",
				arrowHeadScale: 0.7,
				fill: "transparent",
				stroke: appearance.dependencyStroke,
				strokeWidth: 1.25,
				opacity: 78,
				frameId: chartId,
				customData: {
					skedraType: GANTT_DEPENDENCY_TYPE,
					ganttChartId: chartId,
					ganttSourceTaskId: dependency.fromTaskId,
					ganttTargetTaskId: dependency.toTaskId,
					ganttDependencyType: type,
				},
			}),
		);
	}

	return [
		frame,
		...staticElements,
		...dependencyElements,
		...taskElements,
		...progressElements,
		...taskBarLabelElements,
		...scrollbarElements,
	];
}

function getGanttGeneratedElementPoolKey(element: CanvasElement): string {
	const data = element.customData;
	const role = typeof data?.ganttRole === "string" ? data.ganttRole : null;
	const taskId =
		typeof data?.ganttTaskId === "string" ? data.ganttTaskId : null;
	if (role) {
		return taskId ? `role:${role}:task:${taskId}` : `role:${role}`;
	}
	if (data?.skedraType === GANTT_TASK_TYPE && taskId) {
		return `task:${taskId}`;
	}
	if (data?.skedraType === GANTT_DEPENDENCY_TYPE) {
		return [
			"dependency",
			data.ganttSourceTaskId,
			data.ganttTargetTaskId,
			data.ganttDependencyType,
		].join(":");
	}
	return `type:${element.type}`;
}

function buildGanttGeneratedElementChanges(
	current: CanvasElement,
	next: CanvasElement,
): Partial<CanvasElement> {
	const currentRecord = current as unknown as Record<string, unknown>;
	const nextRecord = next as unknown as Record<string, unknown>;
	const changes: Record<string, unknown> = {};
	for (const key of new Set([
		...Object.keys(currentRecord),
		...Object.keys(nextRecord),
	])) {
		if (key === "id") continue;
		if (key === "stackIndex" && Object.hasOwn(currentRecord, key)) {
			changes[key] = currentRecord[key];
			continue;
		}
		changes[key] = Object.hasOwn(nextRecord, key) ? nextRecord[key] : undefined;
	}
	return changes as Partial<CanvasElement>;
}

/**
 * Rebuilds one chart while preserving stable ids for the frame and reusable
 * generated children. Stable child ids prevent React/SVG from unmounting the
 * complete chart during semantic edits such as dragging its scrollbar.
 */
export function buildGanttChartMutationPlan(
	defaults: CanvasElementFactoryDefaults,
	elements: Iterable<CanvasElement>,
	chartOrElement: CanvasElement | string,
	document: GanttChartDocument,
	options: Pick<
		CreateGanttChartOptions,
		"fontFamily" | "text" | "dateLabel" | "today"
	> = {},
): GanttChartMutationPlan {
	const list = Array.from(elements);
	const frame = findGanttChartElement(list, chartOrElement);
	const meta = getGanttChartMeta(frame);
	if (!frame || !meta) throw new Error("Gantt chart not found");
	const normalized = normalizeGanttChartDocument(document);
	const next = createGanttChartElements(defaults, {
		x: frame.x,
		y: frame.y,
		chartId: frame.id,
		...normalized,
		...options,
	});
	const [nextFrame, ...children] = next;
	if (!nextFrame) throw new Error("Gantt chart rebuild produced no frame");
	const { id: _frameId, ...changes } = nextFrame;
	const currentChildren = list.filter(
		(element) =>
			element.id !== frame.id &&
			(getGanttChartId(element) === meta.ganttChartId ||
				element.frameId === frame.id),
	);
	const reusableByKey = new Map<string, CanvasElement[]>();
	for (const element of currentChildren) {
		const key = getGanttGeneratedElementPoolKey(element);
		const pool = reusableByKey.get(key);
		if (pool) pool.push(element);
		else reusableByKey.set(key, [element]);
	}

	const reusedIds = new Set<string>();
	const create: CanvasElement[] = [];
	const update: GanttChartMutationPlan["update"] = [{ id: frame.id, changes }];
	for (const child of children) {
		const current = reusableByKey
			.get(getGanttGeneratedElementPoolKey(child))
			?.shift();
		if (!current) {
			create.push(child);
			continue;
		}
		reusedIds.add(current.id);
		update.push({
			id: current.id,
			changes: buildGanttGeneratedElementChanges(current, child),
		});
	}
	return {
		create,
		update,
		deleteIds: currentChildren
			.filter((element) => !reusedIds.has(element.id))
			.map((element) => element.id),
		selectedIds: [frame.id],
	};
}

/** Returns the semantic state needed by editors and remote integrations. */
export function getGanttChartSummaries(
	elements: Iterable<CanvasElement>,
): GanttChartSummary[] {
	const list = Array.from(elements);
	return list.flatMap((element) => {
		if (!getGanttChartMeta(element)) return [];
		const document = getGanttChartDocument(list, element);
		if (!document) return [];
		return [
			{
				id: element.id,
				title: document.title,
				startDate: document.startDate,
				dayCount: document.dayCount,
				showToday: document.showToday,
				tasks: document.tasks,
				dependencies: document.dependencies,
			},
		];
	});
}

/** Applies one semantic edit and rebuilds the chart as one atomic mutation. */
export function planGanttChartEdit(
	options: PlanGanttChartEditOptions,
): PlannedGanttChartEdit | null {
	const elements = Array.from(options.elements);
	const frame = findGanttChartElement(elements, options.chartId);
	const current = getGanttChartDocument(elements, frame);
	if (!frame || !current) return null;

	let document = current;
	let affectedTaskId: string | undefined;
	const action = options.action;
	switch (action.operation) {
		case "update_chart":
			document = normalizeGanttChartDocument({
				...document,
				...action.changes,
			});
			break;
		case "add_task": {
			if (
				action.parentId &&
				!document.tasks.some(
					(task) => task.id === action.parentId && task.group,
				)
			) {
				return null;
			}
			if (
				action.afterTaskId &&
				!document.tasks.some((task) => task.id === action.afterTaskId)
			) {
				return null;
			}
			const existingIds = new Set(document.tasks.map((task) => task.id));
			document = addGanttTask(document, action.kind, {
				parentId: action.parentId,
				afterTaskId: action.afterTaskId,
				title: action.task?.title,
				category: action.task?.category,
				categoryLabel: action.task?.categoryLabel,
				color: action.task?.color,
				durationDays: action.task?.durationDays,
			});
			const created = document.tasks.find((task) => !existingIds.has(task.id));
			if (!created) return null;
			affectedTaskId = created.id;
			if (action.task) {
				document = updateGanttTask(document, created.id, action.task);
			}
			break;
		}
		case "update_task":
			if (!document.tasks.some((task) => task.id === action.taskId))
				return null;
			affectedTaskId = action.taskId;
			document = updateGanttTask(document, action.taskId, action.changes);
			break;
		case "shift_task": {
			const task = document.tasks.find(
				(candidate) => candidate.id === action.taskId,
			);
			if (!task) return null;
			affectedTaskId = task.id;
			document = updateGanttTask(document, task.id, {
				startDay: task.startDay + Math.round(action.deltaDays),
			});
			break;
		}
		case "delete_task":
			if (!document.tasks.some((task) => task.id === action.taskId))
				return null;
			affectedTaskId = action.taskId;
			document = removeGanttTask(document, action.taskId);
			break;
		case "move_task":
			if (!document.tasks.some((task) => task.id === action.taskId))
				return null;
			if (
				typeof action.parentId === "string" &&
				!document.tasks.some(
					(task) => task.id === action.parentId && task.group,
				)
			) {
				return null;
			}
			affectedTaskId = action.taskId;
			document = moveGanttTask(
				document,
				action.taskId,
				action.targetIndex,
				action.parentId,
			);
			break;
		case "set_group_collapsed":
			if (
				!document.tasks.some((task) => task.id === action.groupId && task.group)
			) {
				return null;
			}
			affectedTaskId = action.groupId;
			document = toggleGanttGroupCollapsed(
				document,
				action.groupId,
				action.collapsed,
			);
			break;
		case "add_dependency":
			if (
				action.fromTaskId === action.toTaskId ||
				![action.fromTaskId, action.toTaskId].every((taskId) =>
					document.tasks.some((task) => task.id === taskId && !task.group),
				)
			) {
				return null;
			}
			document = addGanttDependency(document, {
				fromTaskId: action.fromTaskId,
				toTaskId: action.toTaskId,
				type: action.type,
			});
			break;
		case "delete_dependency":
			if (!document.dependencies[action.dependencyIndex]) return null;
			document = removeGanttDependency(document, action.dependencyIndex);
			break;
	}

	return {
		plan: buildGanttChartMutationPlan(
			options.defaults,
			elements,
			frame,
			document,
			options.buildOptions,
		),
		document,
		affectedTaskId,
	};
}
