/**
 * Undo/Redo, Loeschen, Selektion und Escape.
 */

import type { CanvasKeyDownContext } from "./context";
import { getKeyModifiers } from "./context";

export function tryHandleHistoryAndDelete(
	e: KeyboardEvent,
	ctx: CanvasKeyDownContext,
): boolean {
	const { ctrl, shift, alt } = getKeyModifiers(e);
	const { store, deleteElements, undo, redo, actions } = ctx;

	if (ctrl && (e.key === "Delete" || e.key === "Backspace")) {
		e.preventDefault();
		actions?.requestClearCanvas?.();
		return true;
	}

	if (e.key === "Delete" || e.key === "Backspace") {
		if (store.selectedIds.size > 0) {
			e.preventDefault();
			deleteElements(Array.from(store.selectedIds));
			store.clearSelection();
		}
		return true;
	}

	if (ctrl && e.key === "z" && !shift) {
		e.preventDefault();
		undo();
		return true;
	}
	if ((ctrl && e.key === "z" && shift) || (ctrl && e.key === "y")) {
		e.preventDefault();
		redo();
		return true;
	}

	if (ctrl && e.key === "a" && !shift && !alt) {
		e.preventDefault();
		store.setSelectedIds(new Set(ctx.elements.keys()));
		return true;
	}

	if (e.key === "Escape") {
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
