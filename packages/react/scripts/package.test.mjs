import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

test("package root exports the canvas component and SDK factories", async () => {
	const sdk = await import("@skedra/react");

	assert.ok(sdk.SkedraCanvas);
	assert.equal(typeof sdk.createSkedraTemplateElements, "function");
	assert.equal(typeof sdk.createSkedraStickyNoteElement, "function");
	assert.deepEqual([...sdk.SKEDRA_SDK_TOOL_IDS].sort(), [
		"arrow",
		"diamond",
		"ellipse",
		"eraser",
		"eyedropper",
		"frame",
		"freehand",
		"kanban",
		"laser",
		"lasso",
		"line",
		"mindmap",
		"pan",
		"rectangle",
		"select",
		"sticky-note",
		"text",
	]);
});

test("factories subpath creates full canvas SDK elements", async () => {
	const factories = await import("@skedra/react/factories");

	const note = factories.createSkedraStickyNoteElement({
		x: 10,
		y: 20,
		text: "Hello",
	});
	assert.equal(note.customData?.skedraType, "sticky-note");

	const board = factories.createSkedraKanbanBoardElements({ x: 0, y: 0 });
	assert.ok(
		board.some((element) => element.customData?.skedraType === "kanban-list"),
	);
	assert.ok(
		board.some((element) => element.customData?.skedraType === "kanban-card"),
	);

	const mindmap = factories.createSkedraMindmapElements({ x: 0, y: 0 });
	assert.ok(
		mindmap.some(
			(element) => element.customData?.skedraType === "mindmap-node",
		),
	);
	assert.ok(
		mindmap.some(
			(element) => element.customData?.skedraType === "mindmap-edge",
		),
	);

	assert.deepEqual(
		factories.SKEDRA_TEMPLATES.map((template) => template.id).sort(),
		["flowchart", "kanban", "mindmap", "retrospective", "swot"],
	);
});

test("workspace hook subpath exposes status-only integration contracts", async () => {
	const hooks = await import("@skedra/react/workspace-hooks");

	assert.deepEqual(hooks.SKEDRA_WORKSPACE_CALL_DISABLED, {
		isInCall: false,
		isMuted: false,
		isSpeaking: false,
		isScreenSharing: false,
		roomUrl: null,
	});
});

test("published runtime and declarations are self-contained", () => {
	for (const filename of readdirSync("dist")) {
		if (!filename.endsWith(".js") && !filename.endsWith(".d.ts")) continue;
		const source = readFileSync(`dist/${filename}`, "utf8");
		assert.doesNotMatch(source, /@skedra\/canvas-(?:core|react)/u, filename);
	}
});
