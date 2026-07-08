import {
	type FlowchartConnectorRoute,
	getFlowchartBranchTarget,
	getFlowchartNodeMeta,
	getFlowchartOutgoingNodes,
	isFlowchartNode,
} from "./flowchart";
import type { CanvasElement } from "./types";

export type FlowchartDirection = "up" | "down" | "left" | "right";

const ROUTE_BY_DIRECTION: Record<FlowchartDirection, FlowchartConnectorRoute> =
	{
		up: "up",
		down: "down",
		left: "left",
		right: "right",
	};

export function getFlowchartRouteForDirection(
	direction: FlowchartDirection,
): FlowchartConnectorRoute {
	return ROUTE_BY_DIRECTION[direction];
}

function getConnectedFlowchartTarget(
	nodeId: string,
	direction: FlowchartDirection,
	elements: Map<string, CanvasElement>,
): CanvasElement | null {
	const route = ROUTE_BY_DIRECTION[direction];
	const outgoing = getFlowchartOutgoingNodes(nodeId, route, elements);
	if (outgoing.length > 0) return outgoing[0];

	if (direction === "right") {
		return getFlowchartBranchTarget(nodeId, "yes", elements);
	}
	if (direction === "down") {
		return getFlowchartBranchTarget(nodeId, "no", elements);
	}

	return null;
}

function findNearestFlowchartNodeInDirection(
	from: CanvasElement,
	direction: FlowchartDirection,
	elements: Map<string, CanvasElement>,
): CanvasElement | null {
	const meta = getFlowchartNodeMeta(from);
	if (!meta) return null;

	const fromCenterX = from.x + from.width / 2;
	const fromCenterY = from.y + from.height / 2;
	let best: CanvasElement | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;

	for (const candidate of elements.values()) {
		if (candidate.id === from.id || !isFlowchartNode(candidate)) continue;
		const candidateMeta = getFlowchartNodeMeta(candidate);
		if (!candidateMeta || candidateMeta.flowchartId !== meta.flowchartId) {
			continue;
		}

		const cx = candidate.x + candidate.width / 2;
		const cy = candidate.y + candidate.height / 2;
		const dx = cx - fromCenterX;
		const dy = cy - fromCenterY;

		const inDirection =
			(direction === "right" && dx > 20 && Math.abs(dy) < Math.abs(dx)) ||
			(direction === "left" && dx < -20 && Math.abs(dy) < Math.abs(dx)) ||
			(direction === "down" && dy > 20 && Math.abs(dx) < Math.abs(dy)) ||
			(direction === "up" && dy < -20 && Math.abs(dx) < Math.abs(dy));

		if (!inDirection) continue;

		const distance = Math.hypot(dx, dy);
		if (distance < bestDistance) {
			bestDistance = distance;
			best = candidate;
		}
	}

	return best;
}

export function navigateFlowchartInDirection(
	nodeId: string,
	direction: FlowchartDirection,
	elements: Map<string, CanvasElement>,
): CanvasElement | null {
	const node = elements.get(nodeId);
	if (!node) return null;

	return (
		getConnectedFlowchartTarget(nodeId, direction, elements) ??
		findNearestFlowchartNodeInDirection(node, direction, elements)
	);
}
