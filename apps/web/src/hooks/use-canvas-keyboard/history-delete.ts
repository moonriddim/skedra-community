/**
 * Undo/Redo, Loeschen, Selektion und Escape.
 */

import { getCanvasKeyboardCommand } from "@skedra/canvas-core";
import type { CanvasKeyDownContext } from "./context";
import { getKeyModifiers } from "./context";

export function tryHandleHistoryAndDelete(
	e: KeyboardEvent,
	ctx: CanvasKeyDownContext,
): boolean {
	const { ctrl, shift, alt } = getKeyModifiers(e);
	const { store, deleteElements, undo, redo, actions } = ctx;
	const command = getCanvasKeyboardCommand({
		key: e.key,
		ctrlKey: ctrl,
		metaKey: false,
		shiftKey: shift,
		altKey: alt,
	});

	if (command === "clear-canvas") {
		e.preventDefault();
		actions?.requestClearCanvas?.();
		return true;
	}

	if (command === "delete-selection") {
		if (store.selectedIds.size > 0) {
			e.preventDefault();
			deleteElements(Array.from(store.selectedIds));
			store.clearSelection();
		}
		return true;
	}

	if (command === "undo") {
		e.preventDefault();
		undo();
		return true;
	}
	if (command === "redo") {
		e.preventDefault();
		redo();
		return true;
	}

	if (command === "select-all") {
		e.preventDefault();
		store.setSelectedIds(new Set(ctx.elements.keys()));
		return true;
	}

	if (command === "escape") {
		if (store.croppingImageId) {
			store.setCroppingImageId(null);
			return true;
		}
		store.clearSelection();
		store.setActiveTool("select");
		store.setContextMenu(null);
		return true;
	}

	return false;
}
