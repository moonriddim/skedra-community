# Skedra MCP Server

Last updated: 2026-08-01

Skedra exposes a remote Model Context Protocol server for AI agents that need a
shared visual workspace. The server works with Codex, Claude, Cursor, OpenCode,
and other clients that support Streamable HTTP.

## Remote endpoint

- URL: `https://skedra.xyz/api/mcp`
- Transport: Streamable HTTP
- Authentication: OAuth 2.0 or a Skedra API key, depending on client support
- Setup UI: `https://skedra.xyz/settings?tab=api-keys`
- Product page: `https://skedra.xyz/mcp`

## Capabilities

The server provides 23 focused tools for:

- creating, listing, reading, renaming, archiving and restoring boards;
- reading structured canvas state and applying canvas edit plans;
- creating Kanban boards, Gantt timelines and graphical sequence diagrams;
- reordering elements and managing board members;
- reading board and workspace activity.

The result remains a normal, editable Skedra board. MCP does not produce a flat
screenshot of the canvas.

## Connect a client

1. Create a Skedra Cloud account. New Founding Users receive 30 days of access
   without entering a credit card.
2. Open Settings > API Keys & MCP.
3. Choose Codex, Claude, Cursor, or OpenCode.
4. Create a scoped key if the client requires one, then copy the generated
   configuration.
5. Restart or reload the client and ask it to list your Skedra boards.

Example prompt:

> Create a board called “Beta launch”, add a three-column Kanban plan and a
> Gantt timeline for the next four weeks. Keep both aligned as tasks change.

## Security modes

Agent-readable workflows use server-managed encrypted boards because the MCP
server must be able to interpret and edit structured canvas data. End-to-end
encrypted boards remain available for human-only workflows where the server
must not see canvas contents.

## Self-hosting

The complete web app, API, PostgreSQL database, collaboration stack and MCP
server are part of the source-available Community Edition under the Skedra Community License 1.0:

- Repository: `https://github.com/moonriddim/skedra-community`
- Self-hosting guide: `https://github.com/moonriddim/skedra-community/blob/main/SELFHOST.md`

For the repository-level setup and tool reference, see `docs/MCP.md`.
