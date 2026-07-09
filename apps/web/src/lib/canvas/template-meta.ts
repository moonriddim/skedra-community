import type { CanvasElement } from "@skedra/canvas-core";

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
export const TEMPLATE_SECTION_GAP = 18;
export const TEMPLATE_SECTION_PADDING_TOP_COMPACT = 58;

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

export interface TemplateSectionDefaults {
	noteType: TemplateNoteType;
	stickyColor: string;
	accent: string;
}

const TEMPLATE_SECTION_DEFAULTS: Record<
	Exclude<TemplateToolId, "flowchart">,
	Record<string, TemplateSectionDefaults>
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
		threats: { noteType: "threat", stickyColor: "#FFE0CC", accent: "#D97706" },
	},
};

export function getTemplateStickyMetrics(
	section: CanvasElement,
	meta: TemplateSectionMeta | null | undefined,
): { noteWidth: number; noteHeight: number } {
	const noteWidth = meta?.stickyWidth ?? 200;
	const noteHeight = meta?.stickyHeight ?? 200;
	if (meta?.templateTool !== "retrospective") {
		return { noteWidth, noteHeight };
	}

	const usableWidth = Math.max(
		noteWidth,
		section.width - TEMPLATE_SECTION_PADDING_X * 2,
	);
	const maxTwoColumnWidth = Math.floor(
		(usableWidth - TEMPLATE_SECTION_GAP) / 2,
	);
	return {
		noteWidth: Math.max(112, Math.min(noteWidth, maxTwoColumnWidth)),
		noteHeight: Math.min(noteHeight, 110),
	};
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value != null;
}

export function isTemplateSection(
	element: CanvasElement | null | undefined,
): boolean {
	return element?.customData?.skedraType === TEMPLATE_SECTION_TYPE;
}

export function getTemplateSectionMeta(
	element: CanvasElement | null | undefined,
): TemplateSectionMeta | null {
	if (
		!element ||
		element.type !== "frame" ||
		!isTemplateSection(element) ||
		!isRecord(element.customData)
	) {
		return null;
	}

	const {
		templateTool,
		templateSectionId,
		templateAccent,
		templateBaseHeight,
		templatePrompt,
		stickyColor,
		stickyWidth,
		stickyHeight,
		templateLayoutId,
		templateLayoutRole,
	} = element.customData;
	if (
		(templateTool !== "retrospective" &&
			templateTool !== "swot" &&
			templateTool !== "flowchart") ||
		typeof templateSectionId !== "string" ||
		typeof templateAccent !== "string" ||
		typeof templateBaseHeight !== "number" ||
		(stickyWidth !== undefined && typeof stickyWidth !== "number") ||
		(stickyHeight !== undefined && typeof stickyHeight !== "number") ||
		(templateLayoutId !== undefined && typeof templateLayoutId !== "string") ||
		(templateLayoutRole !== undefined && typeof templateLayoutRole !== "string")
	) {
		return null;
	}

	return {
		skedraType: TEMPLATE_SECTION_TYPE,
		templateTool,
		templateSectionId,
		templateAccent,
		templateBaseHeight,
		templatePrompt:
			typeof templatePrompt === "string" ? templatePrompt : undefined,
		stickyColor: typeof stickyColor === "string" ? stickyColor : undefined,
		stickyWidth: typeof stickyWidth === "number" ? stickyWidth : undefined,
		stickyHeight: typeof stickyHeight === "number" ? stickyHeight : undefined,
		templateLayoutId:
			typeof templateLayoutId === "string" ? templateLayoutId : undefined,
		templateLayoutRole:
			typeof templateLayoutRole === "string" ? templateLayoutRole : undefined,
	};
}

export function getTemplateSectionDefaults(
	tool: TemplateToolId,
	sectionId: string,
): TemplateSectionDefaults | null {
	if (tool === "flowchart") return null;
	return TEMPLATE_SECTION_DEFAULTS[tool][sectionId] ?? null;
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
	const {
		templateTool,
		templateSectionId,
		templateNoteType,
		templateAccent,
		stickyColor,
		stickyWidth,
		stickyHeight,
	} = element.customData;
	if (
		(templateTool !== "retrospective" &&
			templateTool !== "swot" &&
			templateTool !== "flowchart") ||
		typeof templateSectionId !== "string" ||
		(templateNoteType !== "celebrate" &&
			templateNoteType !== "friction" &&
			templateNoteType !== "commitment" &&
			templateNoteType !== "strength" &&
			templateNoteType !== "weakness" &&
			templateNoteType !== "opportunity" &&
			templateNoteType !== "threat") ||
		typeof templateAccent !== "string" ||
		typeof stickyColor !== "string" ||
		(stickyWidth !== undefined && typeof stickyWidth !== "number") ||
		(stickyHeight !== undefined && typeof stickyHeight !== "number")
	) {
		return null;
	}

	return {
		templateTool,
		templateSectionId,
		templateNoteType,
		templateAccent,
		stickyColor,
		stickyWidth: typeof stickyWidth === "number" ? stickyWidth : undefined,
		stickyHeight: typeof stickyHeight === "number" ? stickyHeight : undefined,
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
