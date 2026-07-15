/**
 * Ebenen-Panel (Web-Adapter): duenner Wrapper um das geteilte
 * CanvasEditorLayerPanel aus canvas-editor. Alle Stapel-Operationen
 * kommen aus canvas-core (buildLayerReorderUpdates).
 */

import { useCanvasStore } from "@/hooks/use-canvas-store";
import { useI18n } from "@/lib/i18n";
import type { CanvasElement } from "@skedra/canvas-core";
import { buildLayerReorderUpdates } from "@skedra/canvas-core";
import {
	CanvasEditorLayerPanel,
	type CanvasEditorLayerReorderPosition,
} from "@skedra/canvas-editor";
import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";

interface LayersPanelProps {
	elements: Map<string, CanvasElement>;
	updateElement: (id: string, changes: Partial<CanvasElement>) => void;
	updateElements: (
		updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
	) => void;
	onClose: () => void;
}

export function LayersPanel({
	elements,
	updateElement,
	updateElements,
	onClose,
}: LayersPanelProps) {
	const { t } = useI18n();
	const store = useCanvasStore(
		useShallow((state) => ({
			selectedIds: state.selectedIds,
			setSelectedIds: state.setSelectedIds,
			toggleSelection: state.toggleSelection,
		})),
	);

	const handleSelect = useCallback(
		(id: string, additive: boolean) => {
			if (additive) store.toggleSelection(id);
			else store.setSelectedIds(new Set([id]));
		},
		[store],
	);

	const handleReorder = useCallback(
		(
			movedId: string,
			targetId: string,
			position: CanvasEditorLayerReorderPosition,
		) => {
			const updates = buildLayerReorderUpdates(
				elements.values(),
				movedId,
				targetId,
				position,
			);
			if (updates.length > 0) updateElements(updates);
		},
		[elements, updateElements],
	);

	return (
		<CanvasEditorLayerPanel
			elements={elements}
			selectedIds={store.selectedIds}
			translate={(key, fallback, params) => {
				const translated = t(key, params);
				return translated === key ? fallback : translated;
			}}
			onSelect={handleSelect}
			onToggleLock={(id, locked) => updateElement(id, { locked })}
			onReorder={handleReorder}
			onRenameFrame={(id, label) => updateElement(id, { frameLabel: label })}
			onClose={onClose}
		/>
	);
}
