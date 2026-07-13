/**
 * Gespeicherte Ansichten: State, CRUD und Pointer-Interaktion.
 * Im Vorbereitungsmodus werden dieselben Ansichten als Folien bearbeitet.
 */

import {
	MIN_VIEW_SIZE,
	VIEW_PADDING,
	type ViewInteractionState,
	constrainViewBoundsToAspectRatio,
	getCapturedViewBounds,
	getViewResizeAspectRatio,
	normalizeBounds,
	resizeViewBounds,
} from "@/components/canvas/canvas-view-utils";
import { useI18n } from "@/lib/i18n";
import type { BBox, CanvasScene } from "@skedra/canvas-core";
import { computeViewportForBounds } from "@skedra/canvas-core";
import type {
	CanvasElement,
	HandlePosition,
	SavedCanvasView,
} from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import { type RefObject, useCallback, useRef, useState } from "react";

interface CanvasSyncSlice {
	elements: Map<string, CanvasElement>;
	scene: CanvasScene;
	views: Map<string, SavedCanvasView>;
	createView: (view: SavedCanvasView) => void;
	updateView: (id: string, updates: Partial<SavedCanvasView>) => void;
	deleteView: (id: string) => void;
}

interface CanvasStoreSlice {
	viewport: { x: number; y: number; zoom: number };
	setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
	resetViewport: () => void;
}

interface UseCanvasSavedViewsOptions {
	svgRef: RefObject<SVGSVGElement | null>;
	sync: CanvasSyncSlice;
	store: CanvasStoreSlice;
	presentationPreparationMode: boolean;
}

function orderViews(views: Iterable<SavedCanvasView>) {
	return Array.from(views).sort(
		(a, b) =>
			(a.order ?? a.createdAt) - (b.order ?? b.createdAt) ||
			a.createdAt - b.createdAt,
	);
}

