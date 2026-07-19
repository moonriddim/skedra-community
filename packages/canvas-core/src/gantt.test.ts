import assert from "node:assert/strict";
import { test } from "node:test";
import {
	applyCanvasMutationPlan,
	planCanvasDeletion,
	planCanvasNormalization,
} from "./editor-operations";
import {
	GANTT_CANVAS_DEFAULT_VISIBLE_DAYS,
	GANTT_CANVAS_MAX_VISIBLE_DAYS,
	GANTT_CANVAS_SCROLLBAR_HEIGHT,
	GANTT_CATEGORY_COLORS,
	GANTT_DEFAULT_DAY_COUNT,
	addGanttCalendarYear,
	addGanttDays,
	addGanttDependency,
	addGanttTask,
	alignGanttChartToCalendarYears,
	buildGanttChartMutationPlan,
	buildGanttDependencyChanges,
	buildGanttDependencySyncUpdates,
	createDefaultGanttChartDocument,
	createGanttChartElements,
	extendGanttChartCalendar,
	findGanttChartElement,
	focusGanttChartOnDate,
	getDefaultGanttStartDate,
	getGanttCalendarWeek,
	getGanttCalendarYearRange,
	getGanttCanvasScrollbarMetrics,
	getGanttCanvasScrollbarThumbMeta,
	getGanttChartDocument,
	getGanttChartId,
	getGanttChartMeta,
	getGanttChartRepairDocument,
	getGanttChartSummaries,
	getGanttDayOffset,
	getGanttDependencyMeta,
	getGanttTaskMeta,
	getGanttVisibleTasks,
	moveGanttTask,
	planGanttChartEdit,
	removeGanttCalendarYear,
	removeGanttTask,
	resizeGanttChartCanvasFromEdge,
	resizeGanttChartDocument,
	scrollGanttChartCanvas,
	toggleGanttGroupCollapsed,
	updateGanttTask,
} from "./gantt";

function defaults() {
	let index = 0;
	return {
		createId: () => `gantt-${index++}`,
		stroke: "#111",
		fontFamily: "Inter",
	};
}

test("uses a complete calendar year as the default timeline", () => {
	assert.equal(
		getDefaultGanttStartDate(new Date("2026-07-17T12:00:00.000Z")),
		"2026-01-01",
	);
	assert.equal(
		getDefaultGanttStartDate(new Date("2028-02-29T12:00:00.000Z")),
		"2028-01-01",
	);
});

test("places a new default project around today and opens that date", () => {
	const document = createDefaultGanttChartDocument({
		anchorDefaultTasksToToday: true,
		startDate: "2026-01-01",
		today: "2026-07-19",
		canvasViewportDayCount: 42,
	});
	const todayOffset = getGanttDayOffset(document.startDate, "2026-07-19");
	assert.equal(document.tasks[0]?.startDay, todayOffset - 12);
	assert.equal(document.tasks[2]?.startDay, todayOffset - 2);
	assert.equal(
		document.canvasViewportStartDay,
		todayOffset - Math.floor((document.canvasViewportDayCount ?? 42) / 2),
	);
});

test("aligns rolling calendars to years and adds or removes empty years", () => {
	const rolling = getGanttChartDocument(
		createGanttChartElements(defaults(), {
			x: 0,
			y: 0,
			startDate: "2026-07-13",
			canvasViewportDayCount: 42,
			tasks: [{ id: "fixed", title: "Fixed", startDay: 3, durationDays: 4 }],
		}),
	);
	assert.ok(rolling);
	const absoluteTaskDate = addGanttDays(
		rolling.startDate,
		rolling.tasks[0]?.startDay ?? 0,
	);
	const aligned = alignGanttChartToCalendarYears(rolling);
	assert.deepEqual(getGanttCalendarYearRange(aligned), {
		startYear: 2026,
		endYear: 2026,
		startDate: "2026-01-01",
		endDate: "2026-12-31",
	});
	assert.equal(aligned.dayCount, 365);
	assert.equal(aligned.canvasViewportStartDay, 0);
	assert.equal(
		addGanttDays(aligned.startDate, aligned.tasks[0]?.startDay ?? 0),
		absoluteTaskDate,
	);

	const withPrevious = addGanttCalendarYear(aligned, "past");
	assert.deepEqual(getGanttCalendarYearRange(withPrevious), {
		startYear: 2025,
		endYear: 2026,
		startDate: "2025-01-01",
		endDate: "2026-12-31",
	});
	assert.equal(withPrevious.dayCount, 730);
	assert.equal(
		addGanttDays(withPrevious.startDate, withPrevious.tasks[0]?.startDay ?? 0),
		absoluteTaskDate,
	);
	assert.deepEqual(removeGanttCalendarYear(withPrevious, "past"), aligned);

	const withNext = addGanttCalendarYear(aligned, "future");
	assert.deepEqual(getGanttCalendarYearRange(withNext), {
		startYear: 2026,
		endYear: 2027,
		startDate: "2026-01-01",
		endDate: "2027-12-31",
	});
	assert.deepEqual(removeGanttCalendarYear(withNext, "future"), aligned);
	assert.equal(removeGanttCalendarYear(aligned, "past"), null);
	assert.equal(removeGanttCalendarYear(aligned, "future"), null);
});

