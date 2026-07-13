import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const distDirectory = path.join(appDirectory, "dist");
const config = JSON.parse(
	await readFile(path.join(appDirectory, "src/lib/seo-pages.json"), "utf8"),
);
const baseHtml = await readFile(path.join(distDirectory, "index.html"), "utf8");

const routeFiles = new Map([
	["/", "index.html"],
	["/whiteboard", "whiteboard.html"],
	["/pricing", "pricing.html"],
	["/privacy", "privacy.html"],
	["/terms", "terms.html"],
	["/imprint", "imprint.html"],
	["/login", "login.html"],
	["/register", "register.html"],
	["/subscribe", "subscribe.html"],
	["/forgot-password", "forgot-password.html"],
	["/reset-password", "reset-password.html"],
]);

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

function staticContent(route) {
	if (route === "/") {
		return `<main class="seo-fallback"><h1>Skedra Online Whiteboard</h1><p>Skedra ist ein kostenloses browserbasiertes Infinite Canvas für Skizzen, Mindmaps, Flussdiagramme und Kanban-Boards. Du kannst ohne Konto starten und lokal speichern. Verschlüsselte Cloud-Speicherung und Live-Zusammenarbeit sind optional.</p><nav><a href="/">Whiteboard öffnen</a><a href="/whiteboard">Produkt ansehen</a><a href="/pricing">Preise vergleichen</a></nav><h2>Kostenlos lokal beginnen</h2><p>Der vollständige Editor läuft direkt im Browser. Zeichnungen lassen sich als PNG, SVG, PDF, PPTX oder Skedra-Datei exportieren.</p><h2>Optional in der Cloud zusammenarbeiten</h2><p>Skedra Cloud ergänzt dauerhafte Boards, Teams, Kommentare, Präsentationen, Freigaben sowie Ende-zu-Ende- oder serververwaltete Verschlüsselung.</p></main>`;
	}
	if (route === "/whiteboard") {
		return `<main class="seo-fallback"><article><h1>Das freie Online-Whiteboard für Ideen, Diagramme und Teams</h1><p>Skedra ist ein browserbasiertes Infinite Canvas für Skizzen, Mindmaps, Flussdiagramme, Kanban-Boards und Workshops. Das kostenlose Whiteboard funktioniert ohne Registrierung und speichert lokal auf deinem Gerät. Skedra Cloud ergänzt verschlüsselte Speicherung, Live-Zusammenarbeit, Teams, Kommentare und Präsentationen.</p><nav><a href="/">Whiteboard öffnen</a><a href="/pricing">Preise vergleichen</a></nav><h2>Funktionen</h2><ul><li>Infinite Canvas mit Zeichnungen, Text, Formen, Pfeilen und Sticky Notes</li><li>Mindmaps, Flowcharts, Kanban-Boards und Vorlagen</li><li>Export als PNG, SVG, PDF, PPTX und Skedra-Datei</li><li>Optional: Cloud-Boards, Teams, Kommentare, Präsentationen und Freigaben</li><li>Ende-zu-Ende- oder serververwaltete Verschlüsselung</li></ul><h2>Free oder Cloud?</h2><p>Skedra Free kostet CHF 0 und speichert lokal im Browser. Skedra Cloud kostet CHF 4.90 monatlich oder CHF 49 jährlich pro Person und ergänzt dauerhafte Cloud-Synchronisierung und Zusammenarbeit.</p></article></main>`;
	}
	if (route === "/pricing") {
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
	const page = privateRoutes.has(route) ? config.__private : config[route];
	if (!page) throw new Error(`Missing SEO config for ${route}`);
	const title = page.title.de;
	const description = page.description.de;
	const canonical = page.canonical;
	let html = baseHtml;

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
	await writeFile(
		path.join(distDirectory, filename),
		renderRoute(route),
		"utf8",
	);
}

console.log(`Generated ${routeFiles.size} route-specific SEO entry points.`);
