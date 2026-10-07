import assert from "node:assert/strict";
import test from "node:test";
import {
	copyPreparedPresentationLink,
	withPresentationPreviewVersion,
} from "./presentation-share-link";

test("preview revisions change the shared URL while preserving the E2EE fragment", () => {
	const original = "https://skedra.xyz/present/token?other=1#key=secret";
	const first = withPresentationPreviewVersion(original, "first");
	assert.equal(
		first,
		"https://skedra.xyz/present/token?other=1&v=first#key=secret",
	);
	assert.equal(
		withPresentationPreviewVersion(first, "second"),
		"https://skedra.xyz/present/token?other=1&v=second#key=secret",
	);
	assert.equal(withPresentationPreviewVersion(first, null), original);
});

test("clipboard access starts during the click but receives the URL only after preview upload", async (t) => {
	const navigatorDescriptor = Object.getOwnPropertyDescriptor(
		globalThis,
		"navigator",
	);
	const clipboardDescriptor = Object.getOwnPropertyDescriptor(
		globalThis,
		"ClipboardItem",
	);
	t.after(() => {
		if (navigatorDescriptor)
			Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
		else Reflect.deleteProperty(globalThis, "navigator");
		if (clipboardDescriptor)
			Object.defineProperty(globalThis, "ClipboardItem", clipboardDescriptor);
		else Reflect.deleteProperty(globalThis, "ClipboardItem");
	});
	let clipboardStarted = false;
	let copied = "";
	class Item {
		constructor(public contents: Record<string, Promise<Blob>>) {}
	}
	Object.defineProperty(globalThis, "ClipboardItem", {
		configurable: true,
		value: Item,
	});
	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: {
			clipboard: {
				write: async ([item]: Item[]) => {
					clipboardStarted = true;
					copied = await (await item.contents["text/plain"]).text();
				},
			},
		},
	});
	let finishUpload!: (url: string) => void;
	const uploaded = new Promise<string>((resolve) => {
		finishUpload = resolve;
	});
	const copying = copyPreparedPresentationLink(uploaded);
	assert.equal(clipboardStarted, true);
	assert.equal(copied, "");
	finishUpload("https://skedra.xyz/present/token?v=uploaded");
	await copying;
	assert.equal(copied, "https://skedra.xyz/present/token?v=uploaded");
	copied = "";
	await assert.rejects(
		copyPreparedPresentationLink(Promise.reject(new Error("upload failed"))),
		/upload failed/,
	);
	assert.equal(
		copied,
		"",
		"never copy a stale link when preview publishing fails",
	);
	Reflect.deleteProperty(globalThis, "ClipboardItem");
	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: {
			clipboard: {
				writeText: async (url: string) => {
					copied = url;
				},
			},
		},
	});
	await copyPreparedPresentationLink(
		Promise.resolve("https://skedra.xyz/present/token?v=fallback"),
	);
	assert.equal(copied, "https://skedra.xyz/present/token?v=fallback");
});
