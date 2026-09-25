/**
 * SVG-Rendering fuer Frame-Elemente (Standard, Kanban-Liste, Template-Sektion).
 */

import {
	KANBAN_LIST_FOOTER_HEIGHT,
	KANBAN_LIST_PADDING,
	getKanbanImageObjectPosition,
	getKanbanListHeaderHeight,
} from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { RectText } from "./path-and-text-shapes";
import { dashArray } from "./render-helpers";
import { useCanvasRendererConfig } from "./renderer-config";
import { getRendererTemplateAccent } from "./renderer-data";

interface FrameShapeProps {
	el: CanvasElement;
	transform?: string;
	commonProps: Record<string, unknown>;
	isEditingText: boolean;
	label: string;
	resolveAssetUrl?: (src: string) => string;
}

function KanbanListFrameShape({
	el,
	transform,
	commonProps,
	isEditingText,
	label,
	resolveAssetUrl,
}: FrameShapeProps) {
	const { actions, interactive, kanbanFontFamily, translate } =
		useCanvasRendererConfig();
	const headerImageSrc = el.customData?.headerImageSrc as string | undefined;
	const resolvedHeaderImageSrc = headerImageSrc
		? (resolveAssetUrl?.(headerImageSrc) ?? headerImageSrc)
		: "";
	const buttonWidth = Math.max(1, el.width - KANBAN_LIST_PADDING * 2);
	const buttonY = el.y + el.height - KANBAN_LIST_FOOTER_HEIGHT + 4;
	const headerHeight = headerImageSrc ? getKanbanListHeaderHeight(el) : 40;
	const headerImagePosition = getKanbanImageObjectPosition(
		el.customData?.headerImageFocus,
	);

	return (
		<g transform={transform} {...commonProps}>
			<rect
				x={el.x}
				y={el.y}
				width={Math.max(1, el.width)}
				height={Math.max(1, el.height)}
				style={{
					fill: "var(--kanban-list-bg)",
					stroke: "var(--kanban-list-border)",
				}}
				strokeWidth={1}
				rx={10}
			/>
			<rect
				x={el.x}
				y={el.y}
				width={Math.max(1, el.width)}
				height={headerHeight}
				style={{ fill: "var(--kanban-list-header-bg)" }}
				rx={10}
			/>
			{headerImageSrc ? (
				<foreignObject
					x={el.x}
					y={el.y}
					width={Math.max(1, el.width)}
					height={headerHeight}
					pointerEvents="none"
				>
					<div
						style={{
							width: "100%",
							height: "100%",
							position: "relative",
							overflow: "hidden",
							borderRadius: "10px 10px 0 0",
							background: "var(--kanban-list-header-bg)",
						}}
					>
						<img
							src={resolvedHeaderImageSrc}
							alt={translate("canvas.properties.listImageAlt")}
							style={{
								width: "100%",
								height: "100%",
								objectFit: "cover",
								objectPosition: headerImagePosition,
								display: "block",
							}}
						/>
						<div
							style={{
								position: "absolute",
								inset: 0,
								background:
									"linear-gradient(180deg, rgba(2, 6, 23, 0.08) 0%, rgba(2, 6, 23, 0.28) 48%, rgba(2, 6, 23, 0.72) 100%)",
							}}
						/>
						{!isEditingText && (
							<div
								style={{
									position: "absolute",
									left: 12,
									bottom: 12,
									maxWidth: "calc(100% - 24px)",
									display: "inline-flex",
									alignItems: "center",
									borderRadius: 8,
									border: "1px solid rgba(255, 255, 255, 0.14)",
									background: "rgba(2, 6, 23, 0.38)",
									padding: "4px 8px",
									color: "#ffffff",
									fontSize: 15,
									fontFamily: kanbanFontFamily,
									fontWeight: 700,
									lineHeight: 1.2,
									textShadow: "0 1px 8px rgba(2, 6, 23, 0.72)",
									backdropFilter: "blur(4px)",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
								}}
							>
								{label}
							</div>
						)}
					</div>
				</foreignObject>
			) : (
				<rect
					x={el.x}
					y={el.y + 30}
					width={Math.max(1, el.width)}
					height={10}
					style={{ fill: "var(--kanban-list-header-bg)" }}
				/>
			)}
			{!isEditingText && !headerImageSrc && (
				<text
					x={el.x + 14}
					y={el.y + 25}
					style={{ fill: "var(--kanban-list-header-text)" }}
					fontSize={14}
					fontFamily={kanbanFontFamily}
					fontWeight={700}
					pointerEvents="none"
				>
					{label}
				</text>
			)}
			{interactive && (
				<foreignObject
					x={el.x + KANBAN_LIST_PADDING}
					y={buttonY}
					width={buttonWidth}
					height={32}
					pointerEvents="auto"
				>
					<button
						type="button"
						onPointerDown={(event) => {
							event.preventDefault();
							event.stopPropagation();
						}}
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							actions.addKanbanCard(el.id);
						}}
						style={{
							width: "100%",
							height: "100%",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: 8,
							borderRadius: 8,
							border: "1px dashed var(--kanban-list-border)",
							background:
								"color-mix(in srgb, var(--kanban-list-bg) 82%, var(--kanban-list-header-bg) 18%)",
							color: "var(--kanban-card-text)",
							fontSize: 12,
							fontWeight: 600,
							cursor: "pointer",
						}}
					>
						<span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
						<span>{translate("canvas.kanban.newCard")}</span>
					</button>
				</foreignObject>
			)}
		</g>
	);
}

