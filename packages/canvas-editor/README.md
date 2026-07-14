# @skedra/canvas-editor

MIT-licensed shared interaction layer for the Skedra canvas.

This internal workspace package contains storage-independent editor controllers,
React hooks, and interaction components used by both the Community web app and
the public `@skedra/react` SDK. Host-specific adapters provide persistence,
selection, history, styles, and tool state; the actual gesture behavior is
implemented once here.

The package owns the generic editor surface: the exhaustive tool registry,
complete declarative toolbar, shared SVG surface and grid, keyboard and pointer
routing, selection gestures and overlays, move and point editing, object/anchor
snapping and guides, drawing previews, the properties
panel, inline text and sticky-note editors, interactive image cropping, and the
single-/multi-path controller. Community and SDK code may style these pieces
and connect them to persistence, but may not reimplement their behavior.

The package is private because it is bundled into the public SDK rather than
installed by SDK users as a separate runtime dependency. Its source remains MIT
licensed.

Both products mount the same root and inject only their integrations:

```tsx
<CanvasEditor
  documentAdapter={documentAdapter}
  translations={translations}
  assetAdapter={assetAdapter}
  collaboration={collaboration}
>
  {editorSurface}
</CanvasEditor>
```

The Community adapter maps Yjs, permissions, presence, translations, and asset
URLs. The SDK adapter maps local or controlled React state. Neither adapter may
route generic pointer/keyboard events or implement shared editor controls.
