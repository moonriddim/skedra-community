/**
 * Abgeleiteter Anzeige-State fuer das Eigenschaften-Panel (Selektion, Tools, Werte).
 */

import { CANVAS_DEFAULT_FONT } from "@/lib/canvas/canvas-defaults";
import { readElementCustomData } from "@/lib/canvas/custom-data-utils";
import {
	type StickyNoteMode,
	getStickyNoteMode,
} from "@/lib/canvas/sticky-note-utils";
import {
	getTemplateSectionMeta,
	getTemplateStickyNoteMeta,
} from "@/lib/canvas/template-tool-utils";
import {
	getFlowchartConnectorMeta,
	getFlowchartNodeMeta,
	getMindmapBranchRootIdForElement,
	isPlainCanvasFrame,
} from "@skedra/canvas-core";
import type {
	ArrowTextOrientation,
	ArrowTextSide,
	KanbanPriority,
} from "@skedra/canvas-core";
import { getCornerRadiusPercent } from "@skedra/canvas-core";
import type {
	ArrowHead,
	ArrowMode,
	CanvasElement,
	RoughFillStyle,
	ToolType,
} from "@skedra/canvas-core";
import {
	DEFAULT_ARROW_HEAD_FILLED,
	DEFAULT_ARROW_HEAD_SCALE,
	DEFAULT_ROUGH_FILL_SCALE,
	DEFAULT_ROUGH_FILL_STYLE,
} from "@skedra/canvas-core";
import type { CanvasEditorPendingText as PendingText } from "@skedra/canvas-editor";
import { useMemo } from "react";
import { hasCanvasToolProperties } from "../canvas-tool-types";
import { isGenericGeometry } from "./properties-panel-utils";
import type { PropertiesPanelStoreSlice } from "./use-properties-panel";

export interface PropertiesPanelDerivationsInput {
	store: PropertiesPanelStoreSlice;
	elements: Map<string, CanvasElement>;
	selected: CanvasElement[];
	inspected: CanvasElement[];
	pendingText?: PendingText | null;
	editingTextId?: string | null;
	editingArrowTextSide?: ArrowTextSide | null;
	editingArrowTextOrientation?: ArrowTextOrientation | null;
}

interface PropertiesPanelDerivations {
	hasSelection: boolean;
	hasInspectionTarget: boolean;
	inspected: CanvasElement[];
	isEditingTextContext: boolean;
	mindmapBranchRoot: CanvasElement | null;
	inspectedPathTextElements: CanvasElement[];
	selectedTemplateSection: ReturnType<typeof getTemplateSectionMeta>;
	shouldRender: boolean;
	activeTool: ToolType;
	isTextOnly: boolean;
	isLineType: boolean;
	hasShapeElement: boolean;
	isKanbanOnly: boolean;
	isStickyNoteOnly: boolean;
	currentStickyNoteMode: StickyNoteMode;
	showFill: boolean;
	showGeometryFill: boolean;
	showBackgroundFill: boolean;
	showStrokeWidth: boolean;
	showStrokeStyle: boolean;
	isFrameOnly: boolean;
	showRoughness: boolean;
	showCornerRadius: boolean;
	geometryPresetTool: Extract<
		ToolType,
		"rectangle" | "ellipse" | "diamond"
	> | null;
	singleGeometryElement: CanvasElement | null;
	showDimensions: boolean;
	hasTextElement: boolean;
	isPathElement: boolean;
	isArrowElement: boolean;
	showPathClosed: boolean;
	currentPathClosed: boolean;
	showArrowTextPosition: boolean;
	showPathDrawMode: boolean;
	showStroke: boolean;
	currentStroke: string;
	currentFill: string;
	currentStrokeWidth: number;
	currentStrokeStyle: CanvasElement["strokeStyle"];
	currentOpacity: number;
	cornerRadiusWidth: number;
	cornerRadiusHeight: number;
	currentCornerRadiusPercent: number;
	isCornerPresetActive: (percent: number) => boolean;
	currentRoughness: number;
	currentRoughFillStyle: RoughFillStyle;
	showRoughFillScale: boolean;
	roughFillScalePercent: number;
	currentArrowMode: ArrowMode;
	currentArrowHeadStart: ArrowHead;
	currentArrowHeadEnd: ArrowHead;
	currentArrowHeadScale: number;
	currentArrowHeadFilled: boolean;
	showArrowHeadScale: boolean;
	showArrowHeadFill: boolean;
	currentArrowTextSide: ArrowTextSide;
	currentArrowTextOrientation: ArrowTextOrientation;
	currentFontFamily: string;
	currentFontSize: number;
	currentTextAlign: NonNullable<CanvasElement["textAlign"]>;
	currentFontWeight: NonNullable<CanvasElement["fontWeight"]>;
	currentFontStyle: NonNullable<CanvasElement["fontStyle"]>;
	currentTextDecoration: NonNullable<CanvasElement["textDecoration"]>;
	currentTextColor: string;
	isKanbanCardSelection: boolean;
	currentPriority: KanbanPriority | null;
	isKanbanListSelection: boolean;
	kanbanList: CanvasElement | null;
	frameElement: CanvasElement | null;
	framePresetToolActive: boolean;
	templateSection: ReturnType<typeof getTemplateSectionMeta>;
	isTemplateNoteSelection: boolean;
	templateNoteMeta: ReturnType<typeof getTemplateStickyNoteMeta>;
	flowchartNode: CanvasElement | null;
	flowchartNodeMeta: ReturnType<typeof getFlowchartNodeMeta>;
	flowchartConnector: CanvasElement | null;
	flowchartConnectorMeta: ReturnType<typeof getFlowchartConnectorMeta>;
}

