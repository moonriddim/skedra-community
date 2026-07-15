import { CanvasScene, getBBox } from "@skedra/canvas-core";
import type { CanvasElement, SavedCanvasView } from "@skedra/canvas-core";
import {
	Check,
	ChevronLeft,
	ChevronRight,
	Copy,
	Pencil,
	Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

export type CanvasEditorSavedViewPreviewRenderer = (
	scene: CanvasScene,
	view: SavedCanvasView,
) => ReactNode;

export interface CanvasEditorSavedViewTileProps {
	view: SavedCanvasView;
	elements: ReadonlyMap<string, CanvasElement>;
	isActive: boolean;
	isEditing: boolean;
	onSelect: (id: string) => void;
	onStartEdit: (id: string) => void;
	onStopEdit: () => void;
	onDelete: (id: string) => void;
	onDuplicate: (id: string) => void;
	onMove: (id: string, direction: -1 | 1) => void;
	canManage: boolean;
	canMovePrevious: boolean;
	canMoveNext: boolean;
	onRename: (id: string, name: string) => void;
	renderPreview: CanvasEditorSavedViewPreviewRenderer;
	showAspectRatio: boolean;
	freeAspectLabel: string;
	editLabel: string;
	finishEditLabel: string;
	deleteLabel: string;
	duplicateLabel: string;
	movePreviousLabel: string;
	moveNextLabel: string;
}

function intersectsView(element: CanvasElement, view: SavedCanvasView) {
	const bbox = getBBox(element);
	return (
		bbox.x < view.x + view.width &&
		bbox.x + bbox.width > view.x &&
		bbox.y < view.y + view.height &&
		bbox.y + bbox.height > view.y
	);
}

export function CanvasEditorSavedViewTile({
	view,
	elements,
	isActive,
	isEditing,
	onSelect,
	onStartEdit,
	onStopEdit,
	onDelete,
	onDuplicate,
	onMove,
	canManage,
	canMovePrevious,
	canMoveNext,
	onRename,
	renderPreview,
	showAspectRatio,
	freeAspectLabel,
	editLabel,
	finishEditLabel,
	deleteLabel,
	duplicateLabel,
	movePreviousLabel,
	moveNextLabel,
}: CanvasEditorSavedViewTileProps) {
	const [draftName, setDraftName] = useState(view.name);
	const nameInputRef = useRef<HTMLInputElement>(null);
	const aspectRatioLabel =
		view.aspectRatio ??
		(Math.abs(view.width / Math.max(view.height, 1) - 16 / 9) < 0.02
			? "16:9"
			: Math.abs(view.width / Math.max(view.height, 1) - 4 / 3) < 0.02
				? "4:3"
				: freeAspectLabel);

	useEffect(() => {
		setDraftName(view.name);
	}, [view.name]);

	useEffect(() => {
		if (!isEditing) return;
		nameInputRef.current?.focus();
		nameInputRef.current?.select();
	}, [isEditing]);

	const previewScene = useMemo(
		() =>
			CanvasScene.from(
				Array.from(elements.values()).filter((element) =>
					intersectsView(element, view),
				),
			),
		[elements, view],
	);

	const commitRename = () => {
		const nextName = draftName.trim();
		if (nextName && nextName !== view.name) onRename(view.id, nextName);
	};

	return (
		<div className="canvas-editor__saved-view-tile-group">
			<div className="canvas-editor__saved-view-tile">
				{isEditing ? (
					<input
						ref={nameInputRef}
						value={draftName}
						onChange={(event) => setDraftName(event.target.value)}
						onBlur={commitRename}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								commitRename();
								event.currentTarget.blur();
							}
							if (event.key === "Escape") {
								event.preventDefault();
								setDraftName(view.name);
								event.currentTarget.blur();
							}
						}}
						className="canvas-editor__saved-view-name-input"
						aria-label={view.name}
					/>
				) : (
					<button
						type="button"
						onClick={() => onSelect(view.id)}
						className="canvas-editor__saved-view-name"
						data-active={isActive}
					>
						{view.name}
					</button>
				)}

				<button
					type="button"
					onClick={() => onSelect(view.id)}
					className="canvas-editor__saved-view-preview"
					data-active={isActive}
					data-editing={isEditing}
				>
					<svg
						viewBox={`${view.x} ${view.y} ${Math.max(view.width, 1)} ${Math.max(view.height, 1)}`}
						preserveAspectRatio="xMidYMid slice"
						aria-label={view.name}
						role="img"
					>
						<title>{view.name}</title>
						<rect
							x={view.x}
							y={view.y}
							width={Math.max(view.width, 1)}
							height={Math.max(view.height, 1)}
							fill="#0b1220"
						/>
						{renderPreview(previewScene, view)}
					</svg>
					{showAspectRatio && (
						<>
							<span className="canvas-editor__saved-view-aspect-fade" />
							<span className="canvas-editor__saved-view-aspect-label">
								{aspectRatioLabel}
							</span>
						</>
					)}
				</button>

				{canManage && (
					<div
						className="canvas-editor__saved-view-actions"
						data-editing={isEditing}
					>
						<TileAction
							label={movePreviousLabel}
							onClick={() => onMove(view.id, -1)}
							disabled={!canMovePrevious}
						>
							<ChevronLeft size={14} />
						</TileAction>
						<TileAction
							label={moveNextLabel}
							onClick={() => onMove(view.id, 1)}
							disabled={!canMoveNext}
						>
							<ChevronRight size={14} />
						</TileAction>
						<TileAction
							label={duplicateLabel}
							onClick={() => onDuplicate(view.id)}
						>
							<Copy size={12} />
						</TileAction>
						<TileAction
							label={isEditing ? finishEditLabel : editLabel}
							active={isEditing}
							onClick={() => {
								if (isEditing) {
									commitRename();
									onStopEdit();
								} else {
									onStartEdit(view.id);
								}
							}}
						>
							{isEditing ? <Check size={14} /> : <Pencil size={12} />}
						</TileAction>
						<TileAction
							label={deleteLabel}
							danger
							onClick={() => onDelete(view.id)}
						>
							<Trash2 size={12} />
						</TileAction>
					</div>
				)}
			</div>
		</div>
	);
}

function TileAction({
	label,
	onClick,
	disabled,
	active,
	danger,
	children,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	active?: boolean;
	danger?: boolean;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className="canvas-editor__saved-view-action"
			data-active={active}
			data-danger={danger}
			title={label}
			aria-label={label}
		>
			{children}
		</button>
	);
}
