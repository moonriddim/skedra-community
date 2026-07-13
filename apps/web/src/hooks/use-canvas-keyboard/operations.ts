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
import { getCornerRadiusPercent } from "@skedra/canvas-core";
import type { CanvasElement, StrokeStyle } from "@skedra/canvas-core";
import {
	buildBringForwardUpdates,
	buildBringToFrontUpdates,
	buildSendBackwardUpdates,
	buildSendToBackUpdates,
	cloneCanvasSelection,
	createSelectionFrame,
	getFlipUpdates,
	getGroupUpdates,
	getLockUpdates,
} from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import { useCallback, useRef } from "react";

interface FormatClipboard {
	stroke: string;
	fill: string;
	strokeWidth: number;
	strokeStyle: StrokeStyle;
	opacity: number;
	cornerRadiusPercent?: number;
	arrowHeadScale?: number;
	arrowHeadFilled?: boolean;
	fontSize?: number;
	fontFamily?: string;
}

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
	const formatClipboardRef = useRef<FormatClipboard | null>(null);

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
		const el = sel[0];
		formatClipboardRef.current = {
			stroke: el.stroke,
			fill: el.fill,
			strokeWidth: el.strokeWidth,
			strokeStyle: el.strokeStyle ?? "solid",
			opacity: el.opacity,
			cornerRadiusPercent:
				el.type === "rectangle" ? getCornerRadiusPercent(el) : undefined,
			arrowHeadScale:
				el.type === "arrow" ? (el.arrowHeadScale ?? 1) : undefined,
			arrowHeadFilled:
				el.type === "arrow" ? (el.arrowHeadFilled ?? true) : undefined,
			fontSize: el.fontSize,
			fontFamily: el.fontFamily,
		};
	}, [getSelected]);

	const pasteFormat = useCallback(() => {
		const fmt = formatClipboardRef.current;
		if (!fmt) return;
		const sel = getSelected();
		if (sel.length === 0) return;
		const updates = sel.map((el) => ({
			id: el.id,
			changes: {
				stroke: fmt.stroke,
				fill: fmt.fill,
				strokeWidth: fmt.strokeWidth,
				strokeStyle: fmt.strokeStyle,
				opacity: fmt.opacity,
				...(el.type === "rectangle" && fmt.cornerRadiusPercent !== undefined
					? {
							cornerRadiusPercent: fmt.cornerRadiusPercent,
							cornerRadius: undefined,
						}
					: {}),
				...(el.type === "arrow" && fmt.arrowHeadScale !== undefined
					? { arrowHeadScale: fmt.arrowHeadScale }
					: {}),
				...(el.type === "arrow" && fmt.arrowHeadFilled !== undefined
					? { arrowHeadFilled: fmt.arrowHeadFilled }
					: {}),
				...(el.fontSize !== undefined && fmt.fontSize !== undefined
					? { fontSize: fmt.fontSize }
					: {}),
			} as Partial<CanvasElement>,
		}));
		updateElements(updates);
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
		updateElements(getFlipUpdates(sel, "horizontal"));
	}, [getSelected, updateElements]);

	const flipVertical = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		updateElements(getFlipUpdates(sel, "vertical"));
	}, [getSelected, updateElements]);

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
