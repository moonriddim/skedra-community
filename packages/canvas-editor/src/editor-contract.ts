import type { CanvasEditorCommandId, ToolType } from "@skedra/canvas-core";

export type CanvasEditorToolId =
	| ToolType
	| "sticky-note"
	| "kanban"
	| "mindmap";

export interface CanvasEditorToolDefinition {
	id: CanvasEditorToolId;
	label: string;
	labelKey: string;
	shortcut: string | null;
	group: "navigation" | "drawing" | "utility" | "structured";
}

const CORE_TOOL_DEFINITIONS: Record<ToolType, CanvasEditorToolDefinition> = {
	select: {
		id: "select",
		label: "Select",
		labelKey: "canvas.toolbar.select",
		shortcut: "1",
		group: "navigation",
	},
	lasso: {
		id: "lasso",
		label: "Lasso",
		labelKey: "canvas.toolbar.lasso",
		shortcut: null,
		group: "navigation",
	},
	pan: {
		id: "pan",
		label: "Pan",
		labelKey: "canvas.toolbar.pan",
		shortcut: "H",
		group: "navigation",
	},
	rectangle: {
		id: "rectangle",
		label: "Rectangle",
		labelKey: "canvas.toolbar.rectangle",
		shortcut: "2",
		group: "drawing",
	},
	diamond: {
		id: "diamond",
		label: "Diamond",
		labelKey: "canvas.toolbar.diamond",
		shortcut: "3",
		group: "drawing",
	},
	ellipse: {
		id: "ellipse",
		label: "Ellipse",
		labelKey: "canvas.toolbar.ellipse",
		shortcut: "4",
		group: "drawing",
	},
	arrow: {
		id: "arrow",
		label: "Arrow",
		labelKey: "canvas.toolbar.arrow",
		shortcut: "5",
		group: "drawing",
	},
	line: {
		id: "line",
		label: "Line",
		labelKey: "canvas.toolbar.line",
		shortcut: "6",
		group: "drawing",
	},
	freehand: {
		id: "freehand",
		label: "Freehand",
		labelKey: "canvas.toolbar.freehand",
		shortcut: "7",
		group: "drawing",
	},
	text: {
		id: "text",
		label: "Text",
		labelKey: "canvas.toolbar.text",
		shortcut: "8",
		group: "drawing",
	},
	frame: {
		id: "frame",
		label: "Frame",
		labelKey: "canvas.toolbar.frame",
		shortcut: "F",
		group: "drawing",
	},
	eraser: {
		id: "eraser",
		label: "Eraser",
		labelKey: "canvas.toolbar.eraser",
		shortcut: "E",
		group: "utility",
	},
	laser: {
		id: "laser",
		label: "Laser",
		labelKey: "canvas.toolbar.laser",
		shortcut: "K",
		group: "utility",
	},
	eyedropper: {
		id: "eyedropper",
		label: "Eyedropper",
		labelKey: "canvas.toolbar.eyedropper",
		shortcut: "I",
		group: "utility",
	},
};

export const CANVAS_EDITOR_TOOL_DEFINITIONS = [
	CORE_TOOL_DEFINITIONS.pan,
	CORE_TOOL_DEFINITIONS.select,
	CORE_TOOL_DEFINITIONS.lasso,
	CORE_TOOL_DEFINITIONS.rectangle,
	CORE_TOOL_DEFINITIONS.diamond,
	CORE_TOOL_DEFINITIONS.ellipse,
	CORE_TOOL_DEFINITIONS.arrow,
	CORE_TOOL_DEFINITIONS.line,
	CORE_TOOL_DEFINITIONS.freehand,
	CORE_TOOL_DEFINITIONS.text,
	CORE_TOOL_DEFINITIONS.frame,
	CORE_TOOL_DEFINITIONS.eraser,
	CORE_TOOL_DEFINITIONS.laser,
	CORE_TOOL_DEFINITIONS.eyedropper,
	{
		id: "sticky-note",
		label: "Sticky note",
		labelKey: "canvas.toolbar.stickyNote",
		shortcut: null,
		group: "structured",
	},
	{
		id: "kanban",
		label: "Kanban board",
		labelKey: "canvas.toolbar.kanban",
		shortcut: null,
		group: "structured",
	},
	{
		id: "mindmap",
		label: "Mindmap",
		labelKey: "canvas.toolbar.insertMindmap",
		shortcut: null,
		group: "structured",
	},
] as const satisfies readonly CanvasEditorToolDefinition[];

export const CANVAS_EDITOR_TOOL_IDS = CANVAS_EDITOR_TOOL_DEFINITIONS.map(
	(definition) => definition.id,
);

export function getCanvasEditorToolDefinition(tool: CanvasEditorToolId) {
	return CANVAS_EDITOR_TOOL_DEFINITIONS.find(
		(definition) => definition.id === tool,
	);
}

