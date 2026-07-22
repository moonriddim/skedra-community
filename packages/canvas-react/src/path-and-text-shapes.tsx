import {
	type ArrowHeadData,
	type ArrowTextOrientation,
	type ArrowTextSide,
	arrowHeadLengthForType,
	getArrowPath,
	getArrowTextMetrics,
	isCanvasCenteredTextShape,
	renderArrowHead,
	resolveArrowTextOffset,
	resolveArrowTextRotationDeg,
	resolveCanvasElementTextLineHeight,
	resolveCanvasRectTextLayout,
	resolveCanvasTextRenderedHeight,
} from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { useMemo } from "react";
import { roughArrowHeadHtml } from "./render-helpers";
import { useCanvasRendererConfig } from "./renderer-config";
import { RoughSvgMarkup } from "./rough-svg-markup";

export function TextBlock({ el }: { el: CanvasElement }) {
	const { defaultFontFamily } = useCanvasRendererConfig();
	const fontSize = el.fontSize ?? 16;
	const lineHeight = resolveCanvasElementTextLineHeight(el, fontSize);
	const isWireframeNode = el.customData?.skedraType === "wireframe-node";
	const renderedHeight = resolveCanvasTextRenderedHeight(el);
	const verticalAlign = el.verticalAlign ?? "top";
	return (
		<foreignObject
			x={el.x}
			y={el.y - (renderedHeight - el.height) / 2}
			width={Math.max(20, el.width)}
			height={renderedHeight}
			pointerEvents="none"
		>
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					justifyContent:
						verticalAlign === "middle"
							? "center"
							: verticalAlign === "bottom"
								? "flex-end"
								: "flex-start",
					boxSizing: isWireframeNode ? "border-box" : undefined,
					fontSize,
					fontFamily: el.fontFamily ?? defaultFontFamily,
					fontWeight: el.fontWeight ?? "normal",
					fontStyle: el.fontStyle ?? "normal",
					textDecoration: el.textDecoration ?? "none",
					color: el.textColor ?? el.stroke ?? "var(--foreground)",
					textAlign: el.textAlign ?? "left",
					whiteSpace: "pre-wrap",
					wordBreak: "break-word",
					overflowWrap: isWireframeNode ? "anywhere" : undefined,
					overflow: "hidden",
					lineHeight,
					padding: isWireframeNode ? "0 4px" : "2px 4px",
				}}
			>
				{el.text || ""}
			</div>
		</foreignObject>
	);
}

