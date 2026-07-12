/**
 * SkedraCanvas: Eigenes SVG-basiertes Whiteboard mit Echtzeit-Sync.
 * Respektiert das App-Theme (dark/light) ueber CSS-Variablen.
 */

import { useCanvasHistory } from "@/hooks/use-canvas-history";
import { useCanvasKeyboard } from "@/hooks/use-canvas-keyboard";
import { useCanvasPointer } from "@/hooks/use-canvas-pointer";
import {
	type CanvasStoreState,
	useCanvasStore,
	useCanvasStoreRef,
} from "@/hooks/use-canvas-store";
import { useE2eeCanvasSync } from "@/hooks/use-e2ee-canvas-sync";
import { useEncryptedAssetUrls } from "@/hooks/use-encrypted-asset-urls";
import { useLibraryDeepLink } from "@/hooks/use-library-deep-link";
import { useLocalCanvasSync } from "@/hooks/use-local-canvas-sync";
import { useServerCanvasSync } from "@/hooks/use-server-canvas-sync";
import type { AssetAccessTokens } from "@/lib/canvas/asset-urls";
import { mergeElementCustomData } from "@/lib/canvas/custom-data-utils";
import type { ImageUploadOptions } from "@/lib/canvas/image-utils";
import type { SkedraCanvasFileActions } from "@/lib/canvas/skedra-file-utils";
import {
	getStickyNoteContent,
	normalizeStickyChecklist,
	prepareStickyChecklistForEditing,
	toggleStickyChecklistItem,
} from "@/lib/canvas/sticky-note-utils";
import { useI18n } from "@/lib/i18n";
import type { MentionCandidate } from "@/lib/mention-utils";
import { trpc } from "@/lib/trpc";
import {
	getFlowchartNodeMeta,
	isFlowchartNode,
	isMindmapNode,
} from "@skedra/canvas-core";
import type { KanbanAssignmentOptions } from "@skedra/canvas-core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { useShallow } from "zustand/react/shallow";
import type { PendingCommentPlacement } from "../whiteboard/canvas-comment-layer";
import type { WhiteboardCommentThread } from "../whiteboard/whiteboard-comment-types";
import { type CanvasCommands, CanvasCommandsProvider } from "./canvas-commands";
import { CanvasStage } from "./canvas-stage";
import { hasCanvasToolProperties } from "./canvas-tool-types";
import { useCanvasAddElements } from "./hooks/use-canvas-add-elements";
import { useCanvasDoubleClick } from "./hooks/use-canvas-double-click";
import { useCanvasSavedViews } from "./hooks/use-canvas-saved-views";
import { useCanvasTextEditing } from "./hooks/use-canvas-text-editing";
import { useFlowchartCanvasTool } from "./hooks/use-flowchart-canvas-tool";
import { useKanbanCanvasTool } from "./hooks/use-kanban-canvas-tool";
import { useMindmapCanvasTool } from "./hooks/use-mindmap-canvas-tool";
import { useSkedraCanvasActions } from "./hooks/use-skedra-canvas-actions";
import { useSkedraCanvasCommandPalette } from "./hooks/use-skedra-canvas-command-palette";
import { useSkedraCanvasEffects } from "./hooks/use-skedra-canvas-effects";
import { useSkedraCanvasPointerBridge } from "./hooks/use-skedra-canvas-pointer-bridge";
import { useSkedraFileActions } from "./hooks/use-skedra-file-actions";
import { useTemplateCanvasTool } from "./hooks/use-template-canvas-tool";
import { SkedraCanvasChrome } from "./skedra-canvas/skedra-canvas-chrome";
import { SkedraCanvasEditLayer } from "./skedra-canvas/skedra-canvas-edit-layer";
import { SkedraCanvasFileDialogs } from "./skedra-canvas/skedra-canvas-file-dialogs";
import { SkedraCanvasOverlays } from "./skedra-canvas/skedra-canvas-overlays";
import { SkedraCanvasToolPanels } from "./skedra-canvas/skedra-canvas-tool-panels";

