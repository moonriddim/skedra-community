import assert from "node:assert/strict";
import test from "node:test";
import { type CanvasElement, encryptImageAsset } from "@skedra/canvas-core";
import {
	clearClipboardAssetCache,
	embedPreparedClipboardAssets,
	hasRestorableClipboardAssets,
	prepareClipboardAssets,
	restoreClipboardAssetRefs,
} from "./asset-clipboard-cache";
import { buildEncryptedAssetReference } from "./asset-urls";

const BOARD_A = "00000000-0000-4000-8000-00000000000a";
const BOARD_B = "00000000-0000-4000-8000-00000000000b";

test("copied images travel to other boards and come back as references in their own board", async (t) => {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: { location: { origin: "http://localhost" } },
	});
	t.after(clearClipboardAssetCache);
	const assetId = "00000000-0000-4000-8000-0000000c0de1";
	const encrypted = await encryptImageAsset({
		file: new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" }),
		whiteboardId: BOARD_A,
		assetId,
	});
	const ref = buildEncryptedAssetReference(
		`/api/assets/${assetId}`,
		encrypted.reference,
	);
	const selection = [
		{ id: "img", type: "image", customData: { imageSrc: ref, assetId } },
	] as unknown as CanvasElement[];

	// Vor dem Vorbereiten fehlt das Bild noch (der Kopier-Fallback lädt nach).
	assert.equal(embedPreparedClipboardAssets(selection, BOARD_A).missing, 1);

	let requests = 0;
	const context = {
		whiteboardId: BOARD_A,
		fetchAsset: async () => {
			requests++;
			return encrypted.ciphertext;
		},
	};
	await Promise.all([
		prepareClipboardAssets(selection, context),
		// Gleichzeitige Auswahländerungen laden dasselbe Bild nicht doppelt.
		prepareClipboardAssets(selection, context),
	]);
	assert.equal(requests, 1);

	// Kopieren: synchron eingebettet.
	const copied = embedPreparedClipboardAssets(selection, BOARD_A);
	assert.equal(copied.missing, 0);
	const dataUrl = (copied.value[0].customData as { imageSrc: string }).imageSrc;
	assert.equal(dataUrl, "data:image/png;base64,AQID");

	// Einfügen im selben Board: wieder der ursprüngliche Verweis, kein Upload.
	assert.equal(hasRestorableClipboardAssets(copied.value, BOARD_A), true);
	const restored = restoreClipboardAssetRefs(copied.value, BOARD_A);
	assert.equal((restored[0].customData as { imageSrc: string }).imageSrc, ref);

	// Einfügen in ein anderes Board: data:-URL bleibt (wird dort hochgeladen).
	assert.equal(hasRestorableClipboardAssets(copied.value, BOARD_B), false);
	assert.equal(restoreClipboardAssetRefs(copied.value, BOARD_B), copied.value);
	// Vorbereitungen gelten nur für ihr Board.
	assert.equal(embedPreparedClipboardAssets(selection, BOARD_B).missing, 1);
});
