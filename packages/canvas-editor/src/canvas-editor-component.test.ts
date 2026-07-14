import assert from "node:assert/strict";
import test from "node:test";
import { type CanvasElement, CanvasScene } from "@skedra/canvas-core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
	CanvasEditor,
	CanvasEditorGridOverlay,
	CanvasEditorImageCropOverlay,
	CanvasEditorPropertiesPanel,
	CanvasEditorSelectionGestureOverlay,
	CanvasEditorSelectionOverlay,
	CanvasEditorSnapOverlay,
	CanvasEditorStickyNoteOverlay,
	CanvasEditorSurface,
	CanvasEditorToolbar,
	CanvasPathStartSnapIndicator,
	resolveCanvasEditorMenuKeyAction,
} from "./index";

const element: CanvasElement = {
	id: "one",
	type: "rectangle",
	x: 0,
	y: 0,
	width: 100,
	height: 80,
	rotation: 0,
	fill: "#ffffff",
	stroke: "#000000",
	strokeWidth: 2,
	strokeStyle: "solid",
	opacity: 100,
	locked: false,
	groupId: null,
	flipX: false,
	flipY: false,
};

const noop = () => undefined;

test("CanvasEditor is the shared host root", () => {
	const markup = renderToStaticMarkup(
		createElement(
			CanvasEditor,
			{
				documentAdapter: {
					kind: "test",
					getElements: () => new Map(),
					getScene: () => CanvasScene.from([]),
					createId: () => "id",
					createElement: noop,
					updateElement: noop,
					updateElements: noop,
				},
				collaboration: { enabled: false },
			},
			createElement("span", null, "surface"),
		),
	);
	assert.match(markup, /data-canvas-editor="true"/u);
	assert.match(markup, />surface</u);
});

test("properties labels consistently use the translation adapter", () => {
	const markup = renderToStaticMarkup(
		createElement(CanvasEditorPropertiesPanel, {
			selected: [element],
			translate: (key) => `translated:${key}`,
			onSetProperties: noop,
			onDelete: noop,
			onGroup: noop,
			onUngroup: noop,
			onAlign: noop,
			onDistribute: noop,
			onLayer: noop,
			onFlip: noop,
			onLock: noop,
			onCropImage: noop,
			onAddFlowchartStep: noop,
			onSetFlowchartNodeKind: noop,
			onUpdateKanbanCard: noop,
			onUpdateKanbanList: noop,
		}),
	);
	assert.match(markup, /translated:canvas\.properties\.stroke/u);
	assert.match(markup, /translated:canvas\.properties\.arrange/u);
	assert.doesNotMatch(markup, />Stroke</u);
	assert.doesNotMatch(markup, />Lock</u);
});

test("toolbar actions, menus and color controls share one renderer", () => {
	const markup = renderToStaticMarkup(
		createElement(CanvasEditorToolbar, {
			toolStrip: {
				activeTool: "select",
				onToolSelect: noop,
				renderIcon: (tool) => tool,
				includeTool: (definition) => definition.id === "select",
			},
			items: [
				{
					type: "action",
					id: "undo",
					label: "Shared undo",
					icon: "undo-icon",
					onSelect: noop,
				},
				{
					type: "menu",
					id: "export",
					label: "Shared export",
					icon: "export-icon",
					items: [{ id: "svg", label: "SVG", onSelect: noop }],
				},
				{
					type: "color",
					id: "stroke",
					label: "Shared stroke",
					value: "#000000",
					onChange: noop,
				},
			],
		}),
	);

	assert.match(markup, /role="toolbar"/u);
	assert.match(markup, /aria-label="Shared undo"/u);
	assert.match(markup, /aria-label="Shared export"/u);
	assert.match(markup, /aria-label="Shared stroke"/u);
});

test("toolbar menu keyboard navigation wraps and closes predictably", () => {
	assert.deepEqual(resolveCanvasEditorMenuKeyAction("ArrowDown", 2, 3), {
		type: "focus",
		index: 0,
	});
	assert.deepEqual(resolveCanvasEditorMenuKeyAction("ArrowUp", 0, 3), {
		type: "focus",
		index: 2,
	});
	assert.deepEqual(resolveCanvasEditorMenuKeyAction("Home", 2, 3), {
		type: "focus",
		index: 0,
	});
	assert.deepEqual(resolveCanvasEditorMenuKeyAction("End", 0, 3), {
		type: "focus",
		index: 2,
	});
	assert.deepEqual(resolveCanvasEditorMenuKeyAction("Escape", 1, 3), {
		type: "close",
		restoreFocus: true,
	});
	assert.deepEqual(resolveCanvasEditorMenuKeyAction("Tab", 1, 3), {
		type: "close",
		restoreFocus: false,
	});
});

test("surface transform and selection handles share one renderer", () => {
	const surface = renderToStaticMarkup(
		createElement(
			CanvasEditorSurface,
			{
				svgRef: { current: null },
				viewport: { x: 12, y: 18, zoom: 2 },
				activeTool: "pan",
			},
			createElement("rect", { width: 10, height: 10 }),
		),
	);
	assert.match(surface, /cursor:grab/u);
	assert.match(surface, /translate\(12, 18\) scale\(2\)/u);

	const selection = renderToStaticMarkup(
		createElement(CanvasEditorSelectionOverlay, {
			selected: [element],
			zoom: 1,
			onResizeStart: noop,
			onResizeKeyDown: noop,
			onPathPointDragStart: noop,
			onInsertPathPoint: noop,
		}),
	);
	assert.match(selection, /aria-label="Resize nw"/u);
	assert.equal((selection.match(/role="button"/gu) ?? []).length, 8);

	const gesture = renderToStaticMarkup(
		createElement(CanvasEditorSelectionGestureOverlay, {
			selectionRect: { x: 1, y: 2, width: 3, height: 4 },
			lassoPath: [
				[0, 0],
				[10, 10],
			],
			zoom: 1,
		}),
	);
	assert.match(gesture, /data-skedra-ui="selection-marquee"/u);
	assert.match(gesture, /data-skedra-ui="selection-lasso"/u);

	const grid = renderToStaticMarkup(
		createElement(CanvasEditorGridOverlay, {
			enabled: true,
			zoom: 2,
			patternId: "test-grid",
		}),
	);
	assert.match(grid, /data-skedra-ui="grid"/u);
	assert.match(grid, /id="test-grid"/u);
});

