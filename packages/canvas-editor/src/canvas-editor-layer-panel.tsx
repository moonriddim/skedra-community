/**
 * Ebenen-Panel (Layer-Panel): Stapel-Reihenfolge aller Elemente, Frames mit
 * eingerueckten Kindern. Host-neutral — Selektion, Lock, Umbenennen und
 * Drag-Reorder laufen ueber Callbacks; die Stapel-Logik liegt in canvas-core
 * (buildLayerReorderUpdates).
 */

import { type CanvasElement, sortCanvasElements } from "@skedra/canvas-core";
import {
	ArrowUpRight,
	Circle,
	Cloud,
	Diamond,
	Frame,
	GripVertical,
	Image as ImageIcon,
	Kanban,
	Layers,
	Lock,
	LockOpen,
	Minus,
	PenLine,
	Square,
	StickyNote,
	Triangle,
	Type,
	X,
} from "lucide-react";
import {
	type CSSProperties,
	type DragEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { CanvasEditorPropertiesTranslate } from "./canvas-editor-classic-properties-panel";
import { useCanvasEditorFloatingPanel } from "./use-canvas-editor-floating-panel";

export type CanvasEditorLayerReorderPosition = "above" | "below";

export interface CanvasEditorLayerPanelProps {
	elements: Map<string, CanvasElement>;
	selectedIds: Set<string>;
	translate: CanvasEditorPropertiesTranslate;
	className?: string;
	style?: CSSProperties;
	/** Selektion ersetzen (additive = true bei Strg/Cmd-Klick). */
	onSelect: (id: string, additive: boolean) => void;
	onToggleLock: (id: string, locked: boolean) => void;
	/** Element in der Stapel-Reihenfolge relativ zum Ziel verschieben. */
	onReorder: (
		movedId: string,
		targetId: string,
		position: CanvasEditorLayerReorderPosition,
	) => void;
	/** Frame-Label umbenennen (nur fuer frame-Elemente aufgerufen). */
	onRenameFrame?: (id: string, label: string) => void;
	onClose?: () => void;
}

interface LayerRow {
	element: CanvasElement;
	depth: number;
}

/** Kurzer Anzeigename eines Elements fuer die Ebenen-Liste. */
function layerDisplayName(
	element: CanvasElement,
	t: CanvasEditorPropertiesTranslate,
): string {
	const label =
		(element.type === "frame" ? element.frameLabel : undefined) ||
		element.text ||
		"";
	const firstLine = label.split("\n")[0]?.trim() ?? "";
	if (firstLine) {
		return firstLine.length > 28 ? `${firstLine.slice(0, 28)}…` : firstLine;
	}
	return t(
		`canvas.layers.type.${element.type}`,
		element.type.charAt(0).toUpperCase() + element.type.slice(1),
	);
}

function layerTypeIcon(element: CanvasElement): ReactNode {
	const skedraType = element.customData?.skedraType;
	if (skedraType === "sticky-note")
		return <StickyNote className="h-3.5 w-3.5" />;
	if (skedraType === "kanban-list" || skedraType === "kanban-card")
		return <Kanban className="h-3.5 w-3.5" />;
	switch (element.type) {
		case "frame":
			return <Frame className="h-3.5 w-3.5" />;
		case "rectangle":
			return <Square className="h-3.5 w-3.5" />;
		case "ellipse":
			return <Circle className="h-3.5 w-3.5" />;
		case "diamond":
			return <Diamond className="h-3.5 w-3.5" />;
		case "triangle":
			return <Triangle className="h-3.5 w-3.5" />;
		case "cloud":
			return <Cloud className="h-3.5 w-3.5" />;
		case "text":
			return <Type className="h-3.5 w-3.5" />;
		case "line":
			return <Minus className="h-3.5 w-3.5" />;
		case "arrow":
			return <ArrowUpRight className="h-3.5 w-3.5" />;
		case "freehand":
			return <PenLine className="h-3.5 w-3.5" />;
		case "image":
			return <ImageIcon className="h-3.5 w-3.5" />;
		default:
			return <Square className="h-3.5 w-3.5" />;
	}
}

/**
 * Zeilen in Anzeige-Reihenfolge: oberstes Element zuerst; Elemente mit
 * gueltiger frameId erscheinen eingerueckt unter ihrem Frame.
 */
function buildLayerRows(elements: Map<string, CanvasElement>): LayerRow[] {
	const ordered = sortCanvasElements(elements.values()).reverse();
	const childrenByFrame = new Map<string, CanvasElement[]>();
	const topLevel: CanvasElement[] = [];

	for (const element of ordered) {
		const parent = element.frameId ? elements.get(element.frameId) : undefined;
		if (parent && parent.id !== element.id) {
			const children = childrenByFrame.get(parent.id) ?? [];
			children.push(element);
			childrenByFrame.set(parent.id, children);
		} else {
			topLevel.push(element);
		}
	}

	const rows: LayerRow[] = [];
	for (const element of topLevel) {
		rows.push({ element, depth: 0 });
		const children = childrenByFrame.get(element.id);
		if (children) {
			for (const child of children) rows.push({ element: child, depth: 1 });
		}
	}
	return rows;
}

function LayerNameEditor({
	element,
	onRenameFrame,
	onDone,
}: {
	element: CanvasElement;
	onRenameFrame: (id: string, label: string) => void;
	onDone: () => void;
}) {
	const [draft, setDraft] = useState(element.frameLabel ?? "");
	const inputRef = useRef<HTMLInputElement>(null);
	useEffect(() => inputRef.current?.focus(), []);
	const commit = () => {
		const next = draft.trim();
		if (next !== (element.frameLabel ?? "")) onRenameFrame(element.id, next);
		onDone();
	};
	return (
		<input
			ref={inputRef}
			type="text"
			value={draft}
			onChange={(event) => setDraft(event.target.value)}
			onBlur={commit}
			onKeyDown={(event) => {
				if (event.key === "Enter") event.currentTarget.blur();
				if (event.key === "Escape") onDone();
			}}
			onClick={(event) => event.stopPropagation()}
			className="canvas-editor__layer-name-input w-full min-w-0 rounded border border-primary bg-background px-1 py-0 text-[11px] text-card-foreground outline-none"
		/>
	);
}

export function CanvasEditorLayerPanel({
	elements,
	selectedIds,
	translate: t,
	className,
	style,
	onSelect,
	onToggleLock,
	onReorder,
	onRenameFrame,
	onClose,
}: CanvasEditorLayerPanelProps) {
	const floatingPanel = useCanvasEditorFloatingPanel<HTMLDivElement>();
	const rows = useMemo(() => buildLayerRows(elements), [elements]);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [dragId, setDragId] = useState<string | null>(null);
	const [dropTarget, setDropTarget] = useState<{
		id: string;
		position: CanvasEditorLayerReorderPosition;
	} | null>(null);

	const resolveDropPosition = (
		event: DragEvent<HTMLElement>,
	): CanvasEditorLayerReorderPosition => {
		const rect = event.currentTarget.getBoundingClientRect();
		/* Obere Haelfte = im Stapel darueber ablegen, untere = darunter. */
		return event.clientY < rect.top + rect.height / 2 ? "above" : "below";
	};

	return (
		<div
			ref={floatingPanel.panelRef}
			data-text-editor-safe="true"
			className={[
				"canvas-editor__layers skedra-sdk__layers flex flex-col overflow-hidden rounded-xl border border-border bg-card/95 text-card-foreground shadow-xl backdrop-blur-md",
				className,
			]
				.filter(Boolean)
				.join(" ")}
			style={{ ...style, ...floatingPanel.panelStyle }}
			aria-label={t("canvas.layers.ariaLabel", "Layers")}
			onWheel={(event) => event.stopPropagation()}
		>
			<div
				className="canvas-editor__panel-header flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2.5"
				{...floatingPanel.dragHandleProps}
			>
				<Layers className="canvas-editor__panel-title-icon h-4 w-4 shrink-0 text-primary" />
				<h3 className="canvas-editor__panel-title min-w-0 flex-1 truncate text-sm font-semibold">
					{t("canvas.layers.title", "Layers")}
				</h3>
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						aria-label={t("common.close", "Close")}
						className="canvas-editor__panel-icon-button flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-card-foreground"
					>
						<X className="h-3.5 w-3.5" />
					</button>
				)}
			</div>
			<div className="canvas-editor__layers-body scrollbar-thin min-h-0 flex-1 overflow-y-auto p-1.5">
				{rows.length === 0 && (
					<p className="canvas-editor__panel-empty px-2 py-4 text-center text-[11px] text-muted-foreground">
						{t("canvas.layers.empty", "No elements on the canvas yet.")}
					</p>
				)}
				<ul className="canvas-editor__layers-list space-y-0.5">
					{rows.map(({ element, depth }) => {
						const selected = selectedIds.has(element.id);
						const isDropTarget = dropTarget?.id === element.id;
						return (
							<li
								key={element.id}
								className="canvas-editor__layer-item relative"
							>
								{isDropTarget && dropTarget?.position === "above" && (
									<div
										className="canvas-editor__layer-drop-indicator absolute -top-0.5 right-1 left-1 h-0.5 rounded bg-primary"
										data-position="above"
									/>
								)}
								{/* biome-ignore lint/a11y/useSemanticElements: this draggable composite row contains nested controls and cannot be a button. */}
								<div
									role="button"
									tabIndex={0}
									data-selected={selected}
									draggable
									onDragStart={(event) => {
										setDragId(element.id);
										event.dataTransfer.effectAllowed = "move";
										event.dataTransfer.setData("text/plain", element.id);
									}}
									onDragEnd={() => {
										setDragId(null);
										setDropTarget(null);
									}}
									onDragOver={(event) => {
										if (!dragId || dragId === element.id) return;
										event.preventDefault();
										setDropTarget({
											id: element.id,
											position: resolveDropPosition(event),
										});
									}}
									onDragLeave={() =>
										setDropTarget((current) =>
											current?.id === element.id ? null : current,
										)
									}
									onDrop={(event) => {
										event.preventDefault();
										const movedId =
											event.dataTransfer.getData("text/plain") || dragId;
										if (movedId && movedId !== element.id) {
											onReorder(
												movedId,
												element.id,
												resolveDropPosition(event),
											);
										}
										setDragId(null);
										setDropTarget(null);
									}}
									onClick={(event) =>
										onSelect(element.id, event.ctrlKey || event.metaKey)
									}
									onDoubleClick={() => {
										if (element.type === "frame" && onRenameFrame) {
											setRenamingId(element.id);
										}
									}}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											onSelect(element.id, event.ctrlKey || event.metaKey);
										}
									}}
									className={`canvas-editor__layer-row group flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-[11px] transition-colors ${
										selected
											? "bg-primary/15 text-card-foreground"
											: "text-muted-foreground hover:bg-accent hover:text-card-foreground"
									}`}
									style={{ paddingLeft: `${6 + depth * 14}px` }}
								>
									<GripVertical className="canvas-editor__layer-grip h-3 w-3 shrink-0 cursor-grab opacity-0 transition-opacity group-hover:opacity-60" />
									<span className="canvas-editor__layer-type shrink-0 opacity-80">
										{layerTypeIcon(element)}
									</span>
									{renamingId === element.id && onRenameFrame ? (
										<LayerNameEditor
											element={element}
											onRenameFrame={onRenameFrame}
											onDone={() => setRenamingId(null)}
										/>
									) : (
										<span className="canvas-editor__layer-name min-w-0 flex-1 truncate">
											{layerDisplayName(element, t)}
										</span>
									)}
									<button
										type="button"
										data-locked={element.locked}
										onClick={(event) => {
											event.stopPropagation();
											onToggleLock(element.id, !element.locked);
										}}
										aria-label={
											element.locked
												? t("canvas.layers.unlock", "Unlock")
												: t("canvas.layers.lock", "Lock")
										}
										className={`canvas-editor__layer-lock flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded transition-opacity hover:bg-accent ${
											element.locked
												? "opacity-80"
												: "opacity-0 group-hover:opacity-60"
										}`}
									>
										{element.locked ? (
											<Lock className="h-3 w-3" />
										) : (
											<LockOpen className="h-3 w-3" />
										)}
									</button>
								</div>
								{isDropTarget && dropTarget?.position === "below" && (
									<div
										className="canvas-editor__layer-drop-indicator absolute right-1 -bottom-0.5 left-1 h-0.5 rounded bg-primary"
										data-position="below"
									/>
								)}
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);
}
