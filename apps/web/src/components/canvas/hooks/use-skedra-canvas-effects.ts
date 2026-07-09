/**
 * Globale Canvas-Events, Viewport-Persistenz und Theme-Sync fuer SkedraCanvas.
 */

import { areViewportsEqual } from "@/components/canvas/canvas-view-utils";
import {
	type CanvasStoreState,
	useCanvasStore,
} from "@/hooks/use-canvas-store";
import {
	loadBoardCanvasViewport,
	loadGuestCanvasViewport,
	saveBoardCanvasViewport,
	saveGuestCanvasViewport,
} from "@/lib/canvas/canvas-viewport-storage";
import { collectThemeElementPatches } from "@/lib/canvas/theme-element-sync";
import { useThemeStore } from "@/stores/theme";
import type { CanvasElement, CanvasScene, Viewport } from "@skedra/canvas-core";
import type { SavedCanvasView } from "@skedra/canvas-core";
import { useEffect, useLayoutEffect, useRef } from "react";
import type * as Y from "yjs";

type CanvasSyncApi = {
	isConnected: boolean;
	elements: Map<string, CanvasElement>;
	scene: CanvasScene;
	views: Map<string, SavedCanvasView>;
	createElement: (element: CanvasElement) => void;
	updateElement: (id: string, updates: Partial<CanvasElement>) => void;
	updateElements: (
		updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
	) => void;
	remotePresence: Array<{
		canWrite: boolean;
		viewport: Viewport | null;
		activeViewId: string | null;
		updatedAt: number;
	}>;
	isReadonly: boolean;
};

interface UseSkedraCanvasEffectsOptions {
	svgRef: React.RefObject<SVGSVGElement | null>;
	sync: CanvasSyncApi;
	syncRef: React.MutableRefObject<CanvasSyncApi>;
	localMode: boolean;
	whiteboardId?: string;
	store: CanvasStoreState;
	fitViewportToBounds: (
		bounds: { x: number; y: number; width: number; height: number },
		padding?: number,
	) => void;
	focusCanvasPointRef?: React.MutableRefObject<
		((x: number, y: number) => void) | null
	>;
	presentationMode: boolean;
	presentationShareToken?: string;
	presenterMode: boolean;
	activeViewId: string | null;
	setActiveViewId: (id: string | null) => void;
}

