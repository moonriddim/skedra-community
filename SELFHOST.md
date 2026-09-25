# Skedra Self-Host

Skedra is a private collaborative whiteboard for teams that want to run their
visual workspace on their own infrastructure.

This self-host package uses official Skedra Community Docker images built from
the source-available Skedra codebase.

The Skedra Community License 1.0 covers the workspace app, accounts, teams,
stored boards, database schema, encrypted collaboration, comments, editor and
SDK packages, and self-host deployment files. The Community source is available
in the public repository.

You may self-host and modify Skedra for personal and internal business use,
and contribute through development forks and pull requests. Offering an
independent product, rebranded version, or hosted service to third parties
requires a separate written license, even when the offering is free.
See the full terms in `LICENSE` (or `SELFHOST_LICENSE` in the source repository).

## Requirements

- Docker Engine with Docker Compose
- Persistent storage for PostgreSQL and uploaded files
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
  -e SKEDRA_OBJECT_STORAGE_PROVIDER=filesystem \
  ghcr.io/your-github-user/skedra-standalone:latest
```

Open:

```text
http://localhost:3000
```

The standalone image includes embedded PostgreSQL, the API, the web app, and
the library catalog. PostgreSQL, uploaded files (`/data/assets`), and generated
secrets are stored in `/data`, so keep the volume. On TrueNAS, replace
`skedra_data:/data` with a dataset mount such as `/mnt/tank/apps/skedra:/data`.

For a production domain, set the public URL:

```bash
docker run -d \
  --name skedra \
  -p 3000:80 \
  -v skedra_data:/data \
  -e SKEDRA_OBJECT_STORAGE_PROVIDER=filesystem \
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

`SKEDRA_FOUNDING_TRIAL_DAYS` applies only to the managed-cloud deployment mode.
Self-hosted installations have no subscription gate and ignore this value.

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

## File Storage

PostgreSQL stores accounts, board state, permissions, and file metadata. New
uploads can be stored separately using either a server folder (`filesystem`)
or S3-compatible storage (`s3`). Both modes keep the existing encryption and
access checks. The `inline` mode embeds images and attachments into board state
and increases database, synchronization, and backup sizes.

### Server folder (TrueNAS, NAS, VPS)

The self-host and Docker example environment files select `filesystem` for new
installs. No separate object-storage service is needed. For Compose, configure:

```env
SKEDRA_OBJECT_STORAGE_PROVIDER=filesystem
SKEDRA_ASSET_DATA=/mnt/tank/apps/skedra/assets
SKEDRA_POSTGRES_DATA=/mnt/tank/apps/skedra/postgres
```

For a VPS, use paths such as `/srv/skedra/assets` and `/srv/skedra/postgres`.
`SKEDRA_ASSET_DATA` is the **host** path or Docker volume name. Compose mounts it
into the API container at `/data/assets` and sets `SKEDRA_OBJECT_STORAGE_PATH`
to that **container** path. Keep the asset and database folders separate.
The default named asset volume is `skedra_asset_data`.
Use that default or an absolute host path with the supplied Compose files. A
different named volume must also be declared in the Compose `volumes` section.

When running the API directly, without these Compose files, configure an absolute
path visible to the API process instead:

```env
SKEDRA_OBJECT_STORAGE_PROVIDER=filesystem
SKEDRA_OBJECT_STORAGE_PATH=/srv/skedra/assets
```

The standalone image supplies `SKEDRA_OBJECT_STORAGE_PATH=/data/assets` by default
(or `<SKEDRA_DATA_DIR>/assets` if the data directory is customized). For a separate
asset mount, mount your directory at `/data/assets` in addition to the `/data` volume.

The API process needs read, write, and directory traversal permissions on the
dataset, including its NAS ACLs. It creates missing directories and checks a
write/read/delete cycle before startup completes and when activating the mode
in the app. Invalid paths or storage errors do not fall back to database uploads.
Mount NAS storage before starting the API. Do not expose the asset folder as a
public static directory: encrypted board files are served through the existing
authorized asset API, and profile images use their existing API route.

In `Settings -> System -> Object Storage`, an instance admin can select
**Server filesystem** once the server path is configured. The path itself is
controlled by the server environment and is shown read-only to the admin.
If an app-level storage override is enabled, it takes precedence over the
environment's provider; disable the override to use the environment configuration.

