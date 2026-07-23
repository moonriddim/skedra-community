import {
	type CanvasElement,
	type ExcalidrawImportOptions,
	parseExcalidrawClipboard,
	parseSvgToCanvasElements,
	serializeExcalidrawClipboard,
	serializeSkedraClipboard,
} from "@skedra/canvas-core";
import { decodeCanvasElement } from "./codecs.js";
import { exportSkedraPng, exportSkedraSvg } from "./exporters.js";

export const SKEDRA_CLIPBOARD_MIME =
	"application/vnd.skedra.clipboard+json" as const;
export const EXCALIDRAW_CLIPBOARD_MIME =
	"application/vnd.excalidraw.clipboard+json" as const;
export const TEXT_CLIPBOARD_MIME = "text/plain" as const;
export const SVG_CLIPBOARD_MIME = "image/svg+xml" as const;
export const HTML_CLIPBOARD_MIME = "text/html" as const;
export const PNG_CLIPBOARD_MIME = "image/png" as const;

export type CanvasVisualClipboardFormat = "png" | "svg";

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

function extractSvgMarkup(value: string): string | null {
	const start = value.search(/<svg(?:\s|>)/i);
	const end = value.toLowerCase().lastIndexOf("</svg>");
	return start >= 0 && end >= start ? value.slice(start, end + 6) : null;
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
	const svgMarkup = extractSvgMarkup(value);
	if (svgMarkup) {
		return (
			parseSvgToCanvasElements(svgMarkup, {
				createId: options.createId,
				stroke: options.defaultStroke,
				fontFamily: options.defaultFontFamily,
				maxWidth: 480,
				maxHeight: 360,
			})?.elements ?? null
		);
	}
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

/**
 * Writes a rendered visual to the system clipboard. PNG stays a native image;
 * SVG prefers its native MIME type and falls back to copyable SVG source text
 * on browsers that do not expose SVG clipboard writes.
 */
export async function writeCanvasVisualBlobToClipboard(
	format: CanvasVisualClipboardFormat,
	blob: Blob | PromiseLike<Blob>,
): Promise<void> {
	if (typeof navigator === "undefined" || !navigator.clipboard) {
		throw new Error("The Clipboard API is unavailable");
	}
	const mime = format === "png" ? PNG_CLIPBOARD_MIME : SVG_CLIPBOARD_MIME;
	const ClipboardItemConstructor =
		typeof ClipboardItem === "undefined" ? null : ClipboardItem;
	const canWriteMime =
		ClipboardItemConstructor != null &&
		(typeof ClipboardItemConstructor.supports !== "function" ||
			ClipboardItemConstructor.supports(mime));

	if (navigator.clipboard.write && canWriteMime && ClipboardItemConstructor) {
		try {
			await navigator.clipboard.write([
				new ClipboardItemConstructor({ [mime]: blob }),
			]);
			return;
		} catch (error) {
			if (format === "png") throw error;
		}
	}

	if (format === "svg" && navigator.clipboard.writeText) {
		await navigator.clipboard.writeText(await (await blob).text());
		return;
	}
	throw new Error(`Copying ${format.toUpperCase()} images is unsupported`);
}

/** Copies the complete canvas content bounds, including its background. */
export function copySkedraVisualToClipboard(
	svgElement: SVGSVGElement,
	format: CanvasVisualClipboardFormat,
): Promise<void> {
	const blob =
		format === "png"
			? exportSkedraPng(svgElement)
			: exportSkedraSvg(svgElement);
	return writeCanvasVisualBlobToClipboard(format, blob);
}

export function parseCanvasClipboardDataTransfer(
	dataTransfer: ClipboardDataReader,
	options: ExcalidrawImportOptions,
): CanvasElement[] | null {
	for (const mime of [
		SKEDRA_CLIPBOARD_MIME,
		EXCALIDRAW_CLIPBOARD_MIME,
		SVG_CLIPBOARD_MIME,
		HTML_CLIPBOARD_MIME,
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
