/**
 * Enter-Aktionen, Leertaste (Pan) und Werkzeug-Tasten.
 */

import { isTextEditableElement } from "@/components/canvas/hooks/use-canvas-text-editing";
import { isFlowchartNode, isMindmapNode } from "@skedra/canvas-core";
import type { CanvasKeyDownContext } from "./context";
import { getKeyModifiers } from "./context";

export function tryHandleEnterAndSpace(
	e: KeyboardEvent,
	ctx: CanvasKeyDownContext,
): boolean {
	const { ctrl, shift, alt } = getKeyModifiers(e);
	const { store, ops, actions } = ctx;

	if (!ctrl && !alt && !shift && e.key === "Enter") {
		const selected = ops.getSelected();
		if (selected.length === 1 && selected[0].type === "image") {
			e.preventDefault();
			actions?.startImageCrop?.();
			return true;
		}
		if (selected.length === 1 && isTextEditableElement(selected[0])) {
			e.preventDefault();
			ops.startEditingSelection();
			return true;
		}
		if (selected.length === 1) {
			const el = selected[0];
			if (isFlowchartNode(el)) {
				e.preventDefault();
				actions?.flowchartCreateDefaultStep?.(el.id);
				return true;
			}
			if (isMindmapNode(el)) {
				e.preventDefault();
				actions?.mindmapCreateSibling?.(el.id);
				return true;
			}
		}
	}

	if (!ctrl && !alt && e.key === " " && !shift) {
		const targetTag = (e.target as HTMLElement).tagName;
		if (
			targetTag !== "INPUT" &&
			targetTag !== "TEXTAREA" &&
			targetTag !== "SELECT"
		) {
			e.preventDefault();
			store.setSpacePressed(true);
		}
		return true;
	}

	return false;
}

export function tryHandleToolKeys(
	e: KeyboardEvent,
	ctx: CanvasKeyDownContext,
): boolean {
	const { ctrl, shift, alt } = getKeyModifiers(e);
	const { store } = ctx;

	if (ctrl || alt || shift) return false;

	switch (e.key) {
		case "1":
		case "v":
			store.setActiveTool("select");
			return true;
		case "2":
		case "r":
			store.setActiveTool("rectangle");
			return true;
		case "3":
		case "d":
			store.setActiveTool("diamond");
			return true;
		case "4":
		case "o":
			store.setActiveTool("ellipse");
			return true;
		case "5":
		case "a":
			store.setActiveTool("arrow");
			return true;
		case "6":
		case "l":
			store.setActiveTool("line");
			return true;
		case "7":
		case "p":
			store.setActiveTool("freehand");
			return true;
		case "8":
		case "t":
			store.setActiveTool("text");
			return true;
		case "0":
		case "e":
			store.setActiveTool("eraser");
			return true;
		case "k":
			store.setActiveTool("laser");
			return true;
		case "i":
			store.activateEyedropper("stroke");
			return true;
		case "h":
			store.setActiveTool("pan");
			return true;
		case "f":
			store.setActiveTool("frame");
			return true;
		case "q":
			store.toggleToolLocked();
			return true;
		default:
			return false;
	}
}
