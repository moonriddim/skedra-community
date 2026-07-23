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

const STANDALONE_TEXT_PADDING_X = 4;
const STANDALONE_TEXT_PADDING_Y = 2;
const MIN_STANDALONE_TEXT_SIZE = 20;

interface CanvasEditorNaturalTextSizeOptions {
	text: string;
	fontSize: number;
	fontFamily: string;
	fontWeight: "normal" | "bold";
	fontStyle: "normal" | "italic";
	lineHeight: number;
	paddingX: number;
	paddingY: number;
	measureLine?: (line: string) => number;
}

/**
 * Resolves the stored bounds of a standalone canvas text element from its
 * actual line widths instead of retaining the editor's temporary input size.
 */
export function resolveCanvasEditorNaturalTextSize({
	text,
	fontSize,
	fontFamily,
	fontWeight,
	fontStyle,
	lineHeight,
	paddingX,
	paddingY,
	measureLine,
}: CanvasEditorNaturalTextSizeOptions): { width: number; height: number } {
	const lines = text.split("\n");
	const fallbackMeasure = (line: string) =>
		Array.from(line.replaceAll("\t", "        ")).length * fontSize * 0.6;
	let browserMeasure: ((line: string) => number) | null = null;
	if (!measureLine && typeof document !== "undefined") {
		const context = document.createElement("canvas").getContext("2d");
		if (context) {
			context.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
			browserMeasure = (line) =>
				context.measureText(line.replaceAll("\t", "        ")).width;
		}
	}
	const resolveLineWidth = measureLine ?? browserMeasure ?? fallbackMeasure;
	const contentWidth = lines.reduce(
		(widest, line) => Math.max(widest, resolveLineWidth(line)),
		0,
	);

	return {
		width: Math.max(
			MIN_STANDALONE_TEXT_SIZE,
			Math.ceil(contentWidth + paddingX * 2),
		),
		height: Math.max(
			MIN_STANDALONE_TEXT_SIZE,
			Math.ceil(lines.length * fontSize * lineHeight + paddingY * 2),
		),
	};
}

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
	verticalAlign?: "top" | "middle" | "bottom";
	fontWeight: "normal" | "bold";
	fontStyle: "normal" | "italic";
	textDecoration: "none" | "underline";
	padding?: number;
	paddingX?: number;
	paddingY?: number;
	lineHeight?: number;
	sourceWidth?: number;
	sourceHeight?: number;
	preserveBounds?: boolean;
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
	const elVerticalAlign = editingState?.verticalAlign ?? "top";
	const elFontWeight =
		editingState?.fontWeight ?? pending?.fontWeight ?? "normal";
	const elFontStyle = editingState?.fontStyle ?? pending?.fontStyle ?? "normal";
	const elTextDecoration =
		editingState?.textDecoration ?? pending?.textDecoration ?? "none";
	const elTextColor = source.textColor ?? source.stroke ?? "#1e1e1e";
	const rotationDeg = editingState?.rotationDeg ?? 0;
	const editorVariant = editingState?.variant ?? "default";
	const editorPadding = editingState?.padding ?? 0;
	const editorPaddingX = editingState?.paddingX ?? editorPadding;
	const editorPaddingY = editingState?.paddingY ?? editorPadding;
	const isStickyNote = editorVariant === "sticky-note";
	const isShapeEditor = editorVariant === "shape";
	const isMindmapNodeEditor = editorVariant === "mindmap-node";
	const isCanvasTextEditor = editorVariant === "canvas-text";
	const isArrowEditor = editorVariant === "arrow";
	const autoFitStandaloneText = !isEditing || isCanvasTextEditor;
	const hasExactTextWidth =
		isShapeEditor || isMindmapNodeEditor || isCanvasTextEditor;
	const hasFixedTextBounds =
		isShapeEditor ||
		isMindmapNodeEditor ||
		editingState?.preserveBounds === true;
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
		? svgRect.left + viewport.x + (posX + editorPaddingX) * viewport.zoom
		: 100;
	const screenY = svgRect
		? svgRect.top + viewport.y + (posY + editorPaddingY) * viewport.zoom
		: 100;
	const innerWidth = Math.max(
		hasExactTextWidth ? 1 : 40,
		elWidth - editorPaddingX * 2,
	);
	const screenW = hasExactTextWidth
		? Math.max(1, innerWidth * viewport.zoom)
		: Math.max(isStickyNote ? 40 : 140, innerWidth * viewport.zoom);
	const fontSize = elFontSize * viewport.zoom;
	const textLineHeight =
		editingState?.lineHeight ?? (isArrowEditor ? 1.35 : 1.4);
	const innerHeight = editingState
		? Math.max(1, editingState.height - editorPaddingY * 2)
		: (pending?.height ?? 44);
	const screenH = hasExactTextWidth
		? Math.max(1, innerHeight * viewport.zoom)
		: pending?.height
			? Math.max(44, pending.height * viewport.zoom)
			: editingState
				? Math.max(
						isStickyNote ? 40 : 44,
						Math.max(40, innerHeight) * viewport.zoom,
					)
				: 44;
	const verticallyAligned =
		isShapeEditor ||
		isMindmapNodeEditor ||
		(isCanvasTextEditor && elVerticalAlign !== "top");
	const naturalTextPaddingX = isCanvasTextEditor
		? editorPaddingX
		: STANDALONE_TEXT_PADDING_X;
	const naturalTextPaddingY = isCanvasTextEditor
		? editorPaddingY
		: STANDALONE_TEXT_PADDING_Y;
	const resolveNaturalTextSize = useCallback(
		(text: string) =>
			resolveCanvasEditorNaturalTextSize({
				text,
				fontSize: elFontSize,
				fontFamily: elFontFamily,
				fontWeight: elFontWeight,
				fontStyle: elFontStyle,
				lineHeight: textLineHeight,
				paddingX: naturalTextPaddingX,
				paddingY: naturalTextPaddingY,
			}),
		[
			elFontFamily,
			elFontSize,
			elFontStyle,
			elFontWeight,
			naturalTextPaddingX,
			naturalTextPaddingY,
			textLineHeight,
		],
	);

	const syncTextareaLayout = useCallback(
		(ta: HTMLTextAreaElement) => {
			if (!verticallyAligned) {
				if (hasFixedTextBounds) {
					ta.style.height = `${screenH}px`;
				} else {
					ta.style.height = "auto";
					ta.style.height = `${Math.max(screenH, ta.scrollHeight)}px`;
				}
				return;
			}

			/* Match the renderer's flex-centered text block, including wrapped lines. */
			ta.style.paddingTop = "0px";
			ta.style.paddingBottom = "0px";
			ta.style.minHeight = "0px";
			ta.style.height = "0px";
			const contentHeight = Math.max(
				fontSize * textLineHeight,
				ta.scrollHeight,
			);
			const remainingHeight = Math.max(0, screenH - contentHeight);
			const paddingTop =
				elVerticalAlign === "bottom" ? remainingHeight : remainingHeight / 2;
			const paddingBottom = Math.max(0, remainingHeight - paddingTop);
			ta.style.height = `${screenH}px`;
			ta.style.minHeight = `${screenH}px`;
			ta.style.paddingTop = `${paddingTop}px`;
			ta.style.paddingBottom = `${paddingBottom}px`;
		},
		[
			elVerticalAlign,
			fontSize,
			hasFixedTextBounds,
			screenH,
			textLineHeight,
			verticallyAligned,
		],
	);

	const doSave = useCallback(() => {
		if (savedRef.current) return;
		savedRef.current = true;

		const ta = textareaRef.current;
		const text = ta?.value ?? "";
		const size = autoFitStandaloneText
			? resolveNaturalTextSize(text)
			: {
					width: hasFixedTextBounds
						? (editingState?.sourceWidth ?? editingState?.width ?? elWidth)
						: Math.max(
								elWidth,
								(ta?.scrollWidth ?? 140) / viewport.zoom + editorPaddingX * 2,
							),
					height: hasFixedTextBounds
						? (editingState?.sourceHeight ??
							editingState?.height ??
							innerHeight)
						: Math.max(
								30,
								(ta?.scrollHeight ?? 40) / viewport.zoom + editorPaddingY * 2,
							),
				};

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
		editorPaddingX,
		editorPaddingY,
		autoFitStandaloneText,
		hasFixedTextBounds,
		innerHeight,
		viewport.zoom,
		resolveNaturalTextSize,
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
		if (editSessionKey === null) return;
		const ta = textareaRef.current;
		if (!ta) return;
		ta.focus();
		if (isEditing) {
			const len = ta.value.length;
			ta.setSelectionRange(len, len);
		}
	}, [editSessionKey, isEditing]);

	/* Editor-Groesse an die gerenderte Textflaeche angleichen. */
	useLayoutEffect(() => {
		const ta = textareaRef.current;
		if (!ta) return;
		syncTextareaLayout(ta);
	}, [syncTextareaLayout]);

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
		syncTextareaLayout(ta);
		if (!editingState) return;
		onUpdateText(
			editingState.id,
			ta.value,
			autoFitStandaloneText
				? resolveNaturalTextSize(ta.value)
				: {
						width: hasFixedTextBounds
							? (editingState.sourceWidth ?? editingState.width)
							: Math.max(
									elWidth,
									ta.scrollWidth / viewport.zoom + editorPaddingX * 2,
								),
						height: hasFixedTextBounds
							? (editingState.sourceHeight ?? editingState.height)
							: Math.max(
									30,
									ta.scrollHeight / viewport.zoom + editorPaddingY * 2,
								),
					},
		);
	};

	const overlayVariant = isStickyNote
		? "sticky-note"
		: isInlineEditor
			? "inline"
			: "dialog";
	return (
		<textarea
			ref={textareaRef}
			rows={1}
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
				height: hasFixedTextBounds ? screenH : undefined,
				minHeight: screenH,
				fontSize,
				fontFamily: elFontFamily,
				fontWeight: elFontWeight,
				fontStyle: elFontStyle,
				textDecoration: elTextDecoration,
				textAlign: elTextAlign,
				lineHeight: textLineHeight,
				overflow: "hidden",
				color: elTextColor,
				padding: isStickyNote || hasExactTextWidth ? 0 : undefined,
				paddingLeft: isArrowEditor || hasExactTextWidth ? 0 : undefined,
				paddingRight: isArrowEditor || hasExactTextWidth ? 0 : undefined,
				paddingTop: isShapeEditor || isMindmapNodeEditor ? 0 : undefined,
				paddingBottom: isShapeEditor || isMindmapNodeEditor ? 0 : undefined,
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
