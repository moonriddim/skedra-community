import type { ToolType } from "@skedra/canvas-core";
import {
	CANVAS_EDITOR_TOOL_DEFINITIONS,
	getCanvasEditorUiShortcutLabels,
} from "@skedra/canvas-editor";

export type CanvasCommandIconId =
	| "align"
	| "copy"
	| "delete"
	| "duplicate"
	| "fit"
	| "flip"
	| "grid"
	| "group"
	| "help"
	| "image"
	| "layer"
	| "link"
	| "lock"
	| "paste"
	| "redo"
	| "search"
	| "select-all"
	| "snap"
	| "tool"
	| "undo"
	| "zen";

export type CanvasCommandAvailability =
	| "always"
	| "can-paste"
	| "can-redo"
	| "can-undo"
	| "editable"
	| "selection"
	| "selection-many"
	| "selection-three";

export interface CanvasCommandDefinition {
	id: string;
	labelKey: string;
	groupKey: string;
	keywords: readonly string[];
	shortcuts: readonly string[];
	icon: CanvasCommandIconId;
	availability: CanvasCommandAvailability;
	tool?: ToolType;
}

export interface CanvasCommand extends CanvasCommandDefinition {
	run: () => void;
}

export const CANVAS_COMMAND_GROUPS = [
	"canvas.commandPalette.groups.recent",
	"canvas.commandPalette.groups.tools",
	"canvas.commandPalette.groups.insert",
	"canvas.commandPalette.groups.edit",
	"canvas.commandPalette.groups.elements",
	"canvas.commandPalette.groups.view",
	"canvas.commandPalette.groups.app",
] as const;

const TOOL_COMMANDS: CanvasCommandDefinition[] =
	CANVAS_EDITOR_TOOL_DEFINITIONS.filter(
		(definition): definition is typeof definition & { id: ToolType } =>
			definition.group !== "structured",
	).map((definition) => ({
		id: `tool-${definition.id}`,
		labelKey: definition.labelKey,
		groupKey: "canvas.commandPalette.groups.tools",
		keywords: [definition.label, definition.id, definition.shortcut ?? ""],
		shortcuts: definition.shortcut ? [definition.shortcut] : [],
		icon: "tool",
		availability: "editable",
		tool: definition.id,
	}));

