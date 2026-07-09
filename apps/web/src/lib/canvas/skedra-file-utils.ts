/**
 * .skedra-Dateiformat: JSON-basierter Export/Import der Canvas-Szene
 * (Elemente, Views, Hintergrund, Viewport) — analog zu Excalidraw .excalidraw.
 */

import {
	decodeCanvasElements,
	decodeSavedCanvasViews,
	encodeCanvasElements,
	encodeSavedCanvasViews,
} from "@/lib/canvas/canvas-codecs";
import {
	buildReplaceAllHistoryEntry,
	transactLocalUndo,
} from "@/lib/canvas/canvas-undo";
import { objectToYMap } from "@/lib/canvas/yjs-document-helpers";
import { downloadBlob } from "@/lib/download-blob";
import type {
	CanvasElement,
	SavedCanvasView,
	Viewport,
} from "@skedra/canvas-core";
import {
	SKEDRA_ENCRYPTED_FILE_EXTENSION,
	SKEDRA_ENCRYPTED_FILE_TYPE,
	SKEDRA_FILE_EXTENSION,
	SKEDRA_FILE_MIME,
	SKEDRA_FILE_TYPE,
	SKEDRA_FILE_VERSION,
	type SkedraEncryptedFile,
	type SkedraFile,
	type SkedraFileAppState,
	skedraEncryptedFileSchema,
	skedraFileSchema,
} from "@skedra/shared";
import type * as Y from "yjs";

export class SkedraFileError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SkedraFileError";
	}
}

export interface SkedraCanvasFileActions {
	exportSkedra: (filename?: string) => void;
	exportEncryptedSkedra: (filename?: string) => Promise<void>;
	importSkedra: () => Promise<void>;
}

/** Baut eine .skedra-Datei aus dem aktuellen Canvas-Zustand. */
export function buildSkedraFile(
	elements: Map<string, CanvasElement>,
	views: Map<string, SavedCanvasView>,
	appState: SkedraFileAppState,
): SkedraFile {
	return {
		type: SKEDRA_FILE_TYPE,
		version: SKEDRA_FILE_VERSION,
		source:
			typeof window !== "undefined"
				? window.location.origin
				: "https://skedra.app",
		elements: encodeCanvasElements(elements.values()),
		views: encodeSavedCanvasViews(views.values()),
		appState,
	};
}

function parseSkedraFileJson(json: unknown): SkedraFile {
	const parsed = skedraFileSchema.safeParse(json);
	if (!parsed.success) {
		throw new SkedraFileError("invalidFormat");
	}

	if (parsed.data.version > SKEDRA_FILE_VERSION) {
		throw new SkedraFileError("unsupportedVersion");
	}

	return parsed.data;
}

/** Parst und validiert JSON-Inhalt einer .skedra-Datei. */
async function parseSkedraFileContents(
	raw: string,
	options?: { getPassphrase?: () => string | null },
): Promise<SkedraFile> {
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		throw new SkedraFileError("invalidJson");
	}

	const encrypted = skedraEncryptedFileSchema.safeParse(json);
	if (encrypted.success) {
		const passphrase =
			options?.getPassphrase?.() ??
			window.prompt("Enter the passphrase for this encrypted Skedra file");
		if (passphrase == null) throw new SkedraFileError("cancelled");
		if (!passphrase) throw new SkedraFileError("passphraseRequired");
		return decryptSkedraFile(encrypted.data, passphrase);
	}

	return parseSkedraFileJson(json);
}

const ENCRYPTED_FILE_ALGORITHM = "PBKDF2-SHA256-AES-GCM" as const;
const ENCRYPTED_FILE_KDF_ITERATIONS = 250_000;

function getCrypto() {
	if (!globalThis.crypto?.subtle) {
		throw new SkedraFileError("encryptedUnsupported");
	}
	return globalThis.crypto;
}

function bytesToBase64(bytes: Uint8Array) {
	let binary = "";
	const chunkSize = 0x8000;
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binary += String.fromCharCode(
			...bytes.subarray(offset, offset + chunkSize),
		);
	}
	return btoa(binary);
}