test("calendar-year alignment includes leap day", () => {
	const document = getGanttChartDocument(
		createGanttChartElements(defaults(), {
			x: 0,
			y: 0,
			startDate: "2028-07-01",
			tasks: [{ id: "leap", title: "Leap", startDay: 0, durationDays: 1 }],
		}),
	);
	assert.ok(document);
	const aligned = alignGanttChartToCalendarYears(document);
	assert.equal(aligned.startDate, "2028-01-01");
	assert.equal(aligned.dayCount, 366);
	assert.equal(getGanttCalendarYearRange(aligned).endDate, "2028-12-31");
});

test("creates a structured Gantt chart with tasks and dependencies", () => {
	const elements = createGanttChartElements(defaults(), {
		x: 100,
		y: 200,
		startDate: "2026-07-13",
	});
	const chart = elements.find((element) => getGanttChartMeta(element));
	const tasks = elements.filter((element) => getGanttTaskMeta(element));
	const dependencies = elements.filter((element) =>
		getGanttDependencyMeta(element),
	);

	assert.ok(chart);
	assert.equal(getGanttChartMeta(chart)?.startDate, "2026-07-13");
	assert.equal(tasks.length, 5);
	assert.equal(dependencies.length, 2);
	assert.ok(
		elements.every(
			(element) => element === chart || element.frameId === chart.id,
		),
	);
	assert.deepEqual(
		tasks.map((element) => getGanttTaskMeta(element)?.ganttTaskId),
		["discovery", "design", "implementation", "quality", "launch"],
	);
});

test("team availability categories keep their semantics and colors", () => {
	const elements = createGanttChartElements(defaults(), {
		x: 0,
		y: 0,
		startDate: "2026-07-13",
		tasks: [
			{
				id: "lea-home-office",
				title: "Home office",
				owner: "Lea",
				category: "home-office",
				startDay: 2,
				durationDays: 1,
			},
			{
				id: "noah-vacation",
				title: "Vacation",
				owner: "Noah",
				category: "vacation",
				startDay: 5,
				durationDays: 5,
			},
			{
				id: "team-training",
				title: "Safety training",
				category: "custom:training",
				categoryLabel: "Training",
				color: "#0F766E",
				startDay: 12,
				durationDays: 1,
			},
		],
	});
	const homeOffice = elements.find(
		(element) => getGanttTaskMeta(element)?.ganttTaskId === "lea-home-office",
	);
	assert.ok(homeOffice);
	assert.equal(getGanttTaskMeta(homeOffice)?.category, "home-office");
	assert.equal(homeOffice.fill, GANTT_CATEGORY_COLORS["home-office"]);

	const document = getGanttChartDocument(elements);
	assert.equal(
		document?.tasks.find((task) => task.id === "noah-vacation")?.category,
		"vacation",
	);
	assert.equal(
		document?.tasks.find((task) => task.id === "noah-vacation")?.owner,
		"Noah",
	);
	assert.equal(
		document?.tasks.find((task) => task.id === "team-training")?.categoryLabel,
		"Training",
	);
	assert.ok(document);
	const withAbsence = addGanttTask(document, "task", {
		category: "absence",
		title: "Absence",
	});
	assert.equal(withAbsence.tasks.at(-1)?.category, "absence");
	assert.equal(withAbsence.tasks.at(-1)?.durationDays, 1);
	const withCustomType = addGanttTask(withAbsence, "task", {
		category: "custom:school",
		categoryLabel: "School",
		color: "#0369A1",
		title: "School",
	});
	assert.equal(withCustomType.tasks.at(-1)?.categoryLabel, "School");
	assert.equal(withCustomType.tasks.at(-1)?.color, "#0369A1");
});

