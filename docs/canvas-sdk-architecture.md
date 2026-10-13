# Canvas SDK architecture

The public React SDK and the Skedra web application share every generic canvas
operation that belongs to the SDK contract.

## Ownership

- `packages/canvas-core` owns the element model, editor mutation plans, drawing
  and selection geometry, viewport math, keyboard command interpretation,
  templates and template layout, Kanban and flowchart behavior, alignment and
  distribution, grouping, frame embedding, clipboard cloning/reference
  remapping, and mindmap behavior.
- `packages/canvas-react` owns the React/SVG element renderer and renderer
  configuration contract.
- `packages/canvas-editor` owns the storage-independent editor surface:
  exhaustive tools and shortcuts, pointer routing, selection and movement
  gestures, object/anchor snapping, path editing, toolbar, properties, inline
  text/sticky editing, and crop/snap overlays.
- `packages/canvas-io` owns the host-independent canvas codecs, `.skedra`
  schema/serialization/encryption, and SVG/PNG/PDF/PPTX exporters. Community
  and the published SDK expose only thin host-specific wrappers around these
  implementations.
- `packages/react` is the public controlled/local-state adapter and built-in SDK
  chrome host. It owns image loading/cropping, shape-library integration,
  history, saved views, and presentation state.
- `apps/web` is the product adapter for Yjs persistence, collaboration,
  localization, dialogs, permissions, comments, and product-only panels.

Generic behavior must not be implemented in `apps/web` or duplicated in
`packages/react`. A feature that belongs to the SDK scope is added to
`canvas-core`, `canvas-react`, `canvas-editor`, or `canvas-io` first and then
consumed by both adapters. Web keeps Yjs, collaboration and localization
adapters; the SDK keeps local/controlled React state. Neither adapter owns a
second toolbar, properties implementation, pointer tool router, inline editor,
crop UI, file codec, or visual exporter.

The adapter boundary is a technical persistence boundary, not a second editor
implementation. Both hosts render `CanvasEditor` and provide document/UI
services. The complete pointer and keyboard routers live in `canvas-editor`;
host adapters may translate state and invoke product-only services, but they
may not install their own generic event pipeline. A new gesture therefore
changes the shared router once and requires no mirrored Web and SDK
implementation.

Toolbar controls follow the same rule. `CanvasEditorToolbar` owns buttons,
menus, color inputs, open/close behavior, accessibility markup and the shared
tool strip. Hosts may declare available product actions and provide callbacks
or icons, but they do not render a second toolbar.

`CanvasEditorSurface` owns the SVG event surface and viewport transform.
Selection bounds, resize/path handles, marquee/lasso feedback and the grid are
shared overlays, so they are rendered and excluded from exports identically in
Community and SDK. Presence, saved-view and product-dialog layers remain host
services.

## Public parity contract

`SkedraCanvasApi` covers every host-independent editor capability: drawing and
selection tools, undo/redo, clipboard, grouping, alignment/distribution,
ordering, flip/lock, properties, grid snapping, images/crop, Kanban details,
Flowchart steps, libraries, views, presentations, and file import/export.
`SKEDRA_CANVAS_COMMAND_IDS` is the stable enumerable command subset for menus,
shortcuts, and command palettes. Browser-only utilities are separately
importable from `@skedra/react/io` and `@skedra/react/exporters`.

## Verification and release

Behavior tests in `packages/canvas-core` exercise mutation plans through both
the local-array and adapter-backed execution paths. Root parity tests ensure the
web and SDK adapters consume those shared contracts. The canvas boundary check
verifies the common `CanvasEditor` root and its single pointer/keyboard routers,
then rejects raw generic event listeners and local toolbar, properties, pointer,
or overlay implementations in either host. It also protects the Community
Flowchart, canvas-background, translation, and UTF-8 integration contracts from
being dropped by an adapter refactor.

`pnpm dev` also runs the public SDK watcher. Changes in `packages/react`,
`packages/canvas-core`, `packages/canvas-editor`, `packages/canvas-io`, or
`packages/canvas-react` continuously rebuild the SDK
JavaScript, declarations, and CSS in `packages/react/dist`. Use `pnpm dev:sdk`
when only the SDK artifacts should be watched, and `pnpm sdk:verify` for the
same focused parity/build gate used by the release workflow.

Changes under `packages/canvas-core`, `packages/canvas-editor`,
`packages/canvas-io`, `packages/canvas-react`, or `packages/react`, as well as
SDK-relevant web canvas changes, trigger the npm
release workflow after they are pushed or merged to `main`. The workflow
selects the next published patch version, tests both adapters, builds the web
app and package, inspects the package tarball, and publishes `@skedra/react`.
