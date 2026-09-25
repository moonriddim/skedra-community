import {
	STICKY_NOTE_TEXT_PADDING,
	getEffectiveCornerRadius,
	getStickyNoteTypography,
} from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { useCanvasRendererConfig } from "./renderer-config";
import {
	getRendererStickyNoteContent,
	getRendererStickyNoteTextStyle,
} from "./renderer-data";

export function StickyNoteShape({
	el,
	transform,
	commonProps,
	isEditingText,
}: {
	el: CanvasElement;
	transform: string | undefined;
	commonProps: { "data-element-id": string; opacity: number };
	isEditingText: boolean;
}) {
	const { actions, interactive, translate } = useCanvasRendererConfig();
	const padding = STICKY_NOTE_TEXT_PADDING;
	const { mode, text, checklist } = getRendererStickyNoteContent(el);
	const itemPlaceholder = translate("canvas.sticky.itemPlaceholder");
	const visibleItems = checklist.filter(
		(item) => item.text.trim().length > 0 || item.completed,
	);
	const textStyle = getRendererStickyNoteTextStyle(el);
	const cornerRadius = getEffectiveCornerRadius(el);
	const bodySize = textStyle.fontSize;
	const typography = getStickyNoteTypography(el);
	const titleSize = typography.titleFontSize ?? bodySize * 1.05;
	const itemSize = Math.max(14, bodySize * 0.82);
	const trimmedText = text.trim();
	const canEdit = interactive && !el.locked && Boolean(actions.editStickyNote);

	return (
		<g
			transform={transform}
			{...commonProps}
			onDoubleClick={(event) => {
				if (!canEdit || (event.target as Element).closest("button")) return;
				event.preventDefault();
				event.stopPropagation();
				const target = (event.target as Element).closest<HTMLElement>(
					"[data-sticky-edit-target]",
				)?.dataset.stickyEditTarget;
				actions.editStickyNote?.(el.id, target);
			}}
		>
			<rect
				x={el.x}
				y={el.y}
				width={Math.max(1, el.width)}
				height={Math.max(1, el.height)}
				rx={cornerRadius}
				ry={cornerRadius}
				fill={el.fill || "#FFF3BF"}
				stroke={el.stroke || "#CED4DA"}
				strokeWidth={el.strokeWidth ?? 1}
			/>
			{!isEditingText && (
				<foreignObject
					x={el.x + padding}
					y={el.y + padding}
					width={Math.max(1, el.width - padding * 2)}
					height={Math.max(1, el.height - padding * 2)}
					pointerEvents="auto"
				>
					<div
						style={{
							cursor: canEdit ? "grab" : undefined,
							touchAction: canEdit ? "none" : undefined,
							userSelect: "none",
							width: "100%",
							height: "100%",
							display: "flex",
							flexDirection: "column",
							gap: mode === "checklist" ? 8 : 0,
							overflow: "hidden",
							fontFamily: textStyle.fontFamily,
							color: textStyle.color,
							textAlign: textStyle.textAlign,
						}}
					>
						{mode === "note" ? (
							trimmedText ? (
								<div
									style={{
										fontSize: bodySize,
										fontWeight: textStyle.fontWeight === "bold" ? 700 : 400,
										fontStyle: textStyle.fontStyle,
										textDecoration: textStyle.textDecoration,
										lineHeight: 1.35,
										whiteSpace: "pre-wrap",
										wordBreak: "break-word",
									}}
								>
									{text.split("\n").map((line, index) => (
										<div
											key={`${index}-${line}`}
											data-sticky-edit-target={`line:${index}`}
											style={{
												fontSize: typography.textFontSizes?.[index] ?? bodySize,
												minHeight: "1.35em",
												overflowWrap: "anywhere",
											}}
										>
											{line || "\u00a0"}
										</div>
									))}
								</div>
							) : null
						) : (
							<>
								{trimmedText ? (
									<div
										data-sticky-edit-target="title"
										style={{
											fontSize: titleSize,
											fontWeight: 700,
											fontStyle: textStyle.fontStyle,
											textDecoration: textStyle.textDecoration,
											lineHeight: 1.25,
											wordBreak: "break-word",
										}}
									>
										{trimmedText}
									</div>
								) : null}
								{visibleItems.length > 0 && (
									<div
										style={{ display: "flex", flexDirection: "column", gap: 5 }}
									>
										{visibleItems.map((item) => (
											<div
												key={item.id}
												style={{
													display: "flex",
													alignItems: "flex-start",
													gap: 6,
													fontSize: item.fontSize ?? itemSize,
													fontWeight:
														textStyle.fontWeight === "bold" ? 700 : 400,
													fontStyle: textStyle.fontStyle,
													lineHeight: 1.35,
													opacity: item.text.trim() ? 1 : 0.45,
												}}
											>
												<button
													type="button"
													data-ui-only="true"
													onPointerDown={(event) => {
														event.preventDefault();
														event.stopPropagation();
													}}
													onClick={(event) => {
														event.preventDefault();
														event.stopPropagation();
														actions.toggleStickyChecklistItem(el.id, item.id);
													}}
													style={{
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
														width: 28,
														minHeight: 28,
														marginTop: 0,
														border: "none",
														background: "transparent",
														padding: 0,
														cursor: interactive ? "pointer" : "default",
														fontSize: 22,
														lineHeight: 1,
														color: textStyle.color,
														flexShrink: 0,
													}}
													aria-label={item.completed ? "Erledigt" : "Offen"}
													aria-pressed={item.completed}
													disabled={!interactive}
												>
													{item.completed ? "☑" : "☐"}
												</button>
												<span
													data-sticky-edit-target={item.id}
													style={{
														flex: 1,
														minWidth: 0,
														minHeight: 28,
														overflowWrap: "anywhere",
														textDecoration: item.completed
															? "line-through"
															: textStyle.textDecoration,
														opacity: item.completed ? 0.65 : 1,
														wordBreak: "break-word",
													}}
												>
													{item.text.trim() || itemPlaceholder}
												</span>
											</div>
										))}
									</div>
								)}
							</>
						)}
					</div>
				</foreignObject>
			)}
		</g>
	);
}
