import assert from "node:assert/strict";
import test from "node:test";
import type { CanvasElement } from "@skedra/canvas-core";
import {
	EXCALIDRAW_CLIPBOARD_MIME,
	SKEDRA_CLIPBOARD_MIME,
	TEXT_CLIPBOARD_MIME,
	parseCanvasClipboardDataTransfer,
	writeCanvasClipboardDataTransfer,
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
