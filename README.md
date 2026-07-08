# Skedra Core

Skedra Core is the open-source editor layer of Skedra. It contains the reusable
whiteboard/canvas packages that can be embedded in other apps without the
closed Skedra Workspace product.

This repository is MIT licensed.

## Packages

```text
packages/canvas-core  Canvas element model, geometry, scene, selection, hit testing,
                      ordering, snapping, path rendering, and import helpers.
packages/react        Auth-free React canvas SDK, local/controlled state, toolbar,
                      factories, templates, and public workspace hook contracts.
```

## What Is Not Here

The commercial Skedra Workspace application is intentionally not included in
this repository. Closed-source Workspace code includes:

- Accounts, workspaces, teams, permissions, comments, mentions, and activity
- Hosted realtime backend, API, database schema, deployment images, and release automation
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
