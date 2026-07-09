import {
	type CanvasThemeState,
	getDefaultMindmapRootFill,
	getDefaultMindmapRootStroke,
} from "@/lib/canvas/canvas-defaults";
import { getMindmapNodeThemeOptions } from "@/lib/canvas/canvas-factory-defaults";
import {
	type CanvasElement,
	type CreateMindmapEdgeOptions,
	type CreateMindmapNodeOptions,
	MINDMAP_HORIZONTAL_GAP,
	MINDMAP_NODE_WIDTH,
	MINDMAP_ROOT_WIDTH,
	type MindmapDirection,
	createMindmapEdge,
	createMindmapNode,
} from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import { templateText } from "./shared";

type TemplateMindmapNodeOptions = Omit<CreateMindmapNodeOptions, "id">;
type TemplateMindmapEdgeOptions = Omit<CreateMindmapEdgeOptions, "id">;

function createTemplateMindmapNode(
	options: TemplateMindmapNodeOptions,
	theme?: CanvasThemeState,
): CanvasElement {
	return createMindmapNode({
		id: nanoid(),
		...getMindmapNodeThemeOptions(theme),
		...options,
	});
}

function createTemplateMindmapEdge(
	options: TemplateMindmapEdgeOptions,
): CanvasElement {
	return createMindmapEdge({
		id: nanoid(),
		...options,
	});
}

interface MindmapBranch {
	direction: MindmapDirection;
	yOffset: number;
	color: string;
	title: string;
}

export function createMindmapTemplate(
	cx: number,
	cy: number,
	theme?: CanvasThemeState,
): CanvasElement[] {
	const treeId = nanoid();
	const root = createTemplateMindmapNode(
		{
			x: cx - MINDMAP_ROOT_WIDTH / 2,
			y: cy - 32,
			text: templateText("mindmap.root"),
			treeId: treeId,
			parentId: null,
			direction: "right",
			depth: 0,
			stroke: getDefaultMindmapRootStroke(theme),
			fill: getDefaultMindmapRootFill(theme),
		},
		theme,
	);
	const nodes: CanvasElement[] = [root];
	const edges: CanvasElement[] = [];

	const branches: MindmapBranch[] = [
		{
			direction: "left",
			yOffset: -120,
			color: "#2563EB",
			title: templateText("mindmap.strategyTitle"),
		},
		{
			direction: "left",
			yOffset: 108,
			color: "#D97706",
			title: templateText("mindmap.operationsTitle"),
		},
		{
			direction: "right",
			yOffset: -120,
			color: "#0F766E",
			title: templateText("mindmap.productTitle"),
		},
		{
			direction: "right",
			yOffset: 108,
			color: "#7C3AED",
			title: templateText("mindmap.growthTitle"),
		},
	];

	for (const branch of branches) {
		const branchX =
			branch.direction === "right"
				? root.x + root.width + MINDMAP_HORIZONTAL_GAP
				: root.x - MINDMAP_HORIZONTAL_GAP - MINDMAP_NODE_WIDTH;
		const branchNode = createTemplateMindmapNode(
			{
				x: branchX,
				y: cy + branch.yOffset,
				text: branch.title,
				treeId: treeId,
				parentId: root.id,
				direction: branch.direction,
				depth: 1,
				stroke: branch.color,
			},
			theme,
		);
		nodes.push(branchNode);
		edges.push(
			createTemplateMindmapEdge({
				treeId,
				source: root,
				target: branchNode,
				stroke: branch.color,
			}),
		);
	}

	return [...edges, ...nodes];
}
