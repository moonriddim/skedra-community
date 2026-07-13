/**
 * Updates nach Verschieben: Kanban-Reflow und Template-Haftnotizen zuordnen.
 */

import {
	buildKanbanDropUpdates,
	elementCenter,
	findTemplateSectionAtPoint,
	getTemplateStickyAssignmentChanges,
	getTemplateStickyNoteMeta,
} from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";

export function collectMoveDropUpdates(
	elements: Map<string, CanvasElement>,
	moveStart: Map<string, { x: number; y: number }>,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const movedTemplateNotes = new Set<string>();

	for (const [id] of moveStart) {
		const el = elements.get(id);
		if (getTemplateStickyNoteMeta(el)) movedTemplateNotes.add(id);
	}

	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [
		...buildKanbanDropUpdates(elements, moveStart.keys()),
	];

	if (movedTemplateNotes.size > 0) {
		for (const noteId of movedTemplateNotes) {
			const note = elements.get(noteId);
			if (!note) continue;
			const center = elementCenter(note);
			const section = findTemplateSectionAtPoint(
				elements.values(),
				center.x,
				center.y,
			);
			const changes = getTemplateStickyAssignmentChanges(note, section);
			if (Object.keys(changes).length > 0) {
				updates.push({ id: noteId, changes });
			}
		}
	}

	return updates;
}