test("extends the calendar into past and future without moving task dates", () => {
	const document = getGanttChartDocument(
		createGanttChartElements(defaults(), {
			x: 0,
			y: 0,
			startDate: "2026-07-13",
			canvasViewportDayCount: 28,
			tasks: [{ id: "task", title: "Task", startDay: 3, durationDays: 4 }],
		}),
	);
	assert.ok(document);
	const taskDate = addGanttDays(
		document.startDate,
		document.tasks[0]?.startDay ?? 0,
	);
	const past = extendGanttChartCalendar(document, "past", 14);
	assert.equal(past.startDate, "2026-06-29");
	assert.equal(
		addGanttDays(past.startDate, past.tasks[0]?.startDay ?? 0),
		taskDate,
	);
	assert.equal(past.dayCount, document.dayCount + 14);
	assert.equal(
		past.canvasViewportStartDay,
		(document.canvasViewportStartDay ?? 0) + 14,
	);
	const beforeElements = createGanttChartElements(defaults(), {
		x: 100,
		y: 50,
		...document,
		today: "2026-07-17",
	});
	const leftResize = resizeGanttChartCanvasFromEdge(
		document,
		{ width: document.labelWidth + 35 * document.dayWidth },
		"start",
	);
	const leftResizeElements = createGanttChartElements(defaults(), {
		x: 100 + leftResize.frameOffsetX,
		y: 50,
		...leftResize.document,
		today: "2026-07-17",
	});
	assert.equal(leftResize.frameOffsetX, -7 * document.dayWidth);
	assert.equal(
		leftResizeElements.find((element) => getGanttTaskMeta(element))?.x,
		beforeElements.find((element) => getGanttTaskMeta(element))?.x,
	);
	assert.equal(
		leftResizeElements.find(
			(element) => element.customData?.ganttRole === "today-line",
		)?.x,
		beforeElements.find(
			(element) => element.customData?.ganttRole === "today-line",
		)?.x,
	);
	const afterElements = createGanttChartElements(defaults(), {
		x: 100,
		y: 50,
		...past,
		today: "2026-07-17",
	});
	assert.equal(
		afterElements.find((element) => getGanttTaskMeta(element))?.x,
		beforeElements.find((element) => getGanttTaskMeta(element))?.x,
	);
	assert.equal(
		afterElements.find(
			(element) => element.customData?.ganttRole === "today-line",
		)?.x,
		beforeElements.find(
			(element) => element.customData?.ganttRole === "today-line",
		)?.x,
	);
	const future = extendGanttChartCalendar(past, "future", 14);
	assert.equal(future.startDate, past.startDate);
	assert.equal(future.dayCount, past.dayCount + 14);
});

test("resizing a Gantt frame adds complete columns and scales task rows", () => {
	const document = getGanttChartDocument(
		createGanttChartElements(defaults(), {
			x: 0,
			y: 0,
			startDate: "2026-07-13",
		}),
	);
	assert.ok(document);

	const resized = resizeGanttChartDocument(document, {
		width: document.labelWidth + 35 * document.dayWidth + 9,
		height:
			document.headerHeight +
			document.tasks.length * 72 +
			GANTT_CANVAS_SCROLLBAR_HEIGHT,
	});
	assert.equal(resized.dayCount, GANTT_DEFAULT_DAY_COUNT);
	assert.equal(resized.canvasViewportDayCount, 35);
	assert.equal(resized.rowHeight, 72);
	assert.deepEqual(
		resized.tasks.map(({ startDay, durationDays }) => ({
			startDay,
			durationDays,
		})),
		document.tasks.map(({ startDay, durationDays }) => ({
			startDay,
			durationDays,
		})),
	);
});

test("resizing changes the compact viewport without compressing the calendar", () => {
	const document = getGanttChartDocument(
		createGanttChartElements(defaults(), {
			x: 0,
			y: 0,
			startDate: "2026-07-13",
			tasks: [{ id: "a", title: "A", startDay: 0, durationDays: 6 }],
		}),
	);
	assert.ok(document);
	// Narrow the canvas window while keeping the complete year available.
	const enlarged = resizeGanttChartDocument(document, {
		width: document.labelWidth + 40 * document.dayWidth,
	});
	assert.equal(enlarged.dayCount, GANTT_DEFAULT_DAY_COUNT);
	assert.equal(enlarged.canvasViewportDayCount, 40);
	// Shrinking keeps the complete calendar and narrows only its canvas window.
	const trimmed = resizeGanttChartDocument(enlarged, {
		width: enlarged.labelWidth + 12 * enlarged.dayWidth,
	});
	assert.equal(trimmed.dayCount, GANTT_DEFAULT_DAY_COUNT);
	assert.equal(trimmed.canvasViewportDayCount, 12);
	assert.equal(trimmed.dayWidth, enlarged.dayWidth);
	// The narrowest canvas window is one week; the day scale stays unchanged.
	const compressed = resizeGanttChartDocument(trimmed, {
		width: trimmed.labelWidth + 4 * trimmed.dayWidth,
	});
	assert.equal(compressed.dayCount, GANTT_DEFAULT_DAY_COUNT);
	assert.equal(compressed.canvasViewportDayCount, 7);
	assert.equal(compressed.dayWidth, trimmed.dayWidth);
	// Widening is capped at twelve calendar weeks.
	const twelveWeeks = resizeGanttChartDocument(document, {
		width: document.labelWidth + 84 * document.dayWidth,
	});
	assert.equal(twelveWeeks.canvasViewportDayCount, 84);
	const widerThanAllowed = resizeGanttChartDocument(twelveWeeks, {
		width: document.labelWidth + 100 * document.dayWidth,
	});
	assert.equal(
		widerThanAllowed.canvasViewportDayCount,
		GANTT_CANVAS_MAX_VISIBLE_DAYS,
	);
});

