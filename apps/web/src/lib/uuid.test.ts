import assert from "node:assert/strict";
import test from "node:test";
import { createUuid } from "./uuid";

const UUID_V4 =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

test("UUID generation uses the native browser method when available", (t) => {
	const expected = "12345678-1234-4234-8234-123456789abc";
	const native = t.mock.method(crypto, "randomUUID", () => expected);
	assert.equal(createUuid(), expected);
	assert.equal(native.mock.callCount(), 1);
});

test("UUID generation works with only getRandomValues exposed", (t) => {
	const browserCrypto = crypto;
	t.mock.getter(globalThis, "crypto", () => ({
		getRandomValues: browserCrypto.getRandomValues.bind(browserCrypto),
	}));
	const ids = Array.from({ length: 100 }, () => createUuid());
	for (const id of ids) assert.match(id, UUID_V4);
	assert.equal(new Set(ids).size, ids.length);
});

test("fallback UUIDs set the version and variant for every random byte pattern", (t) => {
	let fill = 0;
	t.mock.getter(globalThis, "crypto", () => ({
		getRandomValues: (bytes: Uint8Array) => bytes.fill(fill),
	}));
	assert.equal(createUuid(), "00000000-0000-4000-8000-000000000000");
	fill = 255;
	assert.equal(createUuid(), "ffffffff-ffff-4fff-bfff-ffffffffffff");
});