const COMMANDS: CanvasCommandDefinition[] = [
	{
		id: "find-on-canvas",
		labelKey: "canvas.commandPalette.findOnCanvas",
		groupKey: "canvas.commandPalette.groups.app",
		keywords: ["find", "search", "canvas", "finden", "suchen"],
		shortcuts: getCanvasEditorUiShortcutLabels("find-on-canvas"),
		icon: "search",
		availability: "always",
	},
	{
		id: "insert-image",
		labelKey: "canvas.commandPalette.insertImage",
		groupKey: "canvas.commandPalette.groups.insert",
		keywords: ["image", "picture", "upload", "bild", "foto"],
		shortcuts: ["9"],
		icon: "image",
		availability: "editable",
	},
	{
		id: "undo",
		labelKey: "canvas.commandPalette.undo",
		groupKey: "canvas.commandPalette.groups.edit",
		keywords: ["undo", "back", "rueckgaengig"],
		shortcuts: ["Mod+Z"],
		icon: "undo",
		availability: "can-undo",
	},
	{
		id: "redo",
		labelKey: "canvas.commandPalette.redo",
		groupKey: "canvas.commandPalette.groups.edit",
		keywords: ["redo", "forward", "wiederholen"],
		shortcuts: ["Mod+Shift+Z"],
		icon: "redo",
		availability: "can-redo",
	},
	{
		id: "copy",
		labelKey: "canvas.commandPalette.copy",
		groupKey: "canvas.commandPalette.groups.edit",
		keywords: ["copy", "kopieren"],
		shortcuts: ["Mod+C"],
		icon: "copy",
		availability: "selection",
	},
	{
		id: "cut",
		labelKey: "canvas.commandPalette.cut",
		groupKey: "canvas.commandPalette.groups.edit",
		keywords: ["cut", "ausschneiden"],
		shortcuts: ["Mod+X"],
		icon: "copy",
		availability: "selection",
	},
	{
		id: "paste",
		labelKey: "canvas.commandPalette.paste",
		groupKey: "canvas.commandPalette.groups.edit",
		keywords: ["paste", "einfuegen"],
		shortcuts: ["Mod+V"],
		icon: "paste",
		availability: "can-paste",
	},
	{
		id: "duplicate",
		labelKey: "canvas.commandPalette.duplicate",
		groupKey: "canvas.commandPalette.groups.edit",
		keywords: ["duplicate", "clone", "duplizieren"],
		shortcuts: ["Mod+D"],
		icon: "duplicate",
		availability: "selection",
	},
	{
		id: "delete-selection",
		labelKey: "canvas.commandPalette.deleteSelection",
		groupKey: "canvas.commandPalette.groups.edit",
		keywords: ["delete", "remove", "loeschen"],
		shortcuts: ["Delete"],
		icon: "delete",
		availability: "selection",
	},
	{
		id: "select-all",
		labelKey: "canvas.commandPalette.selectAll",
		groupKey: "canvas.commandPalette.groups.edit",
		keywords: ["select all", "everything", "alles auswaehlen"],
		shortcuts: ["Mod+A"],
		icon: "select-all",
		availability: "editable",
	},
	{
		id: "group",
		labelKey: "canvas.commandPalette.group",
		groupKey: "canvas.commandPalette.groups.elements",
		keywords: ["group", "gruppieren"],
		shortcuts: ["Mod+G"],
		icon: "group",
		availability: "selection-many",
	},
	{
		id: "ungroup",
		labelKey: "canvas.commandPalette.ungroup",
		groupKey: "canvas.commandPalette.groups.elements",
		keywords: ["ungroup", "gruppe aufheben"],
		shortcuts: ["Mod+Shift+G"],
		icon: "group",
		availability: "selection",
	},
	...(["top", "bottom", "left", "right"] as const).map(
		(edge): CanvasCommandDefinition => ({
			id: `align-${edge}`,
			labelKey: `canvas.commandPalette.align.${edge}`,
			groupKey: "canvas.commandPalette.groups.elements",
			keywords: ["align", edge, "ausrichten"],
			shortcuts: [],
			icon: "align",
			availability: "selection-many",
		}),
	),
	...(["horizontal", "vertical"] as const).map(
		(axis): CanvasCommandDefinition => ({
			id: `distribute-${axis}`,
			labelKey: `canvas.commandPalette.distribute.${axis}`,
			groupKey: "canvas.commandPalette.groups.elements",
			keywords: ["distribute", axis, "verteilen"],
			shortcuts: [],
			icon: "align",
			availability: "selection-three",
		}),
	),
	...(
		[
			["bring-forward", "Mod+]"],
			["send-backward", "Mod+["],
			["bring-to-front", "Mod+Shift+]"],
			["send-to-back", "Mod+Shift+["],
		] as const
	).map(
		([id, shortcut]): CanvasCommandDefinition => ({
			id,
			labelKey: `canvas.commandPalette.layer.${id}`,
			groupKey: "canvas.commandPalette.groups.elements",
			keywords: ["layer", "order", id, "ebene", "reihenfolge"],
			shortcuts: [shortcut],
			icon: "layer",
			availability: "selection",
		}),
	),
	{
		id: "flip-horizontal",
		labelKey: "canvas.commandPalette.flip.horizontal",
		groupKey: "canvas.commandPalette.groups.elements",
		keywords: ["flip", "mirror", "horizontal", "spiegeln"],
		shortcuts: ["Shift+H"],
		icon: "flip",
		availability: "selection",
	},
	{
		id: "flip-vertical",
		labelKey: "canvas.commandPalette.flip.vertical",
		groupKey: "canvas.commandPalette.groups.elements",
		keywords: ["flip", "mirror", "vertical", "spiegeln"],
		shortcuts: ["Shift+V"],
		icon: "flip",
		availability: "selection",
	},
	{
		id: "toggle-lock",
		labelKey: "canvas.commandPalette.toggleLock",
		groupKey: "canvas.commandPalette.groups.elements",
		keywords: ["lock", "unlock", "sperren", "entsperren"],
		shortcuts: ["Mod+Shift+L"],
		icon: "lock",
		availability: "selection",
	},
	{
		id: "add-link",
		labelKey: "canvas.commandPalette.addLink",
		groupKey: "canvas.commandPalette.groups.elements",
		keywords: ["link", "url", "verknuepfung"],
		shortcuts: ["Mod+K"],
		icon: "link",
		availability: "selection",
	},
	{
		id: "fit-all",
		labelKey: "canvas.commandPalette.fitAll",
		groupKey: "canvas.commandPalette.groups.view",
		keywords: ["fit", "zoom", "all", "alles einpassen"],
		shortcuts: ["Shift+1"],
		icon: "fit",
		availability: "always",
	},
	{
		id: "fit-selection",
		labelKey: "canvas.commandPalette.fitSelection",
		groupKey: "canvas.commandPalette.groups.view",
		keywords: ["fit", "zoom", "selection", "auswahl einpassen"],
		shortcuts: ["Shift+2"],
		icon: "fit",
		availability: "selection",
	},
	{
		id: "reset-zoom",
		labelKey: "canvas.commandPalette.resetZoom",
		groupKey: "canvas.commandPalette.groups.view",
		keywords: ["reset", "zoom", "100%"],
		shortcuts: ["Mod+0"],
		icon: "fit",
		availability: "always",
	},
	{
		id: "toggle-grid",
		labelKey: "canvas.commandPalette.toggleGrid",
		groupKey: "canvas.commandPalette.groups.view",
		keywords: ["grid", "raster"],
		shortcuts: ["Mod+'"],
		icon: "grid",
		availability: "always",
	},
	{
		id: "toggle-object-snap",
		labelKey: "canvas.commandPalette.toggleObjectSnap",
		groupKey: "canvas.commandPalette.groups.view",
		keywords: ["snap", "objects", "einrasten"],
		shortcuts: ["Alt+S"],
		icon: "snap",
		availability: "always",
	},
	{
		id: "toggle-zen",
		labelKey: "canvas.commandPalette.toggleZen",
		groupKey: "canvas.commandPalette.groups.view",
		keywords: ["zen", "focus", "fokus"],
		shortcuts: ["Alt+Z"],
		icon: "zen",
		availability: "always",
	},
	{
		id: "open-help",
		labelKey: "canvas.commandPalette.openHelp",
		groupKey: "canvas.commandPalette.groups.app",
		keywords: ["help", "shortcuts", "hilfe", "tastaturkuerzel"],
		shortcuts: ["?"],
		icon: "help",
		availability: "always",
	},
	{
		id: "clear-canvas",
		labelKey: "canvas.commandPalette.clearCanvas",
		groupKey: "canvas.commandPalette.groups.app",
		keywords: ["clear", "delete all", "canvas", "alles loeschen"],
		shortcuts: [],
		icon: "delete",
		availability: "editable",
	},
];

