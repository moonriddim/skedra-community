import assert from "node:assert/strict";
import test from "node:test";
import {
	type CanvasElement,
	CanvasScene,
	createGanttChartElements,
	createVisualSequenceDiagramElements,
} from "@skedra/canvas-core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
	CanvasEditor,
	CanvasEditorContextMenu,
	CanvasEditorGanttStudio,
	CanvasEditorGridOverlay,
	CanvasEditorImageCropOverlay,
	CanvasEditorLayerPanel,
	CanvasEditorPropertiesPanel,
	CanvasEditorSavedViewDraft,
	CanvasEditorSavedViewOverlay,
	CanvasEditorSavedViewsBar,
	CanvasEditorSelectionGestureOverlay,
	CanvasEditorSelectionOverlay,
	CanvasEditorSequenceDiagramPanel,
	CanvasEditorSnapMenu,
	CanvasEditorSnapOverlay,
	CanvasEditorStickyNoteOverlay,
	CanvasEditorSurface,
	CanvasEditorToolbar,
	CanvasEditorWireframePanel,
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

test("sequence diagram panel validates source through canvas-core", () => {
	const validMarkup = renderToStaticMarkup(
		createElement(CanvasEditorSequenceDiagramPanel, {
			defaultTab: "mermaid",
			defaultSource: `sequenceDiagram
    participant A
    participant B
    A->>B: Request`,
			onInsert: noop,
		}),
	);
	const invalidMarkup = renderToStaticMarkup(
		createElement(CanvasEditorSequenceDiagramPanel, {
			defaultTab: "mermaid",
			defaultSource: "sequenceDiagram\nA => B: invalid",
			onInsert: noop,
		}),
	);

	assert.match(validMarkup, /canvas-editor__sequence-panel/u);
	assert.match(validMarkup, /Diagramm ist bereit/u);
	assert.match(validMarkup, /2 · 1/u);
	assert.match(invalidMarkup, /Korrigiere vor dem Einfügen die Syntax/u);
	assert.match(invalidMarkup, /disabled=""/u);
});

test("sequence diagram panel defaults to the plain-language builder", () => {
	let id = 0;
	const visualElements = createVisualSequenceDiagramElements({
		preset: "blank",
		x: 0,
		y: 0,
		defaults: {
			createId: () => `visual-${++id}`,
			stroke: "#111827",
			fontFamily: "system-ui",
		},
	});
	const markup = renderToStaticMarkup(
		createElement(CanvasEditorSequenceDiagramPanel, {
			elements: new Map(
				visualElements.map((visualElement) => [
					visualElement.id,
					visualElement,
				]),
			),
			onCreateVisualDiagram: noop,
			onAddParticipant: noop,
			onAddMessage: noop,
			onAddActivation: noop,
			onAddFragment: noop,
			onInsert: noop,
		}),
	);

	assert.match(markup, /Ablauf erstellen/u);
	assert.match(markup, /Nächster Schritt/u);
	assert.match(markup, /Schritte erkennen/u);
});

