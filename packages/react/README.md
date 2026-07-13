# @skedra/react

React SDK for embedding the Skedra canvas without the Skedra app shell.

The package includes the full client-side canvas tooling layer: drawing tools, sticky notes, frames, Kanban boards, mindmaps, templates, local state, controlled state, and an imperative API. Auth, roles, comments, and collaboration transport are intentionally left to the host app or optional adapters.

This package is the MIT editor surface. Workspace features such as accounts,
teams, comments, hosted collaboration, AI backends, and voice/screen-share rooms live
in the open Skedra Community workspace or optional commercial services. The SDK
only exports typed hooks for those integrations.

The package is ESM-only. Import the CSS explicitly alongside the component.

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

## Props

- `elements`: controlled canvas elements.
- `defaultElements`: initial elements for local mode.
- `onChange`: called whenever the local scene changes.
- `readOnly`: disables editing tools.
- `showToolbar`: toggles the built-in toolbar.
- `initialTool`: selects the initial tool.

## Imperative API

```tsx
import { useRef } from "react";
import { SkedraCanvas, type SkedraCanvasApi } from "@skedra/react";

export function Board() {
	const apiRef = useRef<SkedraCanvasApi | null>(null);

	return (
		<>
			<button onClick={() => apiRef.current?.insertMindmap()}>
				Add mindmap
			</button>
			<div style={{ height: 600 }}>
				<SkedraCanvas ref={apiRef} />
			</div>
		</>
	);
}
```

The ref exposes `insertStickyNote`, `insertFrame`, `insertKanbanBoard`, `insertKanbanCard`, `insertMindmap`, `insertMindmapChild`, `insertMindmapSibling`, and `insertTemplate`.

## Canvas parity

The SDK and the Skedra web application use the same SDK-scoped canvas
implementation. `@skedra/canvas-core` owns storage-independent mutation plans,
drawing and selection geometry, keyboard commands, template generation and
layout, Kanban operations, and mindmap operations. `@skedra/canvas-react` owns
the SVG renderer. The web application only adapts these operations to its Yjs,
translation, dialog, and collaboration services; the public package adapts them
to controlled or local React state.

Product-only concerns such as accounts, authorization, billing, comments,
hosted collaboration transport, and application panels intentionally remain
outside the SDK scope.

## Factories

Factory helpers are exported from the package root and the `@skedra/react/factories` subpath:

```tsx
import {
	createSkedraKanbanBoardElements,
	createSkedraTemplateElements,
} from "@skedra/react/factories";
```

For collaboration, keep this package as the rendering and tooling layer and pass synced `elements` in controlled mode.

## Workspace Hooks

`@skedra/react/workspace-hooks` exports typed status/callback contracts for
workspace integrations without shipping the provider implementation:

```ts
import type { SkedraWorkspaceHooks } from "@skedra/react/workspace-hooks";
```

The public hooks can represent state such as `isInCall`, `isMuted`,
`isSpeaking`, and `isScreenSharing`. The actual room orchestration and provider
wiring belongs in the workspace app or a host-provided adapter.
