/**
 * Zustand Store fuer den lokalen Canvas-UI-State.
 * Verwaltet Tool-Auswahl, Selektion, Viewport (Pan/Zoom),
 * Grid-Einstellungen und Zeichenfarben.
 * Element-Daten werden NICHT hier gespeichert (die liegen in Y.js).
 */

import {
	type CanvasThemeState,
	THEME_STROKE_DEFAULTS,
	getDefaultStrokeColor,
} from "@/lib/canvas/canvas-defaults";
import type { EyedropperTarget } from "@/lib/canvas/color-picker-utils";
import {
	LASER_MIN_POINT_DISTANCE,
	isLaserTrailVisible,
} from "@/lib/canvas/laser-utils";
import type {
	ArrowHead,
	ArrowMode,
	CanvasObjectSnapMode,
	FlowchartNodeKind,
	KanbanPriority,
	LaserTrail,
	RoughFillStyle,
	SelectionBox,
	StrokeStyle,
	ToolType,
	Viewport,
} from "@skedra/canvas-core";
import {
	DEFAULT_ARROW_HEAD_FILLED,
	DEFAULT_ARROW_HEAD_SCALE,
	DEFAULT_CANVAS_SNAP_DIVISION_COUNT,
	DEFAULT_CLOUD_ARC_RADIUS,
	DEFAULT_POLYGON_SIDES,
	DEFAULT_PYRAMID_SECTIONS,
	DEFAULT_ROUGH_FILL_SCALE,
	MAX_ARROW_HEAD_SCALE,
	MAX_PYRAMID_SECTIONS,
	MIN_ARROW_HEAD_SCALE,
	MIN_PYRAMID_SECTIONS,
	clampCanvasZoom,
	clampCloudArcRadius,
	clampPolygonSides,
	normalizeCanvasGridSize,
	normalizeCanvasSnapDivisionCount,
	snapCanvasCoordinateToGrid,
	zoomCanvasViewportAtPoint,
} from "@skedra/canvas-core";
import type { SnapGuide, SnapPointIndicator } from "@skedra/canvas-core";
import {
	DEFAULT_FILL,
	DEFAULT_ROUGH_FILL_STYLE,
	DEFAULT_STROKE_STYLE,
	GRID_SIZE,
} from "@skedra/canvas-core";
import { useEffect, useRef } from "react";
import { create } from "zustand";

interface ShapePlacementDraft {
	type: "rectangle" | "ellipse" | "diamond" | "triangle" | "cloud" | "frame";
	width: number;
	height: number;
	/** Frame-Label beim Platzieren (z. B. Preset-Name wie "iPhone 15 Pro"). */
	label?: string;
}

interface KanbanCardPlacementDraft {
	priority: KanbanPriority | null;
}

interface StickyNotePlacementDraft {
	color: string;
}

export interface CanvasStoreState {
	/* Zeichenmodus fuer Linien/Pfeile */
	pathDrawMode: "normal" | "multi";
	setPathDrawMode: (mode: "normal" | "multi") => void;

	/* Aktives Werkzeug */
	activeTool: ToolType;
	setActiveTool: (tool: ToolType) => void;

	/* Tool-Lock: Werkzeug bleibt nach Zeichnen aktiv */
	toolLocked: boolean;
	setToolLocked: (locked: boolean) => void;
	toggleToolLocked: () => void;

	/* Selektion */
	selectedIds: Set<string>;
	setSelectedIds: (ids: Set<string>) => void;
	toggleSelection: (id: string) => void;
	clearSelection: () => void;

	/* Viewport (Pan + Zoom) */
	viewport: Viewport;
	pan: (dx: number, dy: number) => void;
	zoomTo: (zoom: number, centerX: number, centerY: number) => void;
	setViewport: (viewport: Viewport) => void;
	resetViewport: () => void;

	/* Grid */
	gridEnabled: boolean;
	toggleGrid: () => void;
	gridSnapEnabled: boolean;
	toggleGridSnap: () => void;
	gridSize: number;
	setGridSize: (size: number) => void;
	snapToGrid: (value: number) => number;

