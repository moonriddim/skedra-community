import type { SkedraCanvasCommandId } from "./commands.js";

type SkedraSdkKeyboardTool =
	| "select"
	| "lasso"
	| "rectangle"
	| "ellipse"
	| "diamond"
	| "triangle"
	| "cloud"
	| "line"
	| "arrow"
	| "text"
	| "freehand"
	| "frame"
	| "pan"
	| "eraser"
	| "laser"
	| "eyedropper";

export type SkedraSdkKeyboardAction =
	| { type: "tool"; tool: SkedraSdkKeyboardTool }
	| { type: "command"; command: SkedraCanvasCommandId }
	| { type: "toggle-tool-lock" }
	| { type: "toggle-object-snap" }
	| { type: "insert-image" }
	| { type: "open-help" }
	| { type: "open-command-palette" }
	| { type: "open-canvas-search" }
	| { type: "focus-property"; property: "stroke" | "fill" | "font" }
	| { type: "eyedropper"; target: "stroke" | "fill" }
	| { type: "paste-plain-text" }
	| { type: "copy-canvas-as-png" }
	| { type: "copy-format" }
	| { type: "paste-format" }
	| { type: "add-link" }
	| { type: "adjust-font-size"; delta: number }
	| { type: "align"; edge: "top" | "bottom" | "left" | "right" }
	| { type: "flowchart-create"; direction: "up" | "right" | "down" | "left" }
	| { type: "flowchart-navigate"; direction: "up" | "right" | "down" | "left" }
	| { type: "zoom"; factor: number }
	| { type: "reset-zoom" }
	| { type: "fit"; target: "all" | "selection" }
	| { type: "pan-viewport"; x: number; y: number }
	| { type: "toggle-theme" }
	| { type: "toggle-zen" }
	| { type: "toggle-grid" }
	| { type: "activate-selection" };

export interface SkedraSdkKeyboardActionHandlers {
	command: (
		command: Extract<SkedraSdkKeyboardAction, { type: "command" }>["command"],
	) => void;
	tool: (tool: SkedraSdkKeyboardTool) => void;
	toggleToolLock: () => void;
	toggleObjectSnap: () => void;
	insertImage: () => void;
	openHelp: () => void;
	openCommandPalette: () => void;
	openCanvasSearch: () => void;
	focusProperty: (property: "stroke" | "fill" | "font") => void;
	eyedropper: (target: "stroke" | "fill") => void;
	pastePlainText: () => void;
	copyCanvasAsPng: () => void;
	copyFormat: () => void;
	pasteFormat: () => void;
	addLink: () => void;
	adjustFontSize: (delta: number) => void;
	align: (edge: "top" | "bottom" | "left" | "right") => void;
	flowchartCreate: (direction: "up" | "right" | "down" | "left") => void;
	flowchartNavigate: (direction: "up" | "right" | "down" | "left") => void;
	zoom: (factor: number) => void;
	resetZoom: () => void;
	fit: (target: "all" | "selection") => void;
	panViewport: (x: number, y: number) => void;
	toggleTheme: () => void;
	toggleZen: () => void;
	toggleGrid: () => void;
	activateSelection: () => void;
}

/** Exhaustive SDK host dispatcher for every shared keyboard action. */
export function handleSkedraSdkKeyboardAction(
	action: SkedraSdkKeyboardAction,
	handlers: SkedraSdkKeyboardActionHandlers,
): true {
	switch (action.type) {
		case "command":
			handlers.command(action.command);
			break;
		case "tool":
			handlers.tool(action.tool);
			break;
		case "toggle-tool-lock":
			handlers.toggleToolLock();
			break;
		case "toggle-object-snap":
			handlers.toggleObjectSnap();
			break;
		case "insert-image":
			handlers.insertImage();
			break;
		case "open-help":
			handlers.openHelp();
			break;
		case "open-command-palette":
			handlers.openCommandPalette();
			break;
		case "open-canvas-search":
			handlers.openCanvasSearch();
			break;
		case "focus-property":
			handlers.focusProperty(action.property);
			break;
		case "eyedropper":
			handlers.eyedropper(action.target);
			break;
		case "paste-plain-text":
			handlers.pastePlainText();
			break;
		case "copy-canvas-as-png":
			handlers.copyCanvasAsPng();
			break;
		case "copy-format":
			handlers.copyFormat();
			break;
		case "paste-format":
			handlers.pasteFormat();
			break;
		case "add-link":
			handlers.addLink();
			break;
		case "adjust-font-size":
			handlers.adjustFontSize(action.delta);
			break;
		case "align":
			handlers.align(action.edge);
			break;
		case "flowchart-create":
			handlers.flowchartCreate(action.direction);
			break;
		case "flowchart-navigate":
			handlers.flowchartNavigate(action.direction);
			break;
		case "zoom":
			handlers.zoom(action.factor);
			break;
		case "reset-zoom":
			handlers.resetZoom();
			break;
		case "fit":
			handlers.fit(action.target);
			break;
		case "pan-viewport":
			handlers.panViewport(action.x, action.y);
			break;
		case "toggle-theme":
			handlers.toggleTheme();
			break;
		case "toggle-zen":
			handlers.toggleZen();
			break;
		case "toggle-grid":
			handlers.toggleGrid();
			break;
		case "activate-selection":
			handlers.activateSelection();
			break;
	}
	return true;
}
