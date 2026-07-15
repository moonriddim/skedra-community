import type { CanvasElement, SavedCanvasView } from "@skedra/canvas-core";
import {
	BookmarkPlus,
	Magnet,
	PanelsTopLeft,
	Redo2,
	StickyNote,
	Undo2,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import type { ReactNode } from "react";
import { useOptionalCanvasEditorServices } from "./canvas-editor";
import {
	type CanvasEditorSavedViewPreviewRenderer,
	CanvasEditorSavedViewTile,
} from "./canvas-editor-saved-view-tile";

export interface CanvasEditorSavedViewsBarProps {
	canUndo: boolean;
	canRedo: boolean;
	readOnly?: boolean;
	presentationMode?: boolean;
	presenterMode?: boolean;
	presentationPreparationMode?: boolean;
	onUndo: () => void;
	onRedo: () => void;
	onFitViewport: () => void;
	onZoomBy: (factor: number) => void;
	zoom: number;
	snapEnabled?: boolean;
	onToggleSnap?: () => void;
	views: SavedCanvasView[];
	elements: ReadonlyMap<string, CanvasElement>;
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
	onOpenPresenterNotes?: () => void;
	canUsePresenterNotes?: boolean;
	renderPreview: CanvasEditorSavedViewPreviewRenderer;
}

const FALLBACKS = {
	zoomOut: "Zoom out",
	zoomIn: "Zoom in",
	resetZoom: "Fit canvas",
	undo: "Undo",
	redo: "Redo",
	objectSnap: "Toggle object snap",
	views: "Views",
	slides: "Slides",
	saveView: "Save view",
	createSlide: "Create slide",
	cancelViewCapture: "Cancel view capture",
	cancelSlideCapture: "Cancel slide capture",
	capturingView: "Drag an area to save a view",
	capturingSlide: "Drag an area to create a slide",
	presenterNotes: "Presenter notes",
	editView: "Edit view",
	editSlide: "Edit slide",
	finishViewEditing: "Finish editing",
	deleteView: "Delete view",
	deleteSlide: "Delete slide",
	duplicateView: "Duplicate view",
	duplicateSlide: "Duplicate slide",
	moveViewPrevious: "Move view left",
	moveViewNext: "Move view right",
	moveSlidePrevious: "Move slide left",
	moveSlideNext: "Move slide right",
	freeAspect: "Free",
	controls: "Canvas and saved view controls",
} as const;

export function CanvasEditorSavedViewsBar({
	canUndo,
	canRedo,
	readOnly = false,
	presentationMode = false,
	presenterMode = false,
	presentationPreparationMode = false,
	onUndo,
	onRedo,
	onFitViewport,
	onZoomBy,
	zoom,
	snapEnabled,
	onToggleSnap,
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
	renderPreview,
}: CanvasEditorSavedViewsBarProps) {
	const services = useOptionalCanvasEditorServices();
	const t = (key: string, fallback: string) =>
		services?.translations?.translate(key, fallback) ?? fallback;
	const zoomPercent = Math.round(zoom * 100);
	const splitIndex = Math.ceil(views.length / 2);
	const leftViews =
		presentationMode && !presenterMode ? [] : views.slice(0, splitIndex);
	const rightViews =
		presentationMode && !presenterMode ? [] : views.slice(splitIndex);
	const canManageViews = !presentationMode && !readOnly;
	const labels = presentationPreparationMode
		? {
				editLabel: t("canvas.bottomBar.editSlide", FALLBACKS.editSlide),
				finishEditLabel: t(
					"canvas.bottomBar.finishViewEditing",
					FALLBACKS.finishViewEditing,
				),
				deleteLabel: t("canvas.bottomBar.deleteSlide", FALLBACKS.deleteSlide),
				duplicateLabel: t(
					"canvas.bottomBar.duplicateSlide",
					FALLBACKS.duplicateSlide,
				),
				movePreviousLabel: t(
					"canvas.bottomBar.moveSlidePrevious",
					FALLBACKS.moveSlidePrevious,
				),
				moveNextLabel: t(
					"canvas.bottomBar.moveSlideNext",
					FALLBACKS.moveSlideNext,
				),
			}
		: {
				editLabel: t("canvas.bottomBar.editView", FALLBACKS.editView),
				finishEditLabel: t(
					"canvas.bottomBar.finishViewEditing",
					FALLBACKS.finishViewEditing,
				),
				deleteLabel: t("canvas.bottomBar.deleteView", FALLBACKS.deleteView),
				duplicateLabel: t(
					"canvas.bottomBar.duplicateView",
					FALLBACKS.duplicateView,
				),
				movePreviousLabel: t(
					"canvas.bottomBar.moveViewPrevious",
					FALLBACKS.moveViewPrevious,
				),
				moveNextLabel: t(
					"canvas.bottomBar.moveViewNext",
					FALLBACKS.moveViewNext,
				),
			};
	const railProps = {
		elements,
		activeViewId,
		editingViewId,
		onSelectView,
		onStartEditView,
		onStopEditView,
		onDeleteView,
		onDuplicateView,
		onMoveView,
		onRenameView,
		canManageViews,
		renderPreview,
		showAspectRatio: presentationPreparationMode,
		freeAspectLabel: t("canvas.bottomBar.freeAspect", FALLBACKS.freeAspect),
		...labels,
	};

	return (
		<div
			className="canvas-editor__saved-views-bar"
			data-skedra-ui="saved-views-bar"
		>
			<SavedViewsRail
				align="end"
				views={leftViews}
				showCapturingHint={isCapturingView}
				capturingLabel={t(
					presentationPreparationMode
						? "canvas.bottomBar.capturingSlide"
						: "canvas.bottomBar.capturingView",
					presentationPreparationMode
						? FALLBACKS.capturingSlide
						: FALLBACKS.capturingView,
				)}
				{...railProps}
			/>

			<div
				className="canvas-editor__saved-views-controls"
				role="toolbar"
				aria-label={t("canvas.bottomBar.controls", FALLBACKS.controls)}
			>
				<BarButton
					label={t("canvas.bottomBar.zoomOut", FALLBACKS.zoomOut)}
					onClick={() => onZoomBy(0.8)}
				>
					<ZoomOut size={16} />
				</BarButton>
				<button
					type="button"
					onClick={onFitViewport}
					className="canvas-editor__saved-views-zoom"
					title={t("canvas.bottomBar.resetZoom", FALLBACKS.resetZoom)}
				>
					{zoomPercent}%
				</button>
				<BarButton
					label={t("canvas.bottomBar.zoomIn", FALLBACKS.zoomIn)}
					onClick={() => onZoomBy(1.25)}
				>
					<ZoomIn size={16} />
				</BarButton>
				{onToggleSnap && snapEnabled !== undefined && (
					<BarButton
						label={t("canvas.bottomBar.objectSnap", FALLBACKS.objectSnap)}
						onClick={onToggleSnap}
						pressed={snapEnabled}
					>
						<Magnet size={16} />
					</BarButton>
				)}

				<span className="canvas-editor__saved-views-divider" />

				{!presentationMode && (
					<>
						<BarButton
							label={t("canvas.bottomBar.undo", FALLBACKS.undo)}
							onClick={onUndo}
							disabled={!canUndo}
						>
							<Undo2 size={16} />
						</BarButton>
						<BarButton
							label={t("canvas.bottomBar.redo", FALLBACKS.redo)}
							onClick={onRedo}
							disabled={!canRedo}
						>
							<Redo2 size={16} />
						</BarButton>
						<span className="canvas-editor__saved-views-divider" />
						<span className="canvas-editor__saved-views-label">
							<PanelsTopLeft size={14} />
							{t(
								presentationPreparationMode
									? "canvas.bottomBar.slides"
									: "canvas.bottomBar.views",
								presentationPreparationMode
									? FALLBACKS.slides
									: FALLBACKS.views,
							)}
						</span>
						{!readOnly && (
							<BarButton
								label={t(
									isCapturingView
										? presentationPreparationMode
											? "canvas.bottomBar.cancelSlideCapture"
											: "canvas.bottomBar.cancelViewCapture"
										: presentationPreparationMode
											? "canvas.bottomBar.createSlide"
											: "canvas.bottomBar.saveView",
									isCapturingView
										? presentationPreparationMode
											? FALLBACKS.cancelSlideCapture
											: FALLBACKS.cancelViewCapture
										: presentationPreparationMode
											? FALLBACKS.createSlide
											: FALLBACKS.saveView,
								)}
								onClick={
									isCapturingView ? onCancelCaptureView : onStartCaptureView
								}
							>
								{isCapturingView ? <X size={16} /> : <BookmarkPlus size={16} />}
							</BarButton>
						)}
						{presentationPreparationMode &&
							canUsePresenterNotes &&
							onOpenPresenterNotes && (
								<BarButton
									label={t(
										"canvas.bottomBar.presenterNotes",
										FALLBACKS.presenterNotes,
									)}
									onClick={onOpenPresenterNotes}
									disabled={!activeViewId}
								>
									<StickyNote size={16} />
								</BarButton>
							)}
					</>
				)}
			</div>

			<SavedViewsRail align="start" views={rightViews} {...railProps} />
		</div>
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
	onRenameView,
	canManageViews,
	renderPreview,
	showAspectRatio,
	freeAspectLabel,
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
	elements: ReadonlyMap<string, CanvasElement>;
	activeViewId: string | null;
	editingViewId: string | null;
	onSelectView: (id: string) => void;
	onStartEditView: (id: string) => void;
	onStopEditView: () => void;
	onDeleteView: (id: string) => void;
	onDuplicateView: (id: string) => void;
	onMoveView: (id: string, direction: -1 | 1) => void;
	onRenameView: (id: string, name: string) => void;
	canManageViews: boolean;
	renderPreview: CanvasEditorSavedViewPreviewRenderer;
	showAspectRatio: boolean;
	freeAspectLabel: string;
	editLabel: string;
	finishEditLabel: string;
	deleteLabel: string;
	duplicateLabel: string;
	movePreviousLabel: string;
	moveNextLabel: string;
}) {
	if (views.length === 0 && !showCapturingHint) {
		return <div className="canvas-editor__saved-views-rail-empty" />;
	}

	return (
		<div className="canvas-editor__saved-views-rail" data-align={align}>
			<div className="canvas-editor__saved-views-track">
				{showCapturingHint && (
					<div className="canvas-editor__saved-views-capturing">
						{capturingLabel}
					</div>
				)}
				{views.map((view, index) => (
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
						canManage={canManageViews}
						canMovePrevious={index > 0}
						canMoveNext={index < views.length - 1}
						renderPreview={renderPreview}
						showAspectRatio={showAspectRatio}
						freeAspectLabel={freeAspectLabel}
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
	pressed,
}: {
	children: ReactNode;
	label: string;
	onClick?: () => void;
	disabled?: boolean;
	pressed?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className="canvas-editor__saved-views-button"
			data-active={pressed || undefined}
			title={label}
			aria-label={label}
			aria-pressed={pressed}
		>
			{children}
		</button>
	);
}
