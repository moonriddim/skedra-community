import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
	Clock3,
	ExternalLink,
	MonitorCheck,
	Play,
	Radio,
	Square,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";

interface PresenterChromeProps {
	shareUrl: string;
	isLive: boolean;
	sessionActive: boolean;
	connectionReady: boolean;
	audienceCount: number;
	startedAt?: string | null;
	isStarting: boolean;
	startError?: string | null;
	activeSlideName: string | null;
	nextSlideName: string | null;
	slideCount: number;
	notesCount: number;
	onOpenNotes: () => void;
	notesOpen: boolean;
	onStart?: () => void;
	onEnd?: () => void;
}

function formatElapsed(startedAt: string | null | undefined, now: number) {
	if (!startedAt) return "00:00";
	const elapsedSeconds = Math.max(
		0,
		Math.floor((now - new Date(startedAt).getTime()) / 1_000),
	);
	const minutes = Math.floor(elapsedSeconds / 60)
		.toString()
		.padStart(2, "0");
	const seconds = (elapsedSeconds % 60).toString().padStart(2, "0");
	return `${minutes}:${seconds}`;
}

export function PresenterChrome(props: PresenterChromeProps) {
	const { t } = useI18n();
	const [now, setNow] = useState(Date.now());
	useEffect(() => {
		if (!props.sessionActive) return;
		const timer = window.setInterval(() => setNow(Date.now()), 1_000);
		return () => window.clearInterval(timer);
	}, [props.sessionActive]);

	if (!props.sessionActive) {
		return (
			<div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/45 p-4 backdrop-blur-sm">
				<section
					className="pointer-events-auto w-[min(94vw,560px)] rounded-3xl border border-border/80 bg-card/95 p-6 shadow-2xl"
					aria-labelledby="presentation-preflight-title"
				>
					<p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
						{t("whiteboardPage.presenter.preflightEyebrow")}
					</p>
					<h2
						id="presentation-preflight-title"
						className="mt-2 text-2xl font-semibold"
					>
						{t("whiteboardPage.presenter.preflightTitle")}
					</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						{t("whiteboardPage.presenter.preflightDescription")}
					</p>

					<div className="mt-5 grid gap-3 sm:grid-cols-3">
						<PreflightMetric
							label={t("whiteboardPage.presenter.slides")}
							value={String(props.slideCount)}
						/>
						<PreflightMetric
							label={t("whiteboardPage.presenter.notesPrepared")}
							value={`${props.notesCount}/${props.slideCount}`}
						/>
						<PreflightMetric
							label={t("whiteboardPage.presenter.audienceLink")}
							value={
								props.shareUrl
									? t("whiteboardPage.presenter.ready")
									: t("whiteboardPage.presenter.missing")
							}
						/>
					</div>

					{props.slideCount === 0 && (
						<p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
							{t("whiteboardPage.presenter.noSlidesWarning")}
						</p>
					)}
					{props.startError && (
						<p
							className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
							role="alert"
						>
							{props.startError}
						</p>
					)}

					<div className="mt-6 flex flex-wrap justify-end gap-2">
						{props.shareUrl && (
							<Button type="button" variant="outline" asChild>
								<a href={props.shareUrl} target="_blank" rel="noreferrer">
									<ExternalLink className="mr-2 h-4 w-4" />
									{t("whiteboardPage.presenter.openViewer")}
								</a>
							</Button>
						)}
						<Button
							type="button"
							onClick={props.onStart}
							disabled={
								props.isStarting || props.slideCount === 0 || !props.shareUrl
							}
						>
							<Play className="mr-2 h-4 w-4" />
							{props.isStarting
								? t("whiteboardPage.presenter.liveStarting")
								: t("whiteboardPage.presenter.startLive")}
						</Button>
					</div>
				</section>
			</div>
		);
	}

	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-24 z-40 flex justify-center px-4">
			<div className="pointer-events-auto flex max-w-[96vw] flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur-md">
				<output
					className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
						props.isLive && props.audienceCount > 0
							? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
							: props.connectionReady
								? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
								: "bg-amber-500/10 text-amber-700 dark:text-amber-300"
					}`}
					aria-live="polite"
				>
					{props.isLive && props.audienceCount > 0 ? (
						<Radio className="h-3.5 w-3.5 motion-safe:animate-pulse" />
					) : (
						<MonitorCheck className="h-3.5 w-3.5" />
					)}
					{props.isLive && props.audienceCount > 0
						? t("whiteboardPage.presenter.liveActive")
						: props.connectionReady
							? t("whiteboardPage.presenter.streamReady")
							: t("whiteboardPage.presenter.connecting")}
				</output>

				<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
					<Users className="h-3.5 w-3.5" />
					{t("whiteboardPage.presenter.audienceCount", {
						count: props.audienceCount,
					})}
				</span>
				<span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
					<Clock3 className="h-3.5 w-3.5" />
					{formatElapsed(props.startedAt, now)}
				</span>
				{props.startError && (
					<span className="max-w-64 text-xs text-destructive" role="alert">
						{props.startError}
					</span>
				)}

				<div className="mx-1 h-6 w-px bg-border" />
				<div className="min-w-40 text-xs">
					<p className="font-semibold text-foreground">
						{props.activeSlideName ??
							t("whiteboardPage.presenter.noSlideSelected")}
					</p>
					<p className="text-muted-foreground">
						{props.nextSlideName
							? t("whiteboardPage.presenter.nextSlide", {
									name: props.nextSlideName,
								})
							: t("whiteboardPage.presenter.lastSlide")}
					</p>
				</div>

				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={props.onOpenNotes}
				>
					{props.notesOpen
						? t("whiteboardPage.presenterNotes.hide")
						: t("whiteboardPage.presenterNotes.show")}
				</Button>

				{props.shareUrl && (
					<Button type="button" variant="outline" size="sm" asChild>
						<a href={props.shareUrl} target="_blank" rel="noreferrer">
							<ExternalLink className="mr-1.5 h-3.5 w-3.5" />
							{t("whiteboardPage.presenter.openViewer")}
						</a>
					</Button>
				)}
				<Button
					type="button"
					variant="destructive"
					size="sm"
					onClick={props.onEnd}
				>
					<Square className="mr-1.5 h-3.5 w-3.5" />
					{t("whiteboardPage.presenter.stopLive")}
				</Button>
			</div>
		</div>
	);
}

function PreflightMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-1 text-lg font-semibold">{value}</p>
		</div>
	);
}
