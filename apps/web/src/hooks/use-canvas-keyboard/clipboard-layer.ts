/**
 * Clipboard, Ebenen, Spiegeln, Gruppierung und Format.
 */

import type { CanvasKeyDownContext } from "./context";
import { getKeyModifiers } from "./context";

export function tryHandleClipboardAndLayer(
	e: KeyboardEvent,
	ctx: CanvasKeyDownContext,
): boolean {
	const { ctrl, shift, alt } = getKeyModifiers(e);
	const { store, ops, actions } = ctx;

	if (ctrl && e.key === "c" && !alt) {
		ops.copySelection();
		return true;
	}
	if (ctrl && shift && e.key === "V") {
		e.preventDefault();
		void navigator.clipboard.readText().then((text) => {
			if (text.trim()) actions?.pastePlainText?.(text);
		});
		return true;
	}
	if (ctrl && e.key === "v" && !alt && !shift) {
		e.preventDefault();
		ops.pasteClipboard();
		return true;
	}
	if (ctrl && e.key === "x" && !alt) {
		e.preventDefault();
		ops.cutSelection();
		return true;
	}
	if (ctrl && e.key === "d" && !alt) {
		e.preventDefault();
		ops.duplicateSelection();
		return true;
	}

	if (ctrl && alt && e.key === "c") {
		e.preventDefault();
		ops.copyFormat();
		return true;
	}
	if (ctrl && alt && e.key === "v") {
		e.preventDefault();
		ops.pasteFormat();
		return true;
	}

	if (ctrl && e.key === "]" && !shift) {
		e.preventDefault();
		ops.bringForward();
		return true;
	}
	if (ctrl && e.key === "[" && !shift) {
		e.preventDefault();
		ops.sendBackward();
		return true;
	}
	if (ctrl && e.key === "]" && shift) {
		e.preventDefault();
		ops.bringToFront();
		return true;
	}
	if (ctrl && e.key === "[" && shift) {
		e.preventDefault();
		ops.sendToBack();
		return true;
	}

	if (shift && !ctrl && !alt && e.key === "H") {
		e.preventDefault();
		ops.flipHorizontal();
		return true;
	}
	if (shift && !ctrl && !alt && e.key === "V") {
		e.preventDefault();
		ops.flipVertical();
		return true;
	}

	if (ctrl && e.key === "k") {
		e.preventDefault();
		ops.addLink();
		return true;
	}

	if (ctrl && shift && (e.key === "l" || e.key === "L")) {
		e.preventDefault();
		ops.toggleLock();
		return true;
	}

	if (alt && !ctrl && !shift && e.key === "s") {
		e.preventDefault();
		store.toggleSnapToObjects();
		return true;
	}

	if (ctrl && !shift && e.key === "g") {
		e.preventDefault();
		ops.groupSelection();
		return true;
	}
	if (ctrl && shift && (e.key === "g" || e.key === "G")) {
		e.preventDefault();
		ops.ungroupSelection();
		return true;
	}

	if (ctrl && shift && (e.key === "<" || e.code === "Comma")) {
		e.preventDefault();
		ops.adjustFontSize(-2);
		return true;
	}
	if (ctrl && shift && (e.key === ">" || e.code === "Period")) {
		e.preventDefault();
		ops.adjustFontSize(2);
		return true;
	}

	return false;
}
