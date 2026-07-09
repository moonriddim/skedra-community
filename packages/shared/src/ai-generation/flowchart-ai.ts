/**
 * Flowchart-Builder fuer AI (flowchart-node / flowchart-connector).
 */

import { z } from "zod";
import type { AddCanvasElementInput } from "../canvas-api";

const NODE_PRESETS = {
	start: {
		type: "ellipse" as const,
		width: 160,
		height: 56,
		stroke: "#15803D",
	},
	step: {
		type: "rectangle" as const,
		width: 220,
		height: 88,
		stroke: "#2563EB",
		cornerRadius: 18,
	},
	decision: {
		type: "diamond" as const,
		width: 180,
		height: 120,
		stroke: "#D97706",
	},
	end: { type: "ellipse" as const, width: 170, height: 56, stroke: "#EA580C" },
};

const flowchartNodeKindSchema = z.enum(["start", "step", "decision", "end"]);
const flowchartRouteSchema = z.enum(["up", "right", "down", "left", "left-up"]);
const flowchartBranchSchema = z.enum(["next", "yes", "no"]);

const aiFlowchartNodeSchema = z.object({
	id: z.string().min(1).max(40),
	kind: flowchartNodeKindSchema,
	text: z.string().min(1).max(300),
});

const aiFlowchartEdgeSchema = z.object({
	from: z.string().min(1).max(40),
	to: z.string().min(1).max(40),
	route: flowchartRouteSchema.optional(),
	branch: flowchartBranchSchema.optional(),
	label: z.string().max(80).optional(),
});

export const aiFlowchartSchema = z.object({
	nodes: z.array(aiFlowchartNodeSchema).min(2).max(20),
	edges: z.array(aiFlowchartEdgeSchema).min(1).max(30),
});

export type AiFlowchartInput = z.infer<typeof aiFlowchartSchema>;

function createId() {
	return crypto.randomUUID();
}

type BuiltFlowNode = AddCanvasElementInput & { id: string };

function buildFlowchartNode(
	node: z.infer<typeof aiFlowchartNodeSchema>,
	flowchartId: string,
	x: number,
	y: number,
): BuiltFlowNode {
	const preset = NODE_PRESETS[node.kind];
	return {
		id: createId(),
		type: preset.type,
		x,
		y,
		width: preset.width,
		height: preset.height,
		fill: "transparent",
		stroke: preset.stroke,
		strokeWidth: 2,
		cornerRadius: "cornerRadius" in preset ? preset.cornerRadius : undefined,
		text: node.text,
		fontSize: 18,
		fontWeight: "bold",
		textAlign: "center",
		customData: {
			skedraType: "flowchart-node",
			flowchartId,
			flowchartNodeKind: node.kind,
			aiNodeKey: node.id,
		},
	};
}

function connectorGeometry(
	source: BuiltFlowNode,
	target: BuiltFlowNode,
	route: z.infer<typeof flowchartRouteSchema>,
) {
	const sourceCenterX = source.x + source.width / 2;
	const sourceCenterY = source.y + source.height / 2;
	const targetCenterX = target.x + target.width / 2;
	const targetCenterY = target.y + target.height / 2;

	let absolutePoints: [number, number][];
	if (route === "down") {
		absolutePoints = [
			[sourceCenterX, source.y + source.height],
			[targetCenterX, target.y],
		];
	} else if (route === "up") {
		absolutePoints = [
			[sourceCenterX, source.y],
			[targetCenterX, target.y + target.height],
		];
	} else if (route === "left") {
		absolutePoints = [
			[source.x, sourceCenterY],
			[target.x + target.width, targetCenterY],
		];
	} else if (route === "left-up") {
		absolutePoints = [
			[source.x, sourceCenterY],
			[targetCenterX, sourceCenterY],
			[targetCenterX, target.y + target.height],
		];
	} else {
		absolutePoints = [
			[source.x + source.width, sourceCenterY],
			[target.x, targetCenterY],
		];
	}

	const minX = Math.min(...absolutePoints.map(([x]) => x));
	const minY = Math.min(...absolutePoints.map(([, y]) => y));
	const maxX = Math.max(...absolutePoints.map(([x]) => x));
	const maxY = Math.max(...absolutePoints.map(([, y]) => y));

	return {
		x: minX,
		y: minY,
		width: Math.max(1, maxX - minX),
		height: Math.max(1, maxY - minY),
		points: absolutePoints.map(
			([x, y]) => [x - minX, y - minY] as [number, number],
		),
		arrowMode:
			absolutePoints.length > 2 ? ("elbow" as const) : ("straight" as const),
	};
}

