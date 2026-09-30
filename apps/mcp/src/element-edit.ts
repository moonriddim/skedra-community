import type { CanvasElement, CanvasElementUpdate } from "@skedra/canvas-core";
import { canvasElementVisualUpdateSchema } from "@skedra/shared";
import { z } from "zod";
import { mcpCanvasPointsSchema } from "./canvas-points.js";

const visualChangesSchema = canvasElementVisualUpdateSchema
	.innerType()
	.extend({ points: mcpCanvasPointsSchema.optional() })
	.refine((value) => Object.keys(value).length > 0, {
		message: "Mindestens ein Feld zum Aktualisieren erforderlich",
	});

export const elementEditSchema = z
	.object({
		elementId: z.string().min(1),
		changes: visualChangesSchema,
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
