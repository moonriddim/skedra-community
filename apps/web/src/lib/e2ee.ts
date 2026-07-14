const E2EE_HASH_PARAM = "skedraKey";
const E2EE_STORAGE_PREFIX = "skedra-e2ee-key:";
const E2EE_ENVELOPE_VERSION = 1;
const E2EE_ALGORITHM = "AES-GCM-256";
const E2EE_KEY_HASH_PREFIX = "skedra-e2ee-key-v1:";
const USER_E2EE_IDENTITY_STORAGE_PREFIX = "skedra-user-e2ee-identity:";
const USER_E2EE_CURRENT_IDENTITY_KEY = "skedra-user-e2ee-identity:current";
const USER_E2EE_PRIVATE_KEY_ENVELOPE_VERSION = 1;
const USER_E2EE_PRIVATE_KEY_ALGORITHM = "PBKDF2-SHA256-AES-GCM-256";
const USER_E2EE_PRIVATE_KEY_ITERATIONS = 310_000;
const BOARD_KEY_ENVELOPE_VERSION = 1;
const BOARD_KEY_ENVELOPE_ALGORITHM = "ECDH-P256-AES-GCM-256";

export interface EncryptedYjsUpdateEnvelope {
	v: typeof E2EE_ENVELOPE_VERSION;
	alg: typeof E2EE_ALGORITHM;
	iv: string;
	data: string;
}

export interface UserE2eeIdentityRecord {
	publicKey: string;
	encryptedPrivateKey: string;
}

export interface UnlockedUserE2eeIdentity {
	email: string;
	publicKey: string;
	privateKeyJwk: JsonWebKey;
}

interface EncryptedUserPrivateKeyEnvelope {
	v: typeof USER_E2EE_PRIVATE_KEY_ENVELOPE_VERSION;
	alg: typeof USER_E2EE_PRIVATE_KEY_ALGORITHM;
	kdf: {
		name: "PBKDF2";
		hash: "SHA-256";
		iterations: number;
		salt: string;
	};
	iv: string;
	data: string;
}

interface EncryptedBoardKeyRecipientEnvelope {
	v: typeof BOARD_KEY_ENVELOPE_VERSION;
	alg: typeof BOARD_KEY_ENVELOPE_ALGORITHM;
	boardId: string;
	recipientUserId: string;
	keyHash: string;
	recipientPublicKeyHash: string;
	epk: JsonWebKey;
	iv: string;
	data: string;
}

interface BoardKeyRecipientBinding {
	boardId: string;
	recipientUserId: string;
	keyHash: string;
	recipientPublicKeyHash: string;
}

function getCrypto() {
	if (!globalThis.crypto?.subtle) {
		throw new Error("Web Crypto API is not available");
	}
	return globalThis.crypto;
}

export function bytesToBase64(bytes: Uint8Array) {
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

function getE2eeKeyBytes(key: string) {
	const bytes = base64UrlToBytes(key.trim());
	if (bytes.length !== 32) {
		throw new Error("Invalid E2EE key");
	}
	return bytes;
}

function bytesToHex(bytes: Uint8Array) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function textToBytes(value: string) {
	return new TextEncoder().encode(value);
}

function bytesToText(bytes: Uint8Array) {
	return new TextDecoder().decode(bytes);
}

function normalizeUserE2eeEmail(email: string) {
	return email.trim().toLowerCase();
}

function parseJsonObject(value: string, errorMessage: string) {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new Error(errorMessage);
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(errorMessage);
	}
	return parsed as Record<string, unknown>;
}

export async function createE2eeKeyHash(key: string) {
	const keyBytes = getE2eeKeyBytes(key);
	const prefixBytes = new TextEncoder().encode(E2EE_KEY_HASH_PREFIX);
	const material = new Uint8Array(prefixBytes.length + keyBytes.length);
	material.set(prefixBytes);
	material.set(keyBytes, prefixBytes.length);
	const digest = await getCrypto().subtle.digest("SHA-256", material);
	return bytesToHex(new Uint8Array(digest));
}

async function createUserE2eePublicKeyHash(publicKey: string) {
	const digest = await getCrypto().subtle.digest(
		"SHA-256",
		textToBytes(publicKey),
	);
	return bytesToHex(new Uint8Array(digest));
}

