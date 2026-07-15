/**
 * Gemeinsamer Kontext fuer Canvas-Tastatur-Shortcuts.
 */

import type { FlowchartDirection } from "@skedra/canvas-core";

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
	openCanvasSearch?: () => void;
}
