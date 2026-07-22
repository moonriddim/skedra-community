import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildExcalidrawFile,
	parseCanvasFileContents,
} from "./skedra-file-utils";

test("imports Excalidraw files with their canvas background and viewport", async () => {
	const file = await parseCanvasFileContents(
		JSON.stringify({
			type: "excalidraw",
			version: 2,
			source: "https://excalidraw.com",
			elements: [
				{
					id: "rectangle-1",
					type: "rectangle",
					x: 10,
					y: 20,
					width: 100,
					height: 60,
					strokeColor: "#111111",
					backgroundColor: "#ffffff",
				},
			],
			appState: {
				viewBackgroundColor: "#f8f9fa",
				scrollX: 12,
				scrollY: 34,
				zoom: { value: 1.5 },
			},
		}),
	);

	assert.equal(file.elements.length, 1);
	assert.equal(file.elements[0].id, "rectangle-1");
	assert.equal(file.appState?.canvasBg, "#f8f9fa");
	assert.deepEqual(file.appState?.viewport, { x: 12, y: 34, zoom: 1.5 });
});

test("builds a downloadable Excalidraw v2 scene from canvas elements", () => {
	const imported = buildExcalidrawFile(
		new Map([
			[
				"text-1",
				{
					id: "text-1",
					type: "text" as const,
					x: 0,
					y: 0,
					width: 100,
					height: 30,
					rotation: 0,
					fill: "transparent",
					stroke: "#111111",
					strokeWidth: 1,
					strokeStyle: "solid" as const,
					opacity: 100,
					locked: false,
					groupId: null,
					flipX: false,
					flipY: false,
					text: "Round trip",
					fontSize: 20,
					fontFamily: "Virgil",
				},
			],
		]),
		{ canvasBg: "#ffffff", viewport: { x: 1, y: 2, zoom: 1 } },
	);

	assert.equal(imported.type, "excalidraw");
	assert.equal(imported.version, 2);
	assert.equal(imported.elements[0].fontFamily, 1);
});
