/**
 * Praesentations-, Hilfe- und KI-Chrome um das Canvas.
 */

import { CanvasCommandPalette } from "@/components/canvas/canvas-command-palette";
import type { CanvasCommand } from "@/components/canvas/canvas-command-registry";
import { CanvasDetailsMenu } from "@/components/canvas/canvas-details-menu";
import { CanvasFooter } from "@/components/canvas/canvas-footer";
import { PresencePanel } from "@/components/canvas/presence-panel";
import { useCanvasChromeInset } from "@/components/canvas/use-canvas-chrome-inset";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import type {
	CanvasElement,
	CanvasMutationPlan,
	SavedCanvasView,
} from "@skedra/canvas-core";
import { Scan, Sparkles } from "lucide-react";
import { type ComponentProps, Suspense, lazy } from "react";

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
	elements: Map<string, CanvasElement>;
	selectedElements: CanvasElement[];
	onApplyMutationPlan: (plan: CanvasMutationPlan) => void;
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
	onCancelPresentationPreparation?: () => void;
	presentationShareToken?: string;
	audienceBoardName?: string;
	audienceIsLive: boolean;
	audienceHasError: boolean;
	audienceFollowPresenter: boolean;
	onAudienceFollowPresenterChange: (follow: boolean) => void;
	presence?: ComponentProps<typeof PresencePanel>;
	connectionError?: string | null;
	onFitViewport?: () => void;
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
	elements,
	selectedElements,
	onApplyMutationPlan,
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
	onCancelPresentationPreparation,
	presentationShareToken,
	audienceBoardName,
	audienceIsLive,
	audienceHasError,
	audienceFollowPresenter,
	onAudienceFollowPresenterChange,
	presence,
	connectionError,
	onFitViewport,
}: SkedraCanvasChromeProps) {
	const { t } = useI18n();
	const showStatusDock =
		!presentationMode && !localMode && (!zenMode || !!connectionError);
	const statusRef = useCanvasChromeInset("top", showStatusDock);
	const showUtilities = showStatusDock && !presenterMode && !zenMode;
	const showAi = showUtilities && !!whiteboardId && canUseAi;
	const presencePanel = presence ? (
		<PresencePanel {...presence} inline />
	) : null;

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

			{showStatusDock && (
				<div
					ref={statusRef}
					className="skedra-canvas-status pointer-events-none absolute z-40 flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2"
					style={{
						top: `max(calc(${presence?.offsetTop ?? 12}px + env(safe-area-inset-top)), var(--skedra-board-header-inset, 0px))`,
						right: `calc(${presence?.offsetRight ?? 12}px + env(safe-area-inset-right))`,
					}}
					data-skedra-ui="status-dock"
				>
					<div className="skedra-compact-only">
						<CanvasDetailsMenu
							label={
								presence && presence.peers.length > 0
									? t("canvas.chrome.online", {
											count:
												presence.peers.length + (presence.currentUser ? 1 : 0),
										})
									: t("canvas.chrome.details")
							}
							iconOnly={false}
							className="min-h-11 gap-2 bg-card/95 text-xs"
						>
							{presencePanel}
							{showAi && (
								<DropdownMenuItem
									onSelect={() => onAiPanelOpenChange(!aiPanelOpen)}
								>
									<Sparkles className="mr-2 h-4 w-4 text-primary" />
									{t("whiteboardPage.ai.open")}
								</DropdownMenuItem>
							)}
							{onFitViewport && (
								<DropdownMenuItem onSelect={onFitViewport}>
									<Scan className="mr-2 h-4 w-4" />
									{t("canvas.bottomBar.fitBoard")}
								</DropdownMenuItem>
							)}
							{showUtilities && (
								<CanvasFooter
									inline
									menu
									onOpenHelp={() => onHelpDialogOpenChange(true)}
									encryptionMode={encryptionMode}
								/>
							)}
						</CanvasDetailsMenu>
					</div>
					{showUtilities && (
						<div className="skedra-wide-only flex flex-wrap items-center justify-end gap-2">
							{showAi && (
								<button
									type="button"
									onClick={() => onAiPanelOpenChange(!aiPanelOpen)}
									aria-expanded={aiPanelOpen}
									className="pointer-events-auto flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card/90 px-3 py-1.5 text-sm font-medium shadow-xl backdrop-blur-md hover:bg-card"
								>
									<Sparkles className="h-4 w-4 shrink-0 text-primary" />
									{t("whiteboardPage.ai.open")}
								</button>
							)}
							<CanvasFooter
								inline
								onOpenHelp={() => onHelpDialogOpenChange(true)}
								encryptionMode={encryptionMode}
							/>
						</div>
					)}
					<div className="skedra-wide-only">{presencePanel}</div>
					{onFitViewport && !presenterMode && (
						<button
							type="button"
							onClick={onFitViewport}
							className="skedra-wide-only skedra-mobile-fit pointer-events-auto min-h-11 items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 text-sm font-medium"
						>
							<Scan className="h-4 w-4" />
							{t("canvas.bottomBar.fitBoard")}
						</button>
					)}
					{connectionError && (
						<p
							role="alert"
							className="max-w-sm rounded-xl border border-destructive/30 bg-card/95 px-3 py-2 text-sm text-destructive"
						>
							{connectionError}
						</p>
					)}
				</div>
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
						activeSlideIndex={savedViewList.findIndex(
							(view) => view.id === activeView?.id,
						)}
						onPreviousSlide={() => {
							const index = savedViewList.findIndex(
								(view) => view.id === activeView?.id,
							);
							if (index > 0) onSelectView(savedViewList[index - 1].id);
						}}
						onNextSlide={() => {
							const index = savedViewList.findIndex(
								(view) => view.id === activeView?.id,
							);
							if (index < savedViewList.length - 1)
								onSelectView(savedViewList[index + 1].id);
						}}
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
						onCancelPreparation={onCancelPresentationPreparation}
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
						presence={presencePanel}
					/>
				</Suspense>
			)}

			{!presentationMode &&
				!presenterMode &&
				!localMode &&
				whiteboardId &&
				canUseAi &&
				aiPanelOpen && (
					<Suspense fallback={null}>
						<AiDiagramPanel
							open={aiPanelOpen}
							whiteboardId={whiteboardId}
							onClose={() => onAiPanelOpenChange(false)}
							onAddElements={onAddElements}
							elements={elements}
							selectedElements={selectedElements}
							onApplyMutationPlan={onApplyMutationPlan}
						/>
					</Suspense>
				)}
		</>
	);
}
