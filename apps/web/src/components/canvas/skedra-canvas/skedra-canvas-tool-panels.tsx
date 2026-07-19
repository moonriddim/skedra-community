/**
 * Toolbar, Eigenschaften-Panel und seitliche Werkzeug-Panels.
 */

import type { CanvasCommands } from "@/components/canvas/canvas-commands";
import { CanvasToolbar } from "@/components/canvas/canvas-toolbar";
import { PropertiesPanel } from "@/components/canvas/properties-panel";
import { useCanvasStore } from "@/hooks/use-canvas-store";
import type { useCommunityCanvasKeyboardAdapter as useCanvasKeyboard } from "@/hooks/use-community-canvas-keyboard-adapter";
import type { ImageUploadOptions } from "@/lib/canvas/image-utils";
import { useI18n } from "@/lib/i18n";
import {
	type CanvasElement,
	type CanvasMutationPlan,
	type KanbanAssignmentOptions,
	getSequenceDiagramElementMeta,
} from "@skedra/canvas-core";
import type { CanvasEditorPendingText as PendingText } from "@skedra/canvas-editor";
import { PaintBucket, Pencil, SlidersHorizontal } from "lucide-react";
import {
	type ComponentProps,
	Suspense,
	lazy,
	memo,
	useEffect,
	useRef,
	useState,
} from "react";
import { useShallow } from "zustand/react/shallow";

const LayersPanel = lazy(() =>
	import("@/components/canvas/layers-panel").then((m) => ({
		default: m.LayersPanel,
	})),
);
const WireframePanel = lazy(() =>
	import("@/components/canvas/wireframe-panel").then((m) => ({
		default: m.WireframePanel,
	})),
);
const SequenceDiagramPanel = lazy(() =>
	import("@/components/canvas/sequence-diagram-panel").then((m) => ({
		default: m.SequenceDiagramPanel,
	})),
);
const GanttPanel = lazy(() => import("@/components/canvas/gantt-panel"));
const StickyNoteTool = lazy(() =>
	import("@/components/whiteboard/sticky-note-tool").then((m) => ({
		default: m.StickyNoteTool,
	})),
);
const KanbanPanel = lazy(() =>
	import("@/components/whiteboard/kanban-panel").then((m) => ({
		default: m.KanbanPanel,
	})),
);
const KanbanCardDetailDialog = lazy(() =>
	import("@/components/whiteboard/kanban-card-detail-dialog").then((m) => ({
		default: m.KanbanCardDetailDialog,
	})),
);
const KanbanListDetailDialog = lazy(() =>
	import("@/components/whiteboard/kanban-list-detail-dialog").then((m) => ({
		default: m.KanbanListDetailDialog,
	})),
);

type KeyboardPanelApi = Pick<
	ReturnType<typeof useCanvasKeyboard>,
	| "bringForward"
	| "sendBackward"
	| "bringToFront"
	| "sendToBack"
	| "copySelection"
	| "addLink"
	| "flipHorizontal"
	| "flipVertical"
	| "toggleLock"
	| "groupSelection"
	| "ungroupSelection"
	| "alignSelection"
	| "distributeSelection"
>;

