import { GuestOnboardingAnnotation } from "@/components/guest/guest-onboarding-annotation";
import { GuestToolbarHints } from "@/components/guest/guest-toolbar-hints";
import { useI18n } from "@/lib/i18n";
import { localizePublicPath } from "@/lib/public-path";
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
	const { t, locale } = useI18n();
	const publicPath = (path: string) => localizePublicPath(path, locale);

	if (!visible) return null;

	return (
		<div className="pointer-events-none absolute inset-0 z-30">
			{/*
			 * Menue-Hinweis: Text rechts neben dem Hamburger, Pfeil bogenfoermig nach oben-links
			 * Ziel: Mitte des Menu-Buttons (~28px, 28px)
			 */}
			<GuestOnboardingAnnotation
				className="left-[52px] top-[44px] hidden lg:flex"
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
			<div className="guest-welcome-scroll flex h-full items-center justify-center px-6 pt-[calc(5rem+env(safe-area-inset-top))] pb-[calc(10rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pt-36 max-sm:px-4">
				<div className="pointer-events-auto max-w-md text-center">
					<div className="inline-flex max-w-full items-center justify-center gap-2.5">
						<img
							src="/logo-mark-transparent-dark.png"
							alt=""
							aria-hidden="true"
							decoding="async"
							className="h-12 w-12 shrink-0 object-contain drop-shadow-[0_0_18px_rgba(13,188,174,0.25)] sm:h-16 sm:w-16"
						/>
						<h1 className="font-comic-note text-3xl font-bold leading-tight tracking-wide text-primary sm:text-5xl">
							Skedra Online Whiteboard
						</h1>
					</div>
					<p className="mt-4 font-comic-note text-base leading-relaxed text-foreground">
						{t("guestCanvas.productDescription")}
					</p>
					<p className="mt-3 font-comic-note text-sm leading-relaxed text-muted-foreground">
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
										to={`${managedBilling ? publicPath("/pricing") : "/register"}?redirect=${encodeURIComponent(`${publicPath("/")}?save=1`)}`}
										className="inline-flex items-center gap-2.5 text-primary hover:underline"
									>
										<UserPlus className="h-4 w-4 shrink-0" />
										{t("guestCanvas.signUp")}
									</Link>
								</li>
								<li>
									<Link
										to={`${managedBilling ? publicPath("/pricing") : "/login"}?redirect=${encodeURIComponent(publicPath("/"))}`}
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
