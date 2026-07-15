import {
	type BBox,
	type HandlePosition,
	type SavedCanvasView,
	type Viewport,
	computeViewportForBounds,
	zoomCanvasViewportAtPoint,
} from "@skedra/canvas-core";
import { type RefObject, useCallback, useMemo, useRef, useState } from "react";
import {
	CANVAS_EDITOR_MIN_VIEW_SIZE,
	CANVAS_EDITOR_VIEW_PADDING,
	type CanvasEditorViewInteractionState,
	constrainCanvasEditorViewBoundsToAspectRatio,
	getCanvasEditorCapturedViewBounds,
	getCanvasEditorViewResizeAspectRatio,
	isCanvasEditorViewInteractionPointer,
	normalizeCanvasEditorViewBounds,
	orderCanvasEditorSavedViews,
	resizeCanvasEditorViewBounds,
} from "./saved-view-contract";

export type CanvasEditorSavedViewsTranslate = (
	key: string,
	fallback: string,
	params?: Record<string, string | number>,
) => string;

export interface UseCanvasEditorSavedViewsOptions {
	svgRef: RefObject<SVGSVGElement | null>;
	views: readonly SavedCanvasView[];
	viewport: Viewport;
	onViewportChange: (viewport: Viewport) => void;
	onViewsChange: (views: SavedCanvasView[]) => void;
	createId: () => string;
	getContentBounds: () => BBox | null;
	onResetViewport: () => void;
	presentationPreparationMode?: boolean;
	readOnly?: boolean;
	translate?: CanvasEditorSavedViewsTranslate;
}

export type CanvasEditorCreateSavedViewInput = Omit<
	SavedCanvasView,
	"id" | "createdAt" | "updatedAt"
> &
	Partial<Pick<SavedCanvasView, "id" | "createdAt" | "updatedAt">>;

function interpolate(
	template: string,
	params: Record<string, string | number> = {},
): string {
	return template.replace(/\{([^}]+)\}/g, (_match, key: string) =>
		String(params[key] ?? `{${key}}`),
	);
}

