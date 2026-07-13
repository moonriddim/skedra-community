import {
	type CanvasElementFactoryDefaults,
	createBaseCanvasElement,
	createKanbanBoardElements,
	createStickyNoteElement,
} from "./element-factory";
import {
	FLOWCHART_DEFAULT_STROKE,
	createFlowchartConnector,
	createFlowchartNode,
} from "./flowchart";
import { createMindmapTemplateElements } from "./mindmap";
import { sortCanvasElements } from "./ordering";
import type { CanvasElement } from "./types";

export type CanvasTemplateId =
	| "kanban"
	| "mindmap"
	| "flowchart"
	| "retrospective"
	| "swot";

export type TemplateToolId = "retrospective" | "swot" | "flowchart";
export type TemplateNoteType =
	| "celebrate"
	| "friction"
	| "commitment"
	| "strength"
	| "weakness"
	| "opportunity"
	| "threat";

export const TEMPLATE_SECTION_TYPE = "template-section";
export const TEMPLATE_SECTION_PADDING_X = 18;
export const TEMPLATE_SECTION_PADDING_TOP = 92;
export const TEMPLATE_SECTION_PADDING_TOP_COMPACT = 58;
export const TEMPLATE_SECTION_GAP = 18;

export interface TemplateSectionMeta {
	skedraType: typeof TEMPLATE_SECTION_TYPE;
	templateTool: TemplateToolId;
	templateSectionId: string;
	templateAccent: string;
	templateBaseHeight: number;
	templatePrompt?: string;
	stickyColor?: string;
	stickyWidth?: number;
	stickyHeight?: number;
	templateLayoutId?: string;
	templateLayoutRole?: string;
}

export interface TemplateStickyNoteMeta {
	templateTool: TemplateToolId;
	templateSectionId: string;
	templateNoteType: TemplateNoteType;
	templateAccent: string;
	stickyColor: string;
	stickyWidth?: number;
	stickyHeight?: number;
}

export interface CanvasTemplateOptions {
	id: CanvasTemplateId;
	x: number;
	y: number;
	defaults: CanvasElementFactoryDefaults;
	text?: (key: string) => string;
	fontFamily?: string;
	flowchartStroke?: string;
	kanbanLists?: Array<{ name: string; cards: string[] }>;
	defaultKanbanCardTitle?: string;
	mindmapText?: string;
	mindmapBranches?: Array<{
		direction: "left" | "right";
		text: string;
		yOffset: number;
		color: string;
	}>;
	mindmapAppearance?: {
		fontFamily?: string;
		rootFill?: string;
		nodeFill?: string;
		rootStroke?: string;
		childBorder?: string;
		rootTextColor?: string;
		childTextColor?: string;
	};
}

const ENGLISH_TEMPLATE_TEXT: Record<string, string> = {
	"mindmap.root": "Mindmap",
	"mindmap.strategyTitle": "Strategy",
	"mindmap.operationsTitle": "Operations",
	"mindmap.productTitle": "Product",
	"mindmap.growthTitle": "Growth",
	"flowchart.kickoff": "Kickoff",
	"flowchart.scope": "Scope",
	"flowchart.review": "Review",
	"flowchart.reviewQa": "QA",
	"flowchart.release": "Release",
	"flowchart.openPoints": "Open points",
	"flowchart.yes": "Yes",
	"flowchart.no": "No",
	"retrospective.celebrateTitle": "Celebrate",
	"retrospective.frictionTitle": "Friction",
	"retrospective.commitmentTitle": "Commitments",
	"retrospective.experimentTitle": "Experiment",
	"retrospective.experimentBody": "What will we try next?",
	"retrospective.ownerTitle": "Owner",
	"retrospective.ownerBody": "Who owns it?",
	"retrospective.dateTitle": "Date",
	"retrospective.dateBody": "When is it due?",
	"retrospective.signalTitle": "Signal",
	"retrospective.signalBody": "How will we know it worked?",
	"swot.internalFactors": "Internal factors",
	"swot.externalSignals": "External signals",
	"swot.supportAxis": "Helpful",
	"swot.riskAxis": "Harmful",
	"swot.strengthsTitle": "Strengths",
	"swot.weaknessesTitle": "Weaknesses",
	"swot.opportunitiesTitle": "Opportunities",
	"swot.threatsTitle": "Threats",
};

const TEMPLATE_SECTION_DEFAULTS: Record<
	Exclude<TemplateToolId, "flowchart">,
	Record<
		string,
		{ noteType: TemplateNoteType; stickyColor: string; accent: string }
	>
