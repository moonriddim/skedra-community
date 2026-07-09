/**
 * Generisches Diagramm (Formen/Pfeile/Text) fuer AI.
 */

import { addCanvasElementsSchema } from "../canvas-api";
import type { AddCanvasElementInput } from "../canvas-api";

const MIN_SHAPE_SIZE = 24;
const MIN_TEXT_WIDTH = 120;
const MIN_TEXT_HEIGHT = 40;
const MIN_LINE_SIZE = 1;

function sanitizeAiElement(raw: Record<string, unknown>) {
	const type = typeof raw.type === "string" ? raw.type : "rectangle";
	const sanitized: Record<string, unknown> = { ...raw, type };

	let width = Number(raw.width);
	let height = Number(raw.height);
	if (!Number.isFinite(width)) width = MIN_SHAPE_SIZE;
	if (!Number.isFinite(height)) height = MIN_SHAPE_SIZE;

	if (type === "line" || type === "arrow") {
		width = Math.max(Math.abs(width), MIN_LINE_SIZE);
		height = Math.max(Math.abs(height), MIN_LINE_SIZE);

		const points = raw.points;
		if (!Array.isArray(points) || points.length < 2) {
			sanitized.points = [
				[0, 0],
				[Math.max(width, 80), 0],
			];
		}
	} else if (type === "text") {
		width = Math.max(Math.abs(width), MIN_TEXT_WIDTH);
		height = Math.max(Math.abs(height), MIN_TEXT_HEIGHT);
	} else {
		width = Math.max(Math.abs(width), MIN_SHAPE_SIZE);
		height = Math.max(Math.abs(height), MIN_SHAPE_SIZE);
	}

	sanitized.width = width;
	sanitized.height = height;
	sanitized.x = Number.isFinite(Number(raw.x)) ? Number(raw.x) : 0;
	sanitized.y = Number.isFinite(Number(raw.y)) ? Number(raw.y) : 0;

	return sanitized;
}

export function parseDiagramElementsFromAi(
	payload: Record<string, unknown>,
): AddCanvasElementInput[] {
	const elements = payload.elements;
	if (!Array.isArray(elements) || elements.length === 0) {
		throw new Error("LLM-Antwort enthielt keine Elemente");
	}

	const sanitized = {
		elements: elements.map((entry) =>
			sanitizeAiElement(
				entry && typeof entry === "object"
					? (entry as Record<string, unknown>)
					: {},
			),
		),
	};

	return addCanvasElementsSchema.parse(sanitized).elements;
}
