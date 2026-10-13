import assert from "node:assert/strict";
import test from "node:test";
import { resolveLibraryCatalogConfig } from "./shape-libraries";

test("explicit remote catalogs remain supported", () => {
	const config = resolveLibraryCatalogConfig({
		deploymentMode: "selfhost",
		mode: "remote",
		remoteApiUrl: "https://libraries.example.test",
	});

	assert.deepEqual(config, {
		mode: "remote",
		canSubmit: true,
		submitUrl: "https://libraries.example.test/login?redirect=%2Flibrary",
		remoteBaseUrl: "https://libraries.example.test",
	});
});

test("local self-hosted catalogs accept submissions", () => {
	const config = resolveLibraryCatalogConfig({
		deploymentMode: "selfhost",
		mode: "local",
		remoteApiUrl: "https://libraries.example.com",
		appUrl: "https://whiteboard.example.com/",
	});

	assert.deepEqual(config, {
		mode: "local",
		canSubmit: true,
		submitUrl: "https://whiteboard.example.com/login?redirect=%2Flibrary",
		remoteBaseUrl: null,
	});
});

test("local catalogs accept submissions directly", () => {
	const config = resolveLibraryCatalogConfig({
		deploymentMode: "selfhost",
		mode: "local",
		appUrl: "https://skedra.example",
	});

	assert.equal(config.canSubmit, true);
	assert.equal(config.remoteBaseUrl, null);
});

test("custom remote catalogs and submission pages can be configured", () => {
	const inferredSubmitUrl = resolveLibraryCatalogConfig({
		deploymentMode: "selfhost",
		mode: "remote",
		remoteApiUrl: "https://libraries.example.com/",
	});
	assert.equal(
		inferredSubmitUrl.submitUrl,
		"https://libraries.example.com/login?redirect=%2Flibrary",
	);

	const explicitSubmitUrl = resolveLibraryCatalogConfig({
		deploymentMode: "selfhost",
		mode: "remote",
		remoteApiUrl: "https://libraries.example.com",
		submitUrl: " https://example.com/submit ",
	});
	assert.equal(explicitSubmitUrl.submitUrl, "https://example.com/submit");
});
