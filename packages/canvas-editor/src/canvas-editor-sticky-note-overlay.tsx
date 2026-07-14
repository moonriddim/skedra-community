/**
 * Inline-Editor fuer Haftnotizen (Modus wird im Eigenschaften-Panel gesetzt).
 */

import type { Viewport } from "@skedra/canvas-core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasEditorEditingText } from "./canvas-editor-text-overlay";
import {
	type CanvasEditorStickyChecklistItem,
	type CanvasEditorStickyNoteMode,
	createCanvasEditorStickyChecklistItem,
	prepareCanvasEditorStickyChecklistForEditing,
	sanitizeCanvasEditorStickyChecklistForStorage,
} from "./sticky-editor-data";

export interface CanvasEditorStickyNoteOverlayProps {
	editing: CanvasEditorEditingText;
	stickyNoteMode: CanvasEditorStickyNoteMode;
	stickyChecklist: CanvasEditorStickyChecklistItem[];
	viewport: Viewport;
	svgRef: React.RefObject<SVGSVGElement | null>;
	onUpdateStickyNote: (
		id: string,
		mode: CanvasEditorStickyNoteMode,
		text: string,
		checklist: CanvasEditorStickyChecklistItem[],
	) => void;
	onClose: () => void;
	onRegisterCommit?: (commit: (() => void) | null) => void;
	notePlaceholder?: string;
	titlePlaceholder?: string;
	itemPlaceholder?: string;
}

