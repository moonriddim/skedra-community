import { TOOL_FONT_FAMILY } from "@/lib/canvas/canvas-defaults";
import { translate } from "@/lib/i18n";
import { getCurrentLocale } from "@/stores/locale";
import type { CanvasElement } from "@skedra/canvas-core";
import { nanoid } from "nanoid";

type ElementInput = Partial<CanvasElement> & { type: CanvasElement["type"] };

export const TEMPLATE_FONTS = {
	display: TOOL_FONT_FAMILY,
	body: TOOL_FONT_FAMILY,
};

export interface TemplateBuilder {
	elements: CanvasElement[];
	add: (overrides: ElementInput) => CanvasElement;
	addArrow: (
		points: [number, number][],
		overrides?: Partial<CanvasElement>,
	) => CanvasElement;
}

export interface ModuleGeometry {
	groupId: string;
	boxX: number;
	boxY: number;
	boxWidth: number;
	boxHeight: number;
}

export function templateText(key: string) {
	return translate(getCurrentLocale(), `templateContent.${key}`);
}

export function createTemplateBuilder(): TemplateBuilder {
	const elements: CanvasElement[] = [];

	const add = (overrides: ElementInput): CanvasElement => {
		const element: CanvasElement = {
			id: nanoid(),
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			rotation: 0,
			fill: "transparent",
			stroke: "#1e1e1e",
			strokeWidth: 2,
			strokeStyle: "solid",
			opacity: 100,
			locked: false,
			groupId: null,
			flipX: false,
			flipY: false,
			...overrides,
		};

		elements.push(element);
		return element;
	};

	const addArrow = (
		points: [number, number][],
		overrides: Partial<CanvasElement> = {},
	): CanvasElement => {
		const minX = Math.min(...points.map(([x]) => x));
		const maxX = Math.max(...points.map(([x]) => x));
		const minY = Math.min(...points.map(([, y]) => y));
		const maxY = Math.max(...points.map(([, y]) => y));

		return add({
			type: "arrow",
			x: minX,
			y: minY,
			width: Math.max(1, maxX - minX),
			height: Math.max(1, maxY - minY),
			fill: "transparent",
			stroke: "#94A3B8",
			strokeWidth: 2,
			strokeStyle: "solid",
			arrowMode: points.length > 2 ? "elbow" : "straight",
			arrowHeadStart: "none",
			arrowHeadEnd: "none",
			points: points.map(([x, y]) => [x - minX, y - minY] as [number, number]),
			...overrides,
		});
	};

	return { elements, add, addArrow };
}

function addHeading(
	builder: TemplateBuilder,
	options: {
		x: number;
		y: number;
		width: number;
		title: string;
		subtitle?: string;
	},
) {
	const { x, y, width, title, subtitle } = options;

	builder.add({
		type: "text",
		x,
		y,
		width,
		height: 34,
		text: title,
		stroke: "#0F172A",
		strokeWidth: 1,
		fontSize: 28,
		fontFamily: TEMPLATE_FONTS.display,
		fontWeight: "bold",
	});

	if (!subtitle) return;

	builder.add({
		type: "text",
		x,
		y: y + 38,
		width,
		height: 38,
		text: subtitle,
		stroke: "#475569",
		strokeWidth: 1,
		fontSize: 14,
		fontFamily: TEMPLATE_FONTS.body,
	});
}

export function addModule(
	builder: TemplateBuilder,
	options: {
		x: number;
		y: number;
		width: number;
		height: number;
		title: string;
		body: string;
		accent: string;
		border?: string;
		dashed?: boolean;
		titleSize?: number;
		bodySize?: number;
		bodyAlign?: "left" | "center" | "right";
		customData?: Record<string, unknown>;
	},
): ModuleGeometry {
	const {
		x,
		y,
		width,
		height,
		title,
		body,
		accent,
		border = accent,
		dashed = false,
		titleSize = 18,
		bodySize = 14,
		bodyAlign = "left",
		customData,
	} = options;

	const groupId = nanoid();
	const boxY = y + 28;

	builder.add({
		type: "text",
		groupId,
		x,
		y,
		width,
		height: 22,
		text: title,
		stroke: accent,
		strokeWidth: 1,
		fontSize: titleSize,
		fontFamily: TEMPLATE_FONTS.display,
		fontWeight: "bold",
		customData,
	});

	builder.add({
		type: "rectangle",
		groupId,
		x,
		y: boxY,
		width,
		height,
		fill: "transparent",
		stroke: border,
		strokeWidth: 2,
		strokeStyle: dashed ? "dashed" : "solid",
		cornerRadius: 18,
		customData,
	});

	builder.add({
		type: "text",
		groupId,
		x: x + 16,
		y: boxY + 14,
		width: width - 32,
		height: height - 28,
		text: body,
		stroke: "#64748B",
		strokeWidth: 1,
		fontSize: bodySize,
		fontFamily: TEMPLATE_FONTS.body,
		textAlign: bodyAlign,
		customData,
	});

	return {
		groupId,
		boxX: x,
		boxY,
		boxWidth: width,
		boxHeight: height,
	};
}
