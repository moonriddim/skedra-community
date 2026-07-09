import {
	getWhiteboardPreviewBounds,
	readWhiteboardPreviewElements,
} from "@/lib/canvas/preview";
import {
	getTemplateSectionMeta,
	getTemplateStickyNoteMeta,
} from "@/lib/canvas/template-tool-utils";
import {
	getFlowchartConnectorMeta,
	getFlowchartNodeMeta,
} from "@skedra/canvas-core";
import { type CanvasElement, sortCanvasElements } from "@skedra/canvas-core";
import { Presentation } from "lucide-react";

interface WhiteboardCardPreviewProps {
	yjsState: unknown;
	emptyLabel: string;
}

export function WhiteboardCardPreview({
	yjsState,
	emptyLabel,
}: WhiteboardCardPreviewProps) {
	const elements = readWhiteboardPreviewElements(yjsState);
	const bounds = getWhiteboardPreviewBounds(elements);
	const hasContent = elements.size > 0;

	return (
		<div className="relative overflow-hidden rounded-[22px] border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.16),transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.72))]">
			{hasContent ? (
				<>
					<svg
						className="h-48 w-full"
						viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
						preserveAspectRatio="xMidYMid meet"
						aria-hidden="true"
					>
						<rect
							x={bounds.minX}
							y={bounds.minY}
							width={bounds.width}
							height={bounds.height}
							fill="rgba(255,255,255,0.82)"
						/>
						{sortCanvasElements(elements.values()).map((element) => (
							<PreviewShape key={element.id} element={element} />
						))}
					</svg>
					<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.26)_100%)]" />
				</>
			) : (
				<div className="flex h-48 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
					<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background/70 shadow-sm">
						<Presentation className="h-5 w-5" />
					</div>
					<p className="text-sm font-medium">{emptyLabel}</p>
				</div>
			)}
		</div>
	);
}

