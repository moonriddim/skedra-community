import {
	KANBAN_CARD_COVER_HEIGHT,
	normalizeKanbanAttachments,
	normalizeKanbanChecklist,
	normalizeKanbanCoverImage,
} from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { KanbanInlineTitle } from "./kanban-inline-title";
import { KanbanQuickActions } from "./kanban-quick-actions";
import { useCanvasRendererConfig } from "./renderer-config";

export function KanbanCardShape({
	el,
	transform,
	commonProps,
	resolveAssetUrl,
}: {
	el: CanvasElement;
	transform: string | undefined;
	commonProps: { "data-element-id": string; opacity: number };
	resolveAssetUrl?: (src: string) => string;
}) {
	const {
		actions,
		formatDateTime,
		getUserInitials,
		interactive,
		kanbanFontFamily,
		svgIdPrefix,
		translate,
	} = useCanvasRendererConfig();
	const canEdit = interactive && !el.locked && !!actions.updateKanbanCard;
	const stopInteraction = (event: React.SyntheticEvent) =>
		event.stopPropagation();
	const priority = el.customData?.priority as
		| "low"
		| "medium"
		| "high"
		| "urgent"
		| null
		| undefined;
	const priorityVar =
		priority === "urgent"
			? "var(--kanban-priority-urgent)"
			: priority === "high"
				? "var(--kanban-priority-high)"
				: priority === "medium"
					? "var(--kanban-priority-medium)"
					: priority === "low"
						? "var(--kanban-priority-low)"
						: null;
	const description = (el.customData?.description as string | undefined) || "";
	const startDate = el.customData?.startDate as string | null | undefined;
	const assigneeName =
		typeof el.customData?.assigneeName === "string"
			? el.customData.assigneeName
			: "";
	const roleName =
		typeof el.customData?.roleName === "string"
			? el.customData.roleName
			: typeof el.customData?.groupName === "string"
				? el.customData.groupName
				: "";
	const roleColor =
		typeof el.customData?.roleColor === "string"
			? el.customData.roleColor
			: typeof el.customData?.groupColor === "string"
				? el.customData.groupColor
				: "#64748B";
	const coverImage = normalizeKanbanCoverImage(el.customData);
	const coverImageSrc = coverImage
		? (resolveAssetUrl?.(coverImage.src) ?? coverImage.src)
		: "";
	const attachments = normalizeKanbanAttachments(el.customData);
	const checklist = normalizeKanbanChecklist(el.customData?.checklist);
	const checklistPreview = checklist.slice(0, 3);
	const remainingChecklistItems = Math.max(
		0,
		checklist.length - checklistPreview.length,
	);
	const completedChecklistItems = checklist.filter(
		(item) => item.completed,
	).length;
	const w = Math.max(1, el.width);
	const h = Math.max(1, el.height);
	const attachmentCountLabel = translate("canvas.kanban.attachmentCount", {
		count: attachments.length,
	});
	const hasCoverImage = coverImage != null;
	const contentX = el.x + (priorityVar ? 18 : 12);
	const contentY = el.y + (hasCoverImage ? KANBAN_CARD_COVER_HEIGHT + 10 : 8);
	const contentWidth = Math.max(1, w - (priorityVar ? 30 : 24));
	const contentHeight = Math.max(
		1,
		h - (hasCoverImage ? KANBAN_CARD_COVER_HEIGHT + 14 : 12),
	);
	const mutedTextColor = "var(--kanban-card-muted)";
	const defaultBadgeBg = "var(--kanban-due-default-bg)";
	const badgeBorder = undefined;
	const openDetail = (event: React.MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		actions.openKanbanCard(el.id);
	};

	return (
		<g
			transform={transform}
			{...commonProps}
			onDoubleClick={interactive ? openDetail : undefined}
		>
			<rect
				x={el.x + 1}
				y={el.y + 2}
				width={w}
				height={h}
				rx={8}
				style={{ fill: "var(--kanban-card-shadow)" }}
			/>
			<rect
				x={el.x}
				y={el.y}
				width={w}
				height={h}
				rx={8}
				style={{
					fill: "var(--kanban-card-bg)",
					stroke: "var(--kanban-card-border)",
				}}
				strokeWidth={1}
			/>
			{priorityVar && (
				<rect
					x={el.x}
					y={el.y}
					width={6}
					height={h}
					rx={8}
					style={{ fill: priorityVar }}
				/>
			)}
			{coverImage && (
				<foreignObject
					data-kanban-cover="true"
					x={el.x}
					y={el.y}
					width={w}
					height={KANBAN_CARD_COVER_HEIGHT}
					pointerEvents="none"
				>
					<img
						src={coverImageSrc}
						alt={coverImage.name}
						style={{
							width: "100%",
							height: "100%",
							objectFit: "cover",
							objectPosition: `${coverImage.position.x}% ${coverImage.position.y}%`,
							display: "block",
							borderRadius: "8px 8px 0 0",
						}}
					/>
				</foreignObject>
			)}
			<foreignObject
				data-kanban-content="true"
				x={contentX}
				y={contentY}
				width={contentWidth}
				height={contentHeight}
				pointerEvents="auto"
			>
				<div
					style={{
						width: "100%",
						height: "100%",
						display: "flex",
						flexDirection: "column",
						gap: 8,
						position: "relative",
						overflow: "hidden",

						boxSizing: "border-box",

						fontFamily: el.fontFamily ?? kanbanFontFamily,
						color: "var(--kanban-card-text)",
					}}
					onDoubleClick={
						interactive
							? (event) => {
									/* Doppelklick in foreignObject erreicht den SVG-Handler oft nicht. */
									openDetail(event);
								}
							: undefined
					}
				>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							minWidth: 0,
							flex: 1,
							gap: 8,
							position: "relative",
							zIndex: 1,
						}}
					>
						<div
							onPointerDown={canEdit ? stopInteraction : undefined}
							onPointerUp={canEdit ? stopInteraction : undefined}
							onClick={canEdit ? stopInteraction : undefined}
							onDoubleClick={canEdit ? stopInteraction : undefined}
							onKeyDown={canEdit ? stopInteraction : undefined}
							style={{
								fontSize: el.fontSize ?? 14,
								fontWeight: 700,
								whiteSpace: "pre-wrap",
								wordBreak: "break-word",
								lineHeight: 1.3,
								display: canEdit ? "block" : "-webkit-box",
								WebkitLineClamp: 2,
								WebkitBoxOrient: "vertical",
								overflow: canEdit ? "visible" : "hidden",
								minHeight: 40,
								flexShrink: 0,

								maxWidth: "100%",
							}}
						>
							{canEdit ? (
								<KanbanInlineTitle
									title={el.text ?? ""}
									placeholder={translate("canvas.kanban.newCard")}
									label={translate("canvas.kanban.editTitle")}
									onSave={(title) =>
										actions.updateKanbanCard?.(el.id, { title })
									}
								/>
							) : (
								el.text || translate("canvas.kanban.newCard")
							)}
						</div>
						{description && (
							<div
								style={{
									fontSize: 11,
									color: mutedTextColor,
									whiteSpace: "pre-wrap",
									wordBreak: "break-word",
									lineHeight: 1.3,
									display: "-webkit-box",
									WebkitLineClamp: 2,
									WebkitBoxOrient: "vertical",
									overflow: "hidden",
								}}
							>
								{description}
							</div>
						)}
						{checklistPreview.length > 0 && (
							<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
								{checklistPreview.map((item) => (
									<label
										htmlFor={
											canEdit
												? `${svgIdPrefix}-kanban-check-${el.id}-${item.id}`
												: undefined
										}
										key={item.id}
										onPointerDown={canEdit ? stopInteraction : undefined}
										onPointerUp={canEdit ? stopInteraction : undefined}
										onClick={canEdit ? stopInteraction : undefined}
										onKeyDown={canEdit ? stopInteraction : undefined}
										onDoubleClick={canEdit ? stopInteraction : undefined}
										style={{
											display: "flex",
											alignItems: "center",
											gap: 6,
											fontSize: 14,
											color: item.completed
												? mutedTextColor
												: "var(--kanban-card-text)",
										}}
									>
										{canEdit ? (
											<input
												type="checkbox"
												id={`${svgIdPrefix}-kanban-check-${el.id}-${item.id}`}
												checked={item.completed}
												aria-label={item.text}
												onPointerDown={stopInteraction}
												onPointerUp={stopInteraction}
												onDoubleClick={stopInteraction}
												onKeyDown={stopInteraction}
												onClick={stopInteraction}
												onChange={() =>
													actions.updateKanbanCard?.(el.id, {
														toggleChecklistItem: item.id,
													})
												}
												style={{
													width: 24,
													height: 24,
													flexShrink: 0,
													padding: 0,
													border: "1px solid currentColor",
													borderRadius: 6,
													background: item.completed
														? "var(--kanban-due-complete-bg)"
														: "transparent",
													color: "inherit",
													fontSize: 22,
													cursor: "pointer",
													touchAction: "manipulation",
													margin: 6,
													accentColor: "#14b8a6",
												}}
											/>
										) : (
											<span
												style={{
													width: 36,
													height: 36,
													display: "inline-flex",
													alignItems: "center",
													justifyContent: "center",
													fontSize: 22,
												}}
											>
												{item.completed ? "☑" : "☐"}
											</span>
										)}
										<span
											style={{
												textDecoration: item.completed
													? "line-through"
													: "none",
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
										>
											{item.text}
										</span>
									</label>
								))}
								{remainingChecklistItems > 0 && (
									<div style={{ fontSize: 10, color: mutedTextColor }}>
										{translate("canvas.kanban.moreTasks", {
											count: remainingChecklistItems,
										})}
									</div>
								)}
							</div>
						)}
						{(assigneeName ||
							roleName ||
							startDate ||
							checklist.length > 0 ||
							attachments.length > 0) && (
							<div
								style={{
									marginTop: "auto",
									display: "flex",
									flexWrap: "wrap",
									gap: 6,
								}}
							>
								{assigneeName && (
									<div
										style={{
											fontSize: 10,
											color: mutedTextColor,
											display: "flex",
											alignItems: "center",
											gap: 5,
											padding: "2px 6px 2px 3px",
											borderRadius: 999,
											background: defaultBadgeBg,
											border: badgeBorder,
											maxWidth: "100%",
										}}
									>
										<span
											style={{
												display: "inline-flex",
												alignItems: "center",
												justifyContent: "center",
												width: 16,
												height: 16,
												borderRadius: 999,
												background: "var(--kanban-list-header-bg)",
												fontSize: 9,
												fontWeight: 700,
												color: "var(--kanban-card-text)",
												flexShrink: 0,
											}}
										>
											{getUserInitials(assigneeName)}
										</span>
										<span
											style={{
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
										>
											{assigneeName}
										</span>
									</div>
								)}
								{roleName && (
									<div
										style={{
											fontSize: 10,
											color: roleColor,
											display: "flex",
											alignItems: "center",
											gap: 4,
											padding: "2px 6px",
											borderRadius: 999,
											background: `${roleColor}18`,
											border: badgeBorder,
											maxWidth: "100%",
										}}
									>
										<span
											style={{
												width: 7,
												height: 7,
												borderRadius: 999,
												background: roleColor,
												flexShrink: 0,
											}}
										/>
										<span
											style={{
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
										>
											{roleName}
										</span>
									</div>
								)}
								{startDate && (
									<div
										style={{
											fontSize: 10,
											color: mutedTextColor,
											display: "flex",
											alignItems: "center",
											gap: 4,
											padding: "2px 6px",
											borderRadius: 999,
											background: defaultBadgeBg,
											border: badgeBorder,
										}}
									>
										<span>⏳</span>
										<span>
											{translate("canvas.kanban.start")}{" "}
											{formatDateTime(startDate)}
										</span>
									</div>
								)}
								{checklist.length > 0 && (
									<div
										style={{
											fontSize: 10,
											color:
												completedChecklistItems === checklist.length
													? "#2f9e44"
													: mutedTextColor,
											display: "flex",
											alignItems: "center",
											gap: 4,
											padding: "2px 6px",
											borderRadius: 999,
											background:
												completedChecklistItems === checklist.length
													? "var(--kanban-due-complete-bg)"
													: defaultBadgeBg,
											border: badgeBorder,
										}}
									>
										<span>☑</span>
										<span>
											{completedChecklistItems}/{checklist.length}{" "}
											{translate("canvas.kanban.tasks")}
										</span>
									</div>
								)}
								{attachments.length > 0 && (
									<div
										style={{
											fontSize: 10,
											color: mutedTextColor,
											display: "flex",
											alignItems: "center",
											gap: 4,
											padding: "2px 6px",
											borderRadius: 999,
											background: defaultBadgeBg,
											border: badgeBorder,
										}}
									>
										<span>📎</span>
										<span>{attachmentCountLabel}</span>
									</div>
								)}
							</div>
						)}
						<KanbanQuickActions element={el} editable={canEdit} />
					</div>
				</div>
			</foreignObject>
			{hasCoverImage && (
				<rect
					x={el.x}
					y={el.y}
					width={w}
					height={h}
					rx={8}
					fill="none"
					style={{ stroke: "var(--kanban-card-border)" }}
					strokeWidth={1}
					pointerEvents="none"
				/>
			)}
			{hasCoverImage && priorityVar && (
				<rect
					x={el.x}
					y={el.y}
					width={6}
					height={h}
					rx={8}
					style={{ fill: priorityVar }}
					pointerEvents="none"
				/>
			)}
		</g>
	);
}
