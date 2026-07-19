import type {
	KeyboardEvent as ReactKeyboardEvent,
	PointerEvent as ReactPointerEvent,
} from "react";

const TOOLBAR_INTERACTIVE_SELECTOR = '[data-canvas-toolbar-interactive="true"]';
const MAGNIFICATION_RADIUS = 72;
const MAX_MAGNIFICATION = 0.23;
const MAX_LIFT_PX = 2;

export interface CanvasEditorToolbarMagnification {
	scale: number;
	lift: number;
}

/** Smooth, bounded proximity curve used by both horizontal canvas toolbars. */
export function resolveCanvasEditorToolbarMagnification(
	distance: number,
): CanvasEditorToolbarMagnification {
	const normalized = Math.max(
		0,
		Math.min(1, 1 - Math.max(0, distance) / MAGNIFICATION_RADIUS),
	);
	const influence = normalized * normalized * (3 - 2 * normalized);
	return {
		scale: 1 + MAX_MAGNIFICATION * influence,
		lift: influence === 0 ? 0 : -MAX_LIFT_PX * influence,
	};
}

function isReducedMotionPreferred() {
	return (
		typeof window !== "undefined" &&
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
	);
}

function getInteractiveTarget(target: EventTarget | null, root: HTMLElement) {
	if (!(target instanceof Element)) return null;
	const interactive = target.closest<HTMLElement>(TOOLBAR_INTERACTIVE_SELECTOR);
	if (
		!interactive ||
		!root.contains(interactive) ||
		interactive.matches(":disabled") ||
		interactive.getAttribute("aria-disabled") === "true"
	) {
		return null;
	}
	return interactive;
}

function resetCanvasEditorToolbarMagnification(root: HTMLElement) {
	for (const item of root.querySelectorAll<HTMLElement>(
		TOOLBAR_INTERACTIVE_SELECTOR,
	)) {
		item.style.removeProperty("--canvas-editor-toolbar-scale");
		item.style.removeProperty("--canvas-editor-toolbar-lift");
	}
}

function updateCanvasEditorToolbarMagnification(
	root: HTMLElement,
	clientX: number,
	clientY: number,
) {
	if (isReducedMotionPreferred()) return;
	for (const item of root.querySelectorAll<HTMLElement>(
		TOOLBAR_INTERACTIVE_SELECTOR,
	)) {
		if (item.matches(":disabled")) {
			item.style.removeProperty("--canvas-editor-toolbar-scale");
			item.style.removeProperty("--canvas-editor-toolbar-lift");
			continue;
		}
		const rect = item.getBoundingClientRect();
		const distance = Math.hypot(
			clientX - (rect.left + rect.width / 2),
			clientY - (rect.top + rect.height / 2),
		);
		const magnification = resolveCanvasEditorToolbarMagnification(distance);
		item.style.setProperty(
			"--canvas-editor-toolbar-scale",
			magnification.scale.toFixed(3),
		);
		item.style.setProperty(
			"--canvas-editor-toolbar-lift",
			`${magnification.lift.toFixed(2)}px`,
		);
	}
}

function triggerCanvasEditorToolbarHaptic() {
	if (
		typeof navigator === "undefined" ||
		isReducedMotionPreferred() ||
		typeof navigator.vibrate !== "function"
	) {
		return;
	}
	try {
		navigator.vibrate(8);
	} catch {
		// Vibration support is optional and may be blocked by the host browser.
	}
}

export function handleCanvasEditorToolbarPointerMove(
	event: ReactPointerEvent<HTMLElement>,
) {
	if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
	updateCanvasEditorToolbarMagnification(
		event.currentTarget,
		event.clientX,
		event.clientY,
	);
}

export function handleCanvasEditorToolbarPointerLeave(
	event: ReactPointerEvent<HTMLElement>,
) {
	resetCanvasEditorToolbarMagnification(event.currentTarget);
}

export function handleCanvasEditorToolbarPointerDown(
	event: ReactPointerEvent<HTMLElement>,
) {
	if (event.button !== 0) return;
	if (!getInteractiveTarget(event.target, event.currentTarget)) return;
	triggerCanvasEditorToolbarHaptic();
}

export function handleCanvasEditorToolbarKeyDown(
	event: ReactKeyboardEvent<HTMLElement>,
) {
	if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
	if (!getInteractiveTarget(event.target, event.currentTarget)) return;
	triggerCanvasEditorToolbarHaptic();
}
