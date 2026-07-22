import {
	type CanvasElement,
	type CanvasElementUpdate,
	buildBringForwardUpdates,
	buildBringToFrontUpdates,
	buildSendBackwardUpdates,
	buildSendToBackUpdates,
} from "@skedra/canvas-core";
import { z } from "zod";

export const layerOperationSchema = z.enum([
	"bring_to_front",
	"bring_forward",
	"send_backward",
	"send_to_back",
]);

export type LayerOperation = z.infer<typeof layerOperationSchema>;

export function buildMcpLayerUpdates(
	elements: Iterable<CanvasElement>,
	elementIds: readonly string[],
	operation: LayerOperation,
): CanvasElementUpdate[] {
	const current = Array.from(elements);
	const currentIds = new Set(current.map((element) => element.id));
	const missingIds = elementIds.filter((id) => !currentIds.has(id));
	if (missingIds.length > 0) {
		throw new Error(`Canvas-Elemente nicht gefunden: ${missingIds.join(", ")}`);
	}

	const selectedIds = new Set(elementIds);
	switch (operation) {
		case "bring_to_front":
			return buildBringToFrontUpdates(current, selectedIds);
		case "bring_forward":
			return buildBringForwardUpdates(current, selectedIds);
		case "send_backward":
			return buildSendBackwardUpdates(current, selectedIds);
		case "send_to_back":
			return buildSendToBackUpdates(current, selectedIds);
	}
}
