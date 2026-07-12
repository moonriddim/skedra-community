import { CanvasRenderer } from "@/components/canvas/canvas-renderer";
import { Input } from "@/components/ui/input";
import { CanvasScene, getBBox } from "@skedra/canvas-core";
import type { CanvasElement, SavedCanvasView } from "@skedra/canvas-core";
import { Check, Pencil, Trash2 } from "lucide-react";
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
	onRename: (id: string, name: string) => void;
	resolveAssetUrl?: (src: string) => string;
	editLabel: string;
	finishEditLabel: string;
	deleteLabel: string;
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
	onRename,
	resolveAssetUrl,
	editLabel,
	finishEditLabel,
	deleteLabel,
}: SavedViewTileProps) {
	const [draftName, setDraftName] = useState(view.name);

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
		<div className="group flex w-24 shrink-0 justify-center">
			<div className="flex w-20 origin-bottom flex-col gap-1 transition-transform duration-200 ease-out group-hover:scale-110">
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

				<div className="flex items-start gap-1">
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
						<div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
					</button>

					<div
						className={`flex shrink-0 flex-col gap-0.5 pt-0.5 transition-all duration-200 ${
							isEditing
								? "opacity-100"
								: "pointer-events-none translate-x-1 opacity-0 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100"
						}`}
					>
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
							className={`flex h-5 w-5 items-center justify-center rounded-md transition-all duration-200 ease-out ${
								isEditing
									? "scale-100 bg-emerald-500/20 text-emerald-200 hover:scale-125 hover:bg-emerald-500/30"
									: "scale-90 text-muted-foreground hover:scale-125 hover:bg-accent/70 hover:text-accent-foreground group-hover:scale-100"
							}`}
							title={isEditing ? finishEditLabel : editLabel}
						>
							{isEditing ? (
								<Check className="h-2.5 w-2.5" />
							) : (
								<Pencil className="h-2.5 w-2.5" />
							)}
						</button>

						<button
							type="button"
							onClick={() => onDelete(view.id)}
							className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-all duration-200 ease-out scale-90 hover:scale-125 hover:bg-destructive/10 hover:text-destructive group-hover:scale-100"
							title={deleteLabel}
						>
							<Trash2 className="h-2.5 w-2.5" />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
