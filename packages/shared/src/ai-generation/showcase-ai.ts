/**
 * Multi-Tool-Showcase: mehrere Skedra-Tools in einem Board layouten.
 */

import type { AddCanvasElementInput } from "../canvas-api";
import {
	aiKanbanBoardSchema,
	buildKanbanElementsFromAi,
	countKanbanStats,
} from "../kanban-ai";
import { parseDiagramElementsFromAi } from "./diagram-ai";
import {
	aiFlowchartSchema,
	buildFlowchartElementsFromAi,
} from "./flowchart-ai";
import { aiFramesSchema, buildFrameElementsFromAi } from "./frames-ai";
import { aiMindmapSchema, buildMindmapElementsFromAi } from "./mindmap-ai";
import {
	aiStickyNotesSchema,
	buildStickyNoteElementsFromAi,
} from "./sticky-notes-ai";
import {
	aiRetrospectiveSchema,
	aiSwotSchema,
	buildRetrospectiveElementsFromAi,
	buildSwotElementsFromAi,
} from "./template-boards-ai";
import type { AiGenerationResult, AiResultKind } from "./types";

const SHOWCASE_GAP = 72;
const SHOWCASE_ORIGIN_X = 80;
const SHOWCASE_ORIGIN_Y = 80;

type Bounds = {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	width: number;
	height: number;
};

type ShowcaseSection = {
	kind: AiResultKind;
	elements: AddCanvasElementInput[];
	summary: Record<string, number>;
};

const SHOWCASE_ROWS: Array<Array<keyof ShowcasePayload>> = [
	["kanban"],
	["mindmap", "flowchart"],
	["stickyNotes", "retrospective"],
	["swot", "frames"],
	["diagram"],
];

type ShowcasePayload = {
	kanban?: unknown;
	mindmap?: unknown;
	flowchart?: unknown;
	stickyNotes?: unknown;
	retrospective?: unknown;
	swot?: unknown;
	frames?: unknown;
	diagram?: unknown;
	elements?: unknown;
};

const SHOWCASE_TOOL_KEYS = [
	"kanban",
	"mindmap",
	"flowchart",
	"stickyNotes",
	"retrospective",
	"swot",
	"frames",
	"diagram",
] as const;

export function countShowcaseToolKeys(payload: Record<string, unknown>) {
	let count = 0;
	for (const key of SHOWCASE_TOOL_KEYS) {
		if (key === "diagram") {
			if (payload.diagram != null || payload.elements != null) count += 1;
		} else if (payload[key] != null) {
			count += 1;
		}
	}
	return count;
}

function getElementsBounds(elements: AddCanvasElementInput[]): Bounds {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const el of elements) {
		minX = Math.min(minX, el.x);
		minY = Math.min(minY, el.y);
		maxX = Math.max(maxX, el.x + el.width);
		maxY = Math.max(maxY, el.y + el.height);
	}

	if (!Number.isFinite(minX)) {
		return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
	}

	return {
		minX,
		minY,
		maxX,
		maxY,
		width: maxX - minX,
		height: maxY - minY,
	};
}

function offsetElements(
	elements: AddCanvasElementInput[],
	dx: number,
	dy: number,
) {
	return elements.map((el) => ({ ...el, x: el.x + dx, y: el.y + dy }));
}

