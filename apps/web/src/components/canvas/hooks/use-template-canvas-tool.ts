import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import { buildTemplateSectionLayoutSyncUpdates } from "@/lib/canvas/template-tool-utils";
import { useThemeStore } from "@/stores/theme";
import { createCanvasTemplateStickyNote } from "@skedra/canvas-core";
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

			const note = createCanvasTemplateStickyNote({
				defaults: getCanvasElementFactoryDefaults({ resolvedTheme }),
				section,
				existingElements: sync.elements.values(),
			});
			if (!note) return;
			const requiredHeight = note.y + note.height + 18 - section.y;
			if (requiredHeight > section.height) {
				sync.updateElement(section.id, { height: requiredHeight });
			}

			sync.createElement(note);
			store.setSelectedIds(new Set([note.id]));
			store.setEditingTextId(note.id);
		},
		[
			resolvedTheme,
			store.setEditingTextId,
			store.setSelectedIds,
			sync.createElement,
			sync.elements,
			sync.updateElement,
		],
	);

	return { addTemplateStickyNote };
}
