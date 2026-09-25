/**
 * Wiederverwendbare Tastatur-Operationen auf der Canvas-Selektion.
 */

import { isTextEditableElement } from "@/components/canvas/hooks/use-canvas-text-editing";
import { useCanvasStoreRef } from "@/hooks/use-canvas-store";
import { CANVAS_DEFAULT_FONT } from "@/lib/canvas/canvas-defaults";
import {
	type AlignEdge,
	type DistributionAxis,
	getAlignmentUpdates,
	getDistributionUpdates,
} from "@skedra/canvas-core";
import type { CanvasElement, CanvasElementFormat } from "@skedra/canvas-core";
import {
	buildBringForwardUpdates,
	buildBringToFrontUpdates,
	buildCanvasBindingSyncUpdates,
	buildCanvasElementFormatUpdates,
	buildSendBackwardUpdates,
	buildSendToBackUpdates,
	buildStickyNoteFontSizeChange,
	cloneCanvasSelection,
	cloneTransformedCanvasSelection,
	createSelectionFrame,
	getCanvasElementFormat,
	getCanvasPasteOffset,
	getFlipUpdates,
	getGroupUpdates,
	getLockUpdates,
	getRotateUpdates,
	serializeExcalidrawClipboard,
} from "@skedra/canvas-core";
import {
	parseCanvasClipboardDataTransfer,
	parseCanvasClipboardText,
	writeCanvasClipboardDataTransfer,
} from "@skedra/canvas-io/clipboard";
import { nanoid } from "nanoid";
import { useCallback, useRef } from "react";

interface UseCanvasKeyboardOperationsOptions {
	elements: Map<string, CanvasElement>;
	createElement: (el: CanvasElement) => void;
	deleteElements: (ids: string[]) => void;
	updateElements: (
		updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
	) => void;
	getPastePoint?: () => { x: number; y: number };
	/**
	 * Optionaler asynchroner Schritt vor dem Einfügen fremder Inhalte, z. B. um
	 * eingebettete Bilder als Assets hochzuladen. Wird nur aufgerufen, wenn
	 * `needsPreparation` für die eingefügten Elemente `true` liefert; sonst bleibt
	 * das Einfügen synchron.
	 */
	prepareImportedElements?: {
		needsPreparation: (elements: CanvasElement[]) => boolean;
		prepare: (elements: CanvasElement[]) => Promise<CanvasElement[]>;
	};
	/**
	 * Macht kopierte Elemente boardübergreifend nutzbar, indem Bilder als
	 * data:-URL in die System-Zwischenablage kommen. `embedSync` nutzt bereits
	 * vorbereitete Bilder; fehlt noch etwas, schreibt `embedAsync` die
	 * Zwischenablage kurz danach vollständig neu.
	 */
	portableCopy?: {
		embedSync: (elements: CanvasElement[]) => {
			value: CanvasElement[];
			missing: number;
		};
		embedAsync: (
			elements: CanvasElement[],
		) => Promise<{ value: CanvasElement[]; failed: number }>;
	};
}

