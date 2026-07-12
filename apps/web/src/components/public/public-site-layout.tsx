import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemePicker } from "@/components/theme/theme-picker";
import { Button } from "@/components/ui/button";
import { Github, Menu, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router";

const GITHUB_URL = "https://github.com/moonriddim/skedra-community";

export function PublicSiteLayout({ children }: { children: ReactNode }) {
	const [menuOpen, setMenuOpen] = useState(false);

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
				<div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
					<Link to="/" aria-label="Skedra Whiteboard">
						<BrandLogo markClassName="h-9 w-9" wordmarkClassName="text-xl" />
					</Link>

					<nav
						className="hidden items-center gap-1 md:flex"
						aria-label="Hauptnavigation"
					>
						<Button asChild variant="ghost" size="sm">
							<Link to="/pricing">Preise</Link>
						</Button>
						<Button asChild variant="ghost" size="sm">
							<a href={GITHUB_URL} target="_blank" rel="noreferrer">
								<Github className="h-4 w-4" />
								Open Source
							</a>
						</Button>
					</nav>

					<div className="hidden items-center gap-2 md:flex">
						<ThemePicker labelSet="guest" />
						<Button asChild variant="ghost" size="sm">
							<Link to="/login">Anmelden</Link>
						</Button>
						<Button asChild size="sm">
							<Link to="/">Free Whiteboard</Link>
						</Button>
					</div>

					<Button
						variant="ghost"
						size="icon"
						className="md:hidden"
						onClick={() => setMenuOpen((open) => !open)}
						aria-label={menuOpen ? "Menü schließen" : "Menü öffnen"}
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
								<Link to="/pricing" onClick={() => setMenuOpen(false)}>
									Preise
								</Link>
							</Button>
							<Button asChild variant="ghost" className="justify-start">
								<Link to="/login" onClick={() => setMenuOpen(false)}>
									Anmelden
								</Link>
							</Button>
							<Button asChild className="justify-start">
								<Link to="/" onClick={() => setMenuOpen(false)}>
									Free Whiteboard
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
							Das freie Whiteboard für schnelle Ideen – mit optionaler,
							verschlüsselter Cloud-Zusammenarbeit.
						</p>
					</div>
					<div>
						<h2 className="text-sm font-semibold">Produkt</h2>
						<div className="mt-3 grid gap-2 text-sm text-muted-foreground">
							<Link className="hover:text-foreground" to="/">
								Free Whiteboard
							</Link>
							<Link className="hover:text-foreground" to="/pricing">
								Preise
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
						<h2 className="text-sm font-semibold">Rechtliches</h2>
						<div className="mt-3 grid gap-2 text-sm text-muted-foreground">
							<Link className="hover:text-foreground" to="/privacy">
								Datenschutz
							</Link>
							<Link className="hover:text-foreground" to="/terms">
								AGB
							</Link>
							<Link className="hover:text-foreground" to="/imprint">
								Impressum
							</Link>
						</div>
					</div>
				</div>
				<div className="border-t border-border/70 px-4 py-5 text-center text-xs text-muted-foreground">
					© {new Date().getFullYear()} Skedra. Alle Rechte vorbehalten.
				</div>
			</footer>
		</div>
	);
}
