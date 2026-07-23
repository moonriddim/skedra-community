import {
	type CanvasElement,
	type CanvasMutationPlan,
	type SnapAnchor,
	type Viewport,
	canTrimCanvasShape,
	findClosestCanvasShapeContourIntersection,
	getCanvasShapeTrimPositionAtPoint,
	isCanvasTrimmableShape,
	splitCanvasShapeElement,
} from "@skedra/canvas-core";
import {
	type PointerEvent as ReactPointerEvent,
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export interface CanvasEditorShapeTrimPreview {
	element: CanvasElement;
	firstPosition: number;
	secondPosition: number;
	preferLongPath: boolean;
	snapAnchor: SnapAnchor | null;
}

/** @deprecated Use CanvasEditorShapeTrimPreview. */
export type CanvasEditorEllipseTrimPreview = CanvasEditorShapeTrimPreview;

interface ShapeTrimDraft {
	elementId: string;
	firstPosition: number;
	secondPosition: number;
	preferLongPath: boolean;
	snapAnchor: SnapAnchor | null;
}

interface UseShapeTrimOptions {
	svgRef: RefObject<SVGSVGElement | null>;
	viewport: Viewport;
	elements: Map<string, CanvasElement>;
	snapToObjects?: boolean;
	createId: () => string;
	applyMutationPlan: (plan: CanvasMutationPlan) => void;
	onActivate: () => void;
}

function clientPointToCanvas(
	svg: SVGSVGElement,
	viewport: Viewport,
	clientX: number,
	clientY: number,
) {
	const rect = svg.getBoundingClientRect();
	return {
		x: (clientX - rect.left - viewport.x) / viewport.zoom,
		y: (clientY - rect.top - viewport.y) / viewport.zoom,
	};
}

/** Two-point CAD-style trim interaction for supported closed shapes. */
export function useCanvasEditorShapeTrim({
	svgRef,
	viewport,
	elements,
	snapToObjects = true,
	createId,
	applyMutationPlan,
	onActivate,
}: UseShapeTrimOptions) {
	const [draft, setDraft] = useState<ShapeTrimDraft | null>(null);
	const consumedPointerIdRef = useRef<number | null>(null);

	const cancel = useCallback(() => setDraft(null), []);

	const start = useCallback(
		(
			element: CanvasElement,
			point: {
				clientX: number;
				clientY: number;
			},
		) => {
			const svg = svgRef.current;
			if (!svg || !canTrimCanvasShape(element)) return;
			const canvasPoint = clientPointToCanvas(
				svg,
				viewport,
				point.clientX,
				point.clientY,
			);
			const snapAnchor = snapToObjects
				? findClosestCanvasShapeContourIntersection(
						element,
						elements,
						canvasPoint,
						14 / Math.max(viewport.zoom, 0.01),
					)
				: null;
			const firstPosition = getCanvasShapeTrimPositionAtPoint(
				element,
				snapAnchor ?? canvasPoint,
			);
			if (firstPosition === null) return;
			onActivate();
			setDraft({
				elementId: element.id,
				firstPosition,
				secondPosition: firstPosition,
				preferLongPath: false,
				snapAnchor,
			});
		},
		[elements, onActivate, snapToObjects, svgRef, viewport],
	);

	const handlePointerMove = useCallback(
		(event: ReactPointerEvent<SVGSVGElement>) => {
			if (!draft) return false;
			const svg = svgRef.current;
			const element = elements.get(draft.elementId);
			if (!svg || !element || !isCanvasTrimmableShape(element)) {
				cancel();
				return true;
			}
			const canvasPoint = clientPointToCanvas(
				svg,
				viewport,
				event.clientX,
				event.clientY,
			);
			const snapAnchor = snapToObjects
				? findClosestCanvasShapeContourIntersection(
						element,
						elements,
						canvasPoint,
						14 / Math.max(viewport.zoom, 0.01),
					)
				: null;
			const secondPosition = getCanvasShapeTrimPositionAtPoint(
				element,
				snapAnchor ?? canvasPoint,
			);
			if (secondPosition === null) return true;
			setDraft((current) =>
				current
					? {
							...current,
							secondPosition,
							preferLongPath: event.shiftKey,
							snapAnchor,
						}
					: null,
			);
			event.preventDefault();
			return true;
		},
		[cancel, draft, elements, snapToObjects, svgRef, viewport],
	);

	const handlePointerDown = useCallback(
		(event: ReactPointerEvent<SVGSVGElement>) => {
			if (!draft || event.button !== 0) return false;
			event.preventDefault();
			event.stopPropagation();
			consumedPointerIdRef.current = event.pointerId;
			const svg = svgRef.current;
			const element = elements.get(draft.elementId);
			if (!svg || !element || !isCanvasTrimmableShape(element)) {
				cancel();
				return true;
			}
			const canvasPoint = clientPointToCanvas(
				svg,
				viewport,
				event.clientX,
				event.clientY,
			);
			const snapAnchor = snapToObjects
				? findClosestCanvasShapeContourIntersection(
						element,
						elements,
						canvasPoint,
						14 / Math.max(viewport.zoom, 0.01),
					)
				: null;
			const secondPosition = getCanvasShapeTrimPositionAtPoint(
				element,
				snapAnchor ?? canvasPoint,
			);
			if (secondPosition === null) return true;
			const fragments = splitCanvasShapeElement(
				element,
				draft.firstPosition,
				secondPosition,
				createId,
				event.shiftKey,
			);
			if (!fragments) return true;
			const [primary, ...created] = fragments;
			if (!primary) return true;
			const { id: _primaryId, ...changes } = primary;
			applyMutationPlan({
				create: created,
				update: [{ id: element.id, changes }],
				deleteIds: [],
				selectedIds: [element.id],
			});
			setDraft(null);
			return true;
		},
		[
			applyMutationPlan,
			cancel,
			createId,
			draft,
			elements,
			snapToObjects,
			svgRef,
			viewport,
		],
	);

	const handlePointerUp = useCallback(
		(event: ReactPointerEvent<SVGSVGElement>) => {
			if (consumedPointerIdRef.current !== event.pointerId) return false;
			consumedPointerIdRef.current = null;
			event.preventDefault();
			event.stopPropagation();
			return true;
		},
		[],
	);

	const preview = useMemo<CanvasEditorShapeTrimPreview | null>(() => {
		if (!draft) return null;
		const element = elements.get(draft.elementId);
		if (!element || !isCanvasTrimmableShape(element)) return null;
		return {
			element,
			firstPosition: draft.firstPosition,
			secondPosition: draft.secondPosition,
			preferLongPath: draft.preferLongPath,
			snapAnchor: draft.snapAnchor,
		};
	}, [draft, elements]);

	useEffect(() => {
		if (!draft) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			cancel();
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [cancel, draft]);

	useEffect(() => {
		if (draft && !elements.has(draft.elementId)) cancel();
	}, [cancel, draft, elements]);

	return {
		active: draft !== null,
		preview,
		start,
		cancel,
		handlePointerMove,
		handlePointerDown,
		handlePointerUp,
	};
}

/** @deprecated Use useCanvasEditorShapeTrim. */
export const useCanvasEditorEllipseTrim = useCanvasEditorShapeTrim;
