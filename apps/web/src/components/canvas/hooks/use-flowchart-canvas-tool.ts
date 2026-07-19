import { TOOL_FONT_FAMILY } from "@/lib/canvas/canvas-defaults";
import { useI18n } from "@/lib/i18n";
import {
	buildFlowchartConnectorSyncUpdates,
	executeCanvasMutationPlan,
	getFlowchartConnectorMeta,
	planFlowchartStepMutation,
} from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import { useCallback, useEffect } from "react";
import type { AddFlowchartStepOptions } from "../canvas-commands";
import type { CanvasStore, CanvasSync } from "../canvas-tool-types";

interface UseFlowchartCanvasToolOptions {
	sync: CanvasSync;
	store: CanvasStore;
}

export function useFlowchartCanvasTool({
	sync,
	store,
}: UseFlowchartCanvasToolOptions) {
	const { t } = useI18n();

	useEffect(() => {
		const orphanConnectorIds: string[] = [];
		for (const element of sync.elements.values()) {
			const connectorMeta = getFlowchartConnectorMeta(element);
			if (!connectorMeta) continue;
			if (
				!sync.elements.has(connectorMeta.flowchartSourceId) ||
				!sync.elements.has(connectorMeta.flowchartTargetId)
			) {
				orphanConnectorIds.push(element.id);
			}
		}
		if (orphanConnectorIds.length > 0) {
			sync.deleteElements(orphanConnectorIds);
			return;
		}

		const connectorUpdates = buildFlowchartConnectorSyncUpdates(sync.elements);
		if (connectorUpdates.length > 0) sync.updateElements(connectorUpdates);
	}, [sync.elements, sync.deleteElements, sync.updateElements]);

	const addStep = useCallback(
		(nodeId: string, options?: AddFlowchartStepOptions) => {
			const normalized =
				typeof options === "string" ? { branch: options } : (options ?? {});
			const branch = normalized.branch ?? "next";
			const nodeKind = normalized.nodeKind ?? "step";
			const plan = planFlowchartStepMutation({
				elements: sync.elements,
				nodeId,
				createId: nanoid,
				branch,
				route: normalized.route,
				nodeKind,
				label:
					normalized.label ??
					(branch === "yes"
						? t("templateContent.flowchart.yes")
						: branch === "no"
							? t("templateContent.flowchart.no")
							: t(`canvas.flowchart.nodeKinds.${nodeKind}`)),
				stroke: store.strokeColor,
				fontFamily: TOOL_FONT_FAMILY,
			});
			if (!plan) return;
			executeCanvasMutationPlan(plan, {
				createElement: sync.createElement,
				updateElements: sync.updateElements,
				deleteElements: sync.deleteElements,
				setSelectedIds: store.setSelectedIds,
				setEditingTextId: store.setEditingTextId,
			});
		},
		[
			store.setEditingTextId,
			store.setSelectedIds,
			store.strokeColor,
			sync.createElement,
			sync.deleteElements,
			sync.elements,
			sync.updateElements,
			t,
		],
	);

	return { addFlowchartStep: addStep };
}
