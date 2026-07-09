import {
	STICKY_NOTE_TEXT_PADDING,
	getStickyNoteContent,
	getStickyNoteItemPlaceholder,
	getStickyNoteTextStyle,
} from "@/lib/canvas/sticky-note-utils";
import { getEffectiveCornerRadius } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { useCanvasCommands } from "../canvas-commands";

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
	const canvasCommands = useCanvasCommands();
	const padding = STICKY_NOTE_TEXT_PADDING;
	const { mode, text, checklist } = getStickyNoteContent(el);
	const itemPlaceholder = getStickyNoteItemPlaceholder();
	const visibleItems = checklist.filter(
		(item) => item.text.trim().length > 0 || item.completed,
	);
	const textStyle = getStickyNoteTextStyle(el);
	const cornerRadius = getEffectiveCornerRadius(el);
	const bodySize = textStyle.fontSize;
	const titleSize = bodySize * 1.05;
	const itemSize = Math.max(14, bodySize * 0.82);
	const trimmedText = text.trim();

	return (
		<g transform={transform} {...commonProps}>
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
									{trimmedText}
								</div>
							) : null
						) : (
							<>
								{trimmedText ? (
									<div
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
													fontSize: itemSize,
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
														canvasCommands.toggleStickyChecklistItem(
															el.id,
															item.id,
														);
													}}
													style={{
														marginTop: 1,
														border: "none",
														background: "transparent",
														padding: 0,
														cursor: "pointer",
														fontSize: 14,
														lineHeight: 1,
														color: textStyle.color,
														flexShrink: 0,
													}}
													aria-label={item.completed ? "Erledigt" : "Offen"}
												>
													{item.completed ? "☑" : "☐"}
												</button>
												<span
													style={{
														flex: 1,
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
