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
}: UseSkedraFileActionsOptions) {
	const { t } = useI18n();
	const pendingImportRef = useRef<SkedraFile | null>(null);
	const [importDialogOpen, setImportDialogOpen] = useState(false);
	const [fileError, setFileError] = useState("");

	const applySkedraImport = useCallback(
		(file: SkedraFile) => {
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
		],
	);

	const handleExportSkedra = useCallback(
		(filename?: string) => {
			const file = buildSkedraFile(sync.elements, sync.views, {
				canvasBg: store.canvasBg,
				viewport: store.viewport,
			});
			downloadSkedraFile(
				file,
				typeof filename === "string" ? filename : undefined,
			);
		},
		[sync.elements, sync.views, store.canvasBg, store.viewport],
	);

	const handleExportExcalidraw = useCallback(
		(filename?: string) => {
			const file = buildExcalidrawFile(sync.elements, {
				canvasBg: store.canvasBg,
				viewport: store.viewport,
			});
			downloadExcalidrawFile(
				file,
				typeof filename === "string" ? filename : undefined,
			);
		},
		[sync.elements, store.canvasBg, store.viewport],
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
				const file = buildSkedraFile(sync.elements, sync.views, {
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
		[sync.elements, sync.views, store.canvasBg, store.viewport, t],
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
			applySkedraImport(file);
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
		applySkedraImport(file);
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
