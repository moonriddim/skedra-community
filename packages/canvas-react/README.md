# @skedra/canvas-react

Shared React/SVG renderer for Skedra canvas elements under the
[Skedra Community License 1.0](LICENSE). Internal use and contributions are
allowed; independent products and hosted services require a separate written
license.

The web application and `@skedra/react` consume this workspace package so
element rendering cannot drift between the product and the embeddable SDK.
Product-specific commands, translations, and asset URL resolution are passed
through `CanvasRendererConfig`; the renderer itself stays application-agnostic.

This package is internal and bundled into the public React SDK.
