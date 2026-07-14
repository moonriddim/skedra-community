import { getCanvasKeyboardCommand } from "@skedra/canvas-core";
import { useEffect, useRef } from "react";
import {
	type CanvasEditorKeyboardAction,
	resolveCanvasEditorKeyboardAction,
} from "./editor-contract";

export interface CanvasEditorKeyboardState {
	enabled: boolean;
	readOnly: boolean;
	editingText: boolean;
	hasSelection: boolean;
}

export type CanvasEditorResolvedKeyboardCommand = NonNullable<
	ReturnType<typeof getCanvasKeyboardCommand>
>;

export interface CanvasEditorKeyboardAdapter {
	getState: () => CanvasEditorKeyboardState;
	onEditorAction: (
		action: Exclude<CanvasEditorKeyboardAction, { type: "temporary-pan" }>,
		event: KeyboardEvent,
	) => boolean | undefined;
	onCommand: (
		command: CanvasEditorResolvedKeyboardCommand,
		event: KeyboardEvent,
	) => boolean | undefined;
	setTemporaryPan: (pressed: boolean) => void;
	onUnhandledKeyDown?: (event: KeyboardEvent) => boolean | undefined;
}

export function handleCanvasEditorTemporaryPanKeyDown(
	event: Pick<KeyboardEvent, "preventDefault" | "repeat">,
	setTemporaryPan: (pressed: boolean) => void,
) {
	event.preventDefault();
	if (!event.repeat) setTemporaryPan(true);
}

function isEditableTarget(target: EventTarget | null): boolean {
	return (
		target instanceof Element &&
		target.closest("input, textarea, select, [contenteditable='true']") != null
	);
}

/** One browser keyboard pipeline shared by Community and the React SDK. */
export function useCanvasEditorKeyboard(adapter: CanvasEditorKeyboardAdapter) {
	const adapterRef = useRef(adapter);
	adapterRef.current = adapter;

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const current = adapterRef.current;
			const state = current.getState();
			if (
				!state.enabled ||
				state.editingText ||
				isEditableTarget(event.target)
			) {
				return;
			}

			const action = resolveCanvasEditorKeyboardAction(event, {
				hasSelection: state.hasSelection,
			});
			if (action?.type === "temporary-pan") {
				handleCanvasEditorTemporaryPanKeyDown(event, current.setTemporaryPan);
				return;
			}
			if (action) {
				if (state.readOnly && action.type !== "tool") return;
				const handled = current.onEditorAction(action, event);
				if (handled !== false) {
					event.preventDefault();
					return;
				}
			}

			const command = getCanvasKeyboardCommand(event);
			if (command) {
				if (
					state.readOnly &&
					command !== "select-all" &&
					command !== "escape"
				) {
					return;
				}
				const handled = current.onCommand(command, event);
				if (handled !== false) event.preventDefault();
				return;
			}

			if (current.onUnhandledKeyDown?.(event) === true) {
				event.preventDefault();
			}
		};

		const handleKeyUp = (event: KeyboardEvent) => {
			if (event.key === " ") adapterRef.current.setTemporaryPan(false);
		};
		const clearTemporaryPan = () => adapterRef.current.setTemporaryPan(false);

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		window.addEventListener("blur", clearTemporaryPan);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
			window.removeEventListener("blur", clearTemporaryPan);
			clearTemporaryPan();
		};
	}, []);
}