function TemplateSectionFrameShape({
	el,
	transform,
	commonProps,
	isEditingText,
	label,
}: FrameShapeProps) {
	const { actions, interactive, translate, templateNoteCounts } =
		useCanvasRendererConfig();
	const accent = getRendererTemplateAccent(el);
	if (!accent) return null;
	const canEdit = interactive && !el.locked;
	const count = templateNoteCounts[el.id] ?? 0;
	const actionLabel = translate("canvas.templateTools.addNote");
	const role = el.customData?.templateSectionId;
	const prompt =
		el.text ||
		(typeof el.customData?.templatePrompt === "string"
			? el.customData.templatePrompt
			: "") ||
		translate(`canvas.templateTools.prompts.${role}`);
	const contentTop = el.text ? 92 : 58;
	return (
		<g transform={transform} {...commonProps}>
			<rect
				x={el.x}
				y={el.y}
				width={Math.max(1, el.width)}
				height={Math.max(1, el.height)}
				fill={accent}
				opacity={0.045}
				rx={16}
			/>
			<rect
				x={el.x}
				y={el.y}
				width={Math.max(1, el.width)}
				height={Math.max(1, el.height)}
				fill="transparent"
				stroke={accent}
				strokeOpacity={0.32}
				strokeWidth={1.25}
				strokeDasharray={dashArray(el.strokeStyle, 1.25)}
				rx={16}
			/>
			<rect
				x={el.x + 18}
				y={el.y + 18}
				width={3}
				height={18}
				rx={1.5}
				fill={accent}
				pointerEvents="none"
			/>
			{!isEditingText && (
				<text
					x={el.x + 28}
					y={el.y + 32}
					fill="var(--foreground, #334155)"
					fontSize={16}
					fontFamily="system-ui, sans-serif"
					fontWeight={650}
					pointerEvents="none"
				>
					{el.frameLabel ?? label}
				</text>
			)}
			<text
				x={el.x + el.width - 22}
				y={el.y + 32}
				textAnchor="end"
				fill="var(--muted-foreground, #64748b)"
				fontSize={12}
				fontFamily="system-ui, sans-serif"
				pointerEvents="none"
			>
				<title>{translate("canvas.templateTools.noteCount", { count })}</title>
				{count}
			</text>
			<line
				x1={el.x + 18}
				x2={el.x + el.width - 18}
				y1={el.y + 48}
				y2={el.y + 48}
				stroke={accent}
				strokeOpacity={0.14}
				pointerEvents="none"
			/>
			{el.text && (
				<foreignObject
					x={el.x + 18}
					y={el.y + 56}
					width={Math.max(10, el.width - 36)}
					height={32}
					pointerEvents="none"
				>
					<div
						style={{
							font: "12px/1.35 system-ui, sans-serif",
							color: "var(--muted-foreground, #64748b)",
							overflow: "hidden",
						}}
					>
						{el.text}
					</div>
				</foreignObject>
			)}
			{canEdit && (
				<rect
					x={el.x + 1}
					y={el.y + contentTop}
					width={Math.max(1, el.width - 2)}
					height={Math.max(1, el.height - contentTop - 54)}
					fill="transparent"
					onDoubleClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						actions.addTemplateSticky(el.id);
					}}
				>
					<title>{translate("canvas.templateTools.emptyHint")}</title>
				</rect>
			)}
			{count === 0 && (
				<foreignObject
					x={el.x + 28}
					y={el.y + contentTop}
					width={Math.max(1, el.width - 56)}
					height={Math.max(1, el.height - contentTop - 60)}
					pointerEvents="none"
				>
					<div
						style={{
							height: "100%",
							display: "flex",
							flexDirection: "column",
							justifyContent: "center",
							alignItems: "center",
							textAlign: "center",
							gap: 10,
							fontFamily: "system-ui, sans-serif",
						}}
					>
						<span
							style={{
								fontSize: 15,
								lineHeight: 1.5,
								color: "var(--foreground, #334155)",
								opacity: 0.8,
							}}
						>
							{prompt}
						</span>
						{canEdit && (
							<span
								style={{
									maxWidth: 200,
									fontSize: 12,
									lineHeight: 1.5,
									color: "var(--muted-foreground, #64748b)",
								}}
							>
								{translate("canvas.templateTools.emptyHint")}
							</span>
						)}
					</div>
				</foreignObject>
			)}
			{canEdit && (
				<foreignObject
					x={el.x + 18}
					y={el.y + el.height - 46}
					width={Math.max(1, el.width - 36)}
					height={34}
					data-ui-only="true"
					pointerEvents="auto"
				>
					<button
						type="button"
						className="canvas-editor__template-add"
						aria-label={`${actionLabel}: ${el.frameLabel ?? label}`}
						data-ui-only="true"
						onPointerDown={(event) => event.stopPropagation()}
						onDoubleClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
						}}
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							actions.addTemplateSticky(el.id);
						}}
						style={{
							width: "100%",
							height: "100%",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: 8,
							borderRadius: 8,
							border: `1px dashed ${accent}55`,
							background: "transparent",
							color: "var(--foreground, #334155)",
							font: "500 12px system-ui, sans-serif",
							cursor: "pointer",
						}}
					>
						<span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
							+
						</span>
						{actionLabel}
					</button>
				</foreignObject>
			)}
		</g>
	);
}

