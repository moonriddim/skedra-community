/**
 * Mindmap-Builder fuer AI (mindmap-node / mindmap-edge Metadaten).
 */

import { z } from "zod";
import type { AddCanvasElementInput } from "../canvas-api";

const MINDMAP_ROOT_WIDTH = 220;
const MINDMAP_ROOT_HEIGHT = 64;
const MINDMAP_NODE_WIDTH = 180;
const MINDMAP_NODE_HEIGHT = 56;
const MINDMAP_HORIZONTAL_GAP = 160;
const MINDMAP_VERTICAL_GAP = 88;

const BRANCH_COLORS = [
	"#2563EB",
	"#D97706",
	"#0F766E",
	"#7C3AED",
	"#DC2626",
	"#0891B2",
	"#65A30D",
	"#DB2777",
] as const;

const mindmapDirectionSchema = z.enum(["left", "right"]);

export type AiMindmapNodeInput = {
	title: string;
	direction?: "left" | "right";
	children?: AiMindmapNodeInput[];
};

const aiMindmapNodeSchema: z.ZodType<AiMindmapNodeInput> = z.lazy(() =>
	z.object({
		title: z.string().min(1).max(200),
		direction: mindmapDirectionSchema.optional(),
		children: z.array(aiMindmapNodeSchema).max(8).optional(),
	}),
);

export const aiMindmapSchema = z.object({
	root: z.string().min(1).max(200),
	branches: z.array(aiMindmapNodeSchema).min(1).max(12),
});

export type AiMindmapInput = z.infer<typeof aiMindmapSchema>;

type BuiltNode = AddCanvasElementInput & { id: string };

function createId() {
	return crypto.randomUUID();
}

function buildMindmapNode(input: {
	id: string;
	x: number;
	y: number;
	text: string;
	treeId: string;
	parentId: string | null;
	direction: "left" | "right";
	depth: number;
	branchColor: string | null;
}): BuiltNode {
	const isRoot = input.depth === 0;
	const width = isRoot ? MINDMAP_ROOT_WIDTH : MINDMAP_NODE_WIDTH;
	const height = isRoot ? MINDMAP_ROOT_HEIGHT : MINDMAP_NODE_HEIGHT;

	return {
		id: input.id,
		type: "rectangle",
		x: input.x,
		y: input.y,
		width,
		height,
		fill: isRoot ? "#F8FAFC" : "#ffffff",
		stroke: isRoot ? "#0F172A" : (input.branchColor ?? "#CBD5E1"),
		strokeWidth: isRoot ? 2.5 : 1.5,
		cornerRadius: isRoot ? 20 : 18,
		text: input.text,
		textColor: isRoot ? "#0F172A" : "#334155",
		fontSize: isRoot ? 24 : 18,
		fontWeight: isRoot ? "bold" : "normal",
		fontFamily: '"Kalam", "Architects Daughter", "Segoe Print", cursive',
		textAlign: "center",
		customData: {
			skedraType: "mindmap-node",
			mindmapTreeId: input.treeId,
			mindmapParentId: input.parentId,
			mindmapDirection: input.direction,
			mindmapDepth: input.depth,
			mindmapBranchColor: input.branchColor,
		},
	};
}

function buildMindmapEdge(input: {
	treeId: string;
	source: BuiltNode;
	target: BuiltNode;
	stroke: string;
}): AddCanvasElementInput {
	const direction =
		(input.target.customData?.mindmapDirection as
			| "left"
			| "right"
			| undefined) ?? "right";
	const sourceCenterY = (input.source.y ?? 0) + input.source.height / 2;
	const targetCenterY = (input.target.y ?? 0) + input.target.height / 2;

	const startX =
		direction === "right"
			? input.source.x + input.source.width
			: input.source.x;
	const endX =
		direction === "right"
			? input.target.x
			: input.target.x + input.target.width;
	const start: [number, number] = [startX, sourceCenterY];
	const end: [number, number] = [endX, targetCenterY];
	const handleX =
		direction === "right"
			? start[0] + Math.min(120, Math.abs(end[0] - start[0]) * 0.5)
			: start[0] - Math.min(120, Math.abs(end[0] - start[0]) * 0.5);

	const absolutePoints: [number, number][] = [
		start,
		[handleX, start[1]],
		[handleX, end[1]],
		end,
	];
	const minX = Math.min(...absolutePoints.map(([x]) => x));
	const minY = Math.min(...absolutePoints.map(([, y]) => y));
	const maxX = Math.max(...absolutePoints.map(([x]) => x));
	const maxY = Math.max(...absolutePoints.map(([, y]) => y));

	return {
		id: createId(),
		type: "arrow",
		x: minX,
		y: minY,
		width: Math.max(1, maxX - minX),
		height: Math.max(1, maxY - minY),
		fill: "transparent",
		stroke: input.stroke,
		strokeWidth: 2,
		points: absolutePoints.map(([x, y]) => [x - minX, y - minY]),
		arrowMode: "curve",
		arrowHeadStart: "none",
		arrowHeadEnd: "none",
		customData: {
			skedraType: "mindmap-edge",
			mindmapTreeId: input.treeId,
			mindmapSourceId: input.source.id,
			mindmapTargetId: input.target.id,
		},
	};
}

