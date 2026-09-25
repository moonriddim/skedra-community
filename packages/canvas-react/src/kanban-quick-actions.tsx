import type { CanvasElement, KanbanPriority } from "@skedra/canvas-core";
import { useState } from "react";
import { useCanvasRendererConfig } from "./renderer-config";

export function KanbanQuickActions({
	element,
	editable,
}: { element: CanvasElement; editable: boolean }) {
	const {
		actions,
		translate: t,
		formatDateTime,
		getDueStatus,
	} = useCanvasRendererConfig();
	const priority = element.customData?.priority as KanbanPriority | null;
	const dueDate = element.customData?.dueDate as string | null;
	const due = getDueStatus(dueDate, !!element.customData?.dueComplete);
	const [dateFocused, setDateFocused] = useState(false);
	const stop = (event: React.SyntheticEvent) => event.stopPropagation();
	const controlStyle = {
		minHeight: 40,
		minWidth: 0,
		border: "1px solid var(--kanban-card-border)",
		borderRadius: 6,
		padding: "4px 6px",
		background: "var(--kanban-card-bg)",
		color: "var(--kanban-card-text)",
		fontFamily: "inherit",
		fontSize: 12,
		cursor: "pointer",
	};
	return (
		<div
			data-kanban-quick-actions="true"
			style={{
				display: "flex",
				gap: 5,
				marginTop: "auto",
				flexShrink: 0,
				alignItems: "stretch",
			}}
			onPointerDown={editable ? stop : undefined}
			onPointerUp={editable ? stop : undefined}
			onClick={editable ? stop : undefined}
			onDoubleClick={editable ? stop : undefined}
			onKeyDown={editable ? stop : undefined}
		>
			{editable ? (
				<select
					aria-label={t("canvas.kanban.priority")}
					value={priority ?? ""}
					style={{ ...controlStyle, flex: 1 }}
					onChange={(event) =>
						actions.updateKanbanCard?.(element.id, {
							priority: (event.target.value || null) as KanbanPriority | null,
						})
					}
				>
					<option value="">{t("canvas.kanban.noPriority")}</option>
					{(["low", "medium", "high", "urgent"] as const).map((value) => (
						<option key={value} value={value}>
							{t(`canvas.kanban.${value}`)}
						</option>
					))}
				</select>
			) : priority ? (
				<span style={{ fontSize: 12 }}>{t(`canvas.kanban.${priority}`)}</span>
			) : null}
			{(editable || dueDate) && (
				<div
					title={
						dueDate
							? `${due.label} ${formatDateTime(dueDate)}`
							: t("canvas.kanban.dueDate")
					}
					style={{
						...controlStyle,
						flex: 1,
						display: "flex",
						alignItems: "center",
						position: "relative",
						outline: dateFocused ? "2px solid #14b8a6" : undefined,
						color: dueDate ? due.textColor : controlStyle.color,
						background: dueDate ? due.background : controlStyle.background,
					}}
				>
					<span
						style={{
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{dueDate ? formatDateTime(dueDate) : t("canvas.kanban.dueDate")}
					</span>
					{editable && (
						<input
							onFocus={() => setDateFocused(true)}
							onBlur={() => setDateFocused(false)}
							type="date"
							aria-label={t("canvas.kanban.dueDate")}
							value={dueDate?.slice(0, 10) ?? ""}
							style={{
								position: "absolute",
								inset: 0,
								opacity: 0,
								width: "100%",
								height: "100%",
								fontSize: 16,
								cursor: "pointer",
							}}
							onClick={(event) => {
								try {
									event.currentTarget.showPicker?.();
								} catch {
									/* Native input remains available when picker APIs are restricted. */
								}
							}}
							onChange={(event) =>
								actions.updateKanbanCard?.(element.id, {
									dueDate: event.target.value
										? event.target.value + (dueDate?.slice(10) ?? "")
										: null,
								})
							}
						/>
					)}
				</div>
			)}
			{editable && (
				<button
					type="button"
					aria-label={t("canvas.kanban.details")}
					title={t("canvas.kanban.details")}
					style={{ ...controlStyle, minWidth: 40, fontSize: 22 }}
					onClick={() => actions.openKanbanCard(element.id)}
				>
					…
				</button>
			)}
		</div>
	);
}
