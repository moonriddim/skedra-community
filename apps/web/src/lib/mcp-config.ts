export type McpClient = "codex" | "cursor" | "claude" | "opencode";

type McpConfigOptions = {
	client: McpClient;
	mcpUrl: string;
};

export function resolveSkedraMcpUrl(apiBaseUrl: string) {
	return `${apiBaseUrl.replace(/\/+$/u, "")}/api/mcp`;
}

export function buildMcpConfigSnippet({ client, mcpUrl }: McpConfigOptions) {
	if (client === "codex") {
		return `codex mcp add skedra --url ${mcpUrl}\ncodex mcp login skedra`;
	}

	if (client === "claude") {
		return `claude mcp add --transport http --scope user skedra ${mcpUrl}`;
	}

	if (client === "opencode") {
		return `opencode mcp add skedra --url ${mcpUrl}`;
	}

	return JSON.stringify(
		{
			mcpServers: {
				skedra: {
					url: mcpUrl,
				},
			},
		},
		null,
		2,
	);
}

export function buildCursorMcpInstallUrl(mcpUrl: string) {
	const config = btoa(JSON.stringify({ url: mcpUrl }));
	const installUrl = new URL("https://cursor.com/en/install-mcp");
	installUrl.searchParams.set("name", "skedra");
	installUrl.searchParams.set("config", config);
	return installUrl.toString();
}