interface SkedraCanvasProps {
	whiteboardId?: string;
	localMode?: boolean;
	getSaveStateRef?: React.MutableRefObject<(() => string | null) | null>;
	clearCanvasRef?: React.MutableRefObject<(() => void) | null>;
	canvasFileRef?: React.MutableRefObject<SkedraCanvasFileActions | null>;
	canvasCommandRef?: React.MutableRefObject<CanvasCommands | null>;
	e2eeStateRef?: React.MutableRefObject<(() => Uint8Array | null) | null>;
	/** Gast: Leeren erst nach Bestaetigung im Eltern-Dialog */
	onRequestClearCanvas?: () => void;
	/** Hilfe-Dialog: Skedra-Gast-Hinweise anzeigen */
	helpGuestMode?: boolean;
	/** KI-Panel (vom Board-Recht useAi) */
	canUseAi?: boolean;
	onElementCountChange?: (count: number) => void;
	workspaceSlug?: string;
	presentationMode?: boolean;
	presentationShareToken?: string;
	/** Gast über Kollaborations-Link (/collab/:token) */
	collabShareToken?: string;
	embedShareToken?: string;
	e2eeKey?: string | null;
	encryptionMode?: "server" | "e2ee";
	forceReadonly?: boolean;
	presenceEnabled?: boolean;
	presencePanelOffsetTop?: number;
	presencePanelOffsetRight?: number;
	presencePanelSummaryOffsetRight?: number;
	presencePanelLayout?: "card" | "column";
	kanbanAssignmentOptions?: KanbanAssignmentOptions;
	/** Editor im Presenter-Modus (?present=1) — Slides + Notes, Heartbeat extern */
	presenterMode?: boolean;
	presenterShareUrl?: string;
	presenterIsLive?: boolean;
	/** Audience-View (/present/:token) */
	audienceBoardName?: string;
	audienceIsLive?: boolean;
	/** Excalidraw-ähnliche Board-Kommentare (nur wenn gesetzt). */
	comments?: {
		threads: WhiteboardCommentThread[];
		selectedThreadId: string | null;
		pendingPlacement: PendingCommentPlacement | null;
		placementActive: boolean;
		showResolved: boolean;
		currentUser?: { id: string; name: string; image: string | null };
		mentionCandidates?: MentionCandidate[];
		canModerate?: boolean;
		canComment?: boolean;
		isSending?: boolean;
		deletingMessageId?: string | null;
		onSelectThread: (threadId: string | null) => void;
		onCanvasClick: (x: number, y: number) => void;
		onCreateThread: (body: string) => void;
		onReply: (threadId: string, body: string) => void;
		onResolve: (threadId: string, resolved: boolean) => void;
		onDeleteThread: (threadId: string) => void;
		onDeleteMessage: (messageId: string) => void;
		onCancelPlacement: () => void;
	};
	/** Springt im Canvas zu einer Welt-Position (z. B. aus der Kommentar-Sidebar). */
	focusCanvasPointRef?: React.MutableRefObject<
		((x: number, y: number) => void) | null
	>;
}

