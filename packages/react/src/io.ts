import {
	buildCroppedImageUpdate,
	cloneCanvasSelection,
	convertExcalidrawLibraryGroups,
	getCombinedBBox,
} from "@skedra/canvas-core";
import {
	createSkedraElementId,
	getSkedraElementFactoryDefaults,
} from "./factories.js";
import type { CanvasElement, SavedCanvasView, Viewport } from "./types.js";

export const SKEDRA_FILE_TYPE = "skedra" as const;
export const SKEDRA_ENCRYPTED_FILE_TYPE = "skedra-encrypted" as const;
export const SKEDRA_FILE_VERSION = 1;
export const SKEDRA_FILE_MIME = "application/vnd.skedra+json";
export const SKEDRA_LIBRARY_TYPE = "skedralib" as const;
export const SKEDRA_LIBRARY_VERSION = 1;
export const SKEDRA_LIBRARY_MIME = "application/vnd.skedra.library+json";
export const SKEDRA_CLIPBOARD_TYPE = "skedra-clipboard" as const;

export interface SkedraFile {
	type: typeof SKEDRA_FILE_TYPE;
	version: number;
	source?: string;
	elements: CanvasElement[];
	views?: SavedCanvasView[];
	appState?: { canvasBg?: string; viewport?: Viewport };
}

export interface SkedraEncryptedFile {
	type: typeof SKEDRA_ENCRYPTED_FILE_TYPE;
	version: number;
	source?: string;
	algorithm: "PBKDF2-SHA256-AES-GCM";
	kdf: {
		name: "PBKDF2";
		hash: "SHA-256";
		iterations: number;
		salt: string;
	};
	iv: string;
	ciphertext: string;
}

export interface SkedraLibraryItem {
	id: string;
	name?: string;
	elements: CanvasElement[];
}

export interface SkedraLibraryFile {
	type: typeof SKEDRA_LIBRARY_TYPE;
	version: number;
	name?: string;
	source?: string;
	author?: string;
	description?: string;
	license?: "MIT";
	items: SkedraLibraryItem[];
}

export interface SkedraImageOptions {
	x?: number;
	y?: number;
	maxWidth?: number;
	maxHeight?: number;
	createId?: () => string;
	name?: string;
}

export class SkedraIoError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SkedraIoError";
	}
}

export function serializeSkedraClipboard(elements: CanvasElement[]): string {
	return JSON.stringify({
		type: SKEDRA_CLIPBOARD_TYPE,
		version: 1,
		elements,
	});
}

export function parseSkedraClipboard(value: string): CanvasElement[] {
	const parsed = parseJson(value);
	if (
		!isRecord(parsed) ||
		parsed.type !== SKEDRA_CLIPBOARD_TYPE ||
		!Array.isArray(parsed.elements)
	) {
		throw new SkedraIoError("invalidClipboard");
	}
	const elements = parsed.elements.map(decodeCanvasElement);
	if (elements.some((element) => element == null)) {
		throw new SkedraIoError("invalidClipboard");
	}
	return elements as CanvasElement[];
}

