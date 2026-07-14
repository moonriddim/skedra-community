/**
 * Kontextmenue und Text-/Sticky-Editoren ueber dem Canvas.
 */

import { ContextMenu } from "@/components/canvas/context-menu";
import type { useCanvasTextEditing } from "@/components/canvas/hooks/use-canvas-text-editing";
import type { CanvasStoreState } from "@/hooks/use-canvas-store";
import type { useCommunityCanvasKeyboardAdapter as useCanvasKeyboard } from "@/hooks/use-community-canvas-keyboard-adapter";
import type {
	StickyChecklistItem,
	StickyNoteMode,
} from "@/lib/canvas/sticky-note-utils";
import type { CanvasElement } from "@skedra/canvas-core";
import {
	CanvasEditorStickyNoteOverlay,
	CanvasEditorTextOverlay,
} from "@skedra/canvas-editor";
import type { RefObject } from "react";

type TextEditingApi = Pick<
	ReturnType<typeof useCanvasTextEditing>,
	| "pendingText"
	| "editingText"
	| "editingStickyChecklist"
	| "editingStickyNoteMode"
	| "handleCreateText"
	| "handleUpdateText"
	| "handleUpdateStickyNote"
	| "handleCloseTextEditorAfterSave"
	| "registerTextEditorCommit"
>;

type KeyboardApi = Pick<
	ReturnType<typeof useCanvasKeyboard>,
	| "clipboardRef"
	| "formatClipboardRef"
	| "copySelection"
	| "cutSelection"
	| "pasteClipboard"
	| "duplicateSelection"
	| "copyFormat"
	| "pasteFormat"
	| "bringForward"
	| "sendBackward"
	| "bringToFront"
	| "sendToBack"
	| "flipHorizontal"
	| "flipVertical"
	| "addLink"
	| "toggleLock"
	| "embedInFrame"
	| "removeFromFrame"
	| "groupSelection"
	| "ungroupSelection"
>;

interface SkedraCanvasEditLayerProps {
	store: CanvasStoreState;
	svgRef: RefObject<SVGSVGElement | null>;
	viewport: CanvasStoreState["viewport"];
	contextMenu: { x: number; y: number } | null;
	selectedIds: Set<string>;
	selectedEls: CanvasElement[];
	isLocked: boolean;
	textEditorOpen: boolean;
	textEditing: TextEditingApi;
	keyboard: KeyboardApi;
	liveStickyNoteEditor: {
		mode: StickyNoteMode;
		text: string;
		checklist: StickyChecklistItem[];
	} | null;
	createMindmapSibling: (nodeId: string) => void;
	deleteElementsWithKanbanReflow: (ids: string[]) => void;
	elements: Map<string, CanvasElement>;
}

export function SkedraCanvasEditLayer({
	store,
	svgRef,
	viewport,
	contextMenu,
	selectedIds,
	selectedEls,
	isLocked,
	textEditorOpen,
	textEditing,
	keyboard,
	liveStickyNoteEditor,
	createMindmapSibling,
	deleteElementsWithKanbanReflow,
	elements,
}: SkedraCanvasEditLayerProps) {
	const {
		pendingText,
		editingText,
		editingStickyChecklist,
		editingStickyNoteMode,
		handleCreateText,
		handleUpdateText,
		handleUpdateStickyNote,
		handleCloseTextEditorAfterSave,
		registerTextEditorCommit,
	} = textEditing;

	return (
		<>
			{textEditorOpen &&
				(editingText?.variant === "sticky-note" ? (
					<CanvasEditorStickyNoteOverlay
						key={`${editingText.id}-${liveStickyNoteEditor?.mode ?? editingStickyNoteMode}`}
						editing={{
							...editingText,
							text: liveStickyNoteEditor?.text ?? editingText.text,
						}}
						stickyNoteMode={liveStickyNoteEditor?.mode ?? editingStickyNoteMode}
						stickyChecklist={
							liveStickyNoteEditor?.checklist ?? editingStickyChecklist
						}
						viewport={viewport}
						svgRef={svgRef}
						onUpdateStickyNote={handleUpdateStickyNote}
						onClose={handleCloseTextEditorAfterSave}
						onRegisterCommit={registerTextEditorCommit}
					/>
				) : (
					<CanvasEditorTextOverlay
						pending={pendingText}
						editing={editingText}
						viewport={viewport}
						svgRef={svgRef}
						onCreateText={handleCreateText}
						onUpdateText={handleUpdateText}
						onCreateSibling={createMindmapSibling}
						onClose={handleCloseTextEditorAfterSave}
						onRegisterCommit={registerTextEditorCommit}
					/>
				))}

			{contextMenu && (
				<ContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					hasSelection={selectedIds.size > 0}
					isLocked={isLocked}
					isInFrame={selectedEls.some((el) => !!el.frameId)}
					isGrouped={selectedEls.some((el) => !!el.groupId)}
					canPaste={keyboard.clipboardRef.current.length > 0}
					canPasteFormat={keyboard.formatClipboardRef.current !== null}
					onCopy={keyboard.copySelection}
					onCut={keyboard.cutSelection}
					onPaste={keyboard.pasteClipboard}
					onDuplicate={keyboard.duplicateSelection}
					onDelete={() => {
						deleteElementsWithKanbanReflow(Array.from(selectedIds));
						store.clearSelection();
					}}
					onSelectAll={() => store.setSelectedIds(new Set(elements.keys()))}
					onToggleLock={keyboard.toggleLock}
					onCopyFormat={keyboard.copyFormat}
					onPasteFormat={keyboard.pasteFormat}
					onBringForward={keyboard.bringForward}
					onSendBackward={keyboard.sendBackward}
					onBringToFront={keyboard.bringToFront}
					onSendToBack={keyboard.sendToBack}
					onFlipHorizontal={keyboard.flipHorizontal}
					onFlipVertical={keyboard.flipVertical}
					onAddLink={keyboard.addLink}
					onEmbedInFrame={keyboard.embedInFrame}
					onRemoveFromFrame={keyboard.removeFromFrame}
					onGroup={keyboard.groupSelection}
					onUngroup={keyboard.ungroupSelection}
					snapToObjects={store.snapToObjects}
					onToggleSnap={store.toggleSnapToObjects}
					showSnapPoints={store.showSnapPoints}
					onToggleSnapPoints={store.toggleShowSnapPoints}
					snapToCenters={store.snapToCenters}
					onToggleSnapCenters={store.toggleSnapToCenters}
					snapToMidpoints={store.snapToMidpoints}
					onToggleSnapMidpoints={store.toggleSnapToMidpoints}
					gridEnabled={store.gridEnabled}
					onToggleGrid={store.toggleGrid}
					onClose={() => store.setContextMenu(null)}
				/>
			)}
		</>
	);
}
