/**
 * .skedra Import/Export und Bestätigungsdialog bei bestehendem Inhalt.
 */

import {
	loadBoardCanvasViewport,
	loadGuestCanvasViewport,
	saveBoardCanvasViewport,
	saveGuestCanvasViewport,
} from "@/lib/canvas/canvas-viewport-storage";
import {
	type SkedraCanvasFileActions,
	SkedraFileError,
	buildExcalidrawFile,
	buildSkedraFile,
	downloadEncryptedSkedraFile,
	downloadExcalidrawFile,
	downloadSkedraFile,
	pickSkedraFile,
	readSkedraFileAppState,
} from "@/lib/canvas/skedra-file-utils";
import { useI18n } from "@/lib/i18n";
import type { CanvasElement, SavedCanvasView } from "@skedra/canvas-core";
import type { CanvasSkedraFile as SkedraFile } from "@skedra/canvas-io/file";
import { useCallback, useEffect, useRef, useState } from "react";

interface CanvasSyncSlice {
	elements: Map<string, CanvasElement>;
	views: Map<string, SavedCanvasView>;
	loadSkedraFile: (file: SkedraFile) => void;
}

interface CanvasStoreSlice {
	canvasBg: string;
	viewport: { x: number; y: number; zoom: number };
	setCanvasBg: (bg: string) => void;
	setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
}

interface HistorySlice {
	clearHistory: () => void;
}

interface UseSkedraFileActionsOptions {
	sync: CanvasSyncSlice;
	store: CanvasStoreSlice;
	history: HistorySlice;
	clearSelection: () => void;
	localMode?: boolean;
	whiteboardId?: string;
	canvasFileRef?: React.MutableRefObject<SkedraCanvasFileActions | null>;
	onImportApplied?: () => void;
	/**
	 * Wird vor dem Übernehmen einer importierten Datei aufgerufen, z. B. um
	 * eingebettete Bilder (Excalidraw-Dateien) als Assets hochzuladen.
	 */
	prepareImportedElements?: (
		elements: CanvasElement[],
	) => Promise<CanvasElement[]>;
	/**
	 * Wird vor jedem Datei-Export aufgerufen. Bettet Bilder ein, die nur als
	 * board-gebundener Asset-Verweis vorliegen, damit die Datei auch außerhalb
	 * dieses Boards vollständig ist. `failed` = nicht einbettbare Bilder.
	 */
	prepareExportedElements?: (
		elements: CanvasElement[],
	) => Promise<{ value: CanvasElement[]; failed: number }>;
}

