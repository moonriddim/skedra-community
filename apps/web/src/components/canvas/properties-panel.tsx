/**
 * Eigenschaften-Panel (links): Zeigt und aendert Eigenschaften
 * der selektierten Elemente oder die globalen Zeichenoptionen.
 */

import { useCanvasStore } from "@/hooks/use-canvas-store";
import { useI18n } from "@/lib/i18n";
import type { ArrowTextOrientation, ArrowTextSide } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import type { CanvasCommands } from "./canvas-commands";
import { AppearanceProperties } from "./properties-panel/appearance-properties";
import { ArrowProperties } from "./properties-panel/arrow-properties";
import { FlowchartProperties } from "./properties-panel/flowchart-properties";
import { KanbanProperties } from "./properties-panel/kanban-properties";
import { SelectionFooterProperties } from "./properties-panel/selection-footer";
import { StickyNoteProperties } from "./properties-panel/sticky-note-properties";
import { TemplateProperties } from "./properties-panel/template-properties";
import { TextStyleSection } from "./properties-panel/text-style-section";
import { usePropertiesPanel } from "./properties-panel/use-properties-panel";
import type { EditingText, PendingText } from "./text-editor";

interface PropertiesPanelProps {
	elements: Map<string, CanvasElement>;
	selectedIds: Set<string>;
	getViewportCenter: () => { x: number; y: number };
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
	onCreateElements: (elements: CanvasElement[]) => void;
	commands: Pick<
		CanvasCommands,
		| "addKanbanCard"
		| "addTemplateSticky"
		| "addFlowchartStep"
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
	commands,
}: PropertiesPanelProps) {
	const propertyFocus = useCanvasStore(
		useShallow((state) => ({
			propertyFocusHint: state.propertyFocusHint,
			clearPropertyFocus: state.clearPropertyFocus,
		})),
	);
	const { t } = useI18n();

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

	/** Tastatur S/G/Shift+F: zum passenden Eigenschaften-Abschnitt scrollen */
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
		<div
			data-text-editor-safe="true"
			className="absolute top-14 left-3 z-40 w-[min(16rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-card/90 shadow-xl backdrop-blur-md p-2.5 space-y-2.5 text-card-foreground text-xs select-none"
			onWheel={(e) => e.stopPropagation()}
		>
			{panel.isStickyNoteOnly && (
				<StickyNoteProperties
					currentMode={panel.currentStickyNoteMode}
					currentFill={panel.currentFill}
					onModeChange={panel.setStickyNoteMode}
					onFillChange={(color) => panel.setProperty("fill", color)}
				/>
			)}

			<KanbanProperties
				selected={panel.selected}
				isKanbanListSelection={panel.isKanbanListSelection}
				isKanbanCardSelection={panel.isKanbanCardSelection}
				kanbanList={panel.kanbanList}
				currentPriority={panel.currentPriority}
				onSetPriority={panel.setKanbanPriority}
				onOpenListDetail={panel.openKanbanListDetail}
				onAddCardToList={panel.addCardToList}
				onOpenCardDetail={panel.openKanbanDetail}
			/>

			<TemplateProperties
				templateSection={panel.templateSection}
				templateNoteMeta={panel.templateNoteMeta}
				isTemplateNoteSelection={panel.isTemplateNoteSelection}
				selectedCount={panel.selected.length}
				onAddTemplateNote={panel.addTemplateNote}
			/>

			<FlowchartProperties
				flowchartNode={panel.flowchartNode}
				flowchartNodeMeta={panel.flowchartNodeMeta}
				flowchartConnector={panel.flowchartConnector}
				flowchartConnectorMeta={panel.flowchartConnectorMeta}
				flowchartInsertKind={panel.flowchartInsertKind}
				onSetInsertKind={panel.setFlowchartInsertKind}
				onEditNodeText={panel.editFlowchartNodeText}
				onSetNodeKind={panel.setFlowchartNodeKind}
				onAddNodeOnSide={panel.addFlowchartNodeOnSide}
				onSetConnectorLabel={panel.setFlowchartConnectorLabel}
				onEditConnectorLabel={panel.editFlowchartConnectorLabel}
			/>

			<AppearanceProperties
				showStroke={panel.showStroke}
				isTextOnly={panel.isTextOnly}
				mindmapBranchRoot={panel.mindmapBranchRoot}
				selectedTemplateSection={panel.selectedTemplateSection}
				currentStroke={panel.currentStroke}
				showBackgroundFill={panel.showBackgroundFill}
				currentFill={panel.currentFill}
				showGeometryFill={panel.showGeometryFill}
				currentRoughFillStyle={panel.currentRoughFillStyle}
				showRoughFillScale={panel.showRoughFillScale}
				roughFillScalePercent={panel.roughFillScalePercent}
				showStrokeWidth={panel.showStrokeWidth}
				currentStrokeWidth={panel.currentStrokeWidth}
				showStrokeStyle={panel.showStrokeStyle}
				currentStrokeStyle={panel.currentStrokeStyle}
				showRoughness={panel.showRoughness}
				currentRoughness={panel.currentRoughness}
				showCornerRadius={panel.showCornerRadius}
				currentCornerRadiusPercent={panel.currentCornerRadiusPercent}
				cornerRadiusWidth={panel.cornerRadiusWidth}
				cornerRadiusHeight={panel.cornerRadiusHeight}
				isCornerPresetActive={panel.isCornerPresetActive}
				showDimensions={panel.showDimensions}
				singleGeometryElement={panel.singleGeometryElement}
				geometryPresetTool={panel.geometryPresetTool}
				currentShapeWidth={panel.currentShapeWidth}
				currentShapeHeight={panel.currentShapeHeight}
				ellipseDiameter={panel.ellipseDiameter}
				currentOpacity={panel.currentOpacity}
				strokeColors={panel.strokeColors}
				onPropertyChange={panel.setProperty}
				onSetSingleGeometryWidth={panel.setSingleGeometryWidth}
				onSetSingleGeometryHeight={panel.setSingleGeometryHeight}
				onSetPerfectCircleDiameter={panel.setPerfectCircleDiameter}
				onStartPresetGeometryPlacement={panel.startPresetGeometryPlacement}
			/>

			<ArrowProperties
				showPathDrawMode={panel.showPathDrawMode}
				isArrowElement={panel.isArrowElement}
				showArrowTextPosition={panel.showArrowTextPosition}
				pathDrawMode={panel.pathDrawMode}
				currentArrowMode={panel.currentArrowMode}
				currentArrowHeadStart={panel.currentArrowHeadStart}
				currentArrowHeadEnd={panel.currentArrowHeadEnd}
				currentArrowHeadScale={panel.currentArrowHeadScale}
				showArrowHeadScale={panel.showArrowHeadScale}
				currentArrowTextSide={panel.currentArrowTextSide}
				currentArrowTextOrientation={panel.currentArrowTextOrientation}
				onPathDrawModeChange={panel.setPathDrawMode}
				onPropertyChange={panel.setProperty}
				onArrowTextSideChange={panel.setArrowTextSide}
				onArrowTextOrientationChange={panel.setArrowTextOrientation}
			/>

			{panel.hasTextElement && (
				<div data-property-focus="font">
					<TextStyleSection
						strokeColors={panel.strokeColors}
						currentTextColor={panel.currentTextColor}
						currentFontFamily={panel.currentFontFamily}
						currentFontSize={panel.currentFontSize}
						currentTextAlign={panel.currentTextAlign}
						currentFontWeight={panel.currentFontWeight}
						currentFontStyle={panel.currentFontStyle}
						currentTextDecoration={panel.currentTextDecoration}
						textColorLabel={t("canvas.properties.textColor")}
						onTextColorChange={(color) => panel.setProperty("textColor", color)}
						onFontFamilyChange={(fontFamily) =>
							panel.setProperty("fontFamily", fontFamily)
						}
						onFontSizeChange={(fontSize) =>
							panel.setProperty("fontSize", fontSize)
						}
						onTextAlignChange={(textAlign) =>
							panel.setProperty("textAlign", textAlign)
						}
						onFontWeightChange={(fontWeight) =>
							panel.setProperty("fontWeight", fontWeight)
						}
						onFontStyleChange={(fontStyle) =>
							panel.setProperty("fontStyle", fontStyle)
						}
						onTextDecorationChange={(textDecoration) =>
							panel.setProperty("textDecoration", textDecoration)
						}
					/>
				</div>
			)}

			<SelectionFooterProperties
				hasSelection={panel.hasSelection}
				selectedIds={selectedIds}
				canvasBgOptions={panel.canvasBgOptions}
				onBringForward={onBringForward}
				onSendBackward={onSendBackward}
				onBringToFront={onBringToFront}
				onSendToBack={onSendToBack}
				onCopy={onCopy}
				onDeleteElements={onDeleteElements}
				onAddLink={onAddLink}
			/>
		</div>
	);
}