test("long canvas calendars keep a fixed width and render a draggable scrollbar", () => {
	const elements = createGanttChartElements(defaults(), {
		x: 10,
		y: 20,
		startDate: "2026-01-01",
		dayCount: 180,
		tasks: [{ id: "later", title: "Later", startDay: 70, durationDays: 5 }],
	});
	const frame = elements.find((element) => getGanttChartMeta(element));
	assert.ok(frame);
	const document = getGanttChartDocument(elements, frame);
	assert.ok(document);
	assert.equal(
		document.canvasViewportDayCount,
		GANTT_CANVAS_DEFAULT_VISIBLE_DAYS,
	);
	assert.equal(
		frame.width,
		document.labelWidth + GANTT_CANVAS_DEFAULT_VISIBLE_DAYS * document.dayWidth,
	);
	assert.ok(
		elements.some((element) => getGanttCanvasScrollbarThumbMeta(element)),
	);
	const scrollbarThumb = elements.find((element) =>
		getGanttCanvasScrollbarThumbMeta(element),
	);
	assert.ok(scrollbarThumb);
	assert.equal(getGanttChartId(scrollbarThumb), frame.id);
	assert.equal(findGanttChartElement(elements, scrollbarThumb)?.id, frame.id);
	assert.ok(getGanttCanvasScrollbarMetrics(document));
	const scrolled = scrollGanttChartCanvas(document, 65);
	assert.equal(scrolled.canvasViewportStartDay, 65);
	const visibleElements = createGanttChartElements(defaults(), {
		x: frame.x,
		y: frame.y,
		...scrolled,
	});
	const bar = visibleElements.find(
		(element) => getGanttTaskMeta(element)?.ganttTaskId === "later",
	);
	assert.ok(bar);
	assert.equal(
		bar.x,
		frame.x + scrolled.labelWidth + 5 * scrolled.dayWidth + 4,
	);
});

test("detects a missing persisted Gantt scrollbar after reload", () => {
	const elements = createGanttChartElements(defaults(), {
		x: 10,
		y: 20,
		startDate: "2026-01-01",
		canvasViewportDayCount: 42,
	});
	const frame = elements.find((element) => getGanttChartMeta(element));
	assert.ok(frame);
	assert.equal(getGanttChartRepairDocument(elements, frame), null);
	const persistedWithoutScrollbar = elements.filter(
		(element) =>
			!String(element.customData?.ganttRole ?? "").startsWith("canvas-scroll"),
	);
	const repair = getGanttChartRepairDocument(persistedWithoutScrollbar, frame);
	assert.ok(repair);
	assert.equal(repair.startDate, "2026-01-01");
	assert.equal(repair.dayCount, 365);
});

test("centers the canvas viewport on today without changing task dates", () => {
	const document = getGanttChartDocument(
		createGanttChartElements(defaults(), {
			x: 0,
			y: 0,
			startDate: "2026-01-01",
			canvasViewportDayCount: 42,
			tasks: [{ id: "fixed", title: "Fixed", startDay: 10, durationDays: 3 }],
		}),
	);
	assert.ok(document);
	const taskDate = addGanttDays(
		document.startDate,
		document.tasks[0]?.startDay ?? 0,
	);
	const focused = focusGanttChartOnDate(document, "2026-07-17");
	assert.equal(
		getGanttDayOffset(focused.startDate, "2026-07-17") -
			(focused.canvasViewportStartDay ?? 0),
		21,
	);
	assert.equal(
		addGanttDays(focused.startDate, focused.tasks[0]?.startDay ?? 0),
		taskDate,
	);
});

test("recovers a resized viewport from the persisted frame width", () => {
	const elements = createGanttChartElements(defaults(), {
		x: 0,
		y: 0,
		startDate: "2026-01-01",
		canvasViewportDayCount: 84,
	});
	const frame = elements.find((element) => getGanttChartMeta(element));
	assert.ok(frame);
	const {
		canvasViewportDayCount: _viewportDayCount,
		canvasViewportStartDay: _viewportStartDay,
		...legacyCustomData
	} = frame.customData ?? {};
	const legacyFrame = { ...frame, customData: legacyCustomData };
	const persisted = elements.map((element) =>
		element.id === frame.id ? legacyFrame : element,
	);
	const restored = getGanttChartDocument(persisted, legacyFrame);
	assert.ok(restored);
	assert.equal(restored.canvasViewportDayCount, 84);
	assert.equal(
		getGanttChartRepairDocument(persisted, legacyFrame)?.canvasViewportDayCount,
		84,
	);
});

