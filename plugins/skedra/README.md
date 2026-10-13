# Skedra self-hosted plugin

This is the source template for connecting agents to your own Skedra installation.
It is licensed under AGPL-3.0-only. There is no centrally hosted MCP service.

The development configuration points to http://localhost:3000/api/mcp, the default
standalone installation on the same computer. For another instance, configure
its actual MCP URL when packaging:

```powershell
pnpm plugin:package -McpUrl https://YOUR-INSTANCE/api/mcp
```

Sign in to that installation through the host's OAuth flow. Never paste API keys,
passwords or board keys into chat. Use server-encrypted boards for ordinary agent
workflows; end-to-end encrypted boards need their separate board key.

The portable manifest, MCP configuration and whiteboard skill live in this directory.
Compatibility files are generated for older Codex clients. Keep the plugin's name,
assets and default prompts when customizing its connection.

This template is not a public-directory package promising an operator-managed
endpoint. Existing hosted submissions must be updated or withdrawn separately.
See [MCP setup](../../docs/MCP.md).