test("Gantt studio renders the interactive grid and timeline", () => {
	const markup = renderToStaticMarkup(
		createElement(CanvasEditorGanttStudio, {
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
						id: "phase",
						title: "Discovery",
						startDay: 0,
						durationDays: 5,
						progress: 0,
						status: "planned",
						milestone: false,
						critical: false,
						group: true,
						collapsed: false,
					},
					{
						id: "design",
						title: "Design",
						startDay: 0,
						durationDays: 5,
						progress: 50,
						status: "active",
						milestone: false,
						critical: true,
						group: false,
						parentId: "phase",
						collapsed: false,
					},
					{
						id: "implementation",
						title: "Implementation",
						category: "home-office",
						startDay: 3,
						durationDays: 5,
						progress: 20,
						status: "active",
						milestone: false,
						critical: false,
						group: false,
						collapsed: false,
					},
					{
						id: "training",
						title: "Safety training",
						category: "custom:training",
						categoryLabel: "Training",
						color: "#0F766E",
						startDay: 10,
						durationDays: 1,
						progress: 0,
						status: "planned",
						milestone: false,
						critical: false,
						group: false,
						collapsed: false,
					},
				],
				dependencies: [
					{
						fromTaskId: "design",
						toTaskId: "implementation",
						type: "finish-to-start",
					},
				],
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
			charts: [
				{ id: "launch", title: "Launch plan" },
				{ id: "availability", title: "Team availability" },
			],
			activeChartId: "launch",
			onSelectChart: noop,
			onCreate: noop,
			onChange: noop,
		}),
	);
	assert.match(markup, /canvas-editor__gantt-studio/u);
	// Grid renders the task name and the phase summary row.
	assert.match(markup, /Design/u);
	assert.match(markup, /Discovery/u);
	// The interactive controls are present (add task, collapse, critical).
	assert.match(markup, /canvas-editor__gantt-studio-bar/u);
	assert.match(markup, /canvas-editor__gantt-studio-weeks/u);
	assert.match(markup, />CW 29</u);
	assert.match(markup, /canvas-editor__gantt-studio-chart-picker/u);
	assert.match(markup, /Team availability/u);
	assert.match(markup, />HO</u);
	assert.match(markup, />TRAI</u);
	assert.match(markup, /Create custom type/u);
	assert.match(markup, /aria-label="End"/u);
	assert.match(markup, /Add previous year/u);
	assert.match(markup, /Add next year/u);
	assert.match(markup, /Remove earliest year/u);
	assert.match(markup, /Remove latest year/u);
	assert.match(markup, /Jump to today/u);
	assert.match(markup, /More row options/u);
	assert.doesNotMatch(markup, /canvas-editor__gantt-studio-row-actions/u);
	assert.match(markup, /New plan/u);
	// The dependency remains rendered after rebasing the rolling input to 2026.
	assert.match(markup, /canvas-editor__gantt-studio-link/u);
});

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
				className: "test-host",
			},
			createElement("span", null, "surface"),
		),
	);
	assert.match(markup, /data-canvas-editor="true"/u);
	assert.match(markup, /class="canvas-editor test-host"/u);
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
	assert.match(markup, /canvas-editor__properties/u);
	assert.doesNotMatch(markup, />Stroke</u);
	assert.doesNotMatch(markup, />Lock</u);
});