> = {
	retrospective: {
		celebrate: {
			noteType: "celebrate",
			stickyColor: "#D3F9D8",
			accent: "#15803D",
		},
		friction: {
			noteType: "friction",
			stickyColor: "#FFD6E0",
			accent: "#DC2626",
		},
		commitment: {
			noteType: "commitment",
			stickyColor: "#D0EBFF",
			accent: "#2563EB",
		},
	},
	swot: {
		strengths: {
			noteType: "strength",
			stickyColor: "#D3F9D8",
			accent: "#15803D",
		},
		weaknesses: {
			noteType: "weakness",
			stickyColor: "#FFD6E0",
			accent: "#DC2626",
		},
		opportunities: {
			noteType: "opportunity",
			stickyColor: "#D0EBFF",
			accent: "#2563EB",
		},
		threats: {
			noteType: "threat",
			stickyColor: "#FFE0CC",
			accent: "#D97706",
		},
	},
};

export function createCanvasTemplateElements(
	options: CanvasTemplateOptions,
): CanvasElement[] {
	switch (options.id) {
		case "kanban":
			return createKanbanBoardElements(options.defaults, {
				x: options.x - 450,
				y: options.y - 200,
				lists: options.kanbanLists ?? [
					{ name: "To do", cards: ["Task 1", "Task 2"] },
					{ name: "In progress", cards: ["Task 3"] },
					{ name: "Done", cards: [] },
				],
				defaultCardTitle: options.defaultKanbanCardTitle ?? "New card",
			});
		case "mindmap":
			return createMindmapTemplate(options);
		case "flowchart":
			return createFlowchartTemplate(options);
		case "retrospective":
			return createRetrospectiveTemplate(options);
		case "swot":
			return createSwotTemplate(options);
	}
}

function resolveTemplateText(options: CanvasTemplateOptions, key: string) {
	return options.text?.(key) ?? ENGLISH_TEMPLATE_TEXT[key] ?? key;
}

function createMindmapTemplate(options: CanvasTemplateOptions) {
	return createMindmapTemplateElements({
		x: options.x,
		y: options.y,
		text: options.mindmapText ?? resolveTemplateText(options, "mindmap.root"),
		createId: options.defaults.createId,
		...(options.mindmapAppearance ?? {}),
		branches: options.mindmapBranches ?? [
			{
				direction: "left",
				yOffset: -120,
				color: "#2563EB",
				text: resolveTemplateText(options, "mindmap.strategyTitle"),
			},
			{
				direction: "left",
				yOffset: 108,
				color: "#D97706",
				text: resolveTemplateText(options, "mindmap.operationsTitle"),
			},
			{
				direction: "right",
				yOffset: -120,
				color: "#0F766E",
				text: resolveTemplateText(options, "mindmap.productTitle"),
			},
			{
				direction: "right",
				yOffset: 108,
				color: "#7C3AED",
				text: resolveTemplateText(options, "mindmap.growthTitle"),
			},
		],
	});
}

