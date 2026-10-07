/**
 * Audience-Chrome — minimale UI fuer oeffentliche Praesentations-Viewer.
 * Zeigt aktuelle Slide, Live-Status; keine Notizen oder Edit-Controls.
 */

import { CanvasDetailsMenu } from "@/components/canvas/canvas-details-menu";
import { useCanvasChromeInset } from "@/components/canvas/use-canvas-chrome-inset";
import { useI18n } from "@/lib/i18n";
import type { SavedCanvasView } from "@skedra/canvas-core";
import { Eye, LocateFixed, Move, Radio } from "lucide-react";
import type { ReactNode } from "react";

interface AudienceChromeProps {
	boardName: string;
	activeView: SavedCanvasView | null;
	isLive: boolean;
	hasError: boolean;
	slideCount: number;
	followPresenter: boolean;
	onFollowPresenterChange: (follow: boolean) => void;
	presence?: ReactNode;
}

export function AudienceChrome({
	boardName,
	activeView,
	isLive,
	hasError,
	slideCount,
	followPresenter,
	onFollowPresenterChange,
	presence,
}: AudienceChromeProps) {
	const { t } = useI18n();
	const headerRef = useCanvasChromeInset("top");
	const slideInfo = slideCount > 0 && (
		<div className="min-w-0 text-sm">
			<p className="text-xs text-muted-foreground">
				{t("presentationPage.audience.slideLabel")}
			</p>
			<p className="break-words font-medium">
				{activeView?.name ?? t("presentationPage.audience.waitingForSlide")}
			</p>
		</div>
	);

	return (
		<div
			ref={headerRef}
			data-skedra-ui="audience-header"
			className="skedra-audience-header pointer-events-none absolute inset-x-0 top-0 z-50 flex items-start justify-between gap-3 p-3"
		>
			<div className="skedra-audience-title pointer-events-auto min-w-0 max-w-full rounded-xl border border-border/70 bg-card/90 px-4 py-3 shadow-xl backdrop-blur-md sm:flex-1">
				<p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
					{t("presentationPage.audience.eyebrow")}
				</p>
				<h1
					className="line-clamp-2 break-words text-base font-semibold text-foreground"
					title={boardName}
				>
					{boardName}
				</h1>
			</div>
			<div className="skedra-compact-only pointer-events-auto flex shrink-0 items-center gap-1">
				{isLive && (
					<span
						className="h-2 w-2 rounded-full bg-rose-500"
						role="status"
						aria-label={t("presentationPage.audience.live")}
					/>
				)}
				{isLive && (
					<button
						type="button"
						aria-label={
							followPresenter
								? t("presentationPage.audience.following")
								: t("presentationPage.audience.freeMove")
						}
						aria-pressed={followPresenter}
						onClick={() => onFollowPresenterChange(!followPresenter)}
						className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card/95 text-foreground focus-visible:ring-2 focus-visible:ring-ring"
					>
						{followPresenter ? (
							<LocateFixed className="h-4 w-4" />
						) : (
							<Move className="h-4 w-4" />
						)}
					</button>
				)}
				<CanvasDetailsMenu
					label={t("canvas.chrome.presentationDetails")}
					className="h-11 w-11 bg-card/95"
				>
					<p className="break-words text-sm font-semibold">{boardName}</p>
					{slideInfo}
					{presence}
				</CanvasDetailsMenu>
			</div>

			<div className="skedra-wide-only pointer-events-auto flex min-w-0 max-w-full flex-col items-end gap-2 sm:max-w-[45%]">
				{hasError && (
					<p
						className="max-w-sm rounded-xl border border-destructive/30 bg-card/95 px-4 py-3 text-sm text-destructive shadow-lg"
						role="alert"
					>
						{t("presentationPage.audience.connectionError")}
					</p>
				)}
				<div className="flex max-w-full flex-wrap items-start justify-end gap-2 max-sm:justify-start">
					{presence}
					<div className="flex flex-col items-end gap-2">
						{isLive && (
							<output
								className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/95 px-3 py-1 text-xs font-bold text-white shadow-sm motion-safe:animate-pulse"
								aria-live="polite"
							>
								<Radio className="h-3.5 w-3.5" />
								{t("presentationPage.audience.live")}
							</output>
						)}
						<button
							type="button"
							onClick={() => onFollowPresenterChange(!followPresenter)}
							className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border/70 bg-card/90 px-3 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-pressed={followPresenter}
						>
							{followPresenter ? (
								<LocateFixed className="h-3.5 w-3.5" />
							) : (
								<Move className="h-3.5 w-3.5" />
							)}
							{followPresenter
								? t("presentationPage.audience.following")
								: t("presentationPage.audience.freeMove")}
						</button>
					</div>
				</div>
				{slideCount > 0 && (
					<div className="max-w-full rounded-xl border border-border/70 bg-card/90 px-4 py-2.5 text-right shadow-lg backdrop-blur-md">
						<p className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
							<Eye className="h-3.5 w-3.5" />
							{t("presentationPage.audience.slideLabel")}
						</p>
						<p
							className="line-clamp-2 break-words text-sm font-semibold text-foreground"
							title={activeView?.name}
						>
							{activeView
								? t("presentationPage.audience.slideName", {
										name: activeView.name,
									})
								: t("presentationPage.audience.waitingForSlide")}
						</p>
					</div>
				)}
			</div>
			{hasError && (
				<p
					role="alert"
					className="skedra-compact-only skedra-audience-error rounded-xl border border-destructive/30 bg-card/95 px-3 py-2 text-xs text-destructive"
				>
					{t("presentationPage.audience.connectionError")}
				</p>
			)}
		</div>
	);
}