export function SkedraCanvas({
	whiteboardId,
	localMode = false,
	getSaveStateRef,
	clearCanvasRef,
	canvasFileRef,
	canvasCommandRef,
	e2eeStateRef,
	onRequestClearCanvas,
	helpGuestMode = false,
	canUseAi = true,
	onElementCountChange,
	workspaceSlug,
	presentationMode = false,
	presentationShareToken,
	collabShareToken,
	embedShareToken,
	e2eeKey,
	encryptionMode = "e2ee",
	forceReadonly,
	presenceEnabled = true,
	presencePanelOffsetTop,
	presencePanelOffsetRight,
	presencePanelSummaryOffsetRight,
	presencePanelLayout,
	kanbanAssignmentOptions,
	presenterMode = false,
	presenterShareUrl = "",
	presenterIsLive = false,
	audienceBoardName,
	audienceIsLive = false,
	comments,
	focusCanvasPointRef,
}: SkedraCanvasProps) {
	useLibraryDeepLink();

	const svgRef = useRef<SVGSVGElement>(null);
	const { t } = useI18n();
	const containerRef = useRef<HTMLDivElement>(null);
	const presentationModeAppliedRef = useRef(false);
	const previousLocalElementCountRef = useRef<number | null>(null);

	const [aiPanelOpen, setAiPanelOpen] = useState(false);
	const [presenterNotesOpen, setPresenterNotesOpen] = useState(presenterMode);
	const [helpDialogOpen, setHelpDialogOpen] = useState(false);

	const localSync = useLocalCanvasSync(localMode);
	const e2eeRemoteMode =
		!localMode && !!whiteboardId && encryptionMode === "e2ee";
	const serverRemoteMode =
		!localMode && !!whiteboardId && encryptionMode === "server";
	const { data: assetUploadConfig } = trpc.assets.getUploadConfig.useQuery(
		undefined,
		{ enabled: e2eeRemoteMode || serverRemoteMode },
	);
	const e2eeSync = useE2eeCanvasSync(
		whiteboardId ?? "00000000-0000-0000-0000-000000000000",
		{
			e2eeKey,
			enabled: e2eeRemoteMode,
			readonly:
				forceReadonly ??
				(presentationMode || !!presentationShareToken || !!embedShareToken),
			presentationShareToken,
			collabShareToken,
			embedShareToken,
		},
	);
	const serverSync = useServerCanvasSync(
		whiteboardId ?? "00000000-0000-0000-0000-000000000000",
		{
			enabled: serverRemoteMode,
			readonly:
				forceReadonly ??
				(presentationMode || !!presentationShareToken || !!embedShareToken),
			presentationShareToken,
			collabShareToken,
			embedShareToken,
		},
	);
	const sync = localMode
		? localSync
		: encryptionMode === "server"
			? serverSync
			: e2eeSync;
	const assetAccessTokens = useMemo<AssetAccessTokens>(
		() => ({
			presentationShareToken,
			collabShareToken,
			embedShareToken,
		}),
		[presentationShareToken, collabShareToken, embedShareToken],
	);
	const imageUploadOptions = useMemo<ImageUploadOptions>(
		() => ({
			whiteboardId,
			objectStorageEnabled:
				!!whiteboardId &&
				!!assetUploadConfig?.enabled &&
				(encryptionMode === "server" || !!e2eeKey),
			maxImageBytes: assetUploadConfig?.maxImageBytes,
			e2eeKey,
			encryptionMode,
			collabShareToken,
		}),
		[
			assetUploadConfig?.enabled,
			assetUploadConfig?.maxImageBytes,
			collabShareToken,
			e2eeKey,
			encryptionMode,
			whiteboardId,
		],
	);
	const resolveAssetUrl = useEncryptedAssetUrls({
		elements: sync.elements,
		whiteboardId,
		e2eeKey,
		tokens: assetAccessTokens,
	});
	const syncRef = useRef(sync);
	syncRef.current = sync;

	useEffect(() => {
		if (!e2eeStateRef) return;
		e2eeStateRef.current = () => {
			const ydoc = syncRef.current.getYDoc();
			return ydoc ? Y.encodeStateAsUpdate(ydoc) : null;
		};
		return () => {
			e2eeStateRef.current = null;
		};
	}, [e2eeStateRef]);

	useEffect(() => {
		if (!localMode || !getSaveStateRef) return;
		getSaveStateRef.current = () => localSync.getStateBase64();
		return () => {
			getSaveStateRef.current = null;
		};
	}, [getSaveStateRef, localMode, localSync.getStateBase64]);

	useEffect(() => {
		if (!localMode || !clearCanvasRef) return;
		clearCanvasRef.current = () => localSync.clearCanvas();
		return () => {
			clearCanvasRef.current = null;
		};
	}, [clearCanvasRef, localMode, localSync.clearCanvas]);

	useEffect(() => {
		onElementCountChange?.(sync.elements.size);
	}, [onElementCountChange, sync.elements.size]);

	const storeRef = useCanvasStoreRef();
	const storeSlice = useCanvasStore(
		useShallow((state) => ({
			activePanel: state.activePanel,
			activeTool: state.activeTool,
			canvasBg: state.canvasBg,
			commandPaletteOpen: state.commandPaletteOpen,
			contextMenu: state.contextMenu,
			croppingImageId: state.croppingImageId,
			editingTextId: state.editingTextId,
			flowchartInsertKind: state.flowchartInsertKind,
			gridEnabled: state.gridEnabled,
			isSpacePressed: state.isSpacePressed,
			selectedIds: state.selectedIds,
			showSnapPoints: state.showSnapPoints,
			snapToCenters: state.snapToCenters,
			snapToMidpoints: state.snapToMidpoints,
			snapToObjects: state.snapToObjects,
			strokeColor: state.strokeColor,
			viewport: state.viewport,
			zenMode: state.zenMode,
		})),
	);
	const store = { ...storeRef.current, ...storeSlice } as CanvasStoreState;
	const {
		viewport,
		selectedIds,
		contextMenu,
		canvasBg,
		flowchartInsertKind,
		zenMode,
		croppingImageId,
		commandPaletteOpen,
	} = store;
	const history = useCanvasHistory({
		getYDoc: sync.getYDoc,
		scopeKey: localMode ? "local" : (whiteboardId ?? "none"),
		isReady: sync.isConnected,
	});
	const {
		activeViewId,
		setActiveViewId,
		editingViewId,
		setEditingViewId,
		isCapturingView,
		setIsCapturingView,
		viewDraft,
		setViewDraft,
		viewInteractionRef,
		fitViewportToBounds,
		handleSelectView,
		handleStartEditView,
		handleStopEditView,
		handleRenameView,
		handleUpdatePresenterNotes,
		handleDeleteView,
		handleFitViewport,
		beginViewMove,
		beginViewResize,
		startViewCapture,
		handleViewPointerMove,
		handleViewPointerUp,
		resetViewsOnImport,
	} = useCanvasSavedViews({ svgRef, sync, store });
	const {
		importDialogOpen,
		setImportDialogOpen,
		fileError,
		setFileError,
		handleImportSkedra,
		handleExportSkedra,
		handleExportEncryptedSkedra,
		handleConfirmSkedraImport,
	} = useSkedraFileActions({
		sync,
		store,
		history,
		clearSelection: () => store.clearSelection(),
		localMode,
		whiteboardId,
		canvasFileRef,
		onImportApplied: resetViewsOnImport,
	});
	const savedViewList = Array.from(sync.views.values()).sort(
		(a, b) => a.createdAt - b.createdAt,
	);
	const activeView = activeViewId
		? (sync.views.get(activeViewId) ?? null)
		: null;
	const {
		setActivePanel,
		setContextMenu,
		setEditingTextId,
		clearSelection,
		setActiveTool,
	} = store;
	const {
		pendingText,
		editingText,
		editingStickyChecklist,
		editingStickyNoteMode,
		editingArrowTextSide,
		editingArrowTextOrientation,
		textEditorOpen,
		startTextPlacement,
		handleCreateText,
		handleUpdatePendingText,
		handleUpdateEditingText,
		handleUpdateText,
		handleUpdateStickyNote,
		handleCloseTextEditorAfterSave,
		handleCommitTextEditor,
		registerTextEditorCommit,
		shouldSuppressTextEditOpen,
		setEditingArrowTextSide,
		setEditingArrowTextOrientation,
	} = useCanvasTextEditing({ sync, store });
	const liveStickyNoteEditor =
		editingText?.variant === "sticky-note"
			? (() => {
					const el = sync.elements.get(editingText.id);
					if (!el) return null;
					const content = getStickyNoteContent(el);
					return {
						mode: content.mode,
						text: content.text,
						checklist:
							content.mode === "checklist"
								? prepareStickyChecklistForEditing(content.checklist)
								: [],
					};
				})()
			: null;
	const {
		kanbanDetailId,
		kanbanListDetailId,
		setKanbanDetailId,
		setKanbanListDetailId,
		addKanbanCard,
		deleteElementsWithKanbanReflow,
	} = useKanbanCanvasTool({ sync, store });

	useEffect(() => {
		if (!presentationMode && !presenterMode) {
			presentationModeAppliedRef.current = false;
			return;
		}
		if (presentationModeAppliedRef.current) return;
		presentationModeAppliedRef.current = true;
		setActivePanel(null);
		setContextMenu(null);
		setEditingTextId(null);
		clearSelection();
		setActiveTool("pan");
	}, [
		clearSelection,
		presentationMode,
		presenterMode,
		setActivePanel,
		setActiveTool,
		setContextMenu,
		setEditingTextId,
	]);

	useEffect(() => {
		if (presenterMode) {
			setPresenterNotesOpen(true);
		}
	}, [presenterMode]);

	const selectedEls = sync.scene.getSelectedElements(selectedIds);
	const selectedMindmapNode =
		selectedEls.length === 1 && isMindmapNode(selectedEls[0])
			? selectedEls[0]
			: null;
	const selectedFlowchartNode =
		selectedEls.length === 1 && isFlowchartNode(selectedEls[0])
			? selectedEls[0]
			: null;
	const isLocked =
		selectedEls.length > 0 && selectedEls.every((el) => el.locked);
	const editingView = editingViewId
		? (sync.views.get(editingViewId) ?? null)
		: null;
	const selectedFlowchartMeta = getFlowchartNodeMeta(selectedFlowchartNode);
	const {
		activeMindmapNode,
		createMindmapChild,
		createMindmapSibling,
		mindmapButtons,
		clearMindmapHoverLeaveTimeout,
		scheduleMindmapHoverClear,
		setHoveredMindmapNodeId,
		setHoveredMindmapButtonId,
	} = useMindmapCanvasTool({
		sync,
		store,
		viewport,
		selectedMindmapNode,
		textEditorOpen,
		presentationMode,
	});
	const { addFlowchartStep } = useFlowchartCanvasTool({
		sync,
		store,
	});
	const { addTemplateStickyNote } = useTemplateCanvasTool({ sync, store });

	const {
		getViewportCenter,
		fitSelectionViewport,
		handleInsertImage,
		handlePastePlainText,
		handleToggleTheme,
		handleRequestClearCanvas,
		handleStartImageCrop,
		handleFlowchartCreateStep,
		handleFlowchartNavigate,
		handleApplyImageCrop,
	} = useSkedraCanvasActions({
		svgRef,
		sync,
		store,
		localMode,
		localClearCanvas: localSync.clearCanvas,
		onRequestClearCanvas,
		imageUploadOptions,
		deleteElementsWithKanbanReflow,
		fitViewportToBounds,
		addFlowchartStep,
	});

	useEffect(() => {
		if (!activeViewId) return;
		if (!sync.views.has(activeViewId)) {
			setActiveViewId(null);
		}
	}, [activeViewId, setActiveViewId, sync.views]);

	useEffect(() => {
		if (!editingViewId) return;
		if (!sync.views.has(editingViewId)) {
			setEditingViewId(null);
		}
	}, [editingViewId, setEditingViewId, sync.views]);

	const keyboard = useCanvasKeyboard({
		elements: sync.elements,
		createElement: sync.createElement,
		deleteElements: deleteElementsWithKanbanReflow,
		updateElements: sync.updateElements,
		undo: history.undo,
		redo: history.redo,
		actions: {
			fitAll: () => {
				const bounds = sync.scene.getCombinedBBox(
					sync.scene.getSortedElements(),
				);
				if (bounds) fitViewportToBounds(bounds, 120);
				else store.resetViewport();
			},
			fitSelection: fitSelectionViewport,
			resetZoom: () => store.resetViewport(),
			insertImage: () => void handleInsertImage(),
			requestClearCanvas: handleRequestClearCanvas,
			openHelp: () => setHelpDialogOpen(true),
			toggleTheme: handleToggleTheme,
			pastePlainText: handlePastePlainText,
			startImageCrop: handleStartImageCrop,
			flowchartCreateDefaultStep: (nodeId) => addFlowchartStep(nodeId),
			flowchartCreateStep: handleFlowchartCreateStep,
			flowchartNavigate: handleFlowchartNavigate,
			mindmapCreateSibling: createMindmapSibling,
			openCommandPalette: () => store.setCommandPaletteOpen(true),
		},
	});

	const pointerHandlers = useCanvasPointer({
		svgRef,
		elements: sync.elements,
		scene: sync.scene,
		createElement: sync.createElement,
		updateElement: sync.updateElement,
		updateElements: sync.updateElements,
		duplicateSelection: keyboard.duplicateSelection,
		deleteElements: deleteElementsWithKanbanReflow,
		stopUndoCapture: history.stopCapturing,
		startTextPlacement,
	});

	const {
		getEventElement,
		getElementAtPosition,
		getKanbanElementAtPosition,
		handleDoubleClick,
	} = useCanvasDoubleClick({
		svgRef,
		scene: sync.scene,
		store,
		presentationMode,
		textEditorOpen,
		pointerHandlers,
		handleCommitTextEditor,
		shouldSuppressTextEditOpen,
		setEditingArrowTextSide,
		setKanbanDetailId,
		setKanbanListDetailId,
	});

	useSkedraCanvasEffects({
		svgRef,
		sync,
		syncRef,
		localMode,
		whiteboardId,
		store,
		fitViewportToBounds,
		focusCanvasPointRef,
		presentationMode,
		presentationShareToken,
		presenterMode,
		activeViewId,
		setActiveViewId,
	});

	useEffect(() => {
		if (!localMode || !sync.isConnected) {
			previousLocalElementCountRef.current = null;
			return;
		}

		const previousElementCount = previousLocalElementCountRef.current;
		previousLocalElementCountRef.current = sync.elements.size;

		if (sync.elements.size !== 0 || previousElementCount === 0) return;

		const { viewport, resetViewport } = useCanvasStore.getState();
		if (viewport.x !== 0 || viewport.y !== 0 || viewport.zoom !== 1) {
			resetViewport();
		}
	}, [localMode, sync.elements.size, sync.isConnected]);

	const addElements = useCanvasAddElements({
		createElement: sync.createElement,
		setKanbanDetailId,
	});

	const croppingElement = croppingImageId
		? (sync.elements.get(croppingImageId) ?? null)
		: null;

	const commandPaletteCommands = useSkedraCanvasCommandPalette({
		store,
		handleInsertImage,
		handleFitViewport,
		handleRequestClearCanvas,
		setHelpDialogOpen,
	});

	useEffect(() => {
		sync.setPresenceSelection(Array.from(selectedIds));
	}, [selectedIds, sync.setPresenceSelection]);

	useEffect(() => {
		sync.setPresenceViewport(viewport);
	}, [sync.setPresenceViewport, viewport]);

	// Presenter sendet aktive Slide an Awareness
	useEffect(() => {
		if (!presenterMode) return;
		sync.setPresenceActiveView(activeViewId);
	}, [activeViewId, presenterMode, sync.setPresenceActiveView]);

	const openKanbanCard = useCallback(
		(id: string) => {
			setKanbanDetailId(id);
		},
		[setKanbanDetailId],
	);

	const openKanbanList = useCallback(
		(id: string) => {
			setKanbanListDetailId(id);
		},
		[setKanbanListDetailId],
	);

	const pasteElement = useCallback(
		(element: Parameters<CanvasCommands["pasteElement"]>[0]) => {
			sync.createElement(element);
		},
		[sync.createElement],
	);

	const toggleStickyChecklistItemCommand = useCallback(
		(elementId: string, itemId: string) => {
			const element = sync.elements.get(elementId);
			if (!element || element.customData?.skedraType !== "sticky-note") return;

			const checklist = normalizeStickyChecklist(
				element.customData.stickyChecklist,
			);
			sync.updateElement(elementId, {
				customData: mergeElementCustomData(element.customData, {
					skedraType: "sticky-note",
					stickyChecklist: toggleStickyChecklistItem(checklist, itemId),
				}),
			});
		},
		[sync.elements, sync.updateElement],
	);

	const insertWaypoint = useCallback(
		(elementId: string, insertIndex: number, point: [number, number]) => {
			const element = sync.elements.get(elementId);
			if (
				!element?.points ||
				(element.type !== "line" && element.type !== "arrow")
			) {
				return;
			}

			const points = [...element.points];
			points.splice(insertIndex, 0, point);
			sync.updateElement(element.id, { points });
			store.setSelectedIds(new Set([element.id]));
		},
		[store, sync.elements, sync.updateElement],
	);

	const canvasCommands = useMemo<CanvasCommands>(
		() => ({
			openHelp: () => setHelpDialogOpen(true),
			pasteElement,
			startTextPlacement,
			openKanbanCard,
			openKanbanList,
			addKanbanCard,
			addTemplateSticky: addTemplateStickyNote,
			addFlowchartStep,
			addFlowchartBranch: (nodeId, branch) =>
				addFlowchartStep(nodeId, { branch }),
			addMindmapChild: createMindmapChild,
			addMindmapSibling: createMindmapSibling,
			toggleStickyChecklistItem: toggleStickyChecklistItemCommand,
			insertWaypoint,
			showKanbanCardPlacementPreview:
				pointerHandlers.showKanbanCardPlacementPreview,
			showStickyNotePlacementPreview:
				pointerHandlers.showStickyNotePlacementPreview,
		}),
		[
			addFlowchartStep,
			addKanbanCard,
			addTemplateStickyNote,
			createMindmapChild,
			createMindmapSibling,
			insertWaypoint,
			openKanbanCard,
			openKanbanList,
			pasteElement,
			pointerHandlers.showKanbanCardPlacementPreview,
			pointerHandlers.showStickyNotePlacementPreview,
			startTextPlacement,
			toggleStickyChecklistItemCommand,
		],
	);

	useEffect(() => {
		if (!canvasCommandRef) return;
		canvasCommandRef.current = canvasCommands;
		return () => {
			canvasCommandRef.current = null;
		};
	}, [canvasCommandRef, canvasCommands]);

	const {
		handleContextMenu,
		handlePointerDown,
		handleCanvasPointerMove,
		handlePointerUp,
		handleCanvasPointerLeave,
	} = useSkedraCanvasPointerBridge({
		svgRef,
		store,
		presentationMode,
		textEditorOpen,
		isCapturingView,
		startViewCapture,
		handleViewPointerMove,
		handleViewPointerUp,
		pointerHandlers,
		getEventElement,
		getElementAtPosition,
		getKanbanElementAtPosition,
		clearMindmapHoverLeaveTimeout,
		setHoveredMindmapNodeId,
		setHoveredMindmapButtonId,
		scheduleMindmapHoverClear,
		setPresenceCursor: sync.setPresenceCursor,
		isMindmapNode,
		openKanbanCard,
		openKanbanList,
	});

	const showEditorChrome =
		!presentationMode && !presenterMode && !sync.isReadonly && !zenMode;
	const hasPropertyContext =
		selectedIds.size > 0 ||
		pendingText != null ||
		store.editingTextId != null ||
		hasCanvasToolProperties(store.activeTool);
	const showProperties = showEditorChrome && (!localMode || hasPropertyContext);

	return (
		<CanvasCommandsProvider value={canvasCommands}>
			<div
				ref={containerRef}
				className={`skedra-canvas h-full w-full relative overflow-hidden select-none${store.isSpacePressed ? " cursor-grab" : ""}`}
				style={{ backgroundColor: canvasBg || "var(--background)" }}
				onContextMenu={handleContextMenu}
			>
				{!localMode && !sync.isConnected && (
					<div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80">
						<p
							className={
								sync.connectionError
									? "max-w-md px-6 text-center text-destructive"
									: "text-muted-foreground"
							}
						>
							{sync.connectionError ?? t("whiteboardPage.connecting")}
						</p>
					</div>
				)}

				<SkedraCanvasToolPanels
					showEditorChrome={showEditorChrome}
					showProperties={showProperties}
					workspaceSlug={workspaceSlug}
					sync={sync}
					selectedIds={selectedIds}
					pendingText={pendingText}
					editingTextId={store.editingTextId}
					editingArrowTextSide={editingArrowTextSide}
					editingArrowTextOrientation={editingArrowTextOrientation}
					getViewportCenter={getViewportCenter}
					addElements={addElements}
					handleUpdatePendingText={handleUpdatePendingText}
					handleUpdateEditingText={handleUpdateEditingText}
					setEditingArrowTextSide={setEditingArrowTextSide}
					setEditingArrowTextOrientation={setEditingArrowTextOrientation}
					deleteElementsWithKanbanReflow={deleteElementsWithKanbanReflow}
					keyboard={keyboard}
					onExportSkedra={handleExportSkedra}
					onExportEncryptedSkedra={() => void handleExportEncryptedSkedra()}
					onImportSkedra={() => void handleImportSkedra()}
					imageUploadOptions={imageUploadOptions}
					resolveAssetUrl={resolveAssetUrl}
					kanbanDetailId={kanbanDetailId}
					kanbanListDetailId={kanbanListDetailId}
					setKanbanDetailId={setKanbanDetailId}
					setKanbanListDetailId={setKanbanListDetailId}
					kanbanAssignmentOptions={kanbanAssignmentOptions}
					commands={canvasCommands}
				/>

				<SkedraCanvasStageSurface
					svgRef={svgRef}
					activeTool={store.activeTool}
					viewport={viewport}
					scene={sync.scene}
					elements={sync.elements}
					selectedIds={selectedIds}
					editingTextId={store.editingTextId}
					remotePresence={sync.remotePresence}
					editingView={editingView}
					textEditorOpen={textEditorOpen}
					viewDraft={viewDraft}
					drawingPreview={pointerHandlers.drawingPreview}
					croppingElement={croppingElement}
					resolveAssetUrl={resolveAssetUrl}
					onApplyImageCrop={handleApplyImageCrop}
					onCancelImageCrop={() => store.setCroppingImageId(null)}
					onPointerDown={handlePointerDown}
					onPointerMove={handleCanvasPointerMove}
					onPointerUp={handlePointerUp}
					onPointerLeave={handleCanvasPointerLeave}
					onDoubleClick={handleDoubleClick}
					onViewMoveStart={(event) => {
						if (editingView) beginViewMove(editingView.id, event);
					}}
					onViewResizeStart={(handle, event) => {
						if (editingView) beginViewResize(handle, editingView.id, event);
					}}
				/>

				<SkedraCanvasOverlays
					zenMode={zenMode}
					presentationMode={presentationMode}
					presenterMode={presenterMode}
					localMode={localMode}
					presenceEnabled={presenceEnabled}
					textEditorOpen={textEditorOpen}
					viewport={viewport}
					svgRef={svgRef}
					sync={sync}
					mindmapButtons={mindmapButtons}
					activeMindmapNodeId={activeMindmapNode?.id}
					clearMindmapHoverLeaveTimeout={clearMindmapHoverLeaveTimeout}
					setHoveredMindmapButtonId={setHoveredMindmapButtonId}
					scheduleMindmapHoverClear={scheduleMindmapHoverClear}
					selectedFlowchartNode={selectedFlowchartNode}
					selectedFlowchartMeta={selectedFlowchartMeta}
					flowchartInsertKind={flowchartInsertKind}
					onAddFlowchartStep={addFlowchartStep}
					comments={comments}
					presencePanelOffsetTop={presencePanelOffsetTop}
					presencePanelOffsetRight={presencePanelOffsetRight}
					presencePanelSummaryOffsetRight={presencePanelSummaryOffsetRight}
					presencePanelLayout={presencePanelLayout}
					bottomBar={
						zenMode
							? null
							: {
									canUndo: history.canUndo,
									canRedo: history.canRedo,
									presentationMode,
									presenterMode,
									onUndo: history.undo,
									onRedo: history.redo,
									onFitViewport: handleFitViewport,
									views: savedViewList,
									elements: sync.elements,
									activeViewId,
									editingViewId,
									isCapturingView,
									onStartCaptureView: () => {
										setIsCapturingView(true);
										setViewDraft(null);
										setActiveViewId(null);
										setEditingViewId(null);
									},
									onCancelCaptureView: () => {
										setIsCapturingView(false);
										setViewDraft(null);
										viewInteractionRef.current = null;
									},
									onSelectView: handleSelectView,
									onStartEditView: handleStartEditView,
									onStopEditView: handleStopEditView,
									onDeleteView: handleDeleteView,
									onRenameView: handleRenameView,
									resolveAssetUrl,
								}
					}
				/>

				<SkedraCanvasEditLayer
					store={store}
					svgRef={svgRef}
					viewport={viewport}
					contextMenu={contextMenu}
					selectedIds={selectedIds}
					selectedEls={selectedEls}
					isLocked={isLocked}
					textEditorOpen={textEditorOpen}
					textEditing={{
						pendingText,
						editingText,
						editingStickyChecklist,
						editingStickyNoteMode,
						handleCreateText,
						handleUpdateText,
						handleUpdateStickyNote,
						handleCloseTextEditorAfterSave,
						registerTextEditorCommit,
					}}
					keyboard={keyboard}
					liveStickyNoteEditor={liveStickyNoteEditor}
					createMindmapSibling={createMindmapSibling}
					deleteElementsWithKanbanReflow={deleteElementsWithKanbanReflow}
					elements={sync.elements}
				/>

				<SkedraCanvasChrome
					presentationMode={presentationMode}
					presenterMode={presenterMode}
					zenMode={zenMode}
					localMode={localMode}
					encryptionMode={encryptionMode}
					whiteboardId={whiteboardId}
					canUseAi={canUseAi}
					helpGuestMode={helpGuestMode}
					helpDialogOpen={helpDialogOpen}
					onHelpDialogOpenChange={setHelpDialogOpen}
					commandPaletteOpen={commandPaletteOpen}
					onCommandPaletteOpenChange={store.setCommandPaletteOpen}
					commandPaletteCommands={commandPaletteCommands}
					aiPanelOpen={aiPanelOpen}
					onAiPanelOpenChange={setAiPanelOpen}
					onAddElements={addElements}
					onToggleZenMode={() => store.toggleZenMode()}
					presenterNotesOpen={presenterNotesOpen}
					onPresenterNotesOpenChange={setPresenterNotesOpen}
					activeView={activeView}
					savedViewList={savedViewList}
					onUpdatePresenterNotes={handleUpdatePresenterNotes}
					onSelectView={handleSelectView}
					presenterShareUrl={presenterShareUrl}
					presenterIsLive={presenterIsLive}
					presentationShareToken={presentationShareToken}
					audienceBoardName={audienceBoardName}
					audienceIsLive={audienceIsLive}
				/>

				<SkedraCanvasFileDialogs
					importDialogOpen={importDialogOpen}
					onImportDialogOpenChange={setImportDialogOpen}
					onConfirmImport={handleConfirmSkedraImport}
					fileError={fileError}
					onClearFileError={() => setFileError("")}
				/>
			</div>
		</CanvasCommandsProvider>
	);
}

type SkedraCanvasStageSurfaceProps = Omit<
	React.ComponentProps<typeof CanvasStage>,
	| "selectionBox"
	| "lassoPath"
	| "snapGuides"
	| "snapPointIndicators"
	| "laserTrails"
>;

function SkedraCanvasStageSurface(props: SkedraCanvasStageSurfaceProps) {
	const visualState = useCanvasStore(
		useShallow((state) => ({
			lassoPath: state.lassoPath,
			laserTrails: state.laserTrails,
			selectionBox: state.selectionBox,
			snapGuides: state.snapGuides,
			snapPointIndicators: state.snapPointIndicators,
		})),
	);

	return <CanvasStage {...props} {...visualState} />;
}
