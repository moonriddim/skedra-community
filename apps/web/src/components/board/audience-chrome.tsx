/**
 * Audience-Chrome — minimale UI fuer oeffentliche Praesentations-Viewer.
 * Zeigt aktuelle Slide, Live-Status; keine Notizen oder Edit-Controls.
 */

import { useI18n } from "@/lib/i18n";
import type { SavedCanvasView } from "@skedra/canvas-core";
import { Eye, Radio } from "lucide-react";

interface AudienceChromeProps {
	boardName: string;
	activeView: SavedCanvasView | null;
	isLive: boolean;
	slideCount: number;
}

export function AudienceChrome({
	boardName,
	activeView,
	isLive,
	slideCount,
}: AudienceChromeProps) {
	const { t } = useI18n();

	return (
		<div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex justify-between gap-4 p-4">
			<div className="pointer-events-auto rounded-xl border border-border/70 bg-card/90 px-4 py-3 shadow-xl backdrop-blur-md">
				<p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
					{t("presentationPage.audience.eyebrow")}
				</p>
				<h1 className="text-lg font-semibold text-foreground">{boardName}</h1>
			</div>

			<div className="pointer-events-auto flex flex-col items-end gap-2">
				{isLive && (
					<span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/95 px-3 py-1 text-xs font-bold text-white shadow-sm animate-pulse">
						<Radio className="h-3.5 w-3.5" />
						{t("presentationPage.audience.live")}
					</span>
				)}
				{slideCount > 0 && (
					<div className="rounded-xl border border-border/70 bg-card/90 px-4 py-2.5 text-right shadow-lg backdrop-blur-md">
						<p className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
							<Eye className="h-3.5 w-3.5" />
							{t("presentationPage.audience.slideLabel")}
						</p>
						<p className="text-sm font-semibold text-foreground">
							{activeView
								? t("presentationPage.audience.slideName", {
										name: activeView.name,
									})
								: t("presentationPage.audience.waitingForSlide")}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
