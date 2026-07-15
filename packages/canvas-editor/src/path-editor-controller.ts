import {
	type ArrowMode,
	type CanvasDrawingStyle,
	type CanvasElement,
	type CanvasPathDraftState,
	type CanvasPathDrawMode,
	type CanvasPathPoint,
	type CanvasPathStartSnapState,
	type CanvasPathTool,
	appendCanvasPathPreviewPoint,
	buildCanvasDrawingElement,
	commitCanvasPathPoint,
	dedupeCanvasPathPoints,
	getCanvasPathStartSnapState,
} from "@skedra/canvas-core";

export const CANVAS_PATH_DRAW_MODE_OPTIONS = ["normal", "multi"] as const;
export const CANVAS_PATH_MODE_OPTIONS = ["straight", "curve"] as const;
export type CanvasPathModeOption = (typeof CANVAS_PATH_MODE_OPTIONS)[number];

/** Elbow remains readable for old documents but is no longer a creation mode. */
export function resolveCanvasEditorPathMode(
	mode: ArrowMode | null | undefined,
): CanvasPathModeOption {
	return mode === "curve" ? "curve" : "straight";
}

export function isCanvasMultiPathTool(
	tool: string,
	drawMode: CanvasPathDrawMode,
): boolean {
	return drawMode === "multi" && (tool === "line" || tool === "arrow");
}

export function shouldFinishCanvasMultiPathOnContextMenu(
	tool: string,
	drawMode: CanvasPathDrawMode,
	pathActive: boolean,
): boolean {
	return pathActive && isCanvasMultiPathTool(tool, drawMode);
}

export interface CanvasPathPointerPosition {
	raw: CanvasPathPoint;
	snapped: CanvasPathPoint;
	zoom: number;
}

export interface CanvasPathEditorFrame {
	preview: CanvasElement | null;
	startSnap: CanvasPathStartSnapState | null;
}

export type CanvasPathEditorOutcome =
	| ({ kind: "idle" } & CanvasPathEditorFrame)
	| ({ kind: "draft" } & CanvasPathEditorFrame)
	| ({ kind: "cancelled" } & CanvasPathEditorFrame)
	| ({ kind: "complete"; element: CanvasElement } & CanvasPathEditorFrame);

function buildPathElement(
	draft: CanvasPathDraftState,
	points: CanvasPathPoint[],
	style: CanvasDrawingStyle,
	closed = false,
) {
	const first = points[0] ?? [0, 0];
	return buildCanvasDrawingElement({
		id: "__path-editor-draft",
		tool: draft.tool,
		start: { x: first[0], y: first[1] },
		points: points.map(([x, y]) => ({ x, y })),
		closed,
		style,
	});
}

/**
 * Shared path gesture state machine for every Skedra React surface. It owns all
 * multi-line decisions; consumers only adapt persistence, selection, and undo.
 */
export class CanvasPathEditorController {
	private draft: CanvasPathDraftState | null = null;

	getDraft(): CanvasPathDraftState | null {
		return this.draft;
	}

	isActive(): boolean {
		return this.draft !== null;
	}

	begin(
		tool: CanvasPathTool,
		point: CanvasPathPoint,
		style: CanvasDrawingStyle,
	): CanvasPathEditorOutcome {
		if (!this.draft || this.draft.tool !== tool) {
			this.draft = { tool, points: [point] };
		}
		const tail = this.draft.points[this.draft.points.length - 1] ?? point;
		return {
			kind: "draft",
			preview: buildPathElement(
				this.draft,
				appendCanvasPathPreviewPoint(this.draft.points, tail, style.arrowMode),
				style,
			),
			startSnap: null,
		};
	}

	move(
		pointer: CanvasPathPointerPosition,
		style: CanvasDrawingStyle,
	): CanvasPathEditorOutcome {
		if (!this.draft) return { kind: "idle", preview: null, startSnap: null };
		const startSnap = getCanvasPathStartSnapState(
			this.draft,
			{ x: pointer.raw[0], y: pointer.raw[1] },
			pointer.zoom,
		);
		const hoverPoint = startSnap?.active ? startSnap.point : pointer.snapped;
		return {
			kind: "draft",
			preview: buildPathElement(
				this.draft,
				appendCanvasPathPreviewPoint(
					this.draft.points,
					hoverPoint,
					style.arrowMode,
				),
				style,
			),
			startSnap,
		};
	}

	release(
		pointer: CanvasPathPointerPosition,
		style: CanvasDrawingStyle,
	): CanvasPathEditorOutcome {
		if (!this.draft) return { kind: "idle", preview: null, startSnap: null };
		const startSnap = getCanvasPathStartSnapState(
			this.draft,
			{ x: pointer.raw[0], y: pointer.raw[1] },
			pointer.zoom,
		);
		if (startSnap?.active) return this.finish(style, true);

		this.draft = {
			...this.draft,
			points: commitCanvasPathPoint(
				this.draft.points,
				pointer.snapped,
				style.arrowMode,
			),
		};
		const tail =
			this.draft.points[this.draft.points.length - 1] ?? pointer.snapped;
		return {
			kind: "draft",
			preview: buildPathElement(
				this.draft,
				appendCanvasPathPreviewPoint(this.draft.points, tail, style.arrowMode),
				style,
			),
			startSnap: null,
		};
	}

	finish(style: CanvasDrawingStyle, closed = false): CanvasPathEditorOutcome {
		if (!this.draft) return { kind: "idle", preview: null, startSnap: null };
		const draft = this.draft;
		this.draft = null;
		const points = dedupeCanvasPathPoints(draft.points);
		if (points.length < 2) {
			return { kind: "cancelled", preview: null, startSnap: null };
		}
		return {
			kind: "complete",
			element: buildPathElement(
				draft,
				points,
				style,
				closed && draft.tool === "line" && points.length >= 3,
			),
			preview: null,
			startSnap: null,
		};
	}

	cancel(): CanvasPathEditorOutcome {
		this.draft = null;
		return { kind: "cancelled", preview: null, startSnap: null };
	}
}
