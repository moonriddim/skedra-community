/**
 * Presenter-Chrome — Controls im Editor-Presenter-Modus (?present=1).
 */

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { ExternalLink, Radio } from "lucide-react";

interface PresenterChromeProps {
	shareUrl: string;
	isLive: boolean;
	activeSlideName: string | null;
	slideCount: number;
	onOpenNotes: () => void;
	notesOpen: boolean;
}

export function PresenterChrome({
	shareUrl,
	isLive,
	activeSlideName,
	slideCount,
	onOpenNotes,
	notesOpen,
}: PresenterChromeProps) {
	const { t } = useI18n();

	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-24 z-40 flex justify-center px-4">
			<div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur-md">
				{isLive ? (
					<span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
						<Radio className="h-3.5 w-3.5 animate-pulse" />
						{t("whiteboardPage.presenter.liveActive")}
					</span>
				) : (
					<span className="text-xs text-muted-foreground">
						{t("whiteboardPage.presenter.liveStarting")}
					</span>
				)}

				{slideCount > 0 && (
					<span className="text-xs text-muted-foreground">
						{activeSlideName
							? t("whiteboardPage.presenter.currentSlide", {
									name: activeSlideName,
								})
							: t("whiteboardPage.presenter.noSlideSelected")}
					</span>
				)}

				<Button type="button" variant="ghost" size="sm" onClick={onOpenNotes}>
					{notesOpen
						? t("whiteboardPage.presenterNotes.hide")
						: t("whiteboardPage.presenterNotes.show")}
				</Button>

				{shareUrl && (
					<Button type="button" variant="outline" size="sm" asChild>
						<a href={shareUrl} target="_blank" rel="noreferrer">
							<ExternalLink className="mr-1.5 h-3.5 w-3.5" />
							{t("whiteboardPage.presenter.openViewer")}
						</a>
					</Button>
				)}
			</div>
		</div>
	);
}
