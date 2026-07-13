/**
 * Keyboard-Shortcuts und Clipboard-Verwaltung fuer das Canvas.
 */

import type { CanvasElement } from "@skedra/canvas-core";
import { useCallback, useEffect } from "react";
import type { CanvasKeyboardActions } from "./use-canvas-keyboard/context";
import { handleCanvasKeyDown } from "./use-canvas-keyboard/handle-keydown";
import { useCanvasKeyboardOperations } from "./use-canvas-keyboard/operations";
import { useCanvasStore, useCanvasStoreRef } from "./use-canvas-store";

interface UseCanvasKeyboardOptions {
	enabled?: boolean;
	elements: Map<string, CanvasElement>;
	createElement: (el: CanvasElement) => void;
	deleteElements: (ids: string[]) => void;
	updateElements: (
		updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
	) => void;
	undo: () => void;
	redo: () => void;
	actions?: CanvasKeyboardActions;
}

export function useCanvasKeyboard({
	enabled = true,
	elements,
	createElement,
	deleteElements,
	updateElements,
	undo,
	redo,
	actions,
}: UseCanvasKeyboardOptions) {
	const storeRef = useCanvasStoreRef();
	const ops = useCanvasKeyboardOperations({
		elements,
		createElement,
		deleteElements,
		updateElements,
	});

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			handleCanvasKeyDown(e, {
				store: storeRef.current,
				elements,
				deleteElements,
				undo,
				redo,
				actions,
				ops,
			});
		},
		[storeRef, elements, deleteElements, undo, redo, actions, ops],
	);

	const handleKeyUp = useCallback((e: KeyboardEvent) => {
		if (e.key === " ") {
			useCanvasStore.getState().setSpacePressed(false);
		}
	}, []);

	useEffect(() => {
		if (!enabled) return;
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, [enabled, handleKeyDown, handleKeyUp]);

	return {
		clipboardRef: ops.clipboardRef,
		formatClipboardRef: ops.formatClipboardRef,
		copySelection: ops.copySelection,
		pasteClipboard: ops.pasteClipboard,
		cutSelection: ops.cutSelection,
		duplicateSelection: ops.duplicateSelection,
		copyFormat: ops.copyFormat,
		pasteFormat: ops.pasteFormat,
		bringForward: ops.bringForward,
		sendBackward: ops.sendBackward,
		bringToFront: ops.bringToFront,
		sendToBack: ops.sendToBack,
		flipHorizontal: ops.flipHorizontal,
		flipVertical: ops.flipVertical,
		addLink: ops.addLink,
		toggleLock: ops.toggleLock,
		embedInFrame: ops.embedInFrame,
		removeFromFrame: ops.removeFromFrame,
		groupSelection: ops.groupSelection,
		ungroupSelection: ops.ungroupSelection,
	};
}