function createFlowchartTemplate(options: CanvasTemplateOptions) {
	const flowchartId = options.defaults.createId();
	const stroke = options.flowchartStroke ?? FLOWCHART_DEFAULT_STROKE;
	const node = (
		input: Omit<
			Parameters<typeof createFlowchartNode>[0],
			"id" | "flowchartId" | "fontFamily" | "stroke"
		>,
	) =>
		createFlowchartNode({
			id: options.defaults.createId(),
			flowchartId,
			fontFamily: options.fontFamily ?? options.defaults.fontFamily,
			stroke,
			...input,
		});
	const kickoff = node({
		x: options.x - 430,
		y: options.y - 20,
		width: 160,
		height: 56,
		type: "ellipse",
		text: resolveTemplateText(options, "flowchart.kickoff"),
		nodeKind: "start",
		fontSize: 18,
		fontWeight: "bold",
	});
	const scope = node({
		x: options.x - 180,
		y: options.y - 36,
		width: 220,
		height: 88,
		type: "rectangle",
		text: resolveTemplateText(options, "flowchart.scope"),
		nodeKind: "step",
		cornerRadius: 18,
		fontSize: 18,
		fontWeight: "bold",
	});
	const review = node({
		x: options.x + 130,
		y: options.y - 52,
		width: 180,
		height: 120,
		type: "diamond",
		text: resolveTemplateText(options, "flowchart.review"),
		nodeKind: "decision",
		fontSize: 19,
		fontWeight: "bold",
	});
	const qa = node({
		x: options.x + 400,
		y: options.y - 36,
		width: 220,
		height: 88,
		type: "rectangle",
		text: resolveTemplateText(options, "flowchart.reviewQa"),
		nodeKind: "step",
		cornerRadius: 18,
		fontSize: 18,
		fontWeight: "bold",
	});
	const release = node({
		x: options.x + 425,
		y: options.y + 100,
		width: 170,
		height: 56,
		type: "ellipse",
		text: resolveTemplateText(options, "flowchart.release"),
		nodeKind: "end",
		fontSize: 18,
		fontWeight: "bold",
	});
	const open = node({
		x: options.x + 120,
		y: options.y + 116,
		width: 200,
		height: 88,
		type: "rectangle",
		text: resolveTemplateText(options, "flowchart.openPoints"),
		nodeKind: "step",
		cornerRadius: 18,
		fontSize: 18,
		fontWeight: "bold",
	});
	const connector = (
		source: CanvasElement,
		target: CanvasElement,
		route: Parameters<typeof createFlowchartConnector>[0]["route"],
		extra: Partial<Parameters<typeof createFlowchartConnector>[0]> = {},
	) =>
		createFlowchartConnector({
			id: options.defaults.createId(),
			flowchartId,
			source,
			target,
			route,
			...extra,
		});
	return [
		connector(kickoff, scope, "right"),
		connector(scope, review, "right"),
		connector(review, qa, "right", {
			branchKind: "yes",
			text: resolveTemplateText(options, "flowchart.yes"),
			fontSize: 12,
		}),
		connector(qa, release, "down"),
		connector(review, open, "down", {
			branchKind: "no",
			text: resolveTemplateText(options, "flowchart.no"),
			fontSize: 12,
			arrowTextSide: "below",
		}),
		connector(open, scope, "left-up"),
		kickoff,
		scope,
		review,
		qa,
		release,
		open,
	];
}

export function createCanvasTemplateSectionFrame(options: {
	createId: () => string;
	x: number;
	y: number;
	width: number;
	height: number;
	label: string;
	text?: string;
	tool: TemplateToolId;
	sectionId: string;
	accent: string;
	prompt?: string;
	stickyColor?: string;
	stickyWidth?: number;
	stickyHeight?: number;
	layoutId?: string;
	layoutRole?: string;
}): CanvasElement {
	return createBaseCanvasElement(
		{ createId: options.createId, stroke: options.accent },
		{
			type: "frame",
			x: options.x,
			y: options.y,
			width: options.width,
			height: options.height,
			stroke: options.accent,
			strokeWidth: 1.5,
			frameLabel: options.label,
			text: options.text,
			customData: {
				skedraType: TEMPLATE_SECTION_TYPE,
				templateTool: options.tool,
				templateSectionId: options.sectionId,
				templateAccent: options.accent,
				templateBaseHeight: options.height,
				templatePrompt: options.prompt,
				stickyColor: options.stickyColor,
				stickyWidth: options.stickyWidth,
				stickyHeight: options.stickyHeight,
				templateLayoutId: options.layoutId,
				templateLayoutRole: options.layoutRole,
			},
		},
	);
}

interface TemplateBuilder {
	elements: CanvasElement[];
	add: (
		overrides: Partial<CanvasElement> & { type: CanvasElement["type"] },
	) => CanvasElement;
	addArrow: (
		points: [number, number][],
		overrides?: Partial<CanvasElement>,
	) => CanvasElement;
}

function createTemplateBuilder(
	options: CanvasTemplateOptions,
): TemplateBuilder {
	const elements: CanvasElement[] = [];
	const add = (
		overrides: Partial<CanvasElement> & { type: CanvasElement["type"] },
	) => {
		const element = createBaseCanvasElement(options.defaults, overrides);
		elements.push(element);
		return element;
	};
	const addArrow = (
		points: [number, number][],
		overrides: Partial<CanvasElement> = {},
	) => {
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
			stroke: "#94A3B8",
			arrowMode: points.length > 2 ? "elbow" : "straight",
			arrowHeadStart: "none",
			arrowHeadEnd: "none",
			points: points.map(([x, y]) => [x - minX, y - minY]),
			...overrides,
		});
	};
	return { elements, add, addArrow };
}

