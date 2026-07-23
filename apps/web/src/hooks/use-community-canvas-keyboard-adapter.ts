/**
 * Keyboard-Shortcuts und Clipboard-Verwaltung fuer das Canvas.
 */

import { isTextEditableElement } from "@/components/canvas/hooks/use-canvas-text-editing";
import { isFlowchartNode, isMindmapNode } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import {
	useCanvasEditorClipboard,
	useCanvasEditorKeyboard,
} from "@skedra/canvas-editor";
import type { CanvasKeyboardActions } from "./use-canvas-keyboard/context";
import { useCanvasKeyboardOperations } from "./use-canvas-keyboard/operations";
import { useCanvasStore, useCanvasStoreRef } from "./use-canvas-store";

interface UseCommunityCanvasKeyboardAdapterOptions {
	enabled?: boolean;
	readOnly?: boolean;
	editingText?: boolean;
	elements: Map<string, CanvasElement>;
	createElement: (el: CanvasElement) => void;
	deleteElements: (ids: string[]) => void;
	updateElements: (
		updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
	) => void;
	getPastePoint?: () => { x: number; y: number };
	undo: () => void;
	redo: () => void;
	actions?: CanvasKeyboardActions;
}

export function useCommunityCanvasKeyboardAdapter({
	enabled = true,
	readOnly = false,
	editingText = false,
	elements,
	createElement,
	deleteElements,
	updateElements,
	getPastePoint,
	undo,
	redo,
	actions,
}: UseCommunityCanvasKeyboardAdapterOptions) {
	const storeRef = useCanvasStoreRef();
	const ops = useCanvasKeyboardOperations({
		elements,
		createElement,
		deleteElements,
		updateElements,
		getPastePoint,
	});

	const getClipboardState = () => ({
		enabled,
		readOnly,
		editingText: editingText || storeRef.current.editingTextId != null,
		hasSelection: storeRef.current.selectedIds.size > 0,
	});
	useCanvasEditorClipboard({
		getState: getClipboardState,
		onCopy: (dataTransfer) => ops.copySelection(dataTransfer).length > 0,
		onCut: (dataTransfer) => ops.cutSelection(dataTransfer).length > 0,
		onPaste: (dataTransfer) => {
			if (ops.pasteDataTransferFromClipboard(dataTransfer)) return true;
			if (ops.clipboardRef.current.length === 0) return false;
			ops.pasteClipboard();
			return true;
		},
	});

	useCanvasEditorKeyboard({
		getState: getClipboardState,
		onEditorAction: (action) => {
			const store = storeRef.current;
			if (action.type === "command") {
				if (
					action.command === "copy" ||
					action.command === "cut" ||
					action.command === "paste"
				) {
					return false;
				}
				if (action.command === "duplicate") ops.duplicateSelection();
				else if (action.command === "bring-forward") ops.bringForward();
				else if (action.command === "send-backward") ops.sendBackward();
				else if (action.command === "bring-to-front") ops.bringToFront();
				else if (action.command === "send-to-back") ops.sendToBack();
				else if (action.command === "flip-horizontal") ops.flipHorizontal();
				else if (action.command === "flip-vertical") ops.flipVertical();
				else if (action.command === "toggle-lock") ops.toggleLock();
				else if (action.command === "group") ops.groupSelection();
				else if (action.command === "ungroup") ops.ungroupSelection();
				else return false;
				return true;
			}
			if (action.type === "tool") {
				store.setActiveTool(action.tool);
				return true;
			}
			if (action.type === "toggle-tool-lock") {
				store.toggleToolLocked();
				return true;
			}
			if (action.type === "toggle-object-snap") {
				store.toggleSnapToObjects();
				return true;
			}
			if (action.type === "insert-image") {
				void actions?.insertImage?.();
				return true;
			}
			if (action.type === "open-help") {
				actions?.openHelp?.();
				return true;
			}
			if (action.type === "open-command-palette") {
				actions?.openCommandPalette?.();
				return true;
			}
			if (action.type === "open-canvas-search") {
				actions?.openCanvasSearch?.();
				return true;
			}
			if (action.type === "focus-property") {
				store.requestPropertyFocus(action.property);
				return true;
			}
			if (action.type === "eyedropper") {
				store.activateEyedropper(action.target);
				return true;
			}
			if (action.type === "paste-plain-text") {
				void navigator.clipboard.readText().then((text) => {
					if (text.trim()) actions?.pastePlainText?.(text);
				});
				return true;
			}
			if (action.type === "copy-canvas-as-png") {
				void actions?.copyCanvasAsPng?.();
				return true;
			}
			if (action.type === "copy-format") {
				ops.copyFormat();
				return true;
			}
			if (action.type === "paste-format") {
				ops.pasteFormat();
				return true;
			}
			if (action.type === "add-link") {
				ops.addLink();
				return true;
			}
			if (action.type === "adjust-font-size") {
				ops.adjustFontSize(action.delta);
				return true;
			}
			if (action.type === "align") {
				ops.alignSelection(action.edge);
				return true;
			}
			if (action.type === "flowchart-create") {
				actions?.flowchartCreateStep?.(action.direction);
				return true;
			}
			if (action.type === "flowchart-navigate") {
				actions?.flowchartNavigate?.(action.direction);
				return true;
			}
			if (action.type === "zoom") {
				store.zoomTo(
					store.viewport.zoom * action.factor,
					window.innerWidth / 2,
					window.innerHeight / 2,
				);
				return true;
			}
			if (action.type === "reset-zoom") {
				actions?.resetZoom?.();
				return true;
			}
			if (action.type === "fit") {
				if (action.target === "all") actions?.fitAll?.();
				else actions?.fitSelection?.();
				return true;
			}
			if (action.type === "pan-viewport") {
				store.pan(action.x, action.y);
				return true;
			}
			if (action.type === "toggle-theme") {
				actions?.toggleTheme?.();
				return true;
			}
			if (action.type === "toggle-zen") {
				store.toggleZenMode();
				return true;
			}
			if (action.type === "toggle-grid") {
				store.toggleGrid();
				return true;
			}
			if (action.type === "activate-selection") {
				const selected = ops.getSelected();
				if (selected.length !== 1) return false;
				const [element] = selected;
				if (element.type === "image") actions?.startImageCrop?.();
				else if (isFlowchartNode(element)) {
					actions?.flowchartCreateDefaultStep?.(element.id);
				} else if (isMindmapNode(element)) {
					actions?.mindmapCreateSibling?.(element.id);
				} else if (isTextEditableElement(element)) ops.startEditingSelection();
				else return false;
				return true;
			}
			return false;
		},
		onCommand: (command) => {
			const store = storeRef.current;
			if (command === "clear-canvas") {
				actions?.requestClearCanvas?.();
				return true;
			}
			if (command === "delete-selection") {
				if (store.selectedIds.size > 0) {
					deleteElements(Array.from(store.selectedIds));
					store.clearSelection();
				}
				return true;
			}
			if (command === "undo") {
				undo();
				return true;
			}
			if (command === "redo") {
				redo();
				return true;
			}
			if (command === "select-all") {
				store.setSelectedIds(new Set(elements.keys()));
				return true;
			}
			if (command === "escape") {
				if (store.croppingImageId) store.setCroppingImageId(null);
				else {
					store.clearSelection();
					store.setActiveTool("select");
					store.setContextMenu(null);
					store.setSnapMenu(null);
					store.setSnapOverrideMode(null);
				}
				return true;
			}
			return false;
		},
		setTemporaryPan: (pressed) =>
			useCanvasStore.getState().setSpacePressed(pressed),
	});

	return {
		clipboardRef: ops.clipboardRef,
		formatClipboardRef: ops.formatClipboardRef,
		copySelection: ops.copySelection,
		pasteClipboard: ops.pasteFromClipboard,
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
		rotateSelection: ops.rotateSelection,
		copyMirrorSelection: ops.copyMirrorSelection,
		copyRotateSelection: ops.copyRotateSelection,
		addLink: ops.addLink,
		toggleLock: ops.toggleLock,
		embedInFrame: ops.embedInFrame,
		removeFromFrame: ops.removeFromFrame,
		groupSelection: ops.groupSelection,
		ungroupSelection: ops.ungroupSelection,
		alignSelection: ops.alignSelection,
		distributeSelection: ops.distributeSelection,
	};
}