test("transient editor overlays are excluded from every visual export", () => {
	const snap = renderToStaticMarkup(
		createElement(CanvasEditorSnapOverlay, {
			guides: [{ orientation: "v", pos: 10, from: 0, to: 100 }],
			points: [],
			zoom: 1,
		}),
	);
	const pathStart = renderToStaticMarkup(
		createElement(CanvasPathStartSnapIndicator, {
			snap: { point: [10, 20], active: true },
			zoom: 1,
		}),
	);
	const crop = renderToStaticMarkup(
		createElement(CanvasEditorImageCropOverlay, {
			element,
			viewport: { x: 0, y: 0, zoom: 1 },
			onApply: noop,
			onCancel: noop,
		}),
	);
	for (const markup of [snap, pathStart, crop]) {
		assert.match(markup, /data-ui-only="true"/u);
		assert.match(markup, /data-skedra-ui=/u);
	}
});

test("flowchart directions and canvas background remain part of the shared panel", () => {
	const markup = renderToStaticMarkup(
		createElement(CanvasEditorPropertiesPanel, {
			selected: [
				{
					...element,
					customData: {
						skedraType: "flowchart-node",
						flowchartNodeKind: "decision",
					},
				},
			],
			translate: (key) => `translated:${key}`,
			canvasBackground: {
				value: "#ffffff",
				options: ["", "#ffffff"],
				onChange: noop,
			},
			flowchartInsertKind: "decision",
			onFlowchartInsertKindChange: noop,
			onAddFlowchartNodeOnSide: noop,
			onEditFlowchartNodeText: noop,
			onSetProperties: noop,
			onDelete: noop,
			onGroup: noop,
			onUngroup: noop,
			onAlign: noop,
			onDistribute: noop,
			onLayer: noop,
			onFlip: noop,
			onLock: noop,
			onCropImage: noop,
			onAddFlowchartStep: noop,
			onSetFlowchartNodeKind: noop,
			onUpdateKanbanCard: noop,
			onUpdateKanbanList: noop,
		}),
	);

	assert.match(markup, /translated:canvas\.properties\.drawingSurface/u);
	assert.match(markup, /translated:canvas\.flowchart\.insertNodeKind/u);
	for (const direction of [
		"attachTop",
		"addYesBranch",
		"addNoBranch",
		"attachLeft",
	]) {
		assert.match(
			markup,
			new RegExp(`translated:canvas\\.flowchart\\.${direction}`, "u"),
		);
	}
	assert.match(markup, /translated:canvas\.flowchart\.editNodeText/u);
});

test("tool-default geometry stays editable in the shared panel", () => {
	const markup = renderToStaticMarkup(
		createElement(CanvasEditorPropertiesPanel, {
			selected: [{ ...element, type: "ellipse", width: 120, height: 80 }],
			mode: "defaults",
			translate: (key) => `translated:${key}`,
			onSetGeometryWidth: noop,
			onSetGeometryHeight: noop,
			onSetEllipseDiameter: noop,
			onPlaceDefaultElement: noop,
			onSetProperties: noop,
			onDelete: noop,
			onGroup: noop,
			onUngroup: noop,
			onAlign: noop,
			onDistribute: noop,
			onLayer: noop,
			onFlip: noop,
			onLock: noop,
			onCropImage: noop,
			onAddFlowchartStep: noop,
			onSetFlowchartNodeKind: noop,
			onUpdateKanbanCard: noop,
			onUpdateKanbanList: noop,
		}),
	);

	assert.match(markup, /translated:canvas\.properties\.width/u);
	assert.match(markup, /translated:canvas\.properties\.height/u);
	assert.match(markup, /translated:canvas\.properties\.diameter/u);
	assert.match(markup, /translated:canvas\.properties\.placeCircleCentered/u);
});

test("sticky checklist renders valid checkbox glyphs", () => {
	const markup = renderToStaticMarkup(
		createElement(CanvasEditorStickyNoteOverlay, {
			editing: {
				id: "sticky",
				variant: "sticky-note",
				x: 0,
				y: 0,
				width: 200,
				height: 200,
				text: "",
				fontSize: 16,
				fontFamily: "sans-serif",
				textAlign: "left",
				fontWeight: "normal",
				fontStyle: "normal",
				textDecoration: "none",
				textColor: "#000000",
			},
			stickyNoteMode: "checklist",
			stickyChecklist: [
				{ id: "done", text: "Done", completed: true },
				{ id: "open", text: "Open", completed: false },
			],
			viewport: { x: 0, y: 0, zoom: 1 },
			svgRef: { current: null },
			onUpdateStickyNote: noop,
			onClose: noop,
		}),
	);
	assert.match(markup, /☑/u);
	assert.match(markup, /☐/u);
	assert.doesNotMatch(markup, /â˜/u);
});
