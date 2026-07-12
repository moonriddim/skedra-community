import assert from "node:assert/strict";
import test from "node:test";
import { decryptImageAsset, encryptImageAsset } from "./encrypted-assets.js";

const whiteboardId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";
const boardKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

test("encrypts E2EE image bytes with the board key", async () => {
	const encrypted = await encryptImageAsset({
		file: new Blob([imageBytes], { type: "image/png" }),
		boardKey,
		whiteboardId,
		assetId,
	});
	assert.equal(encrypted.reference.key, undefined);
	const plaintext = await decryptImageAsset({
		ciphertext: encrypted.ciphertext,
		boardKey,
		whiteboardId,
		reference: encrypted.reference,
	});
	assert.deepEqual(new Uint8Array(plaintext), imageBytes);
});

test("uses a per-asset key for server-encrypted boards", async () => {
	const encrypted = await encryptImageAsset({
		file: new Blob([imageBytes], { type: "image/png" }),
		boardKey: null,
		whiteboardId,
		assetId,
	});
	assert.ok(encrypted.reference.key);
	const plaintext = await decryptImageAsset({
		ciphertext: encrypted.ciphertext,
		boardKey: null,
		whiteboardId,
		reference: encrypted.reference,
	});
	assert.deepEqual(new Uint8Array(plaintext), imageBytes);
});

test("binds ciphertext to its asset metadata", async () => {
	const encrypted = await encryptImageAsset({
		file: new Blob([imageBytes], { type: "image/png" }),
		boardKey,
		whiteboardId,
		assetId,
	});
	await assert.rejects(
		decryptImageAsset({
			ciphertext: encrypted.ciphertext,
			boardKey,
			whiteboardId,
			reference: { ...encrypted.reference, mimeType: "image/jpeg" },
		}),
	);
});
