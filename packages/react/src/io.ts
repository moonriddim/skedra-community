import {
	buildCroppedImageUpdate,
	cloneCanvasSelection,
	convertExcalidrawLibraryGroups,
	getCombinedBBox,
} from "@skedra/canvas-core";
import { decodeCanvasElement } from "@skedra/canvas-io/codecs";
import {
	SKEDRA_ENCRYPTED_FILE_TYPE as SHARED_ENCRYPTED_FILE_TYPE,
	SKEDRA_FILE_MIME as SHARED_FILE_MIME,
	SKEDRA_FILE_TYPE as SHARED_FILE_TYPE,
	SKEDRA_FILE_VERSION as SHARED_FILE_VERSION,
	SkedraIoError as SharedSkedraIoError,
	createCanvasSkedraFile,
	decryptCanvasSkedraFile,
	downloadCanvasBlob,
	encryptCanvasSkedraFile,
	parseCanvasSkedraFile,
	parseCanvasSkedraFileContents,
	serializeCanvasSkedraFile,
} from "@skedra/canvas-io/file";
import {
	createSkedraElementId,
	getSkedraElementFactoryDefaults,
} from "./factories.js";
import type { CanvasElement, SavedCanvasView, Viewport } from "./types.js";

export const SKEDRA_FILE_TYPE = SHARED_FILE_TYPE;
export const SKEDRA_ENCRYPTED_FILE_TYPE = SHARED_ENCRYPTED_FILE_TYPE;
export const SKEDRA_FILE_VERSION = SHARED_FILE_VERSION;
export const SKEDRA_FILE_MIME = SHARED_FILE_MIME;
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

function throwPublicIoError(error: unknown): never {
	if (error instanceof SharedSkedraIoError) {
		throw new SkedraIoError(error.message);
	}
	throw error;
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
	return createCanvasSkedraFile(options) as SkedraFile;
}

export function serializeSkedraFile(file: SkedraFile): string {
	return serializeCanvasSkedraFile(file);
}

export function parseSkedraFile(value: string | unknown): SkedraFile {
	try {
		return parseCanvasSkedraFile(value) as SkedraFile;
	} catch (error) {
		throwPublicIoError(error);
	}
}

export async function encryptSkedraFile(
	file: SkedraFile,
	passphrase: string,
	iterations = 250_000,
): Promise<SkedraEncryptedFile> {
	try {
		return (await encryptCanvasSkedraFile(
			file,
			passphrase,
			iterations,
		)) as SkedraEncryptedFile;
	} catch (error) {
		throwPublicIoError(error);
	}
}

export async function decryptSkedraFile(
	value: string | SkedraEncryptedFile,
	passphrase: string,
): Promise<SkedraFile> {
	try {
		return (await decryptCanvasSkedraFile(value, passphrase)) as SkedraFile;
	} catch (error) {
		throwPublicIoError(error);
	}
}

export async function parseSkedraFileContents(
	raw: string,
	passphrase?: string,
): Promise<SkedraFile> {
	try {
		return (await parseCanvasSkedraFileContents(raw, passphrase)) as SkedraFile;
	} catch (error) {
		throwPublicIoError(error);
	}
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
	downloadCanvasBlob(blob, filename);
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
