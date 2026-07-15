import {
	getTemplateSectionMeta,
	getTemplateStickyNoteMeta,
	isRecord,
	listSectionStickyNotes,
} from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";

export function buildTemplateSectionPaletteUpdates(
	section: CanvasElement,
	elements: Map<string, CanvasElement>,
	options: { accent?: string; stickyColor?: string },
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const sectionMeta = getTemplateSectionMeta(section);
	if (!sectionMeta) return [];
	const accent = options.accent ?? sectionMeta.templateAccent;
	const stickyColor = options.stickyColor ?? sectionMeta.stickyColor;
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [
		{
			id: section.id,
			changes: {
				stroke: accent,
				customData: {
					...(isRecord(section.customData) ? section.customData : {}),
					templateAccent: accent,
					...(stickyColor ? { stickyColor } : {}),
				},
			},
		},
	];
	for (const note of listSectionStickyNotes(section.id, elements.values())) {
		const noteMeta = getTemplateStickyNoteMeta(note);
		if (!noteMeta) continue;
		updates.push({
			id: note.id,
			changes: {
				stroke: accent,
				...(stickyColor ? { fill: stickyColor } : {}),
				customData: {
					...(isRecord(note.customData) ? note.customData : {}),
					templateAccent: accent,
					...(stickyColor ? { stickyColor } : {}),
				},
			},
		});
	}
	return updates;
}
