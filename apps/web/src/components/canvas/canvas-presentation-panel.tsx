import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { CanvasElement, SavedCanvasView } from "@skedra/canvas-core";
import {
	type CanvasEditorSavedViewPreviewRenderer,
	CanvasEditorSavedViewTile,
} from "@skedra/canvas-editor";
import { BookmarkPlus, MonitorPlay, StickyNote, X } from "lucide-react";

interface CanvasPresentationPanelProps {
	views: SavedCanvasView[];
	elements: ReadonlyMap<string, CanvasElement>;
	activeViewId: string | null;
	editingViewId: string | null;
	isCapturingView: boolean;
	readOnly: boolean;
	presentationPreparationMode: boolean;
	canUsePresenterNotes: boolean;
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
	onPreparePresentation?: () => void;
	onStartPresentation?: () => void;
	renderPreview: CanvasEditorSavedViewPreviewRenderer;
}

export function CanvasPresentationPanel({
	views,
	elements,
	activeViewId,
	editingViewId,
	isCapturingView,
	readOnly,
	presentationPreparationMode,
	canUsePresenterNotes,
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
	onPreparePresentation,
	onStartPresentation,
	renderPreview,
}: CanvasPresentationPanelProps) {
	const { t } = useI18n();
	const canManage = !readOnly && presentationPreparationMode;
	const createLabel = t("canvas.bottomBar.createSlide");

	return (
		<section
			className="flex h-full min-h-0 flex-col"
			aria-label={t("canvas.workspace.presentation.title")}
		>
			<div className="shrink-0 border-b border-border/70 px-4 py-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<h2 className="text-base font-semibold text-foreground">
							{t("canvas.workspace.presentation.title")}
						</h2>
						<p className="mt-1 text-xs leading-5 text-muted-foreground">
							{t("canvas.workspace.presentation.description")}
						</p>
					</div>
					{canManage && (
						<Button
							type="button"
							variant={isCapturingView ? "outline" : "ghost"}
							size="sm"
							className="h-9 shrink-0 px-2.5 text-xs"
							onClick={
								isCapturingView ? onCancelCaptureView : onStartCaptureView
							}
						>
							{isCapturingView ? (
								<X className="mr-1.5 h-3.5 w-3.5" />
							) : (
								<BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
							)}
							{isCapturingView ? t("common.cancel") : createLabel}
						</Button>
					)}
				</div>

				{isCapturingView && (
					<div className="mt-3 rounded-xl border border-primary/25 bg-primary/8 px-3 py-2 text-xs leading-5 text-foreground">
						{t("canvas.bottomBar.capturingSlide")}
					</div>
				)}
			</div>

			<div className="skedra-workspace__views-list min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 [scrollbar-gutter:stable]">
				{views.length === 0 ? (
					<div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
						<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<MonitorPlay className="h-6 w-6" aria-hidden="true" />
						</div>
						<h3 className="mt-4 text-sm font-semibold text-foreground">
							{t("canvas.workspace.presentation.emptyTitle")}
						</h3>
						<p className="mt-1.5 max-w-64 text-xs leading-5 text-muted-foreground">
							{t("canvas.workspace.presentation.emptyDescription")}
						</p>
						{canManage ? (
							<Button
								type="button"
								size="sm"
								className="mt-4"
								onClick={onStartCaptureView}
							>
								<BookmarkPlus className="mr-1.5 h-4 w-4" />
								{createLabel}
							</Button>
						) : onPreparePresentation ? (
							<Button
								type="button"
								size="sm"
								className="mt-4"
								onClick={onPreparePresentation}
							>
								<MonitorPlay className="mr-1.5 h-4 w-4" />
								{t("canvas.workspace.presentation.prepare")}
							</Button>
						) : null}
					</div>
				) : (
					views.map((view, index) => (
						<CanvasEditorSavedViewTile
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
							onRename={onRenameView}
							canManage={canManage}
							canMovePrevious={index > 0}
							canMoveNext={index < views.length - 1}
							renderPreview={renderPreview}
							showAspectRatio
							freeAspectLabel={t("canvas.bottomBar.freeAspect")}
							editLabel={t("canvas.bottomBar.editSlide")}
							finishEditLabel={t("canvas.bottomBar.finishViewEditing")}
							deleteLabel={t("canvas.bottomBar.deleteSlide")}
							duplicateLabel={t("canvas.bottomBar.duplicateSlide")}
							movePreviousLabel={t("canvas.bottomBar.moveSlidePrevious")}
							moveNextLabel={t("canvas.bottomBar.moveSlideNext")}
						/>
					))
				)}
			</div>

			{views.length > 0 &&
				(canUsePresenterNotes ||
					onPreparePresentation ||
					onStartPresentation) && (
					<div className="flex shrink-0 gap-2 border-t border-border/70 p-3">
						{canUsePresenterNotes && (
							<Button
								type="button"
								variant="outline"
								size="icon"
								className="h-10 w-10 shrink-0"
								disabled={!activeViewId}
								onClick={onOpenPresenterNotes}
								aria-label={t("canvas.bottomBar.presenterNotes")}
								title={t("canvas.bottomBar.presenterNotes")}
							>
								<StickyNote className="h-4 w-4" />
							</Button>
						)}
						{presentationPreparationMode && onStartPresentation ? (
							<Button
								type="button"
								className="h-10 flex-1"
								onClick={onStartPresentation}
							>
								<MonitorPlay className="mr-2 h-4 w-4" />
								{t("canvas.workspace.presentation.start")}
							</Button>
						) : onPreparePresentation ? (
							<Button
								type="button"
								className="h-10 flex-1"
								onClick={onPreparePresentation}
							>
								<MonitorPlay className="mr-2 h-4 w-4" />
								{t("canvas.workspace.presentation.prepare")}
							</Button>
						) : null}
					</div>
				)}
		</section>
	);
}
