import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemePicker } from "@/components/theme/theme-picker";
import type { ReactNode } from "react";
import { Link } from "react-router";

export function PublicSiteLayout({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="border-b border-border">
				<nav
					className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-6 py-5"
					aria-label="Skedra"
				>
					<Link to="/" aria-label="Skedra Whiteboard">
						<BrandLogo />
					</Link>
					<a href="https://skedra.xyz/docs/">Documentation</a>
					<a href="https://github.com/moonriddim/skedra-community">GitHub</a>
					<Link to="/login">Login</Link>
					<ThemePicker labelSet="guest" showLabel={false} />
				</nav>
			</header>
			<main>{children}</main>
			<footer className="mx-auto flex max-w-6xl flex-wrap gap-5 border-t border-border px-6 py-8 text-sm text-muted-foreground">
				<span>Skedra · Self-hosted · AGPL-3.0</span>
				<a href="https://github.com/moonriddim/skedra-community">Source code</a>
				<Link to="/privacy">Privacy</Link>
				<Link to="/terms">Terms</Link>
				<Link to="/imprint">Instance</Link>
			</footer>
		</div>
	);
}
