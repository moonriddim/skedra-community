import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = fileURLToPath(new URL("./dist/", import.meta.url));
const repo = "https://github.com/moonriddim/skedra-community";
const origin = "https://skedra.xyz";
const pages = [
	["docs", "Documentation", "docs/GETTING-STARTED.md"],
	["docs/self-host", "Self-hosting", "SELFHOST.md"],
	["docs/mcp", "MCP & AI agents", "docs/MCP.md"],
	["docs/sdk", "React SDK", "packages/react/README.md"],
	["docs/contributing", "Contributing", "CONTRIBUTING.md"],
	["docs/license", "License", "LICENSING.md"],
	["docs/transition", "Project transition", "docs/OPEN-SOURCE-TRANSITION.md"],
];
const escapeHtml = (value) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

function linkUrl(href, source) {
	if (/^(?:https?:|mailto:|#)/u.test(href)) return href;
	const [file, fragment] = href.split("#");
	const resolved = path.posix.normalize(
		path.posix.join(path.posix.dirname(source), file),
	);
	const target = pages.find((page) => page[2] === resolved);
	return `${target ? `/${target[0]}/` : `${repo}/blob/main/${resolved}`}${fragment ? `#${fragment}` : ""}`;
}

// Docs are repository-owned Markdown. Escape HTML and allow only safe link protocols.
export function renderMarkdown(markdown, source) {
	let code = false;
	let list = null;
	let paragraph = [];
	const result = [];
	const inline = (text) =>
		escapeHtml(text)
			.replace(/`([^`]+)`/gu, "<code>$1</code>")
			.replace(/\[([^\]]+)\]\(([^)]+)\)/gu, (_match, label, href) => {
				if (
					/^[a-z][a-z\d+.-]*:/iu.test(href) &&
					!/^(?:https?:|mailto:)/iu.test(href)
				)
					return label;
				return `<a href="${escapeHtml(linkUrl(href.replaceAll("&amp;", "&"), source))}">${label}</a>`;
			})
			.replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>");
	const closeList = () => {
		if (list) result.push(`</${list}>`);
		list = null;
	};
	const closeParagraph = () => {
		if (paragraph.length) result.push(`<p>${inline(paragraph.join(" "))}</p>`);
		paragraph = [];
	};
	for (const line of markdown.replaceAll("\r\n", "\n").split("\n")) {
		if (line.startsWith("```")) {
			closeParagraph();
			closeList();
			result.push(code ? "</code></pre>" : "<pre><code>");
			code = !code;
			continue;
		}
		if (code) {
			result.push(escapeHtml(line));
			continue;
		}
		const heading = line.match(/^(#{1,6})\s+(.+)$/u);
		if (heading) {
			closeParagraph();
			closeList();
			const id = heading[2]
				.toLowerCase()
				.replace(/[^a-z0-9\s-]/gu, "")
				.trim()
				.replace(/\s+/gu, "-");
			result.push(
				`<h${heading[1].length} id="${id}">${inline(heading[2])}</h${heading[1].length}>`,
			);
			continue;
		}
		const item = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/u);
		if (item) {
			closeParagraph();
			const type = /^\s*\d/u.test(line) ? "ol" : "ul";
			if (list !== type) {
				closeList();
				result.push(`<${type}>`);
				list = type;
			}
			result.push(`<li>${inline(item[1])}</li>`);
			continue;
		}
		if (list && /^\s{2,}\S/u.test(line)) {
			const previous = result.pop();
			result.push(previous.replace(/<\/li>$/u, ` ${inline(line.trim())}</li>`));
			continue;
		}
		closeList();
		if (line.trim()) paragraph.push(line.trim());
		else closeParagraph();
	}
	closeParagraph();
	closeList();
	if (code) result.push("</code></pre>");
	return result.join("\n");
}

