import type { BBox } from "@skedra/canvas-core";

export interface CanvasEditorSavedViewDraftProps {
	bounds: BBox;
	zoom: number;
}

export function CanvasEditorSavedViewDraft({
	bounds,
	zoom,
}: CanvasEditorSavedViewDraftProps) {
	return (
		<rect
			data-ui-only="true"
			data-skedra-ui="saved-view-draft"
			x={bounds.x}
			y={bounds.y}
			width={bounds.width}
			height={bounds.height}
			fill="rgba(16, 185, 129, 0.12)"
			stroke="rgba(16, 185, 129, 0.9)"
			strokeWidth={1.5 / zoom}
			strokeDasharray={`${5 / zoom}`}
		/>
	);
}
