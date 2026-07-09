import { createTemplateSectionFrame } from "@/lib/canvas/template-tool-utils";
import type { CanvasElement } from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import { addModule, createTemplateBuilder, templateText } from "./shared";

export function createRetrospectiveTemplate(
	cx: number,
	cy: number,
): CanvasElement[] {
	const builder = createTemplateBuilder();
	const layoutId = nanoid();
	const topY = cy - 170;
	const columnWidth = 316;
	const columnHeight = 420;
	const gap = 34;
	const boardWidth = columnWidth * 3 + gap * 2;
	const moduleGap = 24;
	const experimentWidth = 328;
	const ownerWidth = 168;
	const dateWidth = 168;
	const signalWidth =
		boardWidth - experimentWidth - ownerWidth - dateWidth - moduleGap * 3;
	const outcomeY = topY + columnHeight + 46;
	const startX = cx - (columnWidth * 3 + gap * 2) / 2;

	builder.add({
		...createTemplateSectionFrame({
			x: startX,
			y: topY,
			width: columnWidth,
			height: columnHeight,
			label: templateText("retrospective.celebrateTitle"),
			tool: "retrospective",
			sectionId: "celebrate",
			accent: "#15803D",
			stickyColor: "#D3F9D8",
			stickyWidth: 126,
			stickyHeight: 110,
			layoutId,
			layoutRole: "celebrate",
		}),
	});

	builder.add({
		...createTemplateSectionFrame({
			x: startX + columnWidth + gap,
			y: topY,
			width: columnWidth,
			height: columnHeight,
			label: templateText("retrospective.frictionTitle"),
			tool: "retrospective",
			sectionId: "friction",
			accent: "#DC2626",
			stickyColor: "#FFD6E0",
			stickyWidth: 126,
			stickyHeight: 110,
			layoutId,
			layoutRole: "friction",
		}),
	});

	builder.add({
		...createTemplateSectionFrame({
			x: startX + (columnWidth + gap) * 2,
			y: topY,
			width: columnWidth,
			height: columnHeight,
			label: templateText("retrospective.commitmentTitle"),
			tool: "retrospective",
			sectionId: "commitment",
			accent: "#2563EB",
			stickyColor: "#D0EBFF",
			stickyWidth: 126,
			stickyHeight: 110,
			layoutId,
			layoutRole: "commitment",
		}),
	});

	const experimentX = startX;
	const ownerX = experimentX + experimentWidth + moduleGap;
	const dateX = ownerX + ownerWidth + moduleGap;
	const signalX = dateX + dateWidth + moduleGap;

	addModule(builder, {
		x: experimentX,
		y: outcomeY,
		width: experimentWidth,
		height: 102,
		title: templateText("retrospective.experimentTitle"),
		body: templateText("retrospective.experimentBody"),
		accent: "#2563EB",
		customData: {
			templateTool: "retrospective",
			templateLayoutId: layoutId,
			templateLayoutRole: "experiment",
		},
	});

	addModule(builder, {
		x: ownerX,
		y: outcomeY,
		width: ownerWidth,
		height: 102,
		title: templateText("retrospective.ownerTitle"),
		body: templateText("retrospective.ownerBody"),
		accent: "#64748B",
		customData: {
			templateTool: "retrospective",
			templateLayoutId: layoutId,
			templateLayoutRole: "owner",
		},
	});

	addModule(builder, {
		x: dateX,
		y: outcomeY,
		width: dateWidth,
		height: 102,
		title: templateText("retrospective.dateTitle"),
		body: templateText("retrospective.dateBody"),
		accent: "#64748B",
		customData: {
			templateTool: "retrospective",
			templateLayoutId: layoutId,
			templateLayoutRole: "date",
		},
	});

	addModule(builder, {
		x: signalX,
		y: outcomeY,
		width: signalWidth,
		height: 102,
		title: templateText("retrospective.signalTitle"),
		body: templateText("retrospective.signalBody"),
		accent: "#64748B",
		customData: {
			templateTool: "retrospective",
			templateLayoutId: layoutId,
			templateLayoutRole: "signal",
		},
	});

	return builder.elements;
}
