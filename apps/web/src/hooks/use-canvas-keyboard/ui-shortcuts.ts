/**
 * UI-Modi: Zen, Grid, Hilfe, Theme, Command Palette, Eigenschaften.
 */

import type { CanvasKeyDownContext } from "./context";
import { getKeyModifiers } from "./context";

export function tryHandleUiShortcuts(
	e: KeyboardEvent,
	ctx: CanvasKeyDownContext,
): boolean {
	const { ctrl, shift, alt } = getKeyModifiers(e);
	const { store, actions } = ctx;

	if (alt && shift && (e.key === "d" || e.key === "D")) {
		e.preventDefault();
		actions?.toggleTheme?.();
		return true;
	}

	if (alt && !ctrl && !shift && (e.key === "z" || e.key === "Z")) {
		e.preventDefault();
		store.toggleZenMode();
		return true;
	}

	if (ctrl && e.key === "/") {
		e.preventDefault();
		actions?.openCommandPalette?.();
		return true;
	}
	if (ctrl && shift && (e.key === "p" || e.key === "P")) {
		e.preventDefault();
		actions?.openCommandPalette?.();
		return true;
	}

	if (ctrl && e.key === "'") {
		e.preventDefault();
		store.toggleGrid();
		return true;
	}

	if (!ctrl && !alt && e.key === "?") {
		e.preventDefault();
		actions?.openHelp?.();
		return true;
	}
	if (!ctrl && !alt && !shift && e.key === "9") {
		e.preventDefault();
		void actions?.insertImage?.();
		return true;
	}
	if (shift && !ctrl && !alt && (e.key === "S" || e.key === "s")) {
		e.preventDefault();
		store.activateEyedropper("stroke");
		return true;
	}
	if (shift && !ctrl && !alt && (e.key === "G" || e.key === "g")) {
		e.preventDefault();
		store.activateEyedropper("fill");
		return true;
	}
	if (!ctrl && !alt && !shift && e.key === "s") {
		if (store.selectedIds.size > 0) {
			e.preventDefault();
			store.requestPropertyFocus("stroke");
		}
		return true;
	}
	if (!ctrl && !alt && !shift && e.key === "g") {
		if (store.selectedIds.size > 0) {
			e.preventDefault();
			store.requestPropertyFocus("fill");
		}
		return true;
	}
	if (shift && !ctrl && !alt && (e.key === "F" || e.key === "f")) {
		if (store.selectedIds.size > 0) {
			e.preventDefault();
			store.requestPropertyFocus("font");
		}
		return true;
	}

	return false;
}
