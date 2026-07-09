import { mergeElementCustomData } from "@/lib/canvas/custom-data-utils";
import {
	type StickyChecklistItem,
	type StickyNoteMode,
	sanitizeStickyChecklistForStorage,
} from "@/lib/canvas/sticky-note-utils";
import { useI18n } from "@/lib/i18n";
import type { ArrowTextOrientation, ArrowTextSide } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasStore, CanvasSync } from "../canvas-tool-types";
import type { EditingText, PendingText } from "../text-editor";
import { buildEditingTextSession } from "./text-editing-builders";
import { buildTextElementUpdate } from "./text-element-updates";

interface UseCanvasTextEditingOptions {
	sync: CanvasSync;
	store: CanvasStore;
}

const SHAPE_TEXT_TYPES = new Set([
	"text",
	"rectangle",
	"ellipse",
	"diamond",
	"frame",
	"line",
	"arrow",
]);

export function isTextEditableElement(element: CanvasElement) {
	return SHAPE_TEXT_TYPES.has(element.type);
}

export function useCanvasTextEditing({
	sync,
	store,
}: UseCanvasTextEditingOptions) {
	const { t } = useI18n();
	const [pendingText, setPendingText] = useState<PendingText | null>(null);
	const [editingText, setEditingText] = useState<EditingText | null>(null);
	const [editingStickyChecklist, setEditingStickyChecklist] = useState<
		StickyChecklistItem[]
	>([]);
	const [editingStickyNoteMode, setEditingStickyNoteMode] =
		useState<StickyNoteMode>("note");
	const [editingArrowTextSide, setEditingArrowTextSide] =
		useState<ArrowTextSide | null>(null);
	const [editingArrowTextOrientation, setEditingArrowTextOrientation] =
		useState<ArrowTextOrientation | null>(null);
	const textEditorOpen = pendingText != null || editingText != null;
	const commitTextEditorRef = useRef<(() => void) | null>(null);
	/** Verhindert, dass ein Doppelklick zum Speichern den Editor sofort wieder oeffnet */
	const suppressTextEditOpenUntilRef = useRef(0);

	const registerTextEditorCommit = useCallback(
		(commit: (() => void) | null) => {
			commitTextEditorRef.current = commit;
		},
		[],
	);

	const markTextEditJustCommitted = useCallback(() => {
		suppressTextEditOpenUntilRef.current = performance.now() + 450;
	}, []);

	const handleCommitTextEditor = useCallback(() => {
		commitTextEditorRef.current?.();
	}, []);

	const handleCreateText = useCallback(
		(
			text: string,
			position: PendingText,
			size: { width: number; height: number },
		) => {
			const id = nanoid();
			sync.createElement({
				id,
				type: "text",
				x: position.x,
				y: position.y,
				width: size.width,
				height: size.height,
				rotation: 0,
				fill: "transparent",
				stroke: position.stroke,
				strokeWidth: 1,
				strokeStyle: "solid",
				opacity: 100,
				locked: false,
				groupId: null,
				flipX: false,
				flipY: false,
				text,
				textColor: position.textColor ?? position.stroke,
				fontSize: position.fontSize,
				fontFamily: position.fontFamily,
				textAlign: position.textAlign ?? "left",
				fontWeight: position.fontWeight ?? "normal",
				fontStyle: position.fontStyle ?? "normal",
				textDecoration: position.textDecoration ?? "none",
			});
			store.setSelectedIds(new Set([id]));
		},
		[sync, store],
	);

	const handleUpdatePendingText = useCallback(
		(updates: Partial<PendingText>) => {
			setPendingText((current) =>
				current ? { ...current, ...updates } : current,
			);
		},
		[],
	);

	const handleUpdateEditingText = useCallback(
		(updates: Partial<EditingText>) => {
			setEditingText((current) =>
				current ? { ...current, ...updates } : current,
			);
		},
		[],
	);

	const handleUpdateStickyNote = useCallback(
		(
			id: string,
			mode: StickyNoteMode,
			text: string,
			checklist: StickyChecklistItem[],
		) => {
			const el = sync.elements.get(id);
			if (!el) return;
			sync.updateElement(id, {
				text,
				customData: mergeElementCustomData(el.customData, {
					skedraType: "sticky-note",
					stickyNoteMode: mode,
					stickyChecklist:
						mode === "checklist"
							? sanitizeStickyChecklistForStorage(checklist)
							: [],
				}),
			});
		},
		[sync],
	);

	const handleUpdateText = useCallback(
		(id: string, text: string, size: { width: number; height: number }) => {
			const el = sync.elements.get(id);
			if (!el) return;
			sync.updateElement(
				id,
				buildTextElementUpdate({
					element: el,
					text,
					size,
					arrowTextSide: editingArrowTextSide,
					arrowTextOrientation: editingArrowTextOrientation,
				}),
			);
		},
		[sync, editingArrowTextSide, editingArrowTextOrientation],
	);

	const handleCloseTextEditor = useCallback(() => {
		setPendingText(null);
		setEditingText(null);
		setEditingStickyChecklist([]);
		setEditingArrowTextSide(null);
		setEditingArrowTextOrientation(null);
		store.setEditingTextId(null);
	}, [store]);

	const handleCloseTextEditorAfterSave = useCallback(() => {
		markTextEditJustCommitted();
		handleCloseTextEditor();
	}, [handleCloseTextEditor, markTextEditJustCommitted]);

	useEffect(() => {
		const editId = store.editingTextId;
		if (!editId) return;
		const el = sync.elements.get(editId);
		if (!el) return;

		const session = buildEditingTextSession({
			element: el,
			arrowTextSide: editingArrowTextSide,
			arrowTextOrientation: editingArrowTextOrientation,
			translate: t,
		});

		if (session.stickyNoteMode) {
			setEditingStickyNoteMode(session.stickyNoteMode);
		}
		if (session.stickyChecklist) {
			setEditingStickyChecklist(session.stickyChecklist);
		}
		setEditingText(session.editingText);
	}, [
		store.editingTextId,
		sync.elements,
		editingArrowTextSide,
		editingArrowTextOrientation,
		t,
	]);

	return {
		pendingText,
		editingText,
		editingStickyChecklist,
		editingStickyNoteMode,
		editingArrowTextSide,
		editingArrowTextOrientation,
		textEditorOpen,
		startTextPlacement: setPendingText,
		handleCreateText,
		handleUpdatePendingText,
		handleUpdateEditingText,
		handleUpdateText,
		handleUpdateStickyNote,
		handleCloseTextEditor,
		handleCloseTextEditorAfterSave,
		handleCommitTextEditor,
		registerTextEditorCommit,
		shouldSuppressTextEditOpen: () =>
			performance.now() < suppressTextEditOpenUntilRef.current,
		setEditingArrowTextSide,
		setEditingArrowTextOrientation,
	};
}
