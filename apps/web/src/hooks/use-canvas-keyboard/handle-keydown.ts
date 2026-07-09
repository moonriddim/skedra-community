/**
 * Zusammengesetzter Keydown-Handler fuer das Canvas.
 */

import { tryHandleClipboardAndLayer } from "./clipboard-layer";
import type { CanvasKeyDownContext } from "./context";
import { tryHandleFlowchartAndViewport } from "./flowchart-viewport";
import { shouldIgnoreCanvasKeyDown } from "./guards";
import { tryHandleHistoryAndDelete } from "./history-delete";
import { tryHandleEnterAndSpace, tryHandleToolKeys } from "./tools-enter";
import { tryHandleUiShortcuts } from "./ui-shortcuts";

const HANDLERS = [
	tryHandleHistoryAndDelete,
	tryHandleClipboardAndLayer,
	tryHandleFlowchartAndViewport,
	tryHandleUiShortcuts,
	tryHandleEnterAndSpace,
	tryHandleToolKeys,
] as const;

export function handleCanvasKeyDown(
	e: KeyboardEvent,
	ctx: CanvasKeyDownContext,
): void {
	if (shouldIgnoreCanvasKeyDown(e, ctx.store.editingTextId)) return;

	for (const handler of HANDLERS) {
		if (handler(e, ctx)) return;
	}
}
