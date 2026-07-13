import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import { getDefaultKanbanCardTitle } from "@/lib/canvas/kanban-options";
import { buildTemplateSectionLayoutSyncUpdates } from "@/lib/canvas/template-tool-utils";
import { translate } from "@/lib/i18n";
import { getCurrentLocale } from "@/stores/locale";
import { useThemeStore } from "@/stores/theme";
import {
	computeKanbanCardHeight,
	createKanbanCardElement,
	normalizeKanbanAttachments,
	normalizeKanbanChecklist,
	normalizeKanbanCoverImage,
} from "@skedra/canvas-core";
import { getKanbanAssignmentBadgeCount } from "@skedra/canvas-core";
import {
	buildKanbanReflowUpdates,
	executeCanvasMutationPlan,
	isKanbanCard,
	planCanvasDeletion,
	planKanbanCardInsertion,
} from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { useCallback, useEffect, useState } from "react";
import type { CanvasStore, CanvasSync } from "../canvas-tool-types";

interface UseKanbanCanvasToolOptions {
	sync: CanvasSync;
	store: CanvasStore;
}

export function useKanbanCanvasTool({
	sync,
	store,
}: UseKanbanCanvasToolOptions) {
	const [kanbanDetailId, setKanbanDetailId] = useState<string | null>(null);
	const [kanbanListDetailId, setKanbanListDetailId] = useState<string | null>(
		null,
	);
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);

	const deleteElementsWithKanbanReflow = useCallback(
		(ids: string[]) => {
			if (ids.length === 0) return;
			const plan = planCanvasDeletion(sync.elements, ids);
			executeCanvasMutationPlan(
				{
					...plan,
					update: [
						...plan.update,
						...buildTemplateSectionLayoutSyncUpdates(sync.elements, {
							excludeIds: plan.deleteIds,
						}),
					],
				},
				sync,
			);
		},
		[sync],
	);

	useEffect(() => {
		const baseUpdates: Array<{ id: string; changes: Partial<CanvasElement> }> =
			[];
		const changedCardIds = new Set<string>();
		const movedCards = new Set<string>();
		const targetByCard = new Map<string, string | null>();
		const nextElements = new Map(sync.elements);

		for (const element of sync.elements.values()) {
			if (!isKanbanCard(element)) continue;

			const nextHeight = computeKanbanCardHeight({
				title:
					element.text ??
					translate(getCurrentLocale(), "canvas.kanban.newCard"),
				description:
					(element.customData?.description as string | undefined) ?? "",
				coverImage: normalizeKanbanCoverImage(element.customData),
				checklist: normalizeKanbanChecklist(element.customData?.checklist),
				attachments: normalizeKanbanAttachments(element.customData),
				startDate:
					(element.customData?.startDate as string | null | undefined) ?? null,
				dueDate:
					(element.customData?.dueDate as string | null | undefined) ?? null,
				assignmentBadges: getKanbanAssignmentBadgeCount(element.customData),
			});

			if (element.height === nextHeight) continue;

			baseUpdates.push({ id: element.id, changes: { height: nextHeight } });
			changedCardIds.add(element.id);
			nextElements.set(element.id, { ...element, height: nextHeight });

			if (element.frameId) {
				movedCards.add(element.id);
				targetByCard.set(element.id, element.frameId);
			}
		}

		if (baseUpdates.length === 0) return;

		const reflowUpdates =
			movedCards.size > 0
				? buildKanbanReflowUpdates(
						nextElements,
						movedCards,
						targetByCard,
					).filter((update) => !changedCardIds.has(update.id))
				: [];

		sync.updateElements([...baseUpdates, ...reflowUpdates]);
	}, [sync.elements, sync.updateElements]);

	const addKanbanCard = useCallback(
		(listId: string) => {
			const list = sync.elements.get(listId);
			if (!list || list.customData?.skedraType !== "kanban-list") return;

			const card = createKanbanCardElement(
				getCanvasElementFactoryDefaults({ resolvedTheme }),
				{
					x: list.x + 12,
					y: list.y + list.height + 1000,
					title: getDefaultKanbanCardTitle(),
					listId,
				},
			);
			const plan = planKanbanCardInsertion({
				elements: sync.elements,
				listId,
				card,
			});
			if (!plan) return;
			executeCanvasMutationPlan(plan, {
				...sync,
				setSelectedIds: store.setSelectedIds,
			});
			setKanbanDetailId(card.id);
		},
		[resolvedTheme, store, sync],
	);

	return {
		kanbanDetailId,
		kanbanListDetailId,
		setKanbanDetailId,
		setKanbanListDetailId,
		addKanbanCard,
		deleteElementsWithKanbanReflow,
	};
}
