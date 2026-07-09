/**
 * Updates nach Verschieben: Kanban-Reflow und Template-Haftnotizen zuordnen.
 */

import {
	findTemplateSectionAtPoint,
	getTemplateStickyAssignmentChanges,
	getTemplateStickyNoteMeta,
} from "@/lib/canvas/template-tool-utils";
import {
	buildKanbanReflowUpdates,
	elementCenter,
	findListAtPoint,
	isKanbanCard,
	isKanbanList,
} from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";

export function collectMoveDropUpdates(
	elements: Map<string, CanvasElement>,
	moveStart: Map<string, { x: number; y: number }>,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const movedKanbanCards = new Set<string>();
	const movedTemplateNotes = new Set<string>();

	for (const [id] of moveStart) {
		const el = elements.get(id);
		if (isKanbanCard(el)) movedKanbanCards.add(id);
		if (getTemplateStickyNoteMeta(el)) movedTemplateNotes.add(id);
	}

	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];

	if (movedKanbanCards.size > 0) {
		const targetByCard = new Map<string, string | null>();
		for (const cardId of movedKanbanCards) {
			const card = elements.get(cardId);
			if (!card) continue;
			const center = elementCenter(card);
			const list = findListAtPoint(elements, center.x, center.y);
			if (list && !isKanbanList(card)) {
				targetByCard.set(cardId, list.id);
			} else {
				targetByCard.set(cardId, null);
			}
		}
		updates.push(
			...buildKanbanReflowUpdates(elements, movedKanbanCards, targetByCard),
		);
	}

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
