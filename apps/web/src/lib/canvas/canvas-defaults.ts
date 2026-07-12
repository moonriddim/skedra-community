/**
 * Theme-abhaengige Canvas-Defaults (Strichfarbe, Handschrift-Font, Werkzeug-Farben).
 * Zentral, damit neue Elemente im Dark Mode sichtbar bleiben.
 */

/** Sketch-Handschrift fuer Canvas-Text (Excalidraw-Stil) */
export const CANVAS_HAND_FONT =
	'"Kalam", "Architects Daughter", "Segoe Print", cursive';

/** Standard-Schrift fuer skizzenhafte Werkzeuge (Mindmap, Flowchart, Templates, …) */
export const TOOL_FONT_FAMILY = CANVAS_HAND_FONT;

/** Standard-Schrift fuer Kanban (klar lesbar, kein Handschrift-Look) */
export const KANBAN_FONT_FAMILY = "system-ui, sans-serif";

/** Standard-Schrift fuer neue Canvas-Texte */
export const CANVAS_DEFAULT_FONT = "Comic Sans MS, Comic Sans, cursive";

export const LIGHT_STROKE = "#1e1e1e";
const DARK_STROKE = "#f1f3f5";

const LIGHT_TEXT = "#18201c";
const DARK_TEXT = "#e6efe8";
const LIGHT_MUTED_TEXT = "#64748B";
const DARK_MUTED_TEXT = "#95a59d";

const LIGHT_NODE_FILL = "#ffffff";
const DARK_NODE_FILL = "#151d19";
const LIGHT_MINDMAP_ROOT_FILL = "#F8FAFC";
const DARK_MINDMAP_ROOT_FILL = "#1d2823";
const LIGHT_MINDMAP_ROOT_STROKE = "#0F172A";
const DARK_MINDMAP_ROOT_STROKE = "#e6efe8";
const LIGHT_MINDMAP_CHILD_BORDER = "#CBD5E1";
const DARK_MINDMAP_CHILD_BORDER = "#3a454e";
const LIGHT_MINDMAP_CHILD_TEXT = "#334155";
const DARK_MINDMAP_CHILD_TEXT = "#cbd5e1";

export type CanvasResolvedTheme = "light" | "dark";

export interface CanvasThemeState {
	resolvedTheme: CanvasResolvedTheme;
}

export const DEFAULT_CANVAS_THEME: CanvasThemeState = {
	resolvedTheme: "light",
};

function isCanvasDarkMode(theme = DEFAULT_CANVAS_THEME): boolean {
	return theme.resolvedTheme === "dark";
}

/** Gibt die passende Default-Strichfarbe fuer das aktuelle Theme zurueck */
export function getDefaultStrokeColor(
	theme: CanvasThemeState = DEFAULT_CANVAS_THEME,
): string {
	return isCanvasDarkMode(theme) ? DARK_STROKE : LIGHT_STROKE;
}

function getDefaultTextColor(theme = DEFAULT_CANVAS_THEME): string {
	return isCanvasDarkMode(theme) ? DARK_TEXT : LIGHT_TEXT;
}

export function getDefaultMutedTextColor(
	theme: CanvasThemeState = DEFAULT_CANVAS_THEME,
): string {
	return isCanvasDarkMode(theme) ? DARK_MUTED_TEXT : LIGHT_MUTED_TEXT;
}

export function getDefaultNodeFill(
	theme: CanvasThemeState = DEFAULT_CANVAS_THEME,
): string {
	return isCanvasDarkMode(theme) ? DARK_NODE_FILL : LIGHT_NODE_FILL;
}

export function getDefaultMindmapRootFill(
	theme: CanvasThemeState = DEFAULT_CANVAS_THEME,
): string {
	return isCanvasDarkMode(theme)
		? DARK_MINDMAP_ROOT_FILL
		: LIGHT_MINDMAP_ROOT_FILL;
}

export function getDefaultMindmapRootStroke(
	theme: CanvasThemeState = DEFAULT_CANVAS_THEME,
): string {
	return isCanvasDarkMode(theme)
		? DARK_MINDMAP_ROOT_STROKE
		: LIGHT_MINDMAP_ROOT_STROKE;
}

export function getDefaultMindmapChildBorder(
	theme: CanvasThemeState = DEFAULT_CANVAS_THEME,
): string {
	return isCanvasDarkMode(theme)
		? DARK_MINDMAP_CHILD_BORDER
		: LIGHT_MINDMAP_CHILD_BORDER;
}

export function getDefaultMindmapRootTextColor(
	theme: CanvasThemeState = DEFAULT_CANVAS_THEME,
): string {
	return isCanvasDarkMode(theme)
		? DARK_MINDMAP_ROOT_STROKE
		: LIGHT_MINDMAP_ROOT_STROKE;
}

export function getDefaultMindmapChildTextColor(
	theme: CanvasThemeState = DEFAULT_CANVAS_THEME,
): string {
	return isCanvasDarkMode(theme)
		? DARK_MINDMAP_CHILD_TEXT
		: LIGHT_MINDMAP_CHILD_TEXT;
}

/** Alle System-Default-Strichfarben (fuer automatisches Theme-Sync) */
export const THEME_STROKE_DEFAULTS = [
	LIGHT_STROKE,
	"#000000",
	DARK_STROKE,
	"#e2e8f0",
	"#ffffff",
] as const;

const THEME_TEXT_DEFAULTS = [
	LIGHT_TEXT,
	DARK_TEXT,
	LIGHT_MUTED_TEXT,
	DARK_MUTED_TEXT,
] as const;

export const THEME_FILL_DEFAULTS = [
	LIGHT_NODE_FILL,
	DARK_NODE_FILL,
	LIGHT_MINDMAP_ROOT_FILL,
	DARK_MINDMAP_ROOT_FILL,
	"#fffef9",
] as const;

export const THEME_MINDMAP_ROOT_STROKE_DEFAULTS = [
	LIGHT_MINDMAP_ROOT_STROKE,
	DARK_MINDMAP_ROOT_STROKE,
] as const;

export const THEME_MINDMAP_BORDER_DEFAULTS = [
	LIGHT_MINDMAP_CHILD_BORDER,
	DARK_MINDMAP_CHILD_BORDER,
] as const;

export const THEME_MINDMAP_ROOT_TEXT_DEFAULTS = [
	LIGHT_MINDMAP_ROOT_STROKE,
	DARK_MINDMAP_ROOT_STROKE,
	...THEME_TEXT_DEFAULTS,
] as const;

export const THEME_MINDMAP_CHILD_TEXT_DEFAULTS = [
	LIGHT_MINDMAP_CHILD_TEXT,
	DARK_MINDMAP_CHILD_TEXT,
	LIGHT_MUTED_TEXT,
	DARK_MUTED_TEXT,
] as const;

export const THEME_MUTED_TEXT_DEFAULTS = [
	LIGHT_MUTED_TEXT,
	DARK_MUTED_TEXT,
] as const;

/** Bisherige System-Schriften der Werkzeuge (fuer Font-Migration beim Theme-Sync) */
