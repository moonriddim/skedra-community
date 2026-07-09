import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Kleines Tasten-Badge wie bei Excalidraw. */
function GuestKbd({ children }: { children: React.ReactNode }) {
	return (
		<kbd className="mx-0.5 inline-flex items-center rounded border border-border/70 bg-muted/30 px-1.5 py-px font-sans text-[11px] font-medium text-foreground/85 shadow-sm">
			{children}
		</kbd>
	);
}

/**
 * Excalidraw-Layout: Pan-Hinweis zentriert unter Toolbar,
 * darunter Text links + Pfeil rechts (erst seitlich, dann sanft nach oben).
 */
export function GuestToolbarHints({ className }: { className?: string }) {
	const { t } = useI18n();

	return (
		<div
			className={cn(
				"pointer-events-none absolute left-1/2 top-[68px] hidden w-full max-w-3xl -translate-x-1/2 px-4 md:block",
				className,
			)}
		>
			{/* Pan-Hinweis — schmal, zentriert direkt unter der Toolbar */}
			<p className="text-center text-xs leading-relaxed text-muted-foreground">
				{t("guestCanvas.onboarding.panHintPrefix")}{" "}
				<GuestKbd>{t("guestCanvas.onboarding.panHintWheel")}</GuestKbd>{" "}
				{t("guestCanvas.onboarding.panHintOr")}{" "}
				<GuestKbd>{t("guestCanvas.onboarding.panHintSpace")}</GuestKbd>{" "}
				{t("guestCanvas.onboarding.panHintSuffix")}
			</p>

			{/*
			 * Werkzeug-Hinweis — wie Excalidraw:
			 * mehrzeiliger Comic-Text links, Pfeil startet rechts daneben und bogen nach oben
			 */}
			<div className="mx-auto mt-2 flex w-fit max-w-none items-end justify-center gap-0.5">
				<p className="mb-1 w-[7.25rem] shrink-0 whitespace-pre-line text-left font-comic-note text-[15px] leading-[1.18] text-foreground/70">
					{t("guestCanvas.onboarding.toolbarHint")}
				</p>

				<svg
					width={148}
					height={72}
					viewBox="0 0 148 72"
					className="-mb-0.5 shrink-0 text-foreground/70"
					aria-hidden
				>
					<title>{t("guestCanvas.onboarding.toolbarHint")}</title>
					<defs>
						<marker
							id="guest-toolbar-curve-arrow"
							markerWidth="7"
							markerHeight="7"
							refX="5.5"
							refY="3.5"
							orient="auto"
						>
							<path
								d="M0.5,0.5 L6.5,3.5 L0.5,6.5"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.4"
							/>
						</marker>
					</defs>
					{/* Start links neben dem Text, Bogen nach rechts-oben und dann elegant nach links-oben zur Toolbar (Excalidraw-Stil) */}
					<path
						d="M 12 56 C 45 56, 85 40, 65 12"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						markerEnd="url(#guest-toolbar-curve-arrow)"
					/>
				</svg>
			</div>
		</div>
	);
}
