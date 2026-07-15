import assert from "node:assert/strict";
import test from "node:test";
import { createMcpCanvasElement, elementInputSchema } from "./element-input.js";

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
