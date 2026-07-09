import { getCombinedBBox } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import * as Y from "yjs";
import { readCanvasMapsFromYDoc } from "./yjs-document-helpers";

const DEFAULT_PREVIEW_BOUNDS = {
	minX: 0,
	minY: 0,
	width: 320,
	height: 180,
};

function toUint8Array(value: unknown): Uint8Array | null {
	if (!value) return null;
	if (value instanceof Uint8Array) return value;
	if (value instanceof ArrayBuffer) return new Uint8Array(value);
	if (typeof value === "string") {
		if (value.startsWith("\\x") && value.length > 2) {
			const hex = value.slice(2);
			if (hex.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(hex)) {
				const bytes = new Uint8Array(hex.length / 2);
				for (let index = 0; index < hex.length; index += 2) {
					bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
				}
				return bytes;
			}
		}
		try {
			return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
		} catch {
			return null;
		}
	}
	if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
		return Uint8Array.from(value);
	}
	if (
		typeof value === "object" &&
		value != null &&
		"data" in value &&
		Array.isArray((value as { data: unknown }).data)
	) {
		const data = (value as { data: unknown[] }).data;
		if (data.every((item) => typeof item === "number")) {
			return Uint8Array.from(data as number[]);
		}
	}
	if (typeof value === "object" && value != null) {
		const entries = Object.entries(value)
			.filter(([key, item]) => /^\d+$/.test(key) && typeof item === "number")
			.sort((left, right) => Number(left[0]) - Number(right[0]));

		if (entries.length > 0) {
			return Uint8Array.from(entries.map(([, item]) => item as number));
		}
	}
	return null;
}

export function readWhiteboardPreviewElements(
	yjsState: unknown,
): Map<string, CanvasElement> {
	const bytes = toUint8Array(yjsState);
	if (!bytes || bytes.length === 0) return new Map();

	const doc = new Y.Doc();
	try {
		Y.applyUpdate(doc, bytes);
		return readCanvasMapsFromYDoc(doc).elements;
	} catch {
		return new Map();
	} finally {
		doc.destroy();
	}
}

export function getWhiteboardPreviewBounds(
	elements: Map<string, CanvasElement>,
) {
	const visibleElements = Array.from(elements.values()).filter(
		(element) => Number.isFinite(element.x) && Number.isFinite(element.y),
	);
	const bounds = getCombinedBBox(visibleElements);
	if (!bounds) return DEFAULT_PREVIEW_BOUNDS;

	const dominantSize = Math.max(bounds.width, bounds.height, 1);
	const padding = Math.min(Math.max(dominantSize * 0.12, 24), 96);

	return {
		minX: bounds.x - padding,
		minY: bounds.y - padding,
		width: Math.max(bounds.width + padding * 2, 120),
		height: Math.max(bounds.height + padding * 2, 80),
	};
}
