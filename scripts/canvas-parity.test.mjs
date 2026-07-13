import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

function read(relativePath) {
	return fs.readFileSync(
		new URL(`../${relativePath}`, import.meta.url),
		"utf8",
	);
}

test("web app and SDK activate the same shared renderer", () => {
	const webRenderer = read(
		"apps/web/src/components/canvas/canvas-renderer.tsx",
	);
	const sdkCanvas = read("packages/react/src/skedra-canvas.tsx");

	assert.match(webRenderer, /@skedra\/canvas-react/u);
	assert.match(sdkCanvas, /<CanvasElementRenderer/u);
	assert.doesNotMatch(sdkCanvas, /\bSdkElementShape\b/u);
});

test("web app and SDK create every SDK template through canvas-core", () => {
	const webTemplates = [
		"apps/web/src/lib/templates/index.ts",
		"apps/web/src/lib/templates/mindmap.ts",
		"apps/web/src/lib/templates/flowchart.ts",
		"apps/web/src/lib/templates/retrospective.ts",
		"apps/web/src/lib/templates/swot.ts",
	]
		.map(read)
		.join("\n");
	const sdkFactories = read("packages/react/src/factories.ts");

	assert.match(webTemplates, /createCanvasTemplateElements/u);
	assert.match(sdkFactories, /createCanvasTemplateElements/u);
	assert.doesNotMatch(webTemplates, /createFlowchartNode\s*\(/u);
	assert.doesNotMatch(sdkFactories, /createFlowchartNode\s*\(/u);
});

test("web app and SDK execute the same mindmap mutations", () => {
	const webMindmapTool = read(
		"apps/web/src/components/canvas/hooks/use-mindmap-canvas-tool.ts",
	);
	const sdkCanvas = read("packages/react/src/skedra-canvas.tsx");

	assert.match(webMindmapTool, /planMindmapChildMutation/u);
	assert.match(webMindmapTool, /planMindmapSiblingMutation/u);
	assert.match(webMindmapTool, /executeCanvasMutationPlan/u);
	assert.match(sdkCanvas, /planMindmapChildMutation/u);
	assert.match(sdkCanvas, /planMindmapSiblingMutation/u);
	assert.match(sdkCanvas, /applyCanvasMutationPlan/u);
});

test("web app and SDK share generic editor operations", () => {
	const webOperations = [
		"apps/web/src/hooks/use-canvas-store.ts",
		"apps/web/src/hooks/use-canvas-keyboard/history-delete.ts",
		"apps/web/src/hooks/use-canvas-pointer/geometry-helpers.ts",
		"apps/web/src/hooks/use-canvas-pointer/pointer-coords.ts",
		"apps/web/src/hooks/use-canvas-pointer/pointer-drop-updates.ts",
		"apps/web/src/hooks/use-canvas-pointer/pointer-selection.ts",
		"apps/web/src/hooks/use-canvas-pointer/preview-builders.ts",
		"apps/web/src/components/canvas/hooks/text-element-updates.ts",
		"apps/web/src/components/canvas/hooks/use-kanban-canvas-tool.ts",
	]
		.map(read)
		.join("\n");
	const sdkCanvas = read("packages/react/src/skedra-canvas.tsx");

	for (const operation of [
		"buildCanvasDrawingElement",
		"buildKanbanDropUpdates",
		"buildCanvasTextUpdate",
		"collectCanvasSelectionRectIds",
		"getCanvasKeyboardCommand",
		"planKanbanCardInsertion",
		"resizeCanvasElement",
		"zoomCanvasViewportAtPoint",
	]) {
		assert.match(webOperations, new RegExp(operation, "u"));
		assert.match(sdkCanvas, new RegExp(operation, "u"));
	}

	assert.match(
		read("packages/canvas-core/src/editor-operations.test.ts"),
		/mutation plans produce identical local and adapter-backed state/u,
	);
});
