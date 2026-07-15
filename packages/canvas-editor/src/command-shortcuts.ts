export type CanvasEditorUiShortcutId = "command-browser" | "find-on-canvas";

export interface CanvasEditorUiShortcut {
	key: string;
	shift?: boolean;
	alt?: boolean;
	allowAlt?: boolean;
	label: string;
}

/**
 * Entry-point shortcuts shared by the keyboard resolver and every host UI.
 * Labels intentionally use `Mod` so the rendering host can localize the
 * primary modifier for macOS without duplicating the binding itself.
 */
export const CANVAS_EDITOR_UI_SHORTCUTS = {
	"command-browser": [
		{ key: "/", label: "Mod+/" },
		{ key: "p", shift: true, allowAlt: true, label: "Mod+Shift+P" },
	],
	"find-on-canvas": [{ key: "f", label: "Mod+F" }],
} as const satisfies Record<
	CanvasEditorUiShortcutId,
	readonly CanvasEditorUiShortcut[]
>;

type ShortcutKeyboardEvent = Pick<
	KeyboardEvent,
	"key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
>;

export function matchesCanvasEditorUiShortcut(
	event: ShortcutKeyboardEvent,
	id: CanvasEditorUiShortcutId,
): boolean {
	if (!event.ctrlKey && !event.metaKey) return false;
	const key = event.key.toLocaleLowerCase();
	const shortcuts: readonly CanvasEditorUiShortcut[] =
		CANVAS_EDITOR_UI_SHORTCUTS[id];
	return shortcuts.some(
		(shortcut) =>
			key === shortcut.key &&
			event.shiftKey === Boolean(shortcut.shift) &&
			(shortcut.allowAlt || event.altKey === Boolean(shortcut.alt)),
	);
}

export function getCanvasEditorUiShortcutLabels(
	id: CanvasEditorUiShortcutId,
): readonly string[] {
	return CANVAS_EDITOR_UI_SHORTCUTS[id].map((shortcut) => shortcut.label);
}
