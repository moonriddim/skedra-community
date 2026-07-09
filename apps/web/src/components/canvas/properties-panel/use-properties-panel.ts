/**
 * State, abgeleitete Werte und Handler fuer das Eigenschaften-Panel.
 */

import {
	type CanvasStoreState,
	useCanvasStore,
} from "@/hooks/use-canvas-store";
import { mergeElementCustomData } from "@/lib/canvas/custom-data-utils";
import {
	type StickyNoteMode,
	buildStickyNoteModeChange,
} from "@/lib/canvas/sticky-note-utils";
import { useThemeStore } from "@/stores/theme";
import {
	type FlowchartConnectorRoute,
	type FlowchartNodeKind,
	buildFlowchartNodeKindChanges,
} from "@skedra/canvas-core";
import type {
	ArrowTextOrientation,
	ArrowTextSide,
	KanbanPriority,
} from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { CanvasCommands } from "../canvas-commands";
import type { EditingText, PendingText } from "../text-editor";
import { CANVAS_BG_DARK, CANVAS_BG_LIGHT, getStrokeColors } from "./constants";
import { applyPropertiesPanelPropertyChange } from "./properties-panel-set-property";
import { resolveInspectedElements } from "./properties-panel-utils";
import { usePropertiesPanelDerivations } from "./use-properties-panel-derivations";
import { usePropertiesPanelGeometry } from "./use-properties-panel-geometry";

export interface UsePropertiesPanelOptions {
	elements: Map<string, CanvasElement>;
	selectedIds: Set<string>;
	editingTextId?: string | null;
	editingArrowTextSide?: ArrowTextSide | null;
	editingArrowTextOrientation?: ArrowTextOrientation | null;
	pendingText?: PendingText | null;
	onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
	onUpdateElements: (
		updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
	) => void;
	onUpdatePendingText?: (updates: Partial<PendingText>) => void;
	onUpdateEditingText?: (updates: Partial<EditingText>) => void;
	onUpdateEditingArrowTextSide?: (side: ArrowTextSide) => void;
	onUpdateEditingArrowTextOrientation?: (
		orientation: ArrowTextOrientation,
	) => void;
	commands: Pick<
		CanvasCommands,
		| "addKanbanCard"
		| "addTemplateSticky"
		| "addFlowchartStep"
		| "openKanbanCard"
		| "openKanbanList"
	>;
}

export type PropertiesPanelStoreSlice = Pick<
	CanvasStoreState,
	| "activeTool"
	| "arrowHeadEnd"
	| "arrowHeadScale"
	| "arrowHeadStart"
	| "arrowMode"
	| "cornerRadiusPercent"
	| "fillColor"
	| "flowchartInsertKind"
	| "pathDrawMode"
	| "roughFillScale"
	| "roughFillStyle"
	| "roughness"
	| "shapePresetHeight"
	| "shapePresetWidth"
	| "strokeColor"
	| "strokeStyle"
	| "strokeWidth"
	| "setActiveTool"
	| "setArrowHeadEnd"
	| "setArrowHeadScale"
	| "setArrowHeadStart"
	| "setArrowMode"
	| "setCornerRadiusPercent"
	| "setEditingTextId"
	| "setFillColor"
	| "setFlowchartInsertKind"
	| "setPathDrawMode"
	| "setRoughFillScale"
	| "setRoughFillStyle"
	| "setRoughness"
	| "setShapePlacementDraft"
	| "setShapePresetSize"
	| "setStrokeColor"
	| "setStrokeStyle"
	| "setStrokeWidth"
>;

