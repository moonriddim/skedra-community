/**
 * SkedraCanvas: Eigenes SVG-basiertes Whiteboard mit Echtzeit-Sync.
 * Respektiert das App-Theme (dark/light) ueber CSS-Variablen.
 */

import { useCanvasHistory } from "@/hooks/use-canvas-history";
import {
	type CanvasStoreState,
	useCanvasStore,
	useCanvasStoreRef,
} from "@/hooks/use-canvas-store";
import { useCommunityCanvasKeyboardAdapter } from "@/hooks/use-community-canvas-keyboard-adapter";
import { useCommunityCanvasPointerAdapter } from "@/hooks/use-community-canvas-pointer-adapter";
import { useE2eeCanvasSync } from "@/hooks/use-e2ee-canvas-sync";
import { useEncryptedAssetUrls } from "@/hooks/use-encrypted-asset-urls";
import { useLibraryDeepLink } from "@/hooks/use-library-deep-link";
import { useLocalCanvasSync } from "@/hooks/use-local-canvas-sync";
import { usePresentationCanvasSync } from "@/hooks/use-presentation-canvas-sync";
import { usePresentationPublisher } from "@/hooks/use-presentation-publisher";
import { usePresenterNotes } from "@/hooks/use-presenter-notes";
import { useServerCanvasSync } from "@/hooks/use-server-canvas-sync";
import type { AssetAccessTokens } from "@/lib/canvas/asset-urls";
import { getCanvasElementFactoryDefaults } from "@/lib/canvas/canvas-factory-defaults";
import { mergeElementCustomData } from "@/lib/canvas/custom-data-utils";
import {
	exportFramePNG,
	exportFrameSVG,
	exportPDF,
	exportPNG,
	exportPPTX,
	exportSVG,
} from "@/lib/canvas/export-utils";
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
import {
	createPresentationFrameContent,
	createPresentationRelativeCamera,
	mergePresentationFrameElements,
	viewportFromPresentationCamera,
} from "@/lib/presentation-frame";
import { ganttDateLabel } from "@/lib/templates/gantt";
import { templateText } from "@/lib/templates/shared";
import { trpc } from "@/lib/trpc";
import { useThemeStore } from "@/stores/theme";
import {
	buildCanvasPathInsertPointChanges,
	buildGanttChartMutationPlan,
	findGanttChartElement,
	focusGanttChartOnDate,
	getFlowchartNodeMeta,
	getGanttChartDocument,
	getGanttChartMeta,
	getGanttChartRepairDocument,
	getSequenceDiagramId,
	isFlowchartNode,
	isMindmapNode,
} from "@skedra/canvas-core";
import type {
	CanvasElement,
	KanbanAssignmentOptions,
	SavedCanvasView,
} from "@skedra/canvas-core";
import {
	CanvasEditor,
	type CanvasEditorSavedViewPreviewRenderer,
	resolveCanvasEditorRotationKeyDelta,
	useCanvasEditorEllipseTrim,
	useCanvasEditorSavedViews,
} from "@skedra/canvas-editor";
import { nanoid } from "nanoid";
import {
	Suspense,
	lazy,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import * as Y from "yjs";
import { useShallow } from "zustand/react/shallow";
import { BoardActivityOverlay } from "../board/board-activity-overlay";
import type { PendingCommentPlacement } from "../whiteboard/canvas-comment-layer";
import type { WhiteboardCommentThread } from "../whiteboard/whiteboard-comment-types";
import { WhiteboardCommentsPanel } from "../whiteboard/whiteboard-comments-panel";
import { type CanvasCommands, CanvasCommandsProvider } from "./canvas-commands";
import { CanvasFindOnCanvas } from "./canvas-find-on-canvas";
import { CanvasPresentationPanel } from "./canvas-presentation-panel";
import { CanvasRenderer } from "./canvas-renderer";
import { CanvasStage } from "./canvas-stage";
import {
	hasCanvasToolProperties,
	shouldShowCanvasProperties,
} from "./canvas-tool-types";
import {
	CanvasWorkspacePanel,
	type CanvasWorkspaceTab,
} from "./canvas-workspace-panel";
import { useCanvasAddElements } from "./hooks/use-canvas-add-elements";
import { useCanvasDoubleClick } from "./hooks/use-canvas-double-click";
import { useCanvasSearch } from "./hooks/use-canvas-search";
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

const WorkspaceLibraryPanel = lazy(() =>
	import("./library-panel").then((module) => ({
		default: module.LibraryPanel,
	})),
);

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
	/** Canvas-Modus zum Vorbereiten von Folien und Sprechernotizen (?prepare=1). */
	presentationPreparationMode?: boolean;
	presenterShareUrl?: string;
	presenterSessionId?: string | null;
	presenterStartedAt?: string | null;
	presenterSessionStarting?: boolean;
	presenterStartError?: string | null;
	onStartPresentation?: () => void;
	onEndPresentation?: () => void;
	onOpenPresentationPreparation?: () => void;
	onCancelPresentationPreparation?: () => void;
	onPresentationSessionEnded?: () => void;
	workspacePanelOpen?: boolean;
	onWorkspacePanelOpenChange?: (open: boolean) => void;
	onOpenShare?: () => void;
	activity?: {
		whiteboardId: string;
		whiteboardName: string;
	};
	/** Audience-View (/present/:token) */
	audienceBoardName?: string;
	/** Excalidraw-ähnliche Board-Kommentare (nur wenn gesetzt). */
	comments?: {
		whiteboardName: string;
		isLoading: boolean;
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
		onPanelOpenChange: (open: boolean) => void;
		onToggleShowResolved: () => void;
		onStartPlacement: () => void;
	};
	/** Springt im Canvas zu einer Welt-Position (z. B. aus der Kommentar-Sidebar). */
	focusCanvasPointRef?: React.MutableRefObject<
		((x: number, y: number) => void) | null
	>;
}

const EMPTY_SAVED_VIEW_SELECTION = new Set<string>();

