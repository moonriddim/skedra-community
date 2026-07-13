/**
 * Praesentations-, Hilfe- und KI-Chrome um das Canvas.
 */

import { CanvasCommandPalette } from "@/components/canvas/canvas-command-palette";
import type { CanvasCommand } from "@/components/canvas/canvas-command-palette";
import { CanvasFooter } from "@/components/canvas/canvas-footer";
import { useI18n } from "@/lib/i18n";
import type { CanvasElement, SavedCanvasView } from "@skedra/canvas-core";
import { Sparkles } from "lucide-react";
import { Suspense, lazy } from "react";

const AiDiagramPanel = lazy(() =>
	import("@/components/board/ai-diagram-panel").then((module) => ({
		default: module.AiDiagramPanel,
	})),
);
const AudienceChrome = lazy(() =>
	import("@/components/board/audience-chrome").then((module) => ({
		default: module.AudienceChrome,
	})),
);
const PresenterChrome = lazy(() =>
	import("@/components/board/presenter-chrome").then((module) => ({
		default: module.PresenterChrome,
	})),
);
const PresenterNotesPanel = lazy(() =>
	import("@/components/board/presenter-notes-panel").then((module) => ({
		default: module.PresenterNotesPanel,
	})),
);
const CanvasHelpDialog = lazy(() =>
	import("@/components/canvas/canvas-help-dialog").then((module) => ({
		default: module.CanvasHelpDialog,
	})),
);

interface SkedraCanvasChromeProps {
	presentationMode: boolean;
	presenterMode: boolean;
	zenMode: boolean;
	localMode: boolean;
	encryptionMode: "server" | "e2ee";
	whiteboardId?: string;
	canUseAi: boolean;
	helpGuestMode: boolean;
	helpDialogOpen: boolean;
	onHelpDialogOpenChange: (open: boolean) => void;
	commandPaletteOpen: boolean;
	onCommandPaletteOpenChange: (open: boolean) => void;
	commandPaletteCommands: CanvasCommand[];
	aiPanelOpen: boolean;
	onAiPanelOpenChange: (open: boolean) => void;
	onAddElements: (elements: CanvasElement[]) => void;
	onToggleZenMode: () => void;
	presenterNotesOpen: boolean;
	onPresenterNotesOpenChange: (open: boolean) => void;
	activeView: SavedCanvasView | null;
	savedViewList: SavedCanvasView[];
	presenterNotes: Map<string, string>;
	onUpdatePresenterNotes: (viewId: string, notes: string) => void;
	onSelectView: (viewId: string) => void;
	presenterShareUrl: string;
	presenterIsLive: boolean;
	presenterSessionActive: boolean;
	presenterConnectionReady: boolean;
	presenterAudienceCount: number;
	presenterStartedAt?: string | null;
	presenterSessionStarting: boolean;
	presenterStartError?: string | null;
	onStartPresentation?: () => void;
	onEndPresentation?: () => void;
	presentationShareToken?: string;
	audienceBoardName?: string;
	audienceIsLive: boolean;
	audienceHasError: boolean;
	audienceFollowPresenter: boolean;
	onAudienceFollowPresenterChange: (follow: boolean) => void;
}

