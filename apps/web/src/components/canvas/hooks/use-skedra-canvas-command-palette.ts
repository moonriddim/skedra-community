import {
	CANVAS_COMMAND_DEFINITIONS,
	type CanvasCommand,
	type CanvasCommandAvailability,
} from "@/components/canvas/canvas-command-registry";
import type { CanvasStoreState } from "@/hooks/use-canvas-store";
import type {
	AlignEdge,
	CanvasElement,
	DistributionAxis,
} from "@skedra/canvas-core";
import { useMemo } from "react";

interface CanvasCommandKeyboardOperations {
	clipboardRef: React.MutableRefObject<CanvasElement[]>;
	copySelection: () => void;
	cutSelection: () => void;
	pasteClipboard: () => void;
	duplicateSelection: () => void;
	bringForward: () => void;
	sendBackward: () => void;
	bringToFront: () => void;
	sendToBack: () => void;
	flipHorizontal: () => void;
	flipVertical: () => void;
	toggleLock: () => void;
	addLink: () => void;
	groupSelection: () => void;
	ungroupSelection: () => void;
	alignSelection: (edge: AlignEdge) => void;
	distributeSelection: (axis: DistributionAxis) => void;
}

interface UseSkedraCanvasCommandPaletteOptions {
	store: CanvasStoreState;
	elements: Map<string, CanvasElement>;
	keyboard: CanvasCommandKeyboardOperations;
	readOnly: boolean;
	canUndo: boolean;
	canRedo: boolean;
	undo: () => void;
	redo: () => void;
	deleteElements: (ids: string[]) => void;
	handleInsertImage: () => void | Promise<void>;
	handleFitViewport: () => void;
	handleFitSelection: () => void;
	handleRequestClearCanvas: () => void;
	setHelpDialogOpen: (open: boolean) => void;
}

function isCommandAvailable(
	availability: CanvasCommandAvailability,
	context: {
		readOnly: boolean;
		selectionCount: number;
		canPaste: boolean;
		canUndo: boolean;
		canRedo: boolean;
	},
): boolean {
	switch (availability) {
		case "always":
			return true;
		case "editable":
			return !context.readOnly;
		case "selection":
			return !context.readOnly && context.selectionCount > 0;
		case "selection-many":
			return !context.readOnly && context.selectionCount > 1;
		case "selection-three":
			return !context.readOnly && context.selectionCount > 2;
		case "can-paste":
			return !context.readOnly && context.canPaste;
		case "can-undo":
			return !context.readOnly && context.canUndo;
		case "can-redo":
			return !context.readOnly && context.canRedo;
	}
}

export function useSkedraCanvasCommandPalette({
	store,
	elements,
	keyboard,
	readOnly,
	canUndo,
	canRedo,
	undo,
	redo,
	deleteElements,
	handleInsertImage,
	handleFitViewport,
	handleFitSelection,
	handleRequestClearCanvas,
	setHelpDialogOpen,
}: UseSkedraCanvasCommandPaletteOptions) {
	return useMemo<CanvasCommand[]>(() => {
		const clearSelection = () => store.clearSelection();
		const runById: Record<string, () => void> = {
			"find-on-canvas": () => store.setCanvasSearchOpen(true),
			"insert-image": () => void handleInsertImage(),
			undo,
			redo,
			copy: keyboard.copySelection,
			cut: keyboard.cutSelection,
			paste: keyboard.pasteClipboard,
			duplicate: keyboard.duplicateSelection,
			"delete-selection": () => {
				if (store.selectedIds.size === 0) return;
				deleteElements(Array.from(store.selectedIds));
				clearSelection();
			},
			"select-all": () => store.setSelectedIds(new Set(elements.keys())),
			group: keyboard.groupSelection,
			ungroup: keyboard.ungroupSelection,
			"align-top": () => keyboard.alignSelection("top"),
			"align-bottom": () => keyboard.alignSelection("bottom"),
			"align-left": () => keyboard.alignSelection("left"),
			"align-right": () => keyboard.alignSelection("right"),
			"distribute-horizontal": () => keyboard.distributeSelection("horizontal"),
			"distribute-vertical": () => keyboard.distributeSelection("vertical"),
			"bring-forward": keyboard.bringForward,
			"send-backward": keyboard.sendBackward,
			"bring-to-front": keyboard.bringToFront,
			"send-to-back": keyboard.sendToBack,
			"flip-horizontal": keyboard.flipHorizontal,
			"flip-vertical": keyboard.flipVertical,
			"toggle-lock": keyboard.toggleLock,
			"add-link": keyboard.addLink,
			"fit-all": handleFitViewport,
			"fit-selection": handleFitSelection,
			"reset-zoom": store.resetViewport,
			"toggle-grid": store.toggleGrid,
			"toggle-object-snap": store.toggleSnapToObjects,
			"toggle-zen": store.toggleZenMode,
			"open-help": () => setHelpDialogOpen(true),
			"clear-canvas": handleRequestClearCanvas,
		};

		const context = {
			readOnly,
			selectionCount: store.selectedIds.size,
			canPaste: keyboard.clipboardRef.current.length > 0,
			canUndo,
			canRedo,
		};

		return CANVAS_COMMAND_DEFINITIONS.flatMap((definition) => {
			const tool = definition.tool;
			const run = tool
				? () => {
						if (tool === "eyedropper") {
							store.activateEyedropper("stroke");
						} else {
							store.setActiveTool(tool);
						}
					}
				: runById[definition.id];
			if (!run || !isCommandAvailable(definition.availability, context)) {
				return [];
			}
			return [{ ...definition, run }];
		});
	}, [
		canRedo,
		canUndo,
		deleteElements,
		elements,
		handleFitSelection,
		handleFitViewport,
		handleInsertImage,
		handleRequestClearCanvas,
		keyboard,
		readOnly,
		redo,
		setHelpDialogOpen,
		store,
		undo,
	]);
}