function boardKeyEnvelopeAad(binding: BoardKeyRecipientBinding) {
	return textToBytes(
		JSON.stringify({
			v: BOARD_KEY_ENVELOPE_VERSION,
			alg: BOARD_KEY_ENVELOPE_ALGORITHM,
			boardId: binding.boardId,
			recipientUserId: binding.recipientUserId,
			keyHash: binding.keyHash,
			recipientPublicKeyHash: binding.recipientPublicKeyHash,
		}),
	);
}

async function importE2eeKey(key: string) {
	const bytes = getE2eeKeyBytes(key);
	return getCrypto().subtle.importKey(
		"raw",
		bytes,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

async function deriveUserPrivateKeyEncryptionKey(
	password: string,
	salt: BufferSource,
	iterations: number,
) {
	const passwordKey = await getCrypto().subtle.importKey(
		"raw",
		textToBytes(password),
		"PBKDF2",
		false,
		["deriveKey"],
	);
	return getCrypto().subtle.deriveKey(
		{
			name: "PBKDF2",
			hash: "SHA-256",
			salt,
			iterations,
		},
		passwordKey,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

async function encryptUserPrivateKeyJwk(
	password: string,
	privateKeyJwk: JsonWebKey,
) {
	const cryptoApi = getCrypto();
	const salt = new Uint8Array(16);
	const iv = new Uint8Array(12);
	cryptoApi.getRandomValues(salt);
	cryptoApi.getRandomValues(iv);
	const wrappingKey = await deriveUserPrivateKeyEncryptionKey(
		password,
		salt,
		USER_E2EE_PRIVATE_KEY_ITERATIONS,
	);
	const ciphertext = await cryptoApi.subtle.encrypt(
		{ name: "AES-GCM", iv },
		wrappingKey,
		textToBytes(JSON.stringify(privateKeyJwk)),
	);
	const envelope: EncryptedUserPrivateKeyEnvelope = {
		v: USER_E2EE_PRIVATE_KEY_ENVELOPE_VERSION,
		alg: USER_E2EE_PRIVATE_KEY_ALGORITHM,
		kdf: {
			name: "PBKDF2",
			hash: "SHA-256",
			iterations: USER_E2EE_PRIVATE_KEY_ITERATIONS,
			salt: bytesToBase64Url(salt),
		},
		iv: bytesToBase64Url(iv),
		data: bytesToBase64Url(new Uint8Array(ciphertext)),
	};
	return JSON.stringify(envelope);
}

async function decryptUserPrivateKeyJwk(
	password: string,
	encryptedPrivateKey: string,
) {
	const parsed = parseJsonObject(
		encryptedPrivateKey,
		"Malformed E2EE private key envelope",
	) as Partial<EncryptedUserPrivateKeyEnvelope>;
	if (
		parsed.v !== USER_E2EE_PRIVATE_KEY_ENVELOPE_VERSION ||
		parsed.alg !== USER_E2EE_PRIVATE_KEY_ALGORITHM ||
		!parsed.kdf ||
		parsed.kdf.name !== "PBKDF2" ||
		parsed.kdf.hash !== "SHA-256" ||
		typeof parsed.kdf.iterations !== "number" ||
		typeof parsed.kdf.salt !== "string" ||
		typeof parsed.iv !== "string" ||
		typeof parsed.data !== "string"
	) {
		throw new Error("Unsupported E2EE private key envelope");
	}
	const wrappingKey = await deriveUserPrivateKeyEncryptionKey(
		password,
		base64UrlToBytes(parsed.kdf.salt),
		parsed.kdf.iterations,
	);
	const plaintext = await getCrypto().subtle.decrypt(
		{ name: "AES-GCM", iv: base64UrlToBytes(parsed.iv) },
		wrappingKey,
		base64UrlToBytes(parsed.data),
	);
	const privateKey = parseJsonObject(
		bytesToText(new Uint8Array(plaintext)),
		"Malformed E2EE private key",
	);
	return privateKey as JsonWebKey;
}

/** Re-wraps the E2EE private key when the account password changes. */
export async function reencryptUserE2eeIdentity(
	currentPassword: string,
	newPassword: string,
	identity: UserE2eeIdentityRecord,
) {
	const privateKeyJwk = await decryptUserPrivateKeyJwk(
		currentPassword,
		identity.encryptedPrivateKey,
	);
	return encryptUserPrivateKeyJwk(newPassword, privateKeyJwk);
}

export async function createEncryptedUserE2eeIdentity(
	email: string,
	password: string,
) {
	const keyPair = await getCrypto().subtle.generateKey(
		{ name: "ECDH", namedCurve: "P-256" },
		true,
		["deriveKey"],
	);
	const publicJwk = await getCrypto().subtle.exportKey(
		"jwk",
		keyPair.publicKey,
	);
	const privateKeyJwk = await getCrypto().subtle.exportKey(
		"jwk",
		keyPair.privateKey,
	);
	const publicKey = JSON.stringify(publicJwk);
	const encryptedPrivateKey = await encryptUserPrivateKeyJwk(
		password,
		privateKeyJwk,
	);
	return {
		publicKey,
		encryptedPrivateKey,
		unlockedIdentity: {
			email: normalizeUserE2eeEmail(email),
			publicKey,
			privateKeyJwk,
		} satisfies UnlockedUserE2eeIdentity,
	};
}

export async function unlockUserE2eeIdentity(
	email: string,
	password: string,
	identity: UserE2eeIdentityRecord,
): Promise<UnlockedUserE2eeIdentity> {
	const privateKeyJwk = await decryptUserPrivateKeyJwk(
		password,
		identity.encryptedPrivateKey,
	);
	return {
		email: normalizeUserE2eeEmail(email),
		publicKey: identity.publicKey,
		privateKeyJwk,
	};
}

export async function unlockOrCreateUserE2eeIdentity({
	email,
	password,
	existingIdentity,
	saveIdentity,
}: {
	email: string;
	password: string;
	existingIdentity: UserE2eeIdentityRecord | null | undefined;
	saveIdentity: (
		identity: UserE2eeIdentityRecord & { accountPassword?: string },
	) => Promise<unknown>;
}) {
	let unlocked: UnlockedUserE2eeIdentity;
	if (existingIdentity) {
		unlocked = await unlockUserE2eeIdentity(email, password, existingIdentity);
	} else {
		const created = await createEncryptedUserE2eeIdentity(email, password);
		await saveIdentity({
			publicKey: created.publicKey,
			encryptedPrivateKey: created.encryptedPrivateKey,
			accountPassword: password,
		});
		unlocked = created.unlockedIdentity;
	}
	rememberUnlockedUserE2eeIdentity(unlocked);
	return unlocked;
}

function userIdentityStorageKey(email: string) {
	return `${USER_E2EE_IDENTITY_STORAGE_PREFIX}${normalizeUserE2eeEmail(email)}`;
}

export function rememberUnlockedUserE2eeIdentity(
	identity: UnlockedUserE2eeIdentity,
) {
	try {
		const normalizedEmail = normalizeUserE2eeEmail(identity.email);
		sessionStorage.setItem(USER_E2EE_CURRENT_IDENTITY_KEY, normalizedEmail);
		sessionStorage.setItem(
			userIdentityStorageKey(normalizedEmail),
			JSON.stringify({ ...identity, email: normalizedEmail }),
		);
	} catch {
		// Unlock state is best-effort; password login can rehydrate it.
	}
}

export function readUnlockedUserE2eeIdentity(
	email?: string | null,
): UnlockedUserE2eeIdentity | null {
	try {
		const normalizedEmail = email
			? normalizeUserE2eeEmail(email)
			: sessionStorage.getItem(USER_E2EE_CURRENT_IDENTITY_KEY);
		if (!normalizedEmail) return null;
		const stored = sessionStorage.getItem(
			userIdentityStorageKey(normalizedEmail),
		);
		if (!stored) return null;
		const parsed = parseJsonObject(stored, "Malformed stored E2EE identity");
		if (
			parsed.email !== normalizedEmail ||
			typeof parsed.publicKey !== "string" ||
			!parsed.privateKeyJwk ||
			typeof parsed.privateKeyJwk !== "object" ||
			Array.isArray(parsed.privateKeyJwk)
		) {
			return null;
		}
		return {
			email: normalizedEmail,
			publicKey: parsed.publicKey,
			privateKeyJwk: parsed.privateKeyJwk as JsonWebKey,
		};
	} catch {
		return null;
	}
}

async function importUserE2eePublicKey(publicKeyText: string) {
	const publicKey = parseJsonObject(publicKeyText, "Malformed E2EE public key");
	return getCrypto().subtle.importKey(
		"jwk",
		publicKey as JsonWebKey,
		{ name: "ECDH", namedCurve: "P-256" },
		false,
		[],
	);
}

async function importUserE2eePrivateKey(privateKeyJwk: JsonWebKey) {
	return getCrypto().subtle.importKey(
		"jwk",
		privateKeyJwk,
		{ name: "ECDH", namedCurve: "P-256" },
		false,
		["deriveKey"],
	);
}

async function deriveBoardKeyWrappingKey(
	privateKey: CryptoKey,
	publicKey: CryptoKey,
	usages: KeyUsage[],
) {
	return getCrypto().subtle.deriveKey(
		{ name: "ECDH", public: publicKey },
		privateKey,
		{ name: "AES-GCM", length: 256 },
		false,
		usages,
	);
}

export async function encryptBoardKeyForRecipient({
	boardKey,
	recipientPublicKey,
	boardId,
	recipientUserId,
	keyHash,
}: {
	boardKey: string;
	recipientPublicKey: string;
	boardId: string;
	recipientUserId: string;
	keyHash: string;
}) {
	const cryptoApi = getCrypto();
	const actualKeyHash = await createE2eeKeyHash(boardKey);
	if (actualKeyHash !== keyHash) {
		throw new Error("Board key hash does not match the key being wrapped");
	}
	const recipientKey = await importUserE2eePublicKey(recipientPublicKey);
	const recipientPublicKeyHash =
		await createUserE2eePublicKeyHash(recipientPublicKey);
	const binding: BoardKeyRecipientBinding = {
		boardId,
		recipientUserId,
		keyHash,
		recipientPublicKeyHash,
	};
	const ephemeral = await cryptoApi.subtle.generateKey(
		{ name: "ECDH", namedCurve: "P-256" },
		true,
		["deriveKey"],
	);
	const wrappingKey = await deriveBoardKeyWrappingKey(
		ephemeral.privateKey,
		recipientKey,
		["encrypt"],
	);
	const iv = new Uint8Array(12);
	cryptoApi.getRandomValues(iv);
	const ciphertext = await cryptoApi.subtle.encrypt(
		{ name: "AES-GCM", iv, additionalData: boardKeyEnvelopeAad(binding) },
		wrappingKey,
		getE2eeKeyBytes(boardKey),
	);
	const epk = await cryptoApi.subtle.exportKey("jwk", ephemeral.publicKey);
	const envelope: EncryptedBoardKeyRecipientEnvelope = {
		v: BOARD_KEY_ENVELOPE_VERSION,
		alg: BOARD_KEY_ENVELOPE_ALGORITHM,
		boardId,
		recipientUserId,
		keyHash,
		recipientPublicKeyHash,
		epk,
		iv: bytesToBase64Url(iv),
		data: bytesToBase64Url(new Uint8Array(ciphertext)),
	};
	return JSON.stringify(envelope);
}

export async function decryptBoardKeyFromRecipientEnvelope(
	encryptedBoardKey: string,
	identity: UnlockedUserE2eeIdentity,
	expected?: {
		boardId?: string;
		recipientUserId?: string;
		allowLegacy?: boolean;
	},
) {
	const parsed = parseJsonObject(
		encryptedBoardKey,
		"Malformed board key recipient envelope",
	) as Partial<EncryptedBoardKeyRecipientEnvelope>;
	if (
		parsed.v !== BOARD_KEY_ENVELOPE_VERSION ||
		parsed.alg !== BOARD_KEY_ENVELOPE_ALGORITHM ||
		!parsed.epk ||
		typeof parsed.epk !== "object" ||
		Array.isArray(parsed.epk) ||
		typeof parsed.iv !== "string" ||
		typeof parsed.data !== "string"
	) {
		throw new Error("Unsupported board key recipient envelope");
	}

	const hasBinding =
		typeof parsed.boardId === "string" ||
		typeof parsed.recipientUserId === "string" ||
		typeof parsed.keyHash === "string" ||
		typeof parsed.recipientPublicKeyHash === "string";
	let additionalData: Uint8Array | undefined;
	let expectedKeyHash: string | null = null;

	if (hasBinding) {
		if (
			typeof parsed.boardId !== "string" ||
			typeof parsed.recipientUserId !== "string" ||
			typeof parsed.keyHash !== "string" ||
			typeof parsed.recipientPublicKeyHash !== "string"
		) {
			throw new Error("Incomplete board key recipient binding");
		}
		if (expected?.boardId && parsed.boardId !== expected.boardId) {
			throw new Error("Board key recipient envelope is for another board");
		}
		if (
			expected?.recipientUserId &&
			parsed.recipientUserId !== expected.recipientUserId
		) {
			throw new Error("Board key recipient envelope is for another user");
		}
		const ownPublicKeyHash = await createUserE2eePublicKeyHash(
			identity.publicKey,
		);
		if (parsed.recipientPublicKeyHash !== ownPublicKeyHash) {
			throw new Error("Board key recipient envelope is for another identity");
		}
		const binding: BoardKeyRecipientBinding = {
			boardId: parsed.boardId,
			recipientUserId: parsed.recipientUserId,
			keyHash: parsed.keyHash,
			recipientPublicKeyHash: parsed.recipientPublicKeyHash,
		};
		additionalData = boardKeyEnvelopeAad(binding);
		expectedKeyHash = parsed.keyHash;
	} else if (!expected?.allowLegacy) {
		throw new Error("Board key recipient envelope is missing binding metadata");
	}

	const privateKey = await importUserE2eePrivateKey(identity.privateKeyJwk);
	const publicKey = await getCrypto().subtle.importKey(
		"jwk",
		parsed.epk as JsonWebKey,
		{ name: "ECDH", namedCurve: "P-256" },
		false,
		[],
	);
	const wrappingKey = await deriveBoardKeyWrappingKey(privateKey, publicKey, [
		"decrypt",
	]);
	const plaintext = await getCrypto().subtle.decrypt(
		{
			name: "AES-GCM",
			iv: base64UrlToBytes(parsed.iv),
			...(additionalData ? { additionalData } : {}),
		},
		wrappingKey,
		base64UrlToBytes(parsed.data),
	);
	const boardKeyBytes = new Uint8Array(plaintext);
	if (boardKeyBytes.length !== 32) {
		throw new Error("Invalid decrypted board key");
	}
	const boardKey = bytesToBase64Url(boardKeyBytes);
	if (expectedKeyHash) {
		const actualKeyHash = await createE2eeKeyHash(boardKey);
		if (actualKeyHash !== expectedKeyHash) {
			throw new Error("Board key recipient envelope key hash mismatch");
		}
	}
	return boardKey;
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
	// Der Envelope kommt vom Server und kann theoretisch beschaedigt oder
	// manipuliert sein. Vor der Entschluesselung wird die Struktur streng geprueft,
	// damit z. B. ein fehlendes iv/data nicht erst tief in base64UrlToBytes() als
	// unverstaendlicher TypeError auffliegt, sondern hier als klarer Fehler.
	let parsed: unknown;
	try {
		parsed = JSON.parse(envelopeText);
	} catch {
		throw new Error("Malformed E2EE update envelope");
	}
	if (!parsed || typeof parsed !== "object") {
		throw new Error("Malformed E2EE update envelope");
	}
	const envelope = parsed as Partial<EncryptedYjsUpdateEnvelope>;
	if (
		envelope.v !== E2EE_ENVELOPE_VERSION ||
		envelope.alg !== E2EE_ALGORITHM ||
		typeof envelope.iv !== "string" ||
		envelope.iv.length === 0 ||
		typeof envelope.data !== "string" ||
		envelope.data.length === 0
	) {
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
