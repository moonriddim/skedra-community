import {
	type CanvasElement,
	type Viewport,
	getEllipseAngleAtPoint,
	getRetainedEllipseArcAngles,
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

export interface CanvasEditorEllipseTrimPreview {
	element: CanvasElement;
	firstAngle: number;
	secondAngle: number;
	preferLongArc: boolean;
}

interface EllipseTrimDraft {
	elementId: string;
	firstAngle: number;
	secondAngle: number;
	preferLongArc: boolean;
}

interface UseEllipseTrimOptions {
	svgRef: RefObject<SVGSVGElement | null>;
	viewport: Viewport;
	elements: Map<string, CanvasElement>;
	updateElement: (id: string, updates: Partial<CanvasElement>) => void;
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

/** Two-point CAD-style trim interaction for circles and ellipses. */
export function useCanvasEditorEllipseTrim({
	svgRef,
	viewport,
	elements,
	updateElement,
	onActivate,
}: UseEllipseTrimOptions) {
	const [draft, setDraft] = useState<EllipseTrimDraft | null>(null);
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
			if (!svg || element.type !== "ellipse" || element.locked) return;
			const canvasPoint = clientPointToCanvas(
				svg,
				viewport,
				point.clientX,
				point.clientY,
			);
			const firstAngle = getEllipseAngleAtPoint(element, canvasPoint);
			onActivate();
			setDraft({
				elementId: element.id,
				firstAngle,
				secondAngle: firstAngle,
				preferLongArc: false,
			});
		},
		[onActivate, svgRef, viewport],
	);

	const handlePointerMove = useCallback(
		(event: ReactPointerEvent<SVGSVGElement>) => {
			if (!draft) return false;
			const svg = svgRef.current;
			const element = elements.get(draft.elementId);
			if (!svg || element?.type !== "ellipse") {
				cancel();
				return true;
			}
			const canvasPoint = clientPointToCanvas(
				svg,
				viewport,
				event.clientX,
				event.clientY,
			);
			const secondAngle = getEllipseAngleAtPoint(element, canvasPoint);
			setDraft((current) =>
				current
					? {
							...current,
							secondAngle,
							preferLongArc: event.shiftKey,
						}
					: null,
			);
			event.preventDefault();
			return true;
		},
		[cancel, draft, elements, svgRef, viewport],
	);

	const handlePointerDown = useCallback(
		(event: ReactPointerEvent<SVGSVGElement>) => {
			if (!draft || event.button !== 0) return false;
			event.preventDefault();
			event.stopPropagation();
			consumedPointerIdRef.current = event.pointerId;
			const svg = svgRef.current;
			const element = elements.get(draft.elementId);
			if (!svg || element?.type !== "ellipse") {
				cancel();
				return true;
			}
			const canvasPoint = clientPointToCanvas(
				svg,
				viewport,
				event.clientX,
				event.clientY,
			);
			const secondAngle = getEllipseAngleAtPoint(element, canvasPoint);
			const arc = getRetainedEllipseArcAngles(
				draft.firstAngle,
				secondAngle,
				event.shiftKey,
			);
			if (!arc) return true;
			updateElement(element.id, {
				arcStartAngle: arc.startAngle,
				arcEndAngle: arc.endAngle,
			});
			setDraft(null);
			return true;
		},
		[cancel, draft, elements, svgRef, updateElement, viewport],
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

	const preview = useMemo<CanvasEditorEllipseTrimPreview | null>(() => {
		if (!draft) return null;
		const element = elements.get(draft.elementId);
		if (element?.type !== "ellipse") return null;
		return {
			element,
			firstAngle: draft.firstAngle,
			secondAngle: draft.secondAngle,
			preferLongArc: draft.preferLongArc,
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
