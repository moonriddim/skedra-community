import {
	FLOWCHART_DEFAULT_STROKE,
	MINDMAP_HORIZONTAL_GAP,
	MINDMAP_NODE_WIDTH,
	MINDMAP_ROOT_WIDTH,
	type MindmapDirection,
	createBaseCanvasElement,
	createFlowchartConnector,
	createFlowchartNode,
	createKanbanBoardElements,
	createKanbanCardElement,
	createMindmapEdge,
	createMindmapNode,
	createStackIndexAfter,
	createStickyNoteElement,
} from "@skedra/canvas-core";
import type { CanvasElement } from "./types.js";

export type SkedraSdkTemplateId =
	| "kanban"
	| "mindmap"
	| "flowchart"
	| "retrospective"
	| "swot";

export type SkedraSdkResolvedTheme = "light" | "dark";

export interface SkedraSdkThemeState {
	resolvedTheme: SkedraSdkResolvedTheme;
}

export interface SkedraElementFactoryDefaults {
	createId: () => string;
	stroke: string;
	fontFamily?: string;
	kanbanFontFamily?: string;
}

export interface SkedraTemplateDefinition {
	id: SkedraSdkTemplateId;
	name: string;
	description: string;
	create: (
		x: number,
		y: number,
		options?: SkedraFactoryOptions,
	) => CanvasElement[];
}

export interface SkedraFactoryOptions {
	theme?: SkedraSdkResolvedTheme | SkedraSdkThemeState;
	createId?: () => string;
	stroke?: string;
}

export interface CreateSkedraStickyNoteOptions extends SkedraFactoryOptions {
	x: number;
	y: number;
	text?: string;
	color?: string;
	stroke?: string;
	width?: number;
	height?: number;
	frameId?: string;
	customData?: Record<string, unknown>;
}

export interface CreateSkedraFrameOptions extends SkedraFactoryOptions {
	x: number;
	y: number;
	width?: number;
	height?: number;
	label?: string;
	text?: string;
	customData?: Record<string, unknown>;
}

export interface CreateSkedraKanbanBoardOptions extends SkedraFactoryOptions {
	x: number;
	y: number;
	lists?: Array<{ name: string; cards: string[] }>;
	defaultCardTitle?: string;
}

export interface CreateSkedraKanbanCardOptions extends SkedraFactoryOptions {
	x: number;
	y: number;
	title?: string;
	listId?: string;
}

export interface CreateSkedraMindmapOptions extends SkedraFactoryOptions {
	x: number;
	y: number;
	text?: string;
	branches?: Array<{
		direction: "left" | "right";
		text: string;
		yOffset: number;
		color: string;
	}>;
}

export interface CreateSkedraTemplateSectionFrameOptions {
	x: number;
	y: number;
	width: number;
	height: number;
	label: string;
	text?: string;
	tool: "retrospective" | "swot" | "flowchart";
	sectionId: string;
	accent: string;
	stickyColor?: string;
	stickyWidth?: number;
	stickyHeight?: number;
	layoutId?: string;
	layoutRole?: string;
	createId?: () => string;
}

export interface CreateSkedraTemplateElementsOptions
	extends SkedraFactoryOptions {
	x: number;
	y: number;
}

const TOOL_FONT_FAMILY =
	'"Kalam", "Architects Daughter", "Segoe Print", cursive';
const KANBAN_FONT_FAMILY = "system-ui, sans-serif";
const LIGHT_STROKE = "#1e1e1e";
const DARK_STROKE = "#f1f3f5";
const LIGHT_NODE_FILL = "#ffffff";
const DARK_NODE_FILL = "#151d19";
const LIGHT_MINDMAP_ROOT_FILL = "#f8fafc";
const DARK_MINDMAP_ROOT_FILL = "#1d2823";
const LIGHT_MINDMAP_ROOT_STROKE = "#0f172a";
const DARK_MINDMAP_ROOT_STROKE = "#e6efe8";
const LIGHT_MINDMAP_CHILD_BORDER = "#cbd5e1";
const DARK_MINDMAP_CHILD_BORDER = "#3a454e";
const LIGHT_MINDMAP_CHILD_TEXT = "#334155";
const DARK_MINDMAP_CHILD_TEXT = "#cbd5e1";