/** The single metadata source for keyboard-discoverable canvas commands. */
export const CANVAS_COMMAND_DEFINITIONS: readonly CanvasCommandDefinition[] = [
	...TOOL_COMMANDS,
	...COMMANDS,
];

function normalizeCommandSearch(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLocaleLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function subsequenceScore(query: string, haystack: string): number {
	let queryIndex = 0;
	let firstIndex = -1;
	let gaps = 0;
	for (
		let index = 0;
		index < haystack.length && queryIndex < query.length;
		index++
	) {
		if (haystack[index] !== query[queryIndex]) continue;
		if (firstIndex === -1) firstIndex = index;
		else gaps += index - (firstIndex + queryIndex);
		queryIndex += 1;
	}
	return queryIndex === query.length
		? 200 - Math.max(0, firstIndex) - gaps
		: -1;
}

export function rankCanvasCommands(
	commands: readonly CanvasCommand[],
	query: string,
	getLabel: (command: CanvasCommand) => string,
	getGroup: (command: CanvasCommand) => string,
): CanvasCommand[] {
	const normalizedQuery = normalizeCommandSearch(query);
	if (!normalizedQuery) return [...commands];
	const compactQuery = normalizedQuery.replace(/ /g, "");

	return commands
		.map((command, index) => {
			const label = normalizeCommandSearch(getLabel(command));
			const group = normalizeCommandSearch(getGroup(command));
			const haystack = normalizeCommandSearch(
				`${label} ${group} ${command.id} ${command.keywords.join(" ")}`,
			);
			const compactHaystack = haystack.replace(/ /g, "");
			let score = subsequenceScore(compactQuery, compactHaystack);
			if (label === normalizedQuery) score = 1_200;
			else if (label.startsWith(normalizedQuery)) score = 1_000;
			else if (label.includes(normalizedQuery)) score = 800;
			else if (haystack.includes(normalizedQuery)) score = 600;
			return { command, index, score };
		})
		.filter((item) => item.score >= 0)
		.sort((left, right) => right.score - left.score || left.index - right.index)
		.map((item) => item.command);
}
