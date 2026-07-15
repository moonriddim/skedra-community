/**
 * HTML-Overlay fuer Inline-Text-Editing auf dem Canvas.
 *
 * Zwei Modi:
 * 1. NEUER TEXT: position + defaults, Element wird erst beim Speichern erstellt
 * 2. BEARBEITUNG: existierendes Element bearbeiten
 *
 * - Klick oder Doppelklick ausserhalb = speichern
 * - Escape = speichern + schliessen
 * - Pfeil/Label: Enter = speichern, Shift+Enter = Zeilenumbruch
 * - Sonst: Enter = Zeilenumbruch
 * - Auto-resize der Textarea
 */

import { DEFAULT_FONT_FAMILY, type Viewport } from "@skedra/canvas-core";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

export interface CanvasEditorPendingText {
	x: number;
	y: number;
	width?: number;
	height?: number;
	stroke: string;
	textColor?: string;
	fontSize: number;
	fontFamily: string;
	textAlign?: "left" | "center" | "right";
	fontWeight?: "normal" | "bold";
	fontStyle?: "normal" | "italic";
	textDecoration?: "none" | "underline";
}

export interface CanvasEditorEditingText {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	text: string;
	stroke: string;
	textColor?: string;
	fontSize: number;
	fontFamily: string;
	textAlign: "left" | "center" | "right";
	fontWeight: "normal" | "bold";
	fontStyle: "normal" | "italic";
	textDecoration: "none" | "underline";
	padding?: number;
	placeholder?: string;
	rotationDeg?: number;
	variant?:
		| "default"
		| "sticky-note"
		| "frame-label"
		| "shape"
		| "canvas-text"
		| "arrow"
		| "mindmap-node";
}

export interface CanvasEditorTextOverlayProps {
	/** Neuer Text (kein Element existiert noch) */
	pending?: CanvasEditorPendingText | null;
	/** Bestehendes Element bearbeiten */
	editing?: CanvasEditorEditingText | null;
	viewport: Viewport;
	svgRef: React.RefObject<SVGSVGElement | null>;
	/** Neuen Text speichern (Element erstellen) */
	onCreateText: (
		text: string,
		position: CanvasEditorPendingText,
		size: { width: number; height: number },
	) => void;
	/** Bestehenden Text aktualisieren */
	onUpdateText: (
		id: string,
		text: string,
		size: { width: number; height: number },
	) => void;
	onCreateSibling?: (id: string) => void;
	onClose: () => void;
	/** Speichern ausloesen (z. B. Doppelklick auf die Canvas-Flaeche) */
	onRegisterCommit?: (commit: (() => void) | null) => void;
	placeholder?: string;
}