test("anchors timeline headers to ISO calendar weeks while task dates stay fixed", () => {
	assert.deepEqual(getGanttCalendarWeek("2025-12-29"), {
		year: 2026,
		week: 1,
		startDate: "2025-12-29",
		endDate: "2026-01-04",
		dayIndex: 0,
	});
	const create = (canvasViewportStartDay: number) =>
		createGanttChartElements(defaults(), {
			x: 0,
			y: 0,
			title: "Fixed calendar",
			startDate: "2026-07-01",
			canvasViewportStartDay,
			canvasViewportDayCount: 21,
			tasks: [{ id: "fixed", title: "Fixed", startDay: 12, durationDays: 7 }],
			text: (key) => (key === "gantt.calendarWeek" ? "KW" : key),
			dateLabel: (start, end) => `${start}/${end}`,
		});
	const initial = create(11);
	const initialHeaders = initial.filter(
		(element) => element.customData?.ganttRole === "time-header",
	);
	assert.deepEqual(
		initialHeaders.map((element) => element.text),
		[
			"KW 28 \u00b7 2026-07-06/2026-07-12",
			"KW 29 \u00b7 2026-07-13/2026-07-19",
			"KW 30 \u00b7 2026-07-20/2026-07-26",
			"KW 31 \u00b7 2026-07-27/2026-08-02",
		],
	);
	assert.equal(initialHeaders[0]?.width, 28);
	const initialTaskDate = getGanttTaskMeta(
		initial.find((element) => getGanttTaskMeta(element)),
	)?.startDate;

	const scrolled = create(18);
	assert.equal(
		getGanttTaskMeta(scrolled.find((element) => getGanttTaskMeta(element)))
			?.startDate,
		initialTaskDate,
	);
	assert.equal(
		scrolled.find((element) => element.customData?.ganttRole === "time-header")
			?.text,
		"KW 29 \u00b7 2026-07-13/2026-07-19",
	);
});

test("charts render their text in the legible sans-serif font", () => {
	const elements = createGanttChartElements(defaults(), {
		x: 0,
		y: 0,
		startDate: "2026-07-13",
	});
	const label = elements.find(
		(element) => element.customData?.ganttRole === "task-label",
	);
	assert.ok(label);
	assert.match(label.fontFamily ?? "", /sans-serif/u);
});

test("renders bar titles and the today caption as separate readable overlays", () => {
	const elements = createGanttChartElements(defaults(), {
		x: 0,
		y: 0,
		startDate: "2026-07-13",
		today: "2026-07-16",
	});
	const barLabels = elements.filter(
		(element) => element.customData?.ganttRole === "task-bar-label",
	);
	assert.equal(barLabels.length, 5);
	assert.deepEqual(
		barLabels.map((element) => element.text),
		["Discovery", "Design", "Implementation", "Quality assurance", "Launch"],
	);
	assert.ok(
		barLabels.every(
			(element) => element.type === "text" && element.locked === true,
		),
	);

	const todayBackground = elements.find(
		(element) => element.customData?.ganttRole === "today-label-background",
	);
	const todayLabel = elements.find(
		(element) => element.customData?.ganttRole === "today-label",
	);
	assert.ok(todayBackground);
	assert.equal(todayBackground.text, "");
	assert.ok(todayLabel);
	assert.equal(todayLabel.type, "text");
	assert.equal(todayLabel.text, "Today");
});

test("supports every dependency type and keeps connectors synchronized", () => {
	const elements = createGanttChartElements(defaults(), {
		x: 0,
		y: 0,
		startDate: "2026-07-13",
		tasks: [
			{ id: "one", title: "One", startDay: 0, durationDays: 3 },
			{ id: "two", title: "Two", startDay: 5, durationDays: 3 },
		],
		dependencies: [
			{ fromTaskId: "one", toTaskId: "two", type: "finish-to-start" },
			{ fromTaskId: "one", toTaskId: "two", type: "start-to-start" },
			{ fromTaskId: "one", toTaskId: "two", type: "finish-to-finish" },
			{ fromTaskId: "one", toTaskId: "two", type: "start-to-finish" },
		],
	});
	const dependencies = elements.filter((element) =>
		getGanttDependencyMeta(element),
	);
	assert.deepEqual(
		dependencies.map(
			(element) => getGanttDependencyMeta(element)?.ganttDependencyType,
		),
		[
			"finish-to-start",
			"start-to-start",
			"finish-to-finish",
			"start-to-finish",
		],
	);

	const source = elements.find(
		(element) => getGanttTaskMeta(element)?.ganttTaskId === "one",
	);
	assert.ok(source);
	const moved = elements.map((element) =>
		element.id === source.id ? { ...element, x: element.x + 40 } : element,
	);
	const updates = buildGanttDependencySyncUpdates(
		new Map(moved.map((element) => [element.id, element])),
	);
	assert.equal(updates.length, 4);
	assert.equal(
		planCanvasNormalization(
			new Map(moved.map((element) => [element.id, element])),
		).update.filter((update) =>
			dependencies.some((item) => item.id === update.id),
		).length,
		4,
	);
});

