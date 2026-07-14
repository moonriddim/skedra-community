import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const distDirectory = path.join(appDirectory, "dist");
const config = JSON.parse(
	await readFile(path.join(appDirectory, "src/lib/seo-pages.json"), "utf8"),
);
const guideConfig = JSON.parse(
	await readFile(path.join(appDirectory, "src/lib/guide-pages.json"), "utf8"),
);
const baseHtml = await readFile(path.join(distDirectory, "index.html"), "utf8");

function routeFilename(route) {
	return route === "/" ? "index.html" : `${route.slice(1)}.html`;
}

const routeFiles = new Map(
	[
		"/",
		"/en",
		"/whiteboard",
		"/en/whiteboard",
		"/pricing",
		"/en/pricing",
		"/privacy",
		"/terms",
		"/imprint",
		...Object.keys(guideConfig),
		"/login",
		"/register",
		"/subscribe",
		"/forgot-password",
		"/reset-password",
	].map((route) => [route, routeFilename(route)]),
);

const privateRoutes = new Set([
	"/login",
	"/register",
	"/subscribe",
	"/forgot-password",
	"/reset-password",
]);

function escapeHtml(value) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function replaceTag(html, pattern, replacement) {
	if (!pattern.test(html)) throw new Error(`Missing SEO tag: ${pattern}`);
	return html.replace(pattern, replacement);
}