export function CanvasEditorTextOverlay({
	pending,
	editing,
	viewport,
	svgRef,
	onCreateText,
	onUpdateText,
	onCreateSibling,
	onClose,
	onRegisterCommit,
	placeholder: placeholderOverride = "Text...",
}: CanvasEditorTextOverlayProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const savedRef = useRef(false);
	const editSessionKey =
		editing?.id ?? (pending ? `pending:${pending.x},${pending.y}` : null);

	const source = pending ?? editing;
	if (!source) return null;

	const editingState = editing ?? null;
	const isEditing = editingState != null;
	const initialText = editingState?.text ?? "";
	const posX = source.x;
	const posY = source.y;
	const elWidth = editingState?.width ?? pending?.width ?? 200;
	const elFontSize = source.fontSize ?? 18;
	const elFontFamily = source.fontFamily ?? DEFAULT_FONT_FAMILY;
	const elTextAlign = editingState?.textAlign ?? pending?.textAlign ?? "left";
	const elFontWeight =
		editingState?.fontWeight ?? pending?.fontWeight ?? "normal";
	const elFontStyle = editingState?.fontStyle ?? pending?.fontStyle ?? "normal";
	const elTextDecoration =
		editingState?.textDecoration ?? pending?.textDecoration ?? "none";
	const elTextColor = source.textColor ?? source.stroke ?? "#1e1e1e";
	const rotationDeg = editingState?.rotationDeg ?? 0;
	const editorVariant = editingState?.variant ?? "default";
	const editorPadding = editingState?.padding ?? 0;
	const isStickyNote = editorVariant === "sticky-note";
	const isShapeEditor = editorVariant === "shape";
	const isMindmapNodeEditor = editorVariant === "mindmap-node";
	const isCanvasTextEditor = editorVariant === "canvas-text";
	const isArrowEditor = editorVariant === "arrow";
	const isInlineEditor =
		isStickyNote ||
		isShapeEditor ||
		isMindmapNodeEditor ||
		isArrowEditor ||
		isCanvasTextEditor ||
		editorVariant === "frame-label" ||
		!isEditing;
	const placeholder = editingState?.placeholder ?? placeholderOverride;

	const svgRect = svgRef.current?.getBoundingClientRect();

	const screenX = svgRect
		? svgRect.left + viewport.x + (posX + editorPadding) * viewport.zoom
		: 100;
	const screenY = svgRect
		? svgRect.top + viewport.y + (posY + editorPadding) * viewport.zoom
		: 100;
	const innerWidth = Math.max(40, elWidth - editorPadding * 2);
	const screenW = Math.max(isStickyNote ? 40 : 140, innerWidth * viewport.zoom);
	const fontSize = elFontSize * viewport.zoom;

	const doSave = useCallback(() => {
		if (savedRef.current) return;
		savedRef.current = true;

		const ta = textareaRef.current;
		const text = ta?.value ?? "";
		const naturalW = Math.max(
			elWidth,
			(ta?.scrollWidth ?? 140) / viewport.zoom,
		);
		const naturalH = Math.max(30, (ta?.scrollHeight ?? 40) / viewport.zoom);
		const size = { width: naturalW, height: naturalH };

		if (editingState) {
			onUpdateText(editingState.id, text, size);
		} else if (pending && text.trim().length > 0) {
			onCreateText(text, pending, size);
		}
		onClose();
	}, [
		editingState,
		pending,
		elWidth,
		viewport.zoom,
		onCreateText,
		onUpdateText,
		onClose,
	]);

	useEffect(() => {
		if (editSessionKey === null) return;
		savedRef.current = false;
	}, [editSessionKey]);

	useEffect(() => {
		onRegisterCommit?.(doSave);
		return () => onRegisterCommit?.(null);
	}, [doSave, onRegisterCommit]);

	/* Focus bei Mount */
	useLayoutEffect(() => {
		const ta = textareaRef.current;
		if (!ta) return;
		ta.focus();
		if (isEditing) {
			const len = ta.value.length;
			ta.setSelectionRange(len, len);
		}
		/* Auto-resize initial */
		ta.style.height = "auto";
		ta.style.height = `${Math.max(40, ta.scrollHeight)}px`;
	}, [isEditing]);

	/* Klick ausserhalb = speichern */
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
				textareaRef.current &&
				!textareaRef.current.contains(target as Node)
			) {
				doSave();
			}
		};
		const timer = setTimeout(() => {
			document.addEventListener("pointerdown", handler, true);
		}, 150);
		return () => {
			clearTimeout(timer);
			document.removeEventListener("pointerdown", handler, true);
		};
	}, [doSave]);

	/* Doppelklick ausserhalb = speichern (zusaetzlich zum ersten Klick per pointerdown) */
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			const target = e.target;
			if (
				target instanceof Element &&
				target.closest("[data-text-editor-safe='true']")
			) {
				return;
			}
			if (
				textareaRef.current &&
				!textareaRef.current.contains(target as Node)
			) {
				doSave();
			}
		};
		const timer = setTimeout(() => {
			document.addEventListener("dblclick", handler, true);
		}, 150);
		return () => {
			clearTimeout(timer);
			document.removeEventListener("dblclick", handler, true);
		};
	}, [doSave]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.nativeEvent.isComposing) return;
		if (e.key === "Escape") {
			e.preventDefault();
			doSave();
			return;
		}
		if (e.key === "Enter" && !e.shiftKey && isArrowEditor) {
			e.preventDefault();
			doSave();
			return;
		}
		if (
			e.key === "Enter" &&
			!e.shiftKey &&
			isMindmapNodeEditor &&
			editingState
		) {
			e.preventDefault();
			doSave();
			onCreateSibling?.(editingState.id);
			return;
		}
		if (e.key === "Enter" && e.shiftKey) {
			return;
		}
		e.stopPropagation();
	};

	const handleInput = () => {
		const ta = textareaRef.current;
		if (!ta) return;
		ta.style.height = "auto";
		ta.style.height = `${ta.scrollHeight}px`;
		if (!editingState) return;
		onUpdateText(editingState.id, ta.value, {
			width: Math.max(elWidth, ta.scrollWidth / viewport.zoom),
			height: Math.max(30, ta.scrollHeight / viewport.zoom),
		});
	};

	const screenH = pending?.height
		? Math.max(44, pending.height * viewport.zoom)
		: editingState
			? Math.max(
					isStickyNote ? 40 : 44,
					Math.max(40, editingState.height - editorPadding * 2) * viewport.zoom,
				)
			: 44;

	const overlayVariant = isStickyNote
		? "sticky-note"
		: isInlineEditor
			? "inline"
			: "dialog";
	const centeredVerticalPadding =
		isShapeEditor || isMindmapNodeEditor
			? Math.max(0, (screenH - fontSize * 1.35) / 2)
			: 0;

	return (
		<textarea
			ref={textareaRef}
			inputMode="text"
			defaultValue={initialText}
			onKeyDown={handleKeyDown}
			onInput={handleInput}
			placeholder={placeholder}
			className="canvas-editor__text-overlay"
			data-variant={overlayVariant}
			style={{
				left: screenX,
				top: screenY,
				width: screenW,
				minHeight: screenH,
				fontSize,
				fontFamily: elFontFamily,
				fontWeight: elFontWeight,
				fontStyle: elFontStyle,
				textDecoration: elTextDecoration,
				textAlign: elTextAlign,
				lineHeight: isStickyNote ? 1.4 : 1.35,
				overflow: "hidden",
				color: elTextColor,
				padding: isStickyNote ? 0 : undefined,
				paddingLeft: isArrowEditor ? 0 : undefined,
				paddingRight: isArrowEditor ? 0 : undefined,
				paddingTop:
					isShapeEditor || isMindmapNodeEditor
						? centeredVerticalPadding
						: undefined,
				paddingBottom:
					isShapeEditor || isMindmapNodeEditor
						? centeredVerticalPadding
						: undefined,
				caretColor: elTextColor,
				transform:
					isArrowEditor && rotationDeg !== 0
						? `rotate(${rotationDeg}deg)`
						: undefined,
				transformOrigin: isArrowEditor ? "center center" : undefined,
			}}
		/>
	);
}