function buildSection(
	key: keyof ShowcasePayload,
	raw: unknown,
): ShowcaseSection | null {
	try {
		switch (key) {
			case "kanban": {
				const board = aiKanbanBoardSchema.parse(raw);
				const elements = buildKanbanElementsFromAi(board, { x: 0, y: 0 });
				const stats = countKanbanStats(elements);
				return {
					kind: "kanban",
					elements,
					summary: { lists: stats.lists, cards: stats.cards },
				};
			}
			case "mindmap": {
				const board = aiMindmapSchema.parse(raw);
				const { elements, nodeCount } = buildMindmapElementsFromAi(board, {
					x: 0,
					y: 0,
				});
				return { kind: "mindmap", elements, summary: { nodes: nodeCount } };
			}
			case "flowchart": {
				const board = aiFlowchartSchema.parse(raw);
				const { elements, nodeCount, edgeCount } =
					buildFlowchartElementsFromAi(board);
				return {
					kind: "flowchart",
					elements,
					summary: { nodes: nodeCount, edges: edgeCount },
				};
			}
			case "stickyNotes": {
				const board = aiStickyNotesSchema.parse(raw);
				const { elements, noteCount } = buildStickyNoteElementsFromAi(board, {
					x: 0,
					y: 0,
					columns: 3,
				});
				return { kind: "stickyNotes", elements, summary: { notes: noteCount } };
			}
			case "retrospective": {
				const board = aiRetrospectiveSchema.parse(raw);
				const { elements, sectionCount, noteCount } =
					buildRetrospectiveElementsFromAi(board, {
						x: 0,
						y: 0,
					});
				return {
					kind: "retrospective",
					elements,
					summary: { sections: sectionCount, notes: noteCount },
				};
			}
			case "swot": {
				const board = aiSwotSchema.parse(raw);
				const { elements, quadrantCount, noteCount } = buildSwotElementsFromAi(
					board,
					{ x: 0, y: 0 },
				);
				return {
					kind: "swot",
					elements,
					summary: { quadrants: quadrantCount, notes: noteCount },
				};
			}
			case "frames": {
				const board = aiFramesSchema.parse(raw);
				const { elements, frameCount } = buildFrameElementsFromAi(board, {
					x: 0,
					y: 0,
				});
				return { kind: "frames", elements, summary: { frames: frameCount } };
			}
			case "diagram": {
				const diagramPayload =
					raw && typeof raw === "object" && "elements" in (raw as object)
						? raw
						: { elements: raw };
				const elements = parseDiagramElementsFromAi(
					diagramPayload as Record<string, unknown>,
				);
				return {
					kind: "diagram",
					elements,
					summary: { elements: elements.length },
				};
			}
			default:
				return null;
		}
	} catch {
		return null;
	}
}

function layoutShowcaseSections(
	sections: ShowcaseSection[],
): AddCanvasElementInput[] {
	const placed: AddCanvasElementInput[] = [];
	let cursorY = SHOWCASE_ORIGIN_Y;

	for (const row of SHOWCASE_ROWS) {
		const rowSections = row
			.map((key) =>
				sections.find((section) => section.kind === mapKeyToKind(key)),
			)
			.filter((section): section is ShowcaseSection => section != null);

		if (rowSections.length === 0) continue;

		let cursorX = SHOWCASE_ORIGIN_X;
		let rowHeight = 0;

		for (const section of rowSections) {
			const bounds = getElementsBounds(section.elements);
			const dx = cursorX - bounds.minX;
			const dy = cursorY - bounds.minY;
			placed.push(...offsetElements(section.elements, dx, dy));
			cursorX += bounds.width + SHOWCASE_GAP;
			rowHeight = Math.max(rowHeight, bounds.height);
		}

		cursorY += rowHeight + SHOWCASE_GAP;
	}

	return placed;
}

function mapKeyToKind(key: keyof ShowcasePayload): AiResultKind {
	if (key === "diagram") return "diagram";
	return key as AiResultKind;
}

function mergeSummaries(sections: ShowcaseSection[]) {
	const summary: Record<string, number> = { tools: sections.length };
	for (const section of sections) {
		summary[`${section.kind}Count`] = 1;
		for (const [key, value] of Object.entries(section.summary)) {
			summary[key] = (summary[key] ?? 0) + value;
		}
	}
	return summary;
}

/** Baut aus showcase-JSON oder mehreren Top-Level-Tool-Feldern ein kombiniertes Board. */
export function buildShowcaseFromPayload(
	raw: Record<string, unknown>,
): AiGenerationResult {
	const payload: ShowcasePayload = { ...raw };

	if (payload.diagram == null && payload.elements != null) {
		payload.diagram = { elements: payload.elements };
	}

	const sections: ShowcaseSection[] = [];
	for (const key of SHOWCASE_TOOL_KEYS) {
		const value = payload[key];
		if (value == null) continue;
		const section = buildSection(key, key === "diagram" ? value : value);
		if (section) sections.push(section);
	}

	if (sections.length === 0) {
		throw new Error("Showcase enthielt keine gültigen Tool-Daten.");
	}

	return {
		elements: layoutShowcaseSections(sections),
		resultKind: sections.length === 1 ? sections[0]?.kind : "showcase",
		summary: mergeSummaries(sections),
	};
}