function areSavedViewsEqual(left: SavedCanvasView, right: SavedCanvasView) {
	return (
		left.id === right.id &&
		left.name === right.name &&
		left.x === right.x &&
		left.y === right.y &&
		left.width === right.width &&
		left.height === right.height &&
		left.createdAt === right.createdAt &&
		left.updatedAt === right.updatedAt &&
		left.order === right.order &&
		left.aspectRatio === right.aspectRatio
	);
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
	encryptionMode = "server",
	forceReadonly,
	presenceEnabled = true,
	presencePanelOffsetTop,
	presencePanelOffsetRight,
	presencePanelSummaryOffsetRight,
	presencePanelLayout,
	kanbanAssignmentOptions,
	presenterMode = false,
	presentationPreparationMode = false,
	presenterShareUrl = "",
	presenterSessionId,
	presenterStartedAt,
	presenterSessionStarting = false,
	presenterStartError,
	onStartPresentation,
	onEndPresentation,
	onOpenPresentationPreparation,
	onCancelPresentationPreparation,
	onPresentationSessionEnded,
	workspacePanelOpen,
	onWorkspacePanelOpenChange,
	onOpenShare,
	activity,
	audienceBoardName,
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
	const [workspacePanelTab, setWorkspacePanelTab] =
		useState<CanvasWorkspaceTab | null>(null);
	const lastWorkspacePanelTabRef = useRef<CanvasWorkspaceTab>(
		comments ? "comments" : "search",
	);
	const onWorkspacePanelOpenChangeRef = useRef(onWorkspacePanelOpenChange);
	onWorkspacePanelOpenChangeRef.current = onWorkspacePanelOpenChange;
	const onCommentPanelOpenChangeRef = useRef(comments?.onPanelOpenChange);
	onCommentPanelOpenChangeRef.current = comments?.onPanelOpenChange;
	const previousWorkspacePanelOpenRef = useRef(false);
	const previousCommentPanelOpenRef = useRef(false);
	const [audienceFollowPresenter, setAudienceFollowPresenter] = useState(true);
	const [presentationElementPreviews, setPresentationElementPreviews] =
		useState<CanvasElement[]>([]);
	const effectivePresentationPreparationMode =
		presenterMode || presentationPreparationMode;
	const [canvasViewportSize, setCanvasViewportSize] = useState({
		width: 0,
		height: 0,
	});
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);

	useEffect(() => {
		const canvas = svgRef.current;
		if (!canvas) return;
		const updateSize = () => {
			const rect = canvas.getBoundingClientRect();
			const next = { width: rect.width, height: rect.height };
			setCanvasViewportSize((current) =>
				current.width === next.width && current.height === next.height
					? current
					: next,
			);
		};
		updateSize();
		const observer = new ResizeObserver(updateSize);
		observer.observe(canvas);
		return () => observer.disconnect();
	}, []);

	const localSync = useLocalCanvasSync(localMode);
	const audienceFrameMode =
		presentationMode && !!presentationShareToken && !localMode;
	const e2eeRemoteMode =
		!localMode &&
		!audienceFrameMode &&
		!!whiteboardId &&
		encryptionMode === "e2ee";
	const serverRemoteMode =
		!localMode &&
		!audienceFrameMode &&
		!!whiteboardId &&
		encryptionMode === "server";
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
				!!forceReadonly ||
				presentationMode ||
				!!presentationShareToken ||
				!!embedShareToken,
			presentationShareToken,
			presenceEnabled,
			collabShareToken,
			embedShareToken,
		},
	);
	const serverSync = useServerCanvasSync(
		whiteboardId ?? "00000000-0000-0000-0000-000000000000",
		{
			enabled: serverRemoteMode,
			readonly:
				!!forceReadonly ||
				presentationMode ||
				!!presentationShareToken ||
				!!embedShareToken,
			presentationShareToken,
			presenceEnabled,
			collabShareToken,
			embedShareToken,
		},
	);
	const presentationSync = usePresentationCanvasSync({
		enabled: audienceFrameMode,
		shareToken: presentationShareToken,
		encryptionMode,
		e2eeKey,
		cursorEnabled: presenceEnabled,
	});
	const sync = audienceFrameMode
		? presentationSync
		: localMode
			? localSync
			: encryptionMode === "server"
				? serverSync
				: e2eeSync;
	const canUsePresenterNotes =
		!localMode &&
		!audienceFrameMode &&
		!forceReadonly &&
		!collabShareToken &&
		!embedShareToken;
	const presenterNotes = usePresenterNotes({
		whiteboardId,
		encryptionMode,
		e2eeKey,
		enabled: canUsePresenterNotes,
	});
	const presentationPublisher = usePresentationPublisher({
		whiteboardId,
		sessionId: presenterSessionId,
		encryptionMode,
		e2eeKey,
		enabled: presenterMode && !!presenterSessionId,
	});
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
	const canvasEditorTranslations = useMemo(
		() => ({
			translate: (
				key: string,
				fallback: string,
				params?: Record<string, string | number>,
			) => {
				const translated = t(key as `canvas.${string}`, params);
				return translated === key ? fallback : translated;
			},
		}),
		[t],
	);
	const canvasEditorAssetAdapter = useMemo(
		() => ({ resolveAssetUrl }),
		[resolveAssetUrl],
	);
	const canvasEditorCollaboration = useMemo(
		() => ({ enabled: !localMode }),
		[localMode],
	);
	const syncRef = useRef(sync);
	syncRef.current = sync;
	const ganttAutoFocusedIdsRef = useRef(new Set<string>());
	const ganttAutoFocusScopeRef = useRef<string | null>(null);

	useEffect(() => {
		const scope = `${localMode ? "local" : "remote"}:${whiteboardId ?? "guest"}:${audienceFrameMode ? "audience" : "editor"}`;
		if (ganttAutoFocusScopeRef.current !== scope) {
			ganttAutoFocusScopeRef.current = scope;
			ganttAutoFocusedIdsRef.current.clear();
		}
		if (!sync.isConnected || sync.isReadonly || audienceFrameMode) return;
		const source = Array.from(sync.elements.values());
		const today = new Date().toISOString().slice(0, 10);
		for (const element of source) {
			if (!getGanttChartMeta(element)) continue;
			const shouldFocusToday = !ganttAutoFocusedIdsRef.current.has(element.id);
			let nextDocument = getGanttChartRepairDocument(source, element);
			if (shouldFocusToday) {
				ganttAutoFocusedIdsRef.current.add(element.id);
				const currentDocument =
					nextDocument ?? getGanttChartDocument(source, element);
				if (currentDocument) {
					nextDocument = focusGanttChartOnDate(currentDocument, today);
				}
			}
			if (!nextDocument) continue;
			const plan = buildGanttChartMutationPlan(
				getCanvasElementFactoryDefaults({ resolvedTheme }),
				source,
				element,
				nextDocument,
				{
					dateLabel: ganttDateLabel,
					text: templateText,
					today,
				},
			);
			// Generated Gantt children are repaired as document maintenance. This
			// must not change the user's current selection or create an Undo step.
			sync.applyMutationPlan({ ...plan, selectedIds: [] });
		}
	}, [
		audienceFrameMode,
		localMode,
		resolvedTheme,
		sync.applyMutationPlan,
		sync.elements,
		sync.isConnected,
		sync.isReadonly,
		whiteboardId,
	]);

	useEffect(() => {
		if (
			!canUsePresenterNotes ||
			!sync.isConnected ||
			presenterNotes.isLoading
		) {
			return;
		}
		const ydoc = sync.getYDoc();
		if (!ydoc) return;
		void presenterNotes.migrateLegacyNotes(ydoc).catch(() => undefined);
	}, [
		canUsePresenterNotes,
		presenterNotes.isLoading,
		presenterNotes.migrateLegacyNotes,
		sync.getYDoc,
		sync.isConnected,
	]);

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
			canvasSearchOpen: state.canvasSearchOpen,
			commandPaletteOpen: state.commandPaletteOpen,
			contextMenu: state.contextMenu,
			croppingImageId: state.croppingImageId,
			editingTextId: state.editingTextId,
			flowchartInsertKind: state.flowchartInsertKind,
			gridEnabled: state.gridEnabled,
			gridSize: state.gridSize,
			isSpacePressed: state.isSpacePressed,
			selectedIds: state.selectedIds,
			showSnapPoints: state.showSnapPoints,
			snapDivisionCount: state.snapDivisionCount,
			snapOverrideMode: state.snapOverrideMode,
			snapToCenters: state.snapToCenters,
			snapToDivisions: state.snapToDivisions,
			snapToEndpoints: state.snapToEndpoints,
			snapToExtensions: state.snapToExtensions,
			snapToGeometricCenters: state.snapToGeometricCenters,
			snapToInsertions: state.snapToInsertions,
			snapToIntersections: state.snapToIntersections,
			snapToMidpoints: state.snapToMidpoints,
			snapToNearest: state.snapToNearest,
			snapToObjects: state.snapToObjects,
			snapToQuadrants: state.snapToQuadrants,
			strokeColor: state.strokeColor,
			transformOrigin: state.transformOrigin,
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
		canvasSearchOpen,
	} = store;
	const setStoreCanvasBg = store.setCanvasBg;

	useEffect(() => {
		if (store.activePanel === "library") {
			setWorkspacePanelTab("library");
			return;
		}
		setWorkspacePanelTab((current) => (current === "library" ? null : current));
	}, [store.activePanel]);

	useEffect(() => {
		if (canvasSearchOpen) {
			setWorkspacePanelTab("search");
			return;
		}
		setWorkspacePanelTab((current) => (current === "search" ? null : current));
	}, [canvasSearchOpen]);

	useEffect(() => {
		if (workspacePanelOpen === undefined) return;
		setWorkspacePanelTab((current) =>
			workspacePanelOpen ? (current ?? lastWorkspacePanelTabRef.current) : null,
		);
	}, [workspacePanelOpen]);

	useEffect(() => {
		if (workspacePanelTab) lastWorkspacePanelTabRef.current = workspacePanelTab;
		const panelOpen = workspacePanelTab !== null;
		if (previousWorkspacePanelOpenRef.current !== panelOpen) {
			previousWorkspacePanelOpenRef.current = panelOpen;
			onWorkspacePanelOpenChangeRef.current?.(panelOpen);
		}

		const commentPanelOpen = workspacePanelTab === "comments";
		if (previousCommentPanelOpenRef.current !== commentPanelOpen) {
			previousCommentPanelOpenRef.current = commentPanelOpen;
			onCommentPanelOpenChangeRef.current?.(commentPanelOpen);
		}
	}, [workspacePanelTab]);

	useEffect(() => {
		if (!effectivePresentationPreparationMode || presentationMode) return;
		setWorkspacePanelTab("presentation");
	}, [effectivePresentationPreparationMode, presentationMode]);

	const handleWorkspaceTabChange = useCallback(
		(tab: CanvasWorkspaceTab) => {
			setWorkspacePanelTab(tab);
			store.setCanvasSearchOpen(tab === "search");

			if (tab === "library") {
				if (store.activePanel !== "library") store.setActivePanel("library");
			} else if (store.activePanel === "library") {
				store.setActivePanel(null);
			}
		},
		[store],
	);

	const handleCloseWorkspacePanel = useCallback(() => {
		setWorkspacePanelTab(null);
		store.setCanvasSearchOpen(false);
		if (store.activePanel === "library") store.setActivePanel(null);
	}, [store]);

	const canvasBackgroundSyncRef = useRef<{
		scope: string;
		value: string;
	} | null>(null);
	const canvasBackgroundScope = localMode ? "local" : (whiteboardId ?? "none");

	useEffect(() => {
		if (!sync.isConnected || audienceFrameMode) return;

		const last = canvasBackgroundSyncRef.current;
		if (!last || last.scope !== canvasBackgroundScope) {
			canvasBackgroundSyncRef.current = {
				scope: canvasBackgroundScope,
				value: sync.canvasBg,
			};
			if (canvasBg !== sync.canvasBg) {
				setStoreCanvasBg(sync.canvasBg);
			}
			return;
		}

		if (sync.canvasBg !== last.value) {
			canvasBackgroundSyncRef.current = {
				scope: canvasBackgroundScope,
				value: sync.canvasBg,
			};
			if (canvasBg !== sync.canvasBg) {
				setStoreCanvasBg(sync.canvasBg);
			}
			return;
		}

		if (canvasBg !== last.value) {
			canvasBackgroundSyncRef.current = {
				scope: canvasBackgroundScope,
				value: canvasBg,
			};
			sync.setCanvasBg(canvasBg);
		}
	}, [
		audienceFrameMode,
		canvasBackgroundScope,
		canvasBg,
		setStoreCanvasBg,
		sync.canvasBg,
		sync.isConnected,
		sync.setCanvasBg,
	]);
	const history = useCanvasHistory({
		getYDoc: sync.getYDoc,
		scopeKey: localMode ? "local" : (whiteboardId ?? "none"),
		isReady: sync.isConnected,
	});
	const savedViews = useMemo(
		() => Array.from(sync.views.values()),
		[sync.views],
	);
	const commitSavedViews = useCallback(
		(nextViews: SavedCanvasView[]) => {
			const nextById = new Map(nextViews.map((view) => [view.id, view]));
			for (const id of sync.views.keys()) {
				if (!nextById.has(id)) sync.deleteView(id);
			}
			for (const view of nextViews) {
				const current = sync.views.get(view.id);
				if (!current) sync.createView(view);
				else if (!areSavedViewsEqual(current, view)) {
					const { id, ...updates } = view;
					sync.updateView(id, updates);
				}
			}
		},
		[sync.createView, sync.deleteView, sync.updateView, sync.views],
	);
	const translateSavedViews = useCallback(
		(
			key: string,
			fallback: string,
			params?: Record<string, string | number>,
		) => {
			const translated = t(key as `canvas.${string}`, params);
			return translated === key ? fallback : translated;
		},
		[t],
	);
	const getSavedViewsContentBounds = useCallback(
		() => sync.scene.getCombinedBBox(sync.scene.getSortedElements()),
		[sync.scene],
	);
	const renderSavedViewPreview =
		useCallback<CanvasEditorSavedViewPreviewRenderer>(
			(scene) => (
				<CanvasRenderer
					scene={scene}
					selectedIds={EMPTY_SAVED_VIEW_SELECTION}
					resolveAssetUrl={resolveAssetUrl}
				/>
			),
			[resolveAssetUrl],
		);
	const {
		orderedViews: savedViewList,
		activeViewId,
		setActiveViewId,
		editingViewId,
		setEditingViewId,
		isCapturingView,
		viewDraft,
		fitViewportToBounds,
		selectView: handleSelectView,
		startEditingView: handleStartEditView,
		stopEditingView: handleStopEditView,
		renameView: handleRenameView,
		deleteView: handleDeleteView,
		duplicateView: handleDuplicateView,
		moveView: handleMoveView,
		fitViewport: handleFitViewport,
		zoomBy: handleZoomBy,
		startCaptureView,
		cancelCaptureView,
		beginViewMove,
		beginViewResize,
		startViewCapture,
		handleViewPointerMove,
		handleViewPointerUp,
		cancelViewInteraction,
		resetViewsOnImport,
	} = useCanvasEditorSavedViews({
		svgRef,
		views: savedViews,
		viewport: store.viewport,
		onViewportChange: store.setViewport,
		onViewsChange: commitSavedViews,
		createId: nanoid,
		getContentBounds: getSavedViewsContentBounds,
		onResetViewport: store.resetViewport,
		presentationPreparationMode: effectivePresentationPreparationMode,
		readOnly: sync.isReadonly,
		translate: translateSavedViews,
	});
	const {
		importDialogOpen,
		setImportDialogOpen,
		fileError,
		setFileError,
		handleImportSkedra,
		handleExportSkedra,
		handleExportExcalidraw,
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
	const activeView = activeViewId
		? (sync.views.get(activeViewId) ?? null)
		: null;

	useEffect(() => {
		if (!audienceFrameMode || savedViewList.length === 0) return;
		const currentView = savedViewList[0];
		setActiveViewId(currentView.id);
		if (!audienceFollowPresenter || !presentationSync.presentationCamera)
			return;
		if (canvasViewportSize.width <= 0 || canvasViewportSize.height <= 0) return;
		useCanvasStore
			.getState()
			.setViewport(
				viewportFromPresentationCamera(
					presentationSync.presentationCamera,
					canvasViewportSize,
					currentView,
				),
			);
	}, [
		audienceFollowPresenter,
		audienceFrameMode,
		canvasViewportSize,
		presentationSync.presentationCamera,
		savedViewList,
		setActiveViewId,
	]);

	useEffect(() => {
		if (
			!presenterMode ||
			!presenterSessionId ||
			!activeView ||
			canvasViewportSize.width <= 0 ||
			canvasViewportSize.height <= 0
		) {
			return;
		}
		presentationPublisher.publishCamera(
			createPresentationRelativeCamera(
				store.viewport,
				canvasViewportSize,
				activeView,
			),
			activeView.id,
		);
	}, [
		activeView,
		canvasViewportSize,
		presentationPublisher.publishCamera,
		presenterMode,
		presenterSessionId,
		store.viewport,
	]);

	useEffect(() => {
		if (!presentationPublisher.sessionEnded) return;
		onPresentationSessionEnded?.();
	}, [onPresentationSessionEnded, presentationPublisher.sessionEnded]);

	useEffect(() => {
		if (!presenterMode || activeViewId || savedViewList.length === 0) return;
		handleSelectView(savedViewList[0].id);
	}, [activeViewId, handleSelectView, presenterMode, savedViewList]);

	useEffect(() => {
		if (!presenterMode || savedViewList.length === 0) return;

		const handlePresenterKeyDown = (event: KeyboardEvent) => {
			const target = event.target;
			if (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				(target instanceof HTMLElement && target.isContentEditable)
			) {
				return;
			}

			if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
				return;
			const previous = event.key === "ArrowLeft" || event.key === "PageUp";
			const next = event.key === "ArrowRight" || event.key === "PageDown";
			if (!previous && !next) return;

			const currentIndex = Math.max(
				0,
				savedViewList.findIndex((view) => view.id === activeViewId),
			);
			const nextIndex = Math.max(
				0,
				Math.min(savedViewList.length - 1, currentIndex + (previous ? -1 : 1)),
			);
			const nextView = savedViewList[nextIndex];
			if (!nextView || nextView.id === activeViewId) return;

			event.preventDefault();
			event.stopImmediatePropagation();
			handleSelectView(nextView.id);
		};

		window.addEventListener("keydown", handlePresenterKeyDown);
		return () => window.removeEventListener("keydown", handlePresenterKeyDown);
	}, [activeViewId, handleSelectView, presenterMode, savedViewList]);
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

	useEffect(() => {
		if (!effectivePresentationPreparationMode) {
			setPresenterNotesOpen(false);
		}
	}, [effectivePresentationPreparationMode]);

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
	const activateEllipseTrim = useCallback(() => {
		store.setActiveTool("select");
		store.setContextMenu(null);
		store.setSnapMenu(null);
	}, [store.setActiveTool, store.setContextMenu, store.setSnapMenu]);
	const ellipseTrim = useCanvasEditorEllipseTrim({
		svgRef,
		viewport,
		elements: sync.elements,
		updateElement: sync.updateElement,
		onActivate: activateEllipseTrim,
	});
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
	const canvasSearch = useCanvasSearch({
		open: canvasSearchOpen,
		elements: sync.elements,
		scene: sync.scene,
		viewport: store.viewport,
		viewportSize: canvasViewportSize,
		onViewportChange: store.setViewport,
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

	const keyboard = useCommunityCanvasKeyboardAdapter({
		enabled: !presentationMode,
		readOnly: sync.isReadonly,
		editingText: textEditorOpen,
		elements: sync.elements,
		createElement: sync.createElement,
		deleteElements: deleteElementsWithKanbanReflow,
		updateElements: sync.updateElements,
		getPastePoint: getViewportCenter,
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
			openCanvasSearch: () => store.setCanvasSearchOpen(true),
		},
	});

	const pointerHandlers = useCommunityCanvasPointerAdapter({
		svgRef,
		readOnly: presentationMode || sync.isReadonly,
		elements: sync.elements,
		scene: sync.scene,
		createElement: sync.createElement,
		updateElement: sync.updateElement,
		updateElements: sync.updateElements,
		duplicateSelection: keyboard.duplicateSelection,
		deleteElements: deleteElementsWithKanbanReflow,
		deleteElementsDirect: sync.deleteElements,
		applyMutationPlan: sync.applyMutationPlan,
		startUndoCapture: history.startCapturing,
		stopUndoCapture: history.stopCapturing,
		cancelUndoCapture: history.cancelCapturing,
		startTextPlacement,
	});

	useEffect(() => {
		if (!presenterMode || !presenterSessionId || !activeView) return;
		if (canvasViewportSize.width <= 0 || canvasViewportSize.height <= 0) return;
		const timer = window.setTimeout(() => {
			const slideIndex = savedViewList.findIndex(
				(view) => view.id === activeView.id,
			);
			if (slideIndex < 0) return;
			const frame = createPresentationFrameContent({
				slide: activeView,
				slideIndex,
				totalSlides: savedViewList.length,
				elements: mergePresentationFrameElements(sync.elements.values(), [
					...presentationElementPreviews,
					pointerHandlers.drawingPreview,
				]),
				viewport: useCanvasStore.getState().viewport,
				viewportSize: canvasViewportSize,
			});
			void presentationPublisher.publishFrame(frame);
		}, 100);
		return () => window.clearTimeout(timer);
	}, [
		activeView,
		canvasViewportSize,
		pointerHandlers.drawingPreview,
		presentationElementPreviews,
		presentationPublisher.publishFrame,
		presenterMode,
		presenterSessionId,
		savedViewList,
		sync.elements,
	]);

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
		stopUndoCapture: history.stopCapturing,
	});
	const fitElementsToViewport = useCallback(
		(elementsToFit: CanvasElement[]) => {
			const bounds = sync.scene.getCombinedBBox(elementsToFit);
			if (bounds) fitViewportToBounds(bounds, 80);
		},
		[fitViewportToBounds, sync.scene],
	);

	const croppingElement = croppingImageId
		? (sync.elements.get(croppingImageId) ?? null)
		: null;

	const commandPaletteCommands = useSkedraCanvasCommandPalette({
		store,
		elements: sync.elements,
		keyboard,
		readOnly: sync.isReadonly,
		canUndo: history.canUndo,
		canRedo: history.canRedo,
		undo: history.undo,
		redo: history.redo,
		deleteElements: deleteElementsWithKanbanReflow,
		handleInsertImage,
		handleFitViewport,
		handleFitSelection: fitSelectionViewport,
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
			if (!element) return;
			const changes = buildCanvasPathInsertPointChanges(
				element,
				insertIndex,
				point,
			);
			if (!changes) return;
			sync.updateElement(element.id, changes);
			store.setSelectedIds(new Set([element.id]));
		},
		[store.setSelectedIds, sync.elements, sync.updateElement],
	);

	const exportVisual = useCallback<CanvasCommands["exportVisual"]>(
		async (format) => {
			const svg = svgRef.current;
			if (!svg) return;
			if (format === "svg") exportSVG(svg);
			else if (format === "png") await exportPNG(svg);
			else if (format === "pdf") await exportPDF(svg);
			else await exportPPTX(svg);
		},
		[],
	);

	/* Einzelnen Frame geclippt exportieren (Frame-Rahmen wird ausgeblendet). */
	const exportFrame = useCallback<CanvasCommands["exportFrame"]>(
		async (frameId, format) => {
			const svg = svgRef.current;
			const frame = sync.elements.get(frameId);
			if (!svg || !frame || frame.type !== "frame") return;
			if (format === "svg") await exportFrameSVG(svg, frame);
			else await exportFramePNG(svg, frame);
		},
		[sync.elements],
	);

	const canvasCommands = useMemo<CanvasCommands>(
		() => ({
			openHelp: () => setHelpDialogOpen(true),
			exportVisual,
			exportFrame,
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
			exportFrame,
			exportVisual,
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

	const setCanvasPresenceCursor = useCallback(
		(cursor: { x: number; y: number } | null) => {
			sync.setPresenceCursor(cursor);
			if (presenterMode && presenterSessionId && presenceEnabled) {
				presentationPublisher.publishCursor(cursor);
			}
		},
		[
			presenceEnabled,
			presentationPublisher.publishCursor,
			presenterMode,
			presenterSessionId,
			sync.setPresenceCursor,
		],
	);

	const {
		handleContextMenu,
		handlePointerDown,
		handleCanvasPointerMove,
		handlePointerUp,
		handlePointerCancel,
		handleLostPointerCapture,
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
		cancelViewInteraction,
		pointerHandlers,
		elements: sync.elements,
		getEventElement,
		getElementAtPosition,
		getKanbanElementAtPosition,
		clearMindmapHoverLeaveTimeout,
		setHoveredMindmapNodeId,
		setHoveredMindmapButtonId,
		scheduleMindmapHoverClear,
		setPresenceCursor: setCanvasPresenceCursor,
		isMindmapNode,
		openKanbanCard,
		openKanbanList,
	});
	const handleStagePointerDown = useCallback(
		(event: React.PointerEvent<SVGSVGElement>) => {
			if (ellipseTrim.handlePointerDown(event)) return;
			handlePointerDown(event);
		},
		[ellipseTrim.handlePointerDown, handlePointerDown],
	);
	const handleStagePointerMove = useCallback(
		(event: React.PointerEvent<SVGSVGElement>) => {
			if (ellipseTrim.handlePointerMove(event)) return;
			handleCanvasPointerMove(event);
		},
		[ellipseTrim.handlePointerMove, handleCanvasPointerMove],
	);
	const handleStagePointerUp = useCallback(
		(event: React.PointerEvent<SVGSVGElement>) => {
			if (ellipseTrim.handlePointerUp(event)) return;
			handlePointerUp(event);
		},
		[ellipseTrim.handlePointerUp, handlePointerUp],
	);
	const handleCanvasContextMenu = useCallback(
		(event: React.MouseEvent) => {
			if (ellipseTrim.active) {
				event.preventDefault();
				event.stopPropagation();
				ellipseTrim.cancel();
				return;
			}
			handleContextMenu(event);
		},
		[ellipseTrim.active, ellipseTrim.cancel, handleContextMenu],
	);

	const showEditorChrome = !presentationMode && !sync.isReadonly && !zenMode;
	const selectedExistingElements = Array.from(selectedIds).flatMap((id) => {
		const selected = sync.elements.get(id);
		return selected ? [selected] : [];
	});
	const hasOnlyStructuredDiagramSelection =
		selectedExistingElements.length > 0 &&
		selectedExistingElements.every(
			(selected) =>
				findGanttChartElement(sync.elements.values(), selected) != null ||
				getSequenceDiagramId(selected) != null,
		);
	const hasPropertyContext =
		selectedIds.size > 0 ||
		pendingText != null ||
		store.editingTextId != null ||
		hasCanvasToolProperties(store.activeTool);
	const showProperties = shouldShowCanvasProperties({
		showEditorChrome,
		localMode,
		hasPropertyContext,
		hasOnlyStructuredDiagramSelection,
	});

	return (
		<CanvasCommandsProvider value={canvasCommands}>
			<CanvasEditor
				rootRef={containerRef}
				documentAdapter={pointerHandlers.documentAdapter}
				translations={canvasEditorTranslations}
				assetAdapter={canvasEditorAssetAdapter}
				collaboration={canvasEditorCollaboration}
				className={`skedra-canvas h-full w-full relative overflow-hidden select-none${store.isSpacePressed ? " cursor-grab" : ""}`}
				style={{ backgroundColor: canvasBg || "var(--background)" }}
				onContextMenu={handleCanvasContextMenu}
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
					stopUndoCapture={history.stopCapturing}
					selectedIds={selectedIds}
					pendingText={pendingText}
					editingTextId={store.editingTextId}
					editingArrowTextSide={editingArrowTextSide}
					editingArrowTextOrientation={editingArrowTextOrientation}
					getViewportCenter={getViewportCenter}
					addElements={addElements}
					fitElementsToViewport={fitElementsToViewport}
					handleUpdatePendingText={handleUpdatePendingText}
					handleUpdateEditingText={handleUpdateEditingText}
					setEditingArrowTextSide={setEditingArrowTextSide}
					setEditingArrowTextOrientation={setEditingArrowTextOrientation}
					deleteElementsWithKanbanReflow={deleteElementsWithKanbanReflow}
					keyboard={keyboard}
					onExportSkedra={handleExportSkedra}
					onExportExcalidraw={handleExportExcalidraw}
					onExportEncryptedSkedra={() => void handleExportEncryptedSkedra()}
					onImportSkedra={() => void handleImportSkedra()}
					onExportVisual={exportVisual}
					imageUploadOptions={imageUploadOptions}
					resolveAssetUrl={resolveAssetUrl}
					kanbanDetailId={kanbanDetailId}
					kanbanListDetailId={kanbanListDetailId}
					setKanbanDetailId={setKanbanDetailId}
					setKanbanListDetailId={setKanbanListDetailId}
					kanbanAssignmentOptions={kanbanAssignmentOptions}
					onPresentationElementsPreview={setPresentationElementPreviews}
					commands={canvasCommands}
				/>

				{showEditorChrome && workspacePanelTab && (
					<CanvasWorkspacePanel
						activeTab={workspacePanelTab}
						showComments={!!comments}
						showActivity={!!activity}
						onTabChange={handleWorkspaceTabChange}
						onShare={onOpenShare}
						onClose={handleCloseWorkspacePanel}
					>
						{workspacePanelTab === "search" ? (
							<CanvasFindOnCanvas
								open
								embedded
								query={canvasSearch.query}
								matches={canvasSearch.matches}
								activeIndex={canvasSearch.activeIndex}
								onOpenChange={(open) => {
									if (!open) handleCloseWorkspacePanel();
								}}
								onQueryChange={canvasSearch.setQuery}
								onActiveIndexChange={canvasSearch.setActiveIndex}
								onNext={canvasSearch.goToNext}
								onPrevious={canvasSearch.goToPrevious}
							/>
						) : workspacePanelTab === "library" ? (
							<Suspense fallback={null}>
								<WorkspaceLibraryPanel
									embedded
									selectedElements={Array.from(selectedIds)
										.map((id) => sync.elements.get(id))
										.filter((element): element is CanvasElement => !!element)}
									onInsertElements={addElements}
									getViewportCenter={getViewportCenter}
									onClose={handleCloseWorkspacePanel}
								/>
							</Suspense>
						) : workspacePanelTab === "comments" && comments ? (
							<WhiteboardCommentsPanel
								embedded
								open
								whiteboardName={comments.whiteboardName}
								threads={comments.threads}
								selectedThreadId={comments.selectedThreadId}
								showResolved={comments.showResolved}
								placementActive={comments.placementActive}
								isLoading={comments.isLoading}
								onClose={handleCloseWorkspacePanel}
								onSelectThread={(threadId) => comments.onSelectThread(threadId)}
								onToggleShowResolved={comments.onToggleShowResolved}
								onStartPlacement={comments.onStartPlacement}
							/>
						) : workspacePanelTab === "activity" && activity ? (
							<BoardActivityOverlay
								embedded
								open
								whiteboardId={activity.whiteboardId}
								whiteboardName={activity.whiteboardName}
								onClose={handleCloseWorkspacePanel}
							/>
						) : (
							<CanvasPresentationPanel
								views={savedViewList}
								elements={sync.elements}
								activeViewId={activeViewId}
								editingViewId={editingViewId}
								isCapturingView={isCapturingView}
								readOnly={sync.isReadonly}
								presentationPreparationMode={
									effectivePresentationPreparationMode
								}
								canUsePresenterNotes={canUsePresenterNotes}
								onStartCaptureView={startCaptureView}
								onCancelCaptureView={cancelCaptureView}
								onSelectView={handleSelectView}
								onStartEditView={handleStartEditView}
								onStopEditView={handleStopEditView}
								onDeleteView={handleDeleteView}
								onDuplicateView={handleDuplicateView}
								onMoveView={handleMoveView}
								onRenameView={handleRenameView}
								onOpenPresenterNotes={() => setPresenterNotesOpen(true)}
								onPreparePresentation={onOpenPresentationPreparation}
								onStartPresentation={onStartPresentation}
								renderPreview={renderSavedViewPreview}
							/>
						)}
					</CanvasWorkspacePanel>
				)}

				<SkedraCanvasStageSurface
					svgRef={svgRef}
					activeTool={store.activeTool}
					viewport={viewport}
					scene={sync.scene}
					elements={sync.elements}
					selectedIds={selectedIds}
					searchMatches={canvasSearch.matches}
					searchActiveIndex={canvasSearch.activeIndex}
					readOnly={presentationMode || sync.isReadonly}
					editingTextId={store.editingTextId}
					remotePresence={sync.remotePresence}
					editingView={editingView}
					textEditorOpen={textEditorOpen}
					viewDraft={viewDraft}
					drawingPreview={pointerHandlers.drawingPreview}
					pathStartSnap={pointerHandlers.pathStartSnap}
					croppingElement={croppingElement}
					ellipseTrimPreview={
						ellipseTrim.preview
							? {
									...ellipseTrim.preview,
									instruction: t("canvas.ellipseTrim.chooseSecondPoint"),
								}
							: null
					}
					resolveAssetUrl={resolveAssetUrl}
					onApplyImageCrop={handleApplyImageCrop}
					onCancelImageCrop={() => store.setCroppingImageId(null)}
					beginAuxiliaryPointerGesture={
						pointerHandlers.beginAuxiliaryPointerGesture
					}
					onPointerDown={handleStagePointerDown}
					onPointerMove={handleStagePointerMove}
					onPointerUp={handleStagePointerUp}
					onPointerCancel={handlePointerCancel}
					onLostPointerCapture={handleLostPointerCapture}
					onWheel={pointerHandlers.onWheel}
					onPointerLeave={handleCanvasPointerLeave}
					onDoubleClick={handleDoubleClick}
					onElementResizeStart={pointerHandlers.beginResize}
					onElementRotateStart={pointerHandlers.beginRotate}
					onElementRotateKeyDown={(event) => {
						const angleDelta = resolveCanvasEditorRotationKeyDelta(event);
						if (angleDelta == null) return;
						event.preventDefault();
						event.stopPropagation();
						keyboard.rotateSelection(angleDelta);
					}}
					onPathPointDragStart={pointerHandlers.beginPathPointDrag}
					runPointerUpAction={pointerHandlers.runPointerUpAction}
					onViewMoveStart={(event) => {
						if (
							editingView &&
							pointerHandlers.beginAuxiliaryPointerGesture(
								event,
								cancelViewInteraction,
							)
						) {
							beginViewMove(editingView.id, event);
						}
					}}
					onViewResizeStart={(handle, event) => {
						if (
							editingView &&
							pointerHandlers.beginAuxiliaryPointerGesture(
								event,
								cancelViewInteraction,
							)
						) {
							beginViewResize(handle, editingView.id, event);
						}
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
									readOnly: sync.isReadonly,
									presentationMode,
									presenterMode,
									presentationPreparationMode:
										effectivePresentationPreparationMode,
									showViews: !effectivePresentationPreparationMode,
									onUndo: history.undo,
									onRedo: history.redo,
									onFitViewport: handleFitViewport,
									onZoomBy: handleZoomBy,
									zoom: viewport.zoom,
									snapEnabled: store.snapToObjects,
									onToggleSnap: store.toggleSnapToObjects,
									views: savedViewList,
									elements: sync.elements,
									activeViewId,
									editingViewId,
									isCapturingView,
									onStartCaptureView: startCaptureView,
									onCancelCaptureView: cancelCaptureView,
									onSelectView: handleSelectView,
									onStartEditView: handleStartEditView,
									onStopEditView: handleStopEditView,
									onDeleteView: handleDeleteView,
									onDuplicateView: handleDuplicateView,
									onMoveView: handleMoveView,
									onRenameView: handleRenameView,
									onOpenPresenterNotes: () => setPresenterNotesOpen(true),
									canUsePresenterNotes,
									renderPreview: renderSavedViewPreview,
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
					readOnly={sync.isReadonly}
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
					onStartEllipseTrim={ellipseTrim.start}
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
					elements={sync.elements}
					selectedElements={selectedEls}
					onApplyMutationPlan={sync.applyMutationPlan}
					onToggleZenMode={() => store.toggleZenMode()}
					presenterNotesOpen={presenterNotesOpen}
					onPresenterNotesOpenChange={setPresenterNotesOpen}
					activeView={activeView}
					savedViewList={savedViewList}
					presenterNotes={presenterNotes.notes}
					onUpdatePresenterNotes={presenterNotes.saveNote}
					onSelectView={handleSelectView}
					presenterShareUrl={presenterShareUrl}
					presenterIsLive={presentationPublisher.isBroadcasting}
					presenterSessionActive={!!presenterSessionId}
					presenterConnectionReady={presentationPublisher.isConnected}
					presenterAudienceCount={presentationPublisher.audienceCount}
					presenterStartedAt={presenterStartedAt}
					presenterSessionStarting={presenterSessionStarting}
					presenterStartError={
						presenterStartError ?? presentationPublisher.publishError
					}
					onStartPresentation={onStartPresentation}
					onEndPresentation={onEndPresentation}
					onCancelPresentationPreparation={onCancelPresentationPreparation}
					presentationShareToken={presentationShareToken}
					audienceBoardName={audienceBoardName}
					audienceIsLive={presentationSync.presentationIsLive}
					audienceHasError={!!presentationSync.connectionError}
					audienceFollowPresenter={audienceFollowPresenter}
					onAudienceFollowPresenterChange={setAudienceFollowPresenter}
				/>

				<SkedraCanvasFileDialogs
					importDialogOpen={importDialogOpen}
					onImportDialogOpenChange={setImportDialogOpen}
					onConfirmImport={handleConfirmSkedraImport}
					fileError={fileError}
					onClearFileError={() => setFileError("")}
				/>
			</CanvasEditor>
		</CanvasCommandsProvider>
	);
}

type SkedraCanvasStageSurfaceProps = Omit<
	React.ComponentProps<typeof CanvasStage>,
	| "selectionBox"
	| "lassoPath"
	| "gridEnabled"
	| "gridSize"
	| "snapGuides"
	| "snapPointIndicators"
	| "selectedSnapOptions"
	| "transformOrigin"
	| "laserTrails"
>;

function SkedraCanvasStageSurface(props: SkedraCanvasStageSurfaceProps) {
	const visualState = useCanvasStore(
		useShallow((state) => ({
			gridEnabled: state.gridEnabled,
			gridSize: state.gridSize,
			lassoPath: state.lassoPath,
			laserTrails: state.laserTrails,
			selectionBox: state.selectionBox,
			snapGuides: state.snapGuides,
			snapPointIndicators: state.snapPointIndicators,
			showSnapPoints: state.showSnapPoints,
			snapToObjects: state.snapToObjects,
			snapToEndpoints: state.snapToEndpoints,
			snapToCenters: state.snapToCenters,
			snapToMidpoints: state.snapToMidpoints,
			snapToDivisions: state.snapToDivisions,
			snapDivisionCount: state.snapDivisionCount,
			snapToNearest: state.snapToNearest,
			snapToGeometricCenters: state.snapToGeometricCenters,
			snapToQuadrants: state.snapToQuadrants,
			snapToIntersections: state.snapToIntersections,
			snapToExtensions: state.snapToExtensions,
			snapToInsertions: state.snapToInsertions,
			transformOrigin: state.transformOrigin,
		})),
	);

	const {
		showSnapPoints,
		snapToObjects,
		snapToEndpoints,
		snapToCenters,
		snapToMidpoints,
		snapToDivisions,
		snapDivisionCount,
		snapToNearest,
		snapToGeometricCenters,
		snapToQuadrants,
		snapToIntersections,
		snapToExtensions,
		snapToInsertions,
		transformOrigin,
		...stageVisualState
	} = visualState;
	const selectedSnapOptions =
		snapToObjects && showSnapPoints
			? {
					includeEndpoints: snapToEndpoints,
					includeCenters: snapToCenters,
					includeMidpoints: snapToMidpoints,
					includeDivisions: snapToDivisions,
					divisionCount: snapDivisionCount,
					includeNearest: snapToNearest,
					includeGeometricCenters: snapToGeometricCenters,
					includeQuadrants: snapToQuadrants,
					includeIntersections: snapToIntersections,
					includeExtensions: snapToExtensions,
					includeInsertions: snapToInsertions,
				}
			: null;
	return (
		<CanvasStage
			{...props}
			{...stageVisualState}
			transformOrigin={transformOrigin}
			selectedSnapOptions={selectedSnapOptions}
		/>
	);
}
