import assert from "node:assert/strict";
import test from "node:test";
import {
	applyCanvasElementUpdates,
	createBaseCanvasElement,
} from "@skedra/canvas-core";
import { buildMcpElementUpdates, elementEditSchema } from "./element-edit.js";

const element = createBaseCanvasElement(
	{ createId: () => "editable", stroke: "#111111" },
	{ type: "text", x: 10, y: 20, width: 200, height: 40, text: "before" },
);

test("general MCP edits update geometry, text and complete visual styling", () => {
	const edit = elementEditSchema.parse({
		elementId: element.id,
		changes: {
			x: 50,
			y: 60,
			width: 260,
			text: "after",
			fontSize: 28,
			fontFamily: "Inter",
			fontWeight: "bold",
			textColor: "#f8fafc",
			fill: "#0f172a",
			strokeStyle: "dashed",
			cornerRadius: 12,
			opacity: 90,
		},
	});
	const [updated] = applyCanvasElementUpdates(
		[element],
		buildMcpElementUpdates([element], [edit]),
	);

	assert.equal(updated.x, 50);
	assert.equal(updated.y, 60);
	assert.equal(updated.width, 260);
	assert.equal(updated.text, "after");
	assert.equal(updated.fontSize, 28);
	assert.equal(updated.fontFamily, "Inter");
	assert.equal(updated.fontWeight, "bold");
	assert.equal(updated.textColor, "#f8fafc");
	assert.equal(updated.fill, "#0f172a");
	assert.equal(updated.strokeStyle, "dashed");
	assert.equal(updated.cornerRadius, 12);
	assert.equal(updated.opacity, 90);
});

test("general MCP edits reject empty changes and unknown element ids", () => {
	assert.equal(
		elementEditSchema.safeParse({ elementId: element.id, changes: {} }).success,
		false,
	);
	assert.throws(
		() =>
			buildMcpElementUpdates(
				[element],
				[{ elementId: "missing", changes: { x: 10 } }],
			),
		/Canvas-Elemente nicht gefunden: missing/u,
	);
});