function addModule(
	builder: TemplateBuilder,
	options: CanvasTemplateOptions,
	input: {
		x: number;
		y: number;
		width: number;
		height: number;
		title: string;
		body: string;
		accent: string;
		customData: Record<string, unknown>;
	},
) {
	const groupId = options.defaults.createId();
	const boxY = input.y + 28;
	builder.add({
		type: "text",
		groupId,
		x: input.x,
		y: input.y,
		width: input.width,
		height: 22,
		text: input.title,
		stroke: input.accent,
		fontSize: 18,
		fontFamily: options.fontFamily ?? options.defaults.fontFamily,
		fontWeight: "bold",
		customData: input.customData,
	});
	builder.add({
		type: "rectangle",
		groupId,
		x: input.x,
		y: boxY,
		width: input.width,
		height: input.height,
		stroke: input.accent,
		cornerRadius: 18,
		customData: input.customData,
	});
	builder.add({
		type: "text",
		groupId,
		x: input.x + 16,
		y: boxY + 14,
		width: input.width - 32,
		height: input.height - 28,
		text: input.body,
		stroke: "#64748B",
		fontSize: 14,
		fontFamily: options.fontFamily ?? options.defaults.fontFamily,
		customData: input.customData,
	});
}

function createRetrospectiveTemplate(options: CanvasTemplateOptions) {
	const builder = createTemplateBuilder(options);
	const layoutId = options.defaults.createId();
	const topY = options.y - 170;
	const columnWidth = 316;
	const columnHeight = 420;
	const gap = 34;
	const startX = options.x - (columnWidth * 3 + gap * 2) / 2;
	const sections = [
		["celebrate", "#15803D", "#D3F9D8"],
		["friction", "#DC2626", "#FFD6E0"],
		["commitment", "#2563EB", "#D0EBFF"],
	] as const;
	sections.forEach(([role, accent, stickyColor], index) => {
		builder.elements.push(
			createCanvasTemplateSectionFrame({
				createId: options.defaults.createId,
				x: startX + index * (columnWidth + gap),
				y: topY,
				width: columnWidth,
				height: columnHeight,
				label: resolveTemplateText(options, `retrospective.${role}Title`),
				tool: "retrospective",
				sectionId: role,
				accent,
				stickyColor,
				stickyWidth: 126,
				stickyHeight: 110,
				layoutId,
				layoutRole: role,
			}),
		);
	});
	const boardWidth = columnWidth * 3 + gap * 2;
	const moduleGap = 24;
	const widths = [328, 168, 168, boardWidth - 328 - 168 - 168 - moduleGap * 3];
	const roles = ["experiment", "owner", "date", "signal"] as const;
	let moduleX = startX;
	for (let index = 0; index < roles.length; index++) {
		const role = roles[index];
		const width = widths[index];
		addModule(builder, options, {
			x: moduleX,
			y: topY + columnHeight + 46,
			width,
			height: 102,
			title: resolveTemplateText(options, `retrospective.${role}Title`),
			body: resolveTemplateText(options, `retrospective.${role}Body`),
			accent: role === "experiment" ? "#2563EB" : "#64748B",
			customData: {
				templateTool: "retrospective",
				templateLayoutId: layoutId,
				templateLayoutRole: role,
			},
		});
		moduleX += width + moduleGap;
	}
	return builder.elements;
}