function base64ToBytes(value: string) {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

async function deriveSkedraFileKey(
	passphrase: string,
	salt: Uint8Array,
	iterations = ENCRYPTED_FILE_KDF_ITERATIONS,
) {
	const cryptoApi = getCrypto();
	const encoder = new TextEncoder();
	const keyMaterial = await cryptoApi.subtle.importKey(
		"raw",
		encoder.encode(passphrase),
		"PBKDF2",
		false,
		["deriveKey"],
	);
	return cryptoApi.subtle.deriveKey(
		{
			name: "PBKDF2",
			hash: "SHA-256",
			salt: bytesToArrayBuffer(salt),
			iterations,
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

async function encryptSkedraFile(
	file: SkedraFile,
	passphrase: string,
): Promise<SkedraEncryptedFile> {
	const cryptoApi = getCrypto();
	const salt = cryptoApi.getRandomValues(new Uint8Array(16));
	const iv = cryptoApi.getRandomValues(new Uint8Array(12));
	const key = await deriveSkedraFileKey(passphrase, salt);
	const plaintext = new TextEncoder().encode(serializeSkedraFile(file));
	const ciphertext = await cryptoApi.subtle.encrypt(
		{ name: "AES-GCM", iv: bytesToArrayBuffer(iv) },
		key,
		bytesToArrayBuffer(plaintext),
	);

	return {
		type: SKEDRA_ENCRYPTED_FILE_TYPE,
		version: 1,
		source:
			typeof window !== "undefined"
				? window.location.origin
				: "https://skedra.app",
		algorithm: ENCRYPTED_FILE_ALGORITHM,
		kdf: {
			name: "PBKDF2",
			hash: "SHA-256",
			iterations: ENCRYPTED_FILE_KDF_ITERATIONS,
			salt: bytesToBase64(salt),
		},
		iv: bytesToBase64(iv),
		ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
	};
}

async function decryptSkedraFile(
	file: SkedraEncryptedFile,
	passphrase: string,
): Promise<SkedraFile> {
	try {
		const key = await deriveSkedraFileKey(
			passphrase,
			base64ToBytes(file.kdf.salt),
			file.kdf.iterations,
		);
		const plaintext = await getCrypto().subtle.decrypt(
			{ name: "AES-GCM", iv: bytesToArrayBuffer(base64ToBytes(file.iv)) },
			key,
			bytesToArrayBuffer(base64ToBytes(file.ciphertext)),
		);
		const raw = new TextDecoder().decode(plaintext);
		return parseSkedraFileJson(JSON.parse(raw));
	} catch (error) {
		if (error instanceof SkedraFileError) throw error;
		throw new SkedraFileError("decryptFailed");
	}
}

/** Ersetzt Elemente und Views im Y.Doc mit dem Inhalt einer .skedra-Datei. */
export function applySkedraFileToYDoc(ydoc: Y.Doc, file: SkedraFile) {
	const elements = decodeCanvasElements(file.elements);
	const views = decodeSavedCanvasViews(file.views ?? []);
	const entry = buildReplaceAllHistoryEntry(ydoc, elements, views);

	transactLocalUndo(
		ydoc,
		() => {
			const yElements = ydoc.getMap<Y.Map<unknown>>("elementsMap");
			const yViews = ydoc.getMap<Y.Map<unknown>>("viewsMap");
			yElements.clear();
			yViews.clear();

			for (const element of elements) {
				if (!element?.id) continue;
				yElements.set(element.id, objectToYMap(element));
			}
			for (const view of views) {
				if (!view?.id) continue;
				yViews.set(view.id, objectToYMap(view));
			}
		},
		entry,
	);
}

/** Laedt den appState aus einer .skedra-Datei fuer den Zustand-Store. */
export function readSkedraFileAppState(file: SkedraFile): {
	canvasBg?: string;
	viewport?: Viewport;
} {
	const appState = file.appState;
	if (!appState) return {};

	return {
		canvasBg: appState.canvasBg,
		viewport: appState.viewport,
	};
}

function serializeSkedraFile(file: SkedraFile): string {
	return JSON.stringify(file, null, 2);
}

export function downloadSkedraFile(
	file: SkedraFile,
	filename = `skedra-whiteboard.${SKEDRA_FILE_EXTENSION}`,
) {
	const safeName =
		typeof filename === "string" && filename.length > 0
			? filename
			: `skedra-whiteboard.${SKEDRA_FILE_EXTENSION}`;
	const blob = new Blob([serializeSkedraFile(file)], {
		type: SKEDRA_FILE_MIME,
	});
	downloadBlob(
		blob,
		safeName.endsWith(`.${SKEDRA_FILE_EXTENSION}`)
			? safeName
			: `${safeName}.${SKEDRA_FILE_EXTENSION}`,
	);
}

export async function downloadEncryptedSkedraFile(
	file: SkedraFile,
	passphrase: string,
	filename = `skedra-whiteboard.${SKEDRA_ENCRYPTED_FILE_EXTENSION}`,
) {
	const safeName =
		typeof filename === "string" && filename.length > 0
			? filename.replace(new RegExp(`\\.${SKEDRA_FILE_EXTENSION}$`), "")
			: "skedra-whiteboard";
	const encrypted = await encryptSkedraFile(file, passphrase);
	const blob = new Blob([JSON.stringify(encrypted, null, 2)], {
		type: SKEDRA_FILE_MIME,
	});
	downloadBlob(
		blob,
		safeName.endsWith(`.${SKEDRA_ENCRYPTED_FILE_EXTENSION}`)
			? safeName
			: `${safeName}.${SKEDRA_ENCRYPTED_FILE_EXTENSION}`,
	);
}

/** Oeffnet einen Datei-Picker und gibt die geparste .skedra-Datei zurueck. */
export function pickSkedraFile(options?: {
	getPassphrase?: () => string | null;
}): Promise<SkedraFile> {
	return new Promise((resolve, reject) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = `.${SKEDRA_FILE_EXTENSION},.${SKEDRA_ENCRYPTED_FILE_EXTENSION},application/json,${SKEDRA_FILE_MIME}`;

		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) {
				reject(new SkedraFileError("cancelled"));
				return;
			}

			void file
				.text()
				.then((text) => parseSkedraFileContents(text, options))
				.then(resolve)
				.catch(reject);
		};

		input.click();
	});
}
