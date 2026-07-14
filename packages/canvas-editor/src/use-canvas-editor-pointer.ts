import {
	type CanvasDrawingStyle,
	type CanvasDrawingTool,
	type CanvasElement,
	type CanvasPathDrawMode,
	type CanvasScene,
	type HandlePosition,
	type SnapGuide,
	type SnapPointIndicator,
	type Viewport,
	collectCanvasSelectionRectIds,
	isLassoPathLargeEnough,
	isMultiSelectModifier,
	resizeCanvasElement,
	shouldKeepCanvasDrawing,
	zoomCanvasViewportAtPoint,
} from "@skedra/canvas-core";
import {
	type Dispatch,
	type PointerEvent as ReactPointerEvent,
	type WheelEvent as ReactWheelEvent,
	type RefObject,
	type SetStateAction,
	useCallback,
	useRef,
	useState,
} from "react";
import { buildCanvasEditorDrawingElement } from "./drawing-preview";
import type { CanvasEditorToolId } from "./editor-contract";
import {
	resolveCanvasEditorMoveGesture,
	resolveCanvasEditorPathPointGesture,
} from "./gesture-operations";
import { isCanvasMultiPathTool } from "./path-editor-controller";
import {
	type CanvasEditorPointerAction,
	type CanvasEditorPointerGestureAction,
	resolveCanvasEditorPointerDown,
	shouldCancelCanvasEditorLostPointerCapture,
} from "./pointer-contract";
import { resolveCanvasEditorSelectPointerDown } from "./selection-pointer-controller";
import { resolveCanvasEditorRectSnap } from "./snap-controller";
import { useCanvasPathEditor } from "./use-canvas-path-editor";

export interface CanvasEditorResolvedPointerPoint {
	raw: { x: number; y: number };
	snapped: { x: number; y: number };
	allowMiddleButtonDraw?: boolean;
}

export interface CanvasEditorTextPlacement {
	x: number;
	y: number;
	width: number;
	height: number;
	stroke: string;
	fontSize: number;
	fontFamily: string;
	textAlign: "left" | "center" | "right";
	fontWeight: "normal" | "bold";
	fontStyle: "normal" | "italic";
	textDecoration: "none" | "underline";
}

export interface CanvasEditorPointerUiState {
	activeTool: CanvasEditorToolId;
	pathDrawMode: CanvasPathDrawMode;
	toolLocked: boolean;
	readOnly: boolean;
	spacePressed: boolean;
	viewport: Viewport;
	selectedIds: Set<string>;
	snapToObjects: boolean;
	selectionBox: {
		startX: number;
		startY: number;
		endX: number;
		endY: number;
	} | null;
	lassoPath: [number, number][] | null;
}

export interface CanvasEditorPointerUiAdapter {
	getState: () => CanvasEditorPointerUiState;
	getStyle: (tool?: CanvasEditorToolId) => CanvasDrawingStyle & {
		fontFamily?: string;
		fontSize?: number;
		textAlign?: "left" | "center" | "right";
		fontWeight?: "normal" | "bold";
		fontStyle?: "normal" | "italic";
		textDecoration?: "none" | "underline";
	};
	getDefaultElementSize?: (
		tool: CanvasEditorToolId,
	) => { width: number; height: number } | null;
	setActiveTool: (tool: CanvasEditorToolId) => void;
	setSelectedIds: (ids: Set<string>) => void;
	clearSelection: () => void;
	pan: (dx: number, dy: number) => void;
	setViewport: (viewport: Viewport) => void;
	setSelectionBox: (box: CanvasEditorPointerUiState["selectionBox"]) => void;
	setLassoPath: (path: [number, number][] | null) => void;
	setSnapVisuals?: (guides: SnapGuide[], points?: SnapPointIndicator[]) => void;
	setEyedropperColors?: (colors: { stroke: string; fill: string }) => void;
	beginLaser?: (point: { x: number; y: number }) => string | null;
	appendLaser?: (id: string, point: { x: number; y: number }) => void;
	finishLaser?: (id: string) => void;
}

