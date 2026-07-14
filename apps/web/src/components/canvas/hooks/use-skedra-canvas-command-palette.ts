/**
 * Befehle fuer die Canvas-Command-Palette.
 */

import type { CanvasCommand } from "@/components/canvas/canvas-command-palette";
import type { CanvasStoreState } from "@/hooks/use-canvas-store";
import { useMemo } from "react";

interface UseSkedraCanvasCommandPaletteOptions {
	store: CanvasStoreState;
	handleInsertImage: () => void | Promise<void>;
	handleFitViewport: () => void;
	handleRequestClearCanvas: () => void;
	setHelpDialogOpen: (open: boolean) => void;
}

export function useSkedraCanvasCommandPalette({
	store,
	handleInsertImage,
	handleFitViewport,
	handleRequestClearCanvas,
	setHelpDialogOpen,
}: UseSkedraCanvasCommandPaletteOptions) {
	return useMemo<CanvasCommand[]>(
		() => [
			{
				id: "tool-select",
				labelKey: "canvas.commandPalette.select",
				groupKey: "canvas.commandPalette.groups.tools",
				keywords: ["v", "1"],
				run: () => store.setActiveTool("select"),
			},
			{
				id: "tool-eraser",
				labelKey: "canvas.commandPalette.eraser",
				groupKey: "canvas.commandPalette.groups.tools",
				keywords: ["e", "0"],
				run: () => store.setActiveTool("eraser"),
			},
			{
				id: "tool-laser",
				labelKey: "canvas.commandPalette.laser",
				groupKey: "canvas.commandPalette.groups.tools",
				keywords: ["k"],
				run: () => store.setActiveTool("laser"),
			},
			{
				id: "tool-eyedropper",
				labelKey: "canvas.commandPalette.eyedropper",
				groupKey: "canvas.commandPalette.groups.tools",
				keywords: ["i"],
				run: () => store.activateEyedropper("stroke"),
			},
			{
				id: "insert-image",
				labelKey: "canvas.commandPalette.insertImage",
				groupKey: "canvas.commandPalette.groups.insert",
				run: () => void handleInsertImage(),
			},
			{
				id: "toggle-grid",
				labelKey: "canvas.commandPalette.toggleGrid",
				groupKey: "canvas.commandPalette.groups.view",
				run: () => store.toggleGrid(),
			},
			{
				id: "toggle-object-snap",
				labelKey: "canvas.contextMenu.snapToObjects",
				groupKey: "canvas.commandPalette.groups.view",
				run: () => store.toggleSnapToObjects(),
			},
			{
				id: "toggle-zen",
				labelKey: "canvas.commandPalette.toggleZen",
				groupKey: "canvas.commandPalette.groups.view",
				run: () => store.toggleZenMode(),
			},
			{
				id: "open-help",
				labelKey: "canvas.commandPalette.openHelp",
				groupKey: "canvas.commandPalette.groups.view",
				run: () => setHelpDialogOpen(true),
			},
			{
				id: "fit-all",
				labelKey: "canvas.commandPalette.fitAll",
				groupKey: "canvas.commandPalette.groups.view",
				run: () => handleFitViewport(),
			},
			{
				id: "clear-canvas",
				labelKey: "canvas.commandPalette.clearCanvas",
				groupKey: "canvas.commandPalette.groups.edit",
				run: () => handleRequestClearCanvas(),
			},
		],
		[
			handleFitViewport,
			handleInsertImage,
			handleRequestClearCanvas,
			setHelpDialogOpen,
			store,
		],
	);
}
