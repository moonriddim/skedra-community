# Skedra documentation

Skedra is an open-source whiteboard for people and AI agents, licensed under AGPL-3.0-only. Run the complete application on your own server, NAS or VPS. The public website provides project information and documentation.

## Install the application

The standalone image includes the web app, API, PostgreSQL and library catalog. A Docker volume keeps your data and generated instance secrets across restarts.

```bash
docker run -d \
  --name skedra \
  -p 3000:80 \
  -v skedra_data:/data \
  ghcr.io/moonriddim/skedra-community-standalone:latest
```

Open `http://localhost:3000`. The first account becomes the instance administrator. Further accounts require invitations by default. All application features are available without a Skedra subscription.

For production deployment, Docker Compose, updates and backups, follow the [self-hosting guide](../SELFHOST.md).

## Make your first board

- Start drawing locally without an account, or register on your installation to save boards on its server.
- Create a board, choose its encryption mode and invite collaborators.
- Use shapes, text, diagrams, Kanban cards and Gantt tasks on the same canvas.
- Export a `.skedra` file to keep a portable copy.

Server storage and live collaboration use your own API and database. Local guest boards stay in browser storage until you explicitly save or export them.

## Connect AI agents

Your installation exposes its own MCP endpoint at `https://YOUR-INSTANCE/api/mcp`. Connect a compatible client and sign in through that installation. For API keys or the local stdio adapter, see [MCP setup](MCP.md).

Optional AI generation uses the provider configured by you or your administrator, including local Ollama or compatible services. No central Skedra AI service is required.

## Build with Skedra

Use the [React SDK](../packages/react/README.md) to embed the editor. The SDK shares its model, renderer and interactions with the main application.

## Join the project

The entire project lives in [moonriddim/skedra-community](https://github.com/moonriddim/skedra-community). Read the [contribution guide](../CONTRIBUTING.md) and [license information](../LICENSING.md). Existing installations and contributors can review the [project transition](OPEN-SOURCE-TRANSITION.md).
