import assert from "node:assert/strict";
import test from "node:test";
import { isEncryptedEnvelope } from "@skedra/shared/server-crypto";

process.env.DATA_ENCRYPTION_SECRET =
	"profile-image-tests-use-a-dedicated-secret-123456789";

const {
	decryptProfileImageBytes,
	detectProfileImageMimeType,
	encryptProfileImageBytes,
} = await import("./profile-images");

test("detectProfileImageMimeType recognizes supported image signatures", () => {
	assert.equal(
		detectProfileImageMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])),
		"image/jpeg",
	);
	assert.equal(
		detectProfileImageMimeType(
			new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		),
		"image/png",
	);
	assert.equal(
		detectProfileImageMimeType(
			new Uint8Array([
				0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
			]),
		),
		"image/webp",
	);
});

test("detectProfileImageMimeType rejects unsupported or spoofed bytes", () => {
	assert.equal(
		detectProfileImageMimeType(
			new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
		),
		null,
	);
	assert.equal(detectProfileImageMimeType(new Uint8Array()), null);
});

test("profile image bytes are encrypted at rest and bound to their user", () => {
	const plaintext = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
	const encrypted = encryptProfileImageBytes(plaintext, "user-a");

	assert.equal(isEncryptedEnvelope(encrypted), true);
	assert.notDeepEqual(encrypted, plaintext);
	assert.deepEqual(
		Array.from(decryptProfileImageBytes(encrypted, "user-a")),
		Array.from(plaintext),
	);
	assert.throws(() => decryptProfileImageBytes(encrypted, "user-b"));
});

test("unencrypted profile image bytes are never served by the decryptor", () => {
	assert.throws(() =>
		decryptProfileImageBytes(new Uint8Array([0xff, 0xd8, 0xff]), "user-a"),
	);
});