export interface CanvasEditorDocumentAdapter {
	kind: string;
	getElements: () => Map<string, CanvasElement>;
	getScene: () => CanvasScene;
	createId: () => string;
	createElement: (element: CanvasElement) => void;
	updateElement: (id: string, changes: Partial<CanvasElement>) => void;
	updateElements: (
		updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
	) => void;
	deleteElements?: (ids: string[]) => void;
	duplicateSelection?: () => void;
	beginHistory?: () => void;
	finishHistory?: () => void;
	cancelHistory?: () => void;
	finishMove?: (moveStart: Map<string, { x: number; y: number }>) => void;
}

export interface CanvasEditorPointerPlacementContext {
	action: Extract<
		CanvasEditorPointerAction,
		"insert-sticky-note" | "insert-kanban" | "insert-mindmap"
	>;
	point: { x: number; y: number };
	event: ReactPointerEvent<SVGSVGElement>;
}

export interface UseCanvasEditorPointerOptions {
	svgRef: RefObject<SVGSVGElement | null>;
	activeTool: CanvasEditorToolId;
	pathDrawMode: CanvasPathDrawMode;
	documentAdapter: CanvasEditorDocumentAdapter;
	uiAdapter: CanvasEditorPointerUiAdapter;
	resolvePoint: (
		clientX: number,
		clientY: number,
		options?: { forceAnchor?: boolean },
	) => CanvasEditorResolvedPointerPoint;
	startTextPlacement: (placement: CanvasEditorTextPlacement) => void;
	onPlacement?: (context: CanvasEditorPointerPlacementContext) => boolean;
	onBeforePointerDown?: (
		point: CanvasEditorResolvedPointerPoint,
		event: ReactPointerEvent<SVGSVGElement>,
	) => boolean;
	onIdlePointerMove?: (
		point: CanvasEditorResolvedPointerPoint,
		event: ReactPointerEvent<SVGSVGElement>,
	) => boolean;
	onGestureFinished?: () => void;
}

interface PointerState {
	action: CanvasEditorPointerGestureAction;
	startScreenX: number;
	startScreenY: number;
	startCanvasX: number;
	startCanvasY: number;
	freehandPoints: [number, number][];
	moveStart: Map<string, { x: number; y: number }>;
	resizeHandle: HandlePosition | null;
	resizeStart: CanvasElement | null;
	dragPointElementId: string | null;
	dragPointIndex: number;
	drawFromCenter: boolean;
	erasedIds: Set<string>;
	laserId: string | null;
	lassoPath: [number, number][];
}

const INITIAL_POINTER_STATE: PointerState = {
	action: "none",
	startScreenX: 0,
	startScreenY: 0,
	startCanvasX: 0,
	startCanvasY: 0,
	freehandPoints: [],
	moveStart: new Map(),
	resizeHandle: null,
	resizeStart: null,
	dragPointElementId: null,
	dragPointIndex: -1,
	drawFromCenter: false,
	erasedIds: new Set(),
	laserId: null,
	lassoPath: [],
};

const DEFAULT_FONT = "system-ui, sans-serif";

