/**
 * Zentrale AI-Payload-Verarbeitung fuer alle Skedra-Canvas-Tools.
 */

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
import { enrichPromptWithIntent } from "./prompt-intent";
import {
	buildIntegrationShowcaseFallback,
	buildShowcaseFromPayload,
	countShowcaseToolKeys,
} from "./showcase-ai";
import {
	aiStickyNotesSchema,
	buildStickyNoteElementsFromAi,
} from "./sticky-notes-ai";
import {
	aiGanttChartEditSchema,
	aiGanttChartSchema,
	aiSequenceDiagramEditSchema,
	aiSequenceDiagramSchema,
	buildGanttChartElementsFromAi,
	buildSequenceDiagramElementsFromAi,
} from "./structured-diagrams-ai";
import {
	aiRetrospectiveSchema,
	aiSwotSchema,
	buildRetrospectiveElementsFromAi,
	buildSwotElementsFromAi,
} from "./template-boards-ai";
import { type AiGenerationResult, formatAssistantContent } from "./types";

export {
	AI_SYSTEM_PROMPT,
	AI_SHOWCASE_APPENDIX,
	detectMultiToolShowcaseIntent,
	detectPromptIntent,
	enrichPromptWithIntent,
} from "./prompt-intent";
export {
	buildIntegrationShowcaseFallback,
	buildShowcaseFromPayload,
} from "./showcase-ai";
export {
	formatAssistantContent,
	type AiGenerationResult,
	type AiResultKind,
} from "./types";
export {
	aiGanttChartSchema,
	aiGanttChartContextSchema,
	aiGanttChartEditActionSchema,
	aiGanttChartEditSchema,
	aiSequenceDiagramContextSchema,
	aiSequenceDiagramEditActionSchema,
	aiSequenceDiagramEditSchema,
	aiSequenceDiagramSchema,
	buildGanttChartElementsFromAi,
	buildSequenceDiagramElementsFromAi,
	type AiSequenceDiagramContext,
	type AiSequenceDiagramEditInput,
	type AiGanttChartContext,
	type AiGanttChartEditInput,
} from "./structured-diagrams-ai";

export function parseAiCanvasPayload(parsed: unknown): AiGenerationResult {
	if (!parsed || typeof parsed !== "object") {
		throw new Error("LLM-Antwort enthielt kein gültiges JSON-Objekt");
	}

	const payload = parsed as Record<string, unknown>;

	if (payload.showcase != null && typeof payload.showcase === "object") {
		return buildShowcaseFromPayload(
			payload.showcase as Record<string, unknown>,
		);
	}

	if (countShowcaseToolKeys(payload) >= 2) {
		return buildShowcaseFromPayload(payload);
	}

	if (payload.kanban != null) {
		const board = aiKanbanBoardSchema.parse(payload.kanban);
		const elements = buildKanbanElementsFromAi(board);
		const stats = countKanbanStats(elements);
		return {
			elements,
			resultKind: "kanban",
			summary: { lists: stats.lists, cards: stats.cards },
		};
	}

	if (payload.mindmap != null) {
		const board = aiMindmapSchema.parse(payload.mindmap);
		const { elements, nodeCount } = buildMindmapElementsFromAi(board);
		return {
			elements,
			resultKind: "mindmap",
			summary: { nodes: nodeCount },
		};
	}

	if (payload.flowchart != null) {
		const board = aiFlowchartSchema.parse(payload.flowchart);
		const { elements, nodeCount, edgeCount } =
			buildFlowchartElementsFromAi(board);
		return {
			elements,
			resultKind: "flowchart",
			summary: { nodes: nodeCount, edges: edgeCount },
		};
	}

	if (payload.stickyNotes != null) {
		const board = aiStickyNotesSchema.parse(payload.stickyNotes);
		const { elements, noteCount } = buildStickyNoteElementsFromAi(board);
		return {
			elements,
			resultKind: "stickyNotes",
			summary: { notes: noteCount },
		};
	}

	if (payload.retrospective != null) {
		const board = aiRetrospectiveSchema.parse(payload.retrospective);
		const { elements, sectionCount, noteCount } =
			buildRetrospectiveElementsFromAi(board);
		return {
			elements,
			resultKind: "retrospective",
			summary: { sections: sectionCount, notes: noteCount },
		};
	}

	if (payload.swot != null) {
		const board = aiSwotSchema.parse(payload.swot);
		const { elements, quadrantCount, noteCount } =
			buildSwotElementsFromAi(board);
		return {
			elements,
			resultKind: "swot",
			summary: { quadrants: quadrantCount, notes: noteCount },
		};
	}

	if (payload.frames != null) {
		const board = aiFramesSchema.parse(payload.frames);
		const { elements, frameCount } = buildFrameElementsFromAi(board);
		return {
			elements,
			resultKind: "frames",
			summary: { frames: frameCount },
		};
	}

	if (payload.sequenceDiagram != null) {
		const diagram = aiSequenceDiagramSchema.parse(payload.sequenceDiagram);
		const { elements, participantCount, messageCount } =
			buildSequenceDiagramElementsFromAi(diagram);
		return {
			elements,
			resultKind: "sequenceDiagram",
			summary: { participants: participantCount, messages: messageCount },
		};
	}

	if (payload.sequenceDiagramEdit != null) {
		const sequenceDiagramEdit = aiSequenceDiagramEditSchema.parse(
			payload.sequenceDiagramEdit,
		);
		return {
			elements: [],
			resultKind: "sequenceDiagramEdit",
			sequenceDiagramEdit,
		};
	}

	if (payload.gantt != null) {
		const chart = aiGanttChartSchema.parse(payload.gantt);
		const { elements, taskCount, milestoneCount } =
			buildGanttChartElementsFromAi(chart);
		return {
			elements,
			resultKind: "gantt",
			summary: { tasks: taskCount, milestones: milestoneCount },
		};
	}

	if (payload.ganttEdit != null) {
		const ganttEdit = aiGanttChartEditSchema.parse(payload.ganttEdit);
		return {
			elements: [],
			resultKind: "ganttEdit",
			ganttEdit,
		};
	}

	if (Array.isArray(payload.elements)) {
		const elements = parseDiagramElementsFromAi(payload);
		return {
			elements,
			resultKind: "diagram",
			summary: { elements: elements.length },
		};
	}

	throw new Error(
		"LLM-Antwort muss eines enthalten: kanban, mindmap, flowchart, stickyNotes, retrospective, swot, frames, sequenceDiagram, sequenceDiagramEdit, gantt, ganttEdit oder elements.",
	);
}
