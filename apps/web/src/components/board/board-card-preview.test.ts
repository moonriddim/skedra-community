import assert from "node:assert/strict";
import { test } from "node:test";
import { readWhiteboardPreviewState } from "@/lib/canvas/preview";
import { yjsCreateElement } from "@/lib/canvas/yjs-canvas-mutations";
import { setCanvasBackgroundInYDoc } from "@/lib/canvas/yjs-document-helpers";
import { bytesToBase64 } from "@/lib/e2ee";
import {
	createBaseCanvasElement,
	getCanvasPreviewBounds,
} from "@skedra/canvas-core";
import * as Y from "yjs";

test("board preview reconstructs elements and the saved canvas background", async () => {
	const doc = new Y.Doc();
	const element = createBaseCanvasElement(
		{ createId: () => "preview-rectangle", stroke: "#f8fafc" },
		{
			type: "rectangle",
			x: 40,
			y: 60,
			width: 240,
			height: 120,
			fill: "#0f766e",
		},
	);
	yjsCreateElement(doc, element);
	setCanvasBackgroundInYDoc(doc, "#050505");
	const update = bytesToBase64(Y.encodeStateAsUpdate(doc));
	doc.destroy();

	const preview = await readWhiteboardPreviewState({
		updates: [update],
		encryptionMode: "server",
	});

	assert.equal(preview.canvasBg, "#050505");
	assert.equal(preview.elements.get(element.id)?.fill, "#0f766e");
	assert.deepEqual(getCanvasPreviewBounds(preview.elements.values()), {
		minX: 11.200000000000003,
		minY: 31.200000000000003,
		width: 297.6,
		height: 177.6,
	});
});

test("E2EE preview without a local key reveals no board state", async () => {
	const preview = await readWhiteboardPreviewState({
		updates: ["ciphertext"],
		encryptionMode: "e2ee",
		e2eeKey: null,
	});

	assert.equal(preview.elements.size, 0);
	assert.equal(preview.canvasBg, "");
});
