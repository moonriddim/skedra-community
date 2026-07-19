import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import {
	getDefaultKanbanBoardLists,
	getDefaultKanbanCardTitle,
	getDefaultKanbanListName,
	getKanbanPriorities,
} from "@/lib/canvas/kanban-options";
import { useI18n } from "@/lib/i18n";
import { useThemeStore } from "@/stores/theme";
import {
	type CanvasElement,
	type KanbanPriority,
	createKanbanBoardElements,
	createKanbanListElements,
} from "@skedra/canvas-core";
import { useCanvasEditorFloatingPanel } from "@skedra/canvas-editor";
import { LayoutList, Plus, Square, X } from "lucide-react";

interface KanbanPanelProps {
	onAdd: (elements: CanvasElement[]) => void;
	getViewportCenter: () => { x: number; y: number };
	onPlacePriorityCard: (
		priority: KanbanPriority | null,
		pointer: { clientX: number; clientY: number },
	) => void;
	onClose: () => void;
}

export function KanbanPanel({
	onAdd,
	getViewportCenter,
	onPlacePriorityCard,
	onClose,
}: KanbanPanelProps) {
	const floatingPanel = useCanvasEditorFloatingPanel<HTMLDivElement>();
	const { t } = useI18n();
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
	const priorities = getKanbanPriorities();
	const offset = () => ({
		dx: Math.random() * 40 - 20,
		dy: Math.random() * 40 - 20,
	});

	const handleAddBoard = () => {
		const center = getViewportCenter();
		const { dx, dy } = offset();
		onAdd(
			createKanbanBoardElements(
				getCanvasElementFactoryDefaults({ resolvedTheme }),
				{
					x: center.x - 450 + dx,
					y: center.y - 200 + dy,
					lists: getDefaultKanbanBoardLists(),
					defaultCardTitle: getDefaultKanbanCardTitle(),
				},
			),
		);
	};

	const handleAddList = () => {
		const center = getViewportCenter();
		const { dx, dy } = offset();
		onAdd(
			createKanbanListElements(
				getCanvasElementFactoryDefaults({ resolvedTheme }),
				{
					x: center.x - 140 + dx,
					y: center.y - 150 + dy,
					name: getDefaultKanbanListName(),
					cardTitles: [getDefaultKanbanCardTitle()],
				},
			),
		);
	};

	const handleAddCard = (
		priority: KanbanPriority | null,
		event: React.MouseEvent<HTMLButtonElement>,
	) => {
		onPlacePriorityCard(priority, {
			clientX: event.clientX,
			clientY: event.clientY,
		});
	};

	return (
		<div
			ref={floatingPanel.panelRef}
			className="absolute top-14 right-4 z-40 w-64 rounded-xl border border-border bg-card/95 p-3 text-card-foreground shadow-xl backdrop-blur max-lg:top-auto max-lg:right-1/2 max-lg:bottom-[calc(8.5rem+env(safe-area-inset-bottom))] max-lg:max-h-[min(42dvh,22rem)] max-lg:w-[min(22rem,calc(100vw-1.5rem-env(safe-area-inset-left)-env(safe-area-inset-right)))] max-lg:translate-x-1/2 max-lg:overflow-y-auto"
			style={floatingPanel.panelStyle}
		>
			<div
				className="mb-2 flex items-center justify-between"
				{...floatingPanel.dragHandleProps}
			>
				<h3 className="text-sm font-semibold text-card-foreground">
					{t("kanbanPanel.title")}
				</h3>
				<button
					type="button"
					onClick={onClose}
					className="cursor-pointer text-muted-foreground hover:text-foreground max-lg:flex max-lg:h-11 max-lg:w-11 max-lg:items-center max-lg:justify-center"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
			<p className="mb-3 text-xs text-muted-foreground">
				{t("kanbanPanel.description")}
			</p>

			<div className="space-y-1.5">
				<button
					type="button"
					onClick={handleAddBoard}
					className="flex w-full cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent max-lg:min-h-11"
				>
					<LayoutList className="h-4 w-4 text-primary" />
					<div className="text-left">
						<div className="font-medium">{t("kanbanPanel.fullBoard")}</div>
						<div className="text-[10px] text-muted-foreground">
							{t("kanbanPanel.fullBoardDescription")}
						</div>
					</div>
				</button>

				<button
					type="button"
					onClick={handleAddList}
					className="flex w-full cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent max-lg:min-h-11"
				>
					<Plus className="h-4 w-4 text-primary" />
					<div className="text-left">
						<div className="font-medium">{t("kanbanPanel.singleList")}</div>
						<div className="text-[10px] text-muted-foreground">
							{t("kanbanPanel.singleListDescription")}
						</div>
					</div>
				</button>
			</div>

			<div className="mt-3 border-t pt-3">
				<p className="mb-2 text-[11px] font-medium text-muted-foreground">
					{t("kanbanPanel.cardWithPriority")}
				</p>
				<div className="grid grid-cols-2 gap-1.5">
					<button
						type="button"
						onClick={(event) => handleAddCard(null, event)}
						className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs transition-colors hover:bg-accent max-lg:min-h-11"
					>
						<Square
							className="h-3 w-3"
							style={{ color: "#ADB5BD", fill: "#ADB5BD" }}
						/>
						{t("common.none")}
					</button>
					{priorities.map((priority) => (
						<button
							key={priority.value}
							type="button"
							onClick={(event) => handleAddCard(priority.value, event)}
							className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs transition-colors hover:bg-accent max-lg:min-h-11"
						>
							<Square
								className="h-3 w-3"
								style={{ color: priority.color, fill: priority.color }}
							/>
							{priority.label}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
