import { TOOL_FONT_FAMILY } from "@/lib/canvas/canvas-defaults";
import { useI18n } from "@/lib/i18n";
import {
	FLOWCHART_BRANCH_GAP,
	FLOWCHART_HORIZONTAL_GAP,
	type FlowchartConnectorRoute,
	type FlowchartNodeKind,
	buildFlowchartConnectorSyncUpdates,
	createFlowchartConnector,
	createFlowchartNode,
	createStackIndexAfter,
	createStackIndexBeforeElement,
	getFlowchartBranchTarget,
	getFlowchartConnectorMeta,
	getFlowchartNodeMeta,
	getFlowchartNodePreset,
	getFlowchartOutgoingNodes,
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
		if (connectorUpdates.length > 0) {
			sync.updateElements(connectorUpdates);
		}
	}, [sync.elements, sync.deleteElements, sync.updateElements]);

	const addStep = useCallback(
		(nodeId: string, options?: AddFlowchartStepOptions) => {
			const node = sync.elements.get(nodeId);
			const meta = getFlowchartNodeMeta(node);
			if (!node || !meta) return;

			const normalizedOptions =
				typeof options === "string" ? { branch: options } : (options ?? {});
			const branch = normalizedOptions.branch ?? "next";
			const route =
				normalizedOptions.route ??
				(branch === "no" ? "down" : branch === "yes" ? "right" : "right");
			const nodeKind = normalizedOptions.nodeKind ?? "step";
			const preset = getFlowchartNodePreset(nodeKind, store.strokeColor);

			if (branch !== "next") {
				const existingBranchTarget = getFlowchartBranchTarget(
					node.id,
					branch,
					sync.elements,
				);
				if (existingBranchTarget) {
					store.setSelectedIds(new Set([existingBranchTarget.id]));
					store.setEditingTextId(existingBranchTarget.id);
					return;
				}
			}

			const outgoing = getFlowchartOutgoingNodes(node.id, route, sync.elements);
			const nextNodeId = nanoid();
			const connectorId = nanoid();
			const nextStackIndex = createStackIndexAfter(
				sync.elements.values(),
				nextNodeId,
			);
			const centeredX = node.x + node.width / 2 - preset.width / 2;
			const centeredY = node.y + node.height / 2 - preset.height / 2;
			const nextX =
				route === "down" || route === "up"
					? centeredX + outgoing.length * 36
					: route === "left"
						? outgoing.length === 0
							? node.x - preset.width - FLOWCHART_HORIZONTAL_GAP
							: Math.min(...outgoing.map((entry) => entry.x)) -
								preset.width -
								FLOWCHART_HORIZONTAL_GAP
						: outgoing.length === 0
							? node.x + node.width + FLOWCHART_HORIZONTAL_GAP
							: Math.max(...outgoing.map((entry) => entry.x + entry.width)) +
								FLOWCHART_HORIZONTAL_GAP;
			const nextY =
				route === "right" || route === "left"
					? centeredY + outgoing.length * FLOWCHART_BRANCH_GAP
					: route === "up"
						? outgoing.length === 0
							? node.y - preset.height - FLOWCHART_BRANCH_GAP
							: Math.min(...outgoing.map((entry) => entry.y)) -
								preset.height -
								FLOWCHART_BRANCH_GAP
						: outgoing.length === 0
							? node.y + node.height + FLOWCHART_BRANCH_GAP
							: Math.max(...outgoing.map((entry) => entry.y + entry.height)) +
								FLOWCHART_BRANCH_GAP;
			const nextNode = createFlowchartNode({
				id: nextNodeId,
				x: nextX,
				y: nextY,
				width: preset.width,
				height: preset.height,
				type: preset.type,
				text:
					normalizedOptions.label ??
					(branch === "yes"
						? t("templateContent.flowchart.yes")
						: branch === "no"
							? t("templateContent.flowchart.no")
							: t(`canvas.flowchart.nodeKinds.${nodeKind}`)),
				flowchartId: meta.flowchartId,
				nodeKind,
				stroke: preset.stroke,
				cornerRadius: preset.cornerRadius,
				fontSize: preset.fontSize,
				fontFamily: TOOL_FONT_FAMILY,
				fontWeight: preset.fontWeight,
				stackIndex: nextStackIndex,
			});
			const connector = createFlowchartConnector({
				id: connectorId,
				flowchartId: meta.flowchartId,
				source: node,
				target: nextNode,
				route,
				branchKind: branch,
				text:
					branch === "yes"
						? t("templateContent.flowchart.yes")
						: branch === "no"
							? t("templateContent.flowchart.no")
							: undefined,
				fontSize: branch === "next" ? undefined : 12,
				arrowTextSide: branch === "no" || route === "up" ? "below" : "above",
				stackIndex: createStackIndexBeforeElement(
					[...sync.elements.values(), nextNode],
					nextNode.id,
					connectorId,
				),
			});
			sync.createElement(nextNode);
			sync.createElement(connector);
			store.setSelectedIds(new Set([nextNode.id]));
			store.setEditingTextId(null);
		},
		[store, sync, t],
	);

	return { addFlowchartStep: addStep };
}