function layoutBranchChildren(input: {
	nodes: AiMindmapNodeInput[];
	parent: BuiltNode;
	direction: "left" | "right";
	treeId: string;
	branchColor: string;
	depth: number;
	centerY: number;
	elements: AddCanvasElementInput[];
	nodeCount: { value: number };
}) {
	const count = input.nodes.length;
	const totalHeight =
		count * MINDMAP_NODE_HEIGHT +
		Math.max(0, count - 1) * (MINDMAP_VERTICAL_GAP - 32);
	let currentY = input.centerY - totalHeight / 2;

	for (const child of input.nodes) {
		const childId = createId();
		const childX =
			input.direction === "right"
				? input.parent.x + input.parent.width + MINDMAP_HORIZONTAL_GAP
				: input.parent.x - MINDMAP_HORIZONTAL_GAP - MINDMAP_NODE_WIDTH;

		const childNode = buildMindmapNode({
			id: childId,
			x: childX,
			y: currentY,
			text: child.title,
			treeId: input.treeId,
			parentId: input.parent.id,
			direction: input.direction,
			depth: input.depth,
			branchColor: input.branchColor,
		});
		input.nodeCount.value += 1;
		input.elements.push(
			childNode,
			buildMindmapEdge({
				treeId: input.treeId,
				source: input.parent,
				target: childNode,
				stroke: input.branchColor,
			}),
		);

		if (child.children?.length) {
			layoutBranchChildren({
				nodes: child.children,
				parent: childNode,
				direction: input.direction,
				treeId: input.treeId,
				branchColor: input.branchColor,
				depth: input.depth + 1,
				centerY: currentY + MINDMAP_NODE_HEIGHT / 2,
				elements: input.elements,
				nodeCount: input.nodeCount,
			});
		}

		currentY += MINDMAP_NODE_HEIGHT + (MINDMAP_VERTICAL_GAP - 32);
	}
}

export function buildMindmapElementsFromAi(
	board: AiMindmapInput,
	options: { x?: number; y?: number } = {},
): { elements: AddCanvasElementInput[]; nodeCount: number } {
	const treeId = createId();
	const originX = options.x ?? 320;
	const originY = options.y ?? 200;
	const elements: AddCanvasElementInput[] = [];
	const nodeCount = { value: 0 };

	const rootId = createId();
	const root = buildMindmapNode({
		id: rootId,
		x: originX - MINDMAP_ROOT_WIDTH / 2,
		y: originY - MINDMAP_ROOT_HEIGHT / 2,
		text: board.root,
		treeId,
		parentId: null,
		direction: "right",
		depth: 0,
		branchColor: null,
	});
	nodeCount.value += 1;
	elements.push(root);

	board.branches.forEach((branch, index) => {
		const direction =
			branch.direction ??
			(index % 2 === 0 ? "right" : ("left" as "left" | "right"));
		const color =
			BRANCH_COLORS[index % BRANCH_COLORS.length] ?? BRANCH_COLORS[0];
		const branchId = createId();
		const branchY =
			originY +
			(index - (board.branches.length - 1) / 2) *
				(MINDMAP_NODE_HEIGHT + MINDMAP_VERTICAL_GAP);

		const branchX =
			direction === "right"
				? root.x + root.width + MINDMAP_HORIZONTAL_GAP
				: root.x - MINDMAP_HORIZONTAL_GAP - MINDMAP_NODE_WIDTH;

		const branchNode = buildMindmapNode({
			id: branchId,
			x: branchX,
			y: branchY - MINDMAP_NODE_HEIGHT / 2,
			text: branch.title,
			treeId,
			parentId: root.id,
			direction,
			depth: 1,
			branchColor: color,
		});
		nodeCount.value += 1;
		elements.push(
			branchNode,
			buildMindmapEdge({
				treeId,
				source: root,
				target: branchNode,
				stroke: color,
			}),
		);

		if (branch.children?.length) {
			layoutBranchChildren({
				nodes: branch.children,
				parent: branchNode,
				direction,
				treeId,
				branchColor: color,
				depth: 2,
				centerY: (branchNode.y ?? 0) + branchNode.height / 2,
				elements,
				nodeCount,
			});
		}
	});

	return { elements, nodeCount: nodeCount.value };
}