test("routes overlapping Gantt dependencies outside both task bars", () => {
	const elements = createGanttChartElements(defaults(), {
		x: 0,
		y: 0,
		startDate: "2026-07-13",
		tasks: [
			{ id: "source", title: "Source", startDay: 0, durationDays: 7 },
			{ id: "target", title: "Target", startDay: 5, durationDays: 7 },
		],
		dependencies: [],
	});
	const source = elements.find(
		(element) => getGanttTaskMeta(element)?.ganttTaskId === "source",
	);
	const target = elements.find(
		(element) => getGanttTaskMeta(element)?.ganttTaskId === "target",
	);
	assert.ok(source);
	assert.ok(target);

	const changes = buildGanttDependencyChanges(
		source,
		target,
		"finish-to-start",
	);
	const absolutePoints = (changes.points ?? []).map(
		([x, y]) =>
			[x + (changes.x ?? 0), y + (changes.y ?? 0)] as [number, number],
	);
	assert.equal(absolutePoints.length, 6);
	assert.deepEqual(absolutePoints[0], [
		source.x + source.width,
		source.y + source.height / 2,
	]);
	assert.ok(absolutePoints[1][0] > source.x + source.width);
	assert.ok(absolutePoints[2][1] > source.y + source.height);
	assert.ok(absolutePoints[2][1] < target.y);
	assert.ok(absolutePoints[3][0] < target.x);
	assert.ok(absolutePoints[4][0] < target.x);
	assert.ok(absolutePoints[5][0] < target.x);
	assert.ok(absolutePoints[5][0] > absolutePoints[4][0]);
});

test("keeps the target arrowhead clear when dependent tasks touch", () => {
	const elements = createGanttChartElements(defaults(), {
		x: 0,
		y: 0,
		startDate: "2026-07-13",
		tasks: [
			{ id: "source", title: "Source", startDay: 0, durationDays: 3 },
			{ id: "target", title: "Target", startDay: 3, durationDays: 3 },
		],
		dependencies: [],
	});
	const source = elements.find(
		(element) => getGanttTaskMeta(element)?.ganttTaskId === "source",
	);
	const target = elements.find(
		(element) => getGanttTaskMeta(element)?.ganttTaskId === "target",
	);
	assert.ok(source);
	assert.ok(target);

	const changes = buildGanttDependencyChanges(
		source,
		target,
		"finish-to-start",
	);
	const lastPoint = changes.points?.at(-1);
	assert.ok(lastPoint);
	const targetTipX = (changes.x ?? 0) + lastPoint[0];
	assert.ok(targetTipX < target.x);
	assert.ok(target.x - targetTipX >= 2);
});

test("deleting a task also deletes its Gantt dependencies", () => {
	const elements = createGanttChartElements(defaults(), {
		x: 0,
		y: 0,
		startDate: "2026-07-13",
	});
	const task = elements.find(
		(element) => getGanttTaskMeta(element)?.ganttTaskId === "design",
	);
	assert.ok(task);
	const plan = planCanvasDeletion(
		new Map(elements.map((element) => [element.id, element])),
		[task.id],
	);
	const deletedDependencies = elements.filter(
		(element) =>
			plan.deleteIds.includes(element.id) && getGanttDependencyMeta(element),
	);
	assert.equal(deletedDependencies.length, 1);
});

test("reads direct canvas moves, resizes and labels back into the document", () => {
	const elements = createGanttChartElements(defaults(), {
		x: 0,
		y: 0,
		startDate: "2026-07-13",
		today: "2026-07-16",
	});
	const design = elements.find(
		(element) => getGanttTaskMeta(element)?.ganttTaskId === "design",
	);
	const label = elements.find(
		(element) =>
			element.customData?.ganttTaskId === "design" &&
			element.customData?.ganttRole === "task-label",
	);
	assert.ok(design);
	assert.ok(label);
	const edited = elements.map((element) => {
		if (element.id === design.id) {
			return { ...element, x: element.x + 28, width: element.width + 28 };
		}
		if (element.id === label.id) {
			return { ...element, text: "Design system\nLea" };
		}
		return element;
	});
	const document = getGanttChartDocument(edited, edited[0]);
	const task = document?.tasks.find((item) => item.id === "design");
	assert.equal(task?.title, "Design system");
	assert.equal(task?.owner, "Lea");
	assert.equal(task?.startDay, 6);
	assert.equal(task?.durationDays, 8);
	assert.equal(document?.showToday, true);
});

