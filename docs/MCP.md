# MCP for self-hosted Skedra

Skedra includes 23 MCP tools for creating, reading and editing boards, canvas elements, Kanban plans, Gantt timelines and diagrams. Changes remain native, editable board content.

## Remote connection through OAuth

Use the endpoint on your own installation:

```text
https://YOUR-SKEDRA-INSTANCE/api/mcp
```

Add this URL as a Streamable HTTP server in your MCP client. Sign in to your Skedra instance and approve the requested scopes. OAuth discovery and authorization are served by that same installation.

The public documentation domain does not provide an MCP server. Replace examples with your actual server address.

## Local stdio adapter

Build the MCP package in a source checkout:

```bash
pnpm install
pnpm --filter @skedra/mcp build
```

Create an API key in **Settings > API Keys & MCP** on your instance. Use the generated client configuration there, or configure the local adapter:

```json
{
  "mcpServers": {
    "skedra": {
      "command": "node",
      "args": ["/absolute/path/to/skedra-community/apps/mcp/dist/index.js"],
      "env": {
        "SKEDRA_API_URL": "http://localhost:3000/api/v1",
        "SKEDRA_API_KEY": "sked_YOUR_INSTANCE_API_KEY"
      }
    }
  }
}
```

Use the actual absolute path and instance URL. Keep API keys out of public repositories. For remote connections, use HTTPS.

## Permissions and encryption

API keys and OAuth grants use explicit scopes. Board membership and access rules are checked on the server. Removing subscriptions does not remove authentication, permissions or key scope checks.

Use server-encrypted boards for ordinary agent workflows. End-to-end encrypted boards require their separate board key; OAuth access alone does not provide that key. Avoid placing board keys in prompts or logs.

## Example prompts

- Create a project board with To do, Doing and Done Kanban columns.
- Read my architecture board and add a sequence diagram for sign-in.
- Add a Gantt timeline with explicit dates and dependencies.
- Summarize recent activity on a board I can access.

Ask the agent to read back the canvas after writing and use board IDs and links returned by your installation.