function resolvedTheme(
	theme: SkedraFactoryOptions["theme"] = "light",
): SkedraSdkResolvedTheme {
	return typeof theme === "string" ? theme : (theme?.resolvedTheme ?? "light");
}

function isDarkTheme(theme: SkedraFactoryOptions["theme"]) {
	return resolvedTheme(theme) === "dark";
}

export function createSkedraElementId() {
	const cryptoRef = globalThis.crypto;
	if (cryptoRef && "randomUUID" in cryptoRef) {
		return cryptoRef.randomUUID();
	}
	return `skedra-${Date.now().toString(36)}-${Math.random()
		.toString(36)
		.slice(2)}`;
}

export function getSkedraElementFactoryDefaults(
	options: SkedraFactoryOptions = {},
): SkedraElementFactoryDefaults {
	return {
		createId: options.createId ?? createSkedraElementId,
		stroke:
			options.stroke ??
			(isDarkTheme(options.theme) ? DARK_STROKE : LIGHT_STROKE),
		fontFamily: TOOL_FONT_FAMILY,
		kanbanFontFamily: KANBAN_FONT_FAMILY,
	};
}

export function withSkedraStackIndexes(
	elements: CanvasElement[],
	existingElements: Iterable<CanvasElement> = [],
): CanvasElement[] {
	const stackBase = Array.from(existingElements);
	return elements.map((element) => {
		const next = element.stackIndex
			? element
			: {
					...element,
					stackIndex: createStackIndexAfter(stackBase, element.id),
				};
		stackBase.push(next);
		return next;
	});
}

export function createSkedraStickyNoteElement(
	options: CreateSkedraStickyNoteOptions,
): CanvasElement {
	return createStickyNoteElement(getSkedraElementFactoryDefaults(options), {
		x: options.x,
		y: options.y,
		color: options.color ?? "#fff3bf",
		text: options.text ?? "",
		width: options.width,
		height: options.height,
		frameId: options.frameId,
		stroke: options.stroke,
		customData: options.customData,
	});
}

export function createSkedraFrameElement(
	options: CreateSkedraFrameOptions,
): CanvasElement {
	return createBaseCanvasElement(getSkedraElementFactoryDefaults(options), {
		type: "frame",
		x: options.x,
		y: options.y,
		width: options.width ?? 420,
		height: options.height ?? 280,
		fill: "transparent",
		stroke: options.stroke ?? "#0f766e",
		strokeWidth: 1.5,
		strokeStyle: "dashed",
		frameLabel: options.label ?? "Frame",
		text: options.text,
		customData: options.customData,
	});
}

export function createSkedraKanbanBoardElements(
	options: CreateSkedraKanbanBoardOptions,
): CanvasElement[] {
	return createKanbanBoardElements(getSkedraElementFactoryDefaults(options), {
		x: options.x,
		y: options.y,
		lists: options.lists ?? [
			{ name: "To do", cards: ["Task 1", "Task 2"] },
			{ name: "In progress", cards: ["Task 3"] },
			{ name: "Done", cards: [] },
		],
		defaultCardTitle: options.defaultCardTitle ?? "New card",
	});
}

export function createSkedraKanbanCardElement(
	options: CreateSkedraKanbanCardOptions,
): CanvasElement {
	return createKanbanCardElement(getSkedraElementFactoryDefaults(options), {
		x: options.x,
		y: options.y,
		title: options.title ?? "New card",
		listId: options.listId,
	});
}

function getMindmapThemeOptions(options: SkedraFactoryOptions = {}) {
	const dark = isDarkTheme(options.theme);
	return {
		fontFamily: TOOL_FONT_FAMILY,
		rootFill: dark ? DARK_MINDMAP_ROOT_FILL : LIGHT_MINDMAP_ROOT_FILL,
		nodeFill: dark ? DARK_NODE_FILL : LIGHT_NODE_FILL,
		rootStroke: dark ? DARK_MINDMAP_ROOT_STROKE : LIGHT_MINDMAP_ROOT_STROKE,
		childBorder: dark ? DARK_MINDMAP_CHILD_BORDER : LIGHT_MINDMAP_CHILD_BORDER,
		rootTextColor: dark ? DARK_MINDMAP_ROOT_STROKE : LIGHT_MINDMAP_ROOT_STROKE,
		childTextColor: dark ? DARK_MINDMAP_CHILD_TEXT : LIGHT_MINDMAP_CHILD_TEXT,
	};
}

