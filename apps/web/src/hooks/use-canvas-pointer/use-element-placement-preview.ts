import {
	type CanvasEditorElementPlacementPreviewOptions,
	useCanvasEditorElementPlacementPreview,
} from "@skedra/canvas-editor";
import { useCanvasStore } from "../use-canvas-store";

const getDraft = () => useCanvasStore.getState().elementPlacementDraft;
const clearDraft = () => useCanvasStore.getState().clearElementPlacementDraft();
const onCancel = () => {
	clearDraft();
	useCanvasStore.getState().setSnapVisuals([], []);
};

export function useElementPlacementPreview(
	resolvePlacement: CanvasEditorElementPlacementPreviewOptions["resolvePlacement"],
	readOnly: boolean,
) {
	const draft = useCanvasStore((state) => state.elementPlacementDraft);
	const viewport = useCanvasStore((state) => state.viewport);
	return useCanvasEditorElementPlacementPreview({
		draft,
		viewport,
		readOnly,
		resolvePlacement,
		getDraft,
		clearDraft,
		onCancel,
	});
}
