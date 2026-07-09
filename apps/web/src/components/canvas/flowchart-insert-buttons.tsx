import { useI18n } from "@/lib/i18n";
import type { FlowchartNodeKind, FlowchartNodeMeta } from "@skedra/canvas-core";
import type { CanvasElement, Viewport } from "@skedra/canvas-core";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { AddFlowchartStepOptions } from "./canvas-commands";

interface FlowchartInsertButtonsProps {
	node: CanvasElement;
	meta: FlowchartNodeMeta;
	viewport: Viewport;
	insertKind: FlowchartNodeKind;
	onAddStep: (nodeId: string, options?: AddFlowchartStepOptions) => void;
}

export function FlowchartInsertButtons({
	node,
	meta,
	viewport,
	insertKind,
	onAddStep,
}: FlowchartInsertButtonsProps) {
	const { t } = useI18n();
	const buttonX = viewport.x + (node.x + node.width) * viewport.zoom;
	const buttonY = viewport.y + (node.y + node.height / 2) * viewport.zoom;
	const topButtonX = viewport.x + (node.x + node.width / 2) * viewport.zoom;
	const topButtonY = viewport.y + node.y * viewport.zoom;
	const leftButtonX = viewport.x + node.x * viewport.zoom;
	const leftButtonY = viewport.y + (node.y + node.height / 2) * viewport.zoom;
	const noButtonX = viewport.x + (node.x + node.width / 2) * viewport.zoom;
	const noButtonY = viewport.y + (node.y + node.height) * viewport.zoom;
	const nodeKindLabel = t(`canvas.flowchart.nodeKinds.${insertKind}`);

	return (
		<>
			<FlowchartInsertButton
				left={topButtonX}
				top={topButtonY}
				label={`${t("canvas.flowchart.attachTop")} (${nodeKindLabel})`}
				onClick={() =>
					onAddStep(node.id, {
						route: "up",
						nodeKind: insertKind,
					})
				}
			/>
			<FlowchartInsertButton
				left={buttonX}
				top={buttonY}
				label={
					meta.flowchartNodeKind === "decision"
						? t("canvas.flowchart.addYesBranch")
						: t("canvas.flowchart.attachRight")
				}
				onClick={() =>
					onAddStep(
						node.id,
						meta.flowchartNodeKind === "decision"
							? {
									branch: "yes",
									route: "right",
									nodeKind: insertKind,
									label: t("templateContent.flowchart.yes"),
								}
							: { route: "right", nodeKind: insertKind },
					)
				}
			>
				{meta.flowchartNodeKind === "decision" && (
					<span className="pointer-events-none absolute -right-7 top-1/2 -translate-y-1/2 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-emerald-700 shadow-sm">
						{t("templateContent.flowchart.yes")}
					</span>
				)}
			</FlowchartInsertButton>
			<FlowchartInsertButton
				left={leftButtonX}
				top={leftButtonY}
				label={`${t("canvas.flowchart.attachLeft")} (${nodeKindLabel})`}
				onClick={() =>
					onAddStep(node.id, {
						route: "left",
						nodeKind: insertKind,
					})
				}
			/>
			<FlowchartInsertButton
				left={noButtonX}
				top={noButtonY}
				label={
					meta.flowchartNodeKind === "decision"
						? t("canvas.flowchart.addNoBranch")
						: t("canvas.flowchart.attachBottom")
				}
				onClick={() =>
					onAddStep(
						node.id,
						meta.flowchartNodeKind === "decision"
							? {
									branch: "no",
									route: "down",
									nodeKind: insertKind,
									label: t("templateContent.flowchart.no"),
								}
							: { route: "down", nodeKind: insertKind },
					)
				}
			>
				{meta.flowchartNodeKind === "decision" && (
					<span className="pointer-events-none absolute left-1/2 top-9 -translate-x-1/2 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-violet-700 shadow-sm">
						{t("templateContent.flowchart.no")}
					</span>
				)}
			</FlowchartInsertButton>
		</>
	);
}

interface FlowchartInsertButtonProps {
	left: number;
	top: number;
	label: string;
	onClick: () => void;
	children?: ReactNode;
}

function FlowchartInsertButton({
	left,
	top,
	label,
	onClick,
	children,
}: FlowchartInsertButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="absolute z-40 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-card-foreground shadow-lg transition-colors hover:border-primary hover:bg-primary/10"
			style={{ left, top }}
			aria-label={label}
			title={label}
		>
			<Plus className="h-4 w-4" />
			{children}
		</button>
	);
}