	/* Zeichenoptionen */
	fillColor: string;
	strokeColor: string;
	strokeWidth: number;
	strokeStyle: StrokeStyle;
	cornerRadiusPercent: number;
	roughness: number;
	roughFillStyle: RoughFillStyle;
	roughFillScale: number;
	cloudArcRadius: number;
	pyramidSections: number;
	polygonSides: number;
	arrowMode: ArrowMode;
	arrowHeadStart: ArrowHead;
	arrowHeadEnd: ArrowHead;
	arrowHeadScale: number;
	arrowHeadFilled: boolean;
	setFillColor: (color: string) => void;
	setStrokeColor: (color: string) => void;
	setStrokeWidth: (width: number) => void;
	setStrokeStyle: (style: StrokeStyle) => void;
	setCornerRadiusPercent: (percent: number) => void;
	setRoughness: (r: number) => void;
	setRoughFillStyle: (style: RoughFillStyle) => void;
	setRoughFillScale: (scale: number) => void;
	setCloudArcRadius: (radius: number) => void;
	setPyramidSections: (sections: number) => void;
	setPolygonSides: (sides: number) => void;
	setArrowMode: (m: ArrowMode) => void;
	setArrowHeadStart: (h: ArrowHead) => void;
	setArrowHeadEnd: (h: ArrowHead) => void;
	setArrowHeadScale: (scale: number) => void;
	setArrowHeadFilled: (filled: boolean) => void;
	shapePresetWidth: number;
	shapePresetHeight: number;
	setShapePresetWidth: (width: number) => void;
	setShapePresetHeight: (height: number) => void;
	setShapePresetSize: (width: number, height: number) => void;
	shapePlacementDraft: ShapePlacementDraft | null;
	setShapePlacementDraft: (draft: ShapePlacementDraft | null) => void;
	clearShapePlacementDraft: () => void;
	kanbanCardPlacementDraft: KanbanCardPlacementDraft | null;
	setKanbanCardPlacementDraft: (draft: KanbanCardPlacementDraft | null) => void;
	clearKanbanCardPlacementDraft: () => void;
	stickyNotePlacementDraft: StickyNotePlacementDraft | null;
	setStickyNotePlacementDraft: (draft: StickyNotePlacementDraft | null) => void;
	clearStickyNotePlacementDraft: () => void;
	flowchartInsertKind: FlowchartNodeKind;
	setFlowchartInsertKind: (kind: FlowchartNodeKind) => void;

	/* Rubber-Band-Selektion */
	selectionBox: SelectionBox | null;
	setSelectionBox: (box: SelectionBox | null) => void;

	/** Freihand-Lasso waehrend der Selektion */
	lassoPath: [number, number][] | null;
	setLassoPath: (path: [number, number][] | null) => void;

	/* Feature-Panel (Sticky Notes, Kanban, Ebenen) */
	activePanel:
		| "sticky"
		| "kanban"
		| "library"
		| "wireframe"
		| "sequence-diagram"
		| "gantt"
		| "layers"
		| null;
	setActivePanel: (
		panel:
			| "sticky"
			| "kanban"
			| "library"
			| "wireframe"
			| "sequence-diagram"
			| "gantt"
			| "layers"
			| null,
	) => void;

	/* Text-Editing */
	editingTextId: string | null;
	setEditingTextId: (id: string | null) => void;

	/* Kontextmenue */
	contextMenu: { x: number; y: number } | null;
	setContextMenu: (pos: { x: number; y: number } | null) => void;