export function ArrowShape({
	el,
	transform,
	commonProps,
	dash,
	isRough,
	roughHtml,
	isEditingText,
}: {
	el: CanvasElement;
	transform?: string;
	commonProps: Record<string, unknown>;
	dash: string | undefined;
	isRough: boolean;
	roughHtml: string | null;
	isEditingText: boolean;
}) {
	const pts = el.points;
	if (!pts || pts.length < 2) return null;

	const mode = el.arrowMode ?? "straight";
	const headStart = el.arrowHeadStart ?? "none";
	const headEnd = el.arrowHeadEnd ?? "arrow";
	const arrowHeadFilled = el.arrowHeadFilled ?? true;

	const dPath = getArrowPath(pts, mode);
	const textPathId = `skedra-arrow-text-${el.id}`;

	const first = pts[0];
	const second = pts.length > 1 ? pts[1] : pts[0];
	const secondLast = pts.length >= 2 ? pts[pts.length - 2] : pts[0];
	const last = pts[pts.length - 1];

	const headScale = el.arrowHeadScale ?? 1;
	const endHead = renderArrowHead(
		headEnd,
		el.x + secondLast[0],
		el.y + secondLast[1],
		el.x + last[0],
		el.y + last[1],
		el.stroke,
		arrowHeadLengthForType(headEnd, headScale),
	);
	const startHead = renderArrowHead(
		headStart,
		el.x + second[0],
		el.y + second[1],
		el.x + first[0],
		el.y + first[1],
		el.stroke,
		arrowHeadLengthForType(headStart, headScale),
	);

	const roughness = el.roughness ?? 0;
	const useRoughHeads = isRough && roughHtml && roughness > 0;

	if (isRough && roughHtml) {
		return (
			<g transform={transform} {...commonProps}>
				<RoughSvgMarkup html={roughHtml} dash={dash} />
				{useRoughHeads ? (
					<>
						<RoughArrowHeadMarkup
							head={endHead}
							roughness={roughness}
							stroke={el.stroke}
							strokeWidth={el.strokeWidth}
							seedKey={`${el.id}-end`}
							filled={arrowHeadFilled}
						/>
						<RoughArrowHeadMarkup
							head={startHead}
							roughness={roughness}
							stroke={el.stroke}
							strokeWidth={el.strokeWidth}
							seedKey={`${el.id}-start`}
							filled={arrowHeadFilled}
						/>
					</>
				) : (
					<>
						<ArrowHeadSvg
							head={endHead}
							stroke={el.stroke}
							strokeWidth={el.strokeWidth}
							filled={arrowHeadFilled}
						/>
						<ArrowHeadSvg
							head={startHead}
							stroke={el.stroke}
							strokeWidth={el.strokeWidth}
							filled={arrowHeadFilled}
						/>
					</>
				)}
				{!isEditingText && (
					<PathTextLabel el={el} pathId={textPathId} mode={mode} />
				)}
			</g>
		);
	}

	return (
		<g transform={transform} {...commonProps}>
			<path
				d={dPath}
				fill="none"
				stroke={el.stroke}
				strokeWidth={el.strokeWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeDasharray={dash}
				transform={`translate(${el.x}, ${el.y})`}
			/>
			{!isEditingText && (
				<PathTextLabel el={el} pathId={textPathId} mode={mode} />
			)}
			<ArrowHeadSvg
				head={endHead}
				stroke={el.stroke}
				strokeWidth={el.strokeWidth}
				filled={arrowHeadFilled}
			/>
			<ArrowHeadSvg
				head={startHead}
				stroke={el.stroke}
				strokeWidth={el.strokeWidth}
				filled={arrowHeadFilled}
			/>
		</g>
	);
}

export function PathTextLabel({
	el,
	pathId,
	mode,
}: {
	el: CanvasElement;
	pathId: string;
	mode?: CanvasElement["arrowMode"];
}) {
	const { defaultFontFamily } = useCanvasRendererConfig();
	if (!el.points || el.points.length < 2) return null;

	const rawText = el.text ?? "";
	if (!rawText.replace(/\s/g, "").length) return null;

	const customData = el.customData ?? {};
	const labelSide =
		(customData.arrowTextSide as ArrowTextSide | undefined) ?? "above";
	const orientation =
		(customData.arrowTextOrientation as ArrowTextOrientation | undefined) ??
		"horizontal";
	const fontSize = el.fontSize ?? 16;
	const labelOffset = resolveArrowTextOffset(
		fontSize,
		el.strokeWidth,
		orientation,
		rawText,
	);
	const labelMetrics = getArrowTextMetrics(
		el.points,
		mode,
		labelSide,
		labelOffset,
	);
	const cx = el.x + labelMetrics.anchor[0];
	const cy = el.y + labelMetrics.anchor[1];
	const lineHeight = fontSize * 1.35;
	const lines = rawText.split("\n");
	let lineOffset = 0;
	const keyedLines = lines.map((line) => {
		const key = `${pathId}-line-${lineOffset}-${line}`;
		lineOffset += line.length + 1;
		return { key, line };
	});
	const rotationDeg = resolveArrowTextRotationDeg(
		labelMetrics.tangentAngle,
		orientation,
	);
	const blockOffset = ((lines.length - 1) * lineHeight) / 2;

	const textProps = {
		fill: el.textColor ?? el.stroke,
		fontSize,
		fontFamily: el.fontFamily ?? defaultFontFamily,
		fontWeight: el.fontWeight ?? "normal",
		fontStyle: el.fontStyle ?? "normal",
		textDecoration: el.textDecoration ?? "none",
		stroke: "var(--background, #ffffff)",
		strokeWidth: 3,
		paintOrder: "stroke" as const,
		strokeLinejoin: "round" as const,
		textAnchor: "middle" as const,
		dominantBaseline: "middle" as const,
		pointerEvents: "none" as const,
	};

	return (
		<text
			{...textProps}
			transform={
				rotationDeg !== 0 ? `rotate(${rotationDeg} ${cx} ${cy})` : undefined
			}
		>
			{keyedLines.map(({ key, line }, index) => (
				<tspan key={key} x={cx} y={cy - blockOffset + index * lineHeight}>
					{line}
				</tspan>
			))}
		</text>
	);
}

function RoughArrowHeadMarkup({
	head,
	roughness,
	stroke,
	strokeWidth,
	seedKey,
	filled,
}: {
	head: ArrowHeadData | null;
	roughness: number;
	stroke: string;
	strokeWidth: number;
	seedKey: string;
	filled: boolean;
}) {
	const html = useMemo(() => {
		let seed = 0;
		for (let i = 0; i < seedKey.length; i++) {
			seed = ((seed << 5) - seed + seedKey.charCodeAt(i)) | 0;
		}
		return roughArrowHeadHtml(
			head,
			roughness,
			stroke,
			strokeWidth,
			Math.abs(seed),
			filled,
		);
	}, [head, roughness, stroke, strokeWidth, seedKey, filled]);

	if (!html) return null;
	return <RoughSvgMarkup html={html} />;
}

function ArrowHeadSvg({
	head,
	stroke,
	strokeWidth,
	filled,
}: {
	head: ArrowHeadData | null;
	stroke: string;
	strokeWidth?: number;
	filled: boolean;
}) {
	if (!head) return null;
	if (head.type === "lines" && head.lines) {
		const { x1, y1, x2, y2, x3, y3 } = head.lines;
		const sw = strokeWidth ?? 2;
		return (
			<path
				d={`M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3}`}
				fill="none"
				stroke={stroke}
				strokeWidth={sw}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		);
	}
	if (head.type === "triangle" && head.polygon) {
		return (
			<polygon
				points={head.polygon}
				fill={filled ? stroke : "none"}
				stroke={filled ? "none" : stroke}
				strokeWidth={filled ? 0 : (strokeWidth ?? 2)}
				strokeLinejoin="round"
			/>
		);
	}
	if (
		head.type === "dot" &&
		head.cx != null &&
		head.cy != null &&
		head.r != null
	) {
		return (
			<circle
				cx={head.cx}
				cy={head.cy}
				r={head.r}
				fill={filled ? stroke : "none"}
				stroke={filled ? "none" : stroke}
				strokeWidth={filled ? 0 : (strokeWidth ?? 2)}
			/>
		);
	}
	return null;
}

export function RectText({ el }: { el: CanvasElement }) {
	const { defaultFontFamily, translate } = useCanvasRendererConfig();
	const stickyPlaceholder = translate("canvas.sticky.notePlaceholder");
	const isStickyNote = el.customData?.skedraType === "sticky-note";
	const isCenteredShape = isCanvasCenteredTextShape(el);
	const isWireframeNode = el.customData?.skedraType === "wireframe-node";
	const { fontSize, lineHeight, horizontalPadding, verticalPadding } =
		resolveCanvasRectTextLayout(el);
	const textAlign = isStickyNote
		? "left"
		: (el.textAlign ?? (isCenteredShape ? "center" : "left"));
	const justifyContent =
		textAlign === "left"
			? "flex-start"
			: textAlign === "right"
				? "flex-end"
				: "center";
	const verticalAlign = isStickyNote ? "top" : (el.verticalAlign ?? "middle");
	const text = el.text?.trim().length
		? el.text
		: isStickyNote
			? stickyPlaceholder
			: "";

	return (
		<foreignObject
			x={el.x + horizontalPadding}
			y={el.y + verticalPadding}
			width={Math.max(1, el.width - horizontalPadding * 2)}
			height={Math.max(1, el.height - verticalPadding * 2)}
			pointerEvents="none"
		>
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems:
						verticalAlign === "top"
							? "flex-start"
							: verticalAlign === "bottom"
								? "flex-end"
								: "center",
					justifyContent: isStickyNote ? "flex-start" : justifyContent,
					overflow: "hidden",
				}}
			>
				<div
					style={{
						width: "100%",
						fontSize,
						fontFamily: el.fontFamily ?? defaultFontFamily,
						fontWeight: el.fontWeight ?? "normal",
						fontStyle: el.fontStyle ?? "normal",
						textDecoration: el.textDecoration ?? "none",
						color: isStickyNote
							? "#1e1e1e"
							: (el.textColor ?? el.stroke ?? "var(--foreground)"),
						textAlign,
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
						overflowWrap: isWireframeNode ? "anywhere" : undefined,
						overflow: "hidden",
						lineHeight,
						opacity: text === stickyPlaceholder ? 0.45 : 1,
					}}
				>
					{text}
				</div>
			</div>
		</foreignObject>
	);
}
