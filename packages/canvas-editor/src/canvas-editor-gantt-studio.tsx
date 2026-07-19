/**
 * Interactive Gantt studio.
 *
 * A full project-planning surface rendered as DOM (not canvas elements):
 * task table on the left, timeline on the right. Every interaction commits
 * immediately through `onChange` — there is no explicit "apply" step. The
 * host converts the emitted document into canvas elements, so the canvas
 * chart always mirrors what the studio shows.
 *
 * Supported interactions:
 * - drag a bar to move it (day snapping), drag its edges to resize
 * - drag from the link handle at a bar's end onto another row to create a
 *   finish-to-start dependency; click a dependency to retype or delete it
 * - inline editing of every cell (name, owner, start, duration, progress)
 * - row drag & drop to reorder, with group (phase) support and collapsing
 */

import {
	type GanttBuiltInTaskCategory,
	type GanttChartDocument,
	type GanttChartTask,
	type GanttDependencyKind,
	type GanttTaskCategory,
	type GanttTaskInput,
	type GanttTaskStatus,
	addGanttCalendarYear,
	addGanttDays,
	addGanttDependency,
	addGanttTask,
	alignGanttChartToCalendarYears,
	buildGanttDependencyRoute,
	ensureGanttCalendarIncludesDate,
	focusGanttChartOnDate,
	getArrowPath,
	getGanttCalendarWeek,
	getGanttCalendarYearRange,
	getGanttDayOffset,
	getGanttTaskDefaultColor,
	getGanttVisibleTasks,
	isGanttBuiltInTaskCategory,
	moveGanttTask,
	normalizeGanttChartDocument,
	removeGanttCalendarYear,
	removeGanttDependency,
	removeGanttTask,
	toggleGanttGroupCollapsed,
	updateGanttTask,
} from "@skedra/canvas-core";
import {
	CalendarDays,
	CalendarRange,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Diamond,
	Flame,
	GripHorizontal,
	GripVertical,
	Layers,
	Maximize2,
	Minus,
	MoreHorizontal,
	Plus,
	Trash2,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import {
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export type CanvasEditorGanttStudioTranslate = (
	key: string,
	fallback: string,
) => string;

export interface CanvasEditorGanttChartOption {
	id: string;
	title: string;
}

export interface CanvasEditorGanttStudioProps {
	document: GanttChartDocument | null;
	translate?: CanvasEditorGanttStudioTranslate;
	/** BCP-47 locale used for month/day header labels. */
	locale?: string;
	/** ISO date rendered as the "today" marker. Defaults to the system date. */
	today?: string;
	className?: string;
	style?: CSSProperties;
	/** All plans available on the current canvas. */
	charts?: readonly CanvasEditorGanttChartOption[];
	activeChartId?: string | null;
	onSelectChart?: (chartId: string) => void;
	/** Fired after every committed interaction — the host applies it live. */
	onChange: (document: GanttChartDocument) => void;
	onCreate?: () => void;
	onDelete?: () => void;
	onClose?: () => void;
}

/* ------------------------------------------------------------------ */
/* Layout constants (studio-local; canvas keeps its own scale values). */
/* ------------------------------------------------------------------ */

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 64;
const TABLE_WIDTH = 740;
const BAR_HEIGHT = 24;
const MILESTONE_SIZE = 18;

/* Docked-drawer sizing. The editor is a bottom dock, not a full-screen
 * takeover, so the canvas chart it edits stays visible above it. */
const DOCK_MIN_HEIGHT = 200;
const DOCK_DEFAULT_HEIGHT = 380;
/** Keep at least this much canvas visible above the drawer. */
const DOCK_TOP_GAP = 96;

const STATUS_OPTIONS: GanttTaskStatus[] = [
	"planned",
	"active",
	"completed",
	"delayed",
];

const STATUS_FALLBACKS: Record<GanttTaskStatus, string> = {
	planned: "Planned",
	active: "Active",
	completed: "Completed",
	delayed: "Delayed",
};

const CATEGORY_PRESETS: GanttBuiltInTaskCategory[] = [
	"project",
	"vacation",
	"absence",
	"construction-site",
	"home-office",
];

const CATEGORY_FALLBACKS: Record<GanttBuiltInTaskCategory, string> = {
	project: "Project task",
	vacation: "Vacation",
	absence: "Absence",
	"construction-site": "Construction site",
	"home-office": "Home office",
};

const CATEGORY_SHORT_LABELS: Record<GanttBuiltInTaskCategory, string> = {
	project: "",
	vacation: "VAC",
	absence: "ABS",
	"construction-site": "SITE",
	"home-office": "HO",
};

const CUSTOM_CATEGORY_VALUE = "__custom-category__";

function createCustomCategoryId(label: string): string {
	const slug = label
		.trim()
		.toLocaleLowerCase()
		.normalize("NFKD")
		.replace(/\p{M}+/gu, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 56);
	return `custom:${slug || "entry"}`;
}

function categoryShortLabel(label: string): string {
	const words = label.trim().split(/\s+/).filter(Boolean);
	if (words.length > 1) {
		return words
			.slice(0, 3)
			.map((word) => word[0])
			.join("")
			.toLocaleUpperCase();
	}
	return (words[0] ?? "TYPE").slice(0, 4).toLocaleUpperCase();
}

const DEPENDENCY_OPTIONS: GanttDependencyKind[] = [
	"finish-to-start",
	"start-to-start",
	"finish-to-finish",
	"start-to-finish",
];

const DEPENDENCY_FALLBACKS: Record<GanttDependencyKind, string> = {
	"finish-to-start": "Finish to start",
	"start-to-start": "Start to start",
	"finish-to-finish": "Finish to finish",
	"start-to-finish": "Start to finish",
};

const fallbackTranslate: CanvasEditorGanttStudioTranslate = (_key, fallback) =>
	fallback;

function joinClasses(...values: Array<string | false | null | undefined>) {
	return values.filter(Boolean).join(" ");
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function isoToday(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Weekday index of an ISO date (0 = Sunday … 6 = Saturday). */
function weekdayOf(isoDate: string): number {
	return new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
}

/* ------------------------------------------------------------- */
/* Drag state models — all previews are local, commits go through */
/* the pure canvas-core document helpers.                         */
/* ------------------------------------------------------------- */

interface BarDrag {
	kind: "move" | "resize-start" | "resize-end";
	taskId: string;
	originStart: number;
	originDuration: number;
	pointerStartX: number;
	deltaDays: number;
	moved: boolean;
}

interface LinkDrag {
	fromTaskId: string;
	/** Cursor position in timeline coordinates. */
	x: number;
	y: number;
	targetTaskId: string | null;
}

interface RowDrag {
	taskId: string;
	pointerStartY: number;
	/** Insertion index into the visible row list. */
	insertionIndex: number;
	moved: boolean;
}

interface CustomCategoryOption {
	id: string;
	label: string;
	color?: string;
}

interface CalendarPan {
	pointerId: number;
	startX: number;
	scrollLeft: number;
}

/** Effective start/duration override map used for live drag previews. */
type PreviewMap = Map<string, { startDay: number; durationDays: number }>;

export function CanvasEditorGanttStudio({
	document: documentProp,
	translate: t = fallbackTranslate,
	locale = "en",
	today,
	className,
	style,
	charts = [],
	activeChartId,
	onSelectChart,
	onChange,
	onCreate,
	onDelete,
	onClose,
}: CanvasEditorGanttStudioProps) {
	/* ------------------------------------------------------------ */
	/* Draft state: the studio owns the document while it is open.   */
	/* Incoming prop changes are adopted only when they differ from  */
	/* what we last emitted (i.e. external/collaborative edits).     */
	/* ------------------------------------------------------------ */
	const [draft, setDraft] = useState<GanttChartDocument | null>(() =>
		documentProp ? alignGanttChartToCalendarYears(documentProp) : null,
	);
	const lastEmittedRef = useRef<string | null>(null);
	useEffect(() => {
		if (!documentProp) {
			setDraft(null);
			lastEmittedRef.current = null;
			return;
		}
		const normalized = alignGanttChartToCalendarYears(documentProp);
		const serialized = JSON.stringify(normalized);
		if (serialized !== lastEmittedRef.current) {
			setDraft(normalized);
			lastEmittedRef.current = serialized;
		}
	}, [documentProp]);

	const commit = useCallback(
		(next: GanttChartDocument) => {
			const normalized = alignGanttChartToCalendarYears(next);
			setDraft(normalized);
			lastEmittedRef.current = JSON.stringify(normalized);
			onChange(normalized);
		},
		[onChange],
	);

	/* ------------------------- UI state ------------------------- */
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
	const [selectedDependency, setSelectedDependency] = useState<number | null>(
		null,
	);
	const [barDrag, setBarDrag] = useState<BarDrag | null>(null);
	const [linkDrag, setLinkDrag] = useState<LinkDrag | null>(null);
	const [rowDrag, setRowDrag] = useState<RowDrag | null>(null);
	const [customCategoryFormOpen, setCustomCategoryFormOpen] = useState(false);
	const [customCategoryName, setCustomCategoryName] = useState("");
	const [customCategoryColor, setCustomCategoryColor] = useState("#0F766E");
	const [actionsTaskId, setActionsTaskId] = useState<string | null>(null);
	const bodyRef = useRef<HTMLDivElement | null>(null);
	const calendarPanRef = useRef<CalendarPan | null>(null);
	const timelineRef = useRef<HTMLDivElement | null>(null);
	const rowsRef = useRef<HTMLDivElement | null>(null);

	/* Dock height + collapsed state. The user drags the top edge to resize,
	 * or collapses the drawer down to just its title bar. */
	const [dockHeight, setDockHeight] = useState(DOCK_DEFAULT_HEIGHT);
	const [collapsed, setCollapsed] = useState(false);
	const dockResizeRef = useRef<{ startY: number; startHeight: number } | null>(
		null,
	);
	const startDockResize = (event: ReactPointerEvent) => {
		if (event.button !== 0) return;
		event.preventDefault();
		const handle = event.currentTarget as HTMLElement;
		handle.setPointerCapture(event.pointerId);
		const renderedHeight = handle
			.closest<HTMLElement>(".canvas-editor__gantt-studio")
			?.getBoundingClientRect().height;
		dockResizeRef.current = {
			startY: event.clientY,
			startHeight: renderedHeight ?? dockHeight,
		};
	};
	const moveDockResize = (event: ReactPointerEvent) => {
		const state = dockResizeRef.current;
		if (!state) return;
		// Dragging the top edge upward grows the drawer.
		const handle = event.currentTarget as HTMLElement;
		const studio = handle.closest<HTMLElement>(".canvas-editor__gantt-studio");
		const editor = studio?.closest<HTMLElement>(".canvas-editor");
		const containerHeight =
			editor?.clientHeight ??
			(typeof window !== "undefined" ? window.innerHeight : 900);
		const bottomOffset =
			studio && typeof window !== "undefined"
				? Number.parseFloat(window.getComputedStyle(studio).bottom) || 0
				: 0;
		const maxHeight = Math.max(
			0,
			containerHeight - DOCK_TOP_GAP - bottomOffset,
		);
		const minHeight = Math.min(DOCK_MIN_HEIGHT, maxHeight);
		setDockHeight(
			clamp(
				state.startHeight - (event.clientY - state.startY),
				minHeight,
				maxHeight,
			),
		);
	};
	const endDockResize = () => {
		dockResizeRef.current = null;
	};

	const visibleTasks = useMemo(
		() => (draft ? getGanttVisibleTasks(draft) : []),
		[draft],
	);
	const customCategories = useMemo(() => {
		const options = new Map<string, CustomCategoryOption>();
		for (const task of draft?.tasks ?? []) {
			const category = task.category?.trim() || "project";
			if (isGanttBuiltInTaskCategory(category)) continue;
			options.set(category, {
				id: category,
				label:
					task.categoryLabel?.trim() ||
					category.replace(/^custom:/, "").replace(/-/g, " "),
				color: task.color,
			});
		}
		return Array.from(options.values());
	}, [draft]);
	const rowIndexByTaskId = useMemo(() => {
		const map = new Map<string, number>();
		for (const [index, task] of visibleTasks.entries()) {
			map.set(task.id, index);
		}
		return map;
	}, [visibleTasks]);

	const dayWidth = draft?.dayWidth ?? 28;
	const dayCount = draft?.dayCount ?? 28;
	const startDate = draft?.startDate ?? isoToday();
	const calendarRange = useMemo(
		() => (draft ? getGanttCalendarYearRange(draft) : null),
		[draft],
	);
	const previousYearPreview = useMemo(
		() => (draft ? addGanttCalendarYear(draft, "past") : null),
		[draft],
	);
	const nextYearPreview = useMemo(
		() => (draft ? addGanttCalendarYear(draft, "future") : null),
		[draft],
	);
	const removablePastYear = useMemo(
		() => (draft ? removeGanttCalendarYear(draft, "past") : null),
		[draft],
	);
	const removableFutureYear = useMemo(
		() => (draft ? removeGanttCalendarYear(draft, "future") : null),
		[draft],
	);
	const timelineWidth = dayCount * dayWidth;
	const rowsHeight = Math.max(1, visibleTasks.length) * ROW_HEIGHT;
	const todayIso = today ?? isoToday();
	const todayOffset = useMemo(() => {
		try {
			return getGanttDayOffset(startDate, todayIso);
		} catch {
			return -1;
		}
	}, [startDate, todayIso]);

	/* Live drag preview: start/duration overrides per task id. */
	const preview: PreviewMap = useMemo(() => {
		const map: PreviewMap = new Map();
		if (!draft || !barDrag) return map;
		const task = draft.tasks.find((item) => item.id === barDrag.taskId);
		if (!task) return map;
		const delta = barDrag.deltaDays;
		if (barDrag.kind === "move") {
			const startDay = Math.max(0, barDrag.originStart + delta);
			map.set(task.id, { startDay, durationDays: barDrag.originDuration });
			// A group summary drags its children along for the preview.
			if (task.group) {
				const applied = startDay - barDrag.originStart;
				for (const child of draft.tasks) {
					if (child.parentId !== task.id) continue;
					map.set(child.id, {
						startDay: Math.max(0, child.startDay + applied),
						durationDays: child.durationDays,
					});
				}
			}
		} else if (barDrag.kind === "resize-end") {
			map.set(task.id, {
				startDay: barDrag.originStart,
				durationDays: Math.max(1, barDrag.originDuration + delta),
			});
		} else {
			const startDay = clamp(
				barDrag.originStart + delta,
				0,
				barDrag.originStart + barDrag.originDuration - 1,
			);
			map.set(task.id, {
				startDay,
				durationDays: barDrag.originDuration + (barDrag.originStart - startDay),
			});
		}
		return map;
	}, [draft, barDrag]);

	const effectiveTask = useCallback(
		(task: GanttChartTask) => {
			const override = preview.get(task.id);
			return override ? { ...task, ...override } : task;
		},
		[preview],
	);

	/* -------------- Month/week/day header segments -------------- */
	const monthSegments = useMemo(() => {
		const formatter = new Intl.DateTimeFormat(locale, {
			month: "short",
			year: "numeric",
			timeZone: "UTC",
		});
		const segments: Array<{ label: string; start: number; days: number }> = [];
		for (let day = 0; day < dayCount; day++) {
			const iso = addGanttDays(startDate, day);
			const label = formatter.format(new Date(`${iso}T00:00:00.000Z`));
			const last = segments.at(-1);
			if (last && last.label === label) last.days += 1;
			else segments.push({ label, start: day, days: 1 });
		}
		return segments;
	}, [dayCount, locale, startDate]);
	const weekSegments = useMemo(() => {
		const segments: Array<{
			key: string;
			label: string;
			startDate: string;
			endDate: string;
			days: number;
		}> = [];
		const calendarWeekLabel = t("ganttStudio.calendarWeekShort", "CW");
		for (let day = 0; day < dayCount; day++) {
			const calendarWeek = getGanttCalendarWeek(addGanttDays(startDate, day));
			const key = `${calendarWeek.year}-${calendarWeek.week}`;
			const last = segments.at(-1);
			if (last?.key === key) {
				last.days += 1;
			} else {
				segments.push({
					key,
					label: `${calendarWeekLabel} ${calendarWeek.week}`,
					startDate: calendarWeek.startDate,
					endDate: calendarWeek.endDate,
					days: 1,
				});
			}
		}
		return segments;
	}, [dayCount, startDate, t]);

	/* --------------------- Pointer helpers ---------------------- */

	/** Converts a client point into timeline coordinates (day/row space). */
	const toTimelinePoint = useCallback((clientX: number, clientY: number) => {
		const rect = timelineRef.current?.getBoundingClientRect();
		if (!rect) return { x: 0, y: 0 };
		return { x: clientX - rect.left, y: clientY - rect.top };
	}, []);

	/* Bar move / resize ------------------------------------------------ */
	const startBarDrag = (
		event: ReactPointerEvent,
		task: GanttChartTask,
		kind: BarDrag["kind"],
	) => {
		if (event.button !== 0 || !draft) return;
		event.stopPropagation();
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		setSelectedTaskId(task.id);
		setSelectedDependency(null);
		setBarDrag({
			kind,
			taskId: task.id,
			originStart: task.startDay,
			originDuration: task.durationDays,
			pointerStartX: event.clientX,
			deltaDays: 0,
			moved: false,
		});
	};

	const moveBarDrag = (event: ReactPointerEvent) => {
		setBarDrag((current) => {
			if (!current) return current;
			const deltaDays = Math.round(
				(event.clientX - current.pointerStartX) / dayWidth,
			);
			return {
				...current,
				deltaDays,
				moved: current.moved || deltaDays !== 0,
			};
		});
	};

	const finishBarDrag = () => {
		// Commit outside the state updater so StrictMode double-invocation of
		// updaters can never emit the change twice.
		if (barDrag?.moved && barDrag.deltaDays !== 0 && draft) {
			const override = preview.get(barDrag.taskId);
			if (override) {
				commit(updateGanttTask(draft, barDrag.taskId, override));
			}
		}
		setBarDrag(null);
	};

	/* Dependency creation ---------------------------------------------- */
	const startLinkDrag = (event: ReactPointerEvent, task: GanttChartTask) => {
		if (event.button !== 0 || task.group) return;
		event.stopPropagation();
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		const point = toTimelinePoint(event.clientX, event.clientY);
		setLinkDrag({ fromTaskId: task.id, ...point, targetTaskId: null });
	};

	const moveLinkDrag = (event: ReactPointerEvent) => {
		setLinkDrag((current) => {
			if (!current) return current;
			const point = toTimelinePoint(event.clientX, event.clientY);
			const rowIndex = Math.floor(point.y / ROW_HEIGHT);
			const target = visibleTasks[rowIndex];
			const targetTaskId =
				target && !target.group && target.id !== current.fromTaskId
					? target.id
					: null;
			return { ...current, ...point, targetTaskId };
		});
	};

	const finishLinkDrag = () => {
		if (linkDrag?.targetTaskId && draft) {
			commit(
				addGanttDependency(draft, {
					fromTaskId: linkDrag.fromTaskId,
					toTaskId: linkDrag.targetTaskId,
					type: "finish-to-start",
				}),
			);
		}
		setLinkDrag(null);
	};

	/* Row reordering ---------------------------------------------------- */
	const startRowDrag = (event: ReactPointerEvent, task: GanttChartTask) => {
		if (event.button !== 0) return;
		event.stopPropagation();
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		setSelectedTaskId(task.id);
		const index = rowIndexByTaskId.get(task.id) ?? 0;
		setRowDrag({
			taskId: task.id,
			pointerStartY: event.clientY,
			insertionIndex: index,
			moved: false,
		});
	};

	const moveRowDrag = (event: ReactPointerEvent) => {
		setRowDrag((current) => {
			if (!current) return current;
			const rect = rowsRef.current?.getBoundingClientRect();
			if (!rect) return current;
			const insertionIndex = clamp(
				Math.round((event.clientY - rect.top) / ROW_HEIGHT),
				0,
				visibleTasks.length,
			);
			return {
				...current,
				insertionIndex,
				moved:
					current.moved || Math.abs(event.clientY - current.pointerStartY) > 4,
			};
		});
	};

	/**
	 * Resolves the drop target of a row drag into a flat-list index plus the
	 * parent group the task should join (null = top level).
	 */
	const resolveRowDrop = useCallback(
		(drag: RowDrag): { index: number; parentId: string | null } | null => {
			if (!draft) return null;
			const moved = draft.tasks.find((task) => task.id === drag.taskId);
			if (!moved) return null;
			const prev = visibleTasks[drag.insertionIndex - 1];
			const next = visibleTasks[drag.insertionIndex];
			// Inside a group block: adopt the group. At its end boundary the row
			// drops back to top level, which keeps the gesture predictable.
			let parentId: string | null = null;
			if (!moved.group) {
				if (prev?.group && !prev.collapsed && next?.parentId === prev.id) {
					parentId = prev.id;
				} else if (prev?.parentId && next?.parentId === prev.parentId) {
					parentId = prev.parentId;
				}
			}
			// Translate the visible insertion point into the flat task list
			// (minus the moved block, which is what moveGanttTask expects).
			const blockIds = new Set(
				draft.tasks
					.filter(
						(task) =>
							task.id === moved.id ||
							(moved.group && task.parentId === moved.id),
					)
					.map((task) => task.id),
			);
			const rest = draft.tasks.filter((task) => !blockIds.has(task.id));
			const anchorId = next && !blockIds.has(next.id) ? next.id : null;
			const index = anchorId
				? rest.findIndex((task) => task.id === anchorId)
				: rest.length;
			return { index: index < 0 ? rest.length : index, parentId };
		},
		[draft, visibleTasks],
	);

	const finishRowDrag = () => {
		if (rowDrag?.moved && draft) {
			const drop = resolveRowDrop(rowDrag);
			if (drop) {
				commit(moveGanttTask(draft, rowDrag.taskId, drop.index, drop.parentId));
			}
		}
		setRowDrag(null);
	};

	/* ---------------------- Field commits ----------------------- */

	const patchTask = (
		taskId: string,
		changes: Partial<Omit<GanttTaskInput, "id">>,
	) => {
		if (!draft) return;
		commit(updateGanttTask(draft, taskId, changes));
	};

	const commitStartDate = (task: GanttChartTask, isoDate: string) => {
		if (!draft || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return;
		const expanded = ensureGanttCalendarIncludesDate(draft, isoDate);
		const offset = getGanttDayOffset(expanded.startDate, isoDate);
		if (offset < 0 || offset >= expanded.dayCount) return;
		commit(updateGanttTask(expanded, task.id, { startDay: offset }));
	};

	const commitEndDate = (task: GanttChartTask, isoDate: string) => {
		if (!draft || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return;
		const expanded = ensureGanttCalendarIncludesDate(draft, isoDate);
		const expandedTask = expanded.tasks.find((item) => item.id === task.id);
		if (!expandedTask) return;
		const endOffset = getGanttDayOffset(expanded.startDate, isoDate);
		commit(
			updateGanttTask(expanded, task.id, {
				durationDays: Math.max(1, endOffset - expandedTask.startDay + 1),
			}),
		);
	};

	const getCategoryLabel = (
		category: GanttTaskCategory,
		explicitLabel?: string,
	) => {
		if (explicitLabel?.trim()) return explicitLabel.trim();
		if (isGanttBuiltInTaskCategory(category)) {
			return t(
				`ganttStudio.category.${category}`,
				CATEGORY_FALLBACKS[category],
			);
		}
		return category.replace(/^custom:/, "").replace(/-/g, " ");
	};

	const addEntry = (
		kind: "task" | "milestone" | "group",
		category: GanttTaskCategory = "project",
		categoryLabel?: string,
		color?: string,
	) => {
		if (!draft) return;
		const selected = draft.tasks.find((task) => task.id === selectedTaskId);
		// New rows land next to the selection; tasks added on a group join it.
		const parentId =
			kind === "group"
				? undefined
				: selected?.group
					? selected.id
					: selected?.parentId;
		const afterTaskId = selected
			? selected.group && kind !== "group"
				? (draft.tasks.filter((task) => task.parentId === selected.id).at(-1)
						?.id ?? selected.id)
				: selected.id
			: undefined;
		const next = addGanttTask(draft, kind, {
			parentId,
			afterTaskId,
			category,
			categoryLabel,
			color,
			title:
				kind === "milestone"
					? t("ganttStudio.newMilestone", "New milestone")
					: kind === "group"
						? t("ganttStudio.newPhase", "New phase")
						: category === "project"
							? t("ganttStudio.newTask", "New task")
							: getCategoryLabel(category, categoryLabel),
		});
		commit(next);
		setSelectedTaskId(next.tasks.at(-1)?.id ?? null);
	};

	const submitCustomCategory = () => {
		const label = customCategoryName.trim();
		if (!label) return;
		addEntry("task", createCustomCategoryId(label), label, customCategoryColor);
		setCustomCategoryName("");
		setCustomCategoryFormOpen(false);
	};

	const restoreCalendarScroll = useCallback((left: number) => {
		if (typeof requestAnimationFrame !== "function") return;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const body = bodyRef.current;
				if (!body) return;
				body.scrollLeft = left;
			});
		});
	}, []);

	const getStudioScrollLeftForDate = useCallback(
		(document: GanttChartDocument, date: string) => {
			const dateOffset = getGanttDayOffset(document.startDate, date);
			const visibleTimelineWidth = Math.max(
				document.dayWidth * 7,
				(bodyRef.current?.clientWidth ?? TABLE_WIDTH) - TABLE_WIDTH,
			);
			return dateOffset * document.dayWidth - visibleTimelineWidth / 2;
		},
		[],
	);

	const jumpToToday = () => {
		if (!draft) return;
		const next = focusGanttChartOnDate(draft, todayIso);
		commit(next);
		restoreCalendarScroll(getStudioScrollLeftForDate(next, todayIso));
	};

	const studioAutoFocusKeyRef = useRef<string | null>(null);
	useEffect(() => {
		if (!draft) return;
		const key = activeChartId ?? "single-gantt-chart";
		if (studioAutoFocusKeyRef.current === key) return;
		studioAutoFocusKeyRef.current = key;
		const expanded = ensureGanttCalendarIncludesDate(draft, todayIso);
		restoreCalendarScroll(getStudioScrollLeftForDate(expanded, todayIso));
	}, [
		activeChartId,
		draft,
		getStudioScrollLeftForDate,
		restoreCalendarScroll,
		todayIso,
	]);

	const addCalendarYear = (edge: "past" | "future") => {
		if (!draft) return;
		const next = addGanttCalendarYear(draft, edge);
		if (
			next.startDate === draft.startDate &&
			next.dayCount === draft.dayCount
		) {
			return;
		}
		const targetDate =
			edge === "past"
				? next.startDate
				: addGanttDays(draft.startDate, draft.dayCount);
		commit(next);
		restoreCalendarScroll(
			getGanttDayOffset(next.startDate, targetDate) * next.dayWidth,
		);
	};

	const removeCalendarYear = (edge: "past" | "future") => {
		if (!draft) return;
		const next = removeGanttCalendarYear(draft, edge);
		if (!next) return;
		const range = getGanttCalendarYearRange(next);
		const targetDate =
			edge === "past" ? next.startDate : `${range.endYear}-01-01`;
		commit(next);
		restoreCalendarScroll(
			getGanttDayOffset(next.startDate, targetDate) * next.dayWidth,
		);
	};

	const startCalendarPan = (event: ReactPointerEvent) => {
		if (event.button !== 0 || !bodyRef.current) return;
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		calendarPanRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			scrollLeft: bodyRef.current.scrollLeft,
		};
	};

	const moveCalendarPan = (event: ReactPointerEvent) => {
		const pan = calendarPanRef.current;
		if (!pan || pan.pointerId !== event.pointerId || !bodyRef.current) return;
		bodyRef.current.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX);
	};

	const endCalendarPan = (event: ReactPointerEvent) => {
		if (calendarPanRef.current?.pointerId === event.pointerId) {
			calendarPanRef.current = null;
		}
	};

	/* --------------------- Keyboard handling --------------------- */
	const handleKeyDown = (event: React.KeyboardEvent) => {
		const target = event.target as HTMLElement;
		const isFormField =
			target.tagName === "INPUT" || target.tagName === "SELECT";
		if (event.key === "Escape") {
			if (isFormField) {
				(target as HTMLInputElement).blur();
				return;
			}
			if (actionsTaskId) {
				setActionsTaskId(null);
				return;
			}
			if (barDrag || linkDrag || rowDrag) {
				setBarDrag(null);
				setLinkDrag(null);
				setRowDrag(null);
				return;
			}
			if (selectedDependency != null) {
				setSelectedDependency(null);
				return;
			}
			onClose?.();
		}
		if (
			(event.key === "Delete" || event.key === "Backspace") &&
			!isFormField &&
			selectedDependency != null &&
			draft
		) {
			commit(removeGanttDependency(draft, selectedDependency));
			setSelectedDependency(null);
		}
	};

	/* -------------------- Dependency geometry -------------------- */

	/** Uses the same outside route as the generated canvas chart. */
	const dependencyPath = useCallback(
		(
			fromTask: GanttChartTask,
			toTask: GanttChartTask,
			type: GanttDependencyKind = "finish-to-start",
		) => {
			const from = effectiveTask(fromTask);
			const to = effectiveTask(toTask);
			const fromRow = rowIndexByTaskId.get(from.id);
			const toRow = rowIndexByTaskId.get(to.id);
			if (fromRow === undefined || toRow === undefined) return null;
			const taskBox = (task: GanttChartTask, row: number) => {
				const height = task.milestone ? MILESTONE_SIZE : BAR_HEIGHT;
				const width = task.milestone
					? MILESTONE_SIZE
					: Math.max(14, task.durationDays * dayWidth - 6);
				return {
					x: task.milestone
						? (task.startDay + 0.5) * dayWidth - MILESTONE_SIZE / 2
						: task.startDay * dayWidth + 3,
					y: row * ROW_HEIGHT + (ROW_HEIGHT - height) / 2,
					width,
					height,
				};
			};
			const points = buildGanttDependencyRoute(
				taskBox(from, fromRow),
				taskBox(to, toRow),
				type,
			);
			const targetPoint = points.at(-1);
			const beforeTarget = points.at(-2);
			if (!targetPoint || !beforeTarget) return null;
			let toolbarStart = points[0];
			let toolbarEnd = points[1];
			for (let index = 0; index < points.length - 1; index++) {
				const start = points[index];
				const end = points[index + 1];
				if (
					start[1] === end[1] &&
					Math.abs(end[0] - start[0]) >
						Math.abs(toolbarEnd[0] - toolbarStart[0])
				) {
					toolbarStart = start;
					toolbarEnd = end;
				}
			}
			return {
				d: getArrowPath(points, "elbow"),
				midX: (toolbarStart[0] + toolbarEnd[0]) / 2,
				midY: toolbarStart[1],
				targetX: targetPoint[0],
				targetY: targetPoint[1],
				direction: targetPoint[0] >= beforeTarget[0] ? 1 : -1,
			};
		},
		[dayWidth, effectiveTask, rowIndexByTaskId],
	);

	/* ------------------------- Rendering ------------------------- */

	if (!draft) {
		return (
			<section
				className={joinClasses("canvas-editor__gantt-studio", className)}
				style={style}
				aria-label={t("ganttStudio.title", "Project plan")}
			>
				<header className="canvas-editor__gantt-studio-header">
					<CalendarRange className="canvas-editor__panel-title-icon" />
					<h3>{t("ganttStudio.title", "Project plan")}</h3>
					<span className="canvas-editor__gantt-studio-spacer" />
					{onClose && (
						<button
							type="button"
							className="canvas-editor__gantt-studio-icon-button"
							onClick={onClose}
							aria-label={t("common.close", "Close")}
						>
							<X />
						</button>
					)}
				</header>
				<div className="canvas-editor__gantt-studio-empty">
					<CalendarRange />
					<strong>{t("ganttStudio.noChart", "No plan selected")}</strong>
					<p>
						{t(
							"ganttStudio.noChartHint",
							"Select a Gantt chart on the canvas or start a new plan.",
						)}
					</p>
					{onCreate && (
						<button
							type="button"
							className="canvas-editor__gantt-studio-primary"
							onClick={onCreate}
						>
							<Plus />
							{t("ganttStudio.create", "Create plan")}
						</button>
					)}
				</div>
			</section>
		);
	}

	const selectedDependencyPath =
		selectedDependency != null
			? (() => {
					const dependency = draft.dependencies[selectedDependency];
					if (!dependency) return null;
					const from = draft.tasks.find(
						(task) => task.id === dependency.fromTaskId,
					);
					const to = draft.tasks.find(
						(task) => task.id === dependency.toTaskId,
					);
					return from && to
						? dependencyPath(from, to, dependency.type ?? "finish-to-start")
						: null;
				})()
			: null;

	return (
		<section
			className={joinClasses("canvas-editor__gantt-studio", className)}
			style={{ ...style, height: collapsed ? undefined : dockHeight }}
			data-collapsed={collapsed}
			aria-label={t("ganttStudio.title", "Project plan")}
			onKeyDown={handleKeyDown}
		>
			{/* Top edge: drag to resize the dock height. */}
			<button
				type="button"
				className="canvas-editor__gantt-studio-resize"
				aria-label={t("ganttStudio.resize", "Resize panel")}
				onPointerDown={startDockResize}
				onPointerMove={moveDockResize}
				onPointerUp={endDockResize}
				onPointerCancel={endDockResize}
			>
				<GripHorizontal />
			</button>

			{/* ---------------------------- Header ---------------------------- */}
			<header className="canvas-editor__gantt-studio-header">
				<CalendarRange className="canvas-editor__panel-title-icon" />
				{charts.length > 1 && onSelectChart && (
					<select
						className="canvas-editor__gantt-studio-chart-picker"
						value={activeChartId ?? ""}
						aria-label={t("ganttStudio.selectChart", "Select plan")}
						onChange={(event) => onSelectChart(event.target.value)}
					>
						{charts.map((chart) => (
							<option key={chart.id} value={chart.id}>
								{chart.title}
							</option>
						))}
					</select>
				)}
				<input
					className="canvas-editor__gantt-studio-title"
					key={`title-${draft.title}`}
					defaultValue={draft.title}
					aria-label={t("ganttStudio.projectName", "Project name")}
					onBlur={(event) => {
						const value = event.target.value.trim();
						if (value && value !== draft.title) {
							commit({ ...draft, title: value });
						}
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter") event.currentTarget.blur();
					}}
				/>
				<span className="canvas-editor__gantt-studio-spacer" />
				<div className="canvas-editor__gantt-studio-header-field canvas-editor__gantt-studio-calendar-range">
					<span>{t("ganttStudio.calendarRange", "Calendar")}</span>
					<output>
						{calendarRange
							? calendarRange.startYear === calendarRange.endYear
								? calendarRange.startYear
								: `${calendarRange.startYear}\u2013${calendarRange.endYear}`
							: ""}
					</output>
				</div>
				<button
					type="button"
					className="canvas-editor__gantt-studio-today-button"
					onClick={jumpToToday}
					aria-label={t("ganttStudio.jumpToToday", "Jump to today")}
					title={t("ganttStudio.jumpToToday", "Jump to today")}
				>
					<CalendarDays />
					<span>{t("ganttStudio.today", "Today")}</span>
				</button>
				<div className="canvas-editor__gantt-studio-zoom">
					<button
						type="button"
						className="canvas-editor__gantt-studio-icon-button"
						aria-label={t("ganttStudio.zoomOut", "Zoom out")}
						disabled={draft.dayWidth <= 16}
						onClick={() =>
							commit({ ...draft, dayWidth: Math.max(16, draft.dayWidth - 4) })
						}
					>
						<ZoomOut />
					</button>
					<button
						type="button"
						className="canvas-editor__gantt-studio-icon-button"
						aria-label={t("ganttStudio.zoomIn", "Zoom in")}
						disabled={draft.dayWidth >= 64}
						onClick={() =>
							commit({ ...draft, dayWidth: Math.min(64, draft.dayWidth + 4) })
						}
					>
						<ZoomIn />
					</button>
				</div>
				<div className="canvas-editor__gantt-studio-timeline-nav">
					<button
						type="button"
						className="canvas-editor__gantt-studio-icon-button"
						onClick={() => addCalendarYear("past")}
						disabled={
							!previousYearPreview ||
							(previousYearPreview.startDate === draft.startDate &&
								previousYearPreview.dayCount === draft.dayCount)
						}
						aria-label={t("ganttStudio.addPreviousYear", "Add previous year")}
						title={t("ganttStudio.addPreviousYear", "Add previous year")}
					>
						<ChevronLeft />
					</button>
					<button
						type="button"
						className="canvas-editor__gantt-studio-icon-button"
						onClick={() => removeCalendarYear("past")}
						disabled={!removablePastYear}
						aria-label={t(
							"ganttStudio.removePreviousYear",
							"Remove earliest year",
						)}
						title={t("ganttStudio.removePreviousYear", "Remove earliest year")}
					>
						<Minus />
					</button>
					<button
						type="button"
						className="canvas-editor__gantt-studio-icon-button"
						onClick={() => removeCalendarYear("future")}
						disabled={!removableFutureYear}
						aria-label={t("ganttStudio.removeNextYear", "Remove latest year")}
						title={t("ganttStudio.removeNextYear", "Remove latest year")}
					>
						<Minus />
					</button>
					<button
						type="button"
						className="canvas-editor__gantt-studio-icon-button"
						onClick={() => addCalendarYear("future")}
						disabled={
							!nextYearPreview ||
							(nextYearPreview.startDate === draft.startDate &&
								nextYearPreview.dayCount === draft.dayCount)
						}
						aria-label={t("ganttStudio.addNextYear", "Add next year")}
						title={t("ganttStudio.addNextYear", "Add next year")}
					>
						<ChevronRight />
					</button>
				</div>
				<div className="canvas-editor__gantt-studio-add">
					<button type="button" onClick={() => addEntry("task")}>
						<Plus /> {t("ganttStudio.addTask", "Task")}
					</button>
					<button type="button" onClick={() => addEntry("milestone")}>
						<Diamond /> {t("ganttStudio.addMilestone", "Milestone")}
					</button>
					<button type="button" onClick={() => addEntry("group")}>
						<Layers /> {t("ganttStudio.addPhase", "Phase")}
					</button>
					<select
						value=""
						aria-label={t("ganttStudio.addEntry", "Add optional entry")}
						onChange={(event) => {
							const category = event.target.value;
							if (category === CUSTOM_CATEGORY_VALUE) {
								setCustomCategoryFormOpen(true);
								return;
							}
							const custom = customCategories.find(
								(option) => option.id === category,
							);
							if (category) {
								addEntry("task", category, custom?.label, custom?.color);
							}
						}}
					>
						<option value="" disabled>
							{t("ganttStudio.addEntry", "Add optional entry")}
						</option>
						<optgroup label={t("ganttStudio.presets", "Optional presets")}>
							{CATEGORY_PRESETS.filter(
								(category) => category !== "project",
							).map((category) => (
								<option key={category} value={category}>
									{getCategoryLabel(category)}
								</option>
							))}
						</optgroup>
						{customCategories.length > 0 && (
							<optgroup label={t("ganttStudio.customTypes", "Custom types")}>
								{customCategories.map((option) => (
									<option key={option.id} value={option.id}>
										{option.label}
									</option>
								))}
							</optgroup>
						)}
						<option value={CUSTOM_CATEGORY_VALUE}>
							{t("ganttStudio.customType", "Create custom type…")}
						</option>
					</select>
					{customCategoryFormOpen && (
						<form
							className="canvas-editor__gantt-studio-custom-type"
							onSubmit={(event) => {
								event.preventDefault();
								submitCustomCategory();
							}}
						>
							<input
								value={customCategoryName}
								placeholder={t(
									"ganttStudio.customTypePlaceholder",
									"e.g. Training",
								)}
								aria-label={t("ganttStudio.customTypeName", "Custom type name")}
								onChange={(event) => setCustomCategoryName(event.target.value)}
							/>
							<input
								type="color"
								value={customCategoryColor}
								aria-label={t("ganttStudio.color", "Color")}
								onChange={(event) => setCustomCategoryColor(event.target.value)}
							/>
							<button
								type="submit"
								disabled={!customCategoryName.trim()}
								aria-label={t("ganttStudio.addCustomType", "Add custom type")}
							>
								<Plus />
							</button>
							<button
								type="button"
								aria-label={t("common.cancel", "Cancel")}
								onClick={() => {
									setCustomCategoryFormOpen(false);
									setCustomCategoryName("");
								}}
							>
								<X />
							</button>
						</form>
					)}
				</div>
				{onCreate && (
					<button
						type="button"
						className="canvas-editor__gantt-studio-new-chart"
						onClick={onCreate}
						title={t("ganttStudio.newChart", "New plan")}
					>
						<Plus />
						<span>{t("ganttStudio.newChart", "New plan")}</span>
					</button>
				)}
				{onDelete && (
					<button
						type="button"
						className="canvas-editor__gantt-studio-icon-button canvas-editor__gantt-studio-danger"
						onClick={onDelete}
						aria-label={t("ganttStudio.deleteChart", "Delete plan")}
						title={t("ganttStudio.deleteChart", "Delete plan")}
					>
						<Trash2 />
					</button>
				)}
				{/* Collapse the drawer down to its title bar, freeing the canvas. */}
				<button
					type="button"
					className="canvas-editor__gantt-studio-icon-button"
					onClick={() => setCollapsed((value) => !value)}
					aria-label={
						collapsed
							? t("ganttStudio.expand", "Expand")
							: t("ganttStudio.minimize", "Minimize")
					}
					title={
						collapsed
							? t("ganttStudio.expand", "Expand")
							: t("ganttStudio.minimize", "Minimize")
					}
				>
					{collapsed ? <Maximize2 /> : <Minus />}
				</button>
				{onClose && (
					<button
						type="button"
						className="canvas-editor__gantt-studio-icon-button"
						onClick={onClose}
						aria-label={t("common.close", "Close")}
					>
						<X />
					</button>
				)}
			</header>

			{/* ----------------------------- Body ----------------------------- */}
			<div className="canvas-editor__gantt-studio-body" ref={bodyRef}>
				<div
					className="canvas-editor__gantt-studio-grid"
					style={{ width: TABLE_WIDTH + timelineWidth }}
				>
					{/* Sticky column headers + timeline scale. */}
					<div
						className="canvas-editor__gantt-studio-head"
						style={{ height: HEADER_HEIGHT }}
					>
						<div
							className="canvas-editor__gantt-studio-corner"
							style={{ width: TABLE_WIDTH }}
						>
							<span className="canvas-editor__gantt-studio-col-grip" />
							<span className="canvas-editor__gantt-studio-col-name">
								{t("ganttStudio.colTask", "Task")}
							</span>
							<span className="canvas-editor__gantt-studio-col-owner">
								{t("ganttStudio.colOwner", "Owner")}
							</span>
							<span className="canvas-editor__gantt-studio-col-start">
								{t("ganttStudio.colStart", "Start")}
							</span>
							<span className="canvas-editor__gantt-studio-col-end">
								{t("ganttStudio.colEnd", "End")}
							</span>
							<span className="canvas-editor__gantt-studio-col-progress">
								%
							</span>
							<span className="canvas-editor__gantt-studio-col-actions" />
						</div>
						<div
							className="canvas-editor__gantt-studio-scale"
							style={{ width: timelineWidth }}
							onPointerDown={startCalendarPan}
							onPointerMove={moveCalendarPan}
							onPointerUp={endCalendarPan}
							onPointerCancel={endCalendarPan}
						>
							<div className="canvas-editor__gantt-studio-months">
								{monthSegments.map((segment) => (
									<span
										key={`${segment.label}-${segment.start}`}
										style={{ width: segment.days * dayWidth }}
									>
										{segment.days * dayWidth > 56 ? segment.label : ""}
									</span>
								))}
							</div>
							<div className="canvas-editor__gantt-studio-weeks">
								{weekSegments.map((segment) => (
									<span
										key={segment.key}
										style={{ width: segment.days * dayWidth }}
										title={`${segment.label}: ${segment.startDate}\u2013${segment.endDate}`}
									>
										{segment.days * dayWidth > 38 ? segment.label : ""}
									</span>
								))}
							</div>
							<div className="canvas-editor__gantt-studio-days">
								{Array.from({ length: dayCount }, (_, day) => {
									const iso = addGanttDays(startDate, day);
									const weekday = weekdayOf(iso);
									const showLabel = dayWidth >= 20 || weekday === 1;
									return (
										<span
											key={iso}
											title={iso}
											data-weekend={weekday === 0 || weekday === 6}
											data-today={day === todayOffset}
											style={{ width: dayWidth }}
										>
											{showLabel ? Number(iso.slice(8, 10)) : ""}
										</span>
									);
								})}
							</div>
						</div>
					</div>

					{/* Rows: sticky table cells + timeline lanes. */}
					<div
						className="canvas-editor__gantt-studio-rows"
						ref={rowsRef}
						style={{ height: rowsHeight }}
					>
						{/* Decoration underlay: sits below the rows so bars stay on top. */}
						<div
							className="canvas-editor__gantt-studio-underlay"
							style={{ left: TABLE_WIDTH, width: timelineWidth }}
							aria-hidden="true"
						>
							{/* Weekend shading (keyed by ISO date, stable across zooms). */}
							{Array.from({ length: dayCount }, (_, day) => {
								const iso = addGanttDays(startDate, day);
								const weekday = weekdayOf(iso);
								if (weekday !== 0 && weekday !== 6) return null;
								return (
									<span
										key={iso}
										className="canvas-editor__gantt-studio-weekend"
										style={{ left: day * dayWidth, width: dayWidth }}
									/>
								);
							})}
							{/* Day grid lines via a repeating gradient (cheap at any size). */}
							<span
								className="canvas-editor__gantt-studio-gridlines"
								style={{ backgroundSize: `${dayWidth}px 100%` }}
							/>
							{/* Today marker. */}
							{draft.showToday &&
								todayOffset >= 0 &&
								todayOffset < dayCount && (
									<span
										className="canvas-editor__gantt-studio-today"
										style={{ left: (todayOffset + 0.5) * dayWidth }}
									/>
								)}
						</div>
						{visibleTasks.map((task) => {
							const effective = effectiveTask(task);
							const category = task.category ?? "project";
							const categoryDisplayName = getCategoryLabel(
								category,
								task.categoryLabel,
							);
							const barColor =
								task.color ??
								(task.group ? "#475569" : getGanttTaskDefaultColor(task));
							const barLeft = effective.startDay * dayWidth;
							const barWidth = Math.max(
								task.milestone ? MILESTONE_SIZE : 14,
								effective.durationDays * dayWidth - 6,
							);
							const endIso = addGanttDays(
								startDate,
								effective.startDay + Math.max(1, effective.durationDays) - 1,
							);
							const isDropTarget = linkDrag?.targetTaskId === task.id;
							return (
								<div
									key={task.id}
									className="canvas-editor__gantt-studio-row"
									data-selected={selectedTaskId === task.id}
									data-group={task.group}
									data-category={category}
									data-actions-open={actionsTaskId === task.id}
									data-drop-target={isDropTarget}
									data-dragging={rowDrag?.taskId === task.id && rowDrag.moved}
									style={{ height: ROW_HEIGHT }}
									onPointerDown={() => {
										setSelectedTaskId(task.id);
										setSelectedDependency(null);
										if (actionsTaskId !== task.id) setActionsTaskId(null);
									}}
								>
									{/* -------- Table cells (sticky left) -------- */}
									<div
										className="canvas-editor__gantt-studio-cells"
										style={{ width: TABLE_WIDTH }}
									>
										<button
											type="button"
											className="canvas-editor__gantt-studio-grip"
											aria-label={t("ganttStudio.reorder", "Reorder")}
											onPointerDown={(event) => startRowDrag(event, task)}
											onPointerMove={moveRowDrag}
											onPointerUp={finishRowDrag}
											onPointerCancel={() => setRowDrag(null)}
										>
											<GripVertical />
										</button>
										<span
											className="canvas-editor__gantt-studio-col-name"
											data-indent={Boolean(task.parentId)}
										>
											{task.group ? (
												<button
													type="button"
													className="canvas-editor__gantt-studio-collapse"
													aria-label={
														task.collapsed
															? t("ganttStudio.expand", "Expand")
															: t("ganttStudio.collapse", "Collapse")
													}
													onClick={() =>
														commit(toggleGanttGroupCollapsed(draft, task.id))
													}
												>
													{task.collapsed ? <ChevronRight /> : <ChevronDown />}
												</button>
											) : task.milestone ? (
												<Diamond
													className="canvas-editor__gantt-studio-kind-icon"
													style={{ color: barColor }}
												/>
											) : category !== "project" ? (
												<span
													className="canvas-editor__gantt-studio-category-badge"
													style={{ background: barColor }}
													title={categoryDisplayName}
												>
													{isGanttBuiltInTaskCategory(category)
														? CATEGORY_SHORT_LABELS[category]
														: categoryShortLabel(categoryDisplayName)}
												</span>
											) : null}
											<input
												key={`name-${task.id}-${task.title}`}
												defaultValue={task.title}
												aria-label={t("ganttStudio.colTask", "Task")}
												onBlur={(event) => {
													const value = event.target.value.trim();
													if (value && value !== task.title) {
														patchTask(task.id, { title: value });
													}
												}}
												onKeyDown={(event) => {
													if (event.key === "Enter") event.currentTarget.blur();
												}}
											/>
										</span>
										<span className="canvas-editor__gantt-studio-col-owner">
											<input
												key={`owner-${task.id}-${task.owner ?? ""}`}
												defaultValue={task.owner ?? ""}
												placeholder="–"
												aria-label={t("ganttStudio.colOwner", "Owner")}
												onBlur={(event) => {
													const value = event.target.value.trim();
													if (value !== (task.owner ?? "")) {
														patchTask(task.id, { owner: value || undefined });
													}
												}}
												onKeyDown={(event) => {
													if (event.key === "Enter") event.currentTarget.blur();
												}}
											/>
										</span>
										<span className="canvas-editor__gantt-studio-col-start">
											<input
												type="date"
												value={addGanttDays(startDate, task.startDay)}
												aria-label={t("ganttStudio.colStart", "Start")}
												onChange={(event) =>
													commitStartDate(task, event.target.value)
												}
											/>
										</span>
										<span className="canvas-editor__gantt-studio-col-end">
											<input
												type="date"
												value={addGanttDays(
													startDate,
													task.startDay + Math.max(1, task.durationDays) - 1,
												)}
												min={addGanttDays(startDate, task.startDay)}
												disabled={task.group || task.milestone}
												aria-label={t("ganttStudio.colEnd", "End")}
												onChange={(event) =>
													commitEndDate(task, event.target.value)
												}
											/>
										</span>
										<span className="canvas-editor__gantt-studio-col-progress">
											<input
												key={`progress-${task.id}-${task.progress}`}
												type="number"
												min={0}
												max={100}
												defaultValue={task.progress}
												disabled={task.group}
												aria-label={t("ganttStudio.progress", "Progress")}
												onBlur={(event) => {
													const value = clamp(
														Math.round(Number(event.target.value)),
														0,
														100,
													);
													if (
														Number.isFinite(value) &&
														value !== task.progress
													) {
														patchTask(task.id, { progress: value });
													}
												}}
												onKeyDown={(event) => {
													if (event.key === "Enter") event.currentTarget.blur();
												}}
											/>
										</span>
										<span className="canvas-editor__gantt-studio-col-actions">
											<button
												type="button"
												className="canvas-editor__gantt-studio-more"
												aria-label={t(
													"ganttStudio.moreOptions",
													"More row options",
												)}
												aria-expanded={actionsTaskId === task.id}
												aria-controls={`gantt-actions-${task.id}`}
												onPointerDown={(event) => event.stopPropagation()}
												onClick={() =>
													setActionsTaskId((current) =>
														current === task.id ? null : task.id,
													)
												}
											>
												<MoreHorizontal />
											</button>
										</span>
										{/* Explicit row actions never cover date fields on hover. */}
										{actionsTaskId === task.id && (
											<span
												id={`gantt-actions-${task.id}`}
												className="canvas-editor__gantt-studio-row-actions"
												data-open="true"
											>
												{!task.group && (
													<select
														value={category}
														aria-label={t(
															"ganttStudio.categoryLabel",
															"Entry type",
														)}
														onChange={(event) => {
															const nextCategory = event.target.value;
															const custom = customCategories.find(
																(option) => option.id === nextCategory,
															);
															patchTask(task.id, {
																category: nextCategory,
																categoryLabel: custom?.label,
																color: custom?.color,
															});
														}}
													>
														{CATEGORY_PRESETS.map((preset) => (
															<option key={preset} value={preset}>
																{getCategoryLabel(preset)}
															</option>
														))}
														{customCategories.map((option) => (
															<option key={option.id} value={option.id}>
																{option.label}
															</option>
														))}
													</select>
												)}
												{!task.group &&
													!isGanttBuiltInTaskCategory(category) && (
														<input
															className="canvas-editor__gantt-studio-custom-type-name"
															key={`category-label-${task.id}-${categoryDisplayName}`}
															defaultValue={categoryDisplayName}
															aria-label={t(
																"ganttStudio.customTypeName",
																"Custom type name",
															)}
															onBlur={(event) => {
																const value = event.target.value.trim();
																if (value && value !== categoryDisplayName) {
																	patchTask(task.id, { categoryLabel: value });
																}
															}}
															onKeyDown={(event) => {
																if (event.key === "Enter")
																	event.currentTarget.blur();
															}}
														/>
													)}
												{!task.group && (
													<select
														value={task.status}
														aria-label={t("ganttStudio.status", "Status")}
														onChange={(event) =>
															patchTask(task.id, {
																status: event.target.value as GanttTaskStatus,
															})
														}
													>
														{STATUS_OPTIONS.map((status) => (
															<option key={status} value={status}>
																{t(
																	`ganttStudio.status.${status}`,
																	STATUS_FALLBACKS[status],
																)}
															</option>
														))}
													</select>
												)}
												<input
													type="color"
													value={task.color ?? barColor}
													aria-label={t("ganttStudio.color", "Color")}
													onChange={(event) =>
														patchTask(task.id, { color: event.target.value })
													}
												/>
												{!task.group && !task.milestone && (
													<button
														type="button"
														data-active={task.critical}
														aria-label={t(
															"ganttStudio.critical",
															"Critical path",
														)}
														title={t("ganttStudio.critical", "Critical path")}
														onClick={() =>
															patchTask(task.id, { critical: !task.critical })
														}
													>
														<Flame />
													</button>
												)}
												<button
													type="button"
													className="canvas-editor__gantt-studio-danger"
													aria-label={t("ganttStudio.deleteTask", "Delete")}
													title={t("ganttStudio.deleteTask", "Delete")}
													onClick={() => {
														commit(removeGanttTask(draft, task.id));
														if (selectedTaskId === task.id) {
															setSelectedTaskId(null);
														}
														setActionsTaskId(null);
													}}
												>
													<Trash2 />
												</button>
											</span>
										)}
									</div>

									{/* ---------------- Timeline lane ---------------- */}
									<div
										className="canvas-editor__gantt-studio-lane"
										style={{ width: timelineWidth }}
									>
										{task.milestone ? (
											<button
												type="button"
												className="canvas-editor__gantt-studio-milestone"
												style={{
													left:
														(effective.startDay + 0.5) * dayWidth -
														MILESTONE_SIZE / 2,
													background: barColor,
												}}
												title={`${task.title} · ${addGanttDays(startDate, effective.startDay)}`}
												aria-label={task.title}
												onPointerDown={(event) =>
													startBarDrag(event, task, "move")
												}
												onPointerMove={moveBarDrag}
												onPointerUp={finishBarDrag}
												onPointerCancel={() => setBarDrag(null)}
											/>
										) : (
											<div
												className={joinClasses(
													"canvas-editor__gantt-studio-bar",
													task.group &&
														"canvas-editor__gantt-studio-bar--group",
													task.critical &&
														"canvas-editor__gantt-studio-bar--critical",
												)}
												style={{
													left: barLeft + 3,
													width: barWidth,
													height: task.group ? 12 : BAR_HEIGHT,
													background: barColor,
												}}
												title={`${task.title} · ${addGanttDays(startDate, effective.startDay)} – ${endIso}`}
												onPointerDown={(event) =>
													startBarDrag(event, task, "move")
												}
												onPointerMove={moveBarDrag}
												onPointerUp={finishBarDrag}
												onPointerCancel={() => setBarDrag(null)}
											>
												{!task.group && (
													<span
														className="canvas-editor__gantt-studio-bar-progress"
														style={{ width: `${task.progress}%` }}
													/>
												)}
												{!task.group && (
													<>
														{/* Resize handles snap to whole days. */}
														<span
															className="canvas-editor__gantt-studio-bar-handle"
															data-edge="start"
															onPointerDown={(event) =>
																startBarDrag(event, task, "resize-start")
															}
															onPointerMove={moveBarDrag}
															onPointerUp={finishBarDrag}
															onPointerCancel={() => setBarDrag(null)}
														/>
														<span
															className="canvas-editor__gantt-studio-bar-handle"
															data-edge="end"
															onPointerDown={(event) =>
																startBarDrag(event, task, "resize-end")
															}
															onPointerMove={moveBarDrag}
															onPointerUp={finishBarDrag}
															onPointerCancel={() => setBarDrag(null)}
														/>
													</>
												)}
											</div>
										)}
										{/* Bar label sits right of narrow bars for readability. */}
										{!task.group && barWidth < 90 && (
											<span
												className="canvas-editor__gantt-studio-bar-label"
												style={{
													left:
														(task.milestone
															? (effective.startDay + 0.5) * dayWidth +
																MILESTONE_SIZE
															: barLeft + barWidth) + 10,
												}}
											>
												{task.title}
											</span>
										)}
										{!task.group && barWidth >= 90 && !task.milestone && (
											<span
												className="canvas-editor__gantt-studio-bar-text"
												style={{ left: barLeft + 12, maxWidth: barWidth - 20 }}
											>
												{task.title}
											</span>
										)}
										{/* Link handle: drag onto another row for a dependency. */}
										{!task.group && (
											<button
												type="button"
												className="canvas-editor__gantt-studio-link-handle"
												aria-label={t(
													"ganttStudio.linkFrom",
													"Create dependency",
												)}
												title={t("ganttStudio.linkFrom", "Create dependency")}
												style={{
													left: task.milestone
														? (effective.startDay + 0.5) * dayWidth +
															MILESTONE_SIZE / 2 +
															2
														: barLeft + barWidth + 5,
												}}
												onPointerDown={(event) => startLinkDrag(event, task)}
												onPointerMove={moveLinkDrag}
												onPointerUp={finishLinkDrag}
												onPointerCancel={() => setLinkDrag(null)}
											/>
										)}
									</div>
								</div>
							);
						})}

						{/* Reorder insertion indicator. */}
						{rowDrag?.moved && (
							<div
								className="canvas-editor__gantt-studio-drop-line"
								style={{ top: rowDrag.insertionIndex * ROW_HEIGHT - 1 }}
							/>
						)}

						{/* Dependency arrows + link toolbar overlay (above the bars). */}
						<div
							className="canvas-editor__gantt-studio-overlay"
							ref={timelineRef}
							style={{ left: TABLE_WIDTH, width: timelineWidth }}
						>
							{/* Dependency arrows. */}
							<svg
								className="canvas-editor__gantt-studio-links"
								width={timelineWidth}
								height={rowsHeight}
								aria-hidden="true"
							>
								{draft.dependencies.map((dependency, index) => {
									const from = draft.tasks.find(
										(task) => task.id === dependency.fromTaskId,
									);
									const to = draft.tasks.find(
										(task) => task.id === dependency.toTaskId,
									);
									if (!from || !to) return null;
									const path = dependencyPath(
										from,
										to,
										dependency.type ?? "finish-to-start",
									);
									if (!path) return null;
									return (
										// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard deletion works via Delete on the studio.
										<g
											key={`${dependency.fromTaskId}-${dependency.toTaskId}-${index}`}
											data-selected={selectedDependency === index}
											className="canvas-editor__gantt-studio-link"
											onClick={(event) => {
												event.stopPropagation();
												setSelectedDependency(index);
												setSelectedTaskId(null);
											}}
										>
											{/* Wide invisible stroke keeps the click target usable. */}
											<path className="hit" d={path.d} />
											<path className="line" d={path.d} />
											<path
												className="head"
												d={`M ${path.targetX} ${path.targetY} l ${-6 * path.direction} -4 v 8 z`}
											/>
										</g>
									);
								})}
								{/* Live preview while a dependency is being dragged. */}
								{linkDrag &&
									(() => {
										const from = draft.tasks.find(
											(task) => task.id === linkDrag.fromTaskId,
										);
										const fromRow = from
											? rowIndexByTaskId.get(from.id)
											: undefined;
										if (!from || fromRow === undefined) return null;
										const sourceX =
											(from.startDay + from.durationDays) * dayWidth;
										const sourceY = fromRow * ROW_HEIGHT + ROW_HEIGHT / 2;
										return (
											<path
												className="canvas-editor__gantt-studio-link-preview"
												d={`M ${sourceX} ${sourceY} L ${linkDrag.x} ${linkDrag.y}`}
											/>
										);
									})()}
							</svg>

							{/* Dependency mini-toolbar (retype / delete). */}
							{selectedDependency != null && selectedDependencyPath && (
								<div
									className="canvas-editor__gantt-studio-link-toolbar"
									style={{
										left: clamp(
											selectedDependencyPath.midX,
											90,
											timelineWidth - 90,
										),
										top: clamp(
											selectedDependencyPath.midY - 40,
											4,
											rowsHeight - 36,
										),
									}}
								>
									<select
										value={
											draft.dependencies[selectedDependency]?.type ??
											"finish-to-start"
										}
										aria-label={t("ganttStudio.linkType", "Dependency type")}
										onChange={(event) => {
											const dependency = draft.dependencies[selectedDependency];
											if (!dependency) return;
											commit({
												...draft,
												dependencies: draft.dependencies.map((item, index) =>
													index === selectedDependency
														? {
																...item,
																type: event.target.value as GanttDependencyKind,
															}
														: item,
												),
											});
										}}
									>
										{DEPENDENCY_OPTIONS.map((type) => (
											<option key={type} value={type}>
												{t(
													`ganttStudio.dependency.${type}`,
													DEPENDENCY_FALLBACKS[type],
												)}
											</option>
										))}
									</select>
									<button
										type="button"
										className="canvas-editor__gantt-studio-danger"
										aria-label={t("ganttStudio.removeLink", "Remove")}
										onClick={() => {
											commit(removeGanttDependency(draft, selectedDependency));
											setSelectedDependency(null);
										}}
									>
										<Trash2 />
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Footer hint bar. */}
			<footer className="canvas-editor__gantt-studio-footer">
				<span>
					{t(
						"ganttStudio.hint",
						"Drag bars to reschedule · drag the dot to link tasks · click any cell to edit",
					)}
				</span>
				<span>
					{visibleTasks.length} {t("ganttStudio.taskCount", "rows")} ·{" "}
					{dayCount} {t("ganttStudio.days", "days")}
				</span>
			</footer>
		</section>
	);
}