	/* Snap-to-Objects */
	snapToObjects: boolean;
	toggleSnapToObjects: () => void;
	snapToEndpoints: boolean;
	toggleSnapToEndpoints: () => void;
	showSnapPoints: boolean;
	toggleShowSnapPoints: () => void;
	snapToCenters: boolean;
	toggleSnapToCenters: () => void;
	snapToMidpoints: boolean;
	toggleSnapToMidpoints: () => void;
	snapToDivisions: boolean;
	toggleSnapToDivisions: () => void;
	snapDivisionCount: number;
	setSnapDivisionCount: (count: number) => void;
	snapToNearest: boolean;
	toggleSnapToNearest: () => void;
	snapToGeometricCenters: boolean;
	toggleSnapToGeometricCenters: () => void;
	snapToQuadrants: boolean;
	toggleSnapToQuadrants: () => void;
	snapToIntersections: boolean;
	toggleSnapToIntersections: () => void;
	snapToExtensions: boolean;
	toggleSnapToExtensions: () => void;
	snapToInsertions: boolean;
	toggleSnapToInsertions: () => void;
	snapMenu: { x: number; y: number; kind: "running" | "override" } | null;
	setSnapMenu: (
		menu: { x: number; y: number; kind: "running" | "override" } | null,
	) => void;
	snapOverrideMode: CanvasObjectSnapMode | null;
	setSnapOverrideMode: (mode: CanvasObjectSnapMode | null) => void;
	transformOrigin: { x: number; y: number } | null;
	setTransformOrigin: (origin: { x: number; y: number } | null) => void;
	snapGuides: SnapGuide[];
	setSnapGuides: (guides: SnapGuide[]) => void;
	snapPointIndicators: SnapPointIndicator[];
	setSnapPointIndicators: (points: SnapPointIndicator[]) => void;
	setSnapVisuals: (guides: SnapGuide[], points?: SnapPointIndicator[]) => void;

	/* Canvas-Hintergrundfarbe */
	canvasBg: string;
	setCanvasBg: (bg: string) => void;

	/* Theme-Sync: aktualisiert theme-abhaengige Defaults */
	syncTheme: (theme?: CanvasThemeState) => void;

	/** Leertaste gedrueckt — temporaeres Schwenken wie Excalidraw */
	isSpacePressed: boolean;
	setSpacePressed: (pressed: boolean) => void;

	/** Fokus-Hinweis fuer Eigenschaften-Panel (S/G/Shift+F) */
	propertyFocusHint: "stroke" | "fill" | "font" | null;
	requestPropertyFocus: (hint: "stroke" | "fill" | "font") => void;
	clearPropertyFocus: () => void;

	/** Vorheriges Werkzeug (Eyedropper/Laser) */
	previousTool: ToolType | null;
	restorePreviousTool: () => void;

	/** Eyedropper-Ziel */
	eyedropperTarget: EyedropperTarget;
	setEyedropperTarget: (target: EyedropperTarget) => void;
	activateEyedropper: (target?: EyedropperTarget) => void;

	/** Zen-Modus: UI minimieren */
	zenMode: boolean;
	toggleZenMode: () => void;

	/** Befehlspalette */
	commandPaletteOpen: boolean;
	setCommandPaletteOpen: (open: boolean) => void;
	/** Suche nach Text und Rahmen auf der Zeichenflaeche */
	canvasSearchOpen: boolean;
	setCanvasSearchOpen: (open: boolean) => void;

	/** Bild-Zuschneiden */
	croppingImageId: string | null;
	setCroppingImageId: (id: string | null) => void;

	/** Laserpointer (lokal, nicht synchronisiert) */
	laserTrails: LaserTrail[];
	addLaserTrailPoint: (x: number, y: number, trailId: string | null) => string;
	closeLaserTrail: (trailId: string) => void;
	clearExpiredLaserTrails: () => void;
	trimLaserTrails: () => void;
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
	pathDrawMode: "normal",
	setPathDrawMode: (mode) => set({ pathDrawMode: mode }),

	activeTool: "select",
	setActiveTool: (tool) =>
		set((s) => {
			const transient = tool === "eyedropper" || tool === "laser";
			const previousTool =
				transient &&
				s.activeTool !== tool &&
				s.activeTool !== "eyedropper" &&
				s.activeTool !== "laser"
					? s.activeTool
					: s.previousTool;
			return {
				activeTool: tool,
				previousTool,
				editingTextId: null,
				shapePlacementDraft: null,
				kanbanCardPlacementDraft: null,
				stickyNotePlacementDraft: null,
			};
		}),

	toolLocked: false,
	setToolLocked: (locked) => set({ toolLocked: locked }),
	toggleToolLocked: () => set((s) => ({ toolLocked: !s.toolLocked })),

	selectedIds: new Set(),
	setSelectedIds: (ids) => set({ selectedIds: ids }),
	toggleSelection: (id) => {
		const current = new Set(get().selectedIds);
		if (current.has(id)) current.delete(id);
		else current.add(id);
		set({ selectedIds: current });
	},
	clearSelection: () => set({ selectedIds: new Set() }),

