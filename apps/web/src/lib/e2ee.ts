const E2EE_HASH_PARAM = "skedraKey";
const E2EE_STORAGE_PREFIX = "skedra-e2ee-key:";
const E2EE_ENVELOPE_VERSION = 1;
const E2EE_ALGORITHM = "AES-GCM-256";

export interface EncryptedYjsUpdateEnvelope {
	v: typeof E2EE_ENVELOPE_VERSION;
	alg: typeof E2EE_ALGORITHM;
	iv: string;
	data: string;
}

function getCrypto() {
	if (!globalThis.crypto?.subtle) {
		throw new Error("Web Crypto API is not available");
	}
	return globalThis.crypto;
}

function bytesToBase64(bytes: Uint8Array) {
	let binary = "";
	const chunkSize = 0x8000;
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		const chunk = bytes.subarray(offset, offset + chunkSize);
		binary += String.fromCharCode(...chunk);
	}
	return btoa(binary);
}

export function base64ToBytes(value: string) {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array) {
	return bytesToBase64(bytes)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/u, "");
}

export function base64UrlToBytes(value: string) {
	const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
	const padded = normalized.padEnd(
		normalized.length + ((4 - (normalized.length % 4)) % 4),
		"=",
	);
	return base64ToBytes(padded);
}

export function generateE2eeKey() {
	const key = new Uint8Array(32);
	getCrypto().getRandomValues(key);
	return bytesToBase64Url(key);
}

async function importE2eeKey(key: string) {
	const bytes = base64UrlToBytes(key.trim());
	if (bytes.length !== 32) {
		throw new Error("Invalid E2EE key");
	}
	return getCrypto().subtle.importKey(
		"raw",
		bytes,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

export async function encryptYjsUpdate(update: Uint8Array, key: string) {
	const cryptoApi = getCrypto();
	const iv = new Uint8Array(12);
	const updateBytes = new Uint8Array(update.byteLength);
	updateBytes.set(update);
	cryptoApi.getRandomValues(iv);
	const cryptoKey = await importE2eeKey(key);
	const ciphertext = await cryptoApi.subtle.encrypt(
		{ name: "AES-GCM", iv },
		cryptoKey,
		updateBytes,
	);
	const envelope: EncryptedYjsUpdateEnvelope = {
		v: E2EE_ENVELOPE_VERSION,
		alg: E2EE_ALGORITHM,
		iv: bytesToBase64Url(iv),
		data: bytesToBase64Url(new Uint8Array(ciphertext)),
	};
	return JSON.stringify(envelope);
}

export async function decryptYjsUpdate(envelopeText: string, key: string) {
	const envelope = JSON.parse(envelopeText) as EncryptedYjsUpdateEnvelope;
	if (envelope.v !== E2EE_ENVELOPE_VERSION || envelope.alg !== E2EE_ALGORITHM) {
		throw new Error("Unsupported E2EE update envelope");
	}
	const cryptoKey = await importE2eeKey(key);
	const plaintext = await getCrypto().subtle.decrypt(
		{ name: "AES-GCM", iv: base64UrlToBytes(envelope.iv) },
		cryptoKey,
		base64UrlToBytes(envelope.data),
	);
	return new Uint8Array(plaintext);
}

function storageKey(whiteboardId: string) {
	return `${E2EE_STORAGE_PREFIX}${whiteboardId}`;
}

export function readStoredE2eeKey(whiteboardId: string) {
	try {
		return localStorage.getItem(storageKey(whiteboardId));
	} catch {
		return null;
	}
}

export function storeE2eeKey(whiteboardId: string, key: string) {
	try {
		localStorage.setItem(storageKey(whiteboardId), key);
	} catch {
		// Storage is best-effort; the URL fragment can still carry the key.
	}
}

export function readE2eeKeyFromHash() {
	const params = new URLSearchParams(window.location.hash.replace(/^#/u, ""));
	return params.get(E2EE_HASH_PARAM);
}

export function rememberE2eeKeyFromHash(whiteboardId: string) {
	const key = readE2eeKeyFromHash();
	if (key) storeE2eeKey(whiteboardId, key);
	return key;
}

export function getKnownE2eeKey(whiteboardId: string) {
	return (
		rememberE2eeKeyFromHash(whiteboardId) ?? readStoredE2eeKey(whiteboardId)
	);
}

export function withE2eeKeyFragment(
	url: string,
	key: string | null | undefined,
) {
	if (!key) return url;
	const target = new URL(url, window.location.origin);
	const params = new URLSearchParams(target.hash.replace(/^#/u, ""));
	params.set(E2EE_HASH_PARAM, key);
	target.hash = params.toString();
	return target.toString();
}

export function withE2eeKeyFragmentPath(
	path: string,
	key: string | null | undefined,
) {
	if (!key) return path;
	const target = new URL(path, window.location.origin);
	const params = new URLSearchParams(target.hash.replace(/^#/u, ""));
	params.set(E2EE_HASH_PARAM, key);
	target.hash = params.toString();
	return `${target.pathname}${target.search}${target.hash}`;
}

export function putE2eeKeyInCurrentUrl(key: string) {
	const current = new URL(window.location.href);
	const params = new URLSearchParams(current.hash.replace(/^#/u, ""));
	params.set(E2EE_HASH_PARAM, key);
	current.hash = params.toString();
	window.history.replaceState(null, "", current.toString());
}
