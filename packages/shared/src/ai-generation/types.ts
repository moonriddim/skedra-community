import type { AddCanvasElementInput } from "../canvas-api";

/** Alle Skedra-Canvas-Tools die die AI erzeugen kann. */
export type AiResultKind =
	| "kanban"
	| "mindmap"
	| "flowchart"
	| "stickyNotes"
	| "retrospective"
	| "swot"
	| "frames"
	| "diagram"
	| "showcase";

export type AiGenerationResult = {
	elements: AddCanvasElementInput[];
	resultKind: AiResultKind;
	summary?: Record<string, number>;
};

export function formatAssistantContent(result: AiGenerationResult): string {
	switch (result.resultKind) {
		case "kanban":
			return `kanban:${result.summary?.lists ?? 0}:${result.summary?.cards ?? 0}`;
		case "mindmap":
			return `mindmap:${result.summary?.nodes ?? 0}`;
		case "flowchart":
			return `flowchart:${result.summary?.nodes ?? 0}:${result.summary?.edges ?? 0}`;
		case "stickyNotes":
			return `stickyNotes:${result.summary?.notes ?? 0}`;
		case "retrospective":
			return `retrospective:${result.summary?.sections ?? 0}:${result.summary?.notes ?? 0}`;
		case "swot":
			return `swot:${result.summary?.quadrants ?? 0}:${result.summary?.notes ?? 0}`;
		case "frames":
			return `frames:${result.summary?.frames ?? 0}`;
		case "showcase":
			return `showcase:${result.summary?.tools ?? 0}`;
		default:
			return `diagram:${result.elements.length}`;
	}
}
