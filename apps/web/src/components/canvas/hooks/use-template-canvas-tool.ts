import {
	buildTemplateSectionLayoutSyncUpdates,
	createTemplateStickyNote,
} from "@/lib/canvas/template-tool-utils";
import { useThemeStore } from "@/stores/theme";
import { useCallback, useEffect } from "react";
import type { CanvasStore, CanvasSync } from "../canvas-tool-types";

interface UseTemplateCanvasToolOptions {
	sync: CanvasSync;
	store: CanvasStore;
}

export function useTemplateCanvasTool({
	sync,
	store,
}: UseTemplateCanvasToolOptions) {
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
	useEffect(() => {
		const templateLayoutUpdates = buildTemplateSectionLayoutSyncUpdates(
			sync.elements,
		);
		if (templateLayoutUpdates.length > 0) {
			sync.updateElements(templateLayoutUpdates);
		}
	}, [sync.elements, sync.updateElements]);

	const addTemplateStickyNote = useCallback(
		(sectionId: string) => {
			const section = sync.elements.get(sectionId);
			if (!section) return;

			const notes = createTemplateStickyNote({
				section,
				existingElements: sync.elements.values(),
				theme: { resolvedTheme },
			});
			if (notes.length === 0) return;

			const [note] = notes;
			const requiredHeight = note.y + note.height + 18 - section.y;
			if (requiredHeight > section.height) {
				sync.updateElement(section.id, { height: requiredHeight });
			}

			for (const element of notes) sync.createElement(element);
			store.setSelectedIds(new Set([note.id]));
			store.setEditingTextId(note.id);
		},
		[resolvedTheme, store, sync],
	);

	return { addTemplateStickyNote };
}
