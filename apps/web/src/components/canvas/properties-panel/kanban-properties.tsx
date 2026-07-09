/**
 * Kanban-Liste und -Karte: Titel, Prioritaet, Aktionen.
 */

import { getKanbanPriorities } from "@/lib/canvas/kanban-options";
import { useI18n } from "@/lib/i18n";
import type { KanbanPriority } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { Pencil, Plus } from "lucide-react";
import { Section } from "./controls";

interface KanbanPropertiesProps {
	selected: CanvasElement[];
	isKanbanListSelection: boolean;
	isKanbanCardSelection: boolean;
	kanbanList: CanvasElement | null;
	currentPriority: KanbanPriority | null;
	onSetPriority: (priority: KanbanPriority | null) => void;
	onOpenListDetail: () => void;
	onAddCardToList: () => void;
	onOpenCardDetail: () => void;
}

export function KanbanProperties({
	selected,
	isKanbanListSelection,
	isKanbanCardSelection,
	kanbanList,
	currentPriority,
	onSetPriority,
	onOpenListDetail,
	onAddCardToList,
	onOpenCardDetail,
}: KanbanPropertiesProps) {
	const { t } = useI18n();
	const kanbanPriorities = getKanbanPriorities();

	return (
		<>
			{isKanbanListSelection && kanbanList && (
				<>
					<Section label={t("canvas.properties.listTitle")}>
						<button
							type="button"
							onClick={onOpenListDetail}
							className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-border hover:border-primary hover:bg-primary/10 transition-all cursor-pointer"
						>
							<Pencil className="h-3.5 w-3.5" />
							<span>{t("canvas.properties.editTitle")}</span>
						</button>
					</Section>
					<Section label={t("canvas.properties.actions")}>
						<button
							type="button"
							onClick={onAddCardToList}
							className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-border hover:border-primary hover:bg-primary/10 transition-all cursor-pointer"
						>
							<Plus className="h-3.5 w-3.5" />
							<span>{t("canvas.properties.addCard")}</span>
						</button>
					</Section>
				</>
			)}

			{isKanbanCardSelection && (
				<Section label={t("canvas.properties.priority")}>
					<div className="grid grid-cols-2 gap-1">
						<button
							type="button"
							onClick={() => onSetPriority(null)}
							className={`py-1 px-1.5 rounded border transition-all cursor-pointer flex items-center gap-1 ${
								currentPriority === null
									? "border-primary bg-primary/20"
									: "border-border hover:border-muted-foreground"
							}`}
							title={t("common.none")}
						>
							<div
								className="w-2.5 h-2.5 rounded-sm"
								style={{ backgroundColor: "var(--kanban-priority-none)" }}
							/>
							<span className="text-[10px]">{t("common.none")}</span>
						</button>
						{kanbanPriorities.map((p) => (
							<button
								key={p.value}
								type="button"
								onClick={() => onSetPriority(p.value)}
								className={`py-1 px-1.5 rounded border transition-all cursor-pointer flex items-center gap-1 ${
									currentPriority === p.value
										? "border-primary bg-primary/20"
										: "border-border hover:border-muted-foreground"
								}`}
								title={p.label}
							>
								<div
									className="w-2.5 h-2.5 rounded-sm"
									style={{ backgroundColor: p.color }}
								/>
								<span className="text-[10px]">{p.label}</span>
							</button>
						))}
					</div>
				</Section>
			)}

			{isKanbanCardSelection && selected.length === 1 && (
				<Section label={t("canvas.properties.actions")}>
					<button
						type="button"
						onClick={onOpenCardDetail}
						className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-border hover:border-primary hover:bg-primary/10 transition-all cursor-pointer"
					>
						<Pencil className="h-3.5 w-3.5" />
						<span>{t("canvas.properties.editDetails")}</span>
					</button>
				</Section>
			)}
		</>
	);
}