interface SkedraCanvasToolPanelsProps {
	showEditorChrome: boolean;
	showProperties: boolean;
	workspaceSlug?: string;
	sync: {
		elements: Map<string, CanvasElement>;
		createElement: (element: CanvasElement) => void;
		updateElement: (id: string, changes: Partial<CanvasElement>) => void;
		updateElements: (
			updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
		) => void;
		deleteElements: (ids: string[]) => void;
		applyMutationPlan: (plan: CanvasMutationPlan) => void;
	};
	stopUndoCapture: () => void;
	selectedIds: Set<string>;
	pendingText: PendingText | null;
	editingTextId: string | null;
	editingArrowTextSide: ComponentProps<
		typeof PropertiesPanel
	>["editingArrowTextSide"];
	editingArrowTextOrientation: ComponentProps<
		typeof PropertiesPanel
	>["editingArrowTextOrientation"];
	getViewportCenter: () => { x: number; y: number };
	addElements: (elements: CanvasElement[]) => void;
	fitElementsToViewport: (elements: CanvasElement[]) => void;
	handleUpdatePendingText: ComponentProps<
		typeof PropertiesPanel
	>["onUpdatePendingText"];
	handleUpdateEditingText: ComponentProps<
		typeof PropertiesPanel
	>["onUpdateEditingText"];
	setEditingArrowTextSide: ComponentProps<
		typeof PropertiesPanel
	>["onUpdateEditingArrowTextSide"];
	setEditingArrowTextOrientation: ComponentProps<
		typeof PropertiesPanel
	>["onUpdateEditingArrowTextOrientation"];
	deleteElementsWithKanbanReflow: (ids: string[]) => void;
	keyboard: KeyboardPanelApi;
	onExportSkedra: () => void;
	onExportEncryptedSkedra: () => void;
	onImportSkedra: () => void;
	onExportVisual: CanvasCommands["exportVisual"];
	imageUploadOptions?: ImageUploadOptions;
	resolveAssetUrl?: (src: string) => string;
	kanbanDetailId: string | null;
	kanbanListDetailId: string | null;
	setKanbanDetailId: (id: string | null) => void;
	setKanbanListDetailId: (id: string | null) => void;
	kanbanAssignmentOptions?: KanbanAssignmentOptions;
	onPresentationElementsPreview: (elements: CanvasElement[]) => void;
	commands: Pick<
		CanvasCommands,
		| "addKanbanCard"
		| "addTemplateSticky"
		| "addFlowchartStep"
		| "exportFrame"
		| "openKanbanCard"
		| "openKanbanList"
		| "showKanbanCardPlacementPreview"
		| "showStickyNotePlacementPreview"
	>;
}

