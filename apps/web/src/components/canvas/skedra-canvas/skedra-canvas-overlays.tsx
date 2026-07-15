/**
 * Overlays um die Canvas-Stage: Mindmap, Flowchart, Presence, Kommentare, Bottom-Bar.
 */

import { FlowchartInsertButtons } from "@/components/canvas/flowchart-insert-buttons";
import { RemoteCursorOverlay } from "@/components/canvas/presence-overlays";
import { PresencePanel } from "@/components/canvas/presence-panel";
import { CanvasCommentLayer } from "@/components/whiteboard/canvas-comment-layer";
import type { PendingCommentPlacement } from "@/components/whiteboard/canvas-comment-layer";
import type { WhiteboardCommentThread } from "@/components/whiteboard/whiteboard-comment-types";
import type { MentionCandidate } from "@/lib/mention-utils";
import type { FlowchartNodeKind, FlowchartNodeMeta } from "@skedra/canvas-core";
import type { CanvasElement, Viewport } from "@skedra/canvas-core";
import { CanvasEditorSavedViewsBar } from "@skedra/canvas-editor";
import { Plus } from "lucide-react";
import type { ComponentProps, RefObject } from "react";

interface MindmapOverlayButton {
	key: string;
	left: number;
	top: number;
	title: string;
	onClick: () => void;
}

interface SkedraCanvasCommentsConfig {
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
}

interface SkedraCanvasOverlaysProps {
	zenMode: boolean;
	presentationMode: boolean;
	presenterMode: boolean;
	localMode: boolean;
	presenceEnabled: boolean;
	textEditorOpen: boolean;
	viewport: Viewport;
	svgRef: RefObject<SVGSVGElement | null>;
	sync: {
		isReadonly: boolean;
		remotePresence: ComponentProps<typeof RemoteCursorOverlay>["peers"];
		localPresence: ComponentProps<typeof PresencePanel>["currentUser"];
		isConnected: boolean;
	};
	mindmapButtons: MindmapOverlayButton[];
	activeMindmapNodeId: string | null | undefined;
	clearMindmapHoverLeaveTimeout: () => void;
	setHoveredMindmapButtonId: (id: string | null) => void;
	scheduleMindmapHoverClear: () => void;
	selectedFlowchartNode: CanvasElement | null;
	selectedFlowchartMeta: FlowchartNodeMeta | null | undefined;
	flowchartInsertKind: FlowchartNodeKind;
	onAddFlowchartStep: ComponentProps<
		typeof FlowchartInsertButtons
	>["onAddStep"];
	comments?: SkedraCanvasCommentsConfig;
	presencePanelOffsetTop?: number;
	presencePanelOffsetRight?: number;
	presencePanelSummaryOffsetRight?: number;
	presencePanelLayout?: ComponentProps<typeof PresencePanel>["layout"];
	bottomBar: ComponentProps<typeof CanvasEditorSavedViewsBar> | null;
}

export function SkedraCanvasOverlays({
	zenMode,
	presentationMode,
	presenterMode,
	localMode,
	presenceEnabled,
	textEditorOpen,
	viewport,
	svgRef,
	sync,
	mindmapButtons,
	activeMindmapNodeId,
	clearMindmapHoverLeaveTimeout,
	setHoveredMindmapButtonId,
	scheduleMindmapHoverClear,
	selectedFlowchartNode,
	selectedFlowchartMeta,
	flowchartInsertKind,
	onAddFlowchartStep,
	comments,
	presencePanelOffsetTop,
	presencePanelOffsetRight,
	presencePanelSummaryOffsetRight,
	presencePanelLayout,
	bottomBar,
}: SkedraCanvasOverlaysProps) {
	return (
		<>
			{mindmapButtons.map((button) => (
				<button
					key={button.key}
					type="button"
					onClick={button.onClick}
					onPointerEnter={() => {
						clearMindmapHoverLeaveTimeout();
						setHoveredMindmapButtonId(activeMindmapNodeId ?? null);
					}}
					onPointerLeave={() => {
						setHoveredMindmapButtonId(null);
						scheduleMindmapHoverClear();
					}}
					className="absolute z-40 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-card-foreground shadow-lg transition-colors hover:border-primary hover:bg-primary/10"
					style={{ left: button.left, top: button.top }}
					aria-label={button.title}
					title={button.title}
				>
					<Plus className="h-4 w-4" />
				</button>
			))}

			{!presentationMode &&
				!sync.isReadonly &&
				selectedFlowchartNode &&
				!textEditorOpen &&
				selectedFlowchartMeta && (
					<FlowchartInsertButtons
						node={selectedFlowchartNode}
						meta={selectedFlowchartMeta}
						viewport={viewport}
						insertKind={flowchartInsertKind}
						onAddStep={onAddFlowchartStep}
					/>
				)}

			{!localMode && presenceEnabled && (
				<RemoteCursorOverlay peers={sync.remotePresence} viewport={viewport} />
			)}

			{comments && !presentationMode && !presenterMode && (
				<CanvasCommentLayer
					viewport={viewport}
					threads={comments.threads}
					showResolved={comments.showResolved}
					selectedThreadId={comments.selectedThreadId}
					pendingPlacement={comments.pendingPlacement}
					placementActive={
						comments.placementActive && (comments.canComment ?? true)
					}
					currentUser={comments.currentUser}
					mentionCandidates={comments.mentionCandidates}
					canModerate={comments.canModerate}
					canComment={comments.canComment ?? true}
					isSending={comments.isSending}
					deletingMessageId={comments.deletingMessageId}
					onSelectThread={comments.onSelectThread}
					onCanvasClick={comments.onCanvasClick}
					onCreateThread={comments.onCreateThread}
					onReply={comments.onReply}
					onResolve={comments.onResolve}
					onDeleteThread={comments.onDeleteThread}
					onDeleteMessage={comments.onDeleteMessage}
					onCancelPlacement={comments.onCancelPlacement}
					svgRef={svgRef}
				/>
			)}

			{!localMode && presenceEnabled && (
				<PresencePanel
					currentUser={sync.localPresence}
					peers={sync.remotePresence}
					isConnected={sync.isConnected}
					isReadonly={sync.isReadonly}
					presentationMode={presentationMode}
					offsetTop={presencePanelOffsetTop}
					offsetRight={presencePanelOffsetRight}
					summaryOffsetRight={presencePanelSummaryOffsetRight}
					layout={presencePanelLayout}
				/>
			)}

			{!zenMode && bottomBar && <CanvasEditorSavedViewsBar {...bottomBar} />}
		</>
	);
}