function createSwotTemplate(options: CanvasTemplateOptions) {
	const builder = createTemplateBuilder(options);
	const layoutId = options.defaults.createId();
	const width = 380;
	const height = 340;
	const gap = 38;
	const leftX = options.x - width - gap / 2;
	const rightX = options.x + gap / 2;
	const topY = options.y - 130;
	const bottomY = topY + height + gap;
	const textLabel = (key: string, x: number, y: number, role: string) =>
		builder.add({
			type: "text",
			x,
			y,
			width: role.startsWith("label-") && x < leftX ? 120 : width,
			height: 18,
			text: resolveTemplateText(options, key),
			stroke: "#64748B",
			fontSize: 13,
			fontFamily: options.fontFamily ?? options.defaults.fontFamily,
			fontWeight: "bold",
			textAlign: x < leftX ? "left" : "center",
			customData: {
				templateTool: "swot",
				templateLayoutId: layoutId,
				templateLayoutRole: role,
			},
		});
	textLabel("swot.internalFactors", leftX, topY - 38, "label-internal");
	textLabel("swot.externalSignals", rightX, topY - 38, "label-external");
	textLabel(
		"swot.supportAxis",
		leftX - 138,
		topY + height / 2 - 12,
		"label-support",
	);
	textLabel(
		"swot.riskAxis",
		leftX - 138,
		bottomY + height / 2 - 12,
		"label-risk",
	);
	builder.addArrow(
		[
			[options.x, topY - 8],
			[options.x, bottomY + height + 8],
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
			[leftX - 8, topY + height + gap / 2],
			[rightX + width + 8, topY + height + gap / 2],
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
	const sections = [
		["strengths", leftX, topY, "#15803D", "#D3F9D8"],
		["weaknesses", rightX, topY, "#DC2626", "#FFD6E0"],
		["opportunities", leftX, bottomY, "#2563EB", "#D0EBFF"],
		["threats", rightX, bottomY, "#D97706", "#FFE0CC"],
	] as const;
	for (const [role, x, y, accent, stickyColor] of sections) {
		builder.elements.push(
			createCanvasTemplateSectionFrame({
				createId: options.defaults.createId,
				x,
				y,
				width,
				height,
				label: resolveTemplateText(options, `swot.${role}Title`),
				tool: "swot",
				sectionId: role,
				accent,
				stickyColor,
				stickyWidth: 160,
				stickyHeight: 124,
				layoutId,
				layoutRole: role,
			}),
		);
	}
	return builder.elements;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value != null;
}

export function getTemplateSectionDefaults(
	tool: TemplateToolId,
	sectionId: string,
) {
	if (tool === "flowchart") return null;
	return TEMPLATE_SECTION_DEFAULTS[tool][sectionId] ?? null;
}

export function getTemplateSectionMeta(
	element: CanvasElement | null | undefined,
): TemplateSectionMeta | null {
	if (
		!element ||
		element.type !== "frame" ||
		element.customData?.skedraType !== TEMPLATE_SECTION_TYPE ||
		!isRecord(element.customData)
	) {
		return null;
	}
	const data = element.customData;
	if (
		(data.templateTool !== "retrospective" &&
			data.templateTool !== "swot" &&
			data.templateTool !== "flowchart") ||
		typeof data.templateSectionId !== "string" ||
		typeof data.templateAccent !== "string" ||
		typeof data.templateBaseHeight !== "number"
	) {
		return null;
	}
	return {
		skedraType: TEMPLATE_SECTION_TYPE,
		templateTool: data.templateTool,
		templateSectionId: data.templateSectionId,
		templateAccent: data.templateAccent,
		templateBaseHeight: data.templateBaseHeight,
		templatePrompt:
			typeof data.templatePrompt === "string" ? data.templatePrompt : undefined,
		stickyColor:
			typeof data.stickyColor === "string" ? data.stickyColor : undefined,
		stickyWidth:
			typeof data.stickyWidth === "number" ? data.stickyWidth : undefined,
		stickyHeight:
			typeof data.stickyHeight === "number" ? data.stickyHeight : undefined,
		templateLayoutId:
			typeof data.templateLayoutId === "string"
				? data.templateLayoutId
				: undefined,
		templateLayoutRole:
			typeof data.templateLayoutRole === "string"
				? data.templateLayoutRole
				: undefined,
	};
}

export function getTemplateStickyNoteMeta(
	element: CanvasElement | null | undefined,
): TemplateStickyNoteMeta | null {
	if (
		!element ||
		element.customData?.skedraType !== "sticky-note" ||
		!isRecord(element.customData)
	) {
		return null;
	}
	const data = element.customData;
	if (
		(data.templateTool !== "retrospective" && data.templateTool !== "swot") ||
		typeof data.templateSectionId !== "string" ||
		typeof data.templateAccent !== "string" ||
		typeof data.stickyColor !== "string" ||
		(data.templateNoteType !== "celebrate" &&
			data.templateNoteType !== "friction" &&
			data.templateNoteType !== "commitment" &&
			data.templateNoteType !== "strength" &&
			data.templateNoteType !== "weakness" &&
			data.templateNoteType !== "opportunity" &&
			data.templateNoteType !== "threat")
	) {
		return null;
	}
	return {
		templateTool: data.templateTool,
		templateSectionId: data.templateSectionId,
		templateNoteType: data.templateNoteType,
		templateAccent: data.templateAccent,
		stickyColor: data.stickyColor,
		stickyWidth:
			typeof data.stickyWidth === "number" ? data.stickyWidth : undefined,
		stickyHeight:
			typeof data.stickyHeight === "number" ? data.stickyHeight : undefined,
	};
}

export function listSectionStickyNotes(
	sectionId: string,
	elements: Iterable<CanvasElement>,
): CanvasElement[] {
	return Array.from(elements)
		.filter(
			(element) =>
				getTemplateStickyNoteMeta(element) != null &&
				element.frameId === sectionId,
		)
		.sort((left, right) => left.y - right.y || left.x - right.x);
}

export function getTemplateStickyMetrics(
	section: CanvasElement,
	meta = getTemplateSectionMeta(section),
) {
	const noteWidth = meta?.stickyWidth ?? 200;
	const noteHeight = meta?.stickyHeight ?? 200;
	if (meta?.templateTool !== "retrospective") {
		return { noteWidth, noteHeight };
	}
	const usableWidth = Math.max(
		noteWidth,
		section.width - TEMPLATE_SECTION_PADDING_X * 2,
	);
	return {
		noteWidth: Math.max(
			112,
			Math.min(noteWidth, Math.floor((usableWidth - TEMPLATE_SECTION_GAP) / 2)),
		),
		noteHeight: Math.min(noteHeight, 110),
	};
}

export function createCanvasTemplateStickyNote(options: {
	defaults: CanvasElementFactoryDefaults;
	section: CanvasElement;
	existingElements: Iterable<CanvasElement>;
	color?: string;
	text?: string;
	customData?: Record<string, unknown>;
}): CanvasElement | null {
	const meta = getTemplateSectionMeta(options.section);
	if (!meta || meta.templateTool === "flowchart") return null;
	const sectionDefaults =
		TEMPLATE_SECTION_DEFAULTS[meta.templateTool][meta.templateSectionId];
	if (!sectionDefaults) return null;
	const { noteWidth, noteHeight } = getTemplateStickyMetrics(
		options.section,
		meta,
	);
	const notes = listSectionStickyNotes(
		options.section.id,
		options.existingElements,
	);
	const paddingTop = options.section.text
		? TEMPLATE_SECTION_PADDING_TOP
		: TEMPLATE_SECTION_PADDING_TOP_COMPACT;
	const usableWidth = Math.max(
		noteWidth,
		options.section.width - TEMPLATE_SECTION_PADDING_X * 2,
	);
	const columns = Math.max(
		1,
		Math.floor(
			(usableWidth + TEMPLATE_SECTION_GAP) / (noteWidth + TEMPLATE_SECTION_GAP),
		),
	);
	const column = notes.length % columns;
	const row = Math.floor(notes.length / columns);
	return createStickyNoteElement(options.defaults, {
		x:
			options.section.x +
			TEMPLATE_SECTION_PADDING_X +
			column * (noteWidth + TEMPLATE_SECTION_GAP),
		y:
			options.section.y +
			paddingTop +
			row * (noteHeight + TEMPLATE_SECTION_GAP),
		color: options.color ?? sectionDefaults.stickyColor,
		width: noteWidth,
		height: noteHeight,
		fontSize: noteHeight < 160 ? 18 : undefined,
		stroke: sectionDefaults.accent,
		text: options.text,
		frameId: options.section.id,
		customData: {
			templateTool: meta.templateTool,
			templateSectionId: meta.templateSectionId,
			templateNoteType: sectionDefaults.noteType,
			templateAccent: sectionDefaults.accent,
			stickyColor: sectionDefaults.stickyColor,
			stickyWidth: noteWidth,
			stickyHeight: noteHeight,
			...(options.customData ?? {}),
		},
	});
}

export function findTemplateSectionAtPoint(
	elements: Iterable<CanvasElement>,
	x: number,
	y: number,
): CanvasElement | null {
	const sections = sortCanvasElements(
		Array.from(elements).filter(
			(element) => getTemplateSectionMeta(element) != null,
		),
	).reverse();
	return (
		sections.find(
			(section) =>
				x >= section.x &&
				x <= section.x + section.width &&
				y >= section.y &&
				y <= section.y + section.height,
		) ?? null
	);
}

export function getTemplateStickyAssignmentChanges(
	note: CanvasElement,
	section: CanvasElement | null,
): Partial<CanvasElement> {
	if (!section) return { frameId: undefined };
	const meta = getTemplateSectionMeta(section);
	if (!meta || meta.templateTool === "flowchart") return {};
	const defaults =
		TEMPLATE_SECTION_DEFAULTS[meta.templateTool][meta.templateSectionId];
	if (!defaults) return {};
	return {
		frameId: section.id,
		fill: defaults.stickyColor,
		stroke: defaults.accent,
		customData: {
			...(note.customData ?? {}),
			skedraType: "sticky-note",
			templateTool: meta.templateTool,
			templateSectionId: meta.templateSectionId,
			templateNoteType: defaults.noteType,
			templateAccent: defaults.accent,
			stickyColor: defaults.stickyColor,
		},
	};
}

export function buildTemplateSectionLayoutSyncUpdates(
	elements: Map<string, CanvasElement>,
	options: { excludeIds?: Iterable<string> } = {},
) {
	const excluded = new Set(options.excludeIds ?? []);
	const nextElements = new Map(
		Array.from(elements).filter(([id]) => !excluded.has(id)),
	);
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];
	for (const section of nextElements.values()) {
		const meta = getTemplateSectionMeta(section);
		if (!meta) continue;
		const notes = listSectionStickyNotes(section.id, nextElements.values());
		const { noteWidth, noteHeight } = getTemplateStickyMetrics(section, meta);
		const usableWidth = Math.max(
			noteWidth,
			section.width - TEMPLATE_SECTION_PADDING_X * 2,
		);
		const columns = Math.max(
			1,
			Math.floor(
				(usableWidth + TEMPLATE_SECTION_GAP) /
					(noteWidth + TEMPLATE_SECTION_GAP),
			),
		);
		const paddingTop = section.text
			? TEMPLATE_SECTION_PADDING_TOP
			: TEMPLATE_SECTION_PADDING_TOP_COMPACT;
		let maxBottom = section.y + meta.templateBaseHeight;
		notes.forEach((note, index) => {
			const x =
				section.x +
				TEMPLATE_SECTION_PADDING_X +
				(index % columns) * (noteWidth + TEMPLATE_SECTION_GAP);
			const y =
				section.y +
				paddingTop +
				Math.floor(index / columns) * (noteHeight + TEMPLATE_SECTION_GAP);
			maxBottom = Math.max(maxBottom, y + noteHeight + TEMPLATE_SECTION_GAP);
			if (
				note.x !== x ||
				note.y !== y ||
				note.width !== noteWidth ||
				note.height !== noteHeight
			) {
				updates.push({
					id: note.id,
					changes: { x, y, width: noteWidth, height: noteHeight },
				});
			}
		});
		const height = Math.max(meta.templateBaseHeight, maxBottom - section.y);
		if (section.height !== height) {
			updates.push({ id: section.id, changes: { height } });
		}
	}
	applyTemplateUpdates(nextElements, updates);
	updates.push(
		...buildTemplateBoardLayoutUpdates(nextElements).filter((update) => {
			const current = nextElements.get(update.id);
			return (
				current != null &&
				Object.entries(update.changes).some(
					([key, value]) =>
						!templateLayoutValueEquals(
							current[key as keyof CanvasElement],
							value,
						),
				)
			);
		}),
	);
	return updates;
}

function templateLayoutValueEquals(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) && Array.isArray(right)) {
		return (
			left.length === right.length &&
			left.every((value, index) =>
				templateLayoutValueEquals(value, right[index]),
			)
		);
	}
	if (isRecord(left) && isRecord(right)) {
		const leftKeys = Object.keys(left);
		const rightKeys = Object.keys(right);
		return (
			leftKeys.length === rightKeys.length &&
			leftKeys.every(
				(key) =>
					Object.hasOwn(right, key) &&
					templateLayoutValueEquals(left[key], right[key]),
			)
		);
	}
	return false;
}

