# MCP distribution

The MCP implementation is part of the self-hosted application in this repository.
Use your installation's https://YOUR-INSTANCE/api/mcp endpoint or build the local
stdio adapter with pnpm --filter @skedra/mcp build.

The project no longer publishes a remote-only registry entry advertising a central
skedra.xyz/api/mcp service. The old publishing workflow and remote metadata have
been removed. Previously submitted external entries must be updated or withdrawn
separately when the old service is retired. See [MCP setup](../../docs/MCP.md).
