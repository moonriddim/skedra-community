import type {
	CanvasDrawingStyle,
	CanvasElement,
	CanvasPathDrawMode,
	CanvasPathPoint,
	CanvasPathStartSnapState,
	CanvasPathTool,
	ToolType,
} from "@skedra/canvas-core";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	CanvasPathEditorController,
	type CanvasPathEditorFrame,
	type CanvasPathEditorOutcome,
	type CanvasPathPointerPosition,
	isCanvasMultiPathTool,
} from "./path-editor-controller";

export interface CanvasPathEditorAdapter {
	getStyle: () => CanvasDrawingStyle;
	commitElement: (element: CanvasElement) => string;
	setPreview: (element: CanvasElement | null) => void;
	onStartSnapChange?: (snap: CanvasPathStartSnapState | null) => void;
	onBeginHistory?: () => void;
	onFinishHistory?: () => void;
	onCancelHistory?: () => void;
	onCreatedSelection?: (id: string) => void;
	onClearSelection?: () => void;
	onExitTool?: () => void;
}

export interface UseCanvasPathEditorOptions {
	activeTool: ToolType | string;
	drawMode: CanvasPathDrawMode;
	adapter: CanvasPathEditorAdapter;
}

export interface CanvasPathFinishOptions {
	closed?: boolean;
	selectCreated?: boolean;
}

export function useCanvasPathEditor({
	activeTool,
	drawMode,
	adapter,
}: UseCanvasPathEditorOptions) {
	const controllerRef = useRef(new CanvasPathEditorController());
	const adapterRef = useRef(adapter);
	adapterRef.current = adapter;
	const [startSnap, setStartSnap] = useState<CanvasPathStartSnapState | null>(
		null,
	);

	const applyFrame = useCallback((frame: CanvasPathEditorFrame) => {
		const currentAdapter = adapterRef.current;
		currentAdapter.setPreview(frame.preview);
		setStartSnap(frame.startSnap);
		currentAdapter.onStartSnapChange?.(frame.startSnap);
	}, []);

	const applyOutcome = useCallback(
		(outcome: CanvasPathEditorOutcome, selectCreated = false) => {
			applyFrame(outcome);
			if (outcome.kind === "complete") {
				const currentAdapter = adapterRef.current;
				const id = currentAdapter.commitElement(outcome.element);
				if (selectCreated) currentAdapter.onCreatedSelection?.(id);
				else currentAdapter.onClearSelection?.();
				currentAdapter.onFinishHistory?.();
				currentAdapter.onExitTool?.();
				return true;
			}
			if (outcome.kind === "cancelled") {
				adapterRef.current.onCancelHistory?.();
				return true;
			}
			return false;
		},
		[applyFrame],
	);

	const begin = useCallback(
		(tool: CanvasPathTool, point: CanvasPathPoint) => {
			const controller = controllerRef.current;
			if (!controller.isActive()) adapterRef.current.onBeginHistory?.();
			applyFrame(controller.begin(tool, point, adapterRef.current.getStyle()));
		},
		[applyFrame],
	);

	const move = useCallback(
		(pointer: CanvasPathPointerPosition) => {
			applyFrame(
				controllerRef.current.move(pointer, adapterRef.current.getStyle()),
			);
		},
		[applyFrame],
	);

	const release = useCallback(
		(pointer: CanvasPathPointerPosition, selectCreated = true) =>
			applyOutcome(
				controllerRef.current.release(pointer, adapterRef.current.getStyle()),
				selectCreated,
			),
		[applyOutcome],
	);

	const finish = useCallback(
		(options: CanvasPathFinishOptions = {}) =>
			applyOutcome(
				controllerRef.current.finish(
					adapterRef.current.getStyle(),
					options.closed,
				),
				options.selectCreated,
			),
		[applyOutcome],
	);

	const cancel = useCallback(() => {
		if (!controllerRef.current.isActive()) return false;
		return applyOutcome(controllerRef.current.cancel());
	}, [applyOutcome]);

	useEffect(() => {
		if (!isCanvasMultiPathTool(activeTool, drawMode)) cancel();
	}, [activeTool, cancel, drawMode]);

	return {
		controllerRef,
		startSnap,
		begin,
		move,
		release,
		finish,
		cancel,
	};
}