export function createSkedraMindmapElements(
	options: CreateSkedraMindmapOptions,
): CanvasElement[] {
	const createId = options.createId ?? createSkedraElementId;
	const treeId = createId();
	const root = createMindmapNode({
		id: createId(),
		x: options.x - MINDMAP_ROOT_WIDTH / 2,
		y: options.y - 32,
		text: options.text ?? "Mindmap",
		treeId,
		parentId: null,
		direction: "right",
		depth: 0,
		stroke: isDarkTheme(options.theme)
			? DARK_MINDMAP_ROOT_STROKE
			: LIGHT_MINDMAP_ROOT_STROKE,
		fill: isDarkTheme(options.theme)
			? DARK_MINDMAP_ROOT_FILL
			: LIGHT_MINDMAP_ROOT_FILL,
		...getMindmapThemeOptions(options),
	});
	const branches =
		options.branches ??
		([
			{ direction: "left", yOffset: -120, color: "#2563eb", text: "Strategy" },
			{ direction: "left", yOffset: 108, color: "#d97706", text: "Operations" },
			{ direction: "right", yOffset: -120, color: "#0f766e", text: "Product" },
			{ direction: "right", yOffset: 108, color: "#7c3aed", text: "Growth" },
		] satisfies CreateSkedraMindmapOptions["branches"]);
	const nodes: CanvasElement[] = [root];
	const edges: CanvasElement[] = [];

	for (const branch of branches) {
		const node = createMindmapNode({
			id: createId(),
			x:
				branch.direction === "right"
					? root.x + root.width + MINDMAP_HORIZONTAL_GAP
					: root.x - MINDMAP_HORIZONTAL_GAP - MINDMAP_NODE_WIDTH,
			y: options.y + branch.yOffset,
			text: branch.text,
			treeId,
			parentId: root.id,
			direction: branch.direction,
			depth: 1,
			stroke: branch.color,
			...getMindmapThemeOptions(options),
		});
		nodes.push(node);
		edges.push(
			createMindmapEdge({
				id: createId(),
				treeId,
				source: root,
				target: node,
				stroke: branch.color,
			}),
		);
	}

	return [...edges, ...nodes];
}

function baseTemplateElement(
	createId: () => string,
	overrides: Partial<CanvasElement> & { type: CanvasElement["type"] },
): CanvasElement {
	return {
		id: createId(),
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		rotation: 0,
		fill: "transparent",
		stroke: LIGHT_STROKE,
		strokeWidth: 2,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		...overrides,
	};
}

function createTemplateArrow(
	createId: () => string,
	points: [number, number][],
	overrides: Partial<CanvasElement> = {},
) {
	const minX = Math.min(...points.map(([x]) => x));
	const maxX = Math.max(...points.map(([x]) => x));
	const minY = Math.min(...points.map(([, y]) => y));
	const maxY = Math.max(...points.map(([, y]) => y));
	return baseTemplateElement(createId, {
		type: "arrow",
		x: minX,
		y: minY,
		width: Math.max(1, maxX - minX),
		height: Math.max(1, maxY - minY),
		stroke: "#94a3b8",
		strokeWidth: 2,
		arrowMode: points.length > 2 ? "elbow" : "straight",
		arrowHeadStart: "none",
		arrowHeadEnd: "none",
		points: points.map(([x, y]) => [x - minX, y - minY] as [number, number]),
		...overrides,
	});
}

export function createSkedraTemplateSectionFrame(
	options: CreateSkedraTemplateSectionFrameOptions,
): CanvasElement {
	const createId = options.createId ?? createSkedraElementId;
	return baseTemplateElement(createId, {
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
			skedraType: "template-section",
			templateTool: options.tool,
			templateSectionId: options.sectionId,
			templateAccent: options.accent,
			templateBaseHeight: options.height,
			stickyColor: options.stickyColor,
			stickyWidth: options.stickyWidth,
			stickyHeight: options.stickyHeight,
			templateLayoutId: options.layoutId,
			templateLayoutRole: options.layoutRole,
		},
	});
}

