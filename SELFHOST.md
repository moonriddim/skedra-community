# Skedra Self-Host

Skedra is a private collaborative whiteboard for teams that want to run their
visual workspace on their own infrastructure.

This self-host package uses official Skedra Community Docker images built from
the open-source Skedra codebase.

Skedra uses a clear Community/Core license split:

- Skedra Community is open source and includes the workspace app, accounts,
  teams, stored boards, database schema, encrypted collaboration, comments, and
  self-host deployment.
- Skedra Core is the MIT-licensed editor/canvas layer in
  `packages/canvas-core` and `packages/react`.

The full Community source is mirrored into the public OSS repository. The
reusable editor packages remain MIT licensed inside `packages/canvas-core` and
`packages/react`.

## Requirements

- Docker Engine with Docker Compose
- A persistent storage path for PostgreSQL
- A domain or local host/IP address for the web app
- Optional: a reverse proxy with HTTPS and WebSocket support

## Files

Download these files from the release:

- `docker-compose.yml`
- `docker-compose.livekit.yml`
- `env.example`
- `README.md`
- `LICENSE`

## One-Container Install

For the simplest install, run the all-in-one Community image:

```bash
docker run -d \
  --name skedra \
  -p 3000:80 \
  -v skedra_data:/data \
  ghcr.io/your-github-user/skedra-standalone:latest
```

Open:

```text
http://localhost:3000
```

The standalone image includes embedded PostgreSQL, the API, the web app, and
the library catalog. Data and generated secrets
are stored in `/data`, so keep the volume.

For a production domain, set the public URL:

```bash
docker run -d \
  --name skedra \
  -p 3000:80 \
  -v skedra_data:/data \
  -e SKEDRA_PUBLIC_APP_URL=https://skedra.example.com \
  ghcr.io/your-github-user/skedra-standalone:latest
```

AI, SMTP, and LiveKit calls still need provider configuration through environment
variables or the app's system settings.

## Compose Install

Rename `env.example` to `.env`:

```bash
cp env.example .env
```

## Configure

Edit `.env` before starting Skedra.

For local testing:

```env
SKEDRA_IMAGE_REGISTRY=ghcr.io/your-github-user
SKEDRA_IMAGE_PREFIX=skedra
SKEDRA_IMAGE_TAG=latest

SKEDRA_PUBLIC_APP_URL=http://localhost:5174
SKEDRA_PUBLIC_LIBRARIES_URL=http://localhost:5175
SKEDRA_PUBLIC_API_URL=http://localhost:5174
```

For a production domain:

```env
SKEDRA_PUBLIC_APP_URL=https://skedra.example.com
SKEDRA_PUBLIC_LIBRARIES_URL=https://libraries.example.com
SKEDRA_PUBLIC_API_URL=https://skedra.example.com
```

Registration defaults to invite-only after the first account:

```env
SKEDRA_REGISTRATION_MODE=invite
```

Modes:

- `invite`: the first account can register, then new users need an invite link.
- `open`: anyone who can reach the instance can register.
- `closed`: only the first account can register.

Invites can be sent from the workspace or board sharing screens. If SMTP is not configured,
Skedra shows a copyable invite link.

## Community Library Catalog

Self-hosted installs read the owner-hosted Skedra community catalog by default and submit
new community libraries to the same central review queue:

```env
SKEDRA_LIBRARY_CATALOG_MODE=remote
SKEDRA_LIBRARY_CATALOG_API_URL=https://libraries.skedra.xyz
SKEDRA_LIBRARY_SUBMIT_URL=https://skedra.xyz/login?redirect=%2Flibrary
```

Users can create private libraries locally and import `.skedralib` files. When a user submits
a public community library from a self-hosted instance, the instance sends it to the central
Skedra review queue. It is not public until a central Skedra admin approves it.

The public `libraries.skedra.xyz` site should expose the catalog and receive submissions, but
the moderation queue stays behind the protected Skedra admin settings on the main app domain.

## Calls With LiveKit

Skedra can use LiveKit for board-scoped voice hangouts. Skedra does not proxy or store
call media. The API checks board permissions, creates a short-lived LiveKit token for the board
room, and the browser connects directly to LiveKit with microphone-only publishing.

Preferred setup: sign in as the instance admin and configure LiveKit under
`Settings -> System -> Calls`. The LiveKit API secret is stored encrypted and is never sent
back to the browser.

The `.env` values are still useful as a server fallback or bootstrap configuration. Keep calls
disabled there unless a LiveKit Cloud project or self-hosted LiveKit server is ready:

```env
SKEDRA_CALLS_ENABLED=false
SKEDRA_CALL_PROVIDER=none
SKEDRA_PUBLIC_LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_TOKEN_TTL_SECONDS=3600
```

Enable the fallback by setting:

