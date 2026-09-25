import assert from "node:assert/strict";
import test from "node:test";
import type { CanvasElement } from "@skedra/canvas-core";
import { createDecryptedAssetUrl, isSvgMimeType } from "./asset-urls";
import {
	INLINE_IMAGE_UPLOAD_MIN_CHARS,
	dataUrlToFile,
	externalizeInlineImageElements,
	hasExternalizableInlineImages,
} from "./inline-image-assets";

/** Erzeugt eine gültige base64-data:-URL mit mindestens `chars` Zeichen. */
function bigPngDataUrl(fill: number, chars = INLINE_IMAGE_UPLOAD_MIN_CHARS) {
	const bytes = new Uint8Array(Math.ceil((chars * 3) / 4)).fill(fill);
	return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

function imageElement(id: string, imageSrc: string): CanvasElement {
	return {
		id,
		type: "image",
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		customData: { imageSrc, imageAlt: id },
	} as unknown as CanvasElement;
}

const storage = { objectStorageEnabled: true, whiteboardId: "board" };

test("data URLs decode to typed files; non-images are rejected", async () => {
	const svg = dataUrlToFile(
		`data:image/svg+xml;charset=utf-8,${encodeURIComponent("<svg/>")}`,
	);
	assert.equal(svg?.type, "image/svg+xml");
	assert.equal(await svg?.text(), "<svg/>");
	const png = dataUrlToFile(`data:image/png;base64,${btoa("abc")}`);
	assert.equal(await png?.text(), "abc");
	assert.equal(dataUrlToFile("data:text/html;base64,PHNjcmlwdD4="), null);
	assert.equal(dataUrlToFile("https://example.com/a.png"), null);
});

test("large inline images are uploaded once and replaced by asset references", async () => {
	const shared = bigPngDataUrl(1);
	const small = `data:image/png;base64,${btoa("tiny")}`;
	const elements = [
		imageElement("a", shared),
		imageElement("b", shared),
		imageElement("c", small),
	];
	assert.equal(hasExternalizableInlineImages(elements), true);
	const uploads: File[] = [];
	const result = await externalizeInlineImageElements(
		elements,
		storage,
		async (file) => {
			uploads.push(file);
			return {
				src: `asset:${uploads.length}`,
				assetId: `id-${uploads.length}`,
			};
		},
	);
	// Gleiche Bilder werden dedupliziert, kleine Icons bleiben inline.
	assert.equal(uploads.length, 1);
	assert.deepEqual(
		result.map((element) => element.customData),
		[
			{ imageSrc: "asset:1", imageAlt: "a", assetId: "id-1" },
			{ imageSrc: "asset:1", imageAlt: "b", assetId: "id-1" },
			{ imageSrc: small, imageAlt: "c" },
		],
	);
});

test("without storage or after a failed upload images stay inline", async () => {
	const elements = [
		imageElement("a", bigPngDataUrl(1)),
		imageElement("b", bigPngDataUrl(2)),
	];
	let calls = 0;
	const unchanged = await externalizeInlineImageElements(
		elements,
		{ objectStorageEnabled: false },
		async () => {
			calls++;
			return { src: "x", assetId: "y" };
		},
	);
	assert.equal(unchanged, elements);
	assert.equal(calls, 0);

	const failed = await externalizeInlineImageElements(
		elements,
		storage,
		async () => {
			calls++;
			throw new Error("IMAGE_UPLOAD_FAILED");
		},
	);
	assert.equal(failed, elements);
	// Nach dem ersten Fehler wird nicht jede weitere Datei erneut versucht.
	assert.ok(calls <= 2);
});

test("decrypted SVG assets are shown via data URLs, never same-origin blob URLs", async () => {
	assert.equal(isSvgMimeType("image/svg+xml; charset=utf-8"), true);
	const svg = new TextEncoder().encode(
		'<svg xmlns="http://www.w3.org/2000/svg"/>',
	);
	const url = createDecryptedAssetUrl(
		svg.buffer as ArrayBuffer,
		"image/svg+xml",
	);
	assert.match(url, /^data:image\/svg\+xml;base64,/);
	assert.equal(
		Buffer.from(url.split(",")[1], "base64").toString(),
		'<svg xmlns="http://www.w3.org/2000/svg"/>',
	);
	const png = createDecryptedAssetUrl(new ArrayBuffer(4), "image/png");
	assert.match(png, /^blob:/);
	URL.revokeObjectURL(png);
});
