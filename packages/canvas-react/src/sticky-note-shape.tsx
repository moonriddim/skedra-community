import {
	STICKY_NOTE_TEXT_PADDING,
	getEffectiveCornerRadius,
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
														actions.toggleStickyChecklistItem(el.id, item.id);
													}}
													style={{
														marginTop: 1,
														border: "none",
														background: "transparent",
														padding: 0,
														cursor: interactive ? "pointer" : "default",
														fontSize: 14,
														lineHeight: 1,
														color: textStyle.color,
														flexShrink: 0,
													}}
													aria-label={item.completed ? "Erledigt" : "Offen"}
													disabled={!interactive}
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
