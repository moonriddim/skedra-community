# @skedra/canvas-react

Shared React/SVG renderer for Skedra canvas elements.

The web application and `@skedra/react` consume this workspace package so
element rendering cannot drift between the product and the embeddable SDK.
Product-specific commands, translations, and asset URL resolution are passed
through `CanvasRendererConfig`; the renderer itself stays application-agnostic.

This package is internal and bundled into the public React SDK.
