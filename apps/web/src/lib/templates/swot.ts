import { createTemplateSectionFrame } from "@/lib/canvas/template-tool-utils";
import type { CanvasElement } from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import { TEMPLATE_FONTS, createTemplateBuilder, templateText } from "./shared";

export function createSwotTemplate(cx: number, cy: number): CanvasElement[] {
	const builder = createTemplateBuilder();
	const layoutId = nanoid();
	const sectionWidth = 380;
	const sectionHeight = 340;
	const sectionGap = 38;
	const leftX = cx - sectionWidth - sectionGap / 2;
	const rightX = cx + sectionGap / 2;
	const topY = cy - 130;
	const bottomY = topY + sectionHeight + sectionGap;
	const axisCenterX = cx;
	const axisCenterY = topY + sectionHeight + sectionGap / 2;

	builder.add({
		type: "text",
		x: leftX,
		y: topY - 38,
		width: sectionWidth,
		height: 18,
		text: templateText("swot.internalFactors"),
		stroke: "#64748B",
		strokeWidth: 1,
		fontSize: 13,
		fontFamily: TEMPLATE_FONTS.body,
		fontWeight: "bold",
		textAlign: "center",
		customData: {
			templateTool: "swot",
			templateLayoutId: layoutId,
			templateLayoutRole: "label-internal",
		},
	});

	builder.add({
		type: "text",
		x: rightX,
		y: topY - 38,
		width: sectionWidth,
		height: 18,
		text: templateText("swot.externalSignals"),
		stroke: "#64748B",
		strokeWidth: 1,
		fontSize: 13,
		fontFamily: TEMPLATE_FONTS.body,
		fontWeight: "bold",
		textAlign: "center",
		customData: {
			templateTool: "swot",
			templateLayoutId: layoutId,
			templateLayoutRole: "label-external",
		},
	});

	builder.add({
		type: "text",
		x: leftX - 138,
		y: topY + sectionHeight / 2 - 12,
		width: 120,
		height: 18,
		text: templateText("swot.supportAxis"),
		stroke: "#64748B",
		strokeWidth: 1,
		fontSize: 13,
		fontFamily: TEMPLATE_FONTS.body,
		fontWeight: "bold",
		customData: {
			templateTool: "swot",
			templateLayoutId: layoutId,
			templateLayoutRole: "label-support",
		},
	});

	builder.add({
		type: "text",
		x: leftX - 138,
		y: bottomY + sectionHeight / 2 - 12,
		width: 120,
		height: 18,
		text: templateText("swot.riskAxis"),
		stroke: "#64748B",
		strokeWidth: 1,
		fontSize: 13,
		fontFamily: TEMPLATE_FONTS.body,
		fontWeight: "bold",
		customData: {
			templateTool: "swot",
			templateLayoutId: layoutId,
			templateLayoutRole: "label-risk",
		},
	});

	builder.addArrow(
		[
			[axisCenterX, topY - 8],
			[axisCenterX, bottomY + sectionHeight + 8],
		],
		{
			stroke: "#CBD5E1",
			strokeWidth: 1.5,
			customData: {
				templateTool: "swot",
				templateLayoutId: layoutId,
				templateLayoutRole: "axis-vertical",
			},
		},
	);
	builder.addArrow(
		[
			[leftX - 8, axisCenterY],
			[rightX + sectionWidth + 8, axisCenterY],
		],
		{
			stroke: "#CBD5E1",
			strokeWidth: 1.5,
			customData: {
				templateTool: "swot",
				templateLayoutId: layoutId,
				templateLayoutRole: "axis-horizontal",
			},
		},
	);

	builder.add(
		createTemplateSectionFrame({
			x: leftX,
			y: topY,
			width: sectionWidth,
			height: sectionHeight,
			label: templateText("swot.strengthsTitle"),
			tool: "swot",
			sectionId: "strengths",
			accent: "#15803D",
			stickyColor: "#D3F9D8",
			stickyWidth: 160,
			stickyHeight: 124,
			layoutId,
			layoutRole: "strengths",
		}),
	);

	builder.add(
		createTemplateSectionFrame({
			x: rightX,
			y: topY,
			width: sectionWidth,
			height: sectionHeight,
			label: templateText("swot.weaknessesTitle"),
			tool: "swot",
			sectionId: "weaknesses",
			accent: "#DC2626",
			stickyColor: "#FFD6E0",
			stickyWidth: 160,
			stickyHeight: 124,
			layoutId,
			layoutRole: "weaknesses",
		}),
	);

	builder.add(
		createTemplateSectionFrame({
			x: leftX,
			y: bottomY,
			width: sectionWidth,
			height: sectionHeight,
			label: templateText("swot.opportunitiesTitle"),
			tool: "swot",
			sectionId: "opportunities",
			accent: "#2563EB",
			stickyColor: "#D0EBFF",
			stickyWidth: 160,
			stickyHeight: 124,
			layoutId,
			layoutRole: "opportunities",
		}),
	);

	builder.add(
		createTemplateSectionFrame({
			x: rightX,
			y: bottomY,
			width: sectionWidth,
			height: sectionHeight,
			label: templateText("swot.threatsTitle"),
			tool: "swot",
			sectionId: "threats",
			accent: "#D97706",
			stickyColor: "#FFE0CC",
			stickyWidth: 160,
			stickyHeight: 124,
			layoutId,
			layoutRole: "threats",
		}),
	);

	return builder.elements;
}
