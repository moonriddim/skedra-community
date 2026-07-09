import type { CanvasStoreState } from "@/hooks/use-canvas-store";
import type { useCanvasSync } from "@/hooks/use-canvas-sync";
import type { useLocalCanvasSync } from "@/hooks/use-local-canvas-sync";
import type { ToolType } from "@skedra/canvas-core";

export type CanvasSync =
	| ReturnType<typeof useCanvasSync>
	| ReturnType<typeof useLocalCanvasSync>;
export type CanvasStore = CanvasStoreState;

const TOOLS_WITH_PROPERTIES = new Set<ToolType>([
	"rectangle",
	"ellipse",
	"diamond",
	"line",
	"arrow",
	"text",
	"freehand",
	"frame",
]);

export function hasCanvasToolProperties(tool: ToolType): boolean {
	return TOOLS_WITH_PROPERTIES.has(tool);
}