function autoLayoutNodes(
	nodes: AiFlowchartInput["nodes"],
	edges: AiFlowchartInput["edges"],
) {
	const positions = new Map<string, { x: number; y: number }>();
	const fallbackStartNode = nodes[0];
	if (!fallbackStartNode) return positions;
	const startNode =
		nodes.find((node) => node.kind === "start") ?? fallbackStartNode;
	let cursorX = 80;
	const baseY = 180;

	const visited = new Set<string>();
	const queue = [startNode.id];
	const idToNode = new Map(nodes.map((node) => [node.id, node]));

	while (queue.length > 0) {
		const id = queue.shift();
		if (id === undefined) continue;
		if (visited.has(id)) continue;
		visited.add(id);
		const node = idToNode.get(id);
		if (!node) continue;

		const preset = NODE_PRESETS[node.kind];
		if (!positions.has(id)) {
			positions.set(id, { x: cursorX, y: baseY - preset.height / 2 });
			cursorX += preset.width + 100;
		}

		for (const edge of edges.filter((entry) => entry.from === id)) {
			if (edge.branch === "no" || edge.route === "down") {
				const sourcePos = positions.get(id);
				if (!sourcePos) continue;
				const targetPreset =
					NODE_PRESETS[idToNode.get(edge.to)?.kind ?? "step"];
				positions.set(edge.to, {
					x:
						sourcePos.x +
						NODE_PRESETS[node.kind].width / 2 -
						targetPreset.width / 2,
					y: sourcePos.y + NODE_PRESETS[node.kind].height + 80,
				});
			} else if (!positions.has(edge.to)) {
				const targetNode = idToNode.get(edge.to);
				if (targetNode) {
					positions.set(edge.to, {
						x: cursorX,
						y: baseY - NODE_PRESETS[targetNode.kind].height / 2,
					});
					cursorX += NODE_PRESETS[targetNode.kind].width + 100;
				}
			}
			queue.push(edge.to);
		}
	}

	for (const node of nodes) {
		if (!positions.has(node.id)) {
			positions.set(node.id, {
				x: cursorX,
				y: baseY - NODE_PRESETS[node.kind].height / 2,
			});
			cursorX += NODE_PRESETS[node.kind].width + 100;
		}
	}

	return positions;
}

export function buildFlowchartElementsFromAi(input: AiFlowchartInput): {
	elements: AddCanvasElementInput[];
	nodeCount: number;
	edgeCount: number;
} {
	const flowchartId = createId();
	const positions = autoLayoutNodes(input.nodes, input.edges);
	const builtNodes = new Map<string, BuiltFlowNode>();

	input.nodes.forEach((node, index) => {
		const pos = positions.get(node.id) ?? { x: 80 + index * 280, y: 180 };
		const built = buildFlowchartNode(node, flowchartId, pos.x, pos.y);
		builtNodes.set(node.id, built);
	});

	const connectors: AddCanvasElementInput[] = [];

	for (const edge of input.edges) {
		const source = builtNodes.get(edge.from);
		const target = builtNodes.get(edge.to);
		if (!source || !target) continue;

		const route = edge.route ?? (edge.branch === "no" ? "down" : "right");
		const branch =
			edge.branch ??
			(route === "down" ? "no" : route === "right" ? "yes" : "next");
		const geometry = connectorGeometry(source, target, route);

		connectors.push({
			id: createId(),
			type: "arrow",
			x: geometry.x,
			y: geometry.y,
			width: geometry.width,
			height: geometry.height,
			fill: "transparent",
			stroke: source.stroke ?? "#94A3B8",
			strokeWidth: 2,
			text: edge.label,
			fontSize: edge.label ? 12 : undefined,
			fontWeight: edge.label ? "bold" : undefined,
			points: geometry.points,
			arrowMode: geometry.arrowMode,
			arrowHeadStart: "none",
			arrowHeadEnd: "arrow",
			customData: {
				skedraType: "flowchart-connector",
				flowchartId,
				flowchartSourceId: source.id,
				flowchartTargetId: target.id,
				flowchartRoute: route,
				flowchartBranchKind: branch,
			},
		});
	}

	return {
		elements: [...connectors, ...builtNodes.values()],
		nodeCount: builtNodes.size,
		edgeCount: input.edges.length,
	};
}