function DefaultFrameShape({
	el,
	transform,
	commonProps,
	isEditingText,
	label,
}: FrameShapeProps & { isPreview: boolean }) {
	return (
		<g transform={transform} {...commonProps}>
			<rect
				x={el.x}
				y={el.y}
				width={Math.max(1, el.width)}
				height={Math.max(1, el.height)}
				fill="transparent"
				stroke="var(--primary, #6366f1)"
				strokeWidth={1.5}
				strokeDasharray={el.id === "__preview" ? "6 3" : undefined}
				rx={4}
				opacity={0.5}
			/>
			{/* Label ausblenden, solange der Inline-Editor den Namen bearbeitet */}
			{!isEditingText && (
				<text
					x={el.x + 6}
					y={el.y - 6}
					fill="var(--primary, #6366f1)"
					fontSize={12}
					fontFamily="system-ui, sans-serif"
					opacity={0.7}
					pointerEvents="none"
				>
					{label}
				</text>
			)}
			{!isEditingText && el.text && <RectText el={el} />}
		</g>
	);
}

export function FrameElementShape({
	el,
	transform,
	commonProps,
	isEditingText,
	resolveAssetUrl,
}: {
	el: CanvasElement;
	transform?: string;
	commonProps: Record<string, unknown>;
	isEditingText: boolean;
	resolveAssetUrl?: (src: string) => string;
}) {
	const { translate } = useCanvasRendererConfig();
	const label =
		el.frameLabel || el.text || translate("canvas.properties.frameDefault");

	if (el.customData?.skedraType === "kanban-list") {
		return (
			<KanbanListFrameShape
				el={el}
				transform={transform}
				commonProps={commonProps}
				isEditingText={isEditingText}
				label={label}
				resolveAssetUrl={resolveAssetUrl}
			/>
		);
	}

	if (getRendererTemplateAccent(el)) {
		return (
			<TemplateSectionFrameShape
				el={el}
				transform={transform}
				commonProps={commonProps}
				isEditingText={isEditingText}
				label={label}
			/>
		);
	}

	return (
		<DefaultFrameShape
			el={el}
			transform={transform}
			commonProps={commonProps}
			isEditingText={isEditingText}
			label={label}
			isPreview={el.id === "__preview"}
		/>
	);
}
