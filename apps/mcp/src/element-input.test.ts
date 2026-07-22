import assert from "node:assert/strict";
import test from "node:test";
import {
	createMcpCanvasElement,
	elementInputSchema,
	orderMcpCanvasElementInputs,
} from "./element-input.js";

const defaults = { createId: () => "mcp-path", stroke: "#111111" };

for (const type of ["line", "arrow"] as const) {
	test(`creates a renderable MCP ${type} with local path points`, () => {
		const element = createMcpCanvasElement(defaults, {
			type,
			x: 20,
			y: 30,
			width: 140,
			height: 60,
		});

		assert.deepEqual(element.points, [
			[0, 0],
			[140, 60],
		]);
		assert.equal(element.width, 140);
		assert.equal(element.height, 60);
	});
}

test("does not add path points to bounded MCP shapes", () => {
	const element = createMcpCanvasElement(defaults, {
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 80,
	});

	assert.equal(element.points, undefined);
});

test("shares divided-pyramid validation and mapping with REST and Web", () => {
	const input = elementInputSchema.parse({
		type: "triangle",
		x: 0,
		y: 0,
		width: 120,
		height: 100,
		pyramidSections: 4,
	});
	assert.equal(createMcpCanvasElement(defaults, input).pyramidSections, 4);
	assert.equal(
		elementInputSchema.safeParse({ ...input, pyramidSections: 13 }).success,
		false,
	);
});

test("preserves visual styling needed for polished MCP diagrams", () => {
	const input = elementInputSchema.parse({
		type: "text",
		x: 10,
		y: 20,
		width: 240,
		height: 48,
		text: "Architecture",
		fontSize: 28,
		fontFamily: "Inter",
		fontWeight: "bold",
		textAlign: "center",
		textColor: "#f8fafc",
		rotation: 0.1,
		opacity: 92,
		polygonSides: 8,
		zIndex: 10,
	});
	const element = createMcpCanvasElement(defaults, input);

	assert.equal(element.fontSize, 28);
	assert.equal(element.fontFamily, "Inter");
	assert.equal(element.fontWeight, "bold");
	assert.equal(element.textAlign, "center");
	assert.equal(element.textColor, "#f8fafc");
	assert.equal(element.rotation, 0.1);
	assert.equal(element.opacity, 92);
	assert.equal(element.polygonSides, 8);
	assert.equal("zIndex" in element, false);
});

test("orders batch-local zIndex stably from back to front", () => {
	const parsed = [
		{ type: "text", x: 0, y: 0, width: 20, height: 20, text: "middle-a" },
		{ type: "rectangle", x: 0, y: 0, width: 20, height: 20, zIndex: -10 },
		{
			type: "text",
			x: 0,
			y: 0,
			width: 20,
			height: 20,
			text: "front",
			zIndex: 10,
		},
		{ type: "text", x: 0, y: 0, width: 20, height: 20, text: "middle-b" },
	].map((input) => elementInputSchema.parse(input));

	const ordered = orderMcpCanvasElementInputs(parsed);

	assert.deepEqual(
		ordered.map((input) => input.text ?? input.type),
		["rectangle", "middle-a", "middle-b", "front"],
	);
});