function shell(title, description, body, route = "", locale = "en") {
	return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Skedra</title><meta name="description" content="${escapeHtml(description)}"><meta name="theme-color" content="#0e1819"><link rel="canonical" href="${origin}/${route}"><meta property="og:title" content="${escapeHtml(title)} · Skedra"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:image" content="${origin}/assets/whiteboard.png"><link rel="icon" href="/assets/logo.png"><link rel="stylesheet" href="/style.css"></head>
<body><a class="skip" href="#main">Skip to content</a><header><a class="brand" href="/"><img src="/assets/logo.png" width="34" height="34" alt="">Skedra<span>open source</span></a><nav aria-label="Main navigation"><a href="/docs/">Docs</a><a href="/docs/self-host/">Self-host</a><a href="${repo}">GitHub ↗</a><a href="/en/" lang="en">EN</a><a href="/" lang="de">DE</a></nav></header>${body}<footer><div><strong>Skedra</strong><span>Built in the open. Run on your infrastructure.</span></div><nav aria-label="Footer"><a href="${repo}/releases">Releases</a><a href="${repo}/issues">Issues</a><a href="https://discord.gg/7BqMSy5dy">Discord</a><a href="/docs/license/">AGPL-3.0</a><a href="/privacy/">Privacy</a><a href="/imprint/">Imprint</a></nav></footer></body></html>`;
}

function home(locale) {
	const de = locale === "de";
	const description = de
		? "Das Open-Source-Whiteboard für Menschen und AI-Agenten. Selbst hosten, gemeinsam arbeiten und die Kontrolle über deine Daten behalten."
		: "The open-source whiteboard for people and AI agents. Self-host, collaborate and keep control of your data.";
	return shell(
		de
			? "Deine Ideen. Deine Infrastruktur."
			: "Your ideas. Your infrastructure.",
		description,
		`<main id="main"><section class="hero"><div class="eyebrow"><span></span>AGPL-3.0 · 100% open source</div><h1>${de ? "Deine Ideen.<br><em>Deine Infrastruktur.</em>" : "Your ideas.<br><em>Your infrastructure.</em>"}</h1><p class="lead">${description}</p><div class="actions"><a class="button" href="/docs/self-host/">${de ? "Skedra selbst hosten" : "Self-host Skedra"}<span>↗</span></a><a class="button secondary" href="${repo}">${de ? "Quellcode ansehen" : "Explore the source"}<span>↗</span></a></div><p class="quiet">${de ? "Ein Projekt. Ein Repository. Alle Funktionen auf deinem Server." : "One project. One repository. Every feature on your server."}</p></section><figure class="preview"><div class="window"><i></i><i></i><i></i><span>Skedra / your workspace</span></div><img src="/assets/whiteboard.png" alt="Skedra infinite canvas with drawing tools and editable board elements" width="1440" height="900" loading="eager"></figure><section class="features"><div class="section-heading"><span class="eyebrow">YOUR WORKSPACE, UNDER YOUR CONTROL</span><h2>${de ? "Platz für das große Ganze." : "Room for the bigger picture."}</h2></div><div class="cards"><article><span class="number">01 / CANVAS</span><h3>${de ? "Gemeinsam denken" : "Think together"}</h3><p>${de ? "Zeichnen, Diagramme, Kanban und Gantt auf einer unendlichen Arbeitsfläche. Mit Teams, Kommentaren und Live-Zusammenarbeit." : "Drawing, diagrams, Kanban and Gantt on an infinite canvas. With teams, comments and live collaboration."}</p></article><article><span class="number">02 / SELF-HOST</span><h3>${de ? "Bei dir zu Hause" : "Make it yours"}</h3><p>${de ? "Docker auf deinem NAS, VPS oder eigenen Server. Datenbank und Dateien bleiben auf deiner Infrastruktur. Ohne Skedra-Abo." : "Docker on your NAS, VPS or server. Your database and files stay on your infrastructure. No Skedra subscription."}</p></article><article><span class="number">03 / MCP + SDK</span><h3>${de ? "Offen für neue Ideen" : "Open to new ideas"}</h3><p>${de ? "Verbinde AI-Agenten per MCP, nutze eigene AI-Anbieter oder integriere den Editor mit dem React SDK." : "Connect AI agents through MCP, bring your own AI providers or embed the editor with the React SDK."}</p></article></div></section><section class="quickstart"><div><span class="eyebrow">GET STARTED</span><h2>${de ? "Dein Whiteboard.<br>In einem Container." : "Your whiteboard.<br>In one container."}</h2><p>${de ? "Docker starten, localhost öffnen und loslegen. Das Datenvolume bleibt bei Updates erhalten." : "Start Docker, open localhost and get to work. The data volume persists across updates."}</p><a class="text-link" href="/docs/self-host/">${de ? "Installation, Updates & Backups" : "Installation, updates & backups"} →</a></div><div><pre><code>docker run -d \\
  --name skedra \\
  -p 3000:80 \\
  -v skedra_data:/data \\
  ghcr.io/moonriddim/skedra-community-standalone:latest</code></pre><a class="quiet" href="/docs/self-host/">${de ? "Danach http://localhost:3000 auf deinem Rechner öffnen." : "Then open http://localhost:3000 on your computer."}</a></div></section><section class="contribute"><span class="eyebrow">BUILT IN THE OPEN</span><h2>${de ? "Mach Skedra mit uns besser." : "Help shape what comes next."}</h2><p>${de ? "Code, Dokumentation, Übersetzungen oder eine gute Idee: Beiträge sind willkommen." : "Code, documentation, translations or a good idea: contributions are welcome."}</p><a class="button secondary" href="/docs/contributing/">${de ? "Zum Projekt beitragen" : "Start contributing"} ↗</a></section></main>`,
		de ? "" : "en/",
		locale,
	);
}

export async function build() {
	await mkdir(path.join(output, "assets"), { recursive: true });
	await cp(
		path.join(root, "apps/web/public/logo-mark-transparent-dark.png"),
		path.join(output, "assets/logo.png"),
	);
	await cp(
		path.join(root, "apps/web/public/readme/skedra-whiteboard.png"),
		path.join(output, "assets/whiteboard.png"),
	);
	await cp(
		new URL("style.css", import.meta.url),
		path.join(output, "style.css"),
	);
	const routes = ["", "en/"];
	await writeFile(path.join(output, "index.html"), home("de"));
	await mkdir(path.join(output, "en"), { recursive: true });
	await writeFile(path.join(output, "en/index.html"), home("en"));
	for (const [route, title, source] of pages) {
		const markdown = await readFile(path.join(root, source), "utf8");
		const nav = pages
			.map(
				([url, label]) =>
					`<a ${route === url ? 'aria-current="page"' : ""} href="/${url}/">${label}</a>`,
			)
			.join("");
		const body = `<div class="docs-layout"><aside><span class="eyebrow">DOCUMENTATION</span><nav aria-label="Documentation">${nav}</nav><a class="edit" href="${repo}/edit/main/${source}">Edit this page ↗</a></aside><main id="main" class="prose">${renderMarkdown(markdown, source)}</main></div>`;
		await mkdir(path.join(output, route), { recursive: true });
		await writeFile(
			path.join(output, route, "index.html"),
			shell(
				title,
				`${title} for the open-source, self-hosted Skedra whiteboard.`,
				body,
				`${route}/`,
			),
		);
		routes.push(`${route}/`);
	}
	for (const [route, title, content] of [
		[
			"privacy",
			"Website privacy",
			"This is a static documentation website. It provides no Skedra accounts, board storage, checkout or hosted MCP endpoint. It uses no analytics scripts, tracking cookies or remote fonts. The web host may process ordinary request logs. Data on self-hosted Skedra instances is controlled by each instance operator. Contact: support@skedra.xyz.",
		],
		[
			"imprint",
			"Project contact",
			"Skedra is maintained by Simon Hediger (moonriddim). Contact: support@skedra.xyz. Source code, releases and issue tracking are available at github.com/moonriddim/skedra-community.",
		],
	]) {
		await mkdir(path.join(output, route), { recursive: true });
		await writeFile(
			path.join(output, route, "index.html"),
			shell(
				title,
				title,
				`<main id="main" class="prose standalone"><h1>${title}</h1><p>${content}</p></main>`,
				`${route}/`,
			),
		);
		routes.push(`${route}/`);
	}
	await writeFile(
		path.join(output, "404.html"),
		shell(
			"Page not found",
			"Find Skedra documentation and self-hosting instructions.",
			'<main id="main" class="prose standalone"><h1>Page not found</h1><p>The Skedra website is now dedicated to documentation. App accounts and boards belong to your own installation.</p><a class="button" href="/docs/">Go to documentation →</a></main>',
		),
	);
	await writeFile(
		path.join(output, "robots.txt"),
		`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
	);
	await writeFile(
		path.join(output, "sitemap.xml"),
		`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((route) => `<url><loc>${origin}/${route}</loc></url>`).join("")}</urlset>`,
	);
	await writeFile(
		path.join(output, "llms.txt"),
		`# Skedra\n\nOpen-source whiteboard licensed under AGPL-3.0-only. Self-host the app; skedra.xyz serves documentation only.\n\n${pages.map(([route, title]) => `- [${title}](${origin}/${route}/)`).join("\n")}\n\nMCP: https://YOUR-INSTANCE/api/mcp (OAuth) or the local stdio adapter in apps/mcp. No central hosted MCP service.\n`,
	);
	console.log(`Built ${routes.length} static pages in apps/docs/dist`);
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
	await build();
