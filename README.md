# Skedra Core

Skedra Core is the open-source editor layer of Skedra. It contains the reusable
whiteboard/canvas packages that can be embedded in other apps without the
closed Skedra Workspace product.

This repository is MIT licensed. It also builds the public Skedra Core Docker
image: a static, nginx-served OSS editor client similar in scope to the public
Excalidraw client image.

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
does not include Skedra Workspace, accounts, teams, hosted persistence,
comments, AI, LiveKit, or the closed self-host stack.

## Full Workspace Self-Host

Versioned GitHub releases may also include deployment files for the full
Skedra Workspace self-host stack:

```text
docker-compose.yml
docker-compose.livekit.yml
env.example
README.md
LICENSE
```

Those release files run the official Skedra Workspace container images. That
stack includes accounts, teams, stored boards, realtime collaboration,
comments, library workflows, optional AI, and optional LiveKit-backed calls.

The deployment files are public, but the Workspace source code and official
Workspace images are not MIT licensed.

## Packages

```text
apps/app              Static OSS editor client used for the public Docker image.
packages/canvas-core  Canvas element model, geometry, scene, selection, hit testing,
                      ordering, snapping, path rendering, and import helpers.
packages/react        Auth-free React canvas SDK, local/controlled state, toolbar,
                      factories, templates, and public workspace hook contracts.
```

## What Is Not Here

The commercial Skedra Workspace application is intentionally not included in
this repository. Closed-source Workspace code includes:

- Accounts, workspaces, teams, permissions, comments, mentions, and activity
- Hosted realtime backend, API, database schema, deployment image source, and private release automation
- AI backends, provider routing, integrations, moderation, and cloud dashboard
- Voice/screen-share room orchestration and provider infrastructure

The public SDK may expose status/callback contracts such as `isInCall`,
`isMuted`, `isSpeaking`, and `isScreenSharing`, but the implementation of those
workspace features belongs to the closed Workspace app.

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