export const SkedraCanvasToolPanels = memo(function SkedraCanvasToolPanels({
	showEditorChrome,
	showProperties,
	workspaceSlug,
	sync,
	stopUndoCapture,
	selectedIds,
	pendingText,
	editingTextId,
	editingArrowTextSide,
	editingArrowTextOrientation,
	getViewportCenter,
	addElements,
	fitElementsToViewport,
	handleUpdatePendingText,
	handleUpdateEditingText,
	setEditingArrowTextSide,
	setEditingArrowTextOrientation,
	deleteElementsWithKanbanReflow,
	keyboard,
	onExportSkedra,
	onExportEncryptedSkedra,
	onImportSkedra,
	onExportVisual,
	imageUploadOptions,
	resolveAssetUrl,
	kanbanDetailId,
	kanbanListDetailId,
	setKanbanDetailId,
	setKanbanListDetailId,
	kanbanAssignmentOptions,
	onPresentationElementsPreview,
	commands,
}: SkedraCanvasToolPanelsProps) {
	const { t } = useI18n();
	const [mobilePropertiesOpen, setMobilePropertiesOpen] = useState(false);
	const panelStore = useCanvasStore(
		useShallow((state) => ({
			activePanel: state.activePanel,
			activeTool: state.activeTool,
			fillColor: state.fillColor,
			strokeColor: state.strokeColor,
			clearSelection: state.clearSelection,
			clearStickyNotePlacementDraft: state.clearStickyNotePlacementDraft,
			setSelectedIds: state.setSelectedIds,
			setActivePanel: state.setActivePanel,
			setFillColor: state.setFillColor,
			setKanbanCardPlacementDraft: state.setKanbanCardPlacementDraft,
			setStrokeColor: state.setStrokeColor,
			setStickyNotePlacementDraft: state.setStickyNotePlacementDraft,
		})),
	);
	const activeTool = panelStore.activeTool;
	const elementsRef = useRef(sync.elements);
	useEffect(() => {
		elementsRef.current = sync.elements;
	}, [sync.elements]);

	useEffect(() => {
		if (activeTool) setMobilePropertiesOpen(false);
	}, [activeTool]);

	useEffect(() => {
		if (!showEditorChrome || activeTool !== "select") return;
		const elements = elementsRef.current;
		for (const id of selectedIds) {
			const element = elements.get(id);
			// Gantt charts intentionally do NOT auto-open their studio on plain
			// selection: bars stay directly draggable on the canvas. The studio
			// opens via toolbar or double-click (see use-canvas-double-click).
			if (!getSequenceDiagramElementMeta(element)) continue;
			if (useCanvasStore.getState().activePanel !== "sequence-diagram") {
				panelStore.setActivePanel("sequence-diagram");
			}
			break;
		}
	}, [activeTool, panelStore.setActivePanel, selectedIds, showEditorChrome]);

	return (
		<>
			{showEditorChrome && (
				<CanvasToolbar
					workspaceSlug={workspaceSlug}
					elements={sync.elements}
					addElements={addElements}
					getViewportCenter={getViewportCenter}
					onExportSkedra={onExportSkedra}
					onExportEncryptedSkedra={onExportEncryptedSkedra}
					onImportSkedra={onImportSkedra}
					onExportVisual={onExportVisual}
					imageUploadOptions={imageUploadOptions}
				/>
			)}

			{showProperties && (
				<>
					<div
						className="canvas-editor__mobile-style-bar"
						role="toolbar"
						aria-label={t("canvas.properties.appearance")}
					>
						<label
							className="canvas-editor__mobile-style-button"
							title={t("canvas.properties.stroke")}
						>
							<Pencil
								aria-hidden="true"
								style={{ color: panelStore.strokeColor }}
							/>
							<input
								type="color"
								value={panelStore.strokeColor}
								onChange={(event) =>
									panelStore.setStrokeColor(event.target.value)
								}
								aria-label={t("canvas.properties.stroke")}
							/>
						</label>
						<label
							className="canvas-editor__mobile-style-button"
							title={t("canvas.properties.roughFillStyle")}
						>
							<PaintBucket
								aria-hidden="true"
								style={{
									color:
										panelStore.fillColor === "transparent"
											? "var(--muted-foreground)"
											: panelStore.fillColor,
								}}
							/>
							<input
								type="color"
								value={
									panelStore.fillColor === "transparent"
										? "#ffffff"
										: panelStore.fillColor
								}
								onChange={(event) =>
									panelStore.setFillColor(event.target.value)
								}
								aria-label={t("canvas.properties.roughFillStyle")}
							/>
						</label>
						<button
							type="button"
							className="canvas-editor__mobile-style-button"
							data-active={mobilePropertiesOpen || undefined}
							onClick={() => setMobilePropertiesOpen((open) => !open)}
							aria-label={t("canvas.properties.appearance")}
							aria-expanded={mobilePropertiesOpen}
						>
							<SlidersHorizontal aria-hidden="true" />
						</button>
					</div>
					<PropertiesPanel
						className={
							mobilePropertiesOpen
								? "canvas-editor__properties--mobile-open"
								: undefined
						}
						elements={sync.elements}
						selectedIds={selectedIds}
						editingTextId={editingTextId}
						editingArrowTextSide={editingArrowTextSide}
						editingArrowTextOrientation={editingArrowTextOrientation}
						pendingText={pendingText}
						onUpdateElement={sync.updateElement}
						onUpdateElements={sync.updateElements}
						onUpdatePendingText={handleUpdatePendingText}
						onUpdateEditingText={handleUpdateEditingText}
						onUpdateEditingArrowTextSide={setEditingArrowTextSide}
						onUpdateEditingArrowTextOrientation={setEditingArrowTextOrientation}
						onDeleteElements={(ids) => {
							deleteElementsWithKanbanReflow(ids);
							panelStore.clearSelection();
						}}
						onBringForward={keyboard.bringForward}
						onSendBackward={keyboard.sendBackward}
						onBringToFront={keyboard.bringToFront}
						onSendToBack={keyboard.sendToBack}
						onCopy={keyboard.copySelection}
						onAddLink={keyboard.addLink}
						onFlipHorizontal={keyboard.flipHorizontal}
						onFlipVertical={keyboard.flipVertical}
						onToggleLock={keyboard.toggleLock}
						onGroup={keyboard.groupSelection}
						onUngroup={keyboard.ungroupSelection}
						onAlign={keyboard.alignSelection}
						onDistribute={keyboard.distributeSelection}
						commands={commands}
					/>
				</>
			)}

			{showEditorChrome && panelStore.activePanel === "sticky" && (
				<Suspense fallback={null}>
					<StickyNoteTool
						onPlaceStickyNote={(color, pointer) => {
							panelStore.setStickyNotePlacementDraft({ color });
							panelStore.clearSelection();
							commands.showStickyNotePlacementPreview(pointer);
						}}
						onClose={() => {
							panelStore.clearStickyNotePlacementDraft();
							panelStore.setActivePanel(null);
						}}
					/>
				</Suspense>
			)}
			{showEditorChrome && panelStore.activePanel === "kanban" && (
				<Suspense fallback={null}>
					<KanbanPanel
						onAdd={addElements}
						getViewportCenter={getViewportCenter}
						onPlacePriorityCard={(priority, pointer) => {
							panelStore.setKanbanCardPlacementDraft({ priority });
							panelStore.clearSelection();
							commands.showKanbanCardPlacementPreview(pointer);
						}}
						onClose={() => panelStore.setActivePanel(null)}
					/>
				</Suspense>
			)}
			{showEditorChrome && panelStore.activePanel === "layers" && (
				<Suspense fallback={null}>
					<LayersPanel
						elements={sync.elements}
						updateElement={sync.updateElement}
						updateElements={sync.updateElements}
						onClose={() => panelStore.setActivePanel(null)}
					/>
				</Suspense>
			)}
			{showEditorChrome && panelStore.activePanel === "wireframe" && (
				<Suspense fallback={null}>
					<WireframePanel
						elements={sync.elements}
						selectedElements={Array.from(selectedIds)
							.map((id) => sync.elements.get(id))
							.filter((el): el is NonNullable<typeof el> => !!el)}
						onInsertElements={addElements}
						onFitElements={fitElementsToViewport}
						getViewportCenter={getViewportCenter}
						onClose={() => panelStore.setActivePanel(null)}
					/>
				</Suspense>
			)}
			{showEditorChrome && panelStore.activePanel === "sequence-diagram" && (
				<Suspense fallback={null}>
					<SequenceDiagramPanel
						elements={sync.elements}
						selectedElements={Array.from(selectedIds)
							.map((id) => sync.elements.get(id))
							.filter((el): el is NonNullable<typeof el> => !!el)}
						onApplyMutationPlan={sync.applyMutationPlan}
						onHistoryBoundary={stopUndoCapture}
						onSelectIds={panelStore.setSelectedIds}
						onFitElements={fitElementsToViewport}
						getViewportCenter={getViewportCenter}
						onClose={() => panelStore.setActivePanel(null)}
					/>
				</Suspense>
			)}
			{showEditorChrome && panelStore.activePanel === "gantt" && (
				<Suspense fallback={null}>
					<GanttPanel
						elements={sync.elements}
						selectedIds={selectedIds}
						onInsertElements={addElements}
						onApplyMutationPlan={sync.applyMutationPlan}
						onDeleteElements={sync.deleteElements}
						onHistoryBoundary={stopUndoCapture}
						onSelectIds={panelStore.setSelectedIds}
						onFitElements={fitElementsToViewport}
						getViewportCenter={getViewportCenter}
						onClose={() => panelStore.setActivePanel(null)}
					/>
				</Suspense>
			)}

			{kanbanDetailId && (
				<Suspense fallback={null}>
					<KanbanCardDetailDialog
						element={sync.elements.get(kanbanDetailId) ?? null}
						elements={sync.elements}
						assignmentOptions={kanbanAssignmentOptions}
						imageUploadOptions={imageUploadOptions}
						resolveAssetUrl={resolveAssetUrl}
						onClose={() => setKanbanDetailId(null)}
						onPreviewElements={onPresentationElementsPreview}
						onUpdate={sync.updateElement}
						onUpdateElements={sync.updateElements}
						onDelete={(id) => {
							deleteElementsWithKanbanReflow([id]);
							panelStore.clearSelection();
						}}
					/>
				</Suspense>
			)}

			{kanbanListDetailId && (
				<Suspense fallback={null}>
					<KanbanListDetailDialog
						element={sync.elements.get(kanbanListDetailId) ?? null}
						elements={sync.elements}
						imageUploadOptions={imageUploadOptions}
						resolveAssetUrl={resolveAssetUrl}
						onClose={() => setKanbanListDetailId(null)}
						onUpdate={sync.updateElement}
						onUpdateElements={sync.updateElements}
						onAddCard={commands.addKanbanCard}
					/>
				</Suspense>
			)}
		</>
	);
});
