import type {
	CanvasElement,
	SavedCanvasView,
	Viewport,
} from "@skedra/canvas-core";
import { decodeCanvasElements, decodeSavedCanvasViews } from "./codecs";
import {
	SKEDRA_ENCRYPTED_FILE_TYPE,
	SKEDRA_FILE_MIME,
	SKEDRA_FILE_TYPE,
	SKEDRA_FILE_VERSION,
	type SkedraEncryptedFile,
	skedraEncryptedFileSchema,
	skedraFileSchema,
} from "./file-schema";

export {
	SKEDRA_ENCRYPTED_FILE_EXTENSION,
	SKEDRA_ENCRYPTED_FILE_TYPE,
	SKEDRA_FILE_EXTENSION,
	SKEDRA_FILE_MIME,
	SKEDRA_FILE_TYPE,
	SKEDRA_FILE_VERSION,
} from "./file-schema";
export type { SkedraEncryptedFile } from "./file-schema";

export interface CanvasSkedraFile {
	type: typeof SKEDRA_FILE_TYPE;
	version: number;
	source?: string;
	elements: CanvasElement[];
	views?: SavedCanvasView[];
	appState?: { canvasBg?: string; viewport?: Viewport };
}

export class SkedraIoError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SkedraIoError";
	}
}

export function createCanvasSkedraFile(options: {
	elements: Iterable<CanvasElement>;
	views?: Iterable<SavedCanvasView>;
	viewport?: Viewport;
	canvasBg?: string;
	source?: string;
}): CanvasSkedraFile {
	return {
		type: SKEDRA_FILE_TYPE,
		version: SKEDRA_FILE_VERSION,
		source: options.source,
		elements: cloneJson(Array.from(options.elements)),
		views: options.views ? cloneJson(Array.from(options.views)) : undefined,
		appState:
			options.viewport || options.canvasBg
				? { viewport: options.viewport, canvasBg: options.canvasBg }
				: undefined,
	};
}

export function serializeCanvasSkedraFile(file: CanvasSkedraFile): string {
	return JSON.stringify(file, null, 2);
}

export function parseCanvasSkedraFile(
	value: string | unknown,
): CanvasSkedraFile {
	const parsedValue = typeof value === "string" ? parseJson(value) : value;
	const parsed = skedraFileSchema.safeParse(parsedValue);
	if (!parsed.success) throw new SkedraIoError("invalidFormat");
	if (parsed.data.version > SKEDRA_FILE_VERSION) {
		throw new SkedraIoError("unsupportedVersion");
	}
	const elements = decodeCanvasElements(parsed.data.elements);
	if (elements.length !== parsed.data.elements.length) {
		throw new SkedraIoError("invalidElements");
	}
	const rawViews = parsed.data.views ?? [];
	const views = decodeSavedCanvasViews(rawViews);
	if (views.length !== rawViews.length) {
		throw new SkedraIoError("invalidViews");
	}
	return {
		type: SKEDRA_FILE_TYPE,
		version: parsed.data.version,
		source: parsed.data.source,
		elements,
		views: parsed.data.views ? views : undefined,
		appState: parsed.data.appState,
	};
}

export async function encryptCanvasSkedraFile(
	file: CanvasSkedraFile,
	passphrase: string,
	iterations = 250_000,
): Promise<SkedraEncryptedFile> {
	if (!passphrase) throw new SkedraIoError("passphraseRequired");
	const cryptoApi = requireCrypto();
	const salt = cryptoApi.getRandomValues(new Uint8Array(16));
	const iv = cryptoApi.getRandomValues(new Uint8Array(12));
	const key = await deriveKey(passphrase, salt, iterations, ["encrypt"]);
	const plaintext = new TextEncoder().encode(serializeCanvasSkedraFile(file));
	const ciphertext = await cryptoApi.subtle.encrypt(
		{ name: "AES-GCM", iv: toArrayBuffer(iv) },
		key,
		toArrayBuffer(plaintext),
	);
	return {
		type: SKEDRA_ENCRYPTED_FILE_TYPE,
		version: SKEDRA_FILE_VERSION,
		source: file.source,
		algorithm: "PBKDF2-SHA256-AES-GCM",
		kdf: {
			name: "PBKDF2",
			hash: "SHA-256",
			iterations,
			salt: bytesToBase64(salt),
		},
		iv: bytesToBase64(iv),
		ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
	};
}

export async function decryptCanvasSkedraFile(
	value: string | SkedraEncryptedFile,
	passphrase: string,
): Promise<CanvasSkedraFile> {
	if (!passphrase) throw new SkedraIoError("passphraseRequired");
	const parsedValue = typeof value === "string" ? parseJson(value) : value;
	const parsed = skedraEncryptedFileSchema.safeParse(parsedValue);
	if (!parsed.success) throw new SkedraIoError("invalidFormat");
	try {
		const salt = base64ToBytes(parsed.data.kdf.salt);
		const key = await deriveKey(passphrase, salt, parsed.data.kdf.iterations, [
			"decrypt",
		]);
		const plaintext = await requireCrypto().subtle.decrypt(
			{
				name: "AES-GCM",
				iv: toArrayBuffer(base64ToBytes(parsed.data.iv)),
			},
			key,
			toArrayBuffer(base64ToBytes(parsed.data.ciphertext)),
		);
		return parseCanvasSkedraFile(new TextDecoder().decode(plaintext));
	} catch (error) {
		if (error instanceof SkedraIoError) throw error;
		throw new SkedraIoError("decryptFailed");
	}
}

export async function parseCanvasSkedraFileContents(
	raw: string,
	passphrase?: string,
): Promise<CanvasSkedraFile> {
	const parsed = parseJson(raw);
	if (skedraEncryptedFileSchema.safeParse(parsed).success) {
		if (passphrase == null) throw new SkedraIoError("passphraseRequired");
		return decryptCanvasSkedraFile(parsed as SkedraEncryptedFile, passphrase);
	}
	return parseCanvasSkedraFile(parsed);
}

export function downloadCanvasBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

function parseJson(value: string): unknown {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		throw new SkedraIoError("invalidJson");
	}
}

function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function requireCrypto() {
	if (!globalThis.crypto?.subtle) throw new SkedraIoError("cryptoUnavailable");
	return globalThis.crypto;
}

async function deriveKey(
	passphrase: string,
	salt: Uint8Array,
	iterations: number,
	usages: KeyUsage[],
) {
	const cryptoApi = requireCrypto();
	const material = await cryptoApi.subtle.importKey(
		"raw",
		new TextEncoder().encode(passphrase),
		"PBKDF2",
		false,
		["deriveKey"],
	);
	return cryptoApi.subtle.deriveKey(
		{ name: "PBKDF2", hash: "SHA-256", salt: toArrayBuffer(salt), iterations },
		material,
		{ name: "AES-GCM", length: 256 },
		false,
		usages,
	);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

function bytesToBase64(bytes: Uint8Array) {
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
	}
	return btoa(binary);
}

function base64ToBytes(value: string) {
	const binary = atob(value);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
