/**
 * Presenter Notes — nur im Presenter-Modus sichtbar, pro Saved View (Slide).
 */

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SavedCanvasView } from "@skedra/canvas-core";
import { ChevronLeft, ChevronRight, StickyNote, X } from "lucide-react";
import { useEffect, useState } from "react";

interface PresenterNotesPanelProps {
	open: boolean;
	activeView: SavedCanvasView | null;
	views: SavedCanvasView[];
	onUpdateNotes: (viewId: string, notes: string) => void;
	onSelectView: (viewId: string) => void;
	onClose: () => void;
	className?: string;
}

export function PresenterNotesPanel({
	open,
	activeView,
	views,
	onUpdateNotes,
	onSelectView,
	onClose,
	className,
}: PresenterNotesPanelProps) {
	const { t } = useI18n();
	const [draft, setDraft] = useState("");
	const activeViewKey = activeView?.id ?? "";
	const activeViewNotes = activeView?.presenterNotes ?? "";

	useEffect(() => {
		setDraft(activeViewKey ? activeViewNotes : "");
	}, [activeViewKey, activeViewNotes]);

	const activeIndex = activeView
		? views.findIndex((view) => view.id === activeView.id)
		: -1;

	const goToSlide = (offset: number) => {
		if (views.length === 0) return;
		const nextIndex =
			activeIndex === -1
				? offset > 0
					? 0
					: views.length - 1
				: (activeIndex + offset + views.length) % views.length;
		onSelectView(views[nextIndex].id);
	};

	return (
		<div
			className={cn(
				"pointer-events-none absolute inset-y-0 left-0 z-50 flex items-end p-4 pb-24 transition-[transform,opacity] duration-300 ease-out",
				open ? "translate-x-0 opacity-100" : "-translate-x-[108%] opacity-0",
				className,
			)}
			aria-hidden={!open}
		>
			<div
				className={cn(
					"pointer-events-auto flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(8,10,12,0.08),rgba(8,10,12,0.28)_100%)] text-white shadow-[0_24px_80px_-28px_rgba(0,0,0,0.55)] backdrop-blur-md",
					!open && "pointer-events-none",
				)}
			>
				<div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4">
					<div className="min-w-0">
						<p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
							{t("whiteboardPage.presenterNotes.label")}
						</p>
						<h2 className="mt-1 truncate text-sm font-semibold">
							{activeView?.name ?? t("whiteboardPage.presenterNotes.noSlide")}
						</h2>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="text-white/70 hover:bg-white/10 hover:text-white"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>

				<div className="space-y-3 px-4 py-4">
					{views.length > 0 && (
						<div className="flex items-center justify-between gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="text-white/80 hover:bg-white/10 hover:text-white"
								onClick={() => goToSlide(-1)}
							>
								<ChevronLeft className="mr-1 h-4 w-4" />
								{t("whiteboardPage.presenterNotes.previous")}
							</Button>
							<span className="text-xs text-white/55">
								{activeIndex >= 0
									? t("whiteboardPage.presenterNotes.slideCounter", {
											current: activeIndex + 1,
											total: views.length,
										})
									: t("whiteboardPage.presenterNotes.pickSlide")}
							</span>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="text-white/80 hover:bg-white/10 hover:text-white"
								onClick={() => goToSlide(1)}
							>
								{t("whiteboardPage.presenterNotes.next")}
								<ChevronRight className="ml-1 h-4 w-4" />
							</Button>
						</div>
					)}

					{activeView ? (
						<>
							<Textarea
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								onBlur={() => {
									if (draft !== (activeView.presenterNotes ?? "")) {
										onUpdateNotes(activeView.id, draft);
									}
								}}
								placeholder={t("whiteboardPage.presenterNotes.placeholder")}
								className="min-h-[160px] resize-y border-white/10 bg-black/20 text-white placeholder:text-white/35"
							/>
							<p className="flex items-start gap-2 text-xs text-white/50">
								<StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
								{t("whiteboardPage.presenterNotes.hint")}
							</p>
						</>
					) : (
						<p className="py-6 text-center text-sm text-white/55">
							{t("whiteboardPage.presenterNotes.empty")}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