export function SkedraCanvasChrome({
	presentationMode,
	presenterMode,
	zenMode,
	localMode,
	encryptionMode,
	whiteboardId,
	canUseAi,
	helpGuestMode,
	helpDialogOpen,
	onHelpDialogOpenChange,
	commandPaletteOpen,
	onCommandPaletteOpenChange,
	commandPaletteCommands,
	aiPanelOpen,
	onAiPanelOpenChange,
	onAddElements,
	onToggleZenMode,
	presenterNotesOpen,
	onPresenterNotesOpenChange,
	activeView,
	savedViewList,
	presenterNotes,
	onUpdatePresenterNotes,
	onSelectView,
	presenterShareUrl,
	presenterIsLive,
	presenterSessionActive,
	presenterConnectionReady,
	presenterAudienceCount,
	presenterStartedAt,
	presenterSessionStarting,
	presenterStartError,
	onStartPresentation,
	onEndPresentation,
	presentationShareToken,
	audienceBoardName,
	audienceIsLive,
	audienceHasError,
	audienceFollowPresenter,
	onAudienceFollowPresenterChange,
}: SkedraCanvasChromeProps) {
	const { t } = useI18n();

	return (
		<>
			{zenMode && !presentationMode && (
				<button
					type="button"
					className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-card/90 px-4 py-2 text-sm text-muted-foreground shadow-lg backdrop-blur hover:text-foreground"
					onClick={onToggleZenMode}
				>
					{t("canvas.zenMode.exit")}
				</button>
			)}

			<CanvasCommandPalette
				open={commandPaletteOpen}
				onOpenChange={onCommandPaletteOpenChange}
				commands={commandPaletteCommands}
			/>

			{!presentationMode && !presenterMode && !zenMode && (
				<CanvasFooter
					onOpenHelp={() => onHelpDialogOpenChange(true)}
					encryptionMode={localMode ? "local" : encryptionMode}
				/>
			)}

			{helpDialogOpen && (
				<Suspense fallback={null}>
					<CanvasHelpDialog
						open={helpDialogOpen}
						onOpenChange={onHelpDialogOpenChange}
						guestMode={helpGuestMode}
					/>
				</Suspense>
			)}

			{!presentationMode && presenterNotesOpen && (
				<Suspense fallback={null}>
					<PresenterNotesPanel
						open={presenterNotesOpen}
						activeView={activeView}
						views={savedViewList}
						activeNotes={
							activeView ? (presenterNotes.get(activeView.id) ?? "") : ""
						}
						onUpdateNotes={onUpdatePresenterNotes}
						onSelectView={onSelectView}
						onClose={() => onPresenterNotesOpenChange(false)}
					/>
				</Suspense>
			)}

			{presenterMode && !localMode && (
				<Suspense fallback={null}>
					<PresenterChrome
						shareUrl={presenterShareUrl}
						isLive={presenterIsLive}
						sessionActive={presenterSessionActive}
						connectionReady={presenterConnectionReady}
						audienceCount={presenterAudienceCount}
						startedAt={presenterStartedAt}
						isStarting={presenterSessionStarting}
						startError={presenterStartError}
						activeSlideName={activeView?.name ?? null}
						nextSlideName={
							activeView
								? (savedViewList[
										savedViewList.findIndex(
											(view) => view.id === activeView.id,
										) + 1
									]?.name ?? null)
								: null
						}
						slideCount={savedViewList.length}
						notesCount={
							savedViewList.filter((view) =>
								presenterNotes.get(view.id)?.trim(),
							).length
						}
						onOpenNotes={() => onPresenterNotesOpenChange(!presenterNotesOpen)}
						notesOpen={presenterNotesOpen}
						onStart={onStartPresentation}
						onEnd={onEndPresentation}
					/>
				</Suspense>
			)}

			{presentationMode && presentationShareToken && audienceBoardName && (
				<Suspense fallback={null}>
					<AudienceChrome
						boardName={audienceBoardName}
						activeView={activeView}
						isLive={audienceIsLive}
						hasError={audienceHasError}
						slideCount={savedViewList.length}
						followPresenter={audienceFollowPresenter}
						onFollowPresenterChange={onAudienceFollowPresenterChange}
					/>
				</Suspense>
			)}

			{!presentationMode &&
				!presenterMode &&
				!localMode &&
				whiteboardId &&
				canUseAi && (
					<>
						<button
							type="button"
							onClick={() => onAiPanelOpenChange(true)}
							className="absolute bottom-3 left-3 z-40 flex items-center gap-1.5 rounded-xl border border-border bg-card/90 px-3 py-1.5 text-sm font-medium shadow-xl backdrop-blur-md hover:bg-card"
						>
							<Sparkles className="h-4 w-4 text-primary" />
							{t("whiteboardPage.ai.open")}
						</button>
						{aiPanelOpen && (
							<Suspense fallback={null}>
								<AiDiagramPanel
									open={aiPanelOpen}
									whiteboardId={whiteboardId}
									onClose={() => onAiPanelOpenChange(false)}
									onAddElements={onAddElements}
								/>
							</Suspense>
						)}
					</>
				)}
		</>
	);
}