function PreviewShape({ element }: { element: CanvasElement }) {
	const width = Math.max(element.width, 1);
	const constHeight = Math.max(element.height, 1);
	const skedraType = element.customData?.skedraType;
	const templateSection = getTemplateSectionMeta(element);
	const templateNote = getTemplateStickyNoteMeta(element);
	const flowchartNode = getFlowchartNodeMeta(element);
	const flowchartConnector = getFlowchartConnectorMeta(element);

	if (templateSection) {
		return (
			<g>
				<rect
					x={element.x}
					y={element.y}
					width={width}
					height={constHeight}
					rx={18}
					fill={templateSection.templateAccent}
					opacity={0.08}
					stroke={templateSection.templateAccent}
					strokeWidth={1.5}
				/>
				<text
					x={element.x + 16}
					y={element.y + 24}
					fill={templateSection.templateAccent}
					fontSize={14}
					fontWeight={700}
					fontFamily="system-ui, sans-serif"
				>
					{String(element.frameLabel ?? "Section")}
				</text>
			</g>
		);
	}

	if (element.type === "frame" && skedraType === "kanban-list") {
		return (
			<g>
				<rect
					x={element.x}
					y={element.y}
					width={width}
					height={constHeight}
					rx={16}
					fill="var(--kanban-list-bg)"
					stroke="var(--kanban-list-border)"
					strokeWidth={1.5}
				/>
				<rect
					x={element.x}
					y={element.y}
					width={width}
					height={56}
					rx={16}
					fill="var(--kanban-list-header-bg)"
				/>
				<text
					x={element.x + 18}
					y={element.y + 33}
					fill="var(--kanban-list-header-text)"
					fontSize={18}
					fontWeight={700}
					fontFamily="system-ui, sans-serif"
				>
					{String(element.frameLabel ?? "Liste")}
				</text>
			</g>
		);
	}

	if (templateNote && element.type === "rectangle") {
		const title = String(element.text ?? "").slice(0, 24);
		return (
			<g>
				<rect
					x={element.x}
					y={element.y}
					width={width}
					height={constHeight}
					rx={10}
					fill={element.fill || templateNote.stickyColor}
					stroke={templateNote.templateAccent}
					strokeWidth={1.5}
				/>
				<rect
					x={element.x}
					y={element.y}
					width={width}
					height={16}
					rx={10}
					fill={templateNote.templateAccent}
					opacity={0.18}
				/>
				{textOrNull(title) && (
					<text
						x={element.x + 12}
						y={element.y + 34}
						fill="#1f2937"
						fontSize={13}
						fontWeight={600}
						fontFamily="system-ui, sans-serif"
					>
						{title}
					</text>
				)}
			</g>
		);
	}

	if (element.type === "rectangle" && skedraType === "kanban-card") {
		const title = String(element.text ?? "");
		return (
			<g>
				<rect
					x={element.x + 1}
					y={element.y + 2}
					width={width}
					height={constHeight}
					rx={12}
					fill="var(--kanban-card-shadow)"
					opacity={0.35}
				/>
				<rect
					x={element.x}
					y={element.y}
					width={width}
					height={constHeight}
					rx={12}
					fill="var(--kanban-card-bg)"
					stroke="var(--kanban-card-border)"
					strokeWidth={1.5}
				/>
				<text
					x={element.x + 16}
					y={element.y + 28}
					fill="var(--kanban-card-text)"
					fontSize={16}
					fontWeight={600}
					fontFamily="system-ui, sans-serif"
				>
					{title.slice(0, 28)}
				</text>
			</g>
		);
	}

	if (flowchartNode) {
		const label = String(element.text ?? "");
		if (element.type === "ellipse") {
			return (
				<g>
					<ellipse
						cx={element.x + width / 2}
						cy={element.y + constHeight / 2}
						rx={width / 2}
						ry={constHeight / 2}
						fill={element.fill || "transparent"}
						stroke={element.stroke}
						strokeWidth={element.strokeWidth}
					/>
					<text
						x={element.x + width / 2}
						y={element.y + constHeight / 2 + 5}
						fill={element.stroke}
						fontSize={14}
						fontWeight={700}
						fontFamily="system-ui, sans-serif"
						textAnchor="middle"
					>
						{label.slice(0, 22)}
					</text>
				</g>
			);
		}

		if (element.type === "diamond") {
			const points = [
				`${element.x + width / 2},${element.y}`,
				`${element.x + width},${element.y + constHeight / 2}`,
				`${element.x + width / 2},${element.y + constHeight}`,
				`${element.x},${element.y + constHeight / 2}`,
			].join(" ");
			return (
				<g>
					<polygon
						points={points}
						fill={element.fill || "transparent"}
						stroke={element.stroke}
						strokeWidth={element.strokeWidth}
					/>
					<text
						x={element.x + width / 2}
						y={element.y + constHeight / 2 + 5}
						fill={element.stroke}
						fontSize={13}
						fontWeight={700}
						fontFamily="system-ui, sans-serif"
						textAnchor="middle"
					>
						{label.slice(0, 18)}
					</text>
				</g>
			);
		}

		if (element.type === "rectangle") {
			return (
				<g>
					<rect
						x={element.x}
						y={element.y}
						width={width}
						height={constHeight}
						rx={element.cornerRadius ?? 14}
						fill={element.fill || "transparent"}
						stroke={element.stroke}
						strokeWidth={element.strokeWidth}
					/>
					<text
						x={element.x + width / 2}
						y={element.y + constHeight / 2 + 5}
						fill={element.stroke}
						fontSize={13}
						fontWeight={700}
						fontFamily="system-ui, sans-serif"
						textAnchor="middle"
					>
						{label.slice(0, 22)}
					</text>
				</g>
			);
		}
	}

	if (element.type === "rectangle") {
		return (
			<rect
				x={element.x}
				y={element.y}
				width={width}
				height={constHeight}
				rx={element.cornerRadius ?? 8}
				fill={element.fill || "transparent"}
				stroke={element.stroke}
				strokeWidth={element.strokeWidth}
				opacity={(element.opacity ?? 100) / 100}
			/>
		);
	}

	if (element.type === "ellipse") {
		return (
			<ellipse
				cx={element.x + width / 2}
				cy={element.y + constHeight / 2}
				rx={width / 2}
				ry={constHeight / 2}
				fill={element.fill || "transparent"}
				stroke={element.stroke}
				strokeWidth={element.strokeWidth}
				opacity={(element.opacity ?? 100) / 100}
			/>
		);
	}

	if (element.type === "diamond") {
		const points = [
			`${element.x + width / 2},${element.y}`,
			`${element.x + width},${element.y + constHeight / 2}`,
			`${element.x + width / 2},${element.y + constHeight}`,
			`${element.x},${element.y + constHeight / 2}`,
		].join(" ");
		return (
			<polygon
				points={points}
				fill={element.fill || "transparent"}
				stroke={element.stroke}
				strokeWidth={element.strokeWidth}
				opacity={(element.opacity ?? 100) / 100}
			/>
		);
	}

	if (
		(element.type === "line" ||
			element.type === "arrow" ||
			element.type === "freehand") &&
		element.points?.length
	) {
		const points = element.points
			.map(([x, y]) => `${element.x + x},${element.y + y}`)
			.join(" ");
		const midPoint =
			element.points[Math.floor(element.points.length / 2)] ??
			element.points[0];
		return (
			<g>
				<polyline
					points={points}
					fill="none"
					stroke={element.stroke}
					strokeWidth={element.strokeWidth}
					strokeLinecap="round"
					strokeLinejoin="round"
					opacity={(element.opacity ?? 100) / 100}
				/>
				{flowchartConnector && textOrNull(element.text ?? "") && (
					<text
						x={element.x + midPoint[0]}
						y={element.y + midPoint[1] - 6}
						fill={element.textColor ?? element.stroke}
						fontSize={11}
						fontWeight={700}
						fontFamily="system-ui, sans-serif"
						textAnchor="middle"
					>
						{String(element.text)}
					</text>
				)}
			</g>
		);
	}

	if (element.type === "text" && element.text) {
		return (
			<text
				x={element.x}
				y={element.y + (element.fontSize ?? 16)}
				fill={element.textColor ?? element.stroke}
				fontSize={element.fontSize ?? 16}
				fontFamily={element.fontFamily ?? "system-ui, sans-serif"}
				opacity={(element.opacity ?? 100) / 100}
			>
				{element.text.slice(0, 60)}
			</text>
		);
	}

	return null;
}

function textOrNull(value: string) {
	return value.trim().length > 0 ? value : null;
}
