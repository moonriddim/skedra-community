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

test("command contract exposes every shared SDK editing operation", async () => {
	const commands = await import("@skedra/react/commands");
	for (const id of [
		"undo",
		"redo",
		"copy",
		"paste",
		"group",
		"align-left",
		"distribute-horizontal",
		"bring-to-front",
		"flip-horizontal",
		"toggle-lock",
		"toggle-grid",
	]) {
		assert.ok(commands.SKEDRA_CANVAS_COMMAND_IDS.includes(id), id);
	}
});

test("SDK document encryption and decryption round-trip without host packages", async () => {
	const sdk = await import("@skedra/react");
	const element = sdk.createSkedraStickyNoteElement({
		x: 12,
		y: 24,
		text: "Secret",
	});
	const file = sdk.createSkedraFile({
		elements: [element],
		viewport: { x: 10, y: 20, zoom: 1.5 },
	});
	const encrypted = await sdk.encryptSkedraFile(
		file,
		"correct horse battery staple",
		1_000,
	);
	const decrypted = await sdk.decryptSkedraFile(
		encrypted,
		"correct horse battery staple",
	);
	assert.equal(decrypted.elements[0].text, "Secret");
	assert.deepEqual(decrypted.appState?.viewport, { x: 10, y: 20, zoom: 1.5 });
});

test("shape libraries are standalone and instantiate with new ids", async () => {
	const sdk = await import("@skedra/react/io");
	const factories = await import("@skedra/react/factories");
	const source = factories.createSkedraStickyNoteElement({
		x: 100,
		y: 200,
		text: "Library shape",
	});
	const item = sdk.createSkedraLibraryItem({
		elements: [source],
		name: "Note",
	});
	const library = sdk.createSkedraLibraryFile([item], { name: "Test" });
	const parsed = sdk.parseSkedraLibrary(JSON.stringify(library));
	const inserted = sdk.instantiateSkedraLibraryItem({
		item: parsed.items[0],
		x: 500,
		y: 600,
	});
	assert.equal(inserted.length, 1);
	assert.notEqual(inserted[0].id, source.id);
	assert.equal(inserted[0].x, 500);
	assert.equal(inserted[0].y, 600);
});

test("canvas chrome renders tools, grid, and command menus on the server", async () => {
	const React = await import("react");
	const { renderToStaticMarkup } = await import("react-dom/server");
	const { SkedraCanvas } = await import("@skedra/react");
	const markup = renderToStaticMarkup(
		React.createElement(SkedraCanvas, {
			showToolbar: true,
			showGrid: true,
		}),
	);
	assert.match(markup, /aria-label="Arrow"/u);
	assert.match(markup, /aria-label="Grid"/u);
	assert.match(markup, /aria-label="Import and export"/u);
	assert.match(markup, /data-skedra-elements="true"/u);
});

test("published runtime and declarations are self-contained", () => {
	for (const filename of readdirSync("dist")) {
		if (!filename.endsWith(".js") && !filename.endsWith(".d.ts")) continue;
		const source = readFileSync(`dist/${filename}`, "utf8");
		assert.doesNotMatch(source, /@skedra\/canvas-(?:core|react)/u, filename);
	}
});
