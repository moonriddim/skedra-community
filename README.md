# Skedra Core

Skedra Core is the open-source editor layer of Skedra. It contains the reusable
whiteboard/canvas packages that can be embedded in other apps without the
wider Skedra Workspace app.

This repository is MIT licensed. It also builds the public Skedra Core Docker
image: a static, nginx-served OSS editor client similar in scope to the public
Excalidraw client image.

The broader Skedra Community Workspace is also open source in
[moonriddim/Skedra](https://github.com/moonriddim/Skedra) under `AGPL-3.0-only`.
This `skedra-core` mirror is intentionally narrower so the reusable editor SDK
and standalone editor client can remain small and MIT licensed.

## App

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

## Docker

Build and run the public OSS editor client:

```bash
docker build -t skedra-core .
docker run --rm -p 3000:80 skedra-core
```

Or use Compose locally:

```bash
docker compose up --build
```

Open `http://localhost:3000`.

The Docker image contains only the open editor client from this repository. It
does not include the Community Workspace services such as accounts, teams,
PostgreSQL-backed boards, realtime backend, comments, AI settings, or LiveKit
call orchestration. Those live in the open Skedra Community Workspace repo.

## Full Workspace Self-Host

Versioned GitHub releases from the main Skedra repository may also include
deployment files for the full Skedra Community self-host stack:

```text
docker-compose.yml
docker-compose.livekit.yml
env.example
README.md
LICENSE
```

Those release files run the official Skedra Community container images built
from the open AGPL workspace source. That stack includes accounts, teams,
stored boards, realtime collaboration, comments, library workflows, optional
BYOK/local AI, and optional LiveKit-backed calls.

For the simplest full self-host install, use the Community standalone image:

```bash
docker run -d \
  --name skedra \
  -p 3000:80 \
  -v skedra_data:/data \
  ghcr.io/moonriddim/skedra-standalone:latest
```

The deployment files are public and the Workspace source is open, but the
Workspace code and official Workspace images are not MIT licensed. They follow
the Skedra Community `AGPL-3.0-only` license unless a file or directory has its
own license.

## Packages

```text
apps/app              Static OSS editor client used for the public Docker image.
packages/canvas-core  Canvas element model, geometry, scene, selection, hit testing,
                      ordering, snapping, path rendering, and import helpers.
packages/react        Auth-free React canvas SDK, local/controlled state, toolbar,
                      factories, templates, and public workspace hook contracts.
```

## What Lives Elsewhere

The AGPL Skedra Community Workspace is intentionally not copied into this MIT
mirror. In the main Skedra repository it includes:

- Accounts, workspaces, teams, permissions, comments, mentions, and activity
- Realtime backend, API, database schema, migrations, and self-host images
- Library workflows, optional BYOK/local AI, and optional LiveKit call support
- Workspace web app, API, realtime service, database package, and shared helpers

Commercial-only Skedra code remains outside this MIT mirror and outside the
Community workspace. That may include:

- Skedra Cloud hosting, managed upgrades, monitoring, backups, and SLA
- SSO/SAML/OIDC, SCIM, enterprise identity policy, and advanced admin controls
- Audit logs, retention, legal hold, compliance workflows, and governance
- Managed AI gateway, hosted model routing, billing, and premium integrations
- Priority support, migrations, onboarding, and enterprise services

The public SDK may expose status/callback contracts such as `isInCall`,
`isMuted`, `isSpeaking`, and `isScreenSharing`, but the implementation of those
workspace features belongs to a host app such as the open Community Workspace
or a commercial Skedra service.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

## React SDK

```tsx
import { SkedraCanvas } from "@skedra/react";
import "@skedra/react/style.css";

export function Whiteboard() {
	return (
		<div style={{ height: 600 }}>
			<SkedraCanvas onChange={(elements) => console.info(elements)} />
		</div>
	);
}
```

## Workspace Hooks

```ts
import type { SkedraWorkspaceHooks } from "@skedra/react/workspace-hooks";
```

Use these types to connect a host app to optional workspace features while
keeping provider code outside the open-source editor core.
