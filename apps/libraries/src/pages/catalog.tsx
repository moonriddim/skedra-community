/**
 * Öffentlicher Bibliotheks-Katalog — eigene Site (libraries.skedra.xyz).
 */

import {
	buildAddToSkedraUrl,
	buildLibraryCatalogEntryUrl,
	buildPublicLibraryDownloadUrl,
	buildPublishInAppUrl,
	getLibrariesSiteUrl,
	getSkedraAppUrl,
} from "@/lib/catalog-url";
import { type CatalogLocale, detectLocale, getMessages } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import {
	BookOpen,
	Copy,
	Download,
	ExternalLink,
	Loader2,
	Search,
	Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SortKey = "default" | "name" | "updated";

function formatCatalogDate(value: Date | string, locale: CatalogLocale) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	return date.toLocaleDateString(locale === "de" ? "de-CH" : "en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function useHighlightSlug() {
	const [slug, setSlug] = useState<string | null>(null);
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		setSlug(params.get("library")?.trim().toLowerCase() ?? null);
	}, []);
	return slug;
}

export function CatalogPage() {
	const [locale, setLocale] = useState<CatalogLocale>(detectLocale);
	const t = getMessages(locale);
	const highlightSlug = useHighlightSlug();

	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<SortKey>("default");
	const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

	const { data: catalogConfig } = trpc.shapeLibrary.getCatalogConfig.useQuery();
	const {
		data: libraries = [],
		isLoading,
		isError,
	} = trpc.shapeLibrary.listPublic.useQuery();

	useEffect(() => {
		if (!highlightSlug || isLoading) return;
		const el = document.getElementById(`library-${highlightSlug}`);
		el?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, [highlightSlug, isLoading]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		let list = libraries;
		if (q) {
			list = list.filter(
				(entry) =>
					entry.name.toLowerCase().includes(q) ||
					(entry.description ?? "").toLowerCase().includes(q) ||
					(entry.author ?? "").toLowerCase().includes(q) ||
					entry.slug.toLowerCase().includes(q),
			);
		}
		const sorted = [...list];
		if (sort === "name") {
			sorted.sort((a, b) => a.name.localeCompare(b.name, locale));
		} else if (sort === "updated") {
			sorted.sort(
				(a, b) =>
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
			);
		}
		return sorted;
	}, [libraries, locale, query, sort]);

	const handleCopyLink = async (slug: string) => {
		try {
			await navigator.clipboard.writeText(buildLibraryCatalogEntryUrl(slug));
			setCopiedSlug(slug);
			window.setTimeout(() => setCopiedSlug(null), 2000);
		} catch {
			/* ignore */
		}
	};

	const catalogOrigin = getLibrariesSiteUrl();
	const skedraAppUrl = getSkedraAppUrl();
	const publishUrl = catalogConfig?.submitUrl ?? buildPublishInAppUrl();

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="border-b border-border/60 bg-card/80 backdrop-blur-sm">
				<div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
					<div className="flex min-w-0 items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
							<BookOpen className="h-5 w-5" />
						</div>
						<div className="min-w-0">
							<h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
								{t.title}
							</h1>
							<p className="text-sm text-muted-foreground">{t.subtitle}</p>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							className="btn btn-outline h-9 px-3 text-xs"
							onClick={() => setLocale((l) => (l === "de" ? "en" : "de"))}
						>
							{t.langToggle}
						</button>
						<a href={skedraAppUrl} className="btn btn-outline h-9 text-xs">
							{t.openSkedra}
						</a>
						<a href={publishUrl} className="btn btn-secondary h-9 text-xs">
							{t.publishCta}
						</a>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
				<section className="mb-8 rounded-2xl border border-border/50 bg-muted/30 p-5 sm:p-6">
					<div className="flex items-start gap-3">
						<Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
						<div className="space-y-2 text-sm text-muted-foreground">
							<p>{t.intro}</p>
							<p className="text-foreground/80">{t.licenseNotice}</p>
							<p className="font-mono text-xs text-foreground/80">
								{catalogOrigin}
							</p>
						</div>
					</div>
				</section>

				<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="relative flex-1 sm:max-w-md">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<input
							type="search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder={t.searchPlaceholder}
							className="input"
						/>
					</div>
					<label className="flex items-center gap-2 text-sm text-muted-foreground">
						<span>{t.sortLabel}</span>
						<select
							value={sort}
							onChange={(e) => setSort(e.target.value as SortKey)}
							className="h-10 rounded-md border border-border bg-card px-3 text-sm"
						>
							<option value="default">{t.sortDefault}</option>
							<option value="name">{t.sortName}</option>
							<option value="updated">{t.sortUpdated}</option>
						</select>
					</label>
				</div>

				{isLoading && (
					<div className="flex justify-center py-16">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
				)}

				{isError && (
					<p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
						{t.loadError}
					</p>
				)}

				{!isLoading && !isError && filtered.length === 0 && (
					<div className="rounded-2xl border border-dashed border-border/60 px-6 py-12 text-center">
						<p className="text-muted-foreground">
							{query.trim() ? t.noResults : t.empty}
						</p>
						{!query.trim() && (
							<a href={publishUrl} className="btn btn-secondary mt-4">
								{t.publishCta}
							</a>
						)}
					</div>
				)}

				<ul className="grid gap-4 sm:grid-cols-2">
					{filtered.map((entry) => {
						const isHighlighted = highlightSlug === entry.slug;
						const addUrl = buildAddToSkedraUrl(entry.slug, {
							referrer: window.location.href,
						});
						const downloadUrl = buildPublicLibraryDownloadUrl(entry.slug);

						return (
							<li
								key={entry.id}
								id={`library-${entry.slug}`}
								className={`flex flex-col rounded-2xl border bg-card/80 p-4 shadow-sm transition-shadow hover:shadow-md ${
									isHighlighted
										? "border-primary ring-2 ring-primary/20"
										: "border-border/60"
								}`}
							>
								<div className="min-w-0 flex-1">
									<div className="flex items-start justify-between gap-3">
										<h2 className="font-display text-lg font-semibold leading-tight">
											{entry.name}
										</h2>
										<span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
											{t.licenseLabel}
										</span>
									</div>
									{entry.description && (
										<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
											{entry.description}
										</p>
									)}
									<p className="mt-3 text-xs text-muted-foreground">
										{entry.author ?? "—"} · {t.itemCount(entry.itemCount)}
									</p>
									<p className="mt-1 text-[11px] text-muted-foreground/80">
										{t.created}: {formatCatalogDate(entry.createdAt, locale)} ·{" "}
										{t.updated}: {formatCatalogDate(entry.updatedAt, locale)}
									</p>
									<p className="mt-2 font-mono text-[10px] text-muted-foreground/70">
										{entry.slug}
									</p>
								</div>

								<div className="mt-4 flex flex-col gap-2">
									<a href={addUrl} className="btn btn-primary w-full">
										<ExternalLink className="h-4 w-4" />
										{t.addToSkedra}
									</a>
									<div className="flex gap-2">
										<a
											href={downloadUrl}
											download
											className="btn btn-outline flex-1 text-xs"
										>
											<Download className="h-3.5 w-3.5" />
											{t.download}
										</a>
										<button
											type="button"
											className="btn btn-outline flex-1 text-xs"
											onClick={() => void handleCopyLink(entry.slug)}
										>
											<Copy className="h-3.5 w-3.5" />
											{copiedSlug === entry.slug ? t.copied : t.share}
										</button>
									</div>
								</div>
							</li>
						);
					})}
				</ul>

				<footer className="mt-12 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
					<p>{t.footer}</p>
					<p className="mt-2">
						<a
							href="https://skedra.xyz"
							className="text-primary hover:underline"
							target="_blank"
							rel="noopener noreferrer"
						>
							skedra.xyz
						</a>
					</p>
				</footer>
			</main>
		</div>
	);
}