export function useSkedraFileActions({
	sync,
	store,
	history,
	clearSelection,
	localMode = false,
	whiteboardId,
	canvasFileRef,
	onImportApplied,
	prepareImportedElements,
	prepareExportedElements,
}: UseSkedraFileActionsOptions) {
	const { t } = useI18n();
	const pendingImportRef = useRef<SkedraFile | null>(null);
	const [importDialogOpen, setImportDialogOpen] = useState(false);
	const [fileError, setFileError] = useState("");

	const applySkedraImport = useCallback(
		async (sourceFile: SkedraFile) => {
			// Bilder vor dem Import auslagern; scheitert das, bleibt die Datei, wie sie ist.
			const file = prepareImportedElements
				? {
						...sourceFile,
						elements: await prepareImportedElements(sourceFile.elements).catch(
							() => sourceFile.elements,
						),
					}
				: sourceFile;
			sync.loadSkedraFile(file);
			const { canvasBg, viewport } = readSkedraFileAppState(file);
			if (canvasBg != null) {
				store.setCanvasBg(canvasBg);
			}
			if (viewport) {
				store.setViewport(viewport);
				if (localMode) {
					saveGuestCanvasViewport(viewport);
				} else if (whiteboardId) {
					saveBoardCanvasViewport(whiteboardId, viewport);
				}
			}
			clearSelection();
			onImportApplied?.();
			setFileError("");
			history.clearHistory();
		},
		[
			sync,
			store,
			localMode,
			whiteboardId,
			clearSelection,
			history,
			onImportApplied,
			prepareImportedElements,
		],
	);

	/** Elemente für den Export, mit eingebetteten Bildern (siehe Option). */
	const getPortableElements = useCallback(async () => {
		if (!prepareExportedElements) return sync.elements;
		const { value, failed } = await prepareExportedElements(
			Array.from(sync.elements.values()),
		);
		// Der Export läuft trotzdem; fehlende Bilder werden nur gemeldet.
		if (failed > 0) {
			setFileError(t("skedraFile.errors.assetsNotEmbedded", { count: failed }));
		}
		return new Map(value.map((element) => [element.id, element] as const));
	}, [prepareExportedElements, sync.elements, t]);

	const handleExportSkedra = useCallback(
		async (filename?: string) => {
			setFileError("");
			const file = buildSkedraFile(await getPortableElements(), sync.views, {
				canvasBg: store.canvasBg,
				viewport: store.viewport,
			});
			downloadSkedraFile(
				file,
				typeof filename === "string" ? filename : undefined,
			);
		},
		[getPortableElements, sync.views, store.canvasBg, store.viewport],
	);

	const handleExportExcalidraw = useCallback(
		async (filename?: string) => {
			setFileError("");
			// Excalidraw übernimmt Bilder nur, wenn sie als data:-URL vorliegen.
			const file = buildExcalidrawFile(await getPortableElements(), {
				canvasBg: store.canvasBg,
				viewport: store.viewport,
			});
			downloadExcalidrawFile(
				file,
				typeof filename === "string" ? filename : undefined,
			);
		},
		[getPortableElements, store.canvasBg, store.viewport],
	);

	const handleExportEncryptedSkedra = useCallback(
		async (filename?: string) => {
			setFileError("");
			const passphrase = window.prompt(
				t("skedraFile.encryptedPassphrasePrompt"),
			);
			if (passphrase == null) return;
			if (!passphrase || passphrase.length < 8) {
				setFileError(t("skedraFile.errors.passphraseRequired"));
				return;
			}

			try {
				const file = buildSkedraFile(await getPortableElements(), sync.views, {
					canvasBg: store.canvasBg,
					viewport: store.viewport,
				});
				await downloadEncryptedSkedraFile(
					file,
					passphrase,
					typeof filename === "string" ? filename : undefined,
				);
			} catch (error) {
				const key =
					error instanceof SkedraFileError
						? (`skedraFile.errors.${error.message}` as const)
						: "skedraFile.errors.unknown";
				setFileError(t(key));
			}
		},
		[getPortableElements, sync.views, store.canvasBg, store.viewport, t],
	);

	const handleImportSkedra = useCallback(async () => {
		setFileError("");
		try {
			const file = await pickSkedraFile({
				getPassphrase: () =>
					window.prompt(t("skedraFile.encryptedImportPassphrasePrompt")),
			});
			if (sync.elements.size > 0 || sync.views.size > 0) {
				pendingImportRef.current = file;
				setImportDialogOpen(true);
				return;
			}
			await applySkedraImport(file);
		} catch (error) {
			if (error instanceof SkedraFileError && error.message === "cancelled")
				return;
			const key =
				error instanceof SkedraFileError
					? (`skedraFile.errors.${error.message}` as const)
					: "skedraFile.errors.unknown";
			setFileError(t(key));
		}
	}, [applySkedraImport, sync.elements.size, sync.views.size, t]);

	const handleConfirmSkedraImport = useCallback(() => {
		const file = pendingImportRef.current;
		if (!file) {
			setImportDialogOpen(false);
			return;
		}
		void applySkedraImport(file);
		pendingImportRef.current = null;
		setImportDialogOpen(false);
	}, [applySkedraImport]);

	useEffect(() => {
		if (!canvasFileRef) return;
		canvasFileRef.current = {
			exportSkedra: handleExportSkedra,
			exportExcalidraw: handleExportExcalidraw,
			exportEncryptedSkedra: handleExportEncryptedSkedra,
			importSkedra: handleImportSkedra,
		};
		return () => {
			canvasFileRef.current = null;
		};
	}, [
		canvasFileRef,
		handleExportEncryptedSkedra,
		handleExportExcalidraw,
		handleExportSkedra,
		handleImportSkedra,
	]);

	return {
		importDialogOpen,
		setImportDialogOpen,
		fileError,
		setFileError,
		handleImportSkedra,
		handleExportSkedra,
		handleExportExcalidraw,
		handleExportEncryptedSkedra,
		handleConfirmSkedraImport,
	};
}
