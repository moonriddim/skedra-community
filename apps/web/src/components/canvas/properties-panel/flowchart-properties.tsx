/**
 * Flowchart-Knoten und Verbindungen im Eigenschaften-Panel.
 */

import { useI18n } from "@/lib/i18n";
import type {
	FlowchartConnectorMeta,
	FlowchartConnectorRoute,
	FlowchartNodeKind,
	FlowchartNodeMeta,
} from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import {
	ArrowDown,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	Pencil,
} from "lucide-react";
import { Section } from "./controls";

interface FlowchartPropertiesProps {
	flowchartNode: CanvasElement | null;
	flowchartNodeMeta: FlowchartNodeMeta | null;
	flowchartConnector: CanvasElement | null;
	flowchartConnectorMeta: FlowchartConnectorMeta | null;
	flowchartInsertKind: FlowchartNodeKind;
	onSetInsertKind: (kind: FlowchartNodeKind) => void;
	onEditNodeText: () => void;
	onSetNodeKind: (kind: FlowchartNodeKind) => void;
	onAddNodeOnSide: (
		route: Exclude<FlowchartConnectorRoute, "left-up">,
		options?: { branch?: "next" | "yes" | "no"; label?: string },
	) => void;
	onSetConnectorLabel: (label: string | undefined, textColor?: string) => void;
	onEditConnectorLabel: () => void;
}

