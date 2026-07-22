import assert from "node:assert/strict";
import test from "node:test";
import {
	buildCursorMcpInstallUrl,
	buildMcpConfigSnippet,
	resolveSkedraMcpUrl,
} from "./mcp-config.js";

test("resolves the public remote MCP URL from the active API base URL", () => {
	assert.equal(
		resolveSkedraMcpUrl("https://api.skedra.example/"),
		"https://api.skedra.example/api/mcp",
	);
});

test("builds Codex install and OAuth login commands", () => {
	const snippet = buildMcpConfigSnippet({
		client: "codex",
		mcpUrl: "https://skedra.example/api/mcp",
	});

	assert.equal(
		snippet,
		"codex mcp add skedra --url https://skedra.example/api/mcp\n" +
			"codex mcp login skedra",
	);
	assert.doesNotMatch(snippet, /API_KEY|sked_/u);
});

test("builds a Cursor remote-server config without secrets", () => {
	const snippet = buildMcpConfigSnippet({
		client: "cursor",
		mcpUrl: "http://localhost:5174/api/mcp",
	});
	const config = JSON.parse(snippet);

	assert.equal(config.mcpServers.skedra.url, "http://localhost:5174/api/mcp");
	assert.doesNotMatch(snippet, /API_KEY|sked_/u);
});

test("builds Claude and OpenCode remote-server commands", () => {
	const mcpUrl = "https://skedra.example/api/mcp";

	assert.equal(
		buildMcpConfigSnippet({ client: "claude", mcpUrl }),
		"claude mcp add --transport http --scope user skedra https://skedra.example/api/mcp",
	);
	assert.equal(
		buildMcpConfigSnippet({ client: "opencode", mcpUrl }),
		"opencode mcp add skedra --url https://skedra.example/api/mcp",
	);
});

test("builds a Cursor one-click URL with the remote server config", () => {
	const installUrl = new URL(
		buildCursorMcpInstallUrl("https://skedra.example/api/mcp"),
	);

	assert.equal(installUrl.origin, "https://cursor.com");
	assert.equal(installUrl.pathname, "/en/install-mcp");
	assert.equal(installUrl.searchParams.get("name"), "skedra");
	assert.deepEqual(
		JSON.parse(atob(installUrl.searchParams.get("config") ?? "")),
		{ url: "https://skedra.example/api/mcp" },
	);
});