export function useCanvasSavedViews({
	svgRef,
	sync,
	store,
	presentationPreparationMode,
}: UseCanvasSavedViewsOptions) {
	const { t } = useI18n();
	const viewInteractionRef = useRef<ViewInteractionState>(null);
	const [isCapturingView, setIsCapturingView] = useState(false);
	const [viewDraft, setViewDraft] = useState<BBox | null>(null);
	const [activeViewId, setActiveViewId] = useState<string | null>(null);
	const [editingViewId, setEditingViewId] = useState<string | null>(null);

	const fitViewportToBounds = useCallback(
		(bounds: BBox, padding = VIEW_PADDING) => {
			const svg = svgRef.current;
			if (!svg) return;
			const rect = svg.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) return;
			store.setViewport(computeViewportForBounds(rect, bounds, padding));
		},
		[svgRef, store],
	);

	const handleSelectView = useCallback(
		(id: string) => {
			const view = sync.views.get(id);
			if (!view) return;
			setActiveViewId(id);
			setEditingViewId(null);
			fitViewportToBounds(view);
		},
		[fitViewportToBounds, sync.views],
	);

	const handleStartEditView = useCallback(
		(id: string) => {
			const view = sync.views.get(id);
			if (!view) return;
			setActiveViewId(id);
			setEditingViewId(id);
			fitViewportToBounds(view);
		},
		[fitViewportToBounds, sync.views],
	);

	const handleStopEditView = useCallback(() => {
		setEditingViewId(null);
		viewInteractionRef.current = null;
	}, []);

	const handleRenameView = useCallback(
		(id: string, name: string) => {
			const nextName = name.trim();
			if (!nextName) return;
			sync.updateView(id, {
				name: nextName,
				updatedAt: Date.now(),
			});
		},
		[sync],
	);

	const handleDeleteView = useCallback(
		(id: string) => {
			sync.deleteView(id);
			if (activeViewId === id) {
				setActiveViewId(null);
			}
			if (editingViewId === id) {
				setEditingViewId(null);
			}
		},
		[activeViewId, editingViewId, sync],
	);

	const handleDuplicateView = useCallback(
		(id: string) => {
			const source = sync.views.get(id);
			if (!source) return;
			const ordered = orderViews(sync.views.values());
			const sourceIndex = ordered.findIndex((view) => view.id === id);
			for (let index = 0; index < ordered.length; index += 1) {
				sync.updateView(ordered[index].id, {
					order: index > sourceIndex ? index + 1 : index,
					updatedAt: Date.now(),
				});
			}
			const now = Date.now();
			const duplicate: SavedCanvasView = {
				...source,
				id: nanoid(),
				name: t(
					presentationPreparationMode
						? "canvas.bottomBar.duplicateSlideName"
						: "canvas.bottomBar.duplicateViewName",
					{ name: source.name },
				),
				x: source.x + 24,
				y: source.y + 24,
				order: sourceIndex + 1,
				createdAt: now,
				updatedAt: now,
			};
			sync.createView(duplicate);
			setActiveViewId(duplicate.id);
		},
		[presentationPreparationMode, sync, t],
	);

	const handleMoveView = useCallback(
		(id: string, direction: -1 | 1) => {
			const ordered = orderViews(sync.views.values());
			const index = ordered.findIndex((view) => view.id === id);
			const targetIndex = index + direction;
			if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
			const [current] = ordered.splice(index, 1);
			ordered.splice(targetIndex, 0, current);
			const now = Date.now();
			for (const [nextIndex, view] of ordered.entries()) {
				sync.updateView(view.id, { order: nextIndex, updatedAt: now });
			}
		},
		[sync],
	);

	const handleFitViewport = useCallback(() => {
		const bounds = sync.scene.getCombinedBBox(sync.scene.getSortedElements());
		if (!bounds) {
			store.resetViewport();
			return;
		}
		setEditingViewId(null);
		fitViewportToBounds(bounds, 120);
	}, [fitViewportToBounds, store, sync.scene]);

	const beginViewMove = useCallback(
		(viewId: string, event: React.PointerEvent<SVGRectElement>) => {
			event.preventDefault();
			event.stopPropagation();
			const view = sync.views.get(viewId);
			if (!view) return;
			const rect = svgRef.current?.getBoundingClientRect();
			if (!rect) return;
			const canvasX =
				(event.clientX - rect.left - store.viewport.x) / store.viewport.zoom;
			const canvasY =
				(event.clientY - rect.top - store.viewport.y) / store.viewport.zoom;
			viewInteractionRef.current = {
				mode: "move",
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
		[svgRef, store.viewport, sync.views],
	);

	const beginViewResize = useCallback(
		(
			handle: HandlePosition,
			viewId: string,
			event: React.PointerEvent<SVGRectElement>,
		) => {
			event.preventDefault();
			event.stopPropagation();
			const view = sync.views.get(viewId);
			if (!view) return;
			const rect = svgRef.current?.getBoundingClientRect();
			if (!rect) return;
			const canvasX =
				(event.clientX - rect.left - store.viewport.x) / store.viewport.zoom;
			const canvasY =
				(event.clientY - rect.top - store.viewport.y) / store.viewport.zoom;
			viewInteractionRef.current = {
				mode: "resize",
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
		[svgRef, store.viewport, sync.views],
	);

	const startViewCapture = useCallback((canvasX: number, canvasY: number) => {
		viewInteractionRef.current = {
			mode: "create",
			startCanvasX: canvasX,
			startCanvasY: canvasY,
			viewId: null,
			startBounds: { x: canvasX, y: canvasY, width: 0, height: 0 },
			handle: null,
		};
		setViewDraft({ x: canvasX, y: canvasY, width: 0, height: 0 });
	}, []);

	const handleViewPointerMove = useCallback(
		(canvasX: number, canvasY: number) => {
			const interaction = viewInteractionRef.current;
			if (!interaction) return false;

			if (interaction.mode === "create") {
				setViewDraft(
					normalizeBounds(
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
				sync.updateView(interaction.viewId, {
					x: interaction.startBounds.x + dx,
					y: interaction.startBounds.y + dy,
					updatedAt: Date.now(),
				});
				return true;
			}

			if (interaction.mode === "resize" && interaction.handle) {
				const resizedBounds = resizeViewBounds(
					interaction.startBounds,
					interaction.handle,
					dx,
					dy,
				);
				const view = sync.views.get(interaction.viewId);
				const ratio = getViewResizeAspectRatio(
					view?.aspectRatio,
					presentationPreparationMode,
				);
				const nextBounds = ratio
					? constrainViewBoundsToAspectRatio(
							resizedBounds,
							ratio,
							interaction.handle,
						)
					: resizedBounds;
				sync.updateView(interaction.viewId, {
					x: nextBounds.x,
					y: nextBounds.y,
					width: nextBounds.width,
					height: nextBounds.height,
					updatedAt: Date.now(),
				});
			}
			return true;
		},
		[presentationPreparationMode, sync],
	);

	const handleViewPointerUp = useCallback(() => {
		const interaction = viewInteractionRef.current;
		if (!interaction) return false;

		if (interaction.mode === "create") {
			const finalBounds = viewDraft;
			setViewDraft(null);
			setIsCapturingView(false);
			if (
				finalBounds &&
				finalBounds.width >= MIN_VIEW_SIZE &&
				finalBounds.height >= MIN_VIEW_SIZE
			) {
				const ordered = orderViews(sync.views.values());
				const nextIndex = ordered.length + 1;
				const now = Date.now();
				for (const [index, view] of ordered.entries()) {
					if (view.order !== index) {
						sync.updateView(view.id, { order: index, updatedAt: now });
					}
				}
				const capturedBounds = getCapturedViewBounds(
					finalBounds,
					presentationPreparationMode,
				);
				const nextView: SavedCanvasView = {
					id: nanoid(),
					name: t(
						presentationPreparationMode
							? "canvas.bottomBar.defaultSlideName"
							: "canvas.bottomBar.defaultViewName",
						{ index: nextIndex },
					),
					x: capturedBounds.x,
					y: capturedBounds.y,
					width: capturedBounds.width,
					height: capturedBounds.height,
					createdAt: now,
					updatedAt: now,
					order: ordered.length,
					...(presentationPreparationMode
						? ({ aspectRatio: "16:9" } as const)
						: {}),
				};
				sync.createView(nextView);
				setActiveViewId(nextView.id);
				setEditingViewId(nextView.id);
			}
		}

		viewInteractionRef.current = null;
		return true;
	}, [presentationPreparationMode, sync, t, viewDraft]);

	const resetViewsOnImport = useCallback(() => {
		setActiveViewId(null);
	}, []);

	return {
		activeViewId,
		setActiveViewId,
		editingViewId,
		setEditingViewId,
		isCapturingView,
		setIsCapturingView,
		viewDraft,
		setViewDraft,
		viewInteractionRef,
		fitViewportToBounds,
		handleSelectView,
		handleStartEditView,
		handleStopEditView,
		handleRenameView,
		handleDeleteView,
		handleDuplicateView,
		handleMoveView,
		handleFitViewport,
		beginViewMove,
		beginViewResize,
		startViewCapture,
		handleViewPointerMove,
		handleViewPointerUp,
		resetViewsOnImport,
	};
}