test("core task builders cascade links and rebuild a chart with a stable root", () => {
	const factory = defaults();
	const elements = createGanttChartElements(factory, {
		x: 20,
		y: 30,
		startDate: "2026-07-13",
		today: "2026-07-16",
	});
	const root = elements[0];
	assert.ok(root);
	let document = getGanttChartDocument(elements, root);
	assert.ok(document);
	document = addGanttTask(document, "milestone");
	const milestone = document.tasks.at(-1);
	assert.ok(milestone);
	document = updateGanttTask(document, "implementation", {
		critical: true,
		progress: 70,
	});
	document = addGanttDependency(document, {
		fromTaskId: "implementation",
		toTaskId: milestone.id,
		type: "finish-to-finish",
	});
	document = removeGanttTask(document, "quality");
	assert.equal(
		document.dependencies.some(
			(dependency) =>
				dependency.fromTaskId === "quality" ||
				dependency.toTaskId === "quality",
		),
		false,
	);
	const plan = buildGanttChartMutationPlan(factory, elements, root, document, {
		today: "2026-07-16",
	});
	assert.deepEqual(plan.selectedIds, [root.id]);
	assert.equal(plan.update[0]?.id, root.id);
	assert.equal(plan.deleteIds.length < elements.length - 1, true);
	const rebuilt = applyCanvasMutationPlan(elements, plan);
	const previousImplementation = elements.find(
		(element) => getGanttTaskMeta(element)?.ganttTaskId === "implementation",
	);
	const rebuiltImplementation = rebuilt.find(
		(element) => getGanttTaskMeta(element)?.ganttTaskId === "implementation",
	);
	assert.ok(previousImplementation);
	assert.ok(rebuiltImplementation);
	assert.equal(rebuiltImplementation.id, previousImplementation.id);
	assert.equal(
		rebuilt.some(
			(element) =>
				getGanttTaskMeta(element)?.ganttTaskId === "implementation" &&
				element.strokeStyle === "dashed",
		),
		true,
	);
	assert.equal(
		rebuilt.some((element) => element.customData?.ganttRole === "today-line"),
		true,
	);
	assert.equal(findGanttChartElement(elements, "missing-chart"), null);
});

test("reuses generated child ids while scrolling the compact canvas", () => {
	const factory = defaults();
	const elements = createGanttChartElements(factory, {
		x: 20,
		y: 30,
		startDate: "2026-01-01",
		dayCount: 365,
		canvasViewportDayCount: 42,
		tasks: [
			{ id: "design", title: "Design", startDay: 5, durationDays: 10 },
			{
				id: "implementation",
				title: "Implementation",
				startDay: 20,
				durationDays: 30,
			},
		],
	});
	const root = elements[0];
	const document = getGanttChartDocument(elements, root);
	assert.ok(root);
	assert.ok(document);
	const plan = buildGanttChartMutationPlan(
		factory,
		elements,
		root,
		scrollGanttChartCanvas(document, 1),
		{ today: "2026-07-19" },
	);
	assert.equal(plan.create.length, 0);
	assert.equal(plan.deleteIds.length, 0);
	assert.equal(plan.update.length, elements.length);
	const rebuilt = applyCanvasMutationPlan(elements, plan);
	assert.deepEqual(
		rebuilt.map((element) => element.id),
		elements.map((element) => element.id),
	);
});

test("plans transport-neutral Gantt edits for AI and MCP", () => {
	const factory = defaults();
	const elements = createGanttChartElements(factory, {
		x: 20,
		y: 30,
		startDate: "2026-07-13",
	});
	const [summary] = getGanttChartSummaries(elements);
	assert.ok(summary);

	const added = planGanttChartEdit({
		defaults: factory,
		elements,
		chartId: summary.id,
		action: {
			operation: "add_task",
			kind: "milestone",
			task: { title: "Go live", startDay: 30, critical: true },
		},
	});
	assert.ok(added);
	assert.equal(
		added.document.tasks.find((task) => task.id === added.affectedTaskId)
			?.title,
		"Go live",
	);

	const updated = planGanttChartEdit({
		defaults: factory,
		elements,
		chartId: summary.id,
		action: {
			operation: "update_task",
			taskId: "implementation",
			changes: { progress: 80, status: "active", owner: "Alex" },
		},
	});
	assert.equal(
		updated?.document.tasks.find((task) => task.id === "implementation")
			?.progress,
		80,
	);

	const linked = planGanttChartEdit({
		defaults: factory,
		elements,
		chartId: summary.id,
		action: {
			operation: "add_dependency",
			fromTaskId: "implementation",
			toTaskId: "quality",
			type: "finish-to-start",
		},
	});
	assert.equal(
		linked?.document.dependencies.some(
			(dependency) =>
				dependency.fromTaskId === "implementation" &&
				dependency.toTaskId === "quality",
		),
		true,
	);
});

