/**
 * .skedra-Dateiformat: JSON-basierter Export/Import der Canvas-Szene
 * (Elemente, Views, Hintergrund, Viewport) — analog zu Excalidraw .excalidraw.
 */

import {
	decodeCanvasElements,
	decodeSavedCanvasViews,
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
	SKEDRA_FILE_EXTENSION,
	SKEDRA_FILE_MIME,
	type SkedraEncryptedFile,
	type CanvasSkedraFile as SkedraFile,
	SkedraIoError as SkedraFileError,
	createCanvasSkedraFile,
	encryptCanvasSkedraFile,
	parseCanvasSkedraFileContents,
	serializeCanvasSkedraFile,
} from "@skedra/canvas-io/file";
import type { SkedraFileAppState } from "@skedra/shared";
import type * as Y from "yjs";

export { SkedraFileError };

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
	return createCanvasSkedraFile({
		elements: elements.values(),
		views: views.values(),
		canvasBg: appState?.canvasBg,
		viewport: appState?.viewport,
		source:
			typeof window !== "undefined"
				? window.location.origin
				: "https://skedra.app",
	});
}

/** Parst und validiert JSON-Inhalt einer .skedra-Datei. */
async function parseSkedraFileContents(
	raw: string,
	options?: { getPassphrase?: () => string | null },
): Promise<SkedraFile> {
	try {
		return await parseCanvasSkedraFileContents(raw);
	} catch (error) {
		if (!(error instanceof SkedraFileError)) throw error;
		if (error.message !== "passphraseRequired") throw error;
		const passphrase =
			options?.getPassphrase?.() ??
			window.prompt("Enter the passphrase for this encrypted Skedra file");
		if (passphrase == null) throw new SkedraFileError("cancelled");
		return parseCanvasSkedraFileContents(raw, passphrase);
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

export function downloadSkedraFile(
	file: SkedraFile,
	filename = `skedra-whiteboard.${SKEDRA_FILE_EXTENSION}`,
) {
	const safeName =
		typeof filename === "string" && filename.length > 0
			? filename
			: `skedra-whiteboard.${SKEDRA_FILE_EXTENSION}`;
	const blob = new Blob([serializeCanvasSkedraFile(file)], {
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
	const encrypted: SkedraEncryptedFile = await encryptCanvasSkedraFile(
		file,
		passphrase,
	);
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
