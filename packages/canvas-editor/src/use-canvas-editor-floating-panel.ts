import {
	type CSSProperties,
	type HTMLAttributes,
	type PointerEvent as ReactPointerEvent,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

export interface CanvasEditorFloatingPanelOffset {
	x: number;
	y: number;
}

export interface CanvasEditorFloatingPanelRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface UseCanvasEditorFloatingPanelOptions {
	disabled?: boolean;
	boundarySelector?: string;
	margin?: number;
}

export type CanvasEditorFloatingPanelDragHandleProps =
	HTMLAttributes<HTMLElement> & {
		"data-panel-drag-handle": "true";
		"data-dragging"?: "true";
	};

/** Keeps a translated panel inside its canvas boundary. Exported for hosts/tests. */
export function clampCanvasEditorFloatingPanelOffset(
	offset: CanvasEditorFloatingPanelOffset,
	panel: CanvasEditorFloatingPanelRect,
	boundary: CanvasEditorFloatingPanelRect,
	margin = 8,
): CanvasEditorFloatingPanelOffset {
	const baseLeft = panel.left - offset.x;
	const baseTop = panel.top - offset.y;
	const availableWidth = Math.max(0, boundary.width - margin * 2);
	const availableHeight = Math.max(0, boundary.height - margin * 2);
	const minX = boundary.left + margin - baseLeft;
	const maxX = boundary.left + boundary.width - margin - panel.width - baseLeft;
	const minY = boundary.top + margin - baseTop;
	const maxY = boundary.top + boundary.height - margin - panel.height - baseTop;

	return {
		x:
			panel.width > availableWidth
				? minX
				: Math.min(maxX, Math.max(minX, offset.x)),
		y:
			panel.height > availableHeight
				? minY
				: Math.min(maxY, Math.max(minY, offset.y)),
	};
}

type DragState = {
	pointerId: number;
	startX: number;
	startY: number;
	startOffset: CanvasEditorFloatingPanelOffset;
	panelRect: CanvasEditorFloatingPanelRect;
	boundaryRect: CanvasEditorFloatingPanelRect;
};

const INTERACTIVE_SELECTOR =
	'button, input, select, textarea, a, [role="button"], [role="tab"], [contenteditable="true"]';

function toRect(rect: DOMRect): CanvasEditorFloatingPanelRect {
	return {
		left: rect.left,
		top: rect.top,
		width: rect.width,
		height: rect.height,
	};
}

/**
 * Adds mouse, pen and touch dragging to a floating editor panel. Dragging starts
 * only on non-interactive parts of the supplied header props, so its buttons
 * and form fields retain their normal behavior.
 */
export function useCanvasEditorFloatingPanel<
	T extends HTMLElement = HTMLElement,
>(
	options: UseCanvasEditorFloatingPanelOptions = {},
): {
	panelRef: RefObject<T | null>;
	panelStyle: CSSProperties;
	dragHandleProps: CanvasEditorFloatingPanelDragHandleProps;
	isDragging: boolean;
} {
	const {
		disabled = false,
		boundarySelector = ".canvas-editor",
		margin = 8,
	} = options;
	const panelRef = useRef<T | null>(null);
	const dragRef = useRef<DragState | null>(null);
	const offsetRef = useRef<CanvasEditorFloatingPanelOffset>({ x: 0, y: 0 });
	const [offset, setOffsetState] = useState(offsetRef.current);
	const [isDragging, setIsDragging] = useState(false);

	const setOffset = useCallback((next: CanvasEditorFloatingPanelOffset) => {
		offsetRef.current = next;
		setOffsetState(next);
	}, []);

	const resolveBoundary = useCallback(() => {
		const panel = panelRef.current;
		if (!panel) return null;
		return panel.closest<HTMLElement>(boundarySelector) ?? panel.parentElement;
	}, [boundarySelector]);

	const keepVisible = useCallback(() => {
		const panel = panelRef.current;
		const boundary = resolveBoundary();
		if (!panel || !boundary) return;
		const next = clampCanvasEditorFloatingPanelOffset(
			offsetRef.current,
			toRect(panel.getBoundingClientRect()),
			toRect(boundary.getBoundingClientRect()),
			margin,
		);
		if (next.x !== offsetRef.current.x || next.y !== offsetRef.current.y) {
			setOffset(next);
		}
	}, [margin, resolveBoundary, setOffset]);

	useEffect(() => {
		if (disabled) return;
		const panel = panelRef.current;
		const boundary = resolveBoundary();
		if (!panel || !boundary || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(keepVisible);
		observer.observe(panel);
		observer.observe(boundary);
		window.addEventListener("resize", keepVisible);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", keepVisible);
		};
	}, [disabled, keepVisible, resolveBoundary]);

	const onPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLElement>) => {
			if (disabled || event.button !== 0) return;
			const target = event.target as HTMLElement;
			if (target.closest(INTERACTIVE_SELECTOR)) return;
			const panel = panelRef.current;
			const boundary = resolveBoundary();
			if (!panel || !boundary) return;

			event.preventDefault();
			event.stopPropagation();
			event.currentTarget.setPointerCapture(event.pointerId);
			dragRef.current = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				startOffset: offsetRef.current,
				panelRect: toRect(panel.getBoundingClientRect()),
				boundaryRect: toRect(boundary.getBoundingClientRect()),
			};
			setIsDragging(true);
		},
		[disabled, resolveBoundary],
	);

	const onPointerMove = useCallback(
		(event: ReactPointerEvent<HTMLElement>) => {
			const drag = dragRef.current;
			if (!drag || drag.pointerId !== event.pointerId) return;
			event.preventDefault();
			event.stopPropagation();
			const candidate = {
				x: drag.startOffset.x + event.clientX - drag.startX,
				y: drag.startOffset.y + event.clientY - drag.startY,
			};
			setOffset(
				clampCanvasEditorFloatingPanelOffset(
					candidate,
					{
						...drag.panelRect,
						left: drag.panelRect.left + candidate.x - drag.startOffset.x,
						top: drag.panelRect.top + candidate.y - drag.startOffset.y,
					},
					drag.boundaryRect,
					margin,
				),
			);
		},
		[margin, setOffset],
	);

	const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
		if (dragRef.current?.pointerId !== event.pointerId) return;
		event.stopPropagation();
		dragRef.current = null;
		setIsDragging(false);
	}, []);

	return {
		panelRef,
		panelStyle: {
			translate: `${offset.x}px ${offset.y}px`,
		},
		dragHandleProps: {
			"data-panel-drag-handle": "true",
			"data-dragging": isDragging ? "true" : undefined,
			onPointerDown,
			onPointerMove,
			onPointerUp: endDrag,
			onPointerCancel: endDrag,
			onLostPointerCapture: endDrag,
			style: {
				cursor: isDragging ? "grabbing" : "grab",
				touchAction: "none",
				userSelect: "none",
			},
		},
		isDragging,
	};
}
