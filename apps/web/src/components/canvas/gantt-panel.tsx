/**
 * Community adapter for the interactive Gantt studio.
 *
 * The studio emits a complete `GanttChartDocument` after every committed
 * interaction (drag end, cell edit, …). This adapter converts each emission
 * into a canvas mutation plan and applies it live — slightly debounced so a
 * burst of quick edits rebuilds the chart only once.
 */

import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import { useI18n } from "@/lib/i18n";
import { createGanttTemplate, ganttDateLabel } from "@/lib/templates/gantt";
import { templateText } from "@/lib/templates/shared";
import { getCurrentLocale } from "@/stores/locale";
import { useThemeStore } from "@/stores/theme";
import {
	type CanvasElement,
	type CanvasMutationPlan,
	GANTT_DEFAULT_DAY_COUNT,
	type GanttChartDocument,
	alignGanttChartToCalendarYears,
	applyCanvasMutationPlan,
	buildGanttChartMutationPlan,
	findGanttChartElement,
	getGanttCanvasScrollbarMetrics,
	getGanttCanvasScrollbarThumbMeta,
	getGanttChartDocument,
	getGanttChartId,
	getGanttChartMeta,
	getGanttChartSize,
} from "@skedra/canvas-core";
import { CanvasEditorGanttStudio } from "@skedra/canvas-editor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface GanttPanelProps {
	elements: Map<string, CanvasElement>;
	selectedIds: Set<string>;
	onInsertElements: (elements: CanvasElement[]) => void;
	onApplyMutationPlan: (plan: CanvasMutationPlan) => void;
	onDeleteElements: (ids: string[]) => void;
	onHistoryBoundary: () => void;
	onSelectIds: (ids: Set<string>) => void;
	onFitElements: (elements: CanvasElement[]) => void;
	getViewportCenter: () => { x: number; y: number };
	onClose: () => void;
}

