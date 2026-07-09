/**
 * Flowchart-Pfeile, Ausrichtung, Zoom und Pan.
 */

import type { CanvasKeyDownContext } from "./context";
import { getKeyModifiers } from "./context";

export function tryHandleFlowchartAndViewport(
	e: KeyboardEvent,
	ctx: CanvasKeyDownContext,
): boolean {
	const { ctrl, shift, alt } = getKeyModifiers(e);
	const { store, ops, actions } = ctx;

	if (ctrl && !alt && !shift && e.key === "ArrowRight") {
		e.preventDefault();
		actions?.flowchartCreateStep?.("right");
		return true;
	}
	if (ctrl && !alt && !shift && e.key === "ArrowLeft") {
		e.preventDefault();
		actions?.flowchartCreateStep?.("left");
		return true;
	}
	if (ctrl && !alt && !shift && e.key === "ArrowUp") {
		e.preventDefault();
		actions?.flowchartCreateStep?.("up");
		return true;
	}
	if (ctrl && !alt && !shift && e.key === "ArrowDown") {
		e.preventDefault();
		actions?.flowchartCreateStep?.("down");
		return true;
	}
	if (alt && !ctrl && !shift && e.key === "ArrowRight") {
		e.preventDefault();
		actions?.flowchartNavigate?.("right");
		return true;
	}
	if (alt && !ctrl && !shift && e.key === "ArrowLeft") {
		e.preventDefault();
		actions?.flowchartNavigate?.("left");
		return true;
	}
	if (alt && !ctrl && !shift && e.key === "ArrowUp") {
		e.preventDefault();
		actions?.flowchartNavigate?.("up");
		return true;
	}
	if (alt && !ctrl && !shift && e.key === "ArrowDown") {
		e.preventDefault();
		actions?.flowchartNavigate?.("down");
		return true;
	}

	if (ctrl && shift && e.key === "ArrowUp") {
		e.preventDefault();
		ops.alignSelection("top");
		return true;
	}
	if (ctrl && shift && e.key === "ArrowDown") {
		e.preventDefault();
		ops.alignSelection("bottom");
		return true;
	}
	if (ctrl && shift && e.key === "ArrowLeft") {
		e.preventDefault();
		ops.alignSelection("left");
		return true;
	}
	if (ctrl && shift && e.key === "ArrowRight") {
		e.preventDefault();
		ops.alignSelection("right");
		return true;
	}

	if (ctrl && (e.key === "=" || e.key === "+")) {
		e.preventDefault();
		store.zoomTo(
			store.viewport.zoom * 1.25,
			window.innerWidth / 2,
			window.innerHeight / 2,
		);
		return true;
	}
	if (ctrl && e.key === "-") {
		e.preventDefault();
		store.zoomTo(
			store.viewport.zoom * 0.8,
			window.innerWidth / 2,
			window.innerHeight / 2,
		);
		return true;
	}
	if (ctrl && e.key === "0") {
		e.preventDefault();
		actions?.resetZoom?.();
		return true;
	}
	if (shift && !ctrl && !alt && e.key === "1") {
		e.preventDefault();
		actions?.fitAll?.();
		return true;
	}
	if (shift && !ctrl && !alt && e.key === "2") {
		e.preventDefault();
		actions?.fitSelection?.();
		return true;
	}

	if (e.key === "PageUp" && shift) {
		e.preventDefault();
		store.pan(100, 0);
		return true;
	}
	if (e.key === "PageDown" && shift) {
		e.preventDefault();
		store.pan(-100, 0);
		return true;
	}
	if (e.key === "PageUp") {
		e.preventDefault();
		store.pan(0, 100);
		return true;
	}
	if (e.key === "PageDown") {
		e.preventDefault();
		store.pan(0, -100);
		return true;
	}

	return false;
}