export function usePropertiesPanel({
	elements,
	selectedIds,
	editingTextId,
	editingArrowTextSide,
	editingArrowTextOrientation,
	pendingText,
	onUpdateElement,
	onUpdateElements,
	onUpdatePendingText,
	onUpdateEditingText,
	onUpdateEditingArrowTextSide,
	onUpdateEditingArrowTextOrientation,
	commands,
}: UsePropertiesPanelOptions) {
	const store = useCanvasStore(
		useShallow((state) => ({
			activeTool: state.activeTool,
			arrowHeadEnd: state.arrowHeadEnd,
			arrowHeadScale: state.arrowHeadScale,
			arrowHeadStart: state.arrowHeadStart,
			arrowMode: state.arrowMode,
			cornerRadiusPercent: state.cornerRadiusPercent,
			fillColor: state.fillColor,
			flowchartInsertKind: state.flowchartInsertKind,
			pathDrawMode: state.pathDrawMode,
			roughFillScale: state.roughFillScale,
			roughFillStyle: state.roughFillStyle,
			roughness: state.roughness,
			shapePresetHeight: state.shapePresetHeight,
			shapePresetWidth: state.shapePresetWidth,
			strokeColor: state.strokeColor,
			strokeStyle: state.strokeStyle,
			strokeWidth: state.strokeWidth,
			setActiveTool: state.setActiveTool,
			setArrowHeadEnd: state.setArrowHeadEnd,
			setArrowHeadScale: state.setArrowHeadScale,
			setArrowHeadStart: state.setArrowHeadStart,
			setArrowMode: state.setArrowMode,
			setCornerRadiusPercent: state.setCornerRadiusPercent,
			setEditingTextId: state.setEditingTextId,
			setFillColor: state.setFillColor,
			setFlowchartInsertKind: state.setFlowchartInsertKind,
			setPathDrawMode: state.setPathDrawMode,
			setRoughFillScale: state.setRoughFillScale,
			setRoughFillStyle: state.setRoughFillStyle,
			setRoughness: state.setRoughness,
			setShapePlacementDraft: state.setShapePlacementDraft,
			setShapePresetSize: state.setShapePresetSize,
			setStrokeColor: state.setStrokeColor,
			setStrokeStyle: state.setStrokeStyle,
			setStrokeWidth: state.setStrokeWidth,
		})),
	);

	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
	const strokeColors = getStrokeColors(resolvedTheme);
	const canvasBgOptions =
		resolvedTheme === "dark" ? CANVAS_BG_DARK : CANVAS_BG_LIGHT;

	const selected = useMemo(
		() =>
			Array.from(selectedIds)
				.map((id) => elements.get(id))
				.filter(Boolean) as CanvasElement[],
		[elements, selectedIds],
	);

	const inspected = useMemo(
		() =>
			resolveInspectedElements({
				pendingText,
				editingTextId,
				elements,
				selected,
			}),
		[pendingText, editingTextId, elements, selected],
	);

	const d = usePropertiesPanelDerivations({
		store,
		elements,
		selected,
		inspected,
		pendingText,
		editingTextId,
		editingArrowTextSide,
		editingArrowTextOrientation,
	});

	const geometry = usePropertiesPanelGeometry({
		store,
		singleGeometryElement: d.singleGeometryElement,
		geometryPresetTool: d.geometryPresetTool,
		onUpdateElement,
	});

	const setProperty = useCallback(
		(key: keyof CanvasElement, value: unknown) => {
			applyPropertiesPanelPropertyChange({
				key,
				value,
				pendingText,
				editingTextId,
				hasSelection: d.hasSelection,
				selected,
				elements,
				selectedTemplateSection: d.selectedTemplateSection,
				mindmapBranchRoot: d.mindmapBranchRoot,
				onUpdatePendingText,
				onUpdateElement,
				onUpdateElements,
				onUpdateEditingText,
				store,
			});
		},
		[
			pendingText,
			editingTextId,
			d.hasSelection,
			selected,
			elements,
			d.selectedTemplateSection,
			d.mindmapBranchRoot,
			onUpdatePendingText,
			onUpdateElement,
			onUpdateElements,
			onUpdateEditingText,
			store,
		],
	);

	const setStickyNoteMode = useCallback(
		(mode: StickyNoteMode) => {
			onUpdateElements(
				inspected.map((el) => ({
					id: el.id,
					changes: buildStickyNoteModeChange(el, mode),
				})),
			);
		},
		[inspected, onUpdateElements],
	);

	const setKanbanPriority = useCallback(
		(priority: KanbanPriority | null) => {
			onUpdateElements(
				selected.map((el) => ({
					id: el.id,
					changes: {
						customData: {
							...(el.customData ?? {}),
							skedraType: "kanban-card",
							priority,
						},
					} as Partial<CanvasElement>,
				})),
			);
		},
		[onUpdateElements, selected],
	);

	const openKanbanDetail = useCallback(() => {
		if (!d.isKanbanCardSelection || selected.length !== 1) return;
		commands.openKanbanCard(selected[0].id);
	}, [commands, d.isKanbanCardSelection, selected]);

	const openKanbanListDetail = useCallback(() => {
		if (!d.kanbanList) return;
		commands.openKanbanList(d.kanbanList.id);
	}, [commands, d.kanbanList]);

	const addCardToList = useCallback(() => {
		if (!d.kanbanList) return;
		commands.addKanbanCard(d.kanbanList.id);
	}, [commands, d.kanbanList]);

	const addTemplateNote = useCallback(() => {
		if (!d.templateSection || !selected[0]) return;
		commands.addTemplateSticky(selected[0].id);
	}, [commands, selected, d.templateSection]);

	const addFlowchartNodeOnSide = useCallback(
		(
			route: Exclude<FlowchartConnectorRoute, "left-up">,
			options?: { branch?: "next" | "yes" | "no"; label?: string },
		) => {
			if (!d.flowchartNode) return;
			commands.addFlowchartStep(d.flowchartNode.id, {
				route,
				nodeKind: store.flowchartInsertKind,
				branch: options?.branch,
				label: options?.label,
			});
		},
		[commands, d.flowchartNode, store.flowchartInsertKind],
	);

	const setFlowchartConnectorLabel = useCallback(
		(label: string | undefined, textColor?: string) => {
			if (!d.flowchartConnector) return;
			onUpdateElement(d.flowchartConnector.id, {
				text: label,
				textColor,
				fontSize: label ? 12 : undefined,
				fontWeight: label ? "bold" : undefined,
			});
		},
		[d.flowchartConnector, onUpdateElement],
	);

	const editFlowchartConnectorLabel = useCallback(() => {
		if (!d.flowchartConnector) return;
		store.setEditingTextId(d.flowchartConnector.id);
	}, [d.flowchartConnector, store]);

	const editFlowchartNodeText = useCallback(() => {
		if (!d.flowchartNode) return;
		store.setEditingTextId(d.flowchartNode.id);
	}, [d.flowchartNode, store]);

	const setFlowchartNodeKind = useCallback(
		(kind: FlowchartNodeKind) => {
			if (!d.flowchartNode) return;
			onUpdateElement(
				d.flowchartNode.id,
				buildFlowchartNodeKindChanges(d.flowchartNode, kind),
			);
		},
		[d.flowchartNode, onUpdateElement],
	);

	const setArrowTextSide = useCallback(
		(side: ArrowTextSide) => {
			if (d.inspectedPathTextElements.length === 0) return;
			onUpdateElements(
				d.inspectedPathTextElements.map((el) => {
					const live = elements.get(el.id) ?? el;
					return {
						id: el.id,
						changes: {
							customData: mergeElementCustomData(live.customData, {
								arrowTextSide: side,
							}),
						} as Partial<CanvasElement>,
					};
				}),
			);
			onUpdateEditingArrowTextSide?.(side);
		},
		[
			elements,
			d.inspectedPathTextElements,
			onUpdateEditingArrowTextSide,
			onUpdateElements,
		],
	);

	const setArrowTextOrientation = useCallback(
		(orientation: ArrowTextOrientation) => {
			if (d.inspectedPathTextElements.length === 0) return;
			onUpdateElements(
				d.inspectedPathTextElements.map((el) => {
					const live = elements.get(el.id) ?? el;
					return {
						id: el.id,
						changes: {
							customData: mergeElementCustomData(live.customData, {
								arrowTextOrientation: orientation,
							}),
						} as Partial<CanvasElement>,
					};
				}),
			);
			onUpdateEditingArrowTextOrientation?.(orientation);
		},
		[
			elements,
			d.inspectedPathTextElements,
			onUpdateEditingArrowTextOrientation,
			onUpdateElements,
		],
	);

	return {
		...d,
		strokeColors,
		canvasBgOptions,
		selected,
		setStickyNoteMode,
		setProperty,
		setKanbanPriority,
		openKanbanListDetail,
		addCardToList,
		openKanbanDetail,
		addTemplateNote,
		flowchartInsertKind: store.flowchartInsertKind,
		setFlowchartInsertKind: store.setFlowchartInsertKind,
		editFlowchartNodeText,
		setFlowchartNodeKind,
		addFlowchartNodeOnSide,
		setFlowchartConnectorLabel,
		editFlowchartConnectorLabel,
		currentShapeWidth: geometry.currentShapeWidth,
		currentShapeHeight: geometry.currentShapeHeight,
		ellipseDiameter: geometry.ellipseDiameter,
		setSingleGeometryWidth: geometry.setSingleGeometryWidth,
		setSingleGeometryHeight: geometry.setSingleGeometryHeight,
		setPerfectCircleDiameter: geometry.setPerfectCircleDiameter,
		startPresetGeometryPlacement: geometry.startPresetGeometryPlacement,
		pathDrawMode: store.pathDrawMode,
		setPathDrawMode: store.setPathDrawMode,
		setArrowTextSide,
		setArrowTextOrientation,
	};
}