function buildGuidePage(route) {
	const guide = guideConfig[route];
	if (!guide) return null;
	const url = `https://skedra.xyz${route}`;
	const pageType =
		guide.kind === "about"
			? "AboutPage"
			: guide.kind === "collection"
				? "CollectionPage"
				: "Article";
	const schema = [
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

function renderGuideContent(guide) {
	const sections = guide.sections
		.map((section) => {
			const paragraphs = (section.paragraphs ?? [])
				.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
				.join("");
			const bullets = section.bullets
				? `<ul>${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
				: "";
			return `<section><h2>${escapeHtml(section.heading)}</h2>${paragraphs}${bullets}</section>`;
		})
		.join("");
	const faqs = guide.faqs.length
		? `<section><h2>${guide.locale === "en" ? "Frequently asked questions" : "Häufige Fragen"}</h2>${guide.faqs
				.map(
					(faq) =>
						`<h3>${escapeHtml(faq.question)}</h3><p>${escapeHtml(faq.answer)}</p>`,
				)
				.join("")}</section>`
		: "";
	const related = `<nav>${guide.related
		.map(
			(item) =>
				`<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`,
		)
		.join("")}</nav>`;
	return `<main class="seo-fallback"><article><p>${escapeHtml(guide.eyebrow)}</p><h1>${escapeHtml(guide.h1)}</h1><p>${escapeHtml(guide.lead)}</p><p>${escapeHtml(guide.updated)}</p>${sections}${faqs}${related}</article></main>`;
}

function staticContent(route) {
	if (guideConfig[route]) return renderGuideContent(guideConfig[route]);
	if (route === "/" || route === "/en") {
		if (route === "/en") {
			return `<main class="seo-fallback"><h1>Skedra Online Whiteboard</h1><p>Skedra is a free browser-based infinite canvas for sketches, mind maps, flowcharts and Kanban boards. Start without an account and store locally. Encrypted cloud storage and live collaboration are optional.</p><nav><a href="/en">Open the whiteboard</a><a href="/en/whiteboard">Explore the product</a><a href="/en/pricing">Compare pricing</a></nav><h2>Start locally for free</h2><p>The complete editor runs directly in your browser. Export drawings to PNG, SVG, PDF, PPTX or a portable Skedra file.</p><h2>Collaborate in the cloud when needed</h2><p>Skedra Cloud adds persistent boards, teams, comments, presentations, sharing, and end-to-end or server-managed encryption.</p></main>`;
		}
		return `<main class="seo-fallback"><h1>Skedra Online Whiteboard</h1><p>Skedra ist ein kostenloses browserbasiertes Infinite Canvas für Skizzen, Mindmaps, Flussdiagramme und Kanban-Boards. Du kannst ohne Konto starten und lokal speichern. Verschlüsselte Cloud-Speicherung und Live-Zusammenarbeit sind optional.</p><nav><a href="/">Whiteboard öffnen</a><a href="/whiteboard">Produkt ansehen</a><a href="/pricing">Preise vergleichen</a></nav><h2>Kostenlos lokal beginnen</h2><p>Der vollständige Editor läuft direkt im Browser. Zeichnungen lassen sich als PNG, SVG, PDF, PPTX oder Skedra-Datei exportieren.</p><h2>Optional in der Cloud zusammenarbeiten</h2><p>Skedra Cloud ergänzt dauerhafte Boards, Teams, Kommentare, Präsentationen, Freigaben sowie Ende-zu-Ende- oder serververwaltete Verschlüsselung.</p></main>`;
	}
	if (route === "/whiteboard" || route === "/en/whiteboard") {
		if (route === "/en/whiteboard") {
			return `<main class="seo-fallback"><article><h1>The free online whiteboard for ideas, diagrams and teams</h1><p>Skedra is a browser-based infinite canvas for sketches, mind maps, flowcharts, Kanban boards and workshops. The free whiteboard works without registration and stores locally on your device. Skedra Cloud adds encrypted storage, live collaboration, teams, comments and presentations.</p><nav><a href="/en">Open the whiteboard</a><a href="/en/pricing">Compare pricing</a></nav><h2>Features</h2><ul><li>Infinite canvas with drawing, text, shapes, arrows and sticky notes</li><li>Mind maps, flowcharts, Kanban boards and templates</li><li>Export to PNG, SVG, PDF, PPTX and Skedra files</li><li>Optional cloud boards, teams, comments, presentations and sharing</li><li>End-to-end or server-managed encryption</li></ul><h2>Free or Cloud?</h2><p>Skedra Free costs CHF 0 and stores locally in the browser. Skedra Cloud costs CHF 4.90 monthly or CHF 49 yearly per person and adds persistent cloud sync and collaboration.</p></article></main>`;
		}
		return `<main class="seo-fallback"><article><h1>Das freie Online-Whiteboard für Ideen, Diagramme und Teams</h1><p>Skedra ist ein browserbasiertes Infinite Canvas für Skizzen, Mindmaps, Flussdiagramme, Kanban-Boards und Workshops. Das kostenlose Whiteboard funktioniert ohne Registrierung und speichert lokal auf deinem Gerät. Skedra Cloud ergänzt verschlüsselte Speicherung, Live-Zusammenarbeit, Teams, Kommentare und Präsentationen.</p><nav><a href="/">Whiteboard öffnen</a><a href="/pricing">Preise vergleichen</a></nav><h2>Funktionen</h2><ul><li>Infinite Canvas mit Zeichnungen, Text, Formen, Pfeilen und Sticky Notes</li><li>Mindmaps, Flowcharts, Kanban-Boards und Vorlagen</li><li>Export als PNG, SVG, PDF, PPTX und Skedra-Datei</li><li>Optional: Cloud-Boards, Teams, Kommentare, Präsentationen und Freigaben</li><li>Ende-zu-Ende- oder serververwaltete Verschlüsselung</li></ul><h2>Free oder Cloud?</h2><p>Skedra Free kostet CHF 0 und speichert lokal im Browser. Skedra Cloud kostet CHF 4.90 monatlich oder CHF 49 jährlich pro Person und ergänzt dauerhafte Cloud-Synchronisierung und Zusammenarbeit.</p></article></main>`;
	}
	if (route === "/pricing" || route === "/en/pricing") {
		if (route === "/en/pricing") {
			return `<main class="seo-fallback"><article><h1>Skedra pricing: Free Whiteboard or Cloud</h1><p>The Skedra editor remains free. You only pay for persistent cloud storage, synchronization and collaboration.</p><table><thead><tr><th>Plan</th><th>Price</th><th>Included</th></tr></thead><tbody><tr><th>Skedra Free</th><td>CHF 0</td><td>Infinite canvas, local browser storage, exports, templates, no account</td></tr><tr><th>Skedra Cloud monthly</th><td>CHF 4.90 per person</td><td>Cloud boards, encryption, live collaboration, comments, teams and presentations</td></tr><tr><th>Skedra Cloud yearly</th><td>CHF 49 per person</td><td>Same features, billed yearly</td></tr></tbody></table><h2>Frequently asked questions</h2><h3>Do I need an account for Skedra Free?</h3><p>No. The free whiteboard works directly in the browser and stores locally.</p><h3>Can I self-host Skedra?</h3><p>Yes. The Community Edition runs on your own infrastructure without the Skedra Cloud paywall.</p><nav><a href="/en">Draw for free</a><a href="/pricing.md">Machine-readable pricing</a></nav></article></main>`;
		}
		return `<main class="seo-fallback"><article><h1>Skedra Preise: Free Whiteboard oder Cloud</h1><p>Der Skedra-Editor bleibt kostenlos. Bezahlt werden nur dauerhafte Cloud-Speicherung, Synchronisierung und Zusammenarbeit.</p><table><thead><tr><th>Plan</th><th>Preis</th><th>Enthalten</th></tr></thead><tbody><tr><th>Skedra Free</th><td>CHF 0</td><td>Infinite Canvas, lokale Browser-Speicherung, Exporte, Vorlagen, ohne Konto</td></tr><tr><th>Skedra Cloud monatlich</th><td>CHF 4.90 pro Person</td><td>Cloud-Boards, Verschlüsselung, Live-Zusammenarbeit, Kommentare, Teams und Präsentationen</td></tr><tr><th>Skedra Cloud jährlich</th><td>CHF 49 pro Person</td><td>Gleicher Umfang wie monatlich, jährlich abgerechnet</td></tr></tbody></table><h2>Häufige Fragen</h2><h3>Brauche ich für Skedra Free ein Konto?</h3><p>Nein. Das freie Whiteboard funktioniert direkt im Browser und speichert lokal auf deinem Gerät.</p><h3>Kann ich Skedra selbst hosten?</h3><p>Ja. Die Community Edition kann auf eigener Infrastruktur betrieben werden und hat keine Skedra-Cloud-Paywall.</p><nav><a href="/">Kostenlos zeichnen</a><a href="/pricing.md">Maschinenlesbare Preise</a></nav></article></main>`;
	}
	if (route === "/privacy") {
		return `<main class="seo-fallback"><article><h1>Datenschutzerklärung</h1><p>Diese Erklärung beschreibt, welche Personendaten Skedra bearbeitet, welche Inhalte verschlüsselt sind, welche technischen Metadaten lesbar bleiben und wann Daten an externe Dienste übermittelt werden.</p><p><a href="/privacy">Datenschutzerklärung mit JavaScript öffnen</a></p></article></main>`;
	}
	if (route === "/terms") {
		return `<main class="seo-fallback"><article><h1>Allgemeine Geschäftsbedingungen</h1><p>Diese AGB regeln die Nutzung des kostenlosen Skedra Whiteboards und der kostenpflichtigen Skedra-Cloud-Dienste.</p><p><a href="/terms">AGB mit JavaScript öffnen</a></p></article></main>`;
	}
	if (route === "/imprint") {
		return `<main class="seo-fallback"><article><h1>Impressum</h1><p>Simon Hediger (Skedra), Hohlenweg 41, 5072 Oeschgen, Schweiz. Kontakt: <a href="mailto:support@skedra.xyz">support@skedra.xyz</a>.</p></article></main>`;
	}
	return `<main class="seo-fallback"><h1>Skedra</h1><p>Die Anwendung wird geladen.</p></main>`;
}

function renderRoute(route) {
	const page = privateRoutes.has(route)
		? config.__private
		: (config[route] ?? buildGuidePage(route));
	if (!page) throw new Error(`Missing SEO config for ${route}`);
	const locale = route === "/en" || route.startsWith("/en/") ? "en" : "de";
	const title = page.title[locale];
	const description = page.description[locale];
	const canonical = page.canonical;
	let html = baseHtml;

	html = replaceTag(html, /<html lang="[^"]+">/, `<html lang="${locale}">`);
	html = html.replace(/\s*<link data-skedra-alternate[^>]*>/g, "");
	const guide = guideConfig[route];
	const translation = guide?.translation;
	const baseAlternates = new Map([
		["/", "/en"],
		["/whiteboard", "/en/whiteboard"],
		["/pricing", "/en/pricing"],
	]);
	const reverseAlternates = new Map(
		Array.from(baseAlternates, ([deRoute, enRoute]) => [enRoute, deRoute]),
	);
	const alternate =
		translation ?? baseAlternates.get(route) ?? reverseAlternates.get(route);
	if (alternate) {
		const deRoute = locale === "de" ? route : alternate;
		const enRoute = locale === "en" ? route : alternate;
		const alternateHtml = [
			["de", deRoute],
			["en", enRoute],
			["x-default", deRoute],
		]
			.map(
				([hreflang, alternateRoute]) =>
					`<link data-skedra-alternate rel="alternate" hreflang="${hreflang}" href="https://skedra.xyz${alternateRoute === "/" ? "/" : alternateRoute}" />`,
			)
			.join("\n    ");
		html = html.replace("</head>", `    ${alternateHtml}\n  </head>`);
	}

	html = replaceTag(
		html,
		/<title>.*?<\/title>/s,
		`<title>${escapeHtml(title)}</title>`,
	);
	html = replaceTag(
		html,
		/<meta name="description"[^>]*>/,
		`<meta name="description" content="${escapeHtml(description)}" />`,
	);
	html = replaceTag(
		html,
		/<meta name="robots"[^>]*>/,
		`<meta name="robots" content="${escapeHtml(page.robots)}" />`,
	);
	html = replaceTag(
		html,
		/<link rel="canonical"[^>]*>/,
		canonical ? `<link rel="canonical" href="${canonical}" />` : "",
	);
	html = replaceTag(
		html,
		/<meta property="og:title"[^>]*>/,
		`<meta property="og:title" content="${escapeHtml(title)}" />`,
	);
	html = replaceTag(
		html,
		/<meta property="og:description"[^>]*>/,
		`<meta property="og:description" content="${escapeHtml(description)}" />`,
	);
	html = replaceTag(
		html,
		/<meta property="og:url"[^>]*>/,
		canonical ? `<meta property="og:url" content="${canonical}" />` : "",
	);
	html = replaceTag(
		html,
		/<meta property="og:locale"[^>]*>/,
		`<meta property="og:locale" content="${locale === "en" ? "en_US" : "de_CH"}" />`,
	);
	html = replaceTag(
		html,
		/<meta property="og:image:alt"[^>]*>/,
		`<meta property="og:image:alt" content="${
			locale === "en"
				? "Skedra Whiteboard infinite canvas and editor toolbar"
				: "Skedra Whiteboard mit Infinite Canvas und Editor-Werkzeugleiste"
		}" />`,
	);
	html = replaceTag(
		html,
		/<meta name="twitter:title"[^>]*>/,
		`<meta name="twitter:title" content="${escapeHtml(title)}" />`,
	);
	html = replaceTag(
		html,
		/<meta name="twitter:description"[^>]*>/,
		`<meta name="twitter:description" content="${escapeHtml(description)}" />`,
	);
	html = replaceTag(
		html,
		/<script id="skedra-structured-data" type="application\/ld\+json">.*?<\/script>/s,
		`<script id="skedra-structured-data" type="application/ld+json">${JSON.stringify(page.schema)}</script>`,
	);
	html = replaceTag(
		html,
		/<div id="root"><\/div>/,
		`<div id="root">${staticContent(route)}</div>`,
	);
	return html;
}

for (const [route, filename] of routeFiles) {
	const outputPath = path.join(distDirectory, filename);
	await mkdir(path.dirname(outputPath), { recursive: true });
	await writeFile(outputPath, renderRoute(route), "utf8");
}

const sitemapRoutes = Array.from(routeFiles.keys()).filter(
	(route) => !privateRoutes.has(route),
);
const lastModified = new Map([
	["/privacy", "2026-07-13"],
	["/terms", "2026-07-13"],
	["/imprint", "2026-07-13"],
]);
const sitemapEntries = [
	...sitemapRoutes.map((route) => ({
		loc: `https://skedra.xyz${route === "/" ? "/" : route}`,
		lastmod:
			guideConfig[route]?.lastModified ??
			lastModified.get(route) ??
			"2026-07-14",
	})),
	{ loc: "https://skedra.xyz/product.md", lastmod: "2026-07-14" },
	{ loc: "https://skedra.xyz/pricing.md", lastmod: "2026-07-14" },
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries
	.map(
		(entry) =>
			`  <url><loc>${entry.loc}</loc><lastmod>${entry.lastmod}</lastmod></url>`,
	)
	.join("\n")}\n</urlset>\n`;
await writeFile(path.join(distDirectory, "sitemap.xml"), sitemap, "utf8");

console.log(`Generated ${routeFiles.size} route-specific SEO entry points.`);
