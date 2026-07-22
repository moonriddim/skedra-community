import assert from "node:assert/strict";
import test from "node:test";
import {
	applyCanvasElementUpdates,
	createBaseCanvasElement,
	normalizeCanvasElementStackIndexes,
	sortCanvasElements,
} from "@skedra/canvas-core";
import { buildMcpLayerUpdates } from "./layer-order.js";

function createLayeredElements() {
	return normalizeCanvasElementStackIndexes(
		["back", "middle", "front"].map((id, index) =>
			createBaseCanvasElement(
				{ createId: () => id, stroke: "#111111" },
				{
					type: "rectangle",
					x: index * 20,
					y: 0,
					width: 40,
					height: 40,
				},
			),
		),
	);
}

test("bring_to_front moves selected MCP elements to the top layer", () => {
	const elements = createLayeredElements();
	const originalRest = sortCanvasElements(elements)
		.map((element) => element.id)
		.filter((id) => id !== "back");
	const updates = buildMcpLayerUpdates(elements, ["back"], "bring_to_front");
	const ordered = sortCanvasElements(
		applyCanvasElementUpdates(elements, updates),
	);

	assert.deepEqual(
		ordered.map((element) => element.id),
		[...originalRest, "back"],
	);
});

test("layer operations reject unknown element ids instead of silently drifting", () => {
	assert.throws(
		() =>
			buildMcpLayerUpdates(
				createLayeredElements(),
				["missing"],
				"send_to_back",
			),
		/Canvas-Elemente nicht gefunden: missing/u,
	);
});
