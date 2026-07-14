/**
 * Toolbar, Eigenschaften-Panel und seitliche Werkzeug-Panels.
 */

import type { CanvasCommands } from "@/components/canvas/canvas-commands";
import { CanvasToolbar } from "@/components/canvas/canvas-toolbar";
import { PropertiesPanel } from "@/components/canvas/properties-panel";
import { useCanvasStore } from "@/hooks/use-canvas-store";
import type { useCommunityCanvasKeyboardAdapter as useCanvasKeyboard } from "@/hooks/use-community-canvas-keyboard-adapter";
import type { ImageUploadOptions } from "@/lib/canvas/image-utils";
import type { KanbanAssignmentOptions } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import type { CanvasEditorPendingText as PendingText } from "@skedra/canvas-editor";
import { type ComponentProps, Suspense, lazy, memo } from "react";
import { useShallow } from "zustand/react/shallow";

const LibraryPanel = lazy(() =>
	import("@/components/canvas/library-panel").then((m) => ({
		default: m.LibraryPanel,
	})),
);
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
		updateElement: (id: string, changes: Partial<CanvasElement>) => void;
		updateElements: (
			updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
		) => void;
	};
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
	selectedIds,
	pendingText,
	editingTextId,
	editingArrowTextSide,
	editingArrowTextOrientation,
	getViewportCenter,
	addElements,
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
	const panelStore = useCanvasStore(
		useShallow((state) => ({
			activePanel: state.activePanel,
			clearSelection: state.clearSelection,
			clearStickyNotePlacementDraft: state.clearStickyNotePlacementDraft,
			setActivePanel: state.setActivePanel,
			setKanbanCardPlacementDraft: state.setKanbanCardPlacementDraft,
			setStickyNotePlacementDraft: state.setStickyNotePlacementDraft,
		})),
	);

	return (
		<>
			{showEditorChrome && (
				<CanvasToolbar
					workspaceSlug={workspaceSlug}
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
				<PropertiesPanel
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
			{showEditorChrome && panelStore.activePanel === "library" && (
				<Suspense fallback={null}>
					<LibraryPanel
						selectedElements={Array.from(selectedIds)
							.map((id) => sync.elements.get(id))
							.filter((el): el is NonNullable<typeof el> => !!el)}
						onInsertElements={addElements}
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
