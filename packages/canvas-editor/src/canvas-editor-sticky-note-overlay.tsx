/** Touch-friendly note editor. Drafts remain local until the edit is committed. */
import type { StickyNoteTypography, Viewport } from "@skedra/canvas-core";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { CanvasEditorPropertiesTranslate } from "./canvas-editor-classic-properties-panel";
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
		typography?: StickyNoteTypography & { height?: number },
	) => void;
	onClose: () => void;
	onRegisterCommit?: (commit: (() => void) | null) => void;
	onViewportChange?: (viewport: Viewport) => void;
	initialFocus?: string;
	translate?: CanvasEditorPropertiesTranslate;
	notePlaceholder?: string;
	titlePlaceholder?: string;
	itemPlaceholder?: string;
}

const fallbackTranslate: CanvasEditorPropertiesTranslate = (_key, fallback) =>
	fallback;

export function CanvasEditorStickyNoteOverlay({
	editing,
	stickyNoteMode,
	stickyChecklist,
	viewport,
	svgRef,
	onUpdateStickyNote,
	onClose,
	onRegisterCommit,
	onViewportChange,
	initialFocus,
	translate: t = fallbackTranslate,
	notePlaceholder,
	titlePlaceholder,
	itemPlaceholder,
}: CanvasEditorStickyNoteOverlayProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef(new Map<string, HTMLTextAreaElement>());
	const titleRef = useRef<HTMLInputElement>(null);
	const savedRef = useRef(false);
	const [rows, setRows] = useState(() =>
		stickyNoteMode === "checklist"
			? prepareCanvasEditorStickyChecklistForEditing(stickyChecklist)
			: editing.text.split("\n").map((text, index) => ({
					...createCanvasEditorStickyChecklistItem(text),
					fontSize:
						editing.stickyTypography?.textFontSizes?.[index] ??
						editing.fontSize,
				})),
	);
	const [title, setTitle] = useState(editing.text);
	const [titleSize, setTitleSize] = useState(
		editing.stickyTypography?.titleFontSize ?? editing.fontSize * 1.05,
	);
	const [activeId, setActiveId] = useState<string | null>(() =>
		initialFocus === "title"
			? null
			: (rows.find((row) => row.id === initialFocus)?.id ??
				rows[Number(initialFocus?.replace("line:", "")) || 0]?.id ??
				rows[0].id),
	);
	const [visualViewport, setVisualViewport] = useState({
		top: 0,
		height: typeof window === "undefined" ? 800 : window.innerHeight,
	});
	const rowSize = (row: CanvasEditorStickyChecklistItem) =>
		row.fontSize ??
		(stickyNoteMode === "checklist"
			? Math.max(14, editing.fontSize * 0.82)
			: editing.fontSize);
	const setActiveSize = useCallback(
		(size: number) => {
			const fontSize = Math.min(256, Math.max(6, size));
			if (activeId === null) setTitleSize(fontSize);
			else
				setRows((current) =>
					current.map((row) =>
						row.id === activeId ? { ...row, fontSize } : row,
					),
				);
		},
		[activeId],
	);

	useEffect(() => {
		const panel = panelRef.current;
		const handler = (event: Event) => {
			event.preventDefault();
			setActiveSize((event as CustomEvent<number>).detail);
		};
		panel?.addEventListener("skedra-sticky-font-size", handler);
		return () => panel?.removeEventListener("skedra-sticky-font-size", handler);
	}, [setActiveSize]);

	useEffect(() => {
		const resize = () => {
			setVisualViewport({
				top: window.visualViewport?.offsetTop ?? 0,
				height: window.visualViewport?.height ?? window.innerHeight,
			});
		};
		resize();
		window.addEventListener("resize", resize);
		window.visualViewport?.addEventListener("resize", resize);
		window.visualViewport?.addEventListener("scroll", resize);
		return () => {
			window.removeEventListener("resize", resize);
			window.visualViewport?.removeEventListener("resize", resize);
			window.visualViewport?.removeEventListener("scroll", resize);
		};
	}, []);

	const focusRow = (id: string, position?: number) =>
		requestAnimationFrame(() => {
			const input = itemRefs.current.get(id);
			input?.focus({ preventScroll: true });
			if (position !== undefined) input?.setSelectionRange(position, position);
		});

	// biome-ignore lint/correctness/useExhaustiveDependencies: text, font and viewport changes require measuring the rendered inputs.
	useLayoutEffect(() => {
		for (const input of itemRefs.current.values()) {
			input.style.height = "0px";
			input.style.height = `${input.scrollHeight}px`;
		}
	}, [rows, editing.width, editing.fontFamily, viewport.zoom]);

	const initialActiveId = useRef(activeId);
	useLayoutEffect(() => {
		const input =
			initialActiveId.current === null
				? titleRef.current
				: itemRefs.current.get(initialActiveId.current);
		input?.focus({ preventScroll: true });
		input?.setSelectionRange(input.value.length, input.value.length);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: keep the focused row visible when the on-screen keyboard resizes the viewport.
	useEffect(() => {
		const input = activeId ? itemRefs.current.get(activeId) : titleRef.current;
		if (!input || !onViewportChange || document.activeElement !== input) return;
		// Pan the canvas and its note together when the keyboard covers the active row.
		const rect = input.getBoundingClientRect();
		const bottom = visualViewport.top + visualViewport.height - 16;
		const top = visualViewport.top + 16;
		const dy =
			rect.bottom > bottom
				? bottom - rect.bottom
				: rect.top < top
					? top - rect.top
					: 0;
		if (Math.abs(dy) > 1) onViewportChange({ ...viewport, y: viewport.y + dy });
	}, [
		visualViewport.height,
		visualViewport.top,
		activeId,
		rows,
		onViewportChange,
	]);

	const doSave = useCallback(() => {
		if (savedRef.current) return;
		savedRef.current = true;
		// Measure at the note's canvas width, independently of the mobile editor width.
		const measure = document.createElement("div");
		Object.assign(measure.style, {
			position: "fixed",
			left: "-10000px",
			top: "0",
			width: `${Math.max(40, editing.width - (editing.padding ?? 12) * 2)}px`,
			fontFamily: editing.fontFamily,
			fontWeight: editing.fontWeight,
			fontStyle: editing.fontStyle,
			visibility: "hidden",
		});
		const addMeasure = (text: string, size: number, checklist = false) => {
			const line = document.createElement("div");
			Object.assign(line.style, {
				whiteSpace: "pre-wrap",
				overflowWrap: "anywhere",
				fontSize: `${size}px`,
				lineHeight: "1.35",
				minHeight: checklist ? "28px" : "0",
				paddingLeft: checklist ? "34px" : "0",
				marginBottom: checklist ? "5px" : "0",
			});
			line.textContent = text || "\u00a0";
			measure.append(line);
		};
		const stored =
			stickyNoteMode === "checklist"
				? sanitizeCanvasEditorStickyChecklistForStorage(rows)
				: rows;
		if (stickyNoteMode === "checklist" && title.trim())
			addMeasure(title, titleSize);
		for (const row of stored)
			addMeasure(
				row.text,
				row.fontSize ??
					(stickyNoteMode === "checklist"
						? Math.max(14, editing.fontSize * 0.82)
						: editing.fontSize),
				stickyNoteMode === "checklist",
			);
		document.body.append(measure);
		const height = Math.max(
			editing.height,
			Math.ceil(
				measure.getBoundingClientRect().height +
					(editing.padding ?? 12) * 2 +
					12,
			),
		);
		measure.remove();
		onUpdateStickyNote(
			editing.id,
			stickyNoteMode,
			stickyNoteMode === "note"
				? rows.map((row) => row.text).join("\n")
				: title.trim(),
			stickyNoteMode === "checklist" ? stored : [],
			{
				textFontSizes:
					stickyNoteMode === "note"
						? rows.map((row) => row.fontSize ?? editing.fontSize)
						: undefined,
				titleFontSize: titleSize,
				height,
			},
		);
		onClose();
	}, [
		editing,
		onClose,
		onUpdateStickyNote,
		rows,
		stickyNoteMode,
		title,
		titleSize,
	]);

	useEffect(() => {
		onRegisterCommit?.(doSave);
		return () => onRegisterCommit?.(null);
	}, [doSave, onRegisterCommit]);
	const saveRef = useRef(doSave);
	useLayoutEffect(() => {
		saveRef.current = doSave;
	}, [doSave]);
	useEffect(() => {
		const handler = (event: PointerEvent) => {
			if (
				event.target instanceof Element &&
				event.target.closest(
					"[data-text-editor-safe='true'], [data-sticky-note-editor='true']",
				)
			)
				return;
			saveRef.current();
		};
		const timer = setTimeout(
			() => document.addEventListener("pointerdown", handler, true),
			150,
		);
		return () => {
			clearTimeout(timer);
			document.removeEventListener("pointerdown", handler, true);
		};
	}, []);

	const changeRowText = (id: string, value: string) => {
		const index = rows.findIndex((row) => row.id === id);
		const row = rows[index];
		const lines = value.replaceAll("\r\n", "\n").split("\n");
		const next = lines.map((text, i) =>
			i === 0
				? { ...row, text }
				: {
						...createCanvasEditorStickyChecklistItem(text),
						fontSize: rowSize(row),
					},
		);
		setRows((current) => [
			...current.slice(0, index),
			...next,
			...current.slice(index + 1),
		]);
		if (next.length > 1)
			focusRow(next[next.length - 1].id, next[next.length - 1].text.length);
	};
	const rowKeyDown = (
		row: CanvasEditorStickyChecklistItem,
		event: KeyboardEvent<HTMLTextAreaElement>,
	) => {
		event.stopPropagation();
		if (event.nativeEvent.isComposing) return;
		if (event.key === "Escape") {
			event.preventDefault();
			doSave();
		}
		if (event.key === "Enter") {
			event.preventDefault();
			const input = event.currentTarget;
			const index = rows.findIndex((candidate) => candidate.id === row.id);
			const next = {
				...createCanvasEditorStickyChecklistItem(
					row.text.slice(input.selectionEnd),
				),
				fontSize: rowSize(row),
			};
			setRows((current) => [
				...current.slice(0, index),
				{ ...row, text: row.text.slice(0, input.selectionStart) },
				next,
				...current.slice(index + 1),
			]);
			focusRow(next.id, 0);
		}
		if (
			event.key === "Backspace" &&
			event.currentTarget.selectionStart === 0 &&
			event.currentTarget.selectionEnd === 0
		) {
			const index = rows.findIndex((candidate) => candidate.id === row.id);
			if (index > 0) {
				event.preventDefault();
				const previous = rows[index - 1];
				setRows((current) =>
					current
						.filter((candidate) => candidate.id !== row.id)
						.map((candidate) =>
							candidate.id === previous.id
								? { ...candidate, text: previous.text + row.text }
								: candidate,
						),
				);
				focusRow(previous.id, previous.text.length);
			}
		}
	};
	const svgRect = svgRef.current?.getBoundingClientRect();
	const padding = editing.padding ?? 12;
	const radians = ((editing.rotationDeg ?? 0) * Math.PI) / 180;
	const rotatedX =
		(editing.width / 2) * (1 - Math.cos(radians)) +
		(editing.height / 2) * Math.sin(radians);
	const rotatedY =
		(editing.height / 2) * (1 - Math.cos(radians)) -
		(editing.width / 2) * Math.sin(radians);
	const style: CSSProperties = {
		left:
			(svgRect?.left ?? 0) +
			viewport.x +
			(editing.x + rotatedX) * viewport.zoom,
		top:
			(svgRect?.top ?? 0) + viewport.y + (editing.y + rotatedY) * viewport.zoom,
		width: editing.width,
		minHeight: editing.height,
		padding,
		transform: `scale(${viewport.zoom}) rotate(${editing.rotationDeg ?? 0}deg)`,
		transformOrigin: "top left",
		background: editing.stickyFill ?? "#fff3bf",
		borderRadius: editing.stickyCornerRadius ?? 8,
		color: editing.textColor ?? editing.stroke ?? "#1e1e1e",
	};
	const sharedStyle: CSSProperties = {
		fontFamily: editing.fontFamily,
		fontWeight: editing.fontWeight,
		fontStyle: editing.fontStyle,
		textDecoration: editing.textDecoration,
		textAlign: editing.textAlign,
	};
	return (
		<div
			ref={panelRef}
			data-sticky-note-editor="true"
			data-sticky-note-id={editing.id}
			data-mode={stickyNoteMode}
			className="canvas-editor__sticky-overlay"
			style={style}
			aria-label={t("canvas.sticky.edit", "Edit note")}
		>
			{stickyNoteMode === "checklist" && (
				<input
					ref={titleRef}
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					onFocus={() => setActiveId(null)}
					aria-label={t("canvas.sticky.titlePlaceholder", "Title (optional)")}
					placeholder={
						titlePlaceholder ??
						t("canvas.sticky.titlePlaceholder", "Title (optional)")
					}
					className="canvas-editor__sticky-title-input"
					style={{ ...sharedStyle, fontSize: titleSize, fontWeight: 700 }}
					onKeyDown={(event) => {
						event.stopPropagation();
						if (event.nativeEvent.isComposing) return;
						if (event.key === "Enter") {
							event.preventDefault();
							focusRow(rows[0].id);
						}
						if (event.key === "Escape") doSave();
					}}
				/>
			)}
			<div className="canvas-editor__sticky-checklist">
				{rows.map((row, index) => (
					<div key={row.id} className="canvas-editor__sticky-checklist-row">
						{stickyNoteMode === "checklist" && (
							<button
								type="button"
								aria-pressed={row.completed}
								aria-label={`${t("canvas.sticky.toggleItem", "Toggle item")}: ${row.text || index + 1}`}
								className="canvas-editor__sticky-checkbox"
								onPointerDown={(event) => event.preventDefault()}
								onClick={() =>
									setRows((current) =>
										current.map((candidate) =>
											candidate.id === row.id
												? { ...candidate, completed: !candidate.completed }
												: candidate,
										),
									)
								}
							>
								{row.completed ? "☑" : "☐"}
							</button>
						)}
						<textarea
							ref={(node) => {
								if (node) itemRefs.current.set(row.id, node);
								else itemRefs.current.delete(row.id);
							}}
							rows={1}
							value={row.text}
							aria-label={`${t(stickyNoteMode === "checklist" ? "canvas.sticky.item" : "canvas.sticky.line", stickyNoteMode === "checklist" ? "Item" : "Line")} ${index + 1}`}
							placeholder={
								stickyNoteMode === "checklist"
									? (itemPlaceholder ??
										t("canvas.sticky.itemPlaceholder", "List item..."))
									: index === 0
										? (notePlaceholder ??
											t("canvas.sticky.notePlaceholder", "Note..."))
										: ""
							}
							onFocus={() => setActiveId(row.id)}
							onChange={(event) => changeRowText(row.id, event.target.value)}
							onKeyDown={(event) => rowKeyDown(row, event)}
							className="canvas-editor__sticky-item-input"
							style={{
								...sharedStyle,
								fontSize: rowSize(row),
								textDecoration: row.completed
									? "line-through"
									: editing.textDecoration,
								opacity: row.completed ? 0.65 : 1,
							}}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