function applyTemplateUpdates(
	elements: Map<string, CanvasElement>,
	updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
) {
	for (const update of updates) {
		const current = elements.get(update.id);
		if (current) elements.set(update.id, { ...current, ...update.changes });
	}
}

function getTemplateLayoutMeta(element: CanvasElement) {
	if (!isRecord(element.customData)) return null;
	const { templateTool, templateLayoutId, templateLayoutRole } =
		element.customData;
	if (
		(templateTool !== "retrospective" && templateTool !== "swot") ||
		typeof templateLayoutId !== "string" ||
		typeof templateLayoutRole !== "string"
	) {
		return null;
	}
	return { templateTool, templateLayoutId, templateLayoutRole };
}

function buildTemplateBoardLayoutUpdates(elements: Map<string, CanvasElement>) {
	const groups = new Map<string, CanvasElement[]>();
	for (const element of elements.values()) {
		const meta = getTemplateLayoutMeta(element);
		if (!meta) continue;
		const key = `${meta.templateTool}:${meta.templateLayoutId}`;
		groups.set(key, [...(groups.get(key) ?? []), element]);
	}
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];
	for (const [key, group] of groups) {
		if (key.startsWith("retrospective:")) {
			updates.push(...buildRetrospectiveLayoutUpdates(group));
		} else if (key.startsWith("swot:")) {
			updates.push(...buildSwotLayoutUpdates(group, elements));
		}
	}
	return updates;
}

