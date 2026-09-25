import assert from "node:assert/strict";
import test from "node:test";
import {
	decryptImageAsset,
	normalizeKanbanAttachments,
} from "@skedra/canvas-core";
import { getCanvasAttachmentMimeType } from "@skedra/canvas-core";
import {
	parseEncryptedAssetReference,
	releaseLocalEncryptedAssetPreview,
} from "./asset-urls";
import {
	createAttachmentBlobUrl,
	readCanvasAttachmentFile,
} from "./attachment-utils";

test("document attachments retain their type and download bytes, including after encryption", async () => {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: { location: { origin: "http://localhost" } },
	});
	Object.defineProperty(globalThis, "FileReader", {
		configurable: true,
		value: class {
			result = "";
			onload: (() => void) | null = null;
			readAsDataURL(blob: Blob) {
				void blob.arrayBuffer().then((bytes) => {
					this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString("base64")}`;
					this.onload?.();
				});
			}
		},
	});
	const file = new File(["%PDF-1.4\nAttachment bytes"], "test.pdf", {
		type: "application/pdf",
	});
	const local = await readCanvasAttachmentFile(file);
	assert.equal(local.mimeType, "application/pdf");
	assert.equal(local.width, 0);
	const normalized = normalizeKanbanAttachments({
		attachments: [{ id: "pdf", ...local }],
	})[0];
	assert.equal(normalized.mimeType, "application/pdf");
	assert.equal(normalized.sizeBytes, file.size);
	const url = createAttachmentBlobUrl(local.src, local.mimeType);
	assert.equal(await (await fetch(url)).text(), await file.text());
	URL.revokeObjectURL(url);
	assert.equal(
		getCanvasAttachmentMimeType({ name: "report.docx" }),
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	);
	assert.equal(
		getCanvasAttachmentMimeType({ name: "page.html", mimeType: "text/html" }),
		"application/octet-stream",
	);
	await assert.rejects(
		readCanvasAttachmentFile(file, { maxImageBytes: 5 }),
		/ATTACHMENT_TOO_LARGE/,
	);
	const originalFetch = globalThis.fetch;
	let ciphertext: ArrayBuffer | undefined;
	globalThis.fetch = async (_url, init) => {
		const data = init?.body as FormData;
		const uploaded = data.get("file") as File;
		assert.equal(uploaded.type, "application/octet-stream");
		ciphertext = await uploaded.arrayBuffer();
		return Response.json({
			id: data.get("assetId"),
			url: `/api/assets/${data.get("assetId")}`,
		});
	};
	try {
		for (const encryptionMode of ["e2ee", "server"] as const) {
			const key =
				encryptionMode === "e2ee"
					? "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
					: null;
			const uploaded = await readCanvasAttachmentFile(file, {
				objectStorageEnabled: true,
				whiteboardId: "board",
				encryptionMode,
				e2eeKey: key,
			});
			const parsed = parseEncryptedAssetReference(uploaded.src);
			assert.ok(parsed);
			assert.ok(ciphertext);
			assert.equal(parsed.reference.mimeType, "application/pdf");
			const decrypted = await decryptImageAsset({
				ciphertext,
				reference: parsed.reference,
				whiteboardId: "board",
				boardKey: key,
			});
			assert.equal(new TextDecoder().decode(decrypted), await file.text());
			releaseLocalEncryptedAssetPreview(uploaded.src);
		}
	} finally {
		globalThis.fetch = originalFetch;
	}
});
