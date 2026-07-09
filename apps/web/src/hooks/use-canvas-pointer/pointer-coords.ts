/**
 * Canvas-Koordinaten und Snap fuer Pointer-Events.
 */

export function isPathTool(tool: string): boolean {
	return tool === "line" || tool === "arrow";
}

export function isCenterShapeTool(tool: string): boolean {
	return tool === "rectangle" || tool === "ellipse" || tool === "diamond";
}

export function supportsAnchorSnapTool(tool: string): boolean {
	return isPathTool(tool) || isCenterShapeTool(tool);
}

export function resolvePointerCanvasCoords(
	clientX: number,
	clientY: number,
	options: {
		placement?: {
			canvas: { x: number; y: number };
			x: number;
			y: number;
		} | null;
		supportsAnchorSnap?: boolean;
		resolvePathPlacement?: (
			screenX: number,
			screenY: number,
			opts?: { forceAnchor?: boolean },
		) => {
			canvas: { x: number; y: number };
			x: number;
			y: number;
			anchor: unknown;
		};
		toCanvas: (screenX: number, screenY: number) => { x: number; y: number };
		snapToGrid: (value: number) => number;
	},
) {
	const placement =
		options.placement !== undefined
			? options.placement
			: options.supportsAnchorSnap && options.resolvePathPlacement
				? options.resolvePathPlacement(clientX, clientY)
				: null;
	const canvas = placement?.canvas ?? options.toCanvas(clientX, clientY);
	return {
		canvas,
		snappedX: placement?.x ?? options.snapToGrid(canvas.x),
		snappedY: placement?.y ?? options.snapToGrid(canvas.y),
		placement,
	};
}
