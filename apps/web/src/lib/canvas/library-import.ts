import { encodeCanvasElements } from "@/lib/canvas/canvas-codecs";
import {
	type CanvasThemeState,
	getDefaultStrokeColor,
} from "@/lib/canvas/canvas-defaults";
import { prepareLibraryItemForStorage } from "@/lib/canvas/library-item-prepare";
import { downloadBlob } from "@/lib/download-blob";
import {
	DEFAULT_FONT_FAMILY,
	convertExcalidrawLibraryGroups,
} from "@skedra/canvas-core";
import type { SkedraLibraryFile, SkedraLibraryItem } from "@skedra/shared";
import {
	EXCALIDRAW_LIB_TYPE,
	SKEDRA_LIB_EXTENSION,
	SKEDRA_LIB_MIME,
	SKEDRA_LIB_TYPE,
	SKEDRA_LIB_VERSION,
	excalidrawLibrarySchema,
	skedraLibrarySchema,
} from "@skedra/shared";
import { nanoid } from "nanoid";

export class LibraryImportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LibraryImportError";
	}
}

export type LibraryImportFormat = "skedralib" | "excalidrawlib";

export type LibraryImportErrorKey =
	| `shapeLibrary.errors.${LibraryImportError["message"]}`
	| "shapeLibrary.errors.unknown";

/** i18n-Schluessel fuer Bibliotheks-Importfehler. */
export function getLibraryImportErrorKey(
	error: unknown,
): LibraryImportErrorKey {
	return error instanceof LibraryImportError
		? (`shapeLibrary.errors.${error.message}` as const)
		: "shapeLibrary.errors.unknown";
}

export function buildSkedraLibraryFile(
	items: SkedraLibraryItem[],
	meta?: {
		name?: string;
		author?: string;
		description?: string;
		source?: string;
	},
): SkedraLibraryFile {
	return {
		type: SKEDRA_LIB_TYPE,
		version: SKEDRA_LIB_VERSION,
		name: meta?.name,
		author: meta?.author,
		description: meta?.description,
		source:
			meta?.source ??
			(typeof window !== "undefined"
				? window.location.origin
				: "https://skedra.app"),
		items,
	};
}

function parseSkedraLibraryContents(raw: string): SkedraLibraryFile {
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		throw new LibraryImportError("invalidJson");
	}

	const parsed = skedraLibrarySchema.safeParse(json);
	if (!parsed.success) {
		throw new LibraryImportError("invalidFormat");
	}

	if (parsed.data.version > SKEDRA_LIB_VERSION) {
		throw new LibraryImportError("unsupportedVersion");
	}

	return parsed.data;
}

function parseExcalidrawLibraryContents(
	raw: string,
	theme?: CanvasThemeState,
): {
	name?: string;
	items: SkedraLibraryItem[];
} {
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		throw new LibraryImportError("invalidJson");
	}

	const parsed = excalidrawLibrarySchema.safeParse(json);
	if (!parsed.success) {
		throw new LibraryImportError("invalidFormat");
	}

	const convertedGroups = convertExcalidrawLibraryGroups(parsed.data.library, {
		createId: nanoid,
		defaultFontFamily: DEFAULT_FONT_FAMILY,
		defaultStroke: getDefaultStrokeColor(theme),
	});

	const items: SkedraLibraryItem[] = convertedGroups.map((group, index) => ({
		id: `excal-${index}-${nanoid(6)}`,
		name: group.name,
		elements: encodeCanvasElements(
			prepareLibraryItemForStorage(group.elements),
		),
	}));

	if (items.length === 0) {
		throw new LibraryImportError("emptyLibrary");
	}

	return {
		name: EXCALIDRAW_LIB_TYPE,
		items,
	};
}

/** Parst .skedralib oder .excalidrawlib. */
export function parseLibraryFileContents(
	raw: string,
	filename?: string,
	theme?: CanvasThemeState,
): { file: SkedraLibraryFile; format: LibraryImportFormat } {
	const lower = filename?.toLowerCase() ?? "";
	if (lower.endsWith(".excalidrawlib")) {
		const { name, items } = parseExcalidrawLibraryContents(raw, theme);
		return {
			format: "excalidrawlib",
			file: buildSkedraLibraryFile(items, {
				name: name ?? "Imported Excalidraw Library",
				source: "excalidraw",
			}),
		};
	}

	try {
		const file = parseSkedraLibraryContents(raw);
		return { file, format: "skedralib" };
	} catch (error) {
		if (
			error instanceof LibraryImportError &&
			error.message === "invalidFormat"
		) {
			const { items } = parseExcalidrawLibraryContents(raw, theme);
			return {
				format: "excalidrawlib",
				file: buildSkedraLibraryFile(items, { source: "excalidraw" }),
			};
		}
		throw error;
	}
}

function serializeSkedraLibrary(file: SkedraLibraryFile): string {
	return JSON.stringify(file, null, 2);
}

export function downloadSkedraLibrary(
	file: SkedraLibraryFile,
	filename = `skedra-library.${SKEDRA_LIB_EXTENSION}`,
) {
	const safeName =
		typeof filename === "string" && filename.length > 0
			? filename
			: `skedra-library.${SKEDRA_LIB_EXTENSION}`;
	const blob = new Blob([serializeSkedraLibrary(file)], {
		type: SKEDRA_LIB_MIME,
	});
	downloadBlob(
		blob,
		safeName.endsWith(`.${SKEDRA_LIB_EXTENSION}`)
			? safeName
			: `${safeName}.${SKEDRA_LIB_EXTENSION}`,
	);
}

export function pickLibraryFile(theme?: CanvasThemeState): Promise<{
	file: SkedraLibraryFile;
	format: LibraryImportFormat;
}> {
	return new Promise((resolve, reject) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = `.${SKEDRA_LIB_EXTENSION},.excalidrawlib,application/json`;

		input.onchange = () => {
			const picked = input.files?.[0];
			if (!picked) {
				reject(new LibraryImportError("cancelled"));
				return;
			}

			void picked
				.text()
				.then((text) =>
					resolve(parseLibraryFileContents(text, picked.name, theme)),
				)
				.catch(reject);
		};

		input.click();
	});
}
