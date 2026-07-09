import {
	decodeCanvasElements,
	encodeCanvasElements,
} from "@/lib/canvas/canvas-codecs";
import type { CanvasThemeState } from "@/lib/canvas/canvas-defaults";
import { prepareLibraryItemForStorage } from "@/lib/canvas/library-item-prepare";
import { type CanvasElement, getCombinedBBox } from "@skedra/canvas-core";
import type { SkedraLibraryFile, SkedraLibraryItem } from "@skedra/shared";
import {
	buildPublicLibraryDownloadUrl,
	normalizeLibrarySlug,
} from "@skedra/shared";
import { nanoid } from "nanoid";
import {
	LibraryImportError,
	type LibraryImportFormat,
	parseLibraryFileContents,
} from "./library-import";

export interface InstalledShapeLibrary {
	id: string;
	name: string;
	description?: string;
	author?: string;
	source?: string;
	items: SkedraLibraryItem[];
	installedAt: number;
}

/** Bibliotheks-Item an Zielposition einfuegen (neue IDs, Gruppen beibehalten). */
export function instantiateLibraryItem(
	item: SkedraLibraryItem,
	targetX: number,
	targetY: number,
): CanvasElement[] {
	const elements = decodeCanvasElements(item.elements);
	const bbox = getCombinedBBox(elements);
	const originX = bbox?.x ?? 0;
	const originY = bbox?.y ?? 0;
	const dx = targetX - originX;
	const dy = targetY - originY;

	/* Jedes Bibliotheks-Symbol = eine Gruppe (wie in Excalidraw beim Einfuegen). */
	const symbolGroupId = nanoid(8);

	return elements.map((el) => ({
		...el,
		id: nanoid(),
		x: el.x + dx,
		y: el.y + dy,
		groupId: symbolGroupId,
		frameId: undefined,
		locked: false,
		stackIndex: undefined,
	}));
}

export function installedLibraryFromFile(
	file: SkedraLibraryFile,
	format: LibraryImportFormat,
): InstalledShapeLibrary {
	const items = file.items.map((item) => {
		const elements = decodeCanvasElements(item.elements);
		return {
			...item,
			elements: encodeCanvasElements(prepareLibraryItemForStorage(elements)),
		};
	});

	return {
		id: nanoid(),
		name: file.name ?? "Imported library",
		description: file.description,
		author: file.author,
		source: file.source ?? format,
		items,
		installedAt: Date.now(),
	};
}

function getPublicLibraryApiBaseUrl() {
	if (typeof window !== "undefined") {
		return window.location.origin;
	}
	return "";
}

function buildPublicLibraryUrl(slug: string) {
	return buildPublicLibraryDownloadUrl(getPublicLibraryApiBaseUrl(), slug);
}

/** Community-Bibliothek per Slug laden (Katalog / Deep-Link). */
export async function installPublicLibraryBySlug(
	slug: string,
	theme?: CanvasThemeState,
): Promise<InstalledShapeLibrary> {
	return fetchLibraryFromUrl(buildPublicLibraryUrl(slug), theme);
}

function parseLibrarySlugFromUrl(url: string): string | null {
	try {
		const parsed = new URL(
			url,
			typeof window !== "undefined" ? window.location.origin : undefined,
		);
		const match = parsed.pathname.match(
			/\/api\/libraries\/([^/]+?)(?:\.skedralib)?$/i,
		);
		if (!match?.[1]) return null;
		return normalizeLibrarySlug(match[1]);
	} catch {
		return null;
	}
}

function isAllowedLibraryUrl(url: string): boolean {
	try {
		const parsed = new URL(
			url,
			typeof window !== "undefined" ? window.location.origin : undefined,
		);
		if (
			typeof window !== "undefined" &&
			parsed.origin === window.location.origin
		) {
			return parsed.pathname.includes("/api/libraries/");
		}
		const host = parsed.hostname.toLowerCase();
		return (
			parsed.pathname.includes("/api/libraries/") &&
			(host.endsWith("skedra.app") ||
				host === "skedra.xyz" ||
				host.endsWith(".skedra.xyz") ||
				host === "localhost" ||
				host === "127.0.0.1")
		);
	} catch {
		return false;
	}
}

export async function fetchLibraryFromUrl(
	url: string,
	theme?: CanvasThemeState,
): Promise<InstalledShapeLibrary> {
	if (!isAllowedLibraryUrl(url)) {
		throw new LibraryImportError("urlNotAllowed");
	}

	const response = await fetch(url);
	if (!response.ok) {
		throw new LibraryImportError("fetchFailed");
	}

	const text = await response.text();
	const { file, format } = parseLibraryFileContents(text, url, theme);
	const slug = parseLibrarySlugFromUrl(url);
	return {
		...installedLibraryFromFile(file, format),
		id: slug ?? nanoid(),
		name: file.name ?? slug ?? "Imported library",
		description: file.description,
		author: file.author,
		source: file.source ?? "skedra",
	};
}