export function createSkedraFile(options: {
	elements: Iterable<CanvasElement>;
	views?: Iterable<SavedCanvasView>;
	viewport?: Viewport;
	canvasBg?: string;
	source?: string;
}): SkedraFile {
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

export function serializeSkedraFile(file: SkedraFile): string {
	return JSON.stringify(file, null, 2);
}

export function parseSkedraFile(value: string | unknown): SkedraFile {
	const parsed = typeof value === "string" ? parseJson(value) : value;
	if (!isRecord(parsed) || parsed.type !== SKEDRA_FILE_TYPE) {
		throw new SkedraIoError("invalidFormat");
	}
	if (!Number.isInteger(parsed.version) || Number(parsed.version) < 1) {
		throw new SkedraIoError("invalidVersion");
	}
	if (Number(parsed.version) > SKEDRA_FILE_VERSION) {
		throw new SkedraIoError("unsupportedVersion");
	}
	if (!Array.isArray(parsed.elements))
		throw new SkedraIoError("invalidElements");
	const elements = parsed.elements.flatMap((entry) => {
		const element = decodeCanvasElement(entry);
		return element ? [element] : [];
	});
	if (elements.length !== parsed.elements.length) {
		throw new SkedraIoError("invalidElements");
	}
	const views = Array.isArray(parsed.views)
		? parsed.views.flatMap((entry) => {
				const view = decodeSavedView(entry);
				return view ? [view] : [];
			})
		: undefined;
	return {
		type: SKEDRA_FILE_TYPE,
		version: Number(parsed.version),
		source: typeof parsed.source === "string" ? parsed.source : undefined,
		elements,
		views,
		appState: decodeAppState(parsed.appState),
	};
}

export async function encryptSkedraFile(
	file: SkedraFile,
	passphrase: string,
	iterations = 250_000,
): Promise<SkedraEncryptedFile> {
	if (!passphrase) throw new SkedraIoError("passphraseRequired");
	const cryptoApi = requireCrypto();
	const salt = cryptoApi.getRandomValues(new Uint8Array(16));
	const iv = cryptoApi.getRandomValues(new Uint8Array(12));
	const key = await deriveKey(passphrase, salt, iterations, ["encrypt"]);
	const plaintext = new TextEncoder().encode(serializeSkedraFile(file));
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

export async function decryptSkedraFile(
	value: string | SkedraEncryptedFile,
	passphrase: string,
): Promise<SkedraFile> {
	if (!passphrase) throw new SkedraIoError("passphraseRequired");
	const parsed = typeof value === "string" ? parseJson(value) : value;
	if (!isEncryptedSkedraFile(parsed)) throw new SkedraIoError("invalidFormat");
	try {
		const salt = base64ToBytes(parsed.kdf.salt);
		const key = await deriveKey(passphrase, salt, parsed.kdf.iterations, [
			"decrypt",
		]);
		const plaintext = await requireCrypto().subtle.decrypt(
			{ name: "AES-GCM", iv: toArrayBuffer(base64ToBytes(parsed.iv)) },
			key,
			toArrayBuffer(base64ToBytes(parsed.ciphertext)),
		);
		return parseSkedraFile(new TextDecoder().decode(plaintext));
	} catch (error) {
		if (error instanceof SkedraIoError) throw error;
		throw new SkedraIoError("decryptFailed");
	}
}

export async function parseSkedraFileContents(
	raw: string,
	passphrase?: string,
): Promise<SkedraFile> {
	const parsed = parseJson(raw);
	if (isEncryptedSkedraFile(parsed)) {
		if (passphrase == null) throw new SkedraIoError("passphraseRequired");
		return decryptSkedraFile(parsed, passphrase);
	}
	return parseSkedraFile(parsed);
}

export function createSkedraLibraryFile(
	items: SkedraLibraryItem[],
	meta: Omit<Partial<SkedraLibraryFile>, "type" | "version" | "items"> = {},
): SkedraLibraryFile {
	return {
		type: SKEDRA_LIBRARY_TYPE,
		version: SKEDRA_LIBRARY_VERSION,
		...meta,
		items: cloneJson(items),
	};
}

export function serializeSkedraLibrary(file: SkedraLibraryFile): string {
	return JSON.stringify(file, null, 2);
}

export function createSkedraLibraryItem(options: {
	elements: CanvasElement[];
	name?: string;
	createId?: () => string;
}): SkedraLibraryItem {
	const bounds = getCombinedBBox(options.elements);
	const groupId = (options.createId ?? createSkedraElementId)();
	return {
		id: (options.createId ?? createSkedraElementId)(),
		name: options.name,
		elements: options.elements.map((element) => ({
			...cloneJson(element),
			x: element.x - (bounds?.x ?? 0),
			y: element.y - (bounds?.y ?? 0),
			groupId,
			frameId: undefined,
			locked: false,
		})),
	};
}

export function parseSkedraLibrary(
	value: string | unknown,
	options: { createId?: () => string; stroke?: string } = {},
): SkedraLibraryFile {
	const parsed = typeof value === "string" ? parseJson(value) : value;
	if (!isRecord(parsed)) throw new SkedraIoError("invalidLibrary");
	if (parsed.type === "excalidrawlib" && Array.isArray(parsed.library)) {
		const createId = options.createId ?? createSkedraElementId;
		const converted = convertExcalidrawLibraryGroups(
			parsed.library as Record<string, unknown>[][],
			{
				createId,
				defaultFontFamily:
					getSkedraElementFactoryDefaults().fontFamily ?? "sans-serif",
				defaultStroke: options.stroke ?? "#17211d",
			},
		);
		return createSkedraLibraryFile(
			converted.map((group) =>
				createSkedraLibraryItem({
					elements: group.elements,
					name: group.name,
					createId,
				}),
			),
			{ source: "excalidraw" },
		);
	}
	if (
		parsed.type !== SKEDRA_LIBRARY_TYPE ||
		!Number.isInteger(parsed.version) ||
		Number(parsed.version) > SKEDRA_LIBRARY_VERSION ||
		!Array.isArray(parsed.items)
	) {
		throw new SkedraIoError("invalidLibrary");
	}
	const items = parsed.items.map((entry) => decodeLibraryItem(entry));
	if (items.some((item) => item == null))
		throw new SkedraIoError("invalidLibrary");
	return {
		type: SKEDRA_LIBRARY_TYPE,
		version: Number(parsed.version),
		name: stringOrUndefined(parsed.name),
		source: stringOrUndefined(parsed.source),
		author: stringOrUndefined(parsed.author),
		description: stringOrUndefined(parsed.description),
		license: parsed.license === "MIT" ? "MIT" : undefined,
		items: items as SkedraLibraryItem[],
	};
}

export function instantiateSkedraLibraryItem(options: {
	item: SkedraLibraryItem;
	existingElements?: Iterable<CanvasElement>;
	x: number;
	y: number;
	createId?: () => string;
}): CanvasElement[] {
	const bounds = getCombinedBBox(options.item.elements);
	const cloned = cloneCanvasSelection({
		elements: options.item.elements,
		existingElements: options.existingElements,
		createId: options.createId ?? createSkedraElementId,
		offset: {
			x: options.x - (bounds?.x ?? 0),
			y: options.y - (bounds?.y ?? 0),
		},
	});
	return cloned.elements;
}

export async function createSkedraImageElement(
	source: Blob | string,
	options: SkedraImageOptions = {},
): Promise<CanvasElement> {
	const src = typeof source === "string" ? source : await blobToDataUrl(source);
	const dimensions = await loadImageDimensions(src);
	const maxWidth = options.maxWidth ?? 1200;
	const maxHeight = options.maxHeight ?? 900;
	const scale = Math.min(
		1,
		maxWidth / dimensions.width,
		maxHeight / dimensions.height,
	);
	const width = Math.max(1, dimensions.width * scale);
	const height = Math.max(1, dimensions.height * scale);
	return {
		id: (options.createId ?? createSkedraElementId)(),
		type: "image",
		x: options.x ?? 0,
		y: options.y ?? 0,
		width,
		height,
		rotation: 0,
		fill: "transparent",
		stroke: "transparent",
		strokeWidth: 0,
		strokeStyle: "solid",
		opacity: 100,
		locked: false,
		groupId: null,
		flipX: false,
		flipY: false,
		customData: {
			imageSrc: src,
			imageName: options.name,
			naturalWidth: dimensions.width,
			naturalHeight: dimensions.height,
			imageCrop: { x: 0, y: 0, width: 1, height: 1 },
		},
	};
}

export function cropSkedraImage(
	element: CanvasElement,
	crop: { x: number; y: number; width: number; height: number },
): CanvasElement {
	return { ...element, ...buildCroppedImageUpdate(element, crop) };
}

export function downloadSkedraBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

function decodeCanvasElement(value: unknown): CanvasElement | null {
	if (!isRecord(value)) return null;
	if (
		typeof value.id !== "string" ||
		![
			"rectangle",
			"ellipse",
			"diamond",
			"line",
			"arrow",
			"image",
			"text",
			"freehand",
			"frame",
		].includes(String(value.type)) ||
		!["x", "y", "width", "height", "rotation", "strokeWidth", "opacity"].every(
			(key) => typeof value[key] === "number" && Number.isFinite(value[key]),
		) ||
		typeof value.fill !== "string" ||
		typeof value.stroke !== "string" ||
		!(["solid", "dashed", "dotted"] as unknown[]).includes(value.strokeStyle) ||
		typeof value.locked !== "boolean" ||
		!(value.groupId === null || typeof value.groupId === "string") ||
		typeof value.flipX !== "boolean" ||
		typeof value.flipY !== "boolean"
	) {
		return null;
	}
	return cloneJson(value) as unknown as CanvasElement;
}

function decodeSavedView(value: unknown): SavedCanvasView | null {
	if (
		!isRecord(value) ||
		typeof value.id !== "string" ||
		typeof value.name !== "string"
	) {
		return null;
	}
	if (
		!["x", "y", "width", "height", "createdAt", "updatedAt"].every(
			(key) => typeof value[key] === "number" && Number.isFinite(value[key]),
		)
	) {
		return null;
	}
	return cloneJson(value) as unknown as SavedCanvasView;
}

function decodeLibraryItem(value: unknown): SkedraLibraryItem | null {
	if (
		!isRecord(value) ||
		typeof value.id !== "string" ||
		!Array.isArray(value.elements)
	) {
		return null;
	}
	const elements = value.elements.map(decodeCanvasElement);
	if (elements.some((element) => element == null)) return null;
	return {
		id: value.id,
		name: stringOrUndefined(value.name),
		elements: elements as CanvasElement[],
	};
}

function decodeAppState(value: unknown): SkedraFile["appState"] {
	if (!isRecord(value)) return undefined;
	const viewport = isRecord(value.viewport)
		? {
				x: Number(value.viewport.x),
				y: Number(value.viewport.y),
				zoom: Number(value.viewport.zoom),
			}
		: undefined;
	return {
		canvasBg: stringOrUndefined(value.canvasBg),
		viewport:
			viewport && Object.values(viewport).every(Number.isFinite)
				? viewport
				: undefined,
	};
}

function isEncryptedSkedraFile(value: unknown): value is SkedraEncryptedFile {
	return (
		isRecord(value) &&
		value.type === SKEDRA_ENCRYPTED_FILE_TYPE &&
		value.algorithm === "PBKDF2-SHA256-AES-GCM" &&
		isRecord(value.kdf) &&
		typeof value.kdf.iterations === "number" &&
		typeof value.kdf.salt === "string" &&
		typeof value.iv === "string" &&
		typeof value.ciphertext === "string"
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value != null && !Array.isArray(value);
}

function stringOrUndefined(value: unknown) {
	return typeof value === "string" ? value : undefined;
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

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error);
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.readAsDataURL(blob);
	});
}

function loadImageDimensions(
	src: string,
): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () =>
			resolve({
				width: image.naturalWidth || 1,
				height: image.naturalHeight || 1,
			});
		image.onerror = () => reject(new SkedraIoError("invalidImage"));
		image.src = src;
	});
}
