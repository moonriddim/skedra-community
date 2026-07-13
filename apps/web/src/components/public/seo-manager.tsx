import { type Locale, useI18n } from "@/lib/i18n";
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

export function SeoManager() {
	const { pathname } = useLocation();
	const { locale } = useI18n();

	useEffect(() => {
		const page = pages[pathname] ?? privatePage;
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
		upsertMeta('meta[name="twitter:title"]', {
			name: "twitter:title",
			content: title,
		});
		upsertMeta('meta[name="twitter:description"]', {
			name: "twitter:description",
			content: description,
		});
		updateCanonical(page.canonical);
		updateStructuredData(page.schema);
	}, [locale, pathname]);

	return null;
}