export function CanvasEditorStickyNoteOverlay({
	editing,
	stickyNoteMode,
	stickyChecklist,
	viewport,
	svgRef,
	onUpdateStickyNote,
	onClose,
	onRegisterCommit,
	notePlaceholder = "Note...",
	titlePlaceholder = "Title (optional)",
	itemPlaceholder = "List item...",
}: CanvasEditorStickyNoteOverlayProps) {
	const noteBodyRef = useRef<HTMLTextAreaElement>(null);
	const titleRef = useRef<HTMLInputElement>(null);
	const itemRefs = useRef<Array<HTMLInputElement | null>>([]);
	const savedRef = useRef(false);
	const [items, setItems] = useState(() =>
		stickyNoteMode === "checklist"
			? prepareCanvasEditorStickyChecklistForEditing(stickyChecklist)
			: [],
	);
	const padding = editing.padding ?? 0;
	const textColor = editing.textColor ?? editing.stroke ?? "#1e1e1e";
	const textAlign = editing.textAlign ?? "left";
	const fontWeight = editing.fontWeight ?? "normal";
	const fontStyle = editing.fontStyle ?? "normal";
	const textDecoration = editing.textDecoration ?? "none";

	const svgRect = svgRef.current?.getBoundingClientRect();
	const screenX = svgRect
		? svgRect.left + viewport.x + (editing.x + padding) * viewport.zoom
		: 100;
	const screenY = svgRect
		? svgRect.top + viewport.y + (editing.y + padding) * viewport.zoom
		: 100;
	const screenW = Math.max(40, (editing.width - padding * 2) * viewport.zoom);
	const screenH = Math.max(60, (editing.height - padding * 2) * viewport.zoom);
	const bodySize = (editing.fontSize ?? 20) * viewport.zoom;
	const titleSize = bodySize * 1.05;
	const itemSize = Math.max(14, bodySize * 0.82);

	const readItemTexts = useCallback(() => {
		return items.map((item, index) => ({
			...item,
			text: itemRefs.current[index]?.value ?? item.text,
		}));
	}, [items]);

	const doSave = useCallback(() => {
		if (savedRef.current) return;
		savedRef.current = true;

		if (stickyNoteMode === "note") {
			onUpdateStickyNote(
				editing.id,
				"note",
				(noteBodyRef.current?.value ?? "").trim(),
				[],
			);
		} else {
			onUpdateStickyNote(
				editing.id,
				"checklist",
				(titleRef.current?.value ?? "").trim(),
				sanitizeCanvasEditorStickyChecklistForStorage(readItemTexts()),
			);
		}
		onClose();
	}, [editing.id, onClose, onUpdateStickyNote, readItemTexts, stickyNoteMode]);

	useEffect(() => {
		if (!editing.id) return;
		savedRef.current = false;
		setItems(
			stickyNoteMode === "checklist"
				? prepareCanvasEditorStickyChecklistForEditing(stickyChecklist)
				: [],
		);
	}, [editing.id, stickyChecklist, stickyNoteMode]);

	useEffect(() => {
		onRegisterCommit?.(doSave);
		return () => onRegisterCommit?.(null);
	}, [doSave, onRegisterCommit]);

	useEffect(() => {
		if (stickyNoteMode === "note") {
			noteBodyRef.current?.focus();
			noteBodyRef.current?.select();
			return;
		}
		if ((titleRef.current?.value ?? editing.text).trim()) {
			titleRef.current?.focus();
			return;
		}
		itemRefs.current[0]?.focus();
	}, [stickyNoteMode, editing.text]);

	useEffect(() => {
		const handler = (e: PointerEvent) => {
			const target = e.target;
			if (
				target instanceof Element &&
				target.closest("[data-text-editor-safe='true']")
			) {
				return;
			}
			if (
				target instanceof Element &&
				target.closest("[data-sticky-note-editor='true']")
			) {
				return;
			}
			doSave();
		};
		const timer = setTimeout(() => {
			document.addEventListener("pointerdown", handler, true);
		}, 150);
		return () => {
			clearTimeout(timer);
			document.removeEventListener("pointerdown", handler, true);
		};
	}, [doSave]);

	const addItemAfter = (index: number) => {
		const newItem = createCanvasEditorStickyChecklistItem();
		setItems((current) => {
			const next = [...current];
			next.splice(index + 1, 0, newItem);
			return next;
		});
		requestAnimationFrame(() => {
			itemRefs.current[index + 1]?.focus();
		});
	};

	const handleItemKeyDown = (
		index: number,
		event: React.KeyboardEvent<HTMLInputElement>,
	) => {
		if (event.key === "Escape") {
			event.preventDefault();
			doSave();
			return;
		}
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			if (index < items.length - 1) {
				itemRefs.current[index + 1]?.focus();
				return;
			}
			addItemAfter(index);
		}
		event.stopPropagation();
	};

	const sharedTextStyle = {
		fontWeight: fontWeight === "bold" ? 700 : 400,
		fontStyle,
		textDecoration,
		textAlign,
	} as const;

	return (
		<div
			data-sticky-note-editor="true"
			className="canvas-editor__sticky-overlay"
			style={{
				left: screenX,
				top: screenY,
				width: screenW,
				fontFamily: editing.fontFamily,
				color: textColor,
				textAlign,
			}}
		>
			{stickyNoteMode === "note" ? (
				<textarea
					ref={noteBodyRef}
					defaultValue={editing.text}
					placeholder={notePlaceholder}
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							event.preventDefault();
							doSave();
						}
						event.stopPropagation();
					}}
					className="canvas-editor__sticky-note-input"
					style={{
						height: screenH,
						fontSize: bodySize,
						lineHeight: 1.35,
						...sharedTextStyle,
					}}
				/>
			) : (
				<>
					<input
						ref={titleRef}
						defaultValue={editing.text}
						placeholder={titlePlaceholder}
						onKeyDown={(event) => {
							if (event.key === "Escape") {
								event.preventDefault();
								doSave();
								return;
							}
							if (event.key === "Enter") {
								event.preventDefault();
								itemRefs.current[0]?.focus();
							}
							event.stopPropagation();
						}}
						className="canvas-editor__sticky-title-input"
						style={{
							fontSize: titleSize,
							lineHeight: 1.25,
							...sharedTextStyle,
							fontWeight: 700,
						}}
					/>
					<div className="canvas-editor__sticky-checklist">
						{items.map((item, index) => (
							<div
								key={item.id}
								className="canvas-editor__sticky-checklist-row"
							>
								<button
									type="button"
									onClick={() => {
										setItems((current) =>
											current.map((entry, entryIndex) =>
												entryIndex === index
													? { ...entry, completed: !entry.completed }
													: entry,
											),
										);
									}}
									className="canvas-editor__sticky-checkbox"
									style={{
										fontSize: itemSize,
										lineHeight: 1.35,
										cursor: "pointer",
										color: textColor,
									}}
								>
									{item.completed ? "☑" : "☐"}
								</button>
								<input
									ref={(node) => {
										itemRefs.current[index] = node;
									}}
									defaultValue={item.text}
									placeholder={itemPlaceholder}
									onKeyDown={(event) => handleItemKeyDown(index, event)}
									className="canvas-editor__sticky-item-input"
									style={{
										fontSize: itemSize,
										lineHeight: 1.35,
										...sharedTextStyle,
										textDecoration: item.completed
											? "line-through"
											: textDecoration,
										opacity: item.completed ? 0.65 : 1,
									}}
								/>
							</div>
						))}
					</div>
				</>
			)}
		</div>
	);
}
