/**
 * Gemeinsamer Kontext fuer Canvas-Tastatur-Shortcuts.
 */

import type { CanvasStoreState } from "@/hooks/use-canvas-store";
import type { CanvasElement, FlowchartDirection } from "@skedra/canvas-core";
import type { useCanvasKeyboardOperations } from "./operations";

export interface CanvasKeyboardActions {
	fitAll?: () => void;
	fitSelection?: () => void;
	resetZoom?: () => void;
	insertImage?: () => void;
	requestClearCanvas?: () => void;
	openHelp?: () => void;
	toggleTheme?: () => void;
	pastePlainText?: (text: string) => void;
	startImageCrop?: () => void;
	flowchartCreateDefaultStep?: (nodeId: string) => void;
	flowchartCreateStep?: (direction: FlowchartDirection) => void;
	flowchartNavigate?: (direction: FlowchartDirection) => void;
	mindmapCreateSibling?: (nodeId: string) => void;
	openCommandPalette?: () => void;
}

export interface CanvasKeyDownContext {
	store: CanvasStoreState;
	elements: Map<string, CanvasElement>;
	deleteElements: (ids: string[]) => void;
	undo: () => void;
	redo: () => void;
	actions?: CanvasKeyboardActions;
	ops: ReturnType<typeof useCanvasKeyboardOperations>;
}

export function getKeyModifiers(e: KeyboardEvent) {
	return {
		ctrl: e.ctrlKey || e.metaKey,
		shift: e.shiftKey,
		alt: e.altKey,
	};
}
