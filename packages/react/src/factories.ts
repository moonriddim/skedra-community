import {
	DEFAULT_SEQUENCE_DIAGRAM_SOURCE,
	WIREFRAME_BLANK_PRESET_IDS,
	WIREFRAME_COMPONENT_CATEGORIES,
	WIREFRAME_COMPONENT_IDS,
	WIREFRAME_PRESET_IDS,
	WIREFRAME_STARTER_PRESET_IDS,
	createBaseCanvasElement,
	createCanvasTemplateElements,
	createCanvasTemplateSectionFrame,
	createGanttChartElements,
	createKanbanBoardElements,
	createKanbanCardElement,
	createSequenceDiagramElements,
	createStackIndexAfter,
	createStickyNoteElement,
	createVisualSequenceDiagramElements,
	createWireframeComponentElements,
	createWireframePresetElements,
	createWireframeScreenElements,
} from "@skedra/canvas-core";
import type { CanvasElement } from "./types.js";

export type SkedraSdkTemplateId =
	| "kanban"
	| "gantt"
	| "mindmap"
	| "flowchart"
	| "retrospective"
	| "swot"
	| "wireframe";

export type SkedraSdkResolvedTheme = "light" | "dark";
export type SkedraSequenceVisualPreset = "blank" | "checkout";
export type SkedraWireframeViewport = "desktop" | "tablet" | "mobile";
export type SkedraWireframeChrome = "browser" | "mobile" | "none";
export type SkedraWireframeComponentId =
	| "navbar"
	| "topbar"
	| "sidebar"
	| "hero"
	| "text-block"
	| "button"
	| "input"
	| "textarea"
	| "search"
	| "checkbox"
	| "radio"
	| "toggle"
	| "select"
	| "tabs"
	| "breadcrumb"
	| "card"
	| "image"
	| "avatar"
	| "list"
	| "table"
	| "modal"
	| "pagination"
	| "bottom-nav"
	| "divider"
	| "skeleton";
export type SkedraWireframePresetId =
	| "responsive-landing"
	| "blank-desktop"
	| "blank-tablet"
	| "blank-mobile"
	| "dashboard"
	| "mobile-app"
	| "login"
	| "ecommerce"
	| "settings";

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

export type SkedraGanttTaskStatus =
	| "planned"
	| "active"
	| "completed"
	| "delayed";

export type SkedraGanttBuiltInTaskCategory =
	| "project"
	| "vacation"
	| "absence"
	| "construction-site"
	| "home-office";

/** Built-in values are presets; custom integrations may use any stable id. */
export type SkedraGanttTaskCategory = string;

export type SkedraGanttDependencyKind =
	| "finish-to-start"
	| "start-to-start"
	| "finish-to-finish"
	| "start-to-finish";

export interface SkedraGanttTask {
	id: string;
	title: string;
	startDay: number;
	durationDays: number;
	progress?: number;
	status?: SkedraGanttTaskStatus;
	category?: SkedraGanttTaskCategory;
	categoryLabel?: string;
	owner?: string;
	color?: string;
	milestone?: boolean;
	critical?: boolean;
	/** Summary row (phase) that aggregates its child tasks. */
	group?: boolean;
	/** Id of the parent group. Only one nesting level is supported. */
	parentId?: string;
	/** Collapsed groups hide their children in every rendering. */
	collapsed?: boolean;
}

export interface SkedraGanttDependency {
	fromTaskId: string;
	toTaskId: string;
	type?: SkedraGanttDependencyKind;
}

export interface SkedraGanttAppearance {
	background?: string;
	headerFill?: string;
	rowFill?: string;
	alternateRowFill?: string;
	gridStroke?: string;
	textColor?: string;
	mutedTextColor?: string;
	dependencyStroke?: string;
}

export interface SkedraGanttChartDocument {
	title: string;
	startDate: string;
	dayCount: number;
	canvasViewportStartDay?: number;
	canvasViewportDayCount?: number;
	dayWidth: number;
	labelWidth: number;
	rowHeight: number;
	headerHeight: number;
	showToday: boolean;
	tasks: Array<
		SkedraGanttTask & {
			progress: number;
			status: SkedraGanttTaskStatus;
			milestone: boolean;
			critical: boolean;
			group: boolean;
			collapsed: boolean;
		}
	>;
	dependencies: SkedraGanttDependency[];
	appearance: Required<SkedraGanttAppearance>;
}

