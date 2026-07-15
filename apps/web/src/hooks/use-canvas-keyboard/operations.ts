/**
 * Wiederverwendbare Tastatur-Operationen auf der Canvas-Selektion.
 */

import { isTextEditableElement } from "@/components/canvas/hooks/use-canvas-text-editing";
import { useCanvasStoreRef } from "@/hooks/use-canvas-store";
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
	buildCanvasElementFormatUpdates,
	buildSendBackwardUpdates,
	buildSendToBackUpdates,
	cloneCanvasSelection,
	cloneTransformedCanvasSelection,
	createSelectionFrame,
	getCanvasElementFormat,
	getFlipUpdates,
	getGroupUpdates,
	getLockUpdates,
	getRotateUpdates,
} from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import { useCallback, useRef } from "react";

interface UseCanvasKeyboardOperationsOptions {
	elements: Map<string, CanvasElement>;
	createElement: (el: CanvasElement) => void;
	deleteElements: (ids: string[]) => void;
	updateElements: (
		updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
	) => void;
}

export function useCanvasKeyboardOperations({
	elements,
	createElement,
	deleteElements,
	updateElements,
}: UseCanvasKeyboardOperationsOptions) {
	const storeRef = useCanvasStoreRef();
	const clipboardRef = useRef<CanvasElement[]>([]);
	const formatClipboardRef = useRef<CanvasElementFormat | null>(null);

	const getSelected = useCallback(() => {
		const store = storeRef.current;
		return Array.from(store.selectedIds)
			.map((id) => elements.get(id))
			.filter(Boolean) as CanvasElement[];
	}, [storeRef, elements]);

	const copySelection = useCallback(() => {
		const sel = getSelected();
		if (sel.length > 0) clipboardRef.current = sel;
	}, [getSelected]);

	const pasteClipboard = useCallback(() => {
		if (clipboardRef.current.length === 0) return;
		const cloned = cloneCanvasSelection({
			elements: clipboardRef.current,
			existingElements: elements.values(),
			createId: nanoid,
		});
		for (const element of cloned.elements) createElement(element);
		storeRef.current.setSelectedIds(
			new Set(cloned.elements.map((element) => element.id)),
		);
		clipboardRef.current = cloned.elements;
	}, [createElement, elements, storeRef]);

	const cutSelection = useCallback(() => {
		const store = storeRef.current;
		copySelection();
		if (store.selectedIds.size > 0) {
			deleteElements(Array.from(store.selectedIds));
			store.clearSelection();
		}
	}, [copySelection, storeRef, deleteElements]);

	const duplicateSelection = useCallback(() => {
		copySelection();
		pasteClipboard();
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
		updateElements(getFlipUpdates(sel, "horizontal", transformOrigin));
		if (transformOrigin) storeRef.current.setTransformOrigin(null);
	}, [getSelected, storeRef, updateElements]);

	const flipVertical = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		const transformOrigin = storeRef.current.transformOrigin ?? undefined;
		updateElements(getFlipUpdates(sel, "vertical", transformOrigin));
		if (transformOrigin) storeRef.current.setTransformOrigin(null);
	}, [getSelected, storeRef, updateElements]);

	const rotateSelection = useCallback(
		(angleDelta: number) => {
			const sel = getSelected();
			if (sel.length === 0) return;
			const transformOrigin = storeRef.current.transformOrigin ?? undefined;
			updateElements(getRotateUpdates(sel, angleDelta, transformOrigin));
			if (transformOrigin) storeRef.current.setTransformOrigin(null);
		},
		[getSelected, storeRef, updateElements],
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
			updateElements(getAlignmentUpdates(sel, edge));
		},
		[getSelected, updateElements],
	);

	const distributeSelection = useCallback(
		(axis: DistributionAxis) => {
			const sel = getSelected();
			if (sel.length < 3) return;
			updateElements(getDistributionUpdates(sel, axis));
		},
		[getSelected, updateElements],
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
					changes: {
						fontSize: Math.max(8, Math.min(128, (el.fontSize ?? 16) + delta)),
					},
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