export function useCanvasEditorSavedViews({
	svgRef,
	views,
	viewport,
	onViewportChange,
	onViewsChange,
	createId,
	getContentBounds,
	onResetViewport,
	presentationPreparationMode = false,
	readOnly = false,
	translate,
}: UseCanvasEditorSavedViewsOptions) {
	const orderedViews = useMemo(
		() => orderCanvasEditorSavedViews(views),
		[views],
	);
	const viewsById = useMemo(
		() => new Map(orderedViews.map((view) => [view.id, view])),
		[orderedViews],
	);
	const viewInteractionRef = useRef<CanvasEditorViewInteractionState>(null);
	const viewDraftRef = useRef<BBox | null>(null);
	const [isCapturingView, setIsCapturingView] = useState(false);
	const [viewDraft, setViewDraftState] = useState<BBox | null>(null);
	const [activeViewId, setActiveViewId] = useState<string | null>(null);
	const [editingViewId, setEditingViewId] = useState<string | null>(null);

	const t = useCallback<CanvasEditorSavedViewsTranslate>(
		(key, fallback, params) =>
			translate?.(key, fallback, params) ?? interpolate(fallback, params),
		[translate],
	);

	const setViewDraft = useCallback((next: BBox | null) => {
		viewDraftRef.current = next;
		setViewDraftState(next);
	}, []);

	const commitViews = useCallback(
		(next: SavedCanvasView[]) => {
			if (!readOnly) onViewsChange(orderCanvasEditorSavedViews(next));
		},
		[onViewsChange, readOnly],
	);

	const createView = useCallback(
		(input: CanvasEditorCreateSavedViewInput): SavedCanvasView | null => {
			if (readOnly) return null;
			const now = Date.now();
			const next: SavedCanvasView = {
				...input,
				id: input.id ?? createId(),
				createdAt: input.createdAt ?? now,
				updatedAt: input.updatedAt ?? now,
				order: input.order ?? orderedViews.length,
			};
			commitViews([...orderedViews, next]);
			setActiveViewId(next.id);
			return next;
		},
		[commitViews, createId, orderedViews, readOnly],
	);

	const updateView = useCallback(
		(id: string, updates: Partial<SavedCanvasView>) => {
			if (readOnly || !viewsById.has(id)) return;
			commitViews(
				orderedViews.map((view) =>
					view.id === id
						? { ...view, ...updates, id, updatedAt: Date.now() }
						: view,
				),
			);
		},
		[commitViews, orderedViews, readOnly, viewsById],
	);

	const deleteView = useCallback(
		(id: string) => {
			if (readOnly || !viewsById.has(id)) return;
			commitViews(orderedViews.filter((view) => view.id !== id));
			if (activeViewId === id) setActiveViewId(null);
			if (editingViewId === id) setEditingViewId(null);
		},
		[
			activeViewId,
			commitViews,
			editingViewId,
			orderedViews,
			readOnly,
			viewsById,
		],
	);

	const fitViewportToBounds = useCallback(
		(bounds: BBox, padding = CANVAS_EDITOR_VIEW_PADDING) => {
			const rect = svgRef.current?.getBoundingClientRect();
			if (!rect || rect.width <= 0 || rect.height <= 0) return;
			onViewportChange(computeViewportForBounds(rect, bounds, padding));
		},
		[onViewportChange, svgRef],
	);

	const selectView = useCallback(
		(id: string) => {
			const view = viewsById.get(id);
			if (!view) return;
			setActiveViewId(id);
			setEditingViewId(null);
			fitViewportToBounds(view);
		},
		[fitViewportToBounds, viewsById],
	);

	const startEditingView = useCallback(
		(id: string) => {
			if (readOnly) return;
			const view = viewsById.get(id);
			if (!view) return;
			setActiveViewId(id);
			setEditingViewId(id);
			fitViewportToBounds(view);
		},
		[fitViewportToBounds, readOnly, viewsById],
	);

	const stopEditingView = useCallback(() => {
		viewInteractionRef.current = null;
		setEditingViewId(null);
	}, []);

	const renameView = useCallback(
		(id: string, name: string) => {
			const nextName = name.trim();
			if (nextName) updateView(id, { name: nextName });
		},
		[updateView],
	);

	const duplicateView = useCallback(
		(id: string) => {
			if (readOnly) return;
			const sourceIndex = orderedViews.findIndex((view) => view.id === id);
			const source = orderedViews[sourceIndex];
			if (!source) return;
			const now = Date.now();
			const duplicate: SavedCanvasView = {
				...source,
				id: createId(),
				name: t(
					presentationPreparationMode
						? "canvas.bottomBar.duplicateSlideName"
						: "canvas.bottomBar.duplicateViewName",
					"{name} copy",
					{ name: source.name },
				),
				x: source.x + 24,
				y: source.y + 24,
				order: sourceIndex + 1,
				createdAt: now,
				updatedAt: now,
			};
			const next = [...orderedViews];
			next.splice(sourceIndex + 1, 0, duplicate);
			commitViews(next.map((view, order) => ({ ...view, order })));
			setActiveViewId(duplicate.id);
		},
		[
			commitViews,
			createId,
			orderedViews,
			presentationPreparationMode,
			readOnly,
			t,
		],
	);

	const moveView = useCallback(
		(id: string, direction: -1 | 1) => {
			if (readOnly) return;
			const index = orderedViews.findIndex((view) => view.id === id);
			const targetIndex = index + direction;
			if (index < 0 || targetIndex < 0 || targetIndex >= orderedViews.length)
				return;
			const next = [...orderedViews];
			const [current] = next.splice(index, 1);
			next.splice(targetIndex, 0, current);
			const now = Date.now();
			commitViews(
				next.map((view, order) => ({ ...view, order, updatedAt: now })),
			);
		},
		[commitViews, orderedViews, readOnly],
	);

	const fitViewport = useCallback(() => {
		const bounds = getContentBounds();
		if (!bounds) {
			onResetViewport();
			return;
		}
		setEditingViewId(null);
		fitViewportToBounds(bounds, 120);
	}, [fitViewportToBounds, getContentBounds, onResetViewport]);

	const zoomBy = useCallback(
		(factor: number) => {
			const rect = svgRef.current?.getBoundingClientRect();
			if (!rect) return;
			onViewportChange(
				zoomCanvasViewportAtPoint(
					viewport,
					{ x: rect.width / 2, y: rect.height / 2 },
					viewport.zoom * factor,
				),
			);
		},
		[onViewportChange, svgRef, viewport],
	);

	const startCaptureView = useCallback(() => {
		if (readOnly) return;
		setIsCapturingView(true);
		setViewDraft(null);
		setActiveViewId(null);
		setEditingViewId(null);
		viewInteractionRef.current = null;
	}, [readOnly, setViewDraft]);

	const cancelCaptureView = useCallback(() => {
		setIsCapturingView(false);
		setViewDraft(null);
		viewInteractionRef.current = null;
	}, [setViewDraft]);

	const beginViewMove = useCallback(
		(viewId: string, event: React.PointerEvent<SVGRectElement>) => {
			if (readOnly) return;
			event.preventDefault();
			event.stopPropagation();
			const view = viewsById.get(viewId);
			const rect = svgRef.current?.getBoundingClientRect();
			if (!view || !rect) return;
			const canvasX = (event.clientX - rect.left - viewport.x) / viewport.zoom;
			const canvasY = (event.clientY - rect.top - viewport.y) / viewport.zoom;
			try {
				event.currentTarget.setPointerCapture(event.pointerId);
			} catch {
				// The browser may already have cancelled the pointer.
			}
			viewInteractionRef.current = {
				mode: "move",
				pointerId: event.pointerId,
				startCanvasX: canvasX,
				startCanvasY: canvasY,
				viewId,
				startBounds: {
					x: view.x,
					y: view.y,
					width: view.width,
					height: view.height,
				},
				handle: null,
			};
			setActiveViewId(viewId);
			setEditingViewId(viewId);
		},
		[readOnly, svgRef, viewport, viewsById],
	);

	const beginViewResize = useCallback(
		(
			handle: HandlePosition,
			viewId: string,
			event: React.PointerEvent<SVGRectElement>,
		) => {
			if (readOnly) return;
			event.preventDefault();
			event.stopPropagation();
			const view = viewsById.get(viewId);
			const rect = svgRef.current?.getBoundingClientRect();
			if (!view || !rect) return;
			const canvasX = (event.clientX - rect.left - viewport.x) / viewport.zoom;
			const canvasY = (event.clientY - rect.top - viewport.y) / viewport.zoom;
			try {
				event.currentTarget.setPointerCapture(event.pointerId);
			} catch {
				// The browser may already have cancelled the pointer.
			}
			viewInteractionRef.current = {
				mode: "resize",
				pointerId: event.pointerId,
				startCanvasX: canvasX,
				startCanvasY: canvasY,
				viewId,
				startBounds: {
					x: view.x,
					y: view.y,
					width: view.width,
					height: view.height,
				},
				handle,
			};
			setActiveViewId(viewId);
			setEditingViewId(viewId);
		},
		[readOnly, svgRef, viewport, viewsById],
	);

	const startViewCapture = useCallback(
		(canvasX: number, canvasY: number, pointerId: number) => {
			if (readOnly) return;
			viewInteractionRef.current = {
				mode: "create",
				pointerId,
				startCanvasX: canvasX,
				startCanvasY: canvasY,
				viewId: null,
				startBounds: { x: canvasX, y: canvasY, width: 0, height: 0 },
				handle: null,
			};
			setViewDraft({ x: canvasX, y: canvasY, width: 0, height: 0 });
		},
		[readOnly, setViewDraft],
	);

	const handleViewPointerMove = useCallback(
		(canvasX: number, canvasY: number, pointerId: number) => {
			const interaction = viewInteractionRef.current;
			if (!isCanvasEditorViewInteractionPointer(interaction, pointerId))
				return false;

			if (interaction.mode === "create") {
				setViewDraft(
					normalizeCanvasEditorViewBounds(
						interaction.startCanvasX,
						interaction.startCanvasY,
						canvasX,
						canvasY,
					),
				);
				return true;
			}

			if (!interaction.viewId) return true;
			const dx = canvasX - interaction.startCanvasX;
			const dy = canvasY - interaction.startCanvasY;
			if (interaction.mode === "move") {
				updateView(interaction.viewId, {
					x: interaction.startBounds.x + dx,
					y: interaction.startBounds.y + dy,
				});
				return true;
			}

			if (interaction.handle) {
				const resized = resizeCanvasEditorViewBounds(
					interaction.startBounds,
					interaction.handle,
					dx,
					dy,
				);
				const ratio = getCanvasEditorViewResizeAspectRatio(
					viewsById.get(interaction.viewId)?.aspectRatio,
					presentationPreparationMode,
				);
				const nextBounds = ratio
					? constrainCanvasEditorViewBoundsToAspectRatio(
							resized,
							ratio,
							interaction.handle,
						)
					: resized;
				updateView(interaction.viewId, nextBounds);
			}
			return true;
		},
		[presentationPreparationMode, setViewDraft, updateView, viewsById],
	);

	const handleViewPointerUp = useCallback(
		(pointerId: number) => {
			const interaction = viewInteractionRef.current;
			if (!isCanvasEditorViewInteractionPointer(interaction, pointerId))
				return false;
			viewInteractionRef.current = null;

			if (interaction.mode === "create") {
				const finalBounds = viewDraftRef.current;
				setViewDraft(null);
				setIsCapturingView(false);
				if (
					finalBounds &&
					finalBounds.width >= CANVAS_EDITOR_MIN_VIEW_SIZE &&
					finalBounds.height >= CANVAS_EDITOR_MIN_VIEW_SIZE
				) {
					const nextIndex = orderedViews.length + 1;
					const bounds = getCanvasEditorCapturedViewBounds(
						finalBounds,
						presentationPreparationMode,
					);
					const created = createView({
						name: t(
							presentationPreparationMode
								? "canvas.bottomBar.defaultSlideName"
								: "canvas.bottomBar.defaultViewName",
							presentationPreparationMode ? "Slide {index}" : "View {index}",
							{ index: nextIndex },
						),
						...bounds,
						order: orderedViews.length,
						...(presentationPreparationMode
							? ({ aspectRatio: "16:9" } as const)
							: {}),
					});
					if (created) setEditingViewId(created.id);
				}
			}
			return true;
		},
		[
			createView,
			orderedViews.length,
			presentationPreparationMode,
			setViewDraft,
			t,
		],
	);

	const cancelViewInteraction = useCallback(() => {
		const interaction = viewInteractionRef.current;
		if (!interaction) return false;
		viewInteractionRef.current = null;
		if (interaction.mode === "create") {
			setViewDraft(null);
			setIsCapturingView(false);
			return true;
		}
		if (interaction.viewId) {
			updateView(interaction.viewId, interaction.startBounds);
		}
		return true;
	}, [setViewDraft, updateView]);

	const resetViewsOnImport = useCallback(() => {
		setActiveViewId(null);
		setEditingViewId(null);
		cancelCaptureView();
	}, [cancelCaptureView]);

	return {
		orderedViews,
		activeViewId,
		setActiveViewId,
		editingViewId,
		setEditingViewId,
		isCapturingView,
		viewDraft,
		createView,
		updateView,
		deleteView,
		selectView,
		startEditingView,
		stopEditingView,
		renameView,
		duplicateView,
		moveView,
		fitViewportToBounds,
		fitViewport,
		zoomBy,
		startCaptureView,
		cancelCaptureView,
		beginViewMove,
		beginViewResize,
		startViewCapture,
		handleViewPointerMove,
		handleViewPointerUp,
		cancelViewInteraction,
		resetViewsOnImport,
	};
}
