# @skedra/canvas-core

Canvas domain package under the [Skedra Community License 1.0](LICENSE).

This package contains the reusable whiteboard/editor primitives: element
types, geometry, hit testing, ordering, selection, snapping, scene helpers,
path rendering, structured Gantt/Kanban/Mindmap/Flowchart generators, visual
sequence-diagram presets and mutation planners, a Mermaid-compatible parser and
layout engine, and import utilities.

It is part of the source-available Skedra Core surface. Workspace features such as
accounts, teams, comments, collaboration transports, AI backends, voice/screen-share
providers, deployment images, and cloud dashboards should stay outside this
package so the canvas domain model remains reusable and app-agnostic.

The npm package is currently marked private to avoid accidental publication
before the JavaScript build output is finalized. The source in this directory
uses the same Community license: internal use and contributions are allowed;
independent products and hosted services require a separate written license.