function createFlowchartTemplate(
	x: number,
	y: number,
	options: SkedraFactoryOptions = {},
): CanvasElement[] {
	const createId = options.createId ?? createSkedraElementId;
	const flowchartId = createId();
	const stroke =
		options.stroke ??
		(isDarkTheme(options.theme) ? DARK_STROKE : FLOWCHART_DEFAULT_STROKE);
	const node = (
		nodeOptions: Omit<
			Parameters<typeof createFlowchartNode>[0],
			"id" | "flowchartId" | "fontFamily" | "stroke"
		>,
	) =>
		createFlowchartNode({
			id: createId(),
			flowchartId,
			fontFamily: TOOL_FONT_FAMILY,
			stroke,
			...nodeOptions,
		});
	const kickoff = node({
		x: x - 430,
		y: y - 20,
		width: 160,
		height: 56,
		type: "ellipse",
		text: "Kickoff",
		nodeKind: "start",
		fontSize: 18,
		fontWeight: "bold",
	});
	const scope = node({
		x: x - 180,
		y: y - 36,
		width: 220,
		height: 88,
		type: "rectangle",
		text: "Scope",
		nodeKind: "step",
		cornerRadius: 18,
		fontSize: 18,
		fontWeight: "bold",
	});
	const review = node({
		x: x + 130,
		y: y - 52,
		width: 180,
		height: 120,
		type: "diamond",
		text: "Review",
		nodeKind: "decision",
		fontSize: 19,
		fontWeight: "bold",
	});
	const qa = node({
		x: x + 400,
		y: y - 36,
		width: 220,
		height: 88,
		type: "rectangle",
		text: "QA",
		nodeKind: "step",
		cornerRadius: 18,
		fontSize: 18,
		fontWeight: "bold",
	});
	const release = node({
		x: x + 425,
		y: y + 100,
		width: 170,
		height: 56,
		type: "ellipse",
		text: "Release",
		nodeKind: "end",
		fontSize: 18,
		fontWeight: "bold",
	});
	const open = node({
		x: x + 120,
		y: y + 116,
		width: 200,
		height: 88,
		type: "rectangle",
		text: "Open points",
		nodeKind: "step",
		cornerRadius: 18,
		fontSize: 18,
		fontWeight: "bold",
	});
	const connector = (
		source: CanvasElement,
		target: CanvasElement,
		route: Parameters<typeof createFlowchartConnector>[0]["route"],
		extras: Partial<Parameters<typeof createFlowchartConnector>[0]> = {},
	) =>
		createFlowchartConnector({
			id: createId(),
			flowchartId,
			source,
			target,
			route,
			...extras,
		});
	return [
		connector(kickoff, scope, "right"),
		connector(scope, review, "right"),
		connector(review, qa, "right", { branchKind: "yes", text: "Yes" }),
		connector(qa, release, "down"),
		connector(review, open, "down", {
			branchKind: "no",
			text: "No",
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

function createRetrospectiveTemplate(
	x: number,
	y: number,
	options: SkedraFactoryOptions = {},
): CanvasElement[] {
	const createId = options.createId ?? createSkedraElementId;
	const layoutId = createId();
	const topY = y - 170;
	const columnWidth = 316;
	const columnHeight = 420;
	const gap = 34;
	const startX = x - (columnWidth * 3 + gap * 2) / 2;
	const sections = [
		{
			role: "celebrate",
			label: "Celebrate",
			accent: "#15803d",
			color: "#d3f9d8",
		},
		{
			role: "friction",
			label: "Friction",
			accent: "#dc2626",
			color: "#ffd6e0",
		},
		{
			role: "commitment",
			label: "Commitments",
			accent: "#2563eb",
			color: "#d0ebff",
		},
	];
	const elements = sections.map((section, index) =>
		createSkedraTemplateSectionFrame({
			createId,
			x: startX + index * (columnWidth + gap),
			y: topY,
			width: columnWidth,
			height: columnHeight,
			label: section.label,
			tool: "retrospective",
			sectionId: section.role,
			accent: section.accent,
			stickyColor: section.color,
			stickyWidth: 126,
			stickyHeight: 110,
			layoutId,
			layoutRole: section.role,
		}),
	);
	const outcomeY = topY + columnHeight + 46;
	elements.push(
		baseTemplateElement(createId, {
			type: "rectangle",
			x: startX,
			y: outcomeY,
			width: columnWidth * 3 + gap * 2,
			height: 102,
			stroke: "#64748b",
			strokeWidth: 1.5,
			strokeStyle: "dashed",
			cornerRadius: 18,
			text: "Actions, owners, dates, and signals",
			fontFamily: TOOL_FONT_FAMILY,
			fontSize: 18,
			textAlign: "center",
			customData: {
				templateTool: "retrospective",
				templateLayoutId: layoutId,
				templateLayoutRole: "summary",
			},
		}),
	);
	return elements;
}

function createSwotTemplate(
	x: number,
	y: number,
	options: SkedraFactoryOptions = {},
): CanvasElement[] {
	const createId = options.createId ?? createSkedraElementId;
	const layoutId = createId();
	const width = 380;
	const height = 340;
	const gap = 38;
	const leftX = x - width - gap / 2;
	const rightX = x + gap / 2;
	const topY = y - 130;
	const bottomY = topY + height + gap;
	const sections = [
		{
			x: leftX,
			y: topY,
			id: "strengths",
			label: "Strengths",
			accent: "#15803d",
			color: "#d3f9d8",
		},
		{
			x: rightX,
			y: topY,
			id: "weaknesses",
			label: "Weaknesses",
			accent: "#dc2626",
			color: "#ffd6e0",
		},
		{
			x: leftX,
			y: bottomY,
			id: "opportunities",
			label: "Opportunities",
			accent: "#2563eb",
			color: "#d0ebff",
		},
		{
			x: rightX,
			y: bottomY,
			id: "threats",
			label: "Threats",
			accent: "#d97706",
			color: "#ffe0cc",
		},
	];
	const axisCenterX = x;
	const axisCenterY = topY + height + gap / 2;
	return [
		createTemplateArrow(createId, [
			[axisCenterX, topY - 8],
			[axisCenterX, bottomY + height + 8],
		]),
		createTemplateArrow(createId, [
			[leftX - 8, axisCenterY],
			[rightX + width + 8, axisCenterY],
		]),
		...sections.map((section) =>
			createSkedraTemplateSectionFrame({
				createId,
				x: section.x,
				y: section.y,
				width,
				height,
				label: section.label,
				tool: "swot",
				sectionId: section.id,
				accent: section.accent,
				stickyColor: section.color,
				stickyWidth: 160,
				stickyHeight: 124,
				layoutId,
				layoutRole: section.id,
			}),
		),
	];
}

export function createSkedraTemplateElements(
	templateId: SkedraSdkTemplateId,
	options: CreateSkedraTemplateElementsOptions,
): CanvasElement[] {
	switch (templateId) {
		case "kanban":
			return createSkedraKanbanBoardElements({
				...options,
				x: options.x - 450,
				y: options.y - 200,
			});
		case "mindmap":
			return createSkedraMindmapElements(options);
		case "flowchart":
			return createFlowchartTemplate(options.x, options.y, options);
		case "retrospective":
			return createRetrospectiveTemplate(options.x, options.y, options);
		case "swot":
			return createSwotTemplate(options.x, options.y, options);
	}
}

export const SKEDRA_TEMPLATES: SkedraTemplateDefinition[] = [
	{
		id: "kanban",
		name: "Kanban board",
		description: "Three starter lists for task work",
		create: (x, y, options) =>
			createSkedraTemplateElements("kanban", { ...options, x, y }),
	},
	{
		id: "mindmap",
		name: "Mindmap",
		description: "A root node with starter branches",
		create: (x, y, options) =>
			createSkedraTemplateElements("mindmap", { ...options, x, y }),
	},
	{
		id: "flowchart",
		name: "Flowchart",
		description: "A small process and decision chain",
		create: (x, y, options) =>
			createSkedraTemplateElements("flowchart", { ...options, x, y }),
	},
	{
		id: "retrospective",
		name: "Retrospective",
		description: "Columns for reflection and commitments",
		create: (x, y, options) =>
			createSkedraTemplateElements("retrospective", { ...options, x, y }),
	},
	{
		id: "swot",
		name: "SWOT",
		description:
			"Four sections for strengths, weaknesses, opportunities, threats",
		create: (x, y, options) =>
			createSkedraTemplateElements("swot", { ...options, x, y }),
	},
];
