import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { build, renderMarkdown } from "./build.mjs";

test("the website builds without an application backend and all local links resolve", async () => {
	await build();
	const root = new URL("./dist/", import.meta.url);
	async function inspect(directory) {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const file = new URL(entry.name, directory);
			if (entry.isDirectory()) {
				await inspect(new URL(`${entry.name}/`, directory));
				continue;
			}
			if (!entry.name.endsWith(".html")) continue;
			const html = await readFile(file, "utf8");
			assert.doesNotMatch(
				html,
				/<script\b|<form\b|fonts\.googleapis|stripe\.com/u,
			);
			for (const [, href] of html.matchAll(
				/(?:href|src)="(\/[^"#]*)(?:#[^"]*)?"/gu,
			)) {
				const target = new URL(`.${href}`, root);
				if (href.endsWith("/")) target.pathname += "index.html";
				assert.ok(
					(await stat(target)).isFile(),
					`${file.pathname}: missing ${href}`,
				);
			}
		}
	}
	await inspect(root);
	const home = await readFile(new URL("index.html", root), "utf8");
	assert.match(home, /lang="de"/u);
	assert.match(home, /skedra-community-standalone:latest/u);
	assert.doesNotMatch(
		home,
		/href="\/(?:login|register|pricing|subscribe|api)\b/u,
	);
	const sitemap = await readFile(new URL("sitemap.xml", root), "utf8");
	assert.match(sitemap, /https:\/\/skedra.xyz\/docs\/self-host\//u);
	assert.doesNotMatch(sitemap, /\/(?:login|register|pricing|subscribe|api)\b/u);
});

test("documentation preserves code, joins wrapped paragraphs and rewrites repository links", () => {
	const html = renderMarkdown(
		"# Setup\n\nFirst line\nsecond line.\n\n[Self-host](../SELFHOST.md)\n\n```bash\n<tag>\n```\n\n<script>alert(1)</script>\n[unsafe](javascript:alert)",
		"docs/GETTING-STARTED.md",
	);
	assert.match(html, /<p>First line second line\.<\/p>/u);
	assert.match(html, /href="\/docs\/self-host\/"/u);
	assert.match(html, /&lt;tag&gt;/u);
	assert.doesNotMatch(html, /<script|href="javascript:/u);
});
