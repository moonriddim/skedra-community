/**
 * Frame-Mitgliedschaft und Constraints fuer Design-Frames.
 *
 * - Adoption: Elemente, die in einem einfachen Frame abgelegt werden,
 *   erhalten dessen frameId (und verlieren sie beim Herausziehen).
 * - Constraints: steuern, wie Frame-Kinder beim Resize des Frames
 *   mitwandern (Figma-artig: left/right/center/stretch/scale).
 *
 * Alles host-neutral, damit Web-App und SDK identisch reagieren.
 */

import { isPlainCanvasFrame } from "./element-capabilities";
import { getFlowchartConnectorMeta } from "./flowchart";
import { isKanbanCard, isKanbanList } from "./kanban";
import { getMindmapEdgeMeta } from "./mindmap";
import { sortCanvasElements } from "./ordering";
import type { CanvasElement } from "./types";

export interface FrameRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Eine Constraint-Achse: Position relativ zu Frame-Kanten oder skalierend. */
export type FrameConstraintAxis =
	| "start"
	| "end"
	| "center"
	| "stretch"
	| "scale";

export interface FrameConstraints {
	horizontal: FrameConstraintAxis;
	vertical: FrameConstraintAxis;
}

/** Figma-Default: Kinder haengen an der linken/oberen Frame-Kante. */
export const DEFAULT_FRAME_CONSTRAINTS: FrameConstraints = {
	horizontal: "start",
	vertical: "start",
};

const CONSTRAINT_VALUES: ReadonlySet<string> = new Set([
	"start",
	"end",
	"center",
	"stretch",
	"scale",
]);

function normalizeConstraintAxis(value: unknown): FrameConstraintAxis {
	return typeof value === "string" && CONSTRAINT_VALUES.has(value)
		? (value as FrameConstraintAxis)
		: "start";
}

/** Liest die Constraints eines Elements aus customData (mit Defaults). */
export function readFrameConstraints(
	element: Pick<CanvasElement, "customData">,
): FrameConstraints {
	const raw = element.customData?.frameConstraints as
		| { horizontal?: unknown; vertical?: unknown }
		| undefined;
	if (!raw) return DEFAULT_FRAME_CONSTRAINTS;
	return {
		horizontal: normalizeConstraintAxis(raw.horizontal),
		vertical: normalizeConstraintAxis(raw.vertical),
	};
}

/** Schreibt Constraints nach customData (fuer Updates ueber die Panels). */
export function buildFrameConstraintsChange(
	element: Pick<CanvasElement, "customData">,
	constraints: Partial<FrameConstraints>,
): Partial<CanvasElement> {
	const current = readFrameConstraints(element);
	return {
		customData: {
			...(element.customData ?? {}),
			frameConstraints: {
				horizontal: constraints.horizontal ?? current.horizontal,
				vertical: constraints.vertical ?? current.vertical,
			},
		},
	};
}

/**
 * Elemente, deren Frame-Zugehoerigkeit NICHT von der Drop-Adoption verwaltet
 * wird: Frames selbst, Kanban-Karten/-Listen (eigene Reflow-Logik),
 * Verbindungen/Kanten (folgen ihren Knoten) sowie Elemente, deren frameId
 * auf einen Spezial-Frame zeigt (Kanban-Liste, Template-Sektion, Wireframe).
 */
function isFrameAdoptable(
	element: CanvasElement,
	elements: Map<string, CanvasElement>,
): boolean {
	if (element.locked) return false;
	if (element.type === "frame") return false;
	if (isKanbanCard(element) || isKanbanList(element)) return false;
	if (getFlowchartConnectorMeta(element)) return false;
	if (getMindmapEdgeMeta(element)) return false;
	if (element.frameId) {
		const currentFrame = elements.get(element.frameId);
		/* Mitglied eines Spezial-Frames: dessen eigene Logik entscheidet. */
		if (currentFrame && !isPlainCanvasFrame(currentFrame)) return false;
	}
	return true;
}

/**
 * Oberster einfacher Frame, der den Punkt enthaelt (Stack-Reihenfolge).
 * excludeIds verhindert, dass ein bewegter Frame sich selbst adoptiert.
 */
export function findPlainFrameAtPoint(
	elements: Map<string, CanvasElement>,
	x: number,
	y: number,
	excludeIds?: ReadonlySet<string>,
): CanvasElement | null {
	const ordered = sortCanvasElements(elements.values());
	/* Von oben nach unten suchen: letzter Eintrag ist zuoberst. */
	for (let index = ordered.length - 1; index >= 0; index--) {
		const candidate = ordered[index];
		if (!isPlainCanvasFrame(candidate)) continue;
		if (excludeIds?.has(candidate.id)) continue;
		if (
			x >= candidate.x &&
			x <= candidate.x + candidate.width &&
			y >= candidate.y &&
			y <= candidate.y + candidate.height
		) {
			return candidate;
		}
	}
	return null;
}

/**
 * Adoption nach einer Bewegung: bewegte Elemente werden dem Frame unter
 * ihrem Mittelpunkt zugeordnet (oder freigegeben, wenn keiner darunter liegt).
 */
