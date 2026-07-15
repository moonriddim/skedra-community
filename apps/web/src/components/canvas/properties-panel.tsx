/**
 * Community adapter for the shared canvas-editor properties surface.
 * Collaboration state remains in the Web app; the UI and feature controls do not.
 */

import { useCanvasStore } from "@/hooks/use-canvas-store";
import { useI18n } from "@/lib/i18n";
import type { ArrowTextOrientation, ArrowTextSide } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import {
	type CanvasEditorAlignment,
	type CanvasEditorDistribution,
	CanvasEditorPropertiesPanel,
	type CanvasEditorEditingText as EditingText,
	type CanvasEditorPendingText as PendingText,
	buildCanvasEditorDefaultsElement,
} from "@skedra/canvas-editor";
import "@skedra/canvas-editor/style.css";
import { type CSSProperties, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import type { CanvasCommands } from "./canvas-commands";
import { usePropertiesPanel } from "./properties-panel/use-properties-panel";

const WEB_PROPERTIES_PANEL_STYLE = {
	"--skedra-sdk-panel": "var(--card)",
	"--skedra-sdk-panel-border": "var(--border-color)",
	"--skedra-sdk-text": "var(--card-foreground)",
	"--skedra-sdk-muted": "var(--muted-foreground)",
	"--skedra-sdk-primary": "var(--primary)",
	"--skedra-sdk-danger": "var(--destructive)",
} as CSSProperties;

interface PropertiesPanelProps {
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
	onDeleteElements: (ids: string[]) => void;
	onBringForward: () => void;
	onSendBackward: () => void;
	onBringToFront: () => void;
	onSendToBack: () => void;
	onCopy: () => void;
	onAddLink: () => void;
	onFlipHorizontal: () => void;
	onFlipVertical: () => void;
	onToggleLock: () => void;
	onGroup: () => void;
	onUngroup: () => void;
	onAlign: (alignment: CanvasEditorAlignment) => void;
	onDistribute: (axis: CanvasEditorDistribution) => void;
	commands: Pick<
		CanvasCommands,
		| "addKanbanCard"
		| "addTemplateSticky"
		| "addFlowchartStep"
		| "exportFrame"
		| "openKanbanCard"
		| "openKanbanList"
	>;
}

export function PropertiesPanel({
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
	onDeleteElements,
	onBringForward,
	onSendBackward,
	onBringToFront,
	onSendToBack,
	onCopy,
	onAddLink,
	onFlipHorizontal,
	onFlipVertical,
	onToggleLock,
	onGroup,
	onUngroup,
	onAlign,
	onDistribute,
	commands,
}: PropertiesPanelProps) {
	const { t } = useI18n();
	const propertyFocus = useCanvasStore(
		useShallow((state) => ({
			propertyFocusHint: state.propertyFocusHint,
			clearPropertyFocus: state.clearPropertyFocus,
			setCroppingImageId: state.setCroppingImageId,
		})),
	);

	const panel = usePropertiesPanel({
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
	});

	const defaultsElement = buildCanvasEditorDefaultsElement({
		tool: panel.activeTool,
		width: panel.currentShapeWidth,
		height: panel.currentShapeHeight,
		style: {
			stroke: panel.currentStroke,
			fill: panel.currentFill,
			strokeWidth: panel.currentStrokeWidth,
			strokeStyle: panel.currentStrokeStyle,
			opacity: panel.currentOpacity,
			cornerRadiusPercent: panel.currentCornerRadiusPercent,
			roughness: panel.currentRoughness,
			roughFillStyle: panel.currentRoughFillStyle,
			roughFillScale: panel.roughFillScalePercent / 100,
			cloudArcRadius: panel.currentCloudArcRadius,
			pyramidSections: panel.currentPyramidSections,
			arrowMode: panel.currentArrowMode,
			arrowHeadStart: panel.currentArrowHeadStart,
			arrowHeadEnd: panel.currentArrowHeadEnd,
			arrowHeadScale: panel.currentArrowHeadScale,
			arrowHeadFilled: panel.currentArrowHeadFilled,
			fontFamily: panel.currentFontFamily,
			fontSize: panel.currentFontSize,
			textAlign: panel.currentTextAlign,
			fontWeight: panel.currentFontWeight,
			fontStyle: panel.currentFontStyle,
			textDecoration: panel.currentTextDecoration,
			textColor: panel.currentTextColor,
		},
	});
	const editorSelection =
		panel.inspected.length > 0
			? panel.inspected
			: defaultsElement
				? [defaultsElement]
				: [];

	useEffect(() => {
		const hint = propertyFocus.propertyFocusHint;
		if (!hint) return;
		document
			.querySelector(`[data-property-focus="${hint}"]`)
			?.scrollIntoView({ behavior: "smooth", block: "nearest" });
		propertyFocus.clearPropertyFocus();
	}, [propertyFocus]);

	if (!panel.shouldRender) return null;

	return (
		<CanvasEditorPropertiesPanel
			selected={editorSelection}
			mode={panel.hasInspectionTarget ? "selection" : "defaults"}
			style={WEB_PROPERTIES_PANEL_STYLE}
			translate={(key, fallback, params) => {
				const translated = t(key, params);
				return translated === key ? fallback : translated;
			}}
			classicView={{
				selected: panel.selected,
				hasSelection: panel.hasSelection,
				isStickyNoteOnly: panel.isStickyNoteOnly,
				currentStickyNoteMode: panel.currentStickyNoteMode,
				isKanbanListSelection: panel.isKanbanListSelection,
				isKanbanCardSelection: panel.isKanbanCardSelection,
				kanbanList: panel.kanbanList,
				frameElement: panel.frameElement,
				framePresetToolActive: panel.framePresetToolActive,
				frameChildElements: panel.frameChildElements,
				onSetFrameLabel: panel.setFrameLabel,
				onRenameFrame: panel.startFrameRename,
				onSetFrameSize: panel.setFrameSize,
				onSetFrameChildConstraints: panel.setFrameChildConstraints,
				onApplyFramePreset: panel.applyFramePreset,
				onStartFramePresetPlacement: panel.startFramePresetPlacement,
				onExportFrame: panel.frameElement
					? (format) => {
							if (panel.frameElement) {
								void commands.exportFrame(panel.frameElement.id, format);
							}
						}
					: undefined,
				currentPriority: panel.currentPriority,
				templateSection: panel.templateSection,
				isTemplateNoteSelection: panel.isTemplateNoteSelection,
				templateNoteMeta: panel.templateNoteMeta,
				flowchartNode: panel.flowchartNode,
				flowchartNodeMeta: panel.flowchartNodeMeta,
				flowchartConnector: panel.flowchartConnector,
				flowchartConnectorMeta: panel.flowchartConnectorMeta,
				flowchartInsertKind: panel.flowchartInsertKind,
				showStroke: panel.showStroke,
				isTextOnly: panel.isTextOnly,
				hasMindmapBranch: panel.mindmapBranchRoot != null,
				selectedTemplateSection: panel.selectedTemplateSection,
				currentStroke: panel.currentStroke,
				showBackgroundFill: panel.showBackgroundFill,
				currentFill: panel.currentFill,
				showGeometryFill: panel.showGeometryFill,
				currentRoughFillStyle: panel.currentRoughFillStyle,
				showRoughFillScale: panel.showRoughFillScale,
				roughFillScalePercent: panel.roughFillScalePercent,
				showStrokeWidth: panel.showStrokeWidth,
				currentStrokeWidth: panel.currentStrokeWidth,
				showStrokeStyle: panel.showStrokeStyle,
				currentStrokeStyle: panel.currentStrokeStyle,
				showRoughness: panel.showRoughness,
				currentRoughness: panel.currentRoughness,
				showCornerRadius: panel.showCornerRadius,
				currentCornerRadiusPercent: panel.currentCornerRadiusPercent,
				cornerRadiusWidth: panel.cornerRadiusWidth,
				cornerRadiusHeight: panel.cornerRadiusHeight,
				showDimensions: panel.showDimensions,
				singleGeometryElement: panel.singleGeometryElement,
				geometryPresetTool: panel.geometryPresetTool,
				currentShapeWidth: panel.currentShapeWidth,
				currentShapeHeight: panel.currentShapeHeight,
				ellipseDiameter: panel.ellipseDiameter,
				showPyramidOptions: panel.showPyramidOptions,
				currentPyramidSections: panel.currentPyramidSections,
				showCloudArcRadius: panel.showCloudArcRadius,
				currentCloudArcRadius: panel.currentCloudArcRadius,
				currentOpacity: panel.currentOpacity,
				strokeColors: panel.strokeColors,
				showPathDrawMode: panel.showPathDrawMode,
				isCloudDrawMode: panel.isCloudDrawMode,
				isPathElement: panel.isPathElement,
				isArrowElement: panel.isArrowElement,
				showPathClosed: panel.showPathClosed,
				currentPathClosed: panel.currentPathClosed,
				showArrowTextPosition: panel.showArrowTextPosition,
				pathDrawMode: panel.pathDrawMode,
				currentArrowMode: panel.currentArrowMode,
				currentArrowHeadStart: panel.currentArrowHeadStart,
				currentArrowHeadEnd: panel.currentArrowHeadEnd,
				currentArrowHeadScale: panel.currentArrowHeadScale,
				currentArrowHeadFilled: panel.currentArrowHeadFilled,
				showArrowHeadScale: panel.showArrowHeadScale,
				showArrowHeadFill: panel.showArrowHeadFill,
				currentArrowTextSide: panel.currentArrowTextSide,
				currentArrowTextOrientation: panel.currentArrowTextOrientation,
				hasTextElement: panel.hasTextElement,
				currentTextColor: panel.currentTextColor,
				currentFontFamily: panel.currentFontFamily,
				currentFontSize: panel.currentFontSize,
				currentTextAlign: panel.currentTextAlign,
				currentFontWeight: panel.currentFontWeight,
				currentFontStyle: panel.currentFontStyle,
				currentTextDecoration: panel.currentTextDecoration,
				canvasBackground: panel.canvasBg,
				canvasBackgroundOptions: panel.canvasBgOptions,
				onSetStickyNoteMode: panel.setStickyNoteMode,
				onSetKanbanPriority: panel.setKanbanPriority,
				onOpenKanbanList: panel.openKanbanListDetail,
				onAddKanbanCard: panel.addCardToList,
				onOpenKanbanCard: panel.openKanbanDetail,
				onAddTemplateNote: panel.addTemplateNote,
				onSetFlowchartInsertKind: panel.setFlowchartInsertKind,
				onEditFlowchartNodeText: panel.editFlowchartNodeText,
				onSetFlowchartNodeKind: panel.setFlowchartNodeKind,
				onAddFlowchartNodeOnSide: panel.addFlowchartNodeOnSide,
				onSetFlowchartConnectorLabel: panel.setFlowchartConnectorLabel,
				onEditFlowchartConnectorLabel: panel.editFlowchartConnectorLabel,
				onSetProperty: panel.setProperty,
				onSetGeometryWidth: panel.setSingleGeometryWidth,
				onSetGeometryHeight: panel.setSingleGeometryHeight,
				onSetEllipseDiameter: panel.setPerfectCircleDiameter,
				onStartPresetGeometryPlacement: panel.startPresetGeometryPlacement,
				onPathDrawModeChange: panel.setPathDrawMode,
				onArrowTextSideChange: panel.setArrowTextSide,
				onArrowTextOrientationChange: panel.setArrowTextOrientation,
				onSetCanvasBackground: panel.setCanvasBg,
				onBringForward,
				onSendBackward,
				onBringToFront,
				onSendToBack,
				onAlign,
				onDistribute,
				onCopy,
				onDelete: () => onDeleteElements(Array.from(selectedIds)),
				onAddLink,
			}}
			canvasBackground={{
				value: panel.canvasBg,
				options: panel.canvasBgOptions,
				onChange: panel.setCanvasBg,
			}}
			pathDrawMode={panel.pathDrawMode}
			onPathDrawModeChange={panel.setPathDrawMode}
			onSetProperties={(properties) => {
				for (const [key, value] of Object.entries(properties)) {
					panel.setProperty(key as keyof CanvasElement, value);
				}
			}}
			onSetGeometryWidth={panel.setSingleGeometryWidth}
			onSetGeometryHeight={panel.setSingleGeometryHeight}
			onSetEllipseDiameter={panel.setPerfectCircleDiameter}
			onPlaceDefaultElement={
				panel.hasInspectionTarget
					? undefined
					: panel.startPresetGeometryPlacement
			}
			onDelete={() => onDeleteElements(Array.from(selectedIds))}
			onGroup={onGroup}
			onUngroup={onUngroup}
			onAlign={onAlign}
			onDistribute={onDistribute}
			onLayer={(command) => {
				if (command === "bring-forward") onBringForward();
				else if (command === "send-backward") onSendBackward();
				else if (command === "bring-to-front") onBringToFront();
				else onSendToBack();
			}}
			onFlip={(axis) =>
				axis === "horizontal" ? onFlipHorizontal() : onFlipVertical()
			}
			onLock={onToggleLock}
			onCropImage={(id, crop) => {
				const element = elements.get(id);
				if (!element) return;
				onUpdateElement(id, {
					customData: { ...(element.customData ?? {}), imageCrop: crop },
				});
			}}
			onStartImageCrop={propertyFocus.setCroppingImageId}
			onAddFlowchartStep={(nodeId, options) =>
				commands.addFlowchartStep(nodeId, options)
			}
			onSetFlowchartNodeKind={(_id, kind) => panel.setFlowchartNodeKind(kind)}
			flowchartInsertKind={panel.flowchartInsertKind}
			onFlowchartInsertKindChange={panel.setFlowchartInsertKind}
			onAddFlowchartNodeOnSide={panel.addFlowchartNodeOnSide}
			onEditFlowchartNodeText={panel.editFlowchartNodeText}
			onEditFlowchartConnectorLabel={panel.editFlowchartConnectorLabel}
			onSetFlowchartConnectorLabel={panel.setFlowchartConnectorLabel}
			onUpdateKanbanCard={(cardId, details) => {
				const element = elements.get(cardId);
				if (!element) return;
				onUpdateElement(cardId, {
					...(details.title !== undefined ? { text: details.title } : {}),
					customData: {
						...(element.customData ?? {}),
						skedraType: "kanban-card",
						...details,
					},
				});
			}}
			onUpdateKanbanList={(listId, details) => {
				const element = elements.get(listId);
				if (!element) return;
				onUpdateElement(listId, {
					...(details.name !== undefined ? { frameLabel: details.name } : {}),
					customData: {
						...(element.customData ?? {}),
						skedraType: "kanban-list",
						...details,
					},
				});
			}}
			onOpenKanbanCard={commands.openKanbanCard}
			onOpenKanbanList={commands.openKanbanList}
			onAddKanbanCard={commands.addKanbanCard}
			onAddTemplateSticky={commands.addTemplateSticky}
			onCopy={onCopy}
		/>
	);
}
