import { GuestOnboardingAnnotation } from "@/components/guest/guest-onboarding-annotation";
import { GuestToolbarHints } from "@/components/guest/guest-toolbar-hints";
import { useI18n } from "@/lib/i18n";
import { HelpCircle, LogIn, Save, UserPlus, Users } from "lucide-react";
import { Link } from "react-router";

interface GuestWelcomeSplashProps {
	visible: boolean;
	onSave: () => void;
	onOpenHelp: () => void;
	onOpenLiveCollaboration: () => void;
	isLoggedIn: boolean;
	managedBilling: boolean;
}

/**
 * Willkommens-Overlay mit Pfeil-Hinweisen.
 * Positionen orientieren sich an Hamburger (links 12px) und Toolbar (top 12px, zentriert).
 */
export function GuestWelcomeSplash({
	visible,
	onSave,
	onOpenHelp,
	onOpenLiveCollaboration,
	isLoggedIn,
	managedBilling,
}: GuestWelcomeSplashProps) {
	const { t } = useI18n();

	if (!visible) return null;

	return (
		<div className="pointer-events-none absolute inset-0 z-30">
			{/*
			 * Menue-Hinweis: Text rechts neben dem Hamburger, Pfeil bogenfoermig nach oben-links
			 * Ziel: Mitte des Menu-Buttons (~28px, 28px)
			 */}
			<GuestOnboardingAnnotation
				className="left-[52px] top-[44px] hidden md:flex"
				label={t("guestCanvas.onboarding.menuHint")}
				labelPosition="below"
				labelAlign="left"
				markerId="guest-menu-arrow"
				viewBox="0 0 160 96"
				width={160}
				height={96}
				arrowPath="M 148 82 C 118 78, 88 58, 62 38 C 42 22, 28 10, 14 4"
			/>

			<GuestToolbarHints />

			{/* Zentrale Willkommens-Karte — unterhalb der Top-Hinweise */}
			<div className="flex h-full items-center justify-center px-6 pt-28 md:pt-36">
				<div className="pointer-events-auto max-w-md text-center">
					<div className="inline-flex items-center justify-center gap-3">
						<img
							src="/logo-mark-transparent-dark.png"
							alt=""
							aria-hidden="true"
							decoding="async"
							className="h-16 w-16 object-contain drop-shadow-[0_0_18px_rgba(13,188,174,0.25)]"
						/>
						<h1 className="font-comic-note text-5xl font-bold tracking-wide text-primary">
							Skedra
						</h1>
					</div>
					<p className="mt-4 font-comic-note text-base leading-relaxed text-muted-foreground">
						{t("guestCanvas.storageWarning")}
					</p>

					<ul className="mt-8 space-y-3 text-left font-comic-note text-base">
						<li>
							<button
								type="button"
								onClick={onSave}
								className="inline-flex items-center gap-2.5 text-foreground hover:text-primary hover:underline"
							>
								<Save className="h-4 w-4 shrink-0" />
								{t("guestCanvas.saveToCloud")}
							</button>
						</li>
						<li>
							<button
								type="button"
								onClick={onOpenHelp}
								className="inline-flex items-center gap-2.5 text-foreground hover:text-primary hover:underline"
							>
								<HelpCircle className="h-4 w-4 shrink-0" />
								{t("guestCanvas.help")}
							</button>
						</li>
						<li>
							<button
								type="button"
								onClick={onOpenLiveCollaboration}
								className="inline-flex items-center gap-2.5 text-foreground hover:text-primary hover:underline"
							>
								<Users className="h-4 w-4 shrink-0" />
								{t("guestCanvas.liveCollaboration.menuLabel")}
							</button>
						</li>
						{!isLoggedIn && (
							<>
								<li>
									<Link
										to={`${managedBilling ? "/subscribe" : "/register"}?redirect=${encodeURIComponent("/?save=1")}`}
										className="inline-flex items-center gap-2.5 text-primary hover:underline"
									>
										<UserPlus className="h-4 w-4 shrink-0" />
										{t("guestCanvas.signUp")}
									</Link>
								</li>
								<li>
									<Link
										to={`${managedBilling ? "/subscribe" : "/login"}?redirect=${encodeURIComponent("/")}`}
										className="inline-flex items-center gap-2.5 text-muted-foreground hover:text-foreground hover:underline"
									>
										<LogIn className="h-4 w-4 shrink-0" />
										{t("guestCanvas.signIn")}
									</Link>
								</li>
							</>
						)}
					</ul>
				</div>
			</div>
		</div>
	);
}