function templateRoleMap(elements: CanvasElement[]) {
	const roles = new Map<string, CanvasElement[]>();
	for (const element of elements) {
		const role = getTemplateLayoutMeta(element)?.templateLayoutRole;
		if (!role) continue;
		roles.set(role, [...(roles.get(role) ?? []), element]);
	}
	return roles;
}

function buildRetrospectiveLayoutUpdates(group: CanvasElement[]) {
	const roles = templateRoleMap(group);
	const sections = ["celebrate", "friction", "commitment"].map(
		(role) => roles.get(role)?.[0],
	);
	if (sections.some((section) => !section)) return [];
	const y =
		Math.max(
			...(sections as CanvasElement[]).map(
				(section) => section.y + section.height,
			),
		) + 54;
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];
	for (const role of ["experiment", "owner", "date", "signal"]) {
		const moduleElements = roles.get(role) ?? [];
		if (moduleElements.length === 0) continue;
		const currentTop = Math.min(...moduleElements.map((element) => element.y));
		const dy = y - currentTop;
		if (dy === 0) continue;
		for (const element of moduleElements) {
			updates.push({ id: element.id, changes: { y: element.y + dy } });
		}
	}
	return updates;
}

function moveTemplateSection(
	section: CanvasElement,
	x: number,
	y: number,
	elements: Map<string, CanvasElement>,
) {
	const dx = x - section.x;
	const dy = y - section.y;
	if (dx === 0 && dy === 0) return [];
	return [
		{ id: section.id, changes: { x, y } },
		...listSectionStickyNotes(section.id, elements.values()).map((note) => ({
			id: note.id,
			changes: { x: note.x + dx, y: note.y + dy },
		})),
	];
}

