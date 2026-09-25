import { useCanvasStore } from "@/hooks/use-canvas-store";
import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import { useI18n } from "@/lib/i18n";
import { useThemeStore } from "@/stores/theme";
import {
	type CanvasElement,
	type CanvasMutationPlan,
	collectMindmapDescendantIds,
	createKanbanCardElement,
	exportMindmapOutline,
	findMindmapRoot,
	getMindmapEdgeMeta,
	getMindmapLinkedCards,
	getMindmapNodeMeta,
	planMindmapLayout,
} from "@skedra/canvas-core";
import type { CanvasEditorContextMenuItem } from "@skedra/canvas-editor";
import {
	ChevronDown,
	ChevronRight,
	FileText,
	GitBranch,
	Kanban,
	LayoutList,
	Link,
	Pencil,
	Plus,
} from "lucide-react";
import { useCanvasCommands } from "../canvas-commands";

export function useMindmapContextActions({
	elements,
	selected,
	readOnly,
	enabled,
	onApply,
	onHistoryBoundary,
	onOutline,
}: {
	elements: Map<string, CanvasElement>;
	selected: CanvasElement[];
	readOnly: boolean;
	enabled: boolean;
	onApply: (plan: CanvasMutationPlan) => void;
	onHistoryBoundary: () => void;
	onOutline: (text: string) => void;
}): CanvasEditorContextMenuItem[] {
	const { t } = useI18n();
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
	const commands = useCanvasCommands();
	if (
		!enabled ||
		!selected.length ||
		selected.some((el) => !getMindmapNodeMeta(el) && !getMindmapEdgeMeta(el))
	)
		return [];
	const nodes = selected.filter((el) => getMindmapNodeMeta(el));
	if (!nodes.length) return [];
	const node = nodes.length === 1 ? nodes[0] : null;
	const root = nodes.every(
		(el) =>
			getMindmapNodeMeta(el)?.mindmapTreeId ===
			getMindmapNodeMeta(nodes[0])?.mindmapTreeId,
	)
		? findMindmapRoot(elements, nodes[0].id)
		: null;
	const disabled = readOnly || nodes.some((el) => el.locked);
	const layoutDisabled =
		disabled ||
		!root ||
		Array.from(collectMindmapDescendantIds(root.id, elements)).some(
			(id) => elements.get(id)?.locked,
		);
	const apply = (plan: CanvasMutationPlan | null) => {
		if (!plan || readOnly) return;
		onHistoryBoundary();
		onApply(plan);
		if (plan.selectedIds)
			useCanvasStore.getState().setSelectedIds(new Set(plan.selectedIds));
		onHistoryBoundary();
	};
	const actions: CanvasEditorContextMenuItem[] = [];
	const count = node
		? collectMindmapDescendantIds(node.id, elements).size - 1
		: 0;
	if (node && count > 0)
		actions.push({
			id: "mindmap-collapse",
			label: `${t(node.customData?.mindmapCollapsed ? "mindmapStudio.expand" : "mindmapStudio.collapse")} (${count})`,
			icon: node.customData?.mindmapCollapsed ? (
				<ChevronRight />
			) : (
				<ChevronDown />
			),
			disabled,
			action: () =>
				apply({
					create: [],
					deleteIds: [],
					update: [
						{
							id: node.id,
							changes: {
								customData: {
									...node.customData,
									mindmapCollapsed: !node.customData?.mindmapCollapsed,
								},
							},
						},
					],
					selectedIds: [node.id],
				}),
		});
	const children: CanvasEditorContextMenuItem[] = [];
	if (node)
		children.push(
			{
				id: "mindmap-child",
				label: t("mindmapStudio.child"),
				icon: <Plus />,
				shortcut: "Tab",
				disabled,
				action: () => commands.addMindmapChild(node.id),
			},
			{
				id: "mindmap-sibling",
				label: t("mindmapStudio.sibling"),
				icon: <Plus />,
				shortcut: "Enter",
				disabled: disabled || !getMindmapNodeMeta(node)?.mindmapParentId,
				action: () => commands.addMindmapSibling(node.id),
			},
			{
				id: "mindmap-edit",
				label: t("mindmapStudio.edit"),
				icon: <Pencil />,
				shortcut: "F2",
				disabled,
				action: () => useCanvasStore.getState().setEditingTextId(node.id),
			},
		);
	if (root)
		children.push({
			id: "mindmap-layout",
			label: t("mindmapStudio.layout"),
			icon: <LayoutList />,
			disabled: layoutDisabled,
			children: (["balanced", "right", "left", "down"] as const).map(
				(layout) => ({
					id: `mindmap-layout-${layout}`,
					label: t(`mindmapStudio.${layout}`),
					icon: <GitBranch />,
					disabled: layoutDisabled,
					action: () => apply(planMindmapLayout(elements, root.id, layout)),
				}),
			),
		});
	children.push({
		id: "mindmap-cards",
		label: t("mindmapStudio.cards"),
		icon: <Kanban />,
		disabled,
		action: () =>
			useCanvasStore.getState().startElementPlacement(
				nodes.map((node, index) => {
					const card = createKanbanCardElement(
						getCanvasElementFactoryDefaults({ resolvedTheme }),
						{
							x: index * 300,
							y: 0,
							title: node.text || t("mindmapStudio.mainTopic"),
						},
					);
					return {
						...card,
						customData: { ...card.customData, mindmapSourceId: node.id },
					};
				}),
			),
	});
	const linked = getMindmapLinkedCards(
		elements.values(),
		nodes.map((node) => node.id),
	);
	if (linked.length)
		children.push({
			id: "mindmap-linked",
			disabled: readOnly,
			label: t("mindmapStudio.linked"),
			icon: <Link />,
			children: linked.map((card) => ({
				id: card.id,
				label: card.text || t("mindmapStudio.mainTopic"),
				icon: <Kanban />,
				action: () => commands.openKanbanCard(card.id),
			})),
		});
	const outlineNode = node ?? root;
	if (outlineNode)
		children.push({
			id: "mindmap-outline",
			label: t("mindmapStudio.outline"),
			icon: <FileText />,
			action: () => onOutline(exportMindmapOutline(elements, outlineNode.id)),
		});
	actions.push({
		id: "mindmap-actions",
		label: t("mindmapStudio.title"),
		icon: <GitBranch />,
		children,
	});
	return actions;
}
