import assert from "node:assert/strict";
import test from "node:test";
import { type CanvasElement, encryptImageAsset } from "@skedra/canvas-core";
import { buildEncryptedAssetReference } from "./asset-urls";
import { embedEncryptedAssetReferences } from "./portable-assets";

const BOARD = "00000000-0000-4000-8000-00000000b0a2";

test("exported elements embed their board-bound images as data URLs", async () => {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: { location: { origin: "http://localhost" } },
	});
	// Server-verschlüsseltes Board: Schlüssel steckt im Verweis, AAD bindet an das Board.
	const assetId = "00000000-0000-4000-8000-0000000a55e7";
	const image = new File([new Uint8Array([137, 80, 78, 71])], "a.png", {
		type: "image/png",
	});
	const encrypted = await encryptImageAsset({
		file: image,
		whiteboardId: BOARD,
		assetId,
	});
	const src = buildEncryptedAssetReference(
		`/api/assets/${assetId}`,
		encrypted.reference,
	);
	const elements = [
		{
			id: "img",
			type: "image",
			customData: { imageSrc: src, assetId },
		},
		// Verweise auch tiefer verschachtelt (z. B. Kanban-Cover) werden erfasst.
		{ id: "card", type: "rectangle", customData: { cover: { src } } },
	] as unknown as CanvasElement[];
	const requested: string[] = [];
	const result = await embedEncryptedAssetReferences(elements, {
		whiteboardId: BOARD,
		fetchAsset: async (url) => {
			requested.push(url);
			return encrypted.ciphertext;
		},
	});
	const expected = `data:image/png;base64,${Buffer.from([137, 80, 78, 71]).toString("base64")}`;
	assert.equal(result.failed, 0);
	// Dasselbe Asset wird nur einmal geladen.
	assert.deepEqual(requested, [`/api/assets/${assetId}`]);
	const [embeddedImage, embeddedCard] = result.value as unknown as Array<{
		customData: { imageSrc?: string; cover?: { src: string } };
	}>;
	assert.equal(embeddedImage.customData.imageSrc, expected);
	assert.equal(embeddedCard.customData.cover?.src, expected);
	// Das Original bleibt unverändert.
	assert.equal((elements[0].customData as { imageSrc: string }).imageSrc, src);

	// Mit falschem Board (andere AAD) scheitert die Entschlüsselung sichtbar.
	const foreign = await embedEncryptedAssetReferences(elements, {
		whiteboardId: "00000000-0000-4000-8000-000000000000",
		fetchAsset: async () => encrypted.ciphertext,
	});
	assert.equal(foreign.failed, 1);
	assert.equal(foreign.value, elements);
});