function derivePropertiesPanelState({
	store,
	elements,
	selected,
	inspected,
	pendingText,
	editingTextId,
	editingArrowTextSide,
	editingArrowTextOrientation,
}: PropertiesPanelDerivationsInput): PropertiesPanelDerivations {
	const hasSelection = selected.length > 0;
	const hasInspectionTarget = inspected.length > 0;
	const isEditingTextContext = pendingText != null || editingTextId != null;

	let mindmapBranchRootId: string | null = null;
	if (selected.length > 0) {
		const branchRootIds = new Set(
			selected
				.map((element) => getMindmapBranchRootIdForElement(element, elements))
				.filter((value): value is string => typeof value === "string"),
		);
		mindmapBranchRootId =
			branchRootIds.size === 1 ? Array.from(branchRootIds)[0] : null;
	}
	const mindmapBranchRoot = mindmapBranchRootId
		? (elements.get(mindmapBranchRootId) ?? null)
		: null;

	const inspectedPathTextElements = inspected.filter(
		(el) => el.type === "line" || el.type === "arrow",
	);

	const selectedTemplateSection =
		hasSelection && selected.length === 1
			? getTemplateSectionMeta(selected[0])
			: null;

	const hasActiveToolProperties = hasCanvasToolProperties(store.activeTool);
	const shouldRender = hasInspectionTarget || hasActiveToolProperties;
	const activeTool = store.activeTool;
	const types = new Set(inspected.map((el) => el.type));

	const isTextOnly = isEditingTextContext
		? true
		: hasInspectionTarget
			? types.size === 1 && types.has("text")
			: activeTool === "text";

	const isLineType = isEditingTextContext
		? false
		: hasInspectionTarget
			? [...types].every(
					(t) => t === "line" || t === "arrow" || t === "freehand",
				)
			: activeTool === "line" ||
				activeTool === "arrow" ||
				activeTool === "freehand";

	const hasShapeElement = isEditingTextContext
		? false
		: hasInspectionTarget
			? inspected.some(isGenericGeometry)
			: activeTool === "rectangle" ||
				activeTool === "ellipse" ||
				activeTool === "diamond";

	const isKanbanOnly =
		!isEditingTextContext &&
		hasInspectionTarget &&
		inspected.every(
			(el) =>
				el.customData?.skedraType === "kanban-card" ||
				el.customData?.skedraType === "kanban-list",
		);

	const isStickyNoteOnly =
		hasInspectionTarget &&
		inspected.every((el) => el.customData?.skedraType === "sticky-note");

	const currentStickyNoteMode: StickyNoteMode = isStickyNoteOnly
		? getStickyNoteMode(inspected[0])
		: "note";

	const isClosedPathOnly =
		hasInspectionTarget &&
		inspected.every((el) => el.type === "line" && el.closed === true);
	const showFill =
		!isTextOnly &&
		(!isLineType || isClosedPathOnly) &&
		!isKanbanOnly &&
		!isStickyNoteOnly;
	const showGeometryFill =
		showFill &&
		(hasShapeElement || isClosedPathOnly) &&
		!selectedTemplateSection;
	const showBackgroundFill = showFill && !showGeometryFill;
	const showStrokeWidth = !isTextOnly && !isKanbanOnly && !isStickyNoteOnly;
	const showStrokeStyle =
		!isTextOnly &&
		!isKanbanOnly &&
		!isStickyNoteOnly &&
		!(hasSelection && [...types].every((t) => t === "freehand"));
	const isFrameOnly = hasSelection && [...types].every((t) => t === "frame");
	const showRoughness =
		!isTextOnly && !isFrameOnly && !isKanbanOnly && !isStickyNoteOnly;
	const showCornerRadius =
		!isKanbanOnly &&
		!isStickyNoteOnly &&
		(hasInspectionTarget
			? inspected.some(
					(el) =>
						el.type === "rectangle" &&
						el.customData?.skedraType !== "sticky-note",
				)
			: activeTool === "rectangle");

	const geometryPresetTool =
		!isEditingTextContext &&
		!hasSelection &&
		(activeTool === "rectangle" ||
			activeTool === "ellipse" ||
			activeTool === "diamond")
			? activeTool
			: null;

	const singleGeometryElement =
		!isEditingTextContext && selected.length === 1
			? (() => {
					const [element] = selected;
					return element && isGenericGeometry(element) ? element : null;
				})()
			: null;

	const showDimensions =
		singleGeometryElement != null || geometryPresetTool != null;

	const hasTextElement =
		isStickyNoteOnly ||
		isEditingTextContext ||
		(!isKanbanOnly &&
			(hasInspectionTarget
				? inspected.some(
						(el) =>
							el.type === "text" ||
							el.customData?.skedraType === "sticky-note" ||
							(typeof el.text === "string" && el.text.trim().length > 0),
					)
				: activeTool === "text"));

	const isPathElement = isEditingTextContext
		? false
		: hasInspectionTarget
			? inspected.every((el) => el.type === "line" || el.type === "arrow")
			: activeTool === "line" || activeTool === "arrow";

	const isArrowElement = isEditingTextContext
		? false
		: hasInspectionTarget
			? inspected.some((el) => el.type === "arrow")
			: activeTool === "arrow";

	const showArrowTextPosition = inspectedPathTextElements.length > 0;
	const showPathDrawMode = activeTool === "line" || activeTool === "arrow";
	const showPathClosed =
		hasInspectionTarget &&
		inspected.every(
			(el) => el.type === "line" && (el.points?.length ?? 0) >= 3,
		);
	const currentPathClosed = showPathClosed && inspected[0].closed === true;
	const showStroke =
		!isKanbanOnly && !isTextOnly && !isEditingTextContext && !isStickyNoteOnly;

	const currentStroke = mindmapBranchRoot
		? mindmapBranchRoot.stroke
		: selectedTemplateSection
			? selectedTemplateSection.templateAccent
			: hasInspectionTarget
				? inspected[0].stroke
				: store.strokeColor;

	const currentFill =
		selectedTemplateSection?.stickyColor ??
		(hasInspectionTarget ? inspected[0].fill : store.fillColor);

	const currentStrokeWidth = hasInspectionTarget
		? inspected[0].strokeWidth
		: store.strokeWidth;
	const currentStrokeStyle = hasInspectionTarget
		? (inspected[0].strokeStyle ?? "solid")
		: store.strokeStyle;
	const currentOpacity = hasInspectionTarget ? inspected[0].opacity : 100;

	const cornerRadiusRectangle =
		singleGeometryElement?.type === "rectangle"
			? singleGeometryElement
			: hasInspectionTarget
				? inspected.find(
						(el) =>
							el.type === "rectangle" &&
							el.customData?.skedraType !== "sticky-note",
					)
				: null;

	const cornerRadiusWidth = cornerRadiusRectangle
		? Math.max(1, Math.round(cornerRadiusRectangle.width))
		: geometryPresetTool === "rectangle"
			? Math.max(1, store.shapePresetWidth)
			: 160;

	const cornerRadiusHeight = cornerRadiusRectangle
		? Math.max(1, Math.round(cornerRadiusRectangle.height))
		: geometryPresetTool === "rectangle"
			? Math.max(1, store.shapePresetHeight)
			: 160;

	const currentCornerRadiusPercent = cornerRadiusRectangle
		? getCornerRadiusPercent(cornerRadiusRectangle)
		: store.cornerRadiusPercent;

	const isCornerPresetActive = (percent: number) =>
		Math.abs(currentCornerRadiusPercent - percent) <= 2 ||
		(percent === 100 && currentCornerRadiusPercent >= 98);

	const currentRoughness = hasInspectionTarget
		? (inspected[0].roughness ?? 0)
		: store.roughness;
	const currentRoughFillStyle = hasInspectionTarget
		? (inspected[0].roughFillStyle ?? DEFAULT_ROUGH_FILL_STYLE)
		: store.roughFillStyle;
	const currentRoughFillScale = hasInspectionTarget
		? (inspected[0].roughFillScale ?? DEFAULT_ROUGH_FILL_SCALE)
		: store.roughFillScale;
	const showRoughFillScale =
		showGeometryFill && currentRoughFillStyle !== "solid";
	const roughFillScalePercent = Math.round(currentRoughFillScale * 100);

	const currentArrowMode = hasInspectionTarget
		? (inspected[0].arrowMode ?? "straight")
		: store.arrowMode;
	const currentArrowHeadStart = hasInspectionTarget
		? (inspected[0].arrowHeadStart ?? "none")
		: store.arrowHeadStart;
	const currentArrowHeadEnd = hasInspectionTarget
		? (inspected[0].arrowHeadEnd ?? "arrow")
		: store.arrowHeadEnd;
	const currentArrowHeadScale = hasInspectionTarget
		? (inspected[0].arrowHeadScale ?? DEFAULT_ARROW_HEAD_SCALE)
		: store.arrowHeadScale;
	const currentArrowHeadFilled = hasInspectionTarget
		? (inspected[0].arrowHeadFilled ?? DEFAULT_ARROW_HEAD_FILLED)
		: store.arrowHeadFilled;
	const showArrowHeadScale =
		isArrowElement &&
		(currentArrowHeadStart !== "none" || currentArrowHeadEnd !== "none");
	const showArrowHeadFill =
		isArrowElement &&
		(currentArrowHeadStart === "triangle" ||
			currentArrowHeadStart === "dot" ||
			currentArrowHeadEnd === "triangle" ||
			currentArrowHeadEnd === "dot");

	const livePathTextElement = inspectedPathTextElements[0]
		? (elements.get(inspectedPathTextElements[0].id) ??
			inspectedPathTextElements[0])
		: null;
	const livePathTextCustomData = readElementCustomData(
		livePathTextElement?.customData,
	);

	const currentArrowTextSide = showArrowTextPosition
		? editingTextId &&
			inspectedPathTextElements.length === 1 &&
			editingArrowTextSide
			? editingArrowTextSide
			: ((livePathTextCustomData.arrowTextSide as ArrowTextSide | undefined) ??
				"above")
		: "above";

	const currentArrowTextOrientation = showArrowTextPosition
		? editingTextId &&
			inspectedPathTextElements.length === 1 &&
			editingArrowTextOrientation
			? editingArrowTextOrientation
			: ((livePathTextCustomData.arrowTextOrientation as
					| ArrowTextOrientation
					| undefined) ?? "horizontal")
		: "horizontal";

	const currentFontFamily = hasInspectionTarget
		? (inspected[0].fontFamily ?? CANVAS_DEFAULT_FONT)
		: CANVAS_DEFAULT_FONT;
	const currentFontSize = hasInspectionTarget
		? (inspected[0].fontSize ?? 18)
		: 18;
	const currentTextAlign = hasInspectionTarget
		? (inspected[0].textAlign ?? "left")
		: "left";
	const currentFontWeight = hasInspectionTarget
		? (inspected[0].fontWeight ?? "normal")
		: "normal";
	const currentFontStyle = hasInspectionTarget
		? (inspected[0].fontStyle ?? "normal")
		: "normal";
	const currentTextDecoration = hasInspectionTarget
		? (inspected[0].textDecoration ?? "none")
		: "none";
	const currentTextColor = hasInspectionTarget
		? (inspected[0].textColor ?? inspected[0].stroke)
		: (pendingText?.textColor ?? pendingText?.stroke ?? store.strokeColor);

	const isKanbanCardSelection =
		hasSelection &&
		selected.every((el) => el.customData?.skedraType === "kanban-card");
	const currentPriority = isKanbanCardSelection
		? ((selected[0].customData?.priority as
				| KanbanPriority
				| null
				| undefined) ?? null)
		: null;
	const isKanbanListSelection =
		hasSelection &&
		selected.length === 1 &&
		selected[0].customData?.skedraType === "kanban-list";
	const kanbanList = isKanbanListSelection ? selected[0] : null;

	/* Einzelner einfacher Frame: Frame-Optionen (Name, Presets) anzeigen. */
	const frameElement =
		!isEditingTextContext &&
		selected.length === 1 &&
		isPlainCanvasFrame(selected[0])
			? selected[0]
			: null;
	/* Frame-Werkzeug aktiv ohne Selektion: Presets zum Platzieren anbieten. */
	const framePresetToolActive =
		!isEditingTextContext && !hasSelection && activeTool === "frame";

	const templateSection = selectedTemplateSection;
	const templateNotes = hasSelection
		? selected.map((el) => getTemplateStickyNoteMeta(el))
		: [];
	const isTemplateNoteSelection =
		hasSelection && templateNotes.every((entry) => entry != null);
	const templateNoteMeta = isTemplateNoteSelection ? templateNotes[0] : null;

	const flowchartNode =
		hasSelection && selected.length === 1 ? selected[0] : null;
	const flowchartNodeMeta = getFlowchartNodeMeta(flowchartNode);
	const flowchartConnector =
		hasSelection && selected.length === 1 ? selected[0] : null;
	const flowchartConnectorMeta = getFlowchartConnectorMeta(flowchartConnector);

	return {
		hasSelection,
		hasInspectionTarget,
		inspected,
		isEditingTextContext,
		mindmapBranchRoot,
		inspectedPathTextElements,
		selectedTemplateSection,
		shouldRender,
		activeTool,
		isTextOnly,
		isLineType,
		hasShapeElement,
		isKanbanOnly,
		isStickyNoteOnly,
		currentStickyNoteMode,
		showFill,
		showGeometryFill,
		showBackgroundFill,
		showStrokeWidth,
		showStrokeStyle,
		isFrameOnly,
		showRoughness,
		showCornerRadius,
		geometryPresetTool,
		singleGeometryElement,
		showDimensions,
		hasTextElement,
		isPathElement,
		isArrowElement,
		showPathClosed,
		currentPathClosed,
		showArrowTextPosition,
		showPathDrawMode,
		showStroke,
		currentStroke,
		currentFill,
		currentStrokeWidth,
		currentStrokeStyle,
		currentOpacity,
		cornerRadiusWidth,
		cornerRadiusHeight,
		currentCornerRadiusPercent,
		isCornerPresetActive,
		currentRoughness,
		currentRoughFillStyle,
		showRoughFillScale,
		roughFillScalePercent,
		currentArrowMode,
		currentArrowHeadStart,
		currentArrowHeadEnd,
		currentArrowHeadScale,
		currentArrowHeadFilled,
		showArrowHeadScale,
		showArrowHeadFill,
		currentArrowTextSide,
		currentArrowTextOrientation,
		currentFontFamily,
		currentFontSize,
		currentTextAlign,
		currentFontWeight,
		currentFontStyle,
		currentTextDecoration,
		currentTextColor,
		isKanbanCardSelection,
		currentPriority,
		isKanbanListSelection,
		kanbanList,
		frameElement,
		framePresetToolActive,
		templateSection,
		isTemplateNoteSelection,
		templateNoteMeta,
		flowchartNode,
		flowchartNodeMeta,
		flowchartConnector,
		flowchartConnectorMeta,
	};
}

export function usePropertiesPanelDerivations(
	input: PropertiesPanelDerivationsInput,
) {
	const {
		store,
		elements,
		selected,
		inspected,
		pendingText,
		editingTextId,
		editingArrowTextSide,
		editingArrowTextOrientation,
	} = input;
	return useMemo(
		() =>
			derivePropertiesPanelState({
				store,
				elements,
				selected,
				inspected,
				pendingText,
				editingTextId,
				editingArrowTextSide,
				editingArrowTextOrientation,
			}),
		[
			store,
			elements,
			selected,
			inspected,
			pendingText,
			editingTextId,
			editingArrowTextSide,
			editingArrowTextOrientation,
		],
	);
}
