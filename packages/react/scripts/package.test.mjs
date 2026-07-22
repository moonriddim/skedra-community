import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

test("package root exports the canvas component and SDK factories", async () => {
	const sdk = await import("@skedra/react");

	assert.ok(sdk.SkedraCanvas);
	assert.equal(
		sdk.CanvasEditor,
		sdk.SkedraCanvas,
		"the public SDK must expose the shared editor entry point",
	);
	assert.equal(typeof sdk.createSkedraTemplateElements, "function");
	assert.equal(typeof sdk.createSkedraGanttChartElements, "function");
	assert.equal(typeof sdk.createSkedraSequenceDiagramElements, "function");
	assert.equal(
		typeof sdk.createSkedraVisualSequenceDiagramElements,
		"function",
	);
	assert.equal(typeof sdk.createSkedraStickyNoteElement, "function");
	assert.equal(typeof sdk.createSkedraWireframeComponentElements, "function");
	assert.equal(typeof sdk.createSkedraWireframePresetElements, "function");
	assert.equal(typeof sdk.exportSkedraFrame, "function");
	assert.equal(typeof sdk.getSkedraFrameExportFilename, "function");
	assert.equal(
		sdk.getSkedraFrameExportFilename({ frameLabel: "Login Screen" }, "png"),
		"login-screen.png",
	);
	assert.equal(typeof sdk.SkedraLayerPanel, "function");
	assert.equal(typeof sdk.getSkedraLayerReorderUpdates, "function");
	assert.equal(typeof sdk.SkedraContextMenu, "function");
	assert.equal(typeof sdk.SkedraSnapMenu, "function");
	assert.equal(typeof sdk.SkedraWireframePanel, "function");
	assert.equal(typeof sdk.SkedraGanttPanel, "function");
	assert.deepEqual(
		Object.values(sdk.SKEDRA_WIREFRAME_COMPONENT_CATEGORIES).flat().toSorted(),
		[...sdk.SKEDRA_WIREFRAME_COMPONENT_IDS].toSorted(),
	);
	assert.deepEqual([...sdk.SKEDRA_SDK_TOOL_IDS].sort(), [
		"arrow",
		"cloud",
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
		"triangle",
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

	const gantt = factories.createSkedraGanttChartElements({
		x: 0,
		y: 0,
		startDate: "2026-07-13",
		tasks: [
			{ id: "build", title: "Build", startDay: 0, durationDays: 5 },
			{
				id: "ship",
				title: "Ship",
				startDay: 6,
				durationDays: 1,
				milestone: true,
			},
		],
		dependencies: [{ fromTaskId: "build", toTaskId: "ship" }],
	});
	assert.equal(
		gantt.filter((element) => element.customData?.skedraType === "gantt-task")
			.length,
		2,
	);
	assert.ok(
		gantt.some(
			(element) => element.customData?.skedraType === "gantt-dependency",
		),
	);

	const sequence = factories.createSkedraSequenceDiagramElements({
		x: 0,
		y: 0,
		source: `sequenceDiagram
    actor User
    participant API
    User->>API: Request
    API-->>User: Response`,
	});
	assert.equal(
		sequence.filter(
			(element) => element.customData?.sequenceRole === "lifeline",
		).length,
		2,
	);
	assert.equal(
		sequence.filter((element) => element.customData?.sequenceRole === "message")
			.length,
		2,
	);
	const visualSequence = factories.createSkedraVisualSequenceDiagramElements({
		x: 0,
		y: 0,
		preset: "blank",
	});
	assert.equal(
		visualSequence.filter(
			(element) => element.customData?.sequenceRole === "lifeline",
		).length,
		3,
	);

	assert.deepEqual(
		factories.SKEDRA_TEMPLATES.map((template) => template.id).sort(),
		[
			"flowchart",
			"gantt",
			"kanban",
			"mindmap",
			"retrospective",
			"swot",
			"wireframe",
		],
	);

	const wireframeButton = factories.createSkedraWireframeComponentElements({
		component: "button",
		x: 0,
		y: 0,
	});
	assert.ok(wireframeButton.length > 0);
	assert.ok(
		wireframeButton.every(
			(element) => element.customData?.wireframeComponent === "button",
		),
	);
	const dashboard = factories.createSkedraWireframePresetElements({
		preset: "dashboard",
		x: 0,
		y: 0,
	});
	assert.ok(dashboard.some((element) => element.type === "frame"));
});

test("shared productivity panels are available from the public SDK", async () => {
	const React = await import("react");
	const { renderToStaticMarkup } = await import("react-dom/server");
	const panels = await import("@skedra/react/editor-panels");
	const factories = await import("@skedra/react/factories");
	const frame = factories.createSkedraFrameElement({
		x: 0,
		y: 0,
		label: "Screen",
	});
	const elements = new Map([[frame.id, frame]]);
	const noop = () => undefined;

	const layers = renderToStaticMarkup(
		React.createElement(panels.SkedraLayerPanel, {
			elements,
			selectedIds: new Set([frame.id]),
			onSelect: noop,
			onToggleLock: noop,
			onReorder: noop,
		}),
	);
	const wireframes = renderToStaticMarkup(
		React.createElement(panels.SkedraWireframePanel, {
			elements,
			selectedElements: [],
			onInsertPreset: noop,
			onInsertComponent: noop,
		}),
	);
	const gantt = renderToStaticMarkup(
		React.createElement(panels.SkedraGanttPanel, {
			document: {
				title: "Launch plan",
				startDate: "2026-07-13",
				dayCount: 28,
				dayWidth: 28,
				labelWidth: 260,
				rowHeight: 58,
				headerHeight: 56,
				showToday: true,
				tasks: [
					{
						id: "build",
						title: "Build",
						startDay: 0,
						durationDays: 5,
						progress: 40,
						status: "active",
						milestone: false,
						critical: true,
					},
				],
				dependencies: [],
				appearance: {
					background: "#fff",
					headerFill: "#eee",
					rowFill: "#fff",
					alternateRowFill: "#fafafa",
					gridStroke: "#ddd",
					textColor: "#111",
					mutedTextColor: "#666",
					dependencyStroke: "#777",
				},
			},
			onApply: noop,
		}),
	);

	assert.match(layers, /Layers/u);
	assert.match(wireframes, /Wireframes/u);
	assert.match(wireframes, /Blank Desktop/u);
	assert.match(gantt, /Build/u);
	assert.match(gantt, /More row options/u);
	assert.doesNotMatch(gantt, /Critical path/u);
	const otherFrame = factories.createSkedraFrameElement({
		x: 300,
		y: 0,
		label: "Other",
	});
	const above = panels.getSkedraLayerReorderUpdates(
		[frame, otherFrame],
		otherFrame.id,
		frame.id,
		"above",
	);
	const below = panels.getSkedraLayerReorderUpdates(
		[frame, otherFrame],
		otherFrame.id,
		frame.id,
		"below",
	);
	assert.equal(above.length + below.length, 1);
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
		"toggle-object-snap",
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

test("SDK Excalidraw files and clipboard payloads round-trip as editable elements", async () => {
	const sdk = await import("@skedra/react");
	const element = sdk.createSkedraStickyNoteElement({
		x: 12,
		y: 24,
		text: "Excalidraw bridge",
	});
	const scene = sdk.createExcalidrawFile({
		elements: [element],
		viewport: { x: 10, y: 20, zoom: 1.5 },
	});
	assert.equal(scene.type, "excalidraw");
	assert.equal(scene.elements[1].type, "text");
	const imported = sdk.parseExcalidrawFile(sdk.serializeExcalidrawFile(scene));
	assert.equal(imported.elements[0].text, "Excalidraw bridge");
	const clipboard = JSON.parse(sdk.serializeSkedraClipboard([element]));
	assert.equal(clipboard.type, sdk.SKEDRA_CLIPBOARD_TYPE);
	assert.equal(clipboard.version, 1);
	const pasted = sdk.parseSkedraClipboard(JSON.stringify(clipboard));
	assert.equal(pasted[0].text, "Excalidraw bridge");
	const excalidrawClipboard = JSON.parse(
		sdk.serializeExcalidrawClipboard([element]),
	);
	assert.equal(excalidrawClipboard.type, "excalidraw/clipboard");
	assert.equal(excalidrawClipboard.elements[0].customData.skedra.version, 1);
	assert.equal(
		sdk.parseSkedraClipboard(JSON.stringify(excalidrawClipboard))[0].text,
		"Excalidraw bridge",
	);
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
			canvasBackground: "#f0fdf4",
			initialTool: "line",
			initialPathDrawMode: "multi",
			initialPathMode: "curve",
		}),
	);
	assert.match(markup, /aria-label="Arrow"/u);
	assert.match(markup, /aria-label="Grid"/u);
	assert.match(markup, /aria-label="Import and export"/u);
	assert.match(markup, /aria-label="Sequence diagram"/u);
	assert.match(markup, /aria-label="Path draw mode"/u);
	assert.match(markup, /aria-label="Path style"/u);
	assert.match(markup, /<option value="multi" selected="">Multi-line/u);
	assert.match(markup, /<option value="curve" selected="">Curves/u);
	assert.match(markup, /data-skedra-elements="true"/u);
	assert.match(markup, /data-skedra-ui="grid"/u);
	assert.match(markup, /data-skedra-ui="snap-overlay"/u);
	assert.match(markup, /background-color:#f0fdf4/u);
});

test("visual export bounds ignore UI layers and restore live styles", async () => {
	const { measureSkedraExportBounds } = await import("@skedra/react/exporters");
	const uiElements = [
		{
			style: {
				display: "inline",
				removeProperty() {
					this.display = "";
				},
			},
		},
		{
			style: {
				display: "",
				removeProperty() {
					this.display = "";
				},
			},
		},
	];
	const bounds = { x: 10, y: 20, width: 300, height: 200 };
	const layer = {
		querySelectorAll(selector) {
			assert.match(selector, /data-skedra-ui/u);
			return uiElements;
		},
		getBBox() {
			assert.deepEqual(
				uiElements.map((element) => element.style.display),
				["none", "none"],
			);
			return bounds;
		},
	};
	assert.equal(measureSkedraExportBounds(layer), bounds);
	assert.deepEqual(
		uiElements.map((element) => element.style.display),
		["inline", ""],
	);
});

test("published runtime and declarations are self-contained", () => {
	for (const filename of readdirSync("dist")) {
		if (!filename.endsWith(".js") && !filename.endsWith(".d.ts")) continue;
		const source = readFileSync(`dist/${filename}`, "utf8");
		assert.doesNotMatch(
			source,
			/@skedra\/canvas-(?:core|editor|io|react)/u,
			filename,
		);
	}
	const css = readFileSync("dist/style.css", "utf8");
	assert.doesNotMatch(css, /@skedra\/canvas-editor/u);
	assert.match(css, /\.canvas-editor__text-overlay/u);
	assert.match(css, /\.canvas-editor__layers/u);
	assert.match(css, /\.canvas-editor__snap-menu/u);
	assert.match(css, /\.canvas-editor__wireframe-panel/u);
	assert.match(css, /\.canvas-editor__sequence-panel/u);
	assert.match(css, /\.skedra-sdk__properties/u);
});
