/**
 * Updates nach Verschieben: Kanban-Reflow und Template-Haftnotizen zuordnen.
 */

import {
	buildKanbanDropUpdates,
	buildTemplateDropUpdates,
} from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";

export function collectMoveDropUpdates(
	elements: Map<string, CanvasElement>,
	moveStart: Map<string, { x: number; y: number }>,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	return [
		...buildKanbanDropUpdates(elements, moveStart.keys()),
		...buildTemplateDropUpdates(elements, moveStart.keys()),
	];
}
