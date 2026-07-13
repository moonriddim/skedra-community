import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemePicker } from "@/components/theme/theme-picker";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { Github, Languages, Menu, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router";

const GITHUB_URL = "https://github.com/moonriddim/skedra-community";

export function PublicSiteLayout({ children }: { children: ReactNode }) {
	const [menuOpen, setMenuOpen] = useState(false);
	const { t } = useI18n();

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
				<div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
					<Link to="/" aria-label="Skedra Whiteboard">
						<BrandLogo markClassName="h-9 w-9" wordmarkClassName="text-xl" />
					</Link>

					<nav
						className="hidden items-center gap-1 md:flex"
						aria-label={t("publicSite.navigationLabel")}
					>
						<Button asChild variant="ghost" size="sm">
							<Link to="/whiteboard">{t("publicSite.productOverview")}</Link>
						</Button>
						<Button asChild variant="ghost" size="sm">
							<Link to="/pricing">{t("publicSite.pricing")}</Link>
						</Button>
						<Button asChild variant="ghost" size="sm">
							<a href={GITHUB_URL} target="_blank" rel="noreferrer">
								<Github className="h-4 w-4" />
								{t("publicSite.openSource")}
							</a>
						</Button>
					</nav>

					<div className="hidden items-center gap-2 md:flex">
						<ThemePicker labelSet="guest" />
						<LanguageMenu />
						<Button asChild variant="ghost" size="sm">
							<Link to="/login">{t("publicSite.existingCloudAccount")}</Link>
						</Button>
						<Button asChild size="sm">
							<Link to="/">{t("publicSite.freeWhiteboard")}</Link>
						</Button>
					</div>

					<Button
						variant="ghost"
						size="icon"
						className="md:hidden"
						onClick={() => setMenuOpen((open) => !open)}
						aria-label={
							menuOpen ? t("publicSite.closeMenu") : t("publicSite.openMenu")
						}
						aria-expanded={menuOpen}
					>
						{menuOpen ? (
							<X className="h-5 w-5" />
						) : (
							<Menu className="h-5 w-5" />
						)}
					</Button>
				</div>

				{menuOpen && (
					<nav className="border-t border-border bg-background px-4 py-4 md:hidden">
						<div className="mx-auto grid max-w-6xl gap-2">
							<Button asChild variant="ghost" className="justify-start">
								<Link to="/whiteboard" onClick={() => setMenuOpen(false)}>
									{t("publicSite.productOverview")}
								</Link>
							</Button>
							<Button asChild variant="ghost" className="justify-start">
								<Link to="/pricing" onClick={() => setMenuOpen(false)}>
									{t("publicSite.pricing")}
								</Link>
							</Button>
							<Button asChild variant="ghost" className="justify-start">
								<Link to="/login" onClick={() => setMenuOpen(false)}>
									{t("publicSite.existingCloudAccount")}
								</Link>
							</Button>
							<LanguageMenu className="justify-start" />
							<Button asChild className="justify-start">
								<Link to="/" onClick={() => setMenuOpen(false)}>
									{t("publicSite.freeWhiteboard")}
								</Link>
							</Button>
						</div>
					</nav>
				)}
			</header>

			<main>{children}</main>

			<footer className="border-t border-border bg-card/45">
				<div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
					<div>
						<BrandLogo markClassName="h-9 w-9" wordmarkClassName="text-lg" />
						<p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
							{t("publicSite.footerDescription")}
						</p>
					</div>
					<div>
						<h2 className="text-sm font-semibold">{t("publicSite.product")}</h2>
						<div className="mt-3 grid gap-2 text-sm text-muted-foreground">
							<Link className="hover:text-foreground" to="/whiteboard">
								{t("publicSite.productOverview")}
							</Link>
							<Link className="hover:text-foreground" to="/">
								{t("publicSite.freeWhiteboard")}
							</Link>
							<Link className="hover:text-foreground" to="/pricing">
								{t("publicSite.pricing")}
							</Link>
							<a
								className="hover:text-foreground"
								href={GITHUB_URL}
								target="_blank"
								rel="noreferrer"
							>
								GitHub
							</a>
						</div>
					</div>
					<div>
						<h2 className="text-sm font-semibold">{t("publicSite.legal")}</h2>
						<div className="mt-3 grid gap-2 text-sm text-muted-foreground">
							<Link className="hover:text-foreground" to="/privacy">
								{t("publicSite.privacy")}
							</Link>
							<Link className="hover:text-foreground" to="/terms">
								{t("publicSite.terms")}
							</Link>
							<Link className="hover:text-foreground" to="/imprint">
								{t("publicSite.imprint")}
							</Link>
						</div>
					</div>
				</div>
				<div className="border-t border-border/70 px-4 py-5 text-center text-xs text-muted-foreground">
					{t("publicSite.copyright", { year: new Date().getFullYear() })}
				</div>
			</footer>
		</div>
	);
}

function LanguageMenu({ className }: { className?: string }) {
	const { t, locale, setLocale } = useI18n();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={className}
					aria-label={t("common.language")}
				>
					<Languages className="h-4 w-4" />
					<span className="uppercase">{locale}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
				<DropdownMenuItem
					onSelect={() => setLocale("de")}
					className={locale === "de" ? "bg-accent" : undefined}
				>
					{t("common.german")}
				</DropdownMenuItem>
				<DropdownMenuItem
					onSelect={() => setLocale("en")}
					className={locale === "en" ? "bg-accent" : undefined}
				>
					{t("common.english")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
