export interface EncryptedAssetReference {
	v: 1;
	assetId: string;
	iv: string;
	mimeType: string;
	/** Per-asset key for server-encrypted boards; absent for true E2EE boards. */
	key?: string;
}

const ASSET_KEY_INFO = new TextEncoder().encode("skedra-e2ee-asset-key-v1");

function getCrypto() {
	if (!globalThis.crypto?.subtle) {
		throw new Error("Web Crypto API is not available");
	}
	return globalThis.crypto;
}

function bytesToBase64Url(bytes: Uint8Array) {
	let binary = "";
	const chunkSize = 0x8000;
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binary += String.fromCharCode(
			...bytes.subarray(offset, offset + chunkSize),
		);
	}
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/u, "");
}

function base64UrlToBytes(value: string) {
	const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
	const padded = normalized.padEnd(
		normalized.length + ((4 - (normalized.length % 4)) % 4),
		"=",
	);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

async function deriveAssetKey(boardKey: string, whiteboardId: string) {
	const keyMaterial = await getCrypto().subtle.importKey(
		"raw",
		base64UrlToBytes(boardKey.trim()),
		"HKDF",
		false,
		["deriveKey"],
	);
	return getCrypto().subtle.deriveKey(
		{
			name: "HKDF",
			hash: "SHA-256",
			salt: new TextEncoder().encode(whiteboardId),
			info: ASSET_KEY_INFO,
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

async function importAssetKey(key: string) {
	return getCrypto().subtle.importKey(
		"raw",
		base64UrlToBytes(key),
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

function assetAad(
	whiteboardId: string,
	reference: Pick<EncryptedAssetReference, "v" | "assetId" | "mimeType">,
) {
	return new TextEncoder().encode(
		JSON.stringify({
			v: reference.v,
			whiteboardId,
			assetId: reference.assetId,
			mimeType: reference.mimeType,
		}),
	);
}

export async function encryptImageAsset(input: {
	file: Blob & { type: string };
	boardKey?: string | null;
	whiteboardId: string;
	assetId: string;
}) {
	const iv = new Uint8Array(12);
	getCrypto().getRandomValues(iv);
	const perAssetKey = input.boardKey
		? null
		: getCrypto().getRandomValues(new Uint8Array(32));
	const reference: EncryptedAssetReference = {
		v: 1,
		assetId: input.assetId,
		iv: bytesToBase64Url(iv),
		mimeType: input.file.type,
		...(perAssetKey ? { key: bytesToBase64Url(perAssetKey) } : {}),
	};
	const key = input.boardKey
		? await deriveAssetKey(input.boardKey, input.whiteboardId)
		: await importAssetKey(reference.key as string);
	const ciphertext = await getCrypto().subtle.encrypt(
		{
			name: "AES-GCM",
			iv,
			additionalData: assetAad(input.whiteboardId, reference),
		},
		key,
		await input.file.arrayBuffer(),
	);
	return { reference, ciphertext };
}

export async function decryptImageAsset(input: {
	ciphertext: ArrayBuffer;
	boardKey?: string | null;
	whiteboardId: string;
	reference: EncryptedAssetReference;
}) {
	const key = input.boardKey
		? await deriveAssetKey(input.boardKey, input.whiteboardId)
		: input.reference.key
			? await importAssetKey(input.reference.key)
			: null;
	if (!key) throw new Error("Encrypted asset key is unavailable");
	return getCrypto().subtle.decrypt(
		{
			name: "AES-GCM",
			iv: base64UrlToBytes(input.reference.iv),
			additionalData: assetAad(input.whiteboardId, input.reference),
		},
		key,
		input.ciphertext,
	);
}
