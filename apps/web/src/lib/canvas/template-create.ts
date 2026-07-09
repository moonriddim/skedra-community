import {
	type CanvasElement,
	createStickyNoteElement,
	sortCanvasElements,
} from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import type { CanvasThemeState } from "./canvas-defaults";
import { getCanvasElementFactoryDefaults } from "./canvas-factory-defaults";
import {
	TEMPLATE_SECTION_GAP,
	TEMPLATE_SECTION_PADDING_TOP,
	TEMPLATE_SECTION_PADDING_TOP_COMPACT,
	TEMPLATE_SECTION_PADDING_X,
	TEMPLATE_SECTION_TYPE,
	type TemplateToolId,
	getTemplateSectionDefaults,
	getTemplateSectionMeta,
	getTemplateStickyMetrics,
	getTemplateStickyNoteMeta,
	isRecord,
	listSectionStickyNotes,
} from "./template-meta";

export function createTemplateSectionFrame(options: {
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
	return {
		id: nanoid(),
		type: "frame",
		x: options.x,
		y: options.y,
		width: options.width,
		height: options.height,
		rotation: 0,
		fill: "transparent",
		stroke: options.accent,
		strokeWidth: 1.5,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
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
	};
}

function getNextTemplateStickyPosition(
	section: CanvasElement,
	existingElements: Iterable<CanvasElement>,
): { x: number; y: number } {
	const meta = getTemplateSectionMeta(section);
	const notes = listSectionStickyNotes(section.id, existingElements);
	const { noteWidth, noteHeight } = getTemplateStickyMetrics(section, meta);
	const gap = TEMPLATE_SECTION_GAP;
	const paddingX = TEMPLATE_SECTION_PADDING_X;
	const paddingTop = section.text
		? TEMPLATE_SECTION_PADDING_TOP
		: TEMPLATE_SECTION_PADDING_TOP_COMPACT;
	const usableWidth = Math.max(noteWidth, section.width - paddingX * 2);
	const columns = Math.max(
		1,
		Math.floor((usableWidth + gap) / (noteWidth + gap)),
	);
	const index = notes.length;
	const column = index % columns;
	const row = Math.floor(index / columns);

	return {
		x: section.x + paddingX + column * (noteWidth + gap),
		y: section.y + paddingTop + row * (noteHeight + gap),
	};
}

export function createTemplateStickyNote(options: {
	section: CanvasElement;
	existingElements: Iterable<CanvasElement>;
	theme?: CanvasThemeState;
	color?: string;
	text?: string;
	customData?: Record<string, unknown>;
}): CanvasElement[] {
	const meta = getTemplateSectionMeta(options.section);
	if (!meta) return [];
	const defaults = getTemplateSectionDefaults(
		meta.templateTool,
		meta.templateSectionId,
	);
	if (!defaults) return [];
	const { noteWidth, noteHeight } = getTemplateStickyMetrics(
		options.section,
		meta,
	);

	const position = getNextTemplateStickyPosition(
		options.section,
		options.existingElements,
	);
	return [
		createStickyNoteElement(getCanvasElementFactoryDefaults(options.theme), {
			x: position.x,
			y: position.y,
			color: options.color ?? defaults.stickyColor,
			width: noteWidth,
			height: noteHeight,
			fontSize: noteHeight < 160 ? 18 : undefined,
			stroke: defaults.accent,
			text: options.text,
			frameId: options.section.id,
			customData: {
				templateTool: meta.templateTool,
				templateSectionId: meta.templateSectionId,
				templateNoteType: defaults.noteType,
				templateAccent: defaults.accent,
				stickyColor: defaults.stickyColor,
				stickyWidth: noteWidth,
				stickyHeight: noteHeight,
				...(options.customData ?? {}),
			},
		}),
	];
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

	for (const section of sections) {
		if (
			x >= section.x &&
			x <= section.x + section.width &&
			y >= section.y &&
			y <= section.y + section.height
		) {
			return section;
		}
	}

	return null;
}

export function getTemplateStickyAssignmentChanges(
	note: CanvasElement,
	section: CanvasElement | null,
): Partial<CanvasElement> {
	const currentMeta = getTemplateStickyNoteMeta(note);
	if (!section) {
		return { frameId: undefined };
	}
	const sectionMeta = getTemplateSectionMeta(section);
	if (!sectionMeta) return {};
	const defaults = getTemplateSectionDefaults(
		sectionMeta.templateTool,
		sectionMeta.templateSectionId,
	);
	if (!defaults) return {};

	return {
		frameId: section.id,
		fill: defaults.stickyColor,
		stroke: defaults.accent,
		customData: {
			...(note.customData ?? {}),
			skedraType: "sticky-note",
			templateTool: sectionMeta.templateTool,
			templateSectionId: sectionMeta.templateSectionId,
			templateNoteType: defaults.noteType,
			templateAccent: defaults.accent,
			stickyColor: defaults.stickyColor,
			...(currentMeta ? {} : { templateFromSection: true }),
		},
	};
}

export function buildTemplateSectionPaletteUpdates(
	section: CanvasElement,
	elements: Map<string, CanvasElement>,
	options: {
		accent?: string;
		stickyColor?: string;
	},
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const sectionMeta = getTemplateSectionMeta(section);
	if (!sectionMeta) return [];

	const accent = options.accent ?? sectionMeta.templateAccent;
	const stickyColor = options.stickyColor ?? sectionMeta.stickyColor;
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [
		{
			id: section.id,
			changes: {
				stroke: accent,
				customData: {
					...(isRecord(section.customData) ? section.customData : {}),
					templateAccent: accent,
					...(stickyColor ? { stickyColor } : {}),
				},
			},
		},
	];

	for (const note of listSectionStickyNotes(section.id, elements.values())) {
		updates.push({
			id: note.id,
			changes: {
				stroke: accent,
				...(stickyColor ? { fill: stickyColor } : {}),
				customData: {
					...(isRecord(note.customData) ? note.customData : {}),
					templateAccent: accent,
					...(stickyColor ? { stickyColor } : {}),
				},
			},
		});
	}

	return updates;
}