export function useCanvasKeyboardOperations({
	elements,
	createElement,
	deleteElements,
	updateElements,
	getPastePoint,
	prepareImportedElements,
	portableCopy,
}: UseCanvasKeyboardOperationsOptions) {
	const storeRef = useCanvasStoreRef();
	const clipboardRef = useRef<CanvasElement[]>([]);
	// Zählt Kopiervorgänge, damit ein verspätetes Nachschreiben nie eine neuere
	// Kopie überschreibt.
	const copyGenerationRef = useRef(0);
	const formatClipboardRef = useRef<CanvasElementFormat | null>(null);

	const getSelected = useCallback(() => {
		const store = storeRef.current;
		return Array.from(store.selectedIds)
			.map((id) => elements.get(id))
			.filter(Boolean) as CanvasElement[];
	}, [storeRef, elements]);
	const updateGeometryWithBindings = useCallback(
		(updates: Array<{ id: string; changes: Partial<CanvasElement> }>) => {
			updateElements([
				...updates,
				...buildCanvasBindingSyncUpdates(elements, updates),
			]);
		},
		[elements, updateElements],
	);

	const copySelection = useCallback(
		(dataTransfer?: Pick<DataTransfer, "setData">) => {
			const sel = getSelected();
			if (sel.length === 0) return [];
			// Die interne Zwischenablage (Duplizieren, Einfügen im selben Board)
			// behält die Asset-Verweise; nur die System-Zwischenablage bekommt
			// eingebettete Bilder.
			clipboardRef.current = sel;
			const generation = ++copyGenerationRef.current;
			const portable = portableCopy?.embedSync(sel) ?? {
				value: sel,
				missing: 0,
			};
			const canWriteText =
				typeof navigator !== "undefined" && !!navigator.clipboard?.writeText;
			if (dataTransfer) {
				writeCanvasClipboardDataTransfer(dataTransfer, portable.value);
			} else if (canWriteText) {
				void navigator.clipboard
					.writeText(serializeExcalidrawClipboard(portable.value))
					.catch(() => undefined);
			}
			// Noch nicht vorbereitete Bilder (sehr schnell nach dem Auswählen
			// kopiert): nachladen und die Zwischenablage als Text neu schreiben.
			if (portableCopy && portable.missing > 0 && canWriteText) {
				void portableCopy
					.embedAsync(sel)
					.then(({ value, failed }) => {
						if (copyGenerationRef.current !== generation) return;
						if (failed >= portable.missing) return;
						return navigator.clipboard.writeText(
							serializeExcalidrawClipboard(value),
						);
					})
					.catch(() => undefined);
			}
			return sel;
		},
		[getSelected, portableCopy],
	);

	const pasteClipboard = useCallback(
		(placement: "pointer" | "offset" = "pointer") => {
			if (clipboardRef.current.length === 0) return;
			const cloned = cloneCanvasSelection({
				elements: clipboardRef.current,
				existingElements: elements.values(),
				createId: nanoid,
				offset:
					placement === "pointer"
						? getCanvasPasteOffset(clipboardRef.current, getPastePoint?.())
						: undefined,
			});
			for (const element of cloned.elements) createElement(element);
			storeRef.current.setSelectedIds(
				new Set(cloned.elements.map((element) => element.id)),
			);
			clipboardRef.current = cloned.elements;
		},
		[createElement, elements, getPastePoint, storeRef],
	);

	const pasteImportedClipboard = useCallback(
		(imported: CanvasElement[] | null) => {
			if (imported === null) return false;
			if (imported.length === 0) return true;

			const cloned = cloneCanvasSelection({
				elements: imported,
				existingElements: elements.values(),
				createId: nanoid,
				offset: getCanvasPasteOffset(imported, getPastePoint?.()),
			});
			const insert = (prepared: CanvasElement[]) => {
				for (const element of prepared) createElement(element);
				storeRef.current.setSelectedIds(
					new Set(prepared.map((element) => element.id)),
				);
				clipboardRef.current = prepared;
			};
			if (prepareImportedElements?.needsPreparation(cloned.elements)) {
				// Z. B. Excalidraw-Paste mit Bildern: erst hochladen, dann einfügen,
				// damit die base64-Daten gar nicht erst ins Board-Log gelangen.
				// Bei einem Fehler wird unverändert (inline) eingefügt.
				void prepareImportedElements
					.prepare(cloned.elements)
					.catch(() => cloned.elements)
					.then(insert);
				return true;
			}
			insert(cloned.elements);
			return true;
		},
		[createElement, elements, getPastePoint, prepareImportedElements, storeRef],
	);
	const pasteTextFromClipboard = useCallback(
		(text: string) =>
			pasteImportedClipboard(
				parseCanvasClipboardText(text, {
					createId: nanoid,
					defaultStroke: storeRef.current.strokeColor,
					defaultFontFamily: CANVAS_DEFAULT_FONT,
				}),
			),
		[pasteImportedClipboard, storeRef],
	);
	const pasteDataTransferFromClipboard = useCallback(
		(dataTransfer: Pick<DataTransfer, "getData">) =>
			pasteImportedClipboard(
				parseCanvasClipboardDataTransfer(dataTransfer, {
					createId: nanoid,
					defaultStroke: storeRef.current.strokeColor,
					defaultFontFamily: CANVAS_DEFAULT_FONT,
				}),
			),
		[pasteImportedClipboard, storeRef],
	);

	const pasteFromClipboard = useCallback(async () => {
		if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
			pasteClipboard();
			return;
		}

		try {
			const text = await navigator.clipboard.readText();
			if (!pasteTextFromClipboard(text)) pasteClipboard();
		} catch {
			pasteClipboard();
		}
	}, [pasteClipboard, pasteTextFromClipboard]);

	const cutSelection = useCallback(
		(dataTransfer?: Pick<DataTransfer, "setData">) => {
			const store = storeRef.current;
			const copied = copySelection(dataTransfer);
			if (copied.length > 0) {
				deleteElements(copied.map((element) => element.id));
				store.clearSelection();
			}
			return copied;
		},
		[copySelection, storeRef, deleteElements],
	);

	const duplicateSelection = useCallback(() => {
		copySelection();
		pasteClipboard("offset");
	}, [copySelection, pasteClipboard]);

	const copyFormat = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		formatClipboardRef.current = getCanvasElementFormat(sel[0]);
	}, [getSelected]);

	const pasteFormat = useCallback(() => {
		const fmt = formatClipboardRef.current;
		if (!fmt) return;
		const sel = getSelected();
		if (sel.length === 0) return;
		updateElements(buildCanvasElementFormatUpdates(sel, fmt));
	}, [getSelected, updateElements]);

	const bringForward = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		updateElements(
			buildBringForwardUpdates(elements.values(), storeRef.current.selectedIds),
		);
	}, [elements, getSelected, storeRef, updateElements]);

	const sendBackward = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		updateElements(
			buildSendBackwardUpdates(elements.values(), storeRef.current.selectedIds),
		);
	}, [elements, getSelected, storeRef, updateElements]);

	const bringToFront = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		updateElements(
			buildBringToFrontUpdates(elements.values(), storeRef.current.selectedIds),
		);
	}, [elements, getSelected, storeRef, updateElements]);

	const sendToBack = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		updateElements(
			buildSendToBackUpdates(elements.values(), storeRef.current.selectedIds),
		);
	}, [elements, getSelected, storeRef, updateElements]);

	const flipHorizontal = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		const transformOrigin = storeRef.current.transformOrigin ?? undefined;
		updateGeometryWithBindings(
			getFlipUpdates(sel, "horizontal", transformOrigin),
		);
		if (transformOrigin) storeRef.current.setTransformOrigin(null);
	}, [getSelected, storeRef, updateGeometryWithBindings]);

	const flipVertical = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		const transformOrigin = storeRef.current.transformOrigin ?? undefined;
		updateGeometryWithBindings(
			getFlipUpdates(sel, "vertical", transformOrigin),
		);
		if (transformOrigin) storeRef.current.setTransformOrigin(null);
	}, [getSelected, storeRef, updateGeometryWithBindings]);

	const rotateSelection = useCallback(
		(angleDelta: number) => {
			const sel = getSelected();
			if (sel.length === 0) return;
			const transformOrigin = storeRef.current.transformOrigin ?? undefined;
			updateGeometryWithBindings(
				getRotateUpdates(sel, angleDelta, transformOrigin),
			);
			if (transformOrigin) storeRef.current.setTransformOrigin(null);
		},
		[getSelected, storeRef, updateGeometryWithBindings],
	);

	const createTransformedCopy = useCallback(
		(
			transform: Parameters<
				typeof cloneTransformedCanvasSelection
			>[0]["transform"],
		) => {
			const selected = getSelected();
			if (selected.length === 0) return;
			const transformOrigin = storeRef.current.transformOrigin ?? undefined;
			const cloned = cloneTransformedCanvasSelection({
				elements: selected,
				existingElements: elements.values(),
				createId: nanoid,
				transform,
				origin: transformOrigin,
			});
			for (const element of cloned.elements) createElement(element);
			storeRef.current.setSelectedIds(
				new Set(cloned.elements.map((element) => element.id)),
			);
			if (transformOrigin) storeRef.current.setTransformOrigin(null);
		},
		[createElement, elements, getSelected, storeRef],
	);

	const copyMirrorSelection = useCallback(
		(axis: "horizontal" | "vertical") => {
			createTransformedCopy({ type: "flip", axis });
		},
		[createTransformedCopy],
	);

	const copyRotateSelection = useCallback(
		(angleDelta: number) => {
			if (!Number.isFinite(angleDelta)) return;
			createTransformedCopy({ type: "rotate", angle: angleDelta });
		},
		[createTransformedCopy],
	);

	const toggleLock = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		updateElements(getLockUpdates(sel));
	}, [getSelected, updateElements]);

	const addLink = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		const url = window.prompt("Link-URL eingeben:", sel[0].link || "");
		if (url !== null) {
			updateElements(
				sel.map((el) => ({ id: el.id, changes: { link: url || undefined } })),
			);
		}
	}, [getSelected, updateElements]);

	const embedInFrame = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;

		const planned = createSelectionFrame({
			elements: sel,
			existingElements: elements.values(),
			createId: nanoid,
		});
		if (!planned) return;
		createElement(planned.frame);
		updateElements(planned.updates);
		storeRef.current.setSelectedIds(
			new Set([planned.frame.id, ...sel.map((el) => el.id)]),
		);
	}, [elements, getSelected, createElement, updateElements, storeRef]);

	const removeFromFrame = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		updateElements(
			sel.map((el) => ({ id: el.id, changes: { frameId: undefined } })),
		);
	}, [getSelected, updateElements]);

	const groupSelection = useCallback(() => {
		const sel = getSelected();
		if (sel.length < 2) return;
		updateElements(getGroupUpdates(sel, nanoid()));
	}, [getSelected, updateElements]);

	const ungroupSelection = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		updateElements(getGroupUpdates(sel, null));
	}, [getSelected, updateElements]);

	const alignSelection = useCallback(
		(edge: AlignEdge) => {
			const sel = getSelected();
			if (sel.length < 2) return;
			updateGeometryWithBindings(getAlignmentUpdates(sel, edge));
		},
		[getSelected, updateGeometryWithBindings],
	);

	const distributeSelection = useCallback(
		(axis: DistributionAxis) => {
			const sel = getSelected();
			if (sel.length < 3) return;
			updateGeometryWithBindings(getDistributionUpdates(sel, axis));
		},
		[getSelected, updateGeometryWithBindings],
	);

	const adjustFontSize = useCallback(
		(delta: number) => {
			const sel = getSelected();
			if (sel.length === 0) return;
			const updates = sel
				.filter(
					(el) => el.fontSize != null || el.text != null || el.type === "text",
				)
				.map((el) => ({
					id: el.id,
					changes: buildStickyNoteFontSizeChange(
						el,
						Math.max(6, Math.min(256, (el.fontSize ?? 16) + delta)),
					),
				}));
			if (updates.length > 0) updateElements(updates);
		},
		[getSelected, updateElements],
	);

	const startEditingSelection = useCallback(() => {
		const sel = getSelected();
		if (sel.length !== 1) return;
		const el = sel[0];
		if (!isTextEditableElement(el)) return;
		storeRef.current.setEditingTextId(el.id);
	}, [getSelected, storeRef]);

	return {
		clipboardRef,
		formatClipboardRef,
		getSelected,
		copySelection,
		pasteClipboard,
		pasteTextFromClipboard,
		pasteDataTransferFromClipboard,
		pasteFromClipboard,
		cutSelection,
		duplicateSelection,
		copyFormat,
		pasteFormat,
		bringForward,
		sendBackward,
		bringToFront,
		sendToBack,
		flipHorizontal,
		flipVertical,
		rotateSelection,
		copyMirrorSelection,
		copyRotateSelection,
		toggleLock,
		addLink,
		embedInFrame,
		removeFromFrame,
		groupSelection,
		ungroupSelection,
		alignSelection,
		distributeSelection,
		adjustFontSize,
		startEditingSelection,
	};
}