test("productivity panels are shared host-neutral surfaces", () => {
	const elements = new Map([[element.id, element]]);
	const translate = (key: string) => `translated:${key}`;
	const layerMarkup = renderToStaticMarkup(
		createElement(CanvasEditorLayerPanel, {
			elements,
			selectedIds: new Set([element.id]),
			translate,
			onSelect: noop,
			onToggleLock: noop,
			onReorder: noop,
		}),
	);
	const wireframeMarkup = renderToStaticMarkup(
		createElement(CanvasEditorWireframePanel, {
			elements,
			selectedElements: [],
			translate,
			onInsertPreset: noop,
			onInsertComponent: noop,
		}),
	);
	const snapMenuMarkup = renderToStaticMarkup(
		createElement(CanvasEditorSnapMenu, {
			x: 20,
			y: 20,
			kind: "override",
			enabled: true,
			modes: {
				endpoint: true,
				midpoint: false,
				division: false,
				center: false,
				"geometric-center": false,
				quadrant: false,
				intersection: false,
				extension: false,
				insertion: false,
				nearest: false,
			},
			translate,
			onClose: noop,
		}),
	);
	const contextMenuMarkup = renderToStaticMarkup(
		createElement(CanvasEditorContextMenu, {
			x: 20,
			y: 20,
			hasSelection: true,
			selectionCount: 1,
			isLocked: false,
			isInFrame: false,
			isGrouped: false,
			canPaste: true,
			canPasteFormat: true,
			onCopy: noop,
			onCut: noop,
			onPaste: noop,
			onDuplicate: noop,
			onDelete: noop,
			onSelectAll: noop,
			onToggleLock: noop,
			onCopyFormat: noop,
			onPasteFormat: noop,
			onBringForward: noop,
			onSendBackward: noop,
			onBringToFront: noop,
			onSendToBack: noop,
			onFlipHorizontal: noop,
			onFlipVertical: noop,
			onCopyMirrorHorizontal: noop,
			onCopyMirrorVertical: noop,
			onRotate: noop,
			onCopyRotate: noop,
			onAddLink: noop,
			onEmbedInFrame: noop,
			onRemoveFromFrame: noop,
			onGroup: noop,
			onUngroup: noop,
			snapToObjects: true,
			onToggleSnap: noop,
			showSnapPoints: true,
			onToggleSnapPoints: noop,
			snapModes: {
				endpoint: true,
				midpoint: false,
				division: false,
				center: false,
				"geometric-center": false,
				quadrant: false,
				intersection: false,
				extension: false,
				insertion: false,
				nearest: false,
			},
			onToggleSnapMode: noop,
			snapDivisionCount: 2,
			onSnapDivisionCountChange: noop,
			gridEnabled: true,
			onToggleGrid: noop,
			gridSnapEnabled: true,
			onToggleGridSnap: noop,
			gridSize: 20,
			onGridSizeChange: noop,
			translate,
			onClose: noop,
		}),
	);
	assert.match(layerMarkup, /translated:canvas\.layers\.title/u);
	assert.match(wireframeMarkup, /translated:wireframePanel\.title/u);
	assert.match(wireframeMarkup, /translated:wireframePanel\.blankScreens/u);
	assert.match(snapMenuMarkup, /canvas-editor__snap-menu/u);
	assert.match(snapMenuMarkup, /translated:canvas\.snapMenu\.overrideTitle/u);
	assert.match(contextMenuMarkup, /canvas-editor__context-menu/u);
	assert.match(contextMenuMarkup, /translated:canvas\.contextMenu\.copy/u);
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
	assert.match(markup, /canvas-editor__toolbar/u);
	assert.match(markup, /canvas-editor__toolbar-track/u);
	assert.match(markup, /canvas-editor__toolbar-action/u);
	assert.match(markup, /canvas-editor__toolbar-menu/u);
	assert.match(markup, /canvas-editor__toolbar-color/u);
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
	assert.equal(
		(selection.match(/canvas-editor__coarse-pointer-target/gu) ?? []).length,
		8,
	);

	const textSelection = renderToStaticMarkup(
		createElement(CanvasEditorSelectionOverlay, {
			selected: [{ ...element, id: "text", type: "text", text: "Text" }],
			zoom: 1,
			onResizeStart: noop,
			onResizeKeyDown: noop,
			onPathPointDragStart: noop,
			onInsertPathPoint: noop,
		}),
	);
	assert.match(textSelection, /aria-label="Resize nw"/u);
	assert.match(textSelection, /aria-label="Resize se"/u);
	assert.doesNotMatch(textSelection, /aria-label="Resize n"/u);
	assert.equal((textSelection.match(/role="button"/gu) ?? []).length, 4);

	let ganttId = 0;
	const ganttSelection = renderToStaticMarkup(
		createElement(CanvasEditorSelectionOverlay, {
			selected: createGanttChartElements(
				{
					createId: () => `selection-gantt-${ganttId++}`,
					stroke: "#111111",
					fontFamily: "Inter",
				},
				{ x: 0, y: 0, startDate: "2026-07-13" },
			),
			zoom: 1,
			onResizeStart: noop,
			onRotateStart: noop,
			onPathPointDragStart: noop,
			onInsertPathPoint: noop,
		}),
	);
	assert.match(ganttSelection, /aria-label="Resize nw"/u);
	assert.doesNotMatch(ganttSelection, /Rotate selection/u);

	for (const directPathType of ["line", "arrow"] as const) {
		const directPathSelection = renderToStaticMarkup(
			createElement(CanvasEditorSelectionOverlay, {
				selected: [
					{
						...element,
						id: directPathType,
						type: directPathType,
						points: [
							[0, 0],
							[100, 80],
						],
					},
				],
				zoom: 1,
				onResizeStart: noop,
				onRotateStart: noop,
				onPathPointDragStart: noop,
				onInsertPathPoint: noop,
			}),
		);
		assert.match(directPathSelection, /data-skedra-ui="path-handles"/u);
		assert.doesNotMatch(directPathSelection, /<rect/u);
		assert.doesNotMatch(directPathSelection, /Rotate selection/u);
	}

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
	const savedView = {
		id: "view-1",
		name: "Planning",
		x: 0,
		y: 0,
		width: 400,
		height: 225,
		createdAt: 1,
		updatedAt: 1,
	};
	const savedViewOverlay = renderToStaticMarkup(
		createElement(CanvasEditorSavedViewOverlay, {
			view: savedView,
			zoom: 1,
			onMoveStart: noop,
			onResizeStart: noop,
		}),
	);
	const savedViewDraft = renderToStaticMarkup(
		createElement(CanvasEditorSavedViewDraft, {
			bounds: savedView,
			zoom: 1,
		}),
	);
	for (const markup of [
		snap,
		pathStart,
		crop,
		savedViewOverlay,
		savedViewDraft,
	]) {
		assert.match(markup, /data-ui-only="true"/u);
		assert.match(markup, /data-skedra-ui=/u);
	}
});

