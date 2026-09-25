import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import type { KanbanChecklistItem } from "@skedra/canvas-core";
import { Plus, Trash2 } from "lucide-react";
import { nanoid } from "nanoid";
import { useRef } from "react";
import { flushSync } from "react-dom";

export function KanbanChecklistEditor({
	items,
	onChange,
	hideCompleted,
}: {
	items: KanbanChecklistItem[];
	onChange: (items: KanbanChecklistItem[]) => void;
	hideCompleted: boolean;
}) {
	const { t } = useI18n();
	const inputs = useRef(new Map<string, HTMLInputElement>());
	const focus = (next: KanbanChecklistItem[], id: string) => {
		flushSync(() => onChange(next));
		inputs.current.get(id)?.focus();
		inputs.current.get(id)?.scrollIntoView({ block: "nearest" });
	};
	const insert = (after?: string) => {
		const empty = items.find((item) => !item.text.trim());
		if (empty) {
			inputs.current.get(empty.id)?.focus();
			return;
		}
		const item = { id: `check-${nanoid(10)}`, text: "", completed: false };
		const index = after
			? items.findIndex((entry) => entry.id === after) + 1
			: items.length;
		focus([...items.slice(0, index), item, ...items.slice(index)], item.id);
	};
	return (
		<div className="min-w-0 space-y-2" data-kanban-checklist-editor="true">
			{items
				.filter((item) => !hideCompleted || !item.completed)
				.map((item, index) => (
					<div
						key={item.id}
						className="flex min-w-0 items-center gap-1 rounded-md border border-border bg-background p-1"
					>
						<label className="flex h-11 w-11 shrink-0 items-center justify-center">
							<input
								type="checkbox"
								aria-label={
									item.text || t("kanbanCardDialog.checkpointPlaceholder")
								}
								checked={item.completed}
								className="h-5 w-5 accent-primary"
								onChange={(event) =>
									onChange(
										items.map((entry) =>
											entry.id === item.id
												? { ...entry, completed: event.target.checked }
												: entry,
										),
									)
								}
							/>
						</label>
						<Input
							enterKeyHint="next"
							autoComplete="off"
							ref={(node) => {
								if (node) inputs.current.set(item.id, node);
								else inputs.current.delete(item.id);
							}}
							aria-label={`${t("kanbanCardDialog.checklist")} ${index + 1}`}
							placeholder={t("kanbanCardDialog.checkpointPlaceholder")}
							value={item.text}
							className={`min-w-0 flex-1 border-0 bg-transparent px-1 text-base shadow-none ${item.completed ? "text-muted-foreground line-through" : ""}`}
							onChange={(event) =>
								onChange(
									items.map((entry) =>
										entry.id === item.id
											? { ...entry, text: event.target.value }
											: entry,
									),
								)
							}
							onBlur={() => {
								if (!item.text.trim())
									onChange(items.filter((entry) => entry.id !== item.id));
							}}
							onKeyDown={(event) => {
								if (event.nativeEvent.isComposing) return;
								if (event.key === "Enter") {
									event.preventDefault();
									if (item.text.trim()) insert(item.id);
									else event.currentTarget.blur();
								}
								if (event.key === "Backspace" && !item.text) {
									event.preventDefault();
									const previous =
										items[items.findIndex((entry) => entry.id === item.id) - 1];
									focus(
										items.filter((entry) => entry.id !== item.id),
										previous?.id ?? "",
									);
								}
							}}
							onPaste={(event) => {
								const pasted = event.clipboardData.getData("text");
								if (!/[\r\n]/.test(pasted)) return;
								event.preventDefault();
								const input = event.currentTarget;
								const text =
									item.text.slice(0, input.selectionStart ?? 0) +
									pasted +
									item.text.slice(input.selectionEnd ?? item.text.length);
								const lines = text
									.split(/\r?\n/)
									.map((line) => line.trim())
									.filter(Boolean);
								if (!lines.length) return;
								const entries = lines.map((text, index) => ({
									id: index === 0 ? item.id : `check-${nanoid(10)}`,
									text,
									completed: index === 0 && item.completed,
								}));
								const at = items.findIndex((entry) => entry.id === item.id);
								focus(
									[...items.slice(0, at), ...entries, ...items.slice(at + 1)],
									entries[entries.length - 1].id,
								);
							}}
						/>
						<Button
							type="button"
							size="icon"
							variant="ghost"
							className="h-11 w-11 shrink-0"
							aria-label={t("common.delete")}
							onClick={() =>
								onChange(items.filter((entry) => entry.id !== item.id))
							}
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				))}
			<Button
				type="button"
				variant="outline"
				className="min-h-11 w-full justify-start"
				onClick={() => insert()}
			>
				<Plus className="h-4 w-4" />
				{t("kanbanCardDialog.addCheckpoint")}
			</Button>
		</div>
	);
}
