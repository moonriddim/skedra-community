import { CanvasRenderer } from "@/components/canvas/canvas-renderer";
import { Input } from "@/components/ui/input";
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
import { useEffect, useMemo, useState } from "react";

interface SavedViewTileProps {
	view: SavedCanvasView;
	elements: Map<string, CanvasElement>;
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
	resolveAssetUrl?: (src: string) => string;
	showAspectRatio: boolean;
	freeAspectLabel: string;
	editLabel: string;
	finishEditLabel: string;
	deleteLabel: string;
	duplicateLabel: string;
	movePreviousLabel: string;
	moveNextLabel: string;
}

const EMPTY_SELECTED_IDS = new Set<string>();

function intersectsView(element: CanvasElement, view: SavedCanvasView) {
	const bbox = getBBox(element);
	return (
		bbox.x < view.x + view.width &&
		bbox.x + bbox.width > view.x &&
		bbox.y < view.y + view.height &&
		bbox.y + bbox.height > view.y
	);
}

export function SavedViewTile({
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
	resolveAssetUrl,
	showAspectRatio,
	freeAspectLabel,
	editLabel,
	finishEditLabel,
	deleteLabel,
	duplicateLabel,
	movePreviousLabel,
	moveNextLabel,
}: SavedViewTileProps) {
	const [draftName, setDraftName] = useState(view.name);
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

	const previewScene = useMemo(() => {
		const nextElements: CanvasElement[] = [];
		elements.forEach((element, id) => {
			if (intersectsView(element, view)) {
				nextElements.push({ ...element, id });
			}
		});
		return CanvasScene.from(nextElements);
	}, [elements, view]);

	const commitRename = () => {
		const nextName = draftName.trim();
		if (!nextName || nextName === view.name) return;
		onRename(view.id, nextName);
	};

	return (
		<div className="group flex w-28 shrink-0 justify-center">
			<div className="flex w-24 origin-bottom flex-col gap-1 transition-transform duration-200 ease-out group-hover:scale-105 group-focus-within:scale-105">
				{isEditing ? (
					<Input
						value={draftName}
						onChange={(event) => setDraftName(event.target.value)}
						onBlur={commitRename}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								commitRename();
								(event.currentTarget as HTMLInputElement).blur();
							}
							if (event.key === "Escape") {
								event.preventDefault();
								setDraftName(view.name);
								(event.currentTarget as HTMLInputElement).blur();
							}
						}}
						autoFocus
						className="h-6 rounded-md px-1.5 text-[11px]"
					/>
				) : (
					<button
						type="button"
						onClick={() => onSelect(view.id)}
						className={`min-h-[1.75rem] px-1 text-left text-[11px] font-medium leading-tight whitespace-normal break-words transition-colors ${
							isActive ? "text-sky-300" : "text-foreground"
						}`}
					>
						{view.name}
					</button>
				)}

				<div className="relative flex items-start gap-1">
					<button
						type="button"
						onClick={() => onSelect(view.id)}
						className={`relative flex aspect-square min-w-0 flex-1 overflow-hidden rounded-xl border bg-[#0b1220] text-left transition-colors ${
							isEditing
								? "border-emerald-400/80"
								: isActive
									? "border-sky-400/80"
									: "border-border/70"
						}`}
					>
						<svg
							className="h-full w-full"
							viewBox={`${view.x} ${view.y} ${Math.max(view.width, 1)} ${Math.max(view.height, 1)}`}
							preserveAspectRatio="xMidYMid slice"
						>
							<title>{view.name}</title>
							<rect
								x={view.x}
								y={view.y}
								width={Math.max(view.width, 1)}
								height={Math.max(view.height, 1)}
								fill="#0b1220"
							/>
							<CanvasRenderer
								scene={previewScene}
								selectedIds={EMPTY_SELECTED_IDS}
								resolveAssetUrl={resolveAssetUrl}
							/>
						</svg>
						{showAspectRatio && (
							<>
								<div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
								<span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold text-white/85">
									{aspectRatioLabel}
								</span>
							</>
						)}
					</button>
				</div>

				{canManage && (
					<div
						className={`flex items-center justify-center gap-0.5 transition-opacity ${
							isEditing
								? "opacity-100"
								: "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
						}`}
					>
						<TileAction
							label={movePreviousLabel}
							onClick={() => onMove(view.id, -1)}
							disabled={!canMovePrevious}
						>
							<ChevronLeft className="h-3.5 w-3.5" />
						</TileAction>
						<TileAction
							label={moveNextLabel}
							onClick={() => onMove(view.id, 1)}
							disabled={!canMoveNext}
						>
							<ChevronRight className="h-3.5 w-3.5" />
						</TileAction>
						<TileAction
							label={duplicateLabel}
							onClick={() => onDuplicate(view.id)}
						>
							<Copy className="h-3 w-3" />
						</TileAction>
						<button
							type="button"
							onClick={() => {
								if (isEditing) {
									commitRename();
									onStopEdit();
									return;
								}
								onStartEdit(view.id);
							}}
							className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
								isEditing
									? "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
									: "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground"
							}`}
							title={isEditing ? finishEditLabel : editLabel}
						>
							{isEditing ? (
								<Check className="h-3.5 w-3.5" />
							) : (
								<Pencil className="h-3 w-3" />
							)}
						</button>

						<button
							type="button"
							onClick={() => onDelete(view.id)}
							className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							title={deleteLabel}
						>
							<Trash2 className="h-3 w-3" />
						</button>
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
	children,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30"
			title={label}
			aria-label={label}
		>
			{children}
		</button>
	);
}
