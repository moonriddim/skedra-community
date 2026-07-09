/**
 * Fruehe Abbruchbedingungen fuer Canvas-Keydown.
 */

export function shouldIgnoreCanvasKeyDown(
	e: KeyboardEvent,
	editingTextId: string | null,
): boolean {
	const tag = (e.target as HTMLElement).tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	if (editingTextId) return true;
	return false;
}
