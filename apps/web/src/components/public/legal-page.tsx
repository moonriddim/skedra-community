import { PublicSiteLayout } from "@/components/public/public-site-layout";
import { legalDraft, legalLastUpdated } from "@/lib/legal";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

export function LegalPage({
	title,
	intro,
	children,
}: {
	title: string;
	intro: string;
	children: ReactNode;
}) {
	return (
		<PublicSiteLayout>
			<section className="px-4 py-14 sm:px-6 sm:py-20">
				<div className="mx-auto max-w-3xl">
					<p className="text-sm font-semibold text-primary">Rechtliches</p>
					<h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
						{title}
					</h1>
					<p className="mt-5 text-lg leading-8 text-muted-foreground">
						{intro}
					</p>
					<p className="mt-3 text-sm text-muted-foreground">
						Stand: {legalLastUpdated}
					</p>

					{legalDraft && (
						<div className="mt-8 flex gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm leading-6">
							<AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
							<p>
								Entwurf: Die markierten Betreiberangaben müssen vor der
								Produktivschaltung ergänzt und der gesamte Text rechtlich
								geprüft werden.
							</p>
						</div>
					)}

					<article className="mt-10 space-y-10 text-[15px] leading-7 text-foreground/90 [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-1">
						{children}
					</article>
				</div>
			</section>
		</PublicSiteLayout>
	);
}

export function LegalSection({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<section>
			<h2>{title}</h2>
			{children}
		</section>
	);
}
