import type { CanvasElement, CanvasElementUpdate } from "@skedra/canvas-core";
import { canvasElementVisualUpdateSchema } from "@skedra/shared";
import { z } from "zod";

export const elementEditSchema = z
	.object({
		elementId: z.string().min(1),
		changes: canvasElementVisualUpdateSchema,
	})
	.strict();

export type McpCanvasElementEdit = z.infer<typeof elementEditSchema>;

export function buildMcpElementUpdates(
	elements: Iterable<CanvasElement>,
	edits: readonly McpCanvasElementEdit[],
): CanvasElementUpdate[] {
	const currentIds = new Set(Array.from(elements, (element) => element.id));
	const missingIds = Array.from(
		new Set(
			edits
				.map((edit) => edit.elementId)
				.filter((elementId) => !currentIds.has(elementId)),
		),
	);
	if (missingIds.length > 0) {
		throw new Error(`Canvas-Elemente nicht gefunden: ${missingIds.join(", ")}`);
	}

	return edits.map((edit) => ({
		id: edit.elementId,
		changes: edit.changes,
	}));
}