export interface CreateSkedraGanttChartOptions extends SkedraFactoryOptions {
	x: number;
	y: number;
	title?: string;
	startDate?: string;
	dayCount?: number;
	canvasViewportStartDay?: number;
	canvasViewportDayCount?: number;
	dayWidth?: number;
	labelWidth?: number;
	rowHeight?: number;
	headerHeight?: number;
	showToday?: boolean;
	tasks?: readonly SkedraGanttTask[];
	dependencies?: readonly SkedraGanttDependency[];
	dateLabel?: (startDate: string, endDate: string) => string;
	appearance?: SkedraGanttAppearance;
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

export interface SkedraSequenceDiagramAppearance {
	stroke?: string;
	textColor?: string;
	participantFill?: string;
	participantStroke?: string;
	lifelineStroke?: string;
	messageStroke?: string;
	activationFill?: string;
	noteFill?: string;
	noteStroke?: string;
	noteTextColor?: string;
	fragmentStroke?: string;
	fragmentFill?: string;
	fontFamily?: string;
}

export interface CreateSkedraSequenceDiagramOptions
	extends SkedraFactoryOptions {
	x: number;
	y: number;
	source: string;
	participantGap?: number;
	appearance?: SkedraSequenceDiagramAppearance;
}

export interface CreateSkedraVisualSequenceDiagramOptions
	extends SkedraFactoryOptions {
	x: number;
	y: number;
	preset: SkedraSequenceVisualPreset;
	appearance?: SkedraSequenceDiagramAppearance;
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

export interface CreateSkedraWireframeComponentOptions
	extends CreateSkedraTemplateElementsOptions {
	component: SkedraWireframeComponentId;
	viewport?: SkedraWireframeViewport;
	frameId?: string;
}

export interface CreateSkedraWireframeScreenOptions
	extends CreateSkedraTemplateElementsOptions {
	viewport: SkedraWireframeViewport;
	width?: number;
	height?: number;
	label?: string;
	chrome?: SkedraWireframeChrome;
}

export interface CreateSkedraWireframePresetOptions
	extends CreateSkedraTemplateElementsOptions {
	preset: SkedraWireframePresetId;
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

function getSkedraGanttAppearance(
	options: SkedraFactoryOptions,
): SkedraGanttAppearance {
	if (!isDarkTheme(options.theme)) return {};
	return {
		background: "#111915",
		headerFill: "#1D2A23",
		rowFill: "#111915",
		alternateRowFill: "#16211B",
		gridStroke: "#3A4A41",
		textColor: "#E6EFE8",
		mutedTextColor: "#B7C5BC",
		dependencyStroke: "#94A3B8",
	};
}

export function createSkedraGanttChartElements(
	options: CreateSkedraGanttChartOptions,
): CanvasElement[] {
	return createGanttChartElements(getSkedraElementFactoryDefaults(options), {
		x: options.x,
		y: options.y,
		title: options.title,
		startDate: options.startDate,
		dayCount: options.dayCount,
		canvasViewportStartDay: options.canvasViewportStartDay,
		canvasViewportDayCount: options.canvasViewportDayCount,
		dayWidth: options.dayWidth,
		labelWidth: options.labelWidth,
		rowHeight: options.rowHeight,
		headerHeight: options.headerHeight,
		showToday: options.showToday,
		tasks: options.tasks,
		dependencies: options.dependencies,
		dateLabel: options.dateLabel,
		appearance: {
			...getSkedraGanttAppearance(options),
			...options.appearance,
		},
		fontFamily: TOOL_FONT_FAMILY,
	});
}

export function getSkedraMindmapAppearance(options: SkedraFactoryOptions = {}) {
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
	return createCanvasTemplateElements({
		id: "mindmap",
		x: options.x,
		y: options.y,
		defaults: getSkedraElementFactoryDefaults(options),
		mindmapText: options.text,
		mindmapBranches: options.branches,
		mindmapAppearance: getSkedraMindmapAppearance(options),
		gantt: { appearance: getSkedraGanttAppearance(options) },
	});
}

export const SKEDRA_SEQUENCE_DIAGRAM_EXAMPLE = DEFAULT_SEQUENCE_DIAGRAM_SOURCE;

export function getSkedraSequenceDiagramAppearance(
	options: SkedraFactoryOptions & {
		appearance?: SkedraSequenceDiagramAppearance;
	} = {},
) {
	const dark = isDarkTheme(options.theme);
	return {
		fontFamily: TOOL_FONT_FAMILY,
		participantFill: dark ? DARK_NODE_FILL : LIGHT_NODE_FILL,
		activationFill: dark ? DARK_MINDMAP_ROOT_FILL : LIGHT_NODE_FILL,
		noteFill: dark ? "#3f3218" : "#fef3c7",
		noteStroke: dark ? "#fbbf24" : "#d97706",
		noteTextColor: dark ? "#fde68a" : "#713f12",
		lifelineStroke: dark ? "#64748b" : "#94a3b8",
		fragmentStroke: dark ? "#94a3b8" : "#64748b",
		fragmentFill: dark ? "#164e6340" : "#cffafe55",
		...options.appearance,
	};
}

export function createSkedraSequenceDiagramElements(
	options: CreateSkedraSequenceDiagramOptions,
): CanvasElement[] {
	return createSequenceDiagramElements({
		source: options.source,
		x: options.x,
		y: options.y,
		participantGap: options.participantGap,
		defaults: getSkedraElementFactoryDefaults(options),
		appearance: getSkedraSequenceDiagramAppearance(options),
	});
}

export function createSkedraVisualSequenceDiagramElements(
	options: CreateSkedraVisualSequenceDiagramOptions,
): CanvasElement[] {
	return createVisualSequenceDiagramElements({
		preset: options.preset,
		x: options.x,
		y: options.y,
		defaults: getSkedraElementFactoryDefaults(options),
		appearance: getSkedraSequenceDiagramAppearance(options),
	});
}

export function createSkedraTemplateSectionFrame(
	options: CreateSkedraTemplateSectionFrameOptions,
): CanvasElement {
	return createCanvasTemplateSectionFrame({
		...options,
		createId: options.createId ?? createSkedraElementId,
	});
}

export function createSkedraTemplateElements(
	templateId: SkedraSdkTemplateId,
	options: CreateSkedraTemplateElementsOptions,
): CanvasElement[] {
	return createCanvasTemplateElements({
		id: templateId,
		x: options.x,
		y: options.y,
		defaults: getSkedraElementFactoryDefaults(options),
		fontFamily: TOOL_FONT_FAMILY,
		flowchartStroke: options.stroke,
		mindmapAppearance: getSkedraMindmapAppearance(options),
	});
}

export const SKEDRA_WIREFRAME_COMPONENT_IDS: readonly SkedraWireframeComponentId[] =
	WIREFRAME_COMPONENT_IDS;
export const SKEDRA_WIREFRAME_COMPONENT_CATEGORIES: Readonly<
	Record<
		"layout" | "content" | "forms" | "data",
		readonly SkedraWireframeComponentId[]
	>
> = WIREFRAME_COMPONENT_CATEGORIES;
export const SKEDRA_WIREFRAME_PRESET_IDS: readonly SkedraWireframePresetId[] =
	WIREFRAME_PRESET_IDS;
export const SKEDRA_WIREFRAME_BLANK_PRESET_IDS: readonly SkedraWireframePresetId[] =
	WIREFRAME_BLANK_PRESET_IDS;
export const SKEDRA_WIREFRAME_STARTER_PRESET_IDS: readonly SkedraWireframePresetId[] =
	WIREFRAME_STARTER_PRESET_IDS;

export function createSkedraWireframeComponentElements(
	options: CreateSkedraWireframeComponentOptions,
): CanvasElement[] {
	return createWireframeComponentElements({
		...options,
		defaults: getSkedraElementFactoryDefaults(options),
		fontFamily: TOOL_FONT_FAMILY,
	});
}

export function createSkedraWireframeScreenElements(
	options: CreateSkedraWireframeScreenOptions,
): CanvasElement[] {
	return createWireframeScreenElements({
		...options,
		defaults: getSkedraElementFactoryDefaults(options),
		fontFamily: TOOL_FONT_FAMILY,
	});
}

export function createSkedraWireframePresetElements(
	options: CreateSkedraWireframePresetOptions,
): CanvasElement[] {
	return createWireframePresetElements({
		...options,
		defaults: getSkedraElementFactoryDefaults(options),
		fontFamily: TOOL_FONT_FAMILY,
	});
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
		id: "gantt",
		name: "Gantt chart",
		description: "Project timeline with tasks, progress and dependencies",
		create: (x, y, options) =>
			createSkedraTemplateElements("gantt", { ...options, x, y }),
	},
	{
		id: "wireframe",
		name: "Low-fidelity wireframe",
		description: "Editable responsive desktop and mobile landing-page layout",
		create: (x, y, options) =>
			createSkedraTemplateElements("wireframe", { ...options, x, y }),
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
