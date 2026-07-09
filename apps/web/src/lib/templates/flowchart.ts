import {
	type CanvasThemeState,
	TOOL_FONT_FAMILY,
} from "@/lib/canvas/canvas-defaults";
import { getFlowchartThemeStroke } from "@/lib/canvas/canvas-factory-defaults";
import {
	type CanvasElement,
	type CreateFlowchartConnectorOptions,
	type CreateFlowchartNodeOptions,
	createFlowchartConnector,
	createFlowchartNode,
} from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import { templateText } from "./shared";

type TemplateFlowchartNodeOptions = Omit<
	CreateFlowchartNodeOptions,
	"id" | "fontFamily"
>;

type TemplateFlowchartConnectorOptions = Omit<
	CreateFlowchartConnectorOptions,
	"id"
>;

function createTemplateFlowchartNode(
	options: TemplateFlowchartNodeOptions,
): CanvasElement {
	return createFlowchartNode({
		id: nanoid(),
		fontFamily: TOOL_FONT_FAMILY,
		...options,
	});
}

function createTemplateFlowchartConnector(
	options: TemplateFlowchartConnectorOptions,
): CanvasElement {
	return createFlowchartConnector({
		id: nanoid(),
		...options,
	});
}

export function createFlowchartTemplate(
	cx: number,
	cy: number,
	strokeOrOptions?: string | { stroke?: string; theme?: CanvasThemeState },
): CanvasElement[] {
	const stroke =
		typeof strokeOrOptions === "string"
			? strokeOrOptions
			: (strokeOrOptions?.stroke ??
				getFlowchartThemeStroke(strokeOrOptions?.theme));
	const flowchartId = nanoid();

	const kickoff = createTemplateFlowchartNode({
		x: cx - 430,
		y: cy - 20,
		width: 160,
		height: 56,
		type: "ellipse",
		fill: "transparent",
		stroke,
		text: templateText("flowchart.kickoff"),
		flowchartId,
		nodeKind: "start",
		fontSize: 18,
		fontWeight: "bold",
	});

	const scope = createTemplateFlowchartNode({
		x: cx - 180,
		y: cy - 36,
		width: 220,
		height: 88,
		type: "rectangle",
		fill: "transparent",
		stroke,
		cornerRadius: 18,
		text: templateText("flowchart.scope"),
		flowchartId,
		nodeKind: "step",
		fontSize: 18,
		fontWeight: "bold",
	});

	const review = createTemplateFlowchartNode({
		x: cx + 130,
		y: cy - 52,
		width: 180,
		height: 120,
		type: "diamond",
		fill: "transparent",
		stroke,
		text: templateText("flowchart.review"),
		flowchartId,
		nodeKind: "decision",
		fontSize: 19,
		fontWeight: "bold",
	});

	const reviewQa = createTemplateFlowchartNode({
		x: cx + 400,
		y: cy - 36,
		width: 220,
		height: 88,
		type: "rectangle",
		fill: "transparent",
		stroke,
		cornerRadius: 18,
		text: templateText("flowchart.reviewQa"),
		flowchartId,
		nodeKind: "step",
		fontSize: 18,
		fontWeight: "bold",
	});

	const release = createTemplateFlowchartNode({
		x: cx + 425,
		y: cy + 100,
		width: 170,
		height: 56,
		type: "ellipse",
		fill: "transparent",
		stroke,
		text: templateText("flowchart.release"),
		flowchartId,
		nodeKind: "end",
		fontSize: 18,
		fontWeight: "bold",
	});

	const openPoints = createTemplateFlowchartNode({
		x: cx + 120,
		y: cy + 116,
		width: 200,
		height: 88,
		type: "rectangle",
		fill: "transparent",
		stroke,
		cornerRadius: 18,
		text: templateText("flowchart.openPoints"),
		flowchartId,
		nodeKind: "step",
		fontSize: 18,
		fontWeight: "bold",
	});

	const connectors = [
		createTemplateFlowchartConnector({
			flowchartId,
			source: kickoff,
			target: scope,
			route: "right",
		}),
		createTemplateFlowchartConnector({
			flowchartId,
			source: scope,
			target: review,
			route: "right",
		}),
		createTemplateFlowchartConnector({
			flowchartId,
			source: review,
			target: reviewQa,
			route: "right",
			branchKind: "yes",
			text: templateText("flowchart.yes"),
			fontSize: 12,
		}),
		createTemplateFlowchartConnector({
			flowchartId,
			source: reviewQa,
			target: release,
			route: "down",
		}),
		createTemplateFlowchartConnector({
			flowchartId,
			source: review,
			target: openPoints,
			route: "down",
			branchKind: "no",
			text: templateText("flowchart.no"),
			fontSize: 12,
			arrowTextSide: "below",
		}),
		createTemplateFlowchartConnector({
			flowchartId,
			source: openPoints,
			target: scope,
			route: "left-up",
		}),
	];

	return [...connectors, kickoff, scope, review, reviewQa, release, openPoints];
}
