import assert from "node:assert/strict";
import test from "node:test";
import {
	DEFAULT_REMOTE_LIBRARY_CATALOG_API_URL,
	DEFAULT_REMOTE_LIBRARY_SUBMIT_URL,
	resolveLibraryCatalogConfig,
} from "./shape-libraries";

test("self-hosted installations use the central library catalog by default", () => {
	const config = resolveLibraryCatalogConfig({
		deploymentMode: "selfhost",
		mode: "remote",
	});

	assert.deepEqual(config, {
		mode: "remote",
		canSubmit: true,
		submitUrl: DEFAULT_REMOTE_LIBRARY_SUBMIT_URL,
		remoteBaseUrl: DEFAULT_REMOTE_LIBRARY_CATALOG_API_URL,
	});
});

test("explicit local self-hosted catalogs remain read-only", () => {
	const config = resolveLibraryCatalogConfig({
		deploymentMode: "selfhost",
		mode: "local",
		remoteApiUrl: "https://libraries.example.com",
		appUrl: "https://whiteboard.example.com/",
	});

	assert.deepEqual(config, {
		mode: "local",
		canSubmit: false,
		submitUrl: "https://whiteboard.example.com/login?redirect=%2Flibrary",
		remoteBaseUrl: null,
	});
});

test("managed local catalogs accept submissions directly", () => {
	const config = resolveLibraryCatalogConfig({
		deploymentMode: "managed",
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
