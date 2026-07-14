import { PublicSiteLayout } from "@/components/public/public-site-layout";
import { Button } from "@/components/ui/button";
import guidePages from "@/lib/guide-pages.json";
import { ArrowRight, BookOpen, CheckCircle2, ExternalLink } from "lucide-react";
import { Link, Navigate, useLocation } from "react-router";

interface GuideSection {
	heading: string;
	paragraphs?: string[];
	bullets?: string[];
}

interface GuideLink {
	href: string;
	label: string;
}

interface GuidePageData {
	locale: "de" | "en";
	kind: "about" | "article" | "collection";
	title: string;
	description: string;
	eyebrow: string;
	h1: string;
	lead: string;
	updated: string;
	lastModified: string;
	translation: string;
	sections: GuideSection[];
	faqs: Array<{ question: string; answer: string }>;
	related: GuideLink[];
	sources?: GuideLink[];
}

const pages = guidePages as Record<string, GuidePageData>;

export function GuidePage() {
	const { pathname } = useLocation();
	const page = pages[pathname];
	if (!page)
		return (
			<Navigate
				to={pathname.startsWith("/en/") ? "/en/guides" : "/guides"}
				replace
			/>
		);

	const isEnglish = page.locale === "en";
	const openWhiteboardPath = isEnglish ? "/en" : "/";

	return (
		<PublicSiteLayout>
			<article>
				<header className="relative overflow-hidden border-b border-border bg-card/35 px-4 py-16 sm:px-6 sm:py-24">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,hsl(var(--primary)/0.17),transparent_36%),radial-gradient(circle_at_85%_25%,hsl(var(--accent)/0.65),transparent_32%)]" />
					<div className="relative mx-auto max-w-4xl">
						<p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-sm font-medium text-primary">
							<BookOpen className="h-4 w-4" aria-hidden="true" />
							{page.eyebrow}
						</p>
						<h1 className="mt-6 font-display text-balance text-4xl font-bold tracking-tight sm:text-6xl">
							{page.h1}
						</h1>
						<p className="mt-6 max-w-3xl text-pretty text-lg leading-8 text-muted-foreground">
							{page.lead}
						</p>
						<p className="mt-5 text-xs text-muted-foreground">{page.updated}</p>
						<div className="mt-8 flex flex-wrap gap-3">
							<Button asChild size="lg">
								<Link to={openWhiteboardPath}>
									{isEnglish ? "Open the whiteboard" : "Whiteboard öffnen"}
								</Link>
							</Button>
							<Button asChild size="lg" variant="outline">
								<Link to={isEnglish ? "/en/whiteboard" : "/whiteboard"}>
									{isEnglish ? "Explore the product" : "Produkt ansehen"}
								</Link>
							</Button>
						</div>
					</div>
				</header>

				{page.kind === "collection" && (
					<section className="px-4 pt-16 sm:px-6">
						<figure className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
							<img
								src="/readme/skedra-whiteboard.png"
								alt={
									isEnglish
										? "Skedra Whiteboard infinite canvas and editor toolbar"
										: "Skedra Whiteboard mit Infinite Canvas und Editor-Werkzeugleiste"
								}
								className="h-auto w-full"
								width="1100"
								height="687"
								loading="eager"
								fetchPriority="high"
							/>
						</figure>
					</section>
				)}

				<div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
					<div className="space-y-14">
						{page.sections.map((section) => (
							<section key={section.heading}>
								<h2 className="font-display text-3xl font-bold tracking-tight">
									{section.heading}
								</h2>
								<div className="mt-5 space-y-4 text-base leading-8 text-muted-foreground">
									{section.paragraphs?.map((paragraph) => (
										<p key={paragraph}>{paragraph}</p>
									))}
								</div>
								{section.bullets && (
									<ul className="mt-6 grid gap-3 sm:grid-cols-2">
										{section.bullets.map((item) => (
											<li
												key={item}
												className="flex gap-3 rounded-xl border border-border bg-card/45 p-4 text-sm leading-6"
											>
												<CheckCircle2
													className="mt-0.5 h-5 w-5 shrink-0 text-primary"
													aria-hidden="true"
												/>
												<span>{item}</span>
											</li>
										))}
									</ul>
								)}
							</section>
						))}
					</div>

					{page.faqs.length > 0 && (
						<section className="mt-16 border-t border-border pt-14">
							<h2 className="font-display text-3xl font-bold">
								{isEnglish ? "Frequently asked questions" : "Häufige Fragen"}
							</h2>
							<div className="mt-7 divide-y divide-border rounded-2xl border border-border bg-card px-5 sm:px-7">
								{page.faqs.map((faq) => (
									<details key={faq.question} className="group py-5">
										<summary className="cursor-pointer list-none pr-8 font-semibold marker:hidden">
											{faq.question}
											<span className="float-right text-primary transition group-open:rotate-45">
												+
											</span>
										</summary>
										<p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
											{faq.answer}
										</p>
									</details>
								))}
							</div>
						</section>
					)}

					{page.sources && page.sources.length > 0 && (
						<section className="mt-12 rounded-2xl border border-border bg-muted/30 p-6">
							<h2 className="text-sm font-semibold">
								{isEnglish ? "Primary sources" : "Primärquellen"}
							</h2>
							<ul className="mt-3 grid gap-2 text-sm">
								{page.sources.map((source) => (
									<li key={source.href}>
										<a
											className="inline-flex items-center gap-2 text-primary hover:underline"
											href={source.href}
											target="_blank"
											rel="noreferrer"
										>
											{source.label}
											<ExternalLink
												className="h-3.5 w-3.5"
												aria-hidden="true"
											/>
										</a>
									</li>
								))}
							</ul>
						</section>
					)}
				</div>

				<section className="border-t border-border bg-card/45 px-4 py-16 sm:px-6">
					<div className="mx-auto max-w-5xl">
						<h2 className="font-display text-2xl font-bold">
							{page.kind === "collection"
								? isEnglish
									? "Choose a guide"
									: "Ratgeber auswählen"
								: isEnglish
									? "Continue reading"
									: "Weiterlesen"}
						</h2>
						<div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{page.related.map((item) => (
								<Link
									key={item.href}
									to={item.href}
									className="group flex min-h-28 items-center justify-between gap-4 rounded-2xl border border-border bg-background p-5 font-semibold transition hover:border-primary/50 hover:shadow-md"
								>
									<span>{item.label}</span>
									<ArrowRight
										className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1"
										aria-hidden="true"
									/>
								</Link>
							))}
						</div>
					</div>
				</section>
			</article>
		</PublicSiteLayout>
	);
}