```env
SKEDRA_CALLS_ENABLED=true
SKEDRA_CALL_PROVIDER=livekit
SKEDRA_PUBLIC_LIVEKIT_URL=wss://livekit.example.com
LIVEKIT_API_KEY=replace-with-livekit-api-key
LIVEKIT_API_SECRET=replace-with-livekit-api-secret
LIVEKIT_TOKEN_TTL_SECONDS=3600
```

For local testing or a small single-node install, you can start the optional LiveKit overlay:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.livekit.yml up -d
```

The overlay runs LiveKit in dev mode with `devkey` / `secret` and exposes `ws://localhost:7880`.
For internet-facing production, prefer LiveKit Cloud or the official LiveKit self-host generator,
because production WebRTC needs HTTPS/WSS, TURN, UDP ports, and correct public IP handling.

## Image Object Storage (S3 / R2)

New image assets can be stored outside PostgreSQL in any S3-compatible object store. Sign in as
the instance admin and open `Settings -> System -> Object Storage`, or configure the server
environment directly:

```env
SKEDRA_OBJECT_STORAGE_PROVIDER=s3
SKEDRA_OBJECT_STORAGE_PRESET=r2
SKEDRA_OBJECT_STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
SKEDRA_OBJECT_STORAGE_REGION=auto
SKEDRA_OBJECT_STORAGE_BUCKET=skedra-assets
SKEDRA_OBJECT_STORAGE_ACCESS_KEY_ID=replace-me
SKEDRA_OBJECT_STORAGE_SECRET_ACCESS_KEY=replace-me
SKEDRA_OBJECT_STORAGE_PUBLIC_BASE_URL=https://files.example.com
SKEDRA_OBJECT_STORAGE_FORCE_PATH_STYLE=false
SKEDRA_ASSET_MAX_IMAGE_BYTES=8388608
```

For AWS S3, use `SKEDRA_OBJECT_STORAGE_PRESET=aws`; the endpoint may be left empty. MinIO and
other compatible services use the `custom` preset and may require path-style URLs.

Image bytes are encrypted in the browser before upload. E2EE boards derive the asset key from
the board key; server-encrypted boards use a random per-asset key stored inside the protected
board state. PostgreSQL stores only small object metadata and references.

When `SKEDRA_OBJECT_STORAGE_PUBLIC_BASE_URL` is set, configure the bucket or custom domain to
allow CORS `GET` requests from the Skedra app origin. Without a public base URL, Skedra keeps the
bucket private and streams encrypted object bytes through its authenticated asset endpoint.

Managed/SaaS mode requires `SKEDRA_OBJECT_STORAGE_PROVIDER=s3` so image bytes cannot silently
fall back into PostgreSQL. Self-hosted installations may leave the provider as `inline` or choose
external storage for larger deployments.

Generate strong secrets:

```bash
openssl rand -hex 48
```

Set these values:

```env
POSTGRES_PASSWORD=replace-with-a-strong-password
SKEDRA_AUTH_SECRET=replace-with-a-generated-secret
SKEDRA_DATA_ENCRYPTION_SECRET=replace-with-a-generated-secret
```

For TrueNAS, Dockge, or another NAS host, use a persistent dataset path:

```env
SKEDRA_POSTGRES_DATA=/mnt/tank/apps/skedra/postgres
```

## Start

Start Skedra:

```bash
docker compose --env-file .env up -d
```

The database migration runs automatically inside the API container before the API server starts.

Open the app:

```text
http://localhost:5174
```

or your configured production domain.

## Update

Change `SKEDRA_IMAGE_TAG` in `.env` to the new release version, then run:

```bash
docker compose --env-file .env pull
docker compose --env-file .env up -d
```

The update migration is included in API startup during `docker compose up -d`.

For reproducible production installs, prefer version tags such as `v0.1.0` instead of `latest`.

## Troubleshooting

### `password authentication failed for user "skedra"`

PostgreSQL only applies `POSTGRES_PASSWORD` when the data directory is created. If you change
`POSTGRES_PASSWORD` after Skedra has already started once, the API will use the new password
from `.env`, but the existing PostgreSQL role may still have the old password.

If you want to keep the existing data, change the database role password inside the Postgres
container so it matches `.env`:

```bash
docker compose --env-file .env exec -u postgres postgres psql -d postgres
```

Then run:

```sql
ALTER USER skedra WITH PASSWORD 'the-value-from-POSTGRES_PASSWORD';
\q
```

If this is a fresh test instance and you do not need the data, stop the stack, remove the
configured `SKEDRA_POSTGRES_DATA` volume or directory, then run the migration and start again.

## Reverse Proxy

Point your reverse proxy to:

- Skedra app: container host port `5174`
- Library catalog: container host port `5175`

The app container internally proxies:

- `/api` to the API service

## License

This self-host package follows the Skedra Community/Core license split:

- The deployment files are MIT licensed so you can copy and adapt them for your server.
- The official Skedra Community container images are built from open-source
  Skedra source. Unless a file or directory contains its own license file, that
  source is licensed under `AGPL-3.0-only`.
- The reusable editor/core packages are MIT licensed separately in
  `packages/canvas-core` and `packages/react`.