export function GanttPanel({
	elements,
	selectedIds,
	onInsertElements,
	onApplyMutationPlan,
	onDeleteElements,
	onHistoryBoundary,
	onSelectIds,
	onFitElements,
	getViewportCenter,
	onClose,
}: GanttPanelProps) {
	const { t } = useI18n();
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
	const selectedElement = Array.from(selectedIds)
		.map((id) => elements.get(id))
		.find((element): element is CanvasElement => element !== undefined);
	const selectedFrame = useMemo(
		() => findGanttChartElement(elements.values(), selectedElement),
		[elements, selectedElement],
	);
	const charts = useMemo(
		() =>
			Array.from(elements.values())
				.filter((element) => getGanttChartMeta(element) !== null)
				.map((element) => ({
					id: element.id,
					title: element.frameLabel?.trim() || t("canvas.toolbar.insertGantt"),
				})),
		[elements, t],
	);
	const [activeChartId, setActiveChartId] = useState<string | null>(
		selectedFrame?.id ?? charts[0]?.id ?? null,
	);
	useEffect(() => {
		if (selectedFrame) setActiveChartId(selectedFrame.id);
	}, [selectedFrame]);
	const resolvedActiveChartId = charts.some(
		(chart) => chart.id === activeChartId,
	)
		? activeChartId
		: (charts[0]?.id ?? null);
	const frame = useMemo(
		() => findGanttChartElement(elements.values(), resolvedActiveChartId),
		[elements, resolvedActiveChartId],
	);
	const document = useMemo(
		() => getGanttChartDocument(elements.values(), frame),
		[elements, frame],
	);
	const translate = (key: string, fallback: string) => {
		const translated = t(key);
		return translated === key ? fallback : translated;
	};

	/* ------------------------------------------------------------- */
	/* Live apply pipeline. Refs keep consecutive studio commits on   */
	/* the latest semantic chart before React publishes the Yjs       */
	/* mirror on its next animation frame.                            */
	/* ------------------------------------------------------------- */
	const elementsRef = useRef(elements);
	const frameRef = useRef(frame);
	const migratedCanvasViewportIdsRef = useRef(new Set<string>());
	useEffect(() => {
		elementsRef.current = elements;
	}, [elements]);
	useEffect(() => {
		frameRef.current = frame;
	}, [frame]);
	const applyDocument = useCallback(
		(nextDocument: GanttChartDocument) => {
			const currentFrame = frameRef.current;
			if (!currentFrame) return;
			const plan = buildGanttChartMutationPlan(
				getCanvasElementFactoryDefaults({ resolvedTheme }),
				elementsRef.current.values(),
				currentFrame,
				nextDocument,
				{
					dateLabel: ganttDateLabel,
					text: templateText,
					today: new Date().toISOString().slice(0, 10),
				},
			);
			// Publish the complete rebuild as one document change. This keeps the
			// upper canvas in lockstep with the studio and creates one Undo step.
			onHistoryBoundary();
			try {
				onApplyMutationPlan(plan);
			} finally {
				onHistoryBoundary();
			}
			const applied = applyCanvasMutationPlan(
				Array.from(elementsRef.current.values()),
				plan,
			);
			elementsRef.current = new Map(
				applied.map((element) => [element.id, element]),
			);
			frameRef.current = elementsRef.current.get(currentFrame.id) ?? null;
			onSelectIds(new Set(plan.selectedIds));
		},
		[onApplyMutationPlan, onHistoryBoundary, onSelectIds, resolvedTheme],
	);

	useEffect(() => {
		if (!frame || !document) return;
		const calendarDocument = alignGanttChartToCalendarYears(document);
		const needsCalendarAlignment =
			calendarDocument.startDate !== document.startDate ||
			calendarDocument.dayCount !== document.dayCount ||
			calendarDocument.tasks.some(
				(task, index) => task.startDay !== document.tasks[index]?.startDay,
			);
		const expectsCanvasScrollbar =
			getGanttCanvasScrollbarMetrics(calendarDocument) !== null;
		const hasCanvasScrollbar = Array.from(elements.values()).some(
			(element) =>
				getGanttCanvasScrollbarThumbMeta(element)?.ganttChartId === frame.id,
		);
		if (
			typeof frame.customData?.canvasViewportDayCount === "number" &&
			typeof frame.customData?.dayCount === "number" &&
			frame.customData.dayCount >= GANTT_DEFAULT_DAY_COUNT &&
			(!expectsCanvasScrollbar || hasCanvasScrollbar) &&
			!needsCalendarAlignment
		) {
			return;
		}
		if (migratedCanvasViewportIdsRef.current.has(frame.id)) return;
		migratedCanvasViewportIdsRef.current.add(frame.id);
		// Legacy charts stored their complete calendar as physical canvas width.
		// Rebuilding once persists the compact viewport and its internal scrollbar.
		applyDocument(calendarDocument);
	}, [applyDocument, document, elements, frame]);

	const handleChange = useCallback(
		(nextDocument: GanttChartDocument) => {
			// Studio cells often commit on blur. Applying synchronously guarantees
			// that clicking Undo immediately afterwards sees this edit first.
			applyDocument(nextDocument);
		},
		[applyDocument],
	);

	const createChart = () => {
		const size = getGanttChartSize();
		const center = frame
			? {
					x: frame.x + frame.width + 80 + size.width / 2,
					y: frame.y + size.height / 2,
				}
			: getViewportCenter();
		const nextNumber = charts.length + 1;
		const defaultTitle = t("canvas.toolbar.insertGantt");
		const created = createGanttTemplate(center.x, center.y, {
			resolvedTheme,
		}).map((element, index) =>
			index === 0
				? {
						...element,
						frameLabel:
							charts.length === 0
								? defaultTitle
								: `${defaultTitle} ${nextNumber}`,
					}
				: element,
		);
		const root = created[0];
		onInsertElements(created);
		if (root) {
			setActiveChartId(root.id);
			onSelectIds(new Set([root.id]));
		}
		onFitElements(created);
	};

	return (
		<CanvasEditorGanttStudio
			document={document}
			charts={charts}
			activeChartId={frame?.id ?? null}
			onSelectChart={(chartId) => {
				const selectedChart = findGanttChartElement(elements.values(), chartId);
				if (!selectedChart) return;
				setActiveChartId(selectedChart.id);
				onSelectIds(new Set([selectedChart.id]));
				const chartElements = Array.from(elements.values()).filter(
					(element) =>
						element.id === selectedChart.id ||
						getGanttChartId(element) === selectedChart.id,
				);
				onFitElements(chartElements);
			}}
			translate={translate}
			locale={getCurrentLocale() === "de" ? "de-CH" : "en-US"}
			today={new Date().toISOString().slice(0, 10)}
			onChange={handleChange}
			onCreate={createChart}
			onDelete={
				frame
					? () => {
							const chartId = getGanttChartId(frame);
							if (!chartId) return;
							const ids = Array.from(elements.values())
								.filter(
									(element) =>
										element.id === frame.id ||
										getGanttChartId(element) === chartId ||
										element.frameId === frame.id,
								)
								.map((element) => element.id);
							onHistoryBoundary();
							onDeleteElements(ids);
							onHistoryBoundary();
							setActiveChartId(null);
							onSelectIds(new Set());
							onClose();
						}
					: undefined
			}
			onClose={onClose}
		/>
	);
}