export function useSkedraCanvasEffects({
	svgRef,
	sync,
	syncRef,
	localMode,
	whiteboardId,
	store,
	fitViewportToBounds,
	focusCanvasPointRef,
	presentationMode,
	presentationShareToken,
	presenterMode,
	activeViewId,
	setActiveViewId,
}: UseSkedraCanvasEffectsOptions) {
	const hasAutoFittedRef = useRef(false);
	const lastAutoFittedWhiteboardIdRef = useRef<string | null>(null);
	const initialElementCountRef = useRef<number | null>(null);
	const viewportRestoredRef = useRef(false);
	const lastFollowedPresenterViewportRef = useRef<Viewport | null>(null);
	const lastFollowedPresenterViewIdRef = useRef<string | null>(null);
	const hasSyncedLoadedElementsRef = useRef(false);
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);

	useEffect(() => {
		if (hasSyncedLoadedElementsRef.current || sync.elements.size === 0) return;
		hasSyncedLoadedElementsRef.current = true;

		const currentSync = syncRef.current;
		const patches = collectThemeElementPatches(currentSync.elements.values(), {
			resolvedTheme,
		}).filter(({ id, changes }) => {
			const element = currentSync.elements.get(id);
			if (!element) return false;
			return Object.entries(changes).some(
				([key, value]) => element[key as keyof CanvasElement] !== value,
			);
		});
		if (patches.length > 0) {
			currentSync.updateElements(patches);
		}
	}, [resolvedTheme, sync.elements.size, syncRef]);

	useEffect(() => {
		const applyThemeSync = () => {
			useCanvasStore.getState().syncTheme({ resolvedTheme });
			const currentSync = syncRef.current;
			const patches = collectThemeElementPatches(
				currentSync.elements.values(),
				{ resolvedTheme },
			).filter(({ id, changes }) => {
				const element = currentSync.elements.get(id);
				if (!element) return false;
				return Object.entries(changes).some(
					([key, value]) => element[key as keyof CanvasElement] !== value,
				);
			});
			if (patches.length > 0) {
				currentSync.updateElements(patches);
			}
		};
		applyThemeSync();
	}, [resolvedTheme, syncRef]);

	useEffect(() => {
		const svg = svgRef.current;
		if (!svg) return;
		const handleWheel = (e: WheelEvent) => {
			e.preventDefault();
			const { viewport, zoomTo } = useCanvasStore.getState();
			zoomTo(
				viewport.zoom * (e.deltaY > 0 ? 0.92 : 1.08),
				e.clientX,
				e.clientY,
			);
		};
		svg.addEventListener("wheel", handleWheel, { passive: false });
		return () => svg.removeEventListener("wheel", handleWheel);
	}, [svgRef]);

	useLayoutEffect(() => {
		const boardKey = localMode ? "local" : (whiteboardId ?? null);
		if (lastAutoFittedWhiteboardIdRef.current !== boardKey) {
			hasAutoFittedRef.current = false;
			initialElementCountRef.current = null;
			viewportRestoredRef.current = false;
			lastAutoFittedWhiteboardIdRef.current = boardKey;
		}

		if (!sync.isConnected) return;

		if (!viewportRestoredRef.current) {
			const saved = localMode
				? loadGuestCanvasViewport()
				: whiteboardId
					? loadBoardCanvasViewport(whiteboardId)
					: null;

			if (saved) {
				store.setViewport(saved);
				hasAutoFittedRef.current = true;
			}
			viewportRestoredRef.current = true;
		}

		if (hasAutoFittedRef.current) return;
		if (localMode) {
			hasAutoFittedRef.current = true;
			return;
		}

		if (initialElementCountRef.current === null) {
			initialElementCountRef.current = sync.elements.size;
		}
		if (sync.elements.size === 0) return;
		if (initialElementCountRef.current === 0) {
			hasAutoFittedRef.current = true;
			return;
		}

		const bounds = sync.scene.getCombinedBBox(sync.scene.getSortedElements());
		if (!bounds) return;

		fitViewportToBounds(bounds, 120);
		hasAutoFittedRef.current = true;
	}, [
		fitViewportToBounds,
		localMode,
		store,
		sync.elements.size,
		sync.isConnected,
		sync.scene,
		whiteboardId,
	]);

	useEffect(() => {
		if (!sync.isConnected) return;

		const timer = window.setTimeout(() => {
			if (localMode) {
				saveGuestCanvasViewport(store.viewport);
				return;
			}
			if (whiteboardId) {
				saveBoardCanvasViewport(whiteboardId, store.viewport);
			}
		}, 300);

		return () => window.clearTimeout(timer);
	}, [localMode, store.viewport, sync.isConnected, whiteboardId]);

	useEffect(() => {
		if (!focusCanvasPointRef) return;

		focusCanvasPointRef.current = (canvasX, canvasY) => {
			const svg = svgRef.current;
			if (!svg) return;

			const rect = svg.getBoundingClientRect();
			const zoom = Math.max(store.viewport.zoom, 0.5);
			if (zoom !== store.viewport.zoom) {
				store.setViewport({ ...store.viewport, zoom });
			}

			store.setViewport({
				x: rect.width / 2 - canvasX * zoom,
				y: rect.height / 2 - canvasY * zoom,
				zoom,
			});
		};

		return () => {
			focusCanvasPointRef.current = null;
		};
	}, [focusCanvasPointRef, store, svgRef]);

	useEffect(() => {
		if (!presentationMode || !presentationShareToken || !sync.isReadonly)
			return;

		const presenter = [...sync.remotePresence]
			.filter((peer) => peer.canWrite)
			.sort((left, right) => right.updatedAt - left.updatedAt)[0];

		if (!presenter) return;

		if (presenter.viewport) {
			if (
				!areViewportsEqual(
					lastFollowedPresenterViewportRef.current,
					presenter.viewport,
				)
			) {
				lastFollowedPresenterViewportRef.current = presenter.viewport;
				store.setViewport(presenter.viewport);
			}
		}

		if (
			presenter.activeViewId &&
			presenter.activeViewId !== lastFollowedPresenterViewIdRef.current
		) {
			const view = sync.views.get(presenter.activeViewId);
			if (view) {
				lastFollowedPresenterViewIdRef.current = presenter.activeViewId;
				setActiveViewId(presenter.activeViewId);
				fitViewportToBounds(view);
			}
		}
	}, [
		fitViewportToBounds,
		presentationMode,
		presentationShareToken,
		store,
		sync.isReadonly,
		sync.remotePresence,
		sync.views,
		setActiveViewId,
	]);
}
