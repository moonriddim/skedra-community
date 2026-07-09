/**
 * Elemente hinzufuegen und passende Selektion setzen.
 */

import { useCanvasStoreRef } from "@/hooks/use-canvas-store";
import { isKanbanCard } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { useCallback } from "react";

interface UseCanvasAddElementsOptions {
	createElement: (el: CanvasElement) => void;
	setKanbanDetailId: (id: string | null) => void;
}

export function useCanvasAddElements({
	createElement,
	setKanbanDetailId,
}: UseCanvasAddElementsOptions) {
	const storeRef = useCanvasStoreRef();

	return useCallback(
		(newElements: CanvasElement[]) => {
			const store = storeRef.current;
			for (const el of newElements) createElement(el);

			if (newElements.length === 1) {
				const [singleElement] = newElements;
				store.setSelectedIds(new Set([singleElement.id]));
				if (singleElement.customData?.skedraType === "sticky-note") {
					store.setEditingTextId(singleElement.id);
				}
				if (isKanbanCard(singleElement)) {
					setKanbanDetailId(singleElement.id);
				}
			} else if (newElements.length > 1) {
				const firstList = newElements.find(
					(el) => el.customData?.skedraType === "kanban-list",
				);
				if (firstList) {
					store.setSelectedIds(new Set([firstList.id]));
				} else {
					const groupId = newElements[0]?.groupId;
					if (groupId && newElements.every((el) => el.groupId === groupId)) {
						store.setSelectedIds(new Set(newElements.map((el) => el.id)));
					}
				}
			}
		},
		[createElement, setKanbanDetailId, storeRef],
	);
}