	viewport: { x: 0, y: 0, zoom: 1 },
	pan: (dx, dy) =>
		set((s) =>
			dx === 0 && dy === 0
				? s
				: {
						viewport: {
							...s.viewport,
							x: s.viewport.x + dx,
							y: s.viewport.y + dy,
						},
					},
		),
	zoomTo: (zoom, centerX, centerY) =>
		set((s) => {
			const viewport = zoomCanvasViewportAtPoint(
				s.viewport,
				{ x: centerX, y: centerY },
				zoom,
			);
			if (
				viewport.x === s.viewport.x &&
				viewport.y === s.viewport.y &&
				viewport.zoom === s.viewport.zoom
			) {
				return s;
			}
			return {
				viewport,
			};
		}),
	setViewport: (viewport) =>
		set((state) => {
			const next = {
				x: viewport.x,
				y: viewport.y,
				zoom: clampCanvasZoom(viewport.zoom),
			};
			return next.x === state.viewport.x &&
				next.y === state.viewport.y &&
				next.zoom === state.viewport.zoom
				? state
				: { viewport: next };
		}),
	resetViewport: () => set({ viewport: { x: 0, y: 0, zoom: 1 } }),

	gridEnabled: false,
	toggleGrid: () => set((s) => ({ gridEnabled: !s.gridEnabled })),
	gridSnapEnabled: false,
	toggleGridSnap: () => set((s) => ({ gridSnapEnabled: !s.gridSnapEnabled })),
	gridSize: GRID_SIZE,
	setGridSize: (size) => set({ gridSize: normalizeCanvasGridSize(size) }),
	snapToGrid: (value) => {
		const state = get();
		if (!state.gridSnapEnabled) return value;
		return snapCanvasCoordinateToGrid(value, state.gridSize);
	},

	fillColor: DEFAULT_FILL,
	strokeColor: getDefaultStrokeColor(),
	strokeWidth: 1,
	strokeStyle: DEFAULT_STROKE_STYLE,
	cornerRadiusPercent: 25,
	roughness: 1,
	roughFillStyle: DEFAULT_ROUGH_FILL_STYLE,
	roughFillScale: DEFAULT_ROUGH_FILL_SCALE,
	cloudArcRadius: DEFAULT_CLOUD_ARC_RADIUS,
	pyramidSections: DEFAULT_PYRAMID_SECTIONS,
	polygonSides: DEFAULT_POLYGON_SIDES,
	arrowMode: "straight" as ArrowMode,
	arrowHeadStart: "none" as ArrowHead,
	arrowHeadEnd: "arrow" as ArrowHead,
	arrowHeadScale: DEFAULT_ARROW_HEAD_SCALE,
	arrowHeadFilled: DEFAULT_ARROW_HEAD_FILLED,
	setFillColor: (color) => set({ fillColor: color }),
	setStrokeColor: (color) => set({ strokeColor: color }),
	setStrokeWidth: (width) => set({ strokeWidth: width }),
	setStrokeStyle: (style) => set({ strokeStyle: style }),
	setCornerRadiusPercent: (percent) =>
		set({ cornerRadiusPercent: Math.min(100, Math.max(0, percent)) }),
	setRoughness: (r) => set({ roughness: r }),
	setRoughFillStyle: (style) => set({ roughFillStyle: style }),
	setRoughFillScale: (scale) => set({ roughFillScale: scale }),
	setCloudArcRadius: (radius) =>
		set({ cloudArcRadius: clampCloudArcRadius(radius) }),
	setPyramidSections: (sections) =>
		set({
			pyramidSections: Math.min(
				MAX_PYRAMID_SECTIONS,
				Math.max(MIN_PYRAMID_SECTIONS, Math.round(sections)),
			),
		}),
	setPolygonSides: (sides) => set({ polygonSides: clampPolygonSides(sides) }),
	setArrowMode: (m) => set({ arrowMode: m }),
	setArrowHeadStart: (h) => set({ arrowHeadStart: h }),
	setArrowHeadEnd: (h) => set({ arrowHeadEnd: h }),
	setArrowHeadFilled: (filled) => set({ arrowHeadFilled: filled }),
	setArrowHeadScale: (scale) =>
		set({
			arrowHeadScale: Math.min(
				MAX_ARROW_HEAD_SCALE,
				Math.max(MIN_ARROW_HEAD_SCALE, scale),
			),
		}),
	shapePresetWidth: 160,
	shapePresetHeight: 160,
	setShapePresetWidth: (width) =>
		set({ shapePresetWidth: Math.max(1, Math.round(width)) }),
	setShapePresetHeight: (height) =>
		set({ shapePresetHeight: Math.max(1, Math.round(height)) }),
	setShapePresetSize: (width, height) =>
		set({
			shapePresetWidth: Math.max(1, Math.round(width)),
			shapePresetHeight: Math.max(1, Math.round(height)),
		}),
	shapePlacementDraft: null,
	setShapePlacementDraft: (draft) =>
		set({
			shapePlacementDraft: draft
				? {
						...draft,
						width: Math.max(1, Math.round(draft.width)),
						height: Math.max(1, Math.round(draft.height)),
					}
				: null,
		}),
	clearShapePlacementDraft: () => set({ shapePlacementDraft: null }),
	kanbanCardPlacementDraft: null,
	setKanbanCardPlacementDraft: (draft) =>
		set({ kanbanCardPlacementDraft: draft }),
	clearKanbanCardPlacementDraft: () => set({ kanbanCardPlacementDraft: null }),
	stickyNotePlacementDraft: null,
	setStickyNotePlacementDraft: (draft) =>
		set({ stickyNotePlacementDraft: draft }),
	clearStickyNotePlacementDraft: () => set({ stickyNotePlacementDraft: null }),
	flowchartInsertKind: "step",
	setFlowchartInsertKind: (kind) => set({ flowchartInsertKind: kind }),

