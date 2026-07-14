import guidePagesData from "@/lib/guide-pages.json";
import { type Locale, useI18n } from "@/lib/i18n";
import { getPublicPathLocale, localizePublicPath } from "@/lib/public-path";
import seoPages from "@/lib/seo-pages.json";
import { useEffect } from "react";
import { useLocation } from "react-router";

type LocalizedText = Record<Locale, string>;

interface SeoPage {
	title: LocalizedText;
	description: LocalizedText;
	canonical?: string;
	robots: string;
	schema: unknown[];
}

const pages = seoPages as Record<string, SeoPage>;
const privatePage = pages.__private;

interface GuideSeoData {
	locale: Locale;
	kind: "about" | "article" | "collection";
	title: string;
	description: string;
	h1: string;
	lastModified: string;
	translation: string;
	faqs: Array<{ question: string; answer: string }>;
}

const guidePages = guidePagesData as Record<string, GuideSeoData>;

function buildGuideSeoPage(pathname: string): SeoPage | undefined {
	const guide = guidePages[pathname];
	if (!guide) return undefined;
	const url = `https://skedra.xyz${pathname}`;
	const pageType =
		guide.kind === "about"
			? "AboutPage"
			: guide.kind === "collection"
				? "CollectionPage"
				: "Article";
	const schema: unknown[] = [
		{
			"@context": "https://schema.org",
			"@type": pageType,
			"@id": `${url}#page`,
			url,
			name: guide.h1,
			headline: guide.h1,
			description: guide.description,
			inLanguage: guide.locale,
			datePublished: "2026-07-14",
			dateModified: guide.lastModified,
			image: "https://skedra.xyz/readme/skedra-whiteboard.png",
			author: {
				"@type": "Person",
				name: "Simon Hediger",
				url: "https://skedra.xyz/about",
			},
			publisher: { "@id": "https://skedra.xyz/#organization" },
			isPartOf: { "@id": "https://skedra.xyz/#website" },
			about: { "@id": "https://skedra.xyz/#software" },
		},
		{
			"@context": "https://schema.org",
			"@type": "BreadcrumbList",
			itemListElement: [
				{
					"@type": "ListItem",
					position: 1,
					name: "Skedra Whiteboard",
					item:
						guide.locale === "en"
							? "https://skedra.xyz/en"
							: "https://skedra.xyz/",
				},
				{
					"@type": "ListItem",
					position: 2,
					name: guide.h1,
					item: url,
				},
			],
		},
	];
	if (guide.faqs.length > 0) {
		schema.push({
			"@context": "https://schema.org",
			"@type": "FAQPage",
			mainEntity: guide.faqs.map((faq) => ({
				"@type": "Question",
				name: faq.question,
				acceptedAnswer: { "@type": "Answer", text: faq.answer },
			})),
		});
	}
	return {
		title: { de: guide.title, en: guide.title },
		description: { de: guide.description, en: guide.description },
		canonical: url,
		robots:
			"index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
		schema,
	};
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
	let element = document.head.querySelector<HTMLMetaElement>(selector);
	if (!element) {
		element = document.createElement("meta");
		document.head.append(element);
	}
	for (const [name, value] of Object.entries(attributes)) {
		element.setAttribute(name, value);
	}
}

function updateCanonical(url?: string) {
	let canonical = document.head.querySelector<HTMLLinkElement>(
		'link[rel="canonical"]',
	);
	if (!url) {
		canonical?.remove();
		return;
	}
	if (!canonical) {
		canonical = document.createElement("link");
		canonical.rel = "canonical";
		document.head.append(canonical);
	}
	canonical.href = url;
}

function updateStructuredData(schema: unknown[]) {
	let script = document.head.querySelector<HTMLScriptElement>(
		"#skedra-structured-data",
	);
	if (schema.length === 0) {
		script?.remove();
		return;
	}
	if (!script) {
		script = document.createElement("script");
		script.id = "skedra-structured-data";
		script.type = "application/ld+json";
		document.head.append(script);
	}
	script.textContent = JSON.stringify(schema);
}

function updateAlternates(pathname: string) {
	for (const element of document.head.querySelectorAll(
		"link[data-skedra-alternate]",
	)) {
		element.remove();
	}
	const locale = getPublicPathLocale(pathname);
	if (!locale) return;
	const dePath = localizePublicPath(pathname, "de");
	const enPath = localizePublicPath(pathname, "en");
	for (const [hreflang, path] of [
		["de", dePath],
		["en", enPath],
		["x-default", dePath],
	] as const) {
		const link = document.createElement("link");
		link.rel = "alternate";
		link.hreflang = hreflang;
		link.href = `https://skedra.xyz${path === "/" ? "/" : path}`;
		link.dataset.skedraAlternate = "true";
		document.head.append(link);
	}
}

export function SeoManager() {
	const { pathname } = useLocation();
	const { locale } = useI18n();

	useEffect(() => {
		const page = pages[pathname] ?? buildGuideSeoPage(pathname) ?? privatePage;
		if (!page) return;
		const title = page.title[locale];
		const description = page.description[locale];

		document.title = title;
		upsertMeta('meta[name="description"]', {
			name: "description",
			content: description,
		});
		upsertMeta('meta[name="robots"]', {
			name: "robots",
			content: page.robots,
		});
		upsertMeta('meta[property="og:title"]', {
			property: "og:title",
			content: title,
		});
		upsertMeta('meta[property="og:description"]', {
			property: "og:description",
			content: description,
		});
		upsertMeta('meta[property="og:type"]', {
			property: "og:type",
			content: "website",
		});
		upsertMeta('meta[property="og:locale"]', {
			property: "og:locale",
			content: locale === "de" ? "de_CH" : "en_US",
		});
		upsertMeta('meta[property="og:url"]', {
			property: "og:url",
			content: page.canonical ?? window.location.href,
		});
		upsertMeta('meta[property="og:image"]', {
			property: "og:image",
			content: "https://skedra.xyz/readme/skedra-whiteboard.png",
		});
		upsertMeta('meta[property="og:image:alt"]', {
			property: "og:image:alt",
			content:
				locale === "en"
					? "Skedra Whiteboard infinite canvas and editor toolbar"
					: "Skedra Whiteboard mit Infinite Canvas und Editor-Werkzeugleiste",
		});
		upsertMeta('meta[name="twitter:title"]', {
			name: "twitter:title",
			content: title,
		});
		upsertMeta('meta[name="twitter:description"]', {
			name: "twitter:description",
			content: description,
		});
		upsertMeta('meta[name="twitter:image"]', {
			name: "twitter:image",
			content: "https://skedra.xyz/readme/skedra-whiteboard.png",
		});
		updateCanonical(page.canonical);
		updateStructuredData(page.schema);
		updateAlternates(pathname);
	}, [locale, pathname]);

	return null;
}