export type CanvasEditorKeyboardAction =
	| { type: "tool"; tool: ToolType }
	| { type: "command"; command: CanvasEditorCommandId }
	| { type: "temporary-pan" }
	| { type: "toggle-tool-lock" }
	| { type: "toggle-object-snap" }
	| { type: "insert-image" }
	| { type: "open-help" }
	| { type: "open-command-palette" }
	| { type: "focus-property"; property: "stroke" | "fill" | "font" }
	| { type: "eyedropper"; target: "stroke" | "fill" }
	| { type: "paste-plain-text" }
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

export interface CanvasEditorKeyboardContext {
	hasSelection?: boolean;
}

type CanvasEditorKeyboardEvent = Pick<
	KeyboardEvent,
	"key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
>;

type CanvasEditorDirection = "up" | "right" | "down" | "left";

const CONTROL_MODIFIER = 4;
const ALT_MODIFIER = 2;
const SHIFT_MODIFIER = 1;

const ARROW_DIRECTION_BY_KEY: Readonly<
	Partial<Record<string, CanvasEditorDirection>>
> = {
	ArrowUp: "up",
	ArrowRight: "right",
	ArrowDown: "down",
	ArrowLeft: "left",
};

const ALIGN_EDGE_BY_DIRECTION = {
	up: "top",
	right: "right",
	down: "bottom",
	left: "left",
} as const;

const EXACT_KEYBOARD_ACTION_BY_SHORTCUT: Readonly<
	Partial<Record<string, CanvasEditorKeyboardAction>>
> = {
	"5:v": { type: "paste-plain-text" },
	"7:v": { type: "paste-plain-text" },
	"6:c": { type: "copy-format" },
	"7:c": { type: "copy-format" },
	"6:v": { type: "paste-format" },
	"4:k": { type: "add-link" },
	"5:<": { type: "adjust-font-size", delta: -2 },
	"7:<": { type: "adjust-font-size", delta: -2 },
	"5:>": { type: "adjust-font-size", delta: 2 },
	"7:>": { type: "adjust-font-size", delta: 2 },
	"1:1": { type: "fit", target: "all" },
	"1:2": { type: "fit", target: "selection" },
	"3:d": { type: "toggle-theme" },
	"2:z": { type: "toggle-zen" },
	"0:enter": { type: "activate-selection" },
	"4:c": { type: "command", command: "copy" },
	"4:x": { type: "command", command: "cut" },
	"4:v": { type: "command", command: "paste" },
	"4:d": { type: "command", command: "duplicate" },
	"4:g": { type: "command", command: "group" },
	"5:g": { type: "command", command: "ungroup" },
	"5:l": { type: "command", command: "toggle-lock" },
	"4:]": { type: "command", command: "bring-forward" },
	"5:]": { type: "command", command: "bring-to-front" },
	"4:[": { type: "command", command: "send-backward" },
	"5:[": { type: "command", command: "send-to-back" },
	"1:h": { type: "command", command: "flip-horizontal" },
	"1:v": { type: "command", command: "flip-vertical" },
	"0:q": { type: "toggle-tool-lock" },
	"0:9": { type: "insert-image" },
	"1:s": { type: "eyedropper", target: "stroke" },
	"1:g": { type: "eyedropper", target: "fill" },
	"2:s": { type: "toggle-object-snap" },
	"0:?": { type: "open-help" },
	"1:?": { type: "open-help" },
	"5:p": { type: "open-command-palette" },
	"7:p": { type: "open-command-palette" },
	"0: ": { type: "temporary-pan" },
	"1: ": { type: "temporary-pan" },
};

const SELECTION_PROPERTY_BY_SHORTCUT = {
	"0:s": "stroke",
	"0:g": "fill",
	"1:f": "font",
} as const;

const CANVAS_EDITOR_TOOL_BY_SHORTCUT: Readonly<
	Partial<Record<string, ToolType>>
> = {
	"1": "select",
	v: "select",
	"2": "rectangle",
	r: "rectangle",
	"3": "diamond",
	d: "diamond",
	"4": "ellipse",
	o: "ellipse",
	"5": "arrow",
	a: "arrow",
	"6": "line",
	l: "line",
	"7": "freehand",
	p: "freehand",
	"8": "text",
	t: "text",
	"0": "eraser",
	e: "eraser",
	k: "laser",
	i: "eyedropper",
	h: "pan",
	f: "frame",
};

const CONTROL_KEYBOARD_ACTION_BY_KEY: Readonly<
	Partial<Record<string, CanvasEditorKeyboardAction>>
> = {
	"=": { type: "zoom", factor: 1.25 },
	"+": { type: "zoom", factor: 1.25 },
	"-": { type: "zoom", factor: 0.8 },
	"0": { type: "reset-zoom" },
	"'": { type: "toggle-grid" },
	"/": { type: "open-command-palette" },
};