	selectionBox: null,
	setSelectionBox: (box) => set({ selectionBox: box }),

	lassoPath: null,
	setLassoPath: (path) => set({ lassoPath: path }),

	activePanel: null,
	setActivePanel: (panel) =>
		set((s) => ({ activePanel: s.activePanel === panel ? null : panel })),

	editingTextId: null,
	setEditingTextId: (id) => set({ editingTextId: id }),

	contextMenu: null,
	setContextMenu: (pos) => set({ contextMenu: pos }),

	snapToObjects: false,
	toggleSnapToObjects: () => set((s) => ({ snapToObjects: !s.snapToObjects })),
	snapToEndpoints: true,
	toggleSnapToEndpoints: () =>
		set((s) => ({ snapToEndpoints: !s.snapToEndpoints })),
	showSnapPoints: true,
	toggleShowSnapPoints: () =>
		set((s) => ({ showSnapPoints: !s.showSnapPoints })),
	snapToCenters: true,
	toggleSnapToCenters: () => set((s) => ({ snapToCenters: !s.snapToCenters })),
	snapToMidpoints: true,
	toggleSnapToMidpoints: () =>
		set((s) => ({ snapToMidpoints: !s.snapToMidpoints })),
	snapToDivisions: false,
	toggleSnapToDivisions: () =>
		set((s) => ({ snapToDivisions: !s.snapToDivisions })),
	snapDivisionCount: DEFAULT_CANVAS_SNAP_DIVISION_COUNT,
	setSnapDivisionCount: (count) =>
		set({ snapDivisionCount: normalizeCanvasSnapDivisionCount(count) }),
	snapToNearest: false,
	toggleSnapToNearest: () => set((s) => ({ snapToNearest: !s.snapToNearest })),
	snapToGeometricCenters: true,
	toggleSnapToGeometricCenters: () =>
		set((s) => ({ snapToGeometricCenters: !s.snapToGeometricCenters })),
	snapToQuadrants: true,
	toggleSnapToQuadrants: () =>
		set((s) => ({ snapToQuadrants: !s.snapToQuadrants })),
	snapToIntersections: true,
	toggleSnapToIntersections: () =>
		set((s) => ({ snapToIntersections: !s.snapToIntersections })),
	snapToExtensions: true,
	toggleSnapToExtensions: () =>
		set((s) => ({ snapToExtensions: !s.snapToExtensions })),
	snapToInsertions: false,
	toggleSnapToInsertions: () =>
		set((s) => ({ snapToInsertions: !s.snapToInsertions })),
	snapMenu: null,
	setSnapMenu: (menu) => set({ snapMenu: menu }),
	snapOverrideMode: null,
	setSnapOverrideMode: (mode) => set({ snapOverrideMode: mode }),
	transformOrigin: null,
	setTransformOrigin: (origin) => set({ transformOrigin: origin }),
	snapGuides: [],
	setSnapGuides: (guides) => set({ snapGuides: guides }),
	snapPointIndicators: [],
	setSnapPointIndicators: (points) => set({ snapPointIndicators: points }),
	setSnapVisuals: (guides, points = []) =>
		set({ snapGuides: guides, snapPointIndicators: points }),