function buildTemplateArrowChanges(points: [number, number][]) {
	const minX = Math.min(...points.map(([x]) => x));
	const minY = Math.min(...points.map(([, y]) => y));
	const maxX = Math.max(...points.map(([x]) => x));
	const maxY = Math.max(...points.map(([, y]) => y));
	return {
		x: minX,
		y: minY,
		width: Math.max(1, maxX - minX),
		height: Math.max(1, maxY - minY),
		points: points.map(([x, y]) => [x - minX, y - minY] as [number, number]),
		arrowMode: "straight" as const,
		arrowHeadStart: "none" as const,
		arrowHeadEnd: "none" as const,
	};
}

function buildSwotLayoutUpdates(
	group: CanvasElement[],
	elements: Map<string, CanvasElement>,
) {
	const roles = templateRoleMap(group);
	const strengths = roles.get("strengths")?.[0];
	const weaknesses = roles.get("weaknesses")?.[0];
	const opportunities = roles.get("opportunities")?.[0];
	const threats = roles.get("threats")?.[0];
	if (!strengths || !weaknesses || !opportunities || !threats) return [];
	const gap = 38;
	const topY = Math.min(strengths.y, weaknesses.y);
	const bottomY =
		Math.max(strengths.y + strengths.height, weaknesses.y + weaknesses.height) +
		gap;
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [
		...moveTemplateSection(opportunities, opportunities.x, bottomY, elements),
		...moveTemplateSection(threats, threats.x, bottomY, elements),
	];
	const centerX = (strengths.x + strengths.width + weaknesses.x) / 2;
	const centerY = bottomY - gap / 2;
	const setPosition = (role: string, changes: Partial<CanvasElement>) => {
		const element = roles.get(role)?.[0];
		if (element) updates.push({ id: element.id, changes });
	};
	setPosition("label-internal", {
		x: strengths.x,
		y: topY - 38,
		width: strengths.width,
	});
	setPosition("label-external", {
		x: weaknesses.x,
		y: topY - 38,
		width: weaknesses.width,
	});
	setPosition("label-support", {
		x: strengths.x - 138,
		y: topY + strengths.height / 2 - 12,
	});
	setPosition("label-risk", {
		x: opportunities.x - 138,
		y: bottomY + opportunities.height / 2 - 12,
	});
	setPosition(
		"axis-horizontal",
		buildTemplateArrowChanges([
			[strengths.x - 8, centerY],
			[weaknesses.x + weaknesses.width + 8, centerY],
		]),
	);
	setPosition(
		"axis-vertical",
		buildTemplateArrowChanges([
			[centerX, topY - 8],
			[
				centerX,
				Math.max(bottomY + opportunities.height, bottomY + threats.height) + 8,
			],
		]),
	);
	return updates;
}