test("saved views use one shared bottom bar in every host", () => {
	const view = {
		id: "view-1",
		name: "Planning",
		x: 0,
		y: 0,
		width: 400,
		height: 225,
		createdAt: 1,
		updatedAt: 1,
	};
	const markup = renderToStaticMarkup(
		createElement(CanvasEditorSavedViewsBar, {
			canUndo: true,
			canRedo: false,
			onUndo: noop,
			onRedo: noop,
			onFitViewport: noop,
			onZoomBy: noop,
			zoom: 1,
			snapEnabled: true,
			onToggleSnap: noop,
			views: [view],
			elements: new Map([[element.id, element]]),
			activeViewId: view.id,
			editingViewId: null,
			isCapturingView: false,
			onStartCaptureView: noop,
			onCancelCaptureView: noop,
			onSelectView: noop,
			onStartEditView: noop,
			onStopEditView: noop,
			onDeleteView: noop,
			onDuplicateView: noop,
			onMoveView: noop,
			onRenameView: noop,
			renderPreview: () => null,
		}),
	);

	assert.match(markup, /data-skedra-ui="saved-views-bar"/u);
	assert.match(markup, />Planning</u);
	assert.match(markup, /aria-label="Save view"/u);
	assert.match(markup, /aria-label="Toggle object snap"/u);
	assert.match(markup, /aria-pressed="true"/u);
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

test("frame constraints stay available in the shared properties panel", () => {
	const markup = renderToStaticMarkup(
		createElement(CanvasEditorPropertiesPanel, {
			selected: [{ ...element, frameId: "frame" }],
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

	assert.match(markup, /translated:canvas\.properties\.frameConstraints/u);
	assert.match(markup, /translated:canvas\.properties\.constraintHorizontal/u);
	assert.match(markup, /translated:canvas\.properties\.constraintVertical/u);
});

test("frame export actions stay available in the shared properties panel", () => {
	const markup = renderToStaticMarkup(
		createElement(CanvasEditorPropertiesPanel, {
			selected: [{ ...element, type: "frame", frameLabel: "Screen" }],
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
			onExportFrame: noop,
		}),
	);

	assert.match(markup, /translated:canvas\.properties\.frameExport/u);
	assert.match(markup, /translated:canvas\.properties\.exportFrame\.png/u);
	assert.match(markup, /translated:canvas\.properties\.exportFrame\.svg/u);
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
