import {
	type CanvasElement,
	type CanvasScene,
	type CanvasSearchMatch,
	MAX_ZOOM,
	MIN_ZOOM,
	type Viewport,
	findCanvasSearchMatches,
} from "@skedra/canvas-core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UseCanvasSearchOptions {
	open: boolean;
	elements: Map<string, CanvasElement>;
	scene: CanvasScene;
	viewport: Viewport;
	viewportSize: { width: number; height: number };
	onViewportChange: (viewport: Viewport) => void;
}

function isMatchComfortablyVisible(
	element: CanvasElement,
	scene: CanvasScene,
	viewport: Viewport,
	viewportSize: { width: number; height: number },
): boolean {
	const bounds = scene.getElementBBox(element);
	const margin = Math.min(80, viewportSize.width * 0.1);
	const left = viewport.x + bounds.x * viewport.zoom;
	const top = viewport.y + bounds.y * viewport.zoom;
	const right = left + bounds.width * viewport.zoom;
	const bottom = top + bounds.height * viewport.zoom;
	const readableText =
		(element.fontSize ?? 16) * viewport.zoom >= 14 || viewport.zoom >= 1.5;
	return (
		left >= margin &&
		top >= margin &&
		right <= viewportSize.width - margin &&
		bottom <= viewportSize.height - margin &&
		readableText
	);
}

function getFocusedViewport(
	element: CanvasElement,
	scene: CanvasScene,
	viewport: Viewport,
	viewportSize: { width: number; height: number },
): Viewport {
	const bounds = scene.getElementBBox(element);
	const availableWidth = Math.max(viewportSize.width - 240, 1);
	const availableHeight = Math.max(viewportSize.height - 200, 1);
	const fitZoom = Math.min(
		availableWidth / Math.max(bounds.width, 1),
		availableHeight / Math.max(bounds.height, 1),
	);
	let zoom = Math.min(viewport.zoom, fitZoom);
	const readableZoom = 14 / Math.max(element.fontSize ?? 16, 1);
	if (
		bounds.width * viewport.zoom <= availableWidth &&
		bounds.height * viewport.zoom <= availableHeight
	) {
		zoom = Math.max(viewport.zoom, readableZoom);
	}
	zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(1.5, zoom)));

	return {
		x: viewportSize.width / 2 - (bounds.x + bounds.width / 2) * zoom,
		y: viewportSize.height / 2 - (bounds.y + bounds.height / 2) * zoom,
		zoom,
	};
}

export function useCanvasSearch({
	open,
	elements,
	scene,
	viewport,
	viewportSize,
	onViewportChange,
}: UseCanvasSearchOptions) {
	const [query, setQueryState] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const focusedMatchRef = useRef<string | null>(null);
	const matches = useMemo(
		() => (open ? findCanvasSearchMatches(elements.values(), query) : []),
		[elements, open, query],
	);
	const activeMatch: CanvasSearchMatch | null =
		matches[activeIndex] ?? matches[0] ?? null;

	const setQuery = useCallback((value: string) => {
		setQueryState(value);
		setActiveIndex(0);
	}, []);

	useEffect(() => {
		if (matches.length === 0) {
			setActiveIndex(0);
			return;
		}
		setActiveIndex((index) => Math.min(index, matches.length - 1));
	}, [matches.length]);

	useEffect(() => {
		if (!open) {
			focusedMatchRef.current = null;
			return;
		}
		if (!activeMatch || viewportSize.width <= 0 || viewportSize.height <= 0) {
			return;
		}
		const focusKey = `${query}:${activeMatch.key}`;
		if (focusedMatchRef.current === focusKey) return;
		const element = elements.get(activeMatch.elementId);
		if (!element) return;
		focusedMatchRef.current = focusKey;
		if (isMatchComfortablyVisible(element, scene, viewport, viewportSize))
			return;
		const focusedViewport = getFocusedViewport(
			element,
			scene,
			viewport,
			viewportSize,
		);
		if (
			focusedViewport.x !== viewport.x ||
			focusedViewport.y !== viewport.y ||
			focusedViewport.zoom !== viewport.zoom
		) {
			onViewportChange(focusedViewport);
		}
	}, [
		activeMatch,
		elements,
		onViewportChange,
		open,
		query,
		scene,
		viewport,
		viewportSize,
	]);

	const goToNext = useCallback(() => {
		if (matches.length === 0) return;
		setActiveIndex((index) => (index + 1) % matches.length);
	}, [matches.length]);

	const goToPrevious = useCallback(() => {
		if (matches.length === 0) return;
		setActiveIndex((index) => (index - 1 + matches.length) % matches.length);
	}, [matches.length]);

	return {
		query,
		setQuery,
		matches,
		activeIndex: matches.length > 0 ? activeIndex : null,
		setActiveIndex,
		goToNext,
		goToPrevious,
	};
}
