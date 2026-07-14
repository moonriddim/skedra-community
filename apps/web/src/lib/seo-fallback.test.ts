import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the production SEO fallback is cleared before external scripts can paint", async () => {
	const template = await readFile(
		new URL("../../index.html", import.meta.url),
		"utf8",
	);
	const rootIndex = template.indexOf('<div id="root"></div>');
	const clearIndex = template.indexOf('id="skedra-clear-seo-fallback"');
	const configIndex = template.indexOf('<script src="/config.js"></script>');

	assert.notEqual(rootIndex, -1);
	assert.notEqual(clearIndex, -1);
	assert.notEqual(configIndex, -1);
	assert.ok(rootIndex < clearIndex);
	assert.ok(clearIndex < configIndex);
	assert.match(
		template,
		/document\.getElementById\("root"\)\?\.replaceChildren\(\);/u,
	);
});