### S3 / R2

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

Managed/SaaS mode still requires `SKEDRA_OBJECT_STORAGE_PROVIDER=s3`.

### Existing installations and scaling

Changing from `inline` to `filesystem` affects new uploads. Existing embedded
images and attachments remain readable in their boards; existing inline profile
images remain readable and use the new storage mode when replaced. There is no
automatic bulk migration. Imported SVGs that become editable canvas content also
remain part of board state.

Keep your existing `.env` when updating: the API and Compose fallbacks remain
`inline` for compatibility. To opt in, set the provider and mount described above.
Do not replace an existing S3 setup with the filesystem example: existing S3 files
are not copied automatically. The settings UI blocks changes of storage location
while external files exist. Startup also rejects a provider that is incompatible
with stored external files, including profile images. Restore the previous
configuration if this check fails. It cannot detect a changed filesystem mount,
directory, or S3 endpoint: relocating storage requires stopping writes, copying all
objects, and preserving their keys and metadata; changing provider additionally
requires a planned metadata migration.

No database schema migration is needed specifically for the filesystem provider.
Updating an existing install does not move or rewrite its board files. Older Skedra
versions do not understand `filesystem`: after enabling it and uploading files,
rolling back requires restoring the matching pre-switch database, storage, and
configuration (uploads since that backup will not be present). Simply changing the
provider back to `inline` does not embed uploaded files into boards.

A local folder separates large file bytes from PostgreSQL and its backups, but
still depends on the disk space, I/O, and availability of that host. Multiple API
instances must use the **same shared asset directory**, with reliable filesystem
locking/rename semantics, or the same S3-compatible store. Separate local folders
on different VPS instances do not form a shared storage system. PostgreSQL remains
required for the application's structured data.

## Secrets

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

Keep your current `.env`, instance secrets, and persistent volumes. Do not copy
the new example environment over an existing installation: its `filesystem`
selection is intended for new installs. A normal image update keeps existing
`inline` and S3 installations on their current storage mode. Take a backup before
opting into a different mode; enabling filesystem storage is a separate step.

Change `SKEDRA_IMAGE_TAG` in `.env` to the new release version, then run:

```bash
docker compose --env-file .env pull
docker compose --env-file .env up -d
```

The update migration is included in API startup during `docker compose up -d`.

For reproducible production installs, prefer version tags such as `v0.1.0` instead of `latest`.

## Backups and restore

Back up PostgreSQL, the asset directory (or S3 objects), and the instance's secret
configuration together. A database-only backup does not contain filesystem uploads.
For a consistent backup, stop the API and other writers first, dump PostgreSQL,
then snapshot or copy the complete asset directory. Restart the API after both
backups finish. With TrueNAS, dataset snapshots are useful for the file directory;
use a PostgreSQL dump or PostgreSQL-aware backup for the database.

For the standalone image, stop the container before snapshotting/copying its entire
`/data` volume. It includes PostgreSQL, files, and `secrets.env`; also back up any
separately mounted asset directory. Restore the matching database, files, and secrets
before restarting, with the same configured storage mode and appropriate permissions.
Keep client recovery keys for E2EE boards as well.

## Troubleshooting

### Filesystem storage fails to start or upload

Check the API logs, that the expected dataset/volume is mounted at `/data/assets`,
free space, and the API process's permissions/ACLs. `SKEDRA_ASSET_DATA` configures
the host mount in Compose; putting a host-only path in `SKEDRA_OBJECT_STORAGE_PATH`
inside a container does not mount it. A disk failure is reported as an error;
uploads are not silently embedded into PostgreSQL.

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

The deployment files and Skedra-owned code in the Community images use the
Skedra Community License 1.0. The release includes the full terms as `LICENSE`.
You may copy and adapt deployment files for permitted self-hosting.

Personal and internal business use, internal modifications, and contributions
are allowed. Independent products, rebranding, and third-party hosted services
require a separate written license. These restrictions do not apply to your
original boards and exports or override third-party licenses. Rights already
granted for earlier AGPL/MIT versions remain unaffected.

For examples and transition details, see
[LICENSING.md](https://github.com/moonriddim/skedra-community/blob/main/LICENSING.md).
For separate licensing, contact support@skedra.xyz.