/** Fallback wenn das LLM trotz Anfrage nur ein Tool liefert — vollständige Demo mit Dummy-Daten. */
export function buildIntegrationShowcaseFallback(): AiGenerationResult {
	const payload: ShowcasePayload = {
		kanban: {
			lists: [
				{
					name: "Backlog",
					cards: [
						{
							title: "API-Integration testen",
							description: "AI-Showcase auf dem Board verifizieren",
							priority: "high",
							checklist: [
								{ text: "Alle Tools erzeugen" },
								{ text: "Layout prüfen" },
							],
						},
						{ title: "UX-Feedback sammeln", priority: "medium" },
					],
				},
				{
					name: "In Arbeit",
					cards: [
						{
							title: "Demo-Daten verfeinern",
							description: "Realistische Beispielinhalte",
							priority: "medium",
						},
					],
				},
				{
					name: "Review",
					cards: [{ title: "Stakeholder-Review", priority: "low" }],
				},
				{ name: "Fertig", cards: [{ title: "Board-Setup", priority: "low" }] },
			],
		},
		mindmap: {
			root: "Produkt-Launch",
			branches: [
				{
					title: "Marketing",
					direction: "right",
					children: [{ title: "Landingpage" }, { title: "Social Media" }],
				},
				{
					title: "Technik",
					direction: "right",
					children: [{ title: "Backend" }, { title: "Design System" }],
				},
				{
					title: "Risiken",
					direction: "left",
					children: [{ title: "Timeline" }],
				},
			],
		},
		flowchart: {
			nodes: [
				{ id: "start", kind: "start", text: "Idee" },
				{ id: "plan", kind: "step", text: "Planen" },
				{ id: "check", kind: "decision", text: "Freigegeben?" },
				{ id: "build", kind: "step", text: "Umsetzen" },
				{ id: "done", kind: "end", text: "Launch" },
			],
			edges: [
				{ from: "start", to: "plan" },
				{ from: "plan", to: "check" },
				{ from: "check", to: "build", branch: "yes", label: "Ja" },
				{ from: "check", to: "plan", branch: "no", label: "Nein" },
				{ from: "build", to: "done" },
			],
		},
		stickyNotes: {
			notes: [
				{ text: "Kundenfeedback einholen", color: "#FFF3BF" },
				{ text: "MVP definieren", color: "#D3F9D8" },
				{ text: "Design Review", color: "#D0EBFF" },
				{ text: "Launch-Datum fixieren", color: "#FFD6E0" },
			],
		},
		retrospective: {
			celebrate: ["Gutes Team-Tempo", "Klare Prioritäten"],
			friction: ["Zu wenig Testzeit", "Unklare Anforderungen"],
			commitment: ["Wöchentliche Reviews", "Bessere Docs"],
		},
		swot: {
			strengths: ["Starkes Team", "Flexible Architektur"],
			weaknesses: ["Begrenztes Budget"],
			opportunities: ["Neuer Markt", "AI-Features"],
			threats: ["Wettbewerb", "Zeitdruck"],
		},
		frames: {
			frames: [
				{ label: "Phase 1 — Discovery", width: 360, height: 220 },
				{ label: "Phase 2 — Delivery", width: 360, height: 220 },
			],
		},
		diagram: {
			elements: [
				{
					type: "rectangle",
					x: 0,
					y: 0,
					width: 140,
					height: 56,
					text: "Input",
					fill: "#E7F5FF",
				},
				{
					type: "arrow",
					x: 160,
					y: 28,
					width: 80,
					height: 0,
					stroke: "#495057",
				},
				{
					type: "diamond",
					x: 260,
					y: 0,
					width: 72,
					height: 72,
					text: "?",
					fill: "#FFF3BF",
				},
				{
					type: "ellipse",
					x: 360,
					y: 8,
					width: 120,
					height: 56,
					text: "Output",
					fill: "#D3F9D8",
				},
			],
		},
	};

	return buildShowcaseFromPayload(payload as Record<string, unknown>);
}