	canvasBg: "",
	setCanvasBg: (bg) => set({ canvasBg: bg }),

	syncTheme: (theme) => {
		const newStroke = getDefaultStrokeColor(theme);
		const current = get().strokeColor;
		if ((THEME_STROKE_DEFAULTS as readonly string[]).includes(current)) {
			set({ strokeColor: newStroke });
		}
	},

	isSpacePressed: false,
	setSpacePressed: (pressed) => set({ isSpacePressed: pressed }),

	propertyFocusHint: null,
	requestPropertyFocus: (hint) => set({ propertyFocusHint: hint }),
	clearPropertyFocus: () => set({ propertyFocusHint: null }),

	previousTool: null,
	restorePreviousTool: () =>
		set((s) => ({
			activeTool: s.previousTool ?? "select",
		})),

	eyedropperTarget: "stroke",
	setEyedropperTarget: (target) => set({ eyedropperTarget: target }),
	activateEyedropper: (target) =>
		set((s) => ({
			eyedropperTarget: target ?? s.eyedropperTarget,
			activeTool: "eyedropper",
			previousTool:
				s.activeTool !== "eyedropper" && s.activeTool !== "laser"
					? s.activeTool
					: s.previousTool,
		})),

	zenMode: false,
	toggleZenMode: () =>
		set((s) => ({ zenMode: !s.zenMode, contextMenu: null, activePanel: null })),

	commandPaletteOpen: false,
	setCommandPaletteOpen: (open) =>
		set({
			commandPaletteOpen: open,
			...(open ? { canvasSearchOpen: false } : {}),
		}),

	canvasSearchOpen: false,
	setCanvasSearchOpen: (open) =>
		set({
			canvasSearchOpen: open,
			...(open ? { commandPaletteOpen: false } : {}),
		}),

	croppingImageId: null,
	setCroppingImageId: (id) => set({ croppingImageId: id }),

	laserTrails: [],
	addLaserTrailPoint: (x, y, trailId) => {
		const id = trailId ?? crypto.randomUUID();
		const now = performance.now();
		set((s) => {
			const existing = s.laserTrails.find((trail) => trail.id === id);
			if (existing) {
				const last = existing.points[existing.points.length - 1];
				if (last) {
					const minDist =
						LASER_MIN_POINT_DISTANCE / Math.max(s.viewport.zoom, 0.01);
					if (Math.hypot(x - last.x, y - last.y) < minDist) {
						return s;
					}
				}
				return {
					laserTrails: s.laserTrails.map((trail) =>
						trail.id === id
							? { ...trail, points: [...trail.points, { x, y, t: now }] }
							: trail,
					),
				};
			}
			return {
				laserTrails: [
					...s.laserTrails,
					{ id, points: [{ x, y, t: now }], createdAt: now },
				],
			};
		});
		return id;
	},
	closeLaserTrail: (trailId) =>
		set((s) => ({
			laserTrails: s.laserTrails.map((trail) =>
				trail.id === trailId ? { ...trail, closed: true } : trail,
			),
		})),
	trimLaserTrails: () =>
		set((s) => {
			const zoom = s.viewport.zoom;
			const nextTrails = s.laserTrails.filter((trail) =>
				isLaserTrailVisible(trail, zoom),
			);
			if (nextTrails.length === s.laserTrails.length) return s;
			return { laserTrails: nextTrails };
		}),
	clearExpiredLaserTrails: () => {
		get().trimLaserTrails();
	},
}));

export function useCanvasStoreRef() {
	const storeRef = useRef(useCanvasStore.getState());

	useEffect(
		() =>
			useCanvasStore.subscribe((state) => {
				storeRef.current = state;
			}),
		[],
	);

	return storeRef;
}
