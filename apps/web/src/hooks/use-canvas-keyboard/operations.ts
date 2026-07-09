/**
 * Wiederverwendbare Tastatur-Operationen auf der Canvas-Selektion.
 */

import { isTextEditableElement } from "@/components/canvas/hooks/use-canvas-text-editing";
import { useCanvasStoreRef } from "@/hooks/use-canvas-store";
import { type AlignEdge, getAlignmentUpdates } from "@skedra/canvas-core";
import { getCornerRadiusPercent } from "@skedra/canvas-core";
import type { CanvasElement, StrokeStyle } from "@skedra/canvas-core";
import {
	buildBringForwardUpdates,
	buildBringToFrontUpdates,
	buildSendBackwardUpdates,
	buildSendToBackUpdates,
	createStackIndexAfter,
	createStackIndexBefore,
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
		const newIds = new Set<string>();
		const offset = 20;
		for (const el of clipboardRef.current) {
			const id = nanoid();
			const detail: CanvasElement = {
				...el,
				id,
				x: el.x + offset,
				y: el.y + offset,
				stackIndex: createStackIndexAfter(elements.values(), id),
			};
			createElement(detail);
			newIds.add(id);
		}
		storeRef.current.setSelectedIds(newIds);
		clipboardRef.current = clipboardRef.current.map((el) => ({
			...el,
			x: el.x + offset,
			y: el.y + offset,
		}));
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
		updateElements(
			sel.map((el) => ({ id: el.id, changes: { flipX: !el.flipX } })),
		);
	}, [getSelected, updateElements]);

	const flipVertical = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		updateElements(
			sel.map((el) => ({ id: el.id, changes: { flipY: !el.flipY } })),
		);
	}, [getSelected, updateElements]);

	const toggleLock = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		const allLocked = sel.every((el) => el.locked);
		updateElements(
			sel.map((el) => ({ id: el.id, changes: { locked: !allLocked } })),
		);
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

		const padding = 30;
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		for (const el of sel) {
			minX = Math.min(minX, el.x);
			minY = Math.min(minY, el.y);
			maxX = Math.max(maxX, el.x + el.width);
			maxY = Math.max(maxY, el.y + el.height);
		}

		const frameId = nanoid();
		createElement({
			id: frameId,
			type: "frame",
			x: minX - padding,
			y: minY - padding,
			width: maxX - minX + padding * 2,
			height: maxY - minY + padding * 2,
			rotation: 0,
			fill: "transparent",
			stroke: "#6366f1",
			strokeWidth: 1.5,
			strokeStyle: "solid",
			opacity: 100,
			locked: false,
			groupId: null,
			stackIndex: createStackIndexBefore(elements.values(), frameId),
			flipX: false,
			flipY: false,
			frameLabel: "Frame",
		});

		updateElements(sel.map((el) => ({ id: el.id, changes: { frameId } })));
		storeRef.current.setSelectedIds(
			new Set([frameId, ...sel.map((el) => el.id)]),
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
		const gId = nanoid();
		updateElements(sel.map((el) => ({ id: el.id, changes: { groupId: gId } })));
	}, [getSelected, updateElements]);

	const ungroupSelection = useCallback(() => {
		const sel = getSelected();
		if (sel.length === 0) return;
		updateElements(
			sel.map((el) => ({ id: el.id, changes: { groupId: undefined } })),
		);
	}, [getSelected, updateElements]);

	const alignSelection = useCallback(
		(edge: AlignEdge) => {
			const sel = getSelected();
			if (sel.length < 2) return;
			updateElements(getAlignmentUpdates(sel, edge));
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
		adjustFontSize,
		startEditingSelection,
	};
}
