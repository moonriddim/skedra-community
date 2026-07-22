import {
	type CanvasElement,
	type ExcalidrawImportOptions,
	parseExcalidrawClipboard,
	serializeExcalidrawClipboard,
	serializeSkedraClipboard,
} from "@skedra/canvas-core";
import { decodeCanvasElement } from "./codecs.js";

export const SKEDRA_CLIPBOARD_MIME =
	"application/vnd.skedra.clipboard+json" as const;
export const EXCALIDRAW_CLIPBOARD_MIME =
	"application/vnd.excalidraw.clipboard+json" as const;
export const TEXT_CLIPBOARD_MIME = "text/plain" as const;

export interface CanvasClipboardPayloads {
	skedra: string;
	excalidraw: string;
}

type ClipboardDataReader = Pick<DataTransfer, "getData">;
type ClipboardDataWriter = Pick<DataTransfer, "setData">;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(value: string): unknown {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return null;
	}
}

export function createCanvasClipboardPayloads(
	elements: Iterable<CanvasElement>,
): CanvasClipboardPayloads {
	const materialized = Array.from(elements);
	return {
		skedra: serializeSkedraClipboard(materialized),
		excalidraw: serializeExcalidrawClipboard(materialized),
	};
}

export function parseCanvasClipboardText(
	value: string,
	options: ExcalidrawImportOptions,
): CanvasElement[] | null {
	const parsed = parseJson(value);
	if (!isRecord(parsed)) return null;
	if (parsed.type === "skedra-clipboard" && Array.isArray(parsed.elements)) {
		const elements = parsed.elements.map(decodeCanvasElement);
		return elements.some((element) => element == null)
			? null
			: (elements as CanvasElement[]);
	}
	return parseExcalidrawClipboard(value, options);
}

export function writeCanvasClipboardDataTransfer(
	dataTransfer: ClipboardDataWriter,
	elements: Iterable<CanvasElement>,
): boolean {
	const payloads = createCanvasClipboardPayloads(elements);
	let wrote = false;
	for (const [mime, value] of [
		[SKEDRA_CLIPBOARD_MIME, payloads.skedra],
		[EXCALIDRAW_CLIPBOARD_MIME, payloads.excalidraw],
		[TEXT_CLIPBOARD_MIME, payloads.excalidraw],
	] as const) {
		try {
			dataTransfer.setData(mime, value);
			wrote = true;
		} catch {
			// Continue so text/plain remains available on restrictive browsers.
		}
	}
	return wrote;
}

export function parseCanvasClipboardDataTransfer(
	dataTransfer: ClipboardDataReader,
	options: ExcalidrawImportOptions,
): CanvasElement[] | null {
	for (const mime of [
		SKEDRA_CLIPBOARD_MIME,
		EXCALIDRAW_CLIPBOARD_MIME,
		TEXT_CLIPBOARD_MIME,
	] as const) {
		let value = "";
		try {
			value = dataTransfer.getData(mime);
		} catch {
			continue;
		}
		if (!value) continue;
		const elements = parseCanvasClipboardText(value, options);
		if (elements) return elements;
	}
	return null;
}