const SHIFTED_SHORTCUT_KEY_BY_CODE: Readonly<Partial<Record<string, string>>> =
	{
		Comma: "<",
		Period: ">",
	};

const VIEWPORT_PAN_BY_KEY = {
	PageUp: {
		default: { x: 0, y: 100 },
		shifted: { x: 100, y: 0 },
	},
	PageDown: {
		default: { x: 0, y: -100 },
		shifted: { x: -100, y: 0 },
	},
} as const;

function getCanvasEditorModifierMask(event: CanvasEditorKeyboardEvent) {
	return (
		(event.ctrlKey || event.metaKey ? CONTROL_MODIFIER : 0) |
		(event.altKey ? ALT_MODIFIER : 0) |
		(event.shiftKey ? SHIFT_MODIFIER : 0)
	);
}

function resolveExactKeyboardAction(
	event: CanvasEditorKeyboardEvent,
	key: string,
) {
	const shortcut = `${getCanvasEditorModifierMask(event)}:${key}`;
	return EXACT_KEYBOARD_ACTION_BY_SHORTCUT[shortcut] ?? null;
}

function resolveDirectionalKeyboardAction(
	event: CanvasEditorKeyboardEvent,
): CanvasEditorKeyboardAction | null {
	const direction = ARROW_DIRECTION_BY_KEY[event.key];
	if (!direction) return null;

	const modifiers = getCanvasEditorModifierMask(event);
	if (
		(modifiers & (CONTROL_MODIFIER | SHIFT_MODIFIER)) ===
		(CONTROL_MODIFIER | SHIFT_MODIFIER)
	) {
		return { type: "align", edge: ALIGN_EDGE_BY_DIRECTION[direction] };
	}
	if (modifiers === CONTROL_MODIFIER) {
		return { type: "flowchart-create", direction };
	}
	if (modifiers === ALT_MODIFIER) {
		return { type: "flowchart-navigate", direction };
	}
	return null;
}

function resolveControlKeyboardAction(
	event: CanvasEditorKeyboardEvent,
): CanvasEditorKeyboardAction | null {
	const ctrl = event.ctrlKey || event.metaKey;
	if (!ctrl) return null;
	return CONTROL_KEYBOARD_ACTION_BY_KEY[event.key] ?? null;
}

function getCanvasEditorShortcutKey(event: CanvasEditorKeyboardEvent) {
	const key = event.key.toLowerCase();
	if (!event.shiftKey) return key;
	return SHIFTED_SHORTCUT_KEY_BY_CODE[event.code] ?? key;
}

function resolveViewportPanKeyboardAction(
	event: CanvasEditorKeyboardEvent,
): CanvasEditorKeyboardAction | null {
	const pan =
		VIEWPORT_PAN_BY_KEY[event.key as keyof typeof VIEWPORT_PAN_BY_KEY];
	if (!pan) return null;
	return {
		type: "pan-viewport",
		...(event.shiftKey ? pan.shifted : pan.default),
	};
}

function resolveSelectionPropertyKeyboardAction(
	event: CanvasEditorKeyboardEvent,
	key: string,
	context: CanvasEditorKeyboardContext,
): CanvasEditorKeyboardAction | null {
	if (!context.hasSelection) return null;
	const shortcut = `${getCanvasEditorModifierMask(event)}:${key}`;
	const property =
		SELECTION_PROPERTY_BY_SHORTCUT[
			shortcut as keyof typeof SELECTION_PROPERTY_BY_SHORTCUT
		];
	return property ? { type: "focus-property", property } : null;
}

function resolveToolKeyboardAction(
	event: CanvasEditorKeyboardEvent,
	key: string,
): CanvasEditorKeyboardAction | null {
	if (getCanvasEditorModifierMask(event) !== 0) return null;
	const tool = resolveCanvasEditorToolShortcut(key);
	return tool ? { type: "tool", tool } : null;
}

export function resolveCanvasEditorKeyboardAction(
	event: CanvasEditorKeyboardEvent,
	context: CanvasEditorKeyboardContext = {},
): CanvasEditorKeyboardAction | null {
	const key = getCanvasEditorShortcutKey(event);
	return (
		resolveExactKeyboardAction(event, key) ??
		resolveDirectionalKeyboardAction(event) ??
		resolveControlKeyboardAction(event) ??
		resolveViewportPanKeyboardAction(event) ??
		resolveSelectionPropertyKeyboardAction(event, key, context) ??
		resolveToolKeyboardAction(event, key)
	);
}

function resolveCanvasEditorToolShortcut(key: string): ToolType | null {
	return CANVAS_EDITOR_TOOL_BY_SHORTCUT[key] ?? null;
}
