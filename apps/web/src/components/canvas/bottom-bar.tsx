import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCanvasStore } from "@/hooks/use-canvas-store";
import { useI18n } from "@/lib/i18n";
import type { CanvasElement, SavedCanvasView } from "@skedra/canvas-core";
import {
	BookmarkPlus,
	PanelsTopLeft,
	Redo2,
	StickyNote,
	Undo2,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { SavedViewTile } from "./saved-view-tile";

interface BottomBarProps {
	canUndo: boolean;
	canRedo: boolean;
	presentationMode?: boolean;
	presenterMode?: boolean;
	onUndo: () => void;
	onRedo: () => void;
	onFitViewport: () => void;
	views: SavedCanvasView[];
	elements: Map<string, CanvasElement>;
	activeViewId: string | null;
	editingViewId: string | null;
	isCapturingView: boolean;
	onStartCaptureView: () => void;
	onCancelCaptureView: () => void;
	onSelectView: (id: string) => void;
	onStartEditView: (id: string) => void;
	onStopEditView: () => void;
	onDeleteView: (id: string) => void;
	onDuplicateView: (id: string) => void;
	onMoveView: (id: string, direction: -1 | 1) => void;
	onRenameView: (id: string, name: string) => void;
	onOpenPresenterNotes: () => void;
	canUsePresenterNotes?: boolean;
	resolveAssetUrl?: (src: string) => string;
}

export function BottomBar({
	canUndo,
	canRedo,
	presentationMode = false,
	presenterMode = false,
	onUndo,
	onRedo,
	onFitViewport,
	views,
	elements,
	activeViewId,
	editingViewId,
	isCapturingView,
	onStartCaptureView,
	onCancelCaptureView,
	onSelectView,
	onStartEditView,
	onStopEditView,
	onDeleteView,
	onDuplicateView,
	onMoveView,
	onRenameView,
	onOpenPresenterNotes,
	canUsePresenterNotes = true,
	resolveAssetUrl,
}: BottomBarProps) {
	const viewportControls = useCanvasStore(
		useShallow((state) => ({
			zoom: state.viewport.zoom,
			zoomTo: state.zoomTo,
		})),
	);
	const { t } = useI18n();
	const zoomPercent = Math.round(viewportControls.zoom * 100);
	const splitIndex = Math.ceil(views.length / 2);
	const leftViews =
		presentationMode && !presenterMode ? [] : views.slice(0, splitIndex);
	const rightViews =
		presentationMode && !presenterMode ? [] : views.slice(splitIndex);

	const zoomTo = (factor: number) => {
		viewportControls.zoomTo(
			viewportControls.zoom * factor,
			window.innerWidth / 2,
			window.innerHeight / 2,
		);
	};

	const viewTileLabels = {
		editLabel: t("canvas.bottomBar.editView"),
		finishEditLabel: t("canvas.bottomBar.finishViewEditing"),
		deleteLabel: t("canvas.bottomBar.deleteView"),
		duplicateLabel: t("canvas.bottomBar.duplicateView"),
		movePreviousLabel: t("canvas.bottomBar.moveViewPrevious"),
		moveNextLabel: t("canvas.bottomBar.moveViewNext"),
	};

	return (
		<TooltipProvider delayDuration={300}>
			<div className="absolute bottom-3 left-1/2 z-40 flex w-[min(96vw,1180px)] -translate-x-1/2 items-end justify-center gap-3">
				<SavedViewsRail
					align="end"
					views={leftViews}
					showCapturingHint={isCapturingView}
					capturingLabel={t("canvas.bottomBar.capturingView")}
					elements={elements}
					activeViewId={activeViewId}
					editingViewId={editingViewId}
					onSelectView={onSelectView}
					onStartEditView={onStartEditView}
					onStopEditView={onStopEditView}
					onDeleteView={onDeleteView}
					onDuplicateView={onDuplicateView}
					onMoveView={onMoveView}
					canManageViews={!presenterMode}
					onRenameView={onRenameView}
					resolveAssetUrl={resolveAssetUrl}
					{...viewTileLabels}
				/>

				<div className="flex items-center gap-0.5 rounded-xl border border-border bg-card/90 px-1.5 py-1 shadow-xl backdrop-blur-md">
					<BarButton
						label={t("canvas.bottomBar.zoomOut")}
						onClick={() => zoomTo(0.8)}
					>
						<ZoomOut className="h-4 w-4" />
					</BarButton>

					<button
						type="button"
						onClick={onFitViewport}
						className="min-w-[52px] cursor-pointer rounded-md px-2 py-1.5 text-center text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-card-foreground"
						title={t("canvas.bottomBar.resetZoom")}
					>
						{zoomPercent}%
					</button>

					<BarButton
						label={t("canvas.bottomBar.zoomIn")}
						onClick={() => zoomTo(1.25)}
					>
						<ZoomIn className="h-4 w-4" />
					</BarButton>

					<div className="mx-1 h-5 w-px bg-border" />

					{!presentationMode && !presenterMode && (
						<>
							<BarButton
								label={t("canvas.bottomBar.undo")}
								onClick={onUndo}
								disabled={!canUndo}
							>
								<Undo2 className="h-4 w-4" />
							</BarButton>
							<BarButton
								label={t("canvas.bottomBar.redo")}
								onClick={onRedo}
								disabled={!canRedo}
							>
								<Redo2 className="h-4 w-4" />
							</BarButton>

							<div className="mx-1 h-5 w-px bg-border" />
							<span className="hidden items-center gap-1 px-1 text-xs font-semibold text-foreground sm:inline-flex">
								<PanelsTopLeft className="h-3.5 w-3.5" />
								{t("canvas.bottomBar.slides")}
							</span>

							<BarButton
								label={
									isCapturingView
										? t("canvas.bottomBar.cancelViewCapture")
										: t("canvas.bottomBar.saveView")
								}
								onClick={
									isCapturingView ? onCancelCaptureView : onStartCaptureView
								}
							>
								{isCapturingView ? (
									<X className="h-4 w-4" />
								) : (
									<BookmarkPlus className="h-4 w-4" />
								)}
							</BarButton>
							{canUsePresenterNotes && (
								<BarButton
									label={t("canvas.bottomBar.presenterNotes")}
									onClick={onOpenPresenterNotes}
									disabled={!activeViewId}
								>
									<StickyNote className="h-4 w-4" />
								</BarButton>
							)}
						</>
					)}
				</div>

				<SavedViewsRail
					align="start"
					views={rightViews}
					elements={elements}
					activeViewId={activeViewId}
					editingViewId={editingViewId}
					onSelectView={onSelectView}
					onStartEditView={onStartEditView}
					onStopEditView={onStopEditView}
					onDeleteView={onDeleteView}
					onDuplicateView={onDuplicateView}
					onMoveView={onMoveView}
					canManageViews={!presenterMode}
					onRenameView={onRenameView}
					resolveAssetUrl={resolveAssetUrl}
					{...viewTileLabels}
				/>
			</div>
		</TooltipProvider>
	);
}

function SavedViewsRail({
	align,
	views,
	showCapturingHint = false,
	capturingLabel,
	elements,
	activeViewId,
	editingViewId,
	onSelectView,
	onStartEditView,
	onStopEditView,
	onDeleteView,
	onDuplicateView,
	onMoveView,
	canManageViews,
	onRenameView,
	resolveAssetUrl,
	editLabel,
	finishEditLabel,
	deleteLabel,
	duplicateLabel,
	movePreviousLabel,
	moveNextLabel,
}: {
	align: "start" | "end";
	views: SavedCanvasView[];
	showCapturingHint?: boolean;
	capturingLabel?: string;
	elements: Map<string, CanvasElement>;
	activeViewId: string | null;
	editingViewId: string | null;
	onSelectView: (id: string) => void;
	onStartEditView: (id: string) => void;
	onStopEditView: () => void;
	onDeleteView: (id: string) => void;
	onDuplicateView: (id: string) => void;
	onMoveView: (id: string, direction: -1 | 1) => void;
	canManageViews: boolean;
	onRenameView: (id: string, name: string) => void;
	resolveAssetUrl?: (src: string) => string;
	editLabel: string;
	finishEditLabel: string;
	deleteLabel: string;
	duplicateLabel: string;
	movePreviousLabel: string;
	moveNextLabel: string;
}) {
	const justifyClass = align === "end" ? "justify-end" : "justify-start";

	if (views.length === 0 && !showCapturingHint) {
		return <div className={`flex min-w-0 flex-1 ${justifyClass}`} />;
	}

	return (
		<div className={`flex min-w-0 flex-1 ${justifyClass}`}>
			<div className="flex max-w-[min(34vw,360px)] items-end gap-2 overflow-x-auto px-1">
				{showCapturingHint && (
					<div className="w-24 shrink-0 px-1 text-right text-[11px] font-medium text-emerald-300">
						{capturingLabel}
					</div>
				)}
				{views.map((view, index) => (
					<SavedViewTile
						key={view.id}
						view={view}
						elements={elements}
						isActive={view.id === activeViewId}
						isEditing={view.id === editingViewId}
						onSelect={onSelectView}
						onStartEdit={onStartEditView}
						onStopEdit={onStopEditView}
						onDelete={onDeleteView}
						onDuplicate={onDuplicateView}
						onMove={onMoveView}
						canManage={canManageViews}
						canMovePrevious={index > 0}
						canMoveNext={index < views.length - 1}
						onRename={onRenameView}
						resolveAssetUrl={resolveAssetUrl}
						editLabel={editLabel}
						finishEditLabel={finishEditLabel}
						deleteLabel={deleteLabel}
						duplicateLabel={duplicateLabel}
						movePreviousLabel={movePreviousLabel}
						moveNextLabel={moveNextLabel}
					/>
				))}
			</div>
		</div>
	);
}

function BarButton({
	children,
	label,
	onClick,
	disabled,
}: {
	children: React.ReactNode;
	label: string;
	onClick?: () => void;
	disabled?: boolean;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onClick}
					disabled={disabled}
					className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
						disabled
							? "cursor-not-allowed text-muted-foreground/40"
							: "cursor-pointer text-muted-foreground hover:bg-accent hover:text-accent-foreground"
					}`}
				>
					{children}
				</button>
			</TooltipTrigger>
			<TooltipContent side="top" className="text-xs">
				{label}
			</TooltipContent>
		</Tooltip>
	);
}
