import {
	type CanvasElement,
	type ElementPlacementDraft,
	type Viewport,
	placeElementDraft,
} from "@skedra/canvas-core";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

export interface CanvasEditorElementPlacementPreviewOptions {
	draft: ElementPlacementDraft | null;
	viewport: Viewport;
	readOnly: boolean;
	getDraft: () => ElementPlacementDraft | null;
	clearDraft: () => void;
	onCancel: () => void;
	resolvePlacement: (
		x: number,
		y: number,
		width: number,
		height: number,
	) => { centerX: number; centerY: number };
}

export function useCanvasEditorElementPlacementPreview({
	draft,
	viewport,
	readOnly,
	getDraft,
	clearDraft,
	onCancel,
	resolvePlacement,
}: CanvasEditorElementPlacementPreviewOptions) {
	const pointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
	const [preview, setPreview] = useState<CanvasElement[] | null>(null);
	const updatePreview = useCallback(() => {
		const current = getDraft();
		const pointer = pointerRef.current;
		if (!current || !pointer || readOnly) return;
		const { centerX, centerY } = resolvePlacement(
			pointer.clientX,
			pointer.clientY,
			current.bounds.width,
			current.bounds.height,
		);
		setPreview(placeElementDraft(current, centerX, centerY));
	}, [readOnly, resolvePlacement, getDraft]);

	useEffect(() => {
		const trackPointer = (event: PointerEvent) => {
			pointerRef.current = { clientX: event.clientX, clientY: event.clientY };
		};
		const cancel = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || !getDraft()) return;
			event.preventDefault();
			event.stopPropagation();
			onCancel();
		};
		window.addEventListener("pointermove", trackPointer, true);
		window.addEventListener("pointerdown", trackPointer, true);
		window.addEventListener("keydown", cancel, true);
		return () => {
			window.removeEventListener("pointermove", trackPointer, true);
			window.removeEventListener("pointerdown", trackPointer, true);
			window.removeEventListener("keydown", cancel, true);
		};
	}, [getDraft, onCancel]);

	useEffect(() => () => clearDraft(), [clearDraft]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Pan and zoom must reposition the preview even when the pointer is stationary.
	useLayoutEffect(() => {
		if (readOnly) clearDraft();
		if (draft && !readOnly) updatePreview();
		else setPreview(null);
	}, [draft, viewport, readOnly, updatePreview, clearDraft]);

	return { preview: draft && !readOnly ? preview : null, updatePreview };
}