export function buildFrameDropUpdates(
	elements: Map<string, CanvasElement>,
	movedIds: Iterable<string>,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];
	for (const id of movedIds) {
		const element = elements.get(id);
		if (!element || !isFrameAdoptable(element, elements)) continue;
		const centerX = element.x + element.width / 2;
		const centerY = element.y + element.height / 2;

		/*
		 * Stabilitaet: Liegt der Mittelpunkt noch im bisherigen Frame, bleibt
		 * die Zugehoerigkeit bestehen (auch wenn ein anderer Frame darueber
		 * liegt, z. B. beim Verschieben ganzer Frames uebereinander).
		 */
		const currentFrame = element.frameId
			? elements.get(element.frameId)
			: undefined;
		if (
			currentFrame &&
			isPlainCanvasFrame(currentFrame) &&
			centerX >= currentFrame.x &&
			centerX <= currentFrame.x + currentFrame.width &&
			centerY >= currentFrame.y &&
			centerY <= currentFrame.y + currentFrame.height
		) {
			continue;
		}

		const target = findPlainFrameAtPoint(elements, centerX, centerY);
		const nextFrameId = target?.id;
		if ((element.frameId ?? undefined) === nextFrameId) continue;
		updates.push({ id, changes: { frameId: nextFrameId } });
	}
	return updates;
}

/** Neue Position/Groesse einer Achse gemaess Constraint berechnen. */
function resolveConstraintAxis(
	constraint: FrameConstraintAxis,
	childStart: number,
	childSize: number,
	prevStart: number,
	prevSize: number,
	nextStart: number,
	nextSize: number,
): { start: number; size: number } {
	const offsetStart = childStart - prevStart;
	const offsetEnd = prevStart + prevSize - (childStart + childSize);
	switch (constraint) {
		case "end":
			return {
				start: nextStart + nextSize - offsetEnd - childSize,
				size: childSize,
			};
		case "center": {
			const childCenter = childStart + childSize / 2;
			const relative =
				prevSize > 0 ? (childCenter - prevStart) / prevSize : 0.5;
			return {
				start: nextStart + relative * nextSize - childSize / 2,
				size: childSize,
			};
		}
		case "stretch":
			return {
				start: nextStart + offsetStart,
				size: Math.max(1, nextSize - offsetStart - offsetEnd),
			};
		case "scale": {
			const factor = prevSize > 0 ? nextSize / prevSize : 1;
			return {
				start: nextStart + offsetStart * factor,
				size: Math.max(1, childSize * factor),
			};
		}
		default:
			/* "start": am linken/oberen Rand verankert. */
			return { start: nextStart + offsetStart, size: childSize };
	}
}

/**
 * Kind-Updates fuer einen Frame-Resize gemaess Constraints.
 * prevRect ist der Frame VOR dem Resize, nextRect danach.
 */
export function buildFrameResizeChildUpdates(
	elements: Map<string, CanvasElement>,
	frameId: string,
	prevRect: FrameRect,
	nextRect: FrameRect,
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	if (
		prevRect.x === nextRect.x &&
		prevRect.y === nextRect.y &&
		prevRect.width === nextRect.width &&
		prevRect.height === nextRect.height
	) {
		return [];
	}
	const updates: Array<{ id: string; changes: Partial<CanvasElement> }> = [];
	for (const child of elements.values()) {
		if (child.frameId !== frameId || child.locked) continue;
		const constraints = readFrameConstraints(child);
		const horizontal = resolveConstraintAxis(
			constraints.horizontal,
			child.x,
			child.width,
			prevRect.x,
			prevRect.width,
			nextRect.x,
			nextRect.width,
		);
		const vertical = resolveConstraintAxis(
			constraints.vertical,
			child.y,
			child.height,
			prevRect.y,
			prevRect.height,
			nextRect.y,
			nextRect.height,
		);
		const changes: Partial<CanvasElement> = {};
		if (horizontal.start !== child.x) changes.x = horizontal.start;
		if (vertical.start !== child.y) changes.y = vertical.start;
		if (horizontal.size !== child.width) changes.width = horizontal.size;
		if (vertical.size !== child.height) changes.height = vertical.size;
		if (Object.keys(changes).length > 0)
			updates.push({ id: child.id, changes });
	}
	return updates;
}

/**
 * Frame-Groesse setzen (z. B. Preset aus dem Panel): liefert Updates fuer
 * den Frame UND seine Kinder gemaess Constraints. Linke obere Ecke bleibt.
 */
export function buildFrameSizeUpdates(
	elements: Map<string, CanvasElement>,
	frameId: string,
	size: { width: number; height: number },
): Array<{ id: string; changes: Partial<CanvasElement> }> {
	const frame = elements.get(frameId);
	if (!frame || frame.type !== "frame") return [];
	const nextWidth = Math.max(1, Math.round(size.width));
	const nextHeight = Math.max(1, Math.round(size.height));
	const prevRect: FrameRect = {
		x: frame.x,
		y: frame.y,
		width: frame.width,
		height: frame.height,
	};
	const nextRect: FrameRect = {
		x: frame.x,
		y: frame.y,
		width: nextWidth,
		height: nextHeight,
	};
	return [
		{ id: frameId, changes: { width: nextWidth, height: nextHeight } },
		...buildFrameResizeChildUpdates(elements, frameId, prevRect, nextRect),
	];
}