export function FlowchartProperties({
	flowchartNode,
	flowchartNodeMeta,
	flowchartConnector,
	flowchartConnectorMeta,
	flowchartInsertKind,
	onSetInsertKind,
	onEditNodeText,
	onSetNodeKind,
	onAddNodeOnSide,
	onSetConnectorLabel,
	onEditConnectorLabel,
}: FlowchartPropertiesProps) {
	const { t } = useI18n();

	return (
		<>
			{flowchartNodeMeta && flowchartNode && (
				<>
					<Section label={t("canvas.properties.flowchartNodeType")}>
						<div className="space-y-2 rounded border border-border px-2 py-1.5">
							<div className="text-[11px] text-muted-foreground">
								{t(
									`canvas.flowchart.nodeKinds.${flowchartNodeMeta.flowchartNodeKind}`,
								)}
							</div>
							<button
								type="button"
								onClick={onEditNodeText}
								className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded border border-border px-2 py-1.5 text-center text-[11px] leading-tight transition-all cursor-pointer hover:border-primary hover:bg-primary/10"
							>
								<Pencil className="h-3.5 w-3.5" />
								<span>{t("canvas.flowchart.editNodeText")}</span>
							</button>
							<p className="text-[10px] leading-tight text-muted-foreground/80">
								{t("canvas.flowchart.doubleClickHint")}
							</p>
						</div>
					</Section>
					<Section label={t("canvas.properties.nodeType")}>
						<div className="grid grid-cols-2 gap-1.5">
							{(["start", "step", "decision", "end"] as const).map((kind) => (
								<button
									key={kind}
									type="button"
									onClick={() => onSetNodeKind(kind)}
									className={`min-h-9 rounded border px-2 py-1.5 text-[11px] text-center leading-tight whitespace-normal wrap-break-word transition-all cursor-pointer ${
										flowchartNodeMeta.flowchartNodeKind === kind
											? "border-primary bg-primary/10 text-primary"
											: "border-border hover:border-primary hover:bg-primary/5"
									}`}
								>
									{t(`canvas.flowchart.nodeKinds.${kind}`)}
								</button>
							))}
						</div>
					</Section>
					<Section label={t("canvas.flowchart.insertNodeKind")}>
						<div className="grid grid-cols-2 gap-1.5">
							{(["start", "step", "decision", "end"] as const).map((kind) => (
								<button
									key={kind}
									type="button"
									onClick={() => onSetInsertKind(kind)}
									className={`min-h-9 rounded border px-2 py-1.5 text-[11px] text-center leading-tight whitespace-normal wrap-break-word transition-all cursor-pointer ${
										flowchartInsertKind === kind
											? "border-primary bg-primary/10 text-primary"
											: "border-border hover:border-primary hover:bg-primary/5"
									}`}
								>
									{t(`canvas.flowchart.nodeKinds.${kind}`)}
								</button>
							))}
						</div>
					</Section>
					<Section label={t("canvas.properties.actions")}>
						<div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
							<button
								type="button"
								onClick={() => onAddNodeOnSide("up")}
								className="flex min-h-11 items-center justify-center gap-1.5 rounded border border-border px-2 py-1.5 text-center leading-tight whitespace-normal wrap-break-word hover:border-primary hover:bg-primary/10 transition-all cursor-pointer sm:flex-col sm:gap-0.5"
							>
								<ArrowUp className="h-3.5 w-3.5" />
								<span>{t("canvas.flowchart.attachTop")}</span>
							</button>
							<button
								type="button"
								onClick={() =>
									onAddNodeOnSide(
										"right",
										flowchartNodeMeta.flowchartNodeKind === "decision"
											? {
													branch: "yes",
													label: t("templateContent.flowchart.yes"),
												}
											: undefined,
									)
								}
								className="flex min-h-11 items-center justify-center gap-1.5 rounded border border-border px-2 py-1.5 text-center leading-tight whitespace-normal wrap-break-word hover:border-primary hover:bg-primary/10 transition-all cursor-pointer sm:flex-col sm:gap-0.5"
							>
								<ArrowRight className="h-3.5 w-3.5" />
								<span>
									{flowchartNodeMeta.flowchartNodeKind === "decision"
										? t("canvas.flowchart.addYesBranch")
										: t("canvas.flowchart.attachRight")}
								</span>
							</button>
							<button
								type="button"
								onClick={() =>
									onAddNodeOnSide(
										"down",
										flowchartNodeMeta.flowchartNodeKind === "decision"
											? {
													branch: "no",
													label: t("templateContent.flowchart.no"),
												}
											: undefined,
									)
								}
								className="flex min-h-11 items-center justify-center gap-1.5 rounded border border-border px-2 py-1.5 text-center leading-tight whitespace-normal wrap-break-word hover:border-primary hover:bg-primary/10 transition-all cursor-pointer sm:flex-col sm:gap-0.5"
							>
								<ArrowDown className="h-3.5 w-3.5" />
								<span>
									{flowchartNodeMeta.flowchartNodeKind === "decision"
										? t("canvas.flowchart.addNoBranch")
										: t("canvas.flowchart.attachBottom")}
								</span>
							</button>
							<button
								type="button"
								onClick={() => onAddNodeOnSide("left")}
								className="flex min-h-11 items-center justify-center gap-1.5 rounded border border-border px-2 py-1.5 text-center leading-tight whitespace-normal wrap-break-word hover:border-primary hover:bg-primary/10 transition-all cursor-pointer sm:flex-col sm:gap-0.5"
							>
								<ArrowLeft className="h-3.5 w-3.5" />
								<span>{t("canvas.flowchart.attachLeft")}</span>
							</button>
						</div>
					</Section>
				</>
			)}

			{flowchartConnectorMeta && flowchartConnector && (
				<Section label={t("canvas.properties.flowchartConnectorLabel")}>
					<div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
						<button
							type="button"
							onClick={() =>
								onSetConnectorLabel(t("templateContent.flowchart.yes"))
							}
							className="min-h-10 rounded border border-border px-2 py-1.5 text-center leading-tight whitespace-normal wrap-break-word hover:border-primary hover:bg-primary/10 transition-all cursor-pointer"
						>
							{t("templateContent.flowchart.yes")}
						</button>
						<button
							type="button"
							onClick={() =>
								onSetConnectorLabel(t("templateContent.flowchart.no"))
							}
							className="min-h-10 rounded border border-border px-2 py-1.5 text-center leading-tight whitespace-normal wrap-break-word hover:border-primary hover:bg-primary/10 transition-all cursor-pointer"
						>
							{t("templateContent.flowchart.no")}
						</button>
						<button
							type="button"
							onClick={onEditConnectorLabel}
							className="min-h-10 rounded border border-border px-2 py-1.5 text-center leading-tight whitespace-normal wrap-break-word hover:border-primary hover:bg-primary/10 transition-all cursor-pointer"
						>
							{t("canvas.flowchart.editConnectorLabel")}
						</button>
						<button
							type="button"
							onClick={() => onSetConnectorLabel(undefined, undefined)}
							className="min-h-10 rounded border border-border px-2 py-1.5 text-center leading-tight whitespace-normal wrap-break-word hover:border-primary hover:bg-primary/10 transition-all cursor-pointer"
						>
							{t("canvas.flowchart.clearConnectorLabel")}
						</button>
					</div>
				</Section>
			)}
		</>
	);
}