export function useCanvasEditorPointer({
	svgRef,
	activeTool,
	pathDrawMode,
	documentAdapter,
	uiAdapter,
	resolvePoint,
	startTextPlacement,
	onPlacement,
	onBeforePointerDown,
	onIdlePointerMove,
	onGestureFinished,
}: UseCanvasEditorPointerOptions) {
	const stateRef = useRef<PointerState>({ ...INITIAL_POINTER_STATE });
	const [drawingPreview, setDrawingPreviewState] =
		useState<CanvasElement | null>(null);
	const drawingPreviewRef = useRef<CanvasElement | null>(null);
	const setDrawingPreview = useCallback<
		Dispatch<SetStateAction<CanvasElement | null>>
	>((next) => {
		const value =
			typeof next === "function" ? next(drawingPreviewRef.current) : next;
		drawingPreviewRef.current = value;
		setDrawingPreviewState(value);
	}, []);

	const clearSnapVisuals = useCallback(
		() => uiAdapter.setSnapVisuals?.([], []),
		[uiAdapter],
	);

	const finishGesture = useCallback(
		(commitHistory: boolean) => {
			const state = stateRef.current;
			if (state.action === "laser" && state.laserId) {
				uiAdapter.finishLaser?.(state.laserId);
			}
			if (commitHistory) documentAdapter.finishHistory?.();
			stateRef.current = { ...INITIAL_POINTER_STATE };
			uiAdapter.setSelectionBox(null);
			uiAdapter.setLassoPath(null);
			clearSnapVisuals();
			onGestureFinished?.();
		},
		[clearSnapVisuals, documentAdapter, onGestureFinished, uiAdapter],
	);

	const {
		controllerRef: pathEditorRef,
		startSnap: pathStartSnap,
		begin: beginPath,
		move: movePath,
		release: releasePath,
		finish: finishPath,
		cancel: cancelPath,
	} = useCanvasPathEditor({
		activeTool,
		drawMode: pathDrawMode,
		adapter: {
			getStyle: uiAdapter.getStyle,
			commitElement: (element) => {
				const id = documentAdapter.createId();
				documentAdapter.createElement({ ...element, id });
				return id;
			},
			setPreview: setDrawingPreview,
			onBeginHistory: documentAdapter.beginHistory,
			onFinishHistory: documentAdapter.finishHistory,
			onCancelHistory: documentAdapter.cancelHistory,
			onCreatedSelection: (id) => uiAdapter.setSelectedIds(new Set([id])),
			onClearSelection: uiAdapter.clearSelection,
			onExitTool: () => {
				if (!uiAdapter.getState().toolLocked) uiAdapter.setActiveTool("select");
			},
		},
	});

	const eraseAtPoint = useCallback(
		(point: { x: number; y: number }) => {
			if (!documentAdapter.deleteElements) return;
			const state = stateRef.current;
			const zoom = Math.max(uiAdapter.getState().viewport.zoom, 0.01);
			const ids = documentAdapter
				.getScene()
				.getElementsToEraseAtPosition(
					point.x,
					point.y,
					18 / zoom,
					state.erasedIds,
				)
				.map((element) => element.id);
			if (ids.length === 0) return;
			for (const id of ids) state.erasedIds.add(id);
			documentAdapter.deleteElements(ids);
		},
		[documentAdapter, uiAdapter],
	);

	const onPointerDown = useCallback(
		(event: ReactPointerEvent<SVGSVGElement>) => {
			const ui = uiAdapter.getState();
			const middle =
				event.button === 1
					? resolvePoint(event.clientX, event.clientY, { forceAnchor: true })
					: null;
			const pointerAction = resolveCanvasEditorPointerDown({
				tool: ui.activeTool,
				button: event.button,
				altKey: event.altKey,
				spacePressed: ui.spacePressed,
				readOnly: ui.readOnly,
				pathDrawMode: ui.pathDrawMode,
				allowMiddleButtonDraw: middle?.allowMiddleButtonDraw,
			});
			if (pointerAction === "ignore") return;

			if (pointerAction === "pan") {
				event.preventDefault();
				stateRef.current = {
					...INITIAL_POINTER_STATE,
					action: "pan",
					startScreenX: event.clientX,
					startScreenY: event.clientY,
				};
				event.currentTarget.setPointerCapture(event.pointerId);
				return;
			}

			const point =
				middle ?? resolvePoint(event.clientX, event.clientY, undefined);
			if (
				event.button === 0 &&
				!ui.readOnly &&
				onBeforePointerDown?.(point, event)
			) {
				return;
			}
			stateRef.current = {
				...INITIAL_POINTER_STATE,
				startScreenX: event.clientX,
				startScreenY: event.clientY,
				startCanvasX: point.snapped.x,
				startCanvasY: point.snapped.y,
				drawFromCenter: ui.activeTool === "ellipse",
			};

			if (
				pointerAction === "insert-sticky-note" ||
				pointerAction === "insert-kanban" ||
				pointerAction === "insert-mindmap"
			) {
				onPlacement?.({ action: pointerAction, point: point.snapped, event });
				return;
			}

			if (pointerAction === "erase") {
				documentAdapter.beginHistory?.();
				stateRef.current.action = "erase";
				eraseAtPoint(point.snapped);
				event.currentTarget.setPointerCapture(event.pointerId);
				return;
			}
			if (pointerAction === "laser") {
				stateRef.current.action = "laser";
				stateRef.current.laserId = uiAdapter.beginLaser?.(point.raw) ?? null;
				event.currentTarget.setPointerCapture(event.pointerId);
				return;
			}
			if (pointerAction === "eyedropper") {
				const hit = documentAdapter
					.getScene()
					.getElementAtPosition(point.raw.x, point.raw.y);
				if (hit)
					uiAdapter.setEyedropperColors?.({
						stroke: hit.stroke,
						fill: hit.fill,
					});
				uiAdapter.setActiveTool("select");
				return;
			}

			if (pointerAction === "select" || pointerAction === "lasso") {
				const result = resolveCanvasEditorSelectPointerDown({
					e: event,
					tool: ui.activeTool,
					canvas: point.raw,
					elements: documentAdapter.getElements(),
					scene: documentAdapter.getScene(),
					selectedIds: ui.selectedIds,
					getSelectedIds: () => uiAdapter.getState().selectedIds,
					readOnly: ui.readOnly,
					updateElement: documentAdapter.updateElement,
					duplicateSelection: documentAdapter.duplicateSelection,
					setSelectedIds: uiAdapter.setSelectedIds,
					setSelectionBox: uiAdapter.setSelectionBox,
					setLassoPath: uiAdapter.setLassoPath,
				});
				if (!result.handled || "earlyExit" in result) return;
				Object.assign(stateRef.current, result.patch);
				if (result.action === "move") documentAdapter.beginHistory?.();
				event.currentTarget.setPointerCapture(event.pointerId);
				return;
			}

			if (pointerAction === "path") {
				beginPath(ui.activeTool as "line" | "arrow", [
					point.snapped.x,
					point.snapped.y,
				]);
				stateRef.current.action = "draw";
				event.currentTarget.setPointerCapture(event.pointerId);
				return;
			}
			if (pointerAction !== "draw" && pointerAction !== "text") return;

			if (ui.activeTool !== "text") documentAdapter.beginHistory?.();
			stateRef.current.action = "draw";
			if (ui.activeTool === "freehand")
				stateRef.current.freehandPoints = [[0, 0]];
			setDrawingPreview(
				buildCanvasEditorDrawingElement({
					id: "__preview",
					tool: (ui.activeTool === "text"
						? "rectangle"
						: ui.activeTool) as CanvasDrawingTool,
					start: point.snapped,
					end: point.snapped,
					points: ui.activeTool === "freehand" ? [point.snapped] : undefined,
					style: {
						...uiAdapter.getStyle(ui.activeTool),
						fill:
							ui.activeTool === "text"
								? "transparent"
								: uiAdapter.getStyle(ui.activeTool).fill,
					},
				}),
			);
			event.currentTarget.setPointerCapture(event.pointerId);
		},
		[
			beginPath,
			documentAdapter,
			eraseAtPoint,
			onBeforePointerDown,
			onPlacement,
			resolvePoint,
			setDrawingPreview,
			uiAdapter,
		],
	);

	const onPointerMove = useCallback(
		(event: ReactPointerEvent<SVGSVGElement>) => {
			const ui = uiAdapter.getState();
			const state = stateRef.current;
			const point = resolvePoint(event.clientX, event.clientY);
			if (
				isCanvasMultiPathTool(ui.activeTool, ui.pathDrawMode) &&
				pathEditorRef.current.isActive()
			) {
				movePath({
					raw: [point.raw.x, point.raw.y],
					snapped: [point.snapped.x, point.snapped.y],
					zoom: ui.viewport.zoom,
				});
				if (state.action !== "pan") return;
			}
			if (state.action === "none") {
				onIdlePointerMove?.(point, event);
				return;
			}
			if (state.action === "pan") {
				uiAdapter.pan(
					event.clientX - state.startScreenX,
					event.clientY - state.startScreenY,
				);
				state.startScreenX = event.clientX;
				state.startScreenY = event.clientY;
				return;
			}
			if (state.action === "erase") {
				eraseAtPoint(point.snapped);
				return;
			}
			if (state.action === "laser" && state.laserId) {
				uiAdapter.appendLaser?.(state.laserId, point.raw);
				return;
			}
			if (state.action === "select-box") {
				uiAdapter.setSelectionBox({
					startX: state.startCanvasX,
					startY: state.startCanvasY,
					endX: point.raw.x,
					endY: point.raw.y,
				});
				return;
			}
			if (state.action === "select-lasso") {
				const path =
					state.lassoPath.length > 0 ? state.lassoPath : (ui.lassoPath ?? []);
				const last = path.at(-1);
				if (
					!last ||
					Math.hypot(point.raw.x - last[0], point.raw.y - last[1]) >=
						2 / Math.max(ui.viewport.zoom, 0.01)
				) {
					state.lassoPath = [...path, [point.raw.x, point.raw.y]];
					uiAdapter.setLassoPath(state.lassoPath);
				}
				return;
			}
			if (state.action === "move") {
				const result = resolveCanvasEditorMoveGesture({
					elements: documentAdapter.getElements(),
					moveStart: state.moveStart,
					selectedIds: ui.selectedIds,
					start: { x: state.startCanvasX, y: state.startCanvasY },
					current: point.snapped,
					snapToObjects: ui.snapToObjects,
				});
				documentAdapter.updateElements(result.updates);
				uiAdapter.setSnapVisuals?.(result.guides);
				return;
			}
			if (
				state.action === "drag-point" &&
				state.dragPointElementId &&
				state.dragPointIndex >= 0
			) {
				const result = resolveCanvasEditorPathPointGesture({
					elements: documentAdapter.getElements(),
					elementId: state.dragPointElementId,
					pointIndex: state.dragPointIndex,
					pointStart: state.resizeStart?.points?.[state.dragPointIndex] ?? [
						0, 0,
					],
					start: { x: state.startCanvasX, y: state.startCanvasY },
					current: point.snapped,
					snapToObjects: ui.snapToObjects,
				});
				if (result.update) {
					documentAdapter.updateElement(
						result.update.id,
						result.update.changes,
					);
				}
				uiAdapter.setSnapVisuals?.(result.guides);
				return;
			}
			if (
				state.action === "resize" &&
				state.resizeStart &&
				state.resizeHandle
			) {
				const start = state.resizeStart;
				documentAdapter.updateElement(
					start.id,
					resizeCanvasElement(
						{
							x: start.x,
							y: start.y,
							width: start.width,
							height: start.height,
						},
						state.resizeHandle,
						point.snapped.x - state.startCanvasX,
						point.snapped.y - state.startCanvasY,
					),
				);
				return;
			}
			if (state.action !== "draw") return;

			if (ui.activeTool === "freehand") {
				state.freehandPoints.push([
					point.raw.x - state.startCanvasX,
					point.raw.y - state.startCanvasY,
				]);
				setDrawingPreview((preview) =>
					preview ? { ...preview, points: [...state.freehandPoints] } : null,
				);
				return;
			}
			if (ui.activeTool === "line" || ui.activeTool === "arrow") {
				setDrawingPreview(
					buildCanvasEditorDrawingElement({
						id: "__preview",
						tool: ui.activeTool,
						start: { x: state.startCanvasX, y: state.startCanvasY },
						end: point.snapped,
						style: uiAdapter.getStyle(),
					}),
				);
				return;
			}
			let dx = point.snapped.x - state.startCanvasX;
			let dy = point.snapped.y - state.startCanvasY;
			if (
				event.shiftKey &&
				(ui.activeTool === "rectangle" ||
					ui.activeTool === "ellipse" ||
					ui.activeTool === "diamond")
			) {
				const size = Math.max(Math.abs(dx), Math.abs(dy));
				dx = Math.sign(dx || 1) * size;
				dy = Math.sign(dy || 1) * size;
			}
			const endX = state.startCanvasX + dx;
			const endY = state.startCanvasY + dy;
			let rect = state.drawFromCenter
				? {
						x: state.startCanvasX - Math.abs(dx),
						y: state.startCanvasY - Math.abs(dy),
						width: Math.abs(dx) * 2,
						height: Math.abs(dy) * 2,
					}
				: {
						x: Math.min(state.startCanvasX, endX),
						y: Math.min(state.startCanvasY, endY),
						width: Math.abs(dx),
						height: Math.abs(dy),
					};
			if (ui.snapToObjects) {
				const result = resolveCanvasEditorRectSnap({
					rect,
					elements: documentAdapter.getElements(),
					excludeIds: new Set(["__preview"]),
					snap: { enabled: true },
				});
				rect = result.rect;
				uiAdapter.setSnapVisuals?.(result.guides, result.indicators);
			}
			setDrawingPreview((preview) =>
				preview ? { ...preview, ...rect } : null,
			);
		},
		[
			documentAdapter,
			eraseAtPoint,
			movePath,
			onIdlePointerMove,
			pathEditorRef,
			resolvePoint,
			setDrawingPreview,
			uiAdapter,
		],
	);

	const onPointerUp = useCallback(
		(event: ReactPointerEvent<SVGSVGElement>) => {
			const ui = uiAdapter.getState();
			const state = stateRef.current;
			const point = resolvePoint(event.clientX, event.clientY);
			if (
				state.action === "draw" &&
				isCanvasMultiPathTool(ui.activeTool, ui.pathDrawMode) &&
				pathEditorRef.current.isActive()
			) {
				releasePath(
					{
						raw: [point.raw.x, point.raw.y],
						snapped: [point.snapped.x, point.snapped.y],
						zoom: ui.viewport.zoom,
					},
					true,
				);
				finishGesture(false);
				return;
			}
			if (state.action === "select-box") {
				const box = {
					startX: state.startCanvasX,
					startY: state.startCanvasY,
					endX: point.raw.x,
					endY: point.raw.y,
				};
				const ids = collectCanvasSelectionRectIds(
					documentAdapter.getScene().getElementsMap().values(),
					{ x: box.startX, y: box.startY },
					{ x: box.endX, y: box.endY },
				);
				if (ids.size > 0) {
					const next = isMultiSelectModifier(event)
						? new Set([...ui.selectedIds, ...ids])
						: ids;
					uiAdapter.setSelectedIds(next);
				}
			}
			if (state.action === "select-lasso" && state.lassoPath.length > 0) {
				if (isLassoPathLargeEnough(state.lassoPath)) {
					const ids = new Set(
						documentAdapter
							.getScene()
							.getElementsInLassoPath(state.lassoPath)
							.map((element) => element.id),
					);
					uiAdapter.setSelectedIds(
						isMultiSelectModifier(event)
							? new Set([...ui.selectedIds, ...ids])
							: ids,
					);
				}
			}
			const preview = drawingPreviewRef.current;
			if (state.action === "draw" && preview) {
				const style = uiAdapter.getStyle(ui.activeTool);
				if (ui.activeTool === "text") {
					startTextPlacement({
						x: preview.x,
						y: preview.y,
						width: Math.max(100, preview.width),
						height: Math.max(40, preview.height),
						stroke: style.stroke,
						fontSize: style.fontSize ?? 16,
						fontFamily: style.fontFamily ?? DEFAULT_FONT,
						textAlign: style.textAlign ?? "left",
						fontWeight: style.fontWeight ?? "normal",
						fontStyle: style.fontStyle ?? "normal",
						textDecoration: style.textDecoration ?? "none",
					});
				} else {
					const candidate =
						ui.activeTool === "freehand"
							? { ...preview, points: state.freehandPoints }
							: preview;
					if (shouldKeepCanvasDrawing(candidate)) {
						const id = documentAdapter.createId();
						documentAdapter.createElement({
							...candidate,
							id,
						});
						uiAdapter.setSelectedIds(new Set([id]));
					} else {
						const size = uiAdapter.getDefaultElementSize?.(ui.activeTool);
						if (
							size &&
							(ui.activeTool === "rectangle" ||
								ui.activeTool === "ellipse" ||
								ui.activeTool === "diamond")
						) {
							const id = documentAdapter.createId();
							documentAdapter.createElement({
								...candidate,
								id,
								x: state.startCanvasX - size.width / 2,
								y: state.startCanvasY - size.height / 2,
								width: size.width,
								height: size.height,
							});
							uiAdapter.setSelectedIds(new Set([id]));
						}
					}
				}
				setDrawingPreview(null);
				if (!ui.toolLocked) uiAdapter.setActiveTool("select");
			}
			if (state.action === "move" && state.moveStart.size > 0) {
				documentAdapter.finishMove?.(state.moveStart);
			}
			finishGesture(
				state.action === "move" ||
					(state.action === "draw" && ui.activeTool !== "text") ||
					state.action === "resize" ||
					state.action === "drag-point" ||
					state.action === "erase",
			);
		},
		[
			documentAdapter,
			finishGesture,
			pathEditorRef,
			releasePath,
			resolvePoint,
			setDrawingPreview,
			startTextPlacement,
			uiAdapter,
		],
	);

	const onPointerCancel = useCallback(() => {
		documentAdapter.cancelHistory?.();
		setDrawingPreview(null);
		finishGesture(false);
	}, [documentAdapter, finishGesture, setDrawingPreview]);

	const onLostPointerCapture = useCallback(() => {
		if (!shouldCancelCanvasEditorLostPointerCapture(stateRef.current.action)) {
			return false;
		}
		onPointerCancel();
		return true;
	}, [onPointerCancel]);

	const onWheel = useCallback(
		(event: ReactWheelEvent<SVGSVGElement>) => {
			event.preventDefault();
			const ui = uiAdapter.getState();
			if (event.ctrlKey || event.metaKey) {
				const rect = event.currentTarget.getBoundingClientRect();
				uiAdapter.setViewport(
					zoomCanvasViewportAtPoint(
						ui.viewport,
						{ x: event.clientX - rect.left, y: event.clientY - rect.top },
						ui.viewport.zoom * Math.exp((-event.deltaY / 100) * 0.18),
					),
				);
				return;
			}
			uiAdapter.setViewport({
				...ui.viewport,
				x: ui.viewport.x - event.deltaX,
				y: ui.viewport.y - event.deltaY,
			});
		},
		[uiAdapter],
	);

	const onDoubleClick = useCallback(() => {
		const ui = uiAdapter.getState();
		return isCanvasMultiPathTool(ui.activeTool, ui.pathDrawMode)
			? finishPath()
			: false;
	}, [finishPath, uiAdapter]);

	const beginResize = useCallback(
		(
			event: ReactPointerEvent<SVGElement>,
			element: CanvasElement,
			handle: HandlePosition,
		) => {
			event.stopPropagation();
			if (uiAdapter.getState().readOnly || element.locked) return;
			const point = resolvePoint(event.clientX, event.clientY);
			documentAdapter.beginHistory?.();
			stateRef.current = {
				...INITIAL_POINTER_STATE,
				action: "resize",
				startCanvasX: point.snapped.x,
				startCanvasY: point.snapped.y,
				resizeHandle: handle,
				resizeStart: element,
			};
			svgRef.current?.setPointerCapture(event.pointerId);
		},
		[documentAdapter, resolvePoint, svgRef, uiAdapter],
	);

	const beginPathPointDrag = useCallback(
		(
			event: ReactPointerEvent<SVGElement>,
			element: CanvasElement,
			pointIndex: number,
		) => {
			event.stopPropagation();
			if (uiAdapter.getState().readOnly || element.locked) return;
			const point = resolvePoint(event.clientX, event.clientY);
			documentAdapter.beginHistory?.();
			stateRef.current = {
				...INITIAL_POINTER_STATE,
				action: "drag-point",
				startCanvasX: point.snapped.x,
				startCanvasY: point.snapped.y,
				dragPointElementId: element.id,
				dragPointIndex: pointIndex,
				resizeStart: element,
			};
			svgRef.current?.setPointerCapture(event.pointerId);
		},
		[documentAdapter, resolvePoint, svgRef, uiAdapter],
	);

	return {
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerCancel,
		onLostPointerCapture,
		onWheel,
		onDoubleClick,
		beginResize,
		beginPathPointDrag,
		isPathActive: () => pathEditorRef.current.isActive(),
		finishPath,
		cancelPath,
		drawingPreview,
		pathStartSnap,
	};
}
