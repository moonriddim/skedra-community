# @skedra/react

React SDK for embedding the Skedra canvas without the Skedra app shell.

The package includes the full client-side canvas tooling layer: drawing tools,
images and cropping, sticky notes, frames, Kanban boards, flowcharts, mindmaps,
templates, shape libraries, grid snapping, history, clipboard, properties,
saved views, presentations, portable files, visual exports, local state,
controlled state, and an imperative API. Auth, roles, comments, and
collaboration transport are intentionally left to the host app or optional
adapters.

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
- `showProperties`: toggles the complete selection properties panel.
- `showGrid` / `onGridChange`: initial grid/snapping state and change callback.
- `views` / `defaultViews` / `onViewsChange`: controlled or local saved views.
- `libraries` / `defaultLibraries` / `onLibrariesChange`: controlled or local shape libraries.
- `initialTool`: selects the initial tool.
- `initialPathDrawMode` / `onPathDrawModeChange`: selects single-segment or multi-line drawing.
- `initialPathMode` / `onPathModeChange`: selects cornered or curved paths. Legacy elbow values remain readable for existing documents.
- `theme` / `onThemeChange`: controls the light/dark theme and reports shortcut changes.
- `onZenModeChange`: reports Zen-mode changes triggered by the shared shortcut.
- `onHelpRequest` / `onCommandPaletteRequest`: handles the shared help and command-palette shortcuts. Without callbacks, the canvas dispatches bubbling `skedra:help-request` and `skedra:command-palette-request` DOM events.

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

The ref exposes the complete editor command surface, including:

- undo/redo, clipboard, duplicate, select/delete;
- group/ungroup, alignment, distribution, layer ordering, flip and lock;
- element properties and grid/viewport control;
- path draw mode and path style control through `setPathDrawMode` / `setPathMode`;
- image insertion and normalized cropping;
- Kanban card/list details and Flowchart step editing;
- shape library insertion and management;
- saved-view CRUD and presentation navigation;
- `.skedra` import/export state and all element/template insertion helpers.

The stable command IDs are available as `SKEDRA_CANVAS_COMMAND_IDS` and through
the `@skedra/react/commands` subpath.

The built-in toolbar covers the complete shared `ToolType` contract: select,
lasso, pan, shapes, line/arrow, freehand, text, frame, eraser, laser, and
eyedropper. SDK-specific insertion tools add sticky notes, Kanban boards,
mindmaps, and all shared templates. `SKEDRA_SDK_TOOL_IDS` exposes the supported
tool IDs to host applications.

## Files, libraries, images, and exports

The package root and `@skedra/react/io` expose standalone helpers for plain and
PBKDF2/AES-GCM encrypted `.skedra` documents, `.skedralib` files,
`.excalidrawlib` conversion, browser clipboard payloads, image data elements,
and crop operations. `@skedra/react/exporters` creates SVG, PNG, PDF, and PPTX
blobs from the rendered canvas. These helpers have no dependency on Skedra's
web application or internal workspace services.

## Canvas parity

The SDK and the Skedra web application use the same SDK-scoped canvas
implementation. `@skedra/canvas-core` owns storage-independent mutation plans,
drawing and selection geometry, keyboard commands, template generation and
layout, Kanban/Flowchart operations, alignment/distribution, grouping,
clipboard relation remapping, and mindmap operations. `@skedra/canvas-editor`
owns shared editor gestures and interaction UI, `@skedra/canvas-react` owns the
SVG renderer, and `@skedra/canvas-io` owns file codecs, encryption, and visual
exporters. The web application only adapts these layers to its Yjs, translation,
dialog, and collaboration services; the public package adapts them to controlled
or local React state.

Multi-line points, corner/curve modes, legacy elbow rendering, hover previews,
start-point closing snaps, closing/filling, and path point editing run through
the same `@skedra/canvas-editor` controller and components in the Community app
and SDK. Core geometry remains in `@skedra/canvas-core`. The internal editor
package is bundled into `@skedra/react`, so SDK consumers install only the public
SDK package. Repository boundary and parity checks require both surfaces to keep
using the shared implementation.

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