test("groups aggregate children, keep blocks contiguous and drop bad parents", () => {
	const document = getGanttChartDocument(
		createGanttChartElements(defaults(), {
			x: 0,
			y: 0,
			startDate: "2026-07-13",
			tasks: [
				{
					id: "a",
					title: "A",
					startDay: 2,
					durationDays: 3,
					parentId: "phase",
				},
				{
					id: "phase",
					title: "Phase",
					startDay: 0,
					durationDays: 1,
					group: true,
				},
				{ id: "solo", title: "Solo", startDay: 0, durationDays: 2 },
				{
					id: "b",
					title: "B",
					startDay: 6,
					durationDays: 4,
					progress: 50,
					parentId: "phase",
				},
				{
					id: "ghost",
					title: "Ghost",
					startDay: 1,
					durationDays: 1,
					parentId: "nope",
				},
			],
			dependencies: [{ fromTaskId: "phase", toTaskId: "solo" }],
		}),
	);
	assert.ok(document);
	// Children follow their group directly; invalid parents are dropped.
	assert.deepEqual(
		document.tasks.map((task) => task.id),
		["phase", "a", "b", "solo", "ghost"],
	);
	const phase = document.tasks.find((task) => task.id === "phase");
	assert.equal(phase?.startDay, 2);
	assert.equal(phase?.durationDays, 8);
	assert.equal(phase?.progress, Math.round((3 * 0 + 4 * 50) / 7));
	assert.equal(
		document.tasks.find((task) => task.id === "ghost")?.parentId,
		undefined,
	);
	// Dependencies never touch summary rows.
	assert.equal(document.dependencies.length, 0);
});

test("collapsed groups hide children rows and shrink the rendered chart", () => {
	const base = getGanttChartDocument(
		createGanttChartElements(defaults(), {
			x: 0,
			y: 0,
			startDate: "2026-07-13",
			tasks: [
				{
					id: "phase",
					title: "Phase",
					startDay: 0,
					durationDays: 1,
					group: true,
				},
				{
					id: "a",
					title: "A",
					startDay: 0,
					durationDays: 3,
					parentId: "phase",
				},
				{ id: "solo", title: "Solo", startDay: 4, durationDays: 2 },
			],
		}),
	);
	assert.ok(base);
	const collapsed = toggleGanttGroupCollapsed(base, "phase");
	assert.equal(
		collapsed.tasks.find((task) => task.id === "phase")?.collapsed,
		true,
	);
	assert.deepEqual(
		getGanttVisibleTasks(collapsed).map((task) => task.id),
		["phase", "solo"],
	);
	const factory = defaults();
	const elements = createGanttChartElements(factory, {
		x: 0,
		y: 0,
		...collapsed,
	});
	// Hidden child renders neither a bar nor a label row.
	assert.equal(
		elements.some((element) => getGanttTaskMeta(element)?.ganttTaskId === "a"),
		false,
	);
	const roundTripped = getGanttChartDocument(elements);
	// Collapsed children survive a full canvas round trip untouched.
	assert.equal(
		roundTripped?.tasks.find((task) => task.id === "a")?.durationDays,
		3,
	);
});

test("moveGanttTask reorders blocks and re-parents tasks", () => {
	const document = getGanttChartDocument(
		createGanttChartElements(defaults(), {
			x: 0,
			y: 0,
			startDate: "2026-07-13",
			tasks: [
				{
					id: "phase",
					title: "Phase",
					startDay: 0,
					durationDays: 1,
					group: true,
				},
				{
					id: "a",
					title: "A",
					startDay: 0,
					durationDays: 3,
					parentId: "phase",
				},
				{ id: "solo", title: "Solo", startDay: 4, durationDays: 2 },
			],
		}),
	);
	assert.ok(document);
	// Pull "solo" into the phase, before "a".
	const adopted = moveGanttTask(document, "solo", 1, "phase");
	assert.deepEqual(
		adopted.tasks.map((task) => task.id),
		["phase", "solo", "a"],
	);
	assert.equal(
		adopted.tasks.find((task) => task.id === "solo")?.parentId,
		"phase",
	);
	// Push "a" out of the group to the top level.
	const promoted = moveGanttTask(adopted, "a", 0, null);
	assert.equal(
		promoted.tasks.find((task) => task.id === "a")?.parentId,
		undefined,
	);
	assert.equal(promoted.tasks[0]?.id, "a");
});

test("dragging a group summary shifts all children by the same delta", () => {
	const document = getGanttChartDocument(
		createGanttChartElements(defaults(), {
			x: 0,
			y: 0,
			startDate: "2026-07-13",
			tasks: [
				{
					id: "phase",
					title: "Phase",
					startDay: 0,
					durationDays: 1,
					group: true,
				},
				{
					id: "a",
					title: "A",
					startDay: 1,
					durationDays: 3,
					parentId: "phase",
				},
				{
					id: "b",
					title: "B",
					startDay: 5,
					durationDays: 2,
					parentId: "phase",
				},
			],
		}),
	);
	assert.ok(document);
	const shifted = updateGanttTask(document, "phase", { startDay: 4 });
	assert.equal(shifted.tasks.find((task) => task.id === "a")?.startDay, 4);
	assert.equal(shifted.tasks.find((task) => task.id === "b")?.startDay, 8);
	// Shifting left never pushes children below day zero.
	const clampedShift = updateGanttTask(shifted, "phase", { startDay: -10 });
	assert.equal(clampedShift.tasks.find((task) => task.id === "a")?.startDay, 0);
	assert.equal(clampedShift.tasks.find((task) => task.id === "b")?.startDay, 4);
});
