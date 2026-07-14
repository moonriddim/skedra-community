import assert from "node:assert/strict";
import test from "node:test";
import { createBaseCanvasElement } from "@skedra/canvas-core";
import {
	createCanvasSkedraFile,
	decryptCanvasSkedraFile,
	encryptCanvasSkedraFile,
	parseCanvasSkedraFile,
	parseCanvasSkedraFileContents,
	serializeCanvasSkedraFile,
} from "./file";

const element = createBaseCanvasElement(
	{ createId: () => "file-element", stroke: "#111111" },
	{ type: "rectangle", x: 10, y: 20, width: 120, height: 80 },
);

test("round-trips one canonical .skedra document", () => {
	const file = createCanvasSkedraFile({
		elements: [element],
		canvasBg: "#fff",
	});
	const parsed = parseCanvasSkedraFile(serializeCanvasSkedraFile(file));
	assert.equal(
		serializeCanvasSkedraFile(parsed),
		serializeCanvasSkedraFile(file),
	);
});

test("encrypts and decrypts the canonical .skedra format", async () => {
	const file = createCanvasSkedraFile({ elements: [element] });
	const encrypted = await encryptCanvasSkedraFile(file, "correct horse", 1_000);
	const decrypted = await decryptCanvasSkedraFile(encrypted, "correct horse");
	assert.equal(
		serializeCanvasSkedraFile(decrypted),
		serializeCanvasSkedraFile(file),
	);
	assert.equal(
		serializeCanvasSkedraFile(
			await parseCanvasSkedraFileContents(
				JSON.stringify(encrypted),
				"correct horse",
			),
		),
		serializeCanvasSkedraFile(file),
	);
});

test("rejects future .skedra versions", () => {
	const file = createCanvasSkedraFile({ elements: [element] });
	assert.throws(
		() => parseCanvasSkedraFile({ ...file, version: file.version + 1 }),
		/unsupportedVersion/u,
	);
});
