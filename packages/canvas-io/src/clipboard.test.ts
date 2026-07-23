import assert from "node:assert/strict";
import test from "node:test";
import type { CanvasElement } from "@skedra/canvas-core";
import {
	EXCALIDRAW_CLIPBOARD_MIME,
	PNG_CLIPBOARD_MIME,
	SKEDRA_CLIPBOARD_MIME,
	SVG_CLIPBOARD_MIME,
	TEXT_CLIPBOARD_MIME,
	parseCanvasClipboardDataTransfer,
	writeCanvasClipboardDataTransfer,
	writeCanvasVisualBlobToClipboard,
} from "./clipboard.js";

const element: CanvasElement = {
	id: "triangle-1",
	type: "triangle",
	x: 1,
	y: 2,
	width: 100,
	height: 80,
	rotation: 0,
	fill: "#ffffff",
	stroke: "#111111",
	strokeWidth: 1,
	strokeStyle: "solid",
	opacity: 100,
	locked: false,
	groupId: null,
	flipX: false,
	flipY: false,
	pyramidSections: 3,
};

const options = {
	createId: () => "generated-id",
	defaultStroke: "#111111",
	defaultFontFamily: "sans-serif",
};

test("clipboard data exposes native Skedra and interoperable Excalidraw payloads", () => {
	const data = new Map<string, string>();
	assert.equal(
		writeCanvasClipboardDataTransfer(
			{ setData: (mime, value) => void data.set(mime, value) },
			[element],
		),
		true,
	);

	assert.equal(
		JSON.parse(data.get(SKEDRA_CLIPBOARD_MIME) ?? "{}").type,
		"skedra-clipboard",
	);
	assert.equal(
		JSON.parse(data.get(EXCALIDRAW_CLIPBOARD_MIME) ?? "{}").type,
		"excalidraw/clipboard",
	);
	assert.equal(
		data.get(TEXT_CLIPBOARD_MIME),
		data.get(EXCALIDRAW_CLIPBOARD_MIME),
	);
	assert.equal(
		parseCanvasClipboardDataTransfer(
			{ getData: (mime) => data.get(mime) ?? "" },
			options,
		)?.[0].type,
		"triangle",
	);
});

test("clipboard parsing falls back from invalid Skedra data to Excalidraw", () => {
	const data = new Map<string, string>();
	writeCanvasClipboardDataTransfer(
		{ setData: (mime, value) => void data.set(mime, value) },
		[element],
	);
	data.set(SKEDRA_CLIPBOARD_MIME, '{"type":"skedra-clipboard"}');

	assert.equal(
		parseCanvasClipboardDataTransfer(
			{ getData: (mime) => data.get(mime) ?? "" },
			options,
		)?.[0].type,
		"triangle",
	);
});

test("clipboard parsing imports raw SVG markup as editable grouped elements", () => {
	const data = new Map<string, string>([
		[
			SVG_CLIPBOARD_MIME,
			'<svg viewBox="0 0 100 60"><rect width="40" height="30" fill="#f00"/><path d="M 50 0 C 80 0 80 60 50 60 Z" fill="#00f"/></svg>',
		],
	]);
	const elements = parseCanvasClipboardDataTransfer(
		{ getData: (mime) => data.get(mime) ?? "" },
		options,
	);
	assert.equal(elements?.length, 2);
	assert.equal(elements?.[0].type, "rectangle");
	assert.equal(elements?.[1].customData?.skedraType, "svg-path");
	assert.ok(elements?.[0].groupId);
	assert.equal(elements?.[0].groupId, elements?.[1].groupId);
});

test("visual clipboard writes native PNG and falls back to SVG source text", async () => {
	const navigatorDescriptor = Object.getOwnPropertyDescriptor(
		globalThis,
		"navigator",
	);
	const clipboardItemDescriptor = Object.getOwnPropertyDescriptor(
		globalThis,
		"ClipboardItem",
	);
	const written: Array<Record<string, Blob | PromiseLike<Blob>>> = [];
	const textWrites: string[] = [];
	class TestClipboardItem {
		static supports(mime: string) {
			return mime === PNG_CLIPBOARD_MIME;
		}
		constructor(readonly items: Record<string, Blob | PromiseLike<Blob>>) {
			written.push(items);
		}
	}
	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: {
			clipboard: {
				write: async () => undefined,
				writeText: async (value: string) => void textWrites.push(value),
			},
		},
	});
	Object.defineProperty(globalThis, "ClipboardItem", {
		configurable: true,
		value: TestClipboardItem,
	});

	try {
		const png = new Blob(["png"], { type: PNG_CLIPBOARD_MIME });
		await writeCanvasVisualBlobToClipboard("png", Promise.resolve(png));
		assert.equal(written.length, 1);
		assert.equal(await written[0]?.[PNG_CLIPBOARD_MIME], png);

		const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
		await writeCanvasVisualBlobToClipboard(
			"svg",
			new Blob([svg], { type: SVG_CLIPBOARD_MIME }),
		);
		assert.deepEqual(textWrites, [svg]);
	} finally {
		if (navigatorDescriptor) {
			Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
		} else {
			Reflect.deleteProperty(globalThis, "navigator");
		}
		if (clipboardItemDescriptor) {
			Object.defineProperty(
				globalThis,
				"ClipboardItem",
				clipboardItemDescriptor,
			);
		} else {
			Reflect.deleteProperty(globalThis, "ClipboardItem");
		}
	}
});
