# Skedra

Skedra is an open-core collaborative whiteboard. The Community edition is meant
to be a serious self-hosted workspace, not just a small editor demo.

- Skedra Community is open source and includes the workspace app, accounts,
  teams, stored boards, database schema, realtime collaboration, comments,
  library workflows, and self-host Docker images.
- Skedra Core is the MIT-licensed reusable editor layer in
  `packages/canvas-core` and `packages/react`.
- Commercial Skedra work should live around Skedra Cloud, enterprise identity
  and compliance, managed AI, billing, premium integrations, and support.

See [PRODUCT_BOUNDARY.md](PRODUCT_BOUNDARY.md) for the exact open/commercial
boundary.

## Core Features

- Infinite canvas with shapes, text, freehand paths, frames, flowcharts, mind maps, kanban boards, and reusable templates
- Auth-free React SDK for embedding the canvas in another app
- `.skedra` and `.skedralib` file formats

## Community Workspace Features

- Real-time collaboration powered by Y.js and Hocuspocus
- User accounts, invite-only self-host registration, private boards, shared boards, and guest collaboration links
- Presentation mode with share links and audience-friendly views
- Comments, mentions, activity tracking, and board-level roles
- Private shape libraries, `.skedralib` imports, and reviewed community catalog submissions
- Optional AI-assisted generation for diagrams, sticky notes, boards, and structured canvas content
- Self-hostable PostgreSQL-backed deployment
- Optional LiveKit-backed voice, camera, and screen sharing

## Commercial Features

- Skedra Cloud hosting, managed upgrades, backups, monitoring, and uptime/SLA
- SSO/SAML/OIDC, SCIM, enterprise identity policy, and advanced admin controls
- Audit logs, retention, compliance workflows, and enterprise governance
- Managed AI gateway, hosted model routing, team AI policy, and provider billing
- Billing, subscriptions, premium integrations, migration help, and priority support

## Architecture

```text
MIT Editor Core
packages/canvas-core  MIT canvas domain model and algorithms
packages/react        MIT auth-free React SDK for embedding the editor

Open Community Workspace
apps/web              React workspace app
apps/libraries        Public shape library catalog app
apps/api              Hono + tRPC + auth + REST API
apps/realtime         Hocuspocus WebSocket collaboration server
apps/mcp              Skedra MCP integration server
packages/db           Drizzle schema and database utilities
packages/shared       Internal shared server/app helpers
```

## Local Development

Local development runs the open Community Workspace stack on top of the MIT
Core packages.

```bash
docker compose -f docker-compose.dev.yml up -d
cp .env.example .env
pnpm install
pnpm db:push
pnpm dev
```

Default development ports:

| Service | Port |
| --- | ---: |
| Web app | 5174 |
| Library catalog | 5175 |
| API | 3001 |
| Realtime | 1235 |
| PostgreSQL | 5434 |

Open `http://localhost:5174` to start using the app.

## Docker Build

Build the stack directly from source:

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d
```

`docker compose up -d` runs the database migration inside the API container before the API
server starts.

If you change `POSTGRES_PASSWORD` after the Postgres volume has already been initialized,
update the database role password as well or recreate the Postgres volume. Docker does not
rewrite the password inside an existing data directory.

For a domain-backed deployment, set at least:

```env
SKEDRA_PUBLIC_APP_URL=https://skedra.example.com
SKEDRA_PUBLIC_LIBRARIES_URL=https://libraries.example.com
SKEDRA_PUBLIC_API_URL=https://skedra.example.com
```

Point your reverse proxy to:

- `https://skedra.example.com` -> Compose port `5174`
- `https://libraries.example.com` -> Compose port `5175`

The internal nginx containers proxy `/api` and `/realtime` to the API and realtime services.

Calls are optional and are configured under `Settings -> System -> Calls`.
The server environment can also provide a fallback:

```env
SKEDRA_CALLS_ENABLED=true
SKEDRA_CALL_PROVIDER=livekit
SKEDRA_PUBLIC_LIVEKIT_URL=wss://livekit.example.com
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

For local testing, `docker-compose.livekit.yml` starts a dev LiveKit server and wires the API
to it. For production, use LiveKit Cloud or the official LiveKit self-host setup with TLS/TURN.

## Community Library Catalog

Use the app domain for accounts and review administration, and the libraries subdomain for the
public catalog:

```env
SKEDRA_PUBLIC_APP_URL=https://skedra.xyz
SKEDRA_PUBLIC_LIBRARIES_URL=https://libraries.skedra.xyz
SKEDRA_LIBRARY_CATALOG_MODE=local
```

Self-hosted installs should use `SKEDRA_LIBRARY_CATALOG_MODE=remote` with
`SKEDRA_LIBRARY_CATALOG_API_URL=https://libraries.skedra.xyz`. Users can submit from their
self-hosted instance; submissions stay pending in the central review queue until an admin
approves them.

The review queue is intentionally not part of the public libraries site. `libraries.skedra.xyz`
serves the catalog UI and accepts `/api/libraries/submissions`, while Skedra admins review,
approve, or reject submissions from the protected system settings in the main app.

## Community Self-Hosting

The GitHub Actions workflow at `.github/workflows/docker-images.yml` builds and
pushes the open Community images:

```text
ghcr.io/<github-user>/skedra-api
ghcr.io/<github-user>/skedra-realtime
ghcr.io/<github-user>/skedra-web
ghcr.io/<github-user>/skedra-libraries
ghcr.io/<github-user>/skedra-standalone
```

Create a release tag to publish versioned Community images and release assets:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The release will include:

- `docker-compose.yml`
- `docker-compose.livekit.yml`
- `env.example`
- `README.md`
- `LICENSE`

Users who want the simplest install can run the all-in-one Community image:

```bash
docker run -d \
  --name skedra \
  -p 3000:80 \
  -v skedra_data:/data \
  ghcr.io/<github-user>/skedra-standalone:v0.1.0
```

That single container starts embedded PostgreSQL, API, realtime collaboration,
the web app, and the library catalog. It is convenient for small teams, NAS
installs, trials, and simple self-hosting. For larger or stricter production
deployments, use the Compose stack so the database and app services are
separate.

Compose users can deploy with:

```bash
cp env.example .env
docker compose --env-file .env up -d
```

For TrueNAS, Dockge, Portainer, or a plain Docker host, use the release `docker-compose.yml` and configure `.env` with your domain, storage path, database password, and secrets.

This full self-host stack includes accounts, teams, stored boards, database
migrations, realtime collaboration, comments, library workflows, optional BYOK
or local AI, and optional LiveKit-backed calls.

## Release Notes

Use version tags for stable deployments:

- `latest` is for the newest build from the default branch.
- `vX.Y.Z` tags are for reproducible self-host releases.

For production installs, prefer a fixed version tag such as `v0.1.0`.

Database migrations are part of API startup. After pulling or building a new version,
`docker compose up -d` starts the API only after the database schema has been updated.

## Security

Generate strong secrets before deploying:

```bash
openssl rand -hex 48
```

Set these values in `.env` or `.env.docker`:

```env
POSTGRES_PASSWORD=...
SKEDRA_AUTH_SECRET=...
SKEDRA_DATA_ENCRYPTION_SECRET=...
```

Never commit real environment files. Only example files should be tracked.

## Troubleshooting

If the API logs show `password authentication failed for user "skedra"`, the app password in
`.env` does not match the password stored in the existing PostgreSQL volume. To keep the data,
connect as the local Postgres admin and update the role password:

```bash
docker compose --env-file .env exec -u postgres postgres psql -d postgres
```

```sql
ALTER USER skedra WITH PASSWORD 'the-value-from-POSTGRES_PASSWORD';
\q
```

For disposable test data, stop the stack, remove the configured Postgres volume or directory,
then rerun the migration and start the stack.

## License

Unless a file or directory contains its own license file, this repository is
licensed under `AGPL-3.0-only`. The reusable editor packages
`packages/canvas-core` and `packages/react` are MIT licensed in their own
directories.
