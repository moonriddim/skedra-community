import {
	normalizeKanbanAttachments,
	normalizeKanbanChecklist,
	normalizeKanbanCoverImage,
} from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
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
		getDueStatus,
		getUserInitials,
		interactive,
		kanbanFontFamily,
		translate,
	} = useCanvasRendererConfig();
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
	const dueDate = el.customData?.dueDate as string | null | undefined;
	const dueComplete = Boolean(el.customData?.dueComplete);
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
	const dueStatus = getDueStatus(dueDate, dueComplete);
	const w = Math.max(1, el.width);
	const h = Math.max(1, el.height);
	const attachmentCountLabel = translate("canvas.kanban.attachmentCount", {
		count: attachments.length,
	});
	const hasCoverImage = coverImage != null;
	const contentX = hasCoverImage ? el.x : el.x + (priorityVar ? 18 : 12);
	const contentY = hasCoverImage ? el.y : el.y + 8;
	const contentWidth = hasCoverImage
		? w
		: Math.max(1, w - (priorityVar ? 30 : 24));
	const contentHeight = hasCoverImage ? h : Math.max(1, h - 12);
	const mutedTextColor = hasCoverImage
		? "rgba(255, 255, 255, 0.82)"
		: "var(--kanban-card-muted)";
	const defaultBadgeBg = hasCoverImage
		? "rgba(15, 23, 42, 0.58)"
		: "var(--kanban-due-default-bg)";
	const badgeBorder = hasCoverImage
		? "1px solid rgba(255, 255, 255, 0.14)"
		: undefined;
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
			<foreignObject
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
						borderRadius: hasCoverImage ? 8 : undefined,
						boxSizing: "border-box",
						padding: hasCoverImage
							? `12px 12px 12px ${priorityVar ? 18 : 12}px`
							: undefined,
						justifyContent: hasCoverImage ? "flex-end" : undefined,
						fontFamily: el.fontFamily ?? kanbanFontFamily,
						color: hasCoverImage ? "#ffffff" : "var(--kanban-card-text)",
					}}
					onDoubleClick={(event) => {
						/* Doppelklick in foreignObject erreicht den SVG-Handler oft nicht. */
						openDetail(event);
					}}
				>
					{coverImage && (
						<>
							<img
								src={coverImageSrc}
								alt={coverImage.name}
								style={{
									position: "absolute",
									inset: 0,
									width: "100%",
									height: "100%",
									objectFit: "cover",
									display: "block",
								}}
							/>
							<div
								style={{
									position: "absolute",
									inset: 0,
									background:
										"linear-gradient(180deg, rgba(15, 23, 42, 0.05) 0%, rgba(15, 23, 42, 0.32) 42%, rgba(15, 23, 42, 0.82) 100%)",
								}}
							/>
						</>
					)}
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							minWidth: 0,
							flex: hasCoverImage ? "0 1 auto" : 1,
							gap: 8,
							position: "relative",
							zIndex: 1,
							textShadow: hasCoverImage
								? "0 1px 8px rgba(2, 6, 23, 0.72)"
								: undefined,
						}}
					>
						<div
							style={{
								fontSize: el.fontSize ?? 14,
								fontWeight: 700,
								whiteSpace: "pre-wrap",
								wordBreak: "break-word",
								lineHeight: 1.3,
								display: "-webkit-box",
								WebkitLineClamp: hasCoverImage ? 2 : 2,
								WebkitBoxOrient: "vertical",
								overflow: "hidden",
								alignSelf: hasCoverImage ? "flex-start" : undefined,
								maxWidth: "100%",
								padding: hasCoverImage ? "3px 7px" : undefined,
								borderRadius: hasCoverImage ? 7 : undefined,
								background: hasCoverImage ? "rgba(2, 6, 23, 0.38)" : undefined,
								border: hasCoverImage
									? "1px solid rgba(255, 255, 255, 0.14)"
									: undefined,
								backdropFilter: hasCoverImage ? "blur(4px)" : undefined,
							}}
						>
							{el.text || translate("canvas.kanban.newCard")}
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
									<div
										key={item.id}
										style={{
											display: "flex",
											alignItems: "center",
											gap: 6,
											fontSize: 11,
											color: item.completed
												? mutedTextColor
												: hasCoverImage
													? "#ffffff"
													: "var(--kanban-card-text)",
										}}
									>
										<span style={{ fontSize: 12 }}>
											{item.completed ? "☑" : "☐"}
										</span>
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
									</div>
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
							dueDate ||
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
												background: hasCoverImage
													? "rgba(255, 255, 255, 0.16)"
													: "var(--kanban-list-header-bg)",
												fontSize: 9,
												fontWeight: 700,
												color: hasCoverImage
													? "#ffffff"
													: "var(--kanban-card-text)",
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
											background: hasCoverImage
												? "rgba(15, 23, 42, 0.58)"
												: `${roleColor}18`,
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
								{dueDate && (
									<div
										style={{
											fontSize: 10,
											color: dueStatus.textColor,
											display: "flex",
											alignItems: "center",
											gap: 4,
											padding: "2px 6px",
											borderRadius: 999,
											background: dueStatus.background,
											border: badgeBorder,
										}}
									>
										<span>{dueStatus.icon}</span>
										<span>
											{dueStatus.label} {formatDateTime(dueDate)}
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
