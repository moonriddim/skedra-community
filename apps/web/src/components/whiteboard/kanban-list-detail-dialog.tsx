import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pickImageFile } from "@/lib/canvas/image-utils";
import { useI18n } from "@/lib/i18n";
import {
	KANBAN_LIST_IMAGE_ASPECT_RATIO,
	buildKanbanListReflowUpdates,
	normalizeKanbanImageFocus,
} from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { ImagePlus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

interface KanbanListDetailDialogProps {
	element: CanvasElement | null;
	elements: Map<string, CanvasElement>;
	onClose: () => void;
	onUpdate: (id: string, changes: Partial<CanvasElement>) => void;
	onUpdateElements: (
		updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
	) => void;
	onAddCard: (id: string) => void;
}

export function KanbanListDetailDialog({
	element,
	elements,
	onClose,
	onUpdate,
	onUpdateElements,
	onAddCard,
}: KanbanListDetailDialogProps) {
	const [title, setTitle] = useState("");
	const [headerImageSrc, setHeaderImageSrc] = useState("");
	const [headerImageFocus, setHeaderImageFocus] = useState({ x: 0.5, y: 0.5 });
	const [isDraggingHeaderImage, setIsDraggingHeaderImage] = useState(false);
	const headerImageDragRef = useRef<{
		pointerId: number;
		startX: number;
		startY: number;
		width: number;
		height: number;
		focus: { x: number; y: number };
	} | null>(null);
	const { t } = useI18n();

	useEffect(() => {
		if (!element) return;
		setTitle(element.frameLabel ?? "");
		setHeaderImageSrc(
			(element.customData?.headerImageSrc as string | undefined) ?? "",
		);
		setHeaderImageFocus(
			normalizeKanbanImageFocus(element.customData?.headerImageFocus),
		);
	}, [element]);

	if (!element) return null;

	const handleSave = () => {
		const changes: Partial<CanvasElement> = {
			frameLabel: title.trim() || t("kanbanListDialog.defaultListName"),
			customData: {
				...(element.customData ?? {}),
				skedraType: "kanban-list",
				headerImageSrc: headerImageSrc || null,
				headerImageFocus,
			},
		};
		const nextElements = new Map(elements);
		nextElements.set(element.id, { ...element, ...changes });
		const reflowUpdates = buildKanbanListReflowUpdates(
			nextElements,
			element.id,
		);
		if (reflowUpdates.length > 0) {
			const listLayout = reflowUpdates.find(
				(update) => update.id === element.id,
			);
			onUpdateElements([
				{
					id: element.id,
					changes: { ...changes, ...(listLayout?.changes ?? {}) },
				},
				...reflowUpdates.filter((update) => update.id !== element.id),
			]);
		} else {
			onUpdate(element.id, changes);
		}
		onClose();
	};

	const handlePickImage = async () => {
		const picked = await pickImageFile();
		if (!picked) return;
		setHeaderImageSrc(picked.src);
		setHeaderImageFocus({ x: 0.5, y: 0.5 });
	};

	const beginHeaderImageDrag = (event: React.PointerEvent<HTMLDivElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		headerImageDragRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			width: rect.width,
			height: rect.height,
			focus: headerImageFocus,
		};
		setIsDraggingHeaderImage(true);
		event.currentTarget.setPointerCapture(event.pointerId);
		event.preventDefault();
	};

	const updateHeaderImageDrag = (event: React.PointerEvent<HTMLDivElement>) => {
		const drag = headerImageDragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		const deltaX = event.clientX - drag.startX;
		const deltaY = event.clientY - drag.startY;
		setHeaderImageFocus({
			x: clamp01(drag.focus.x - deltaX / drag.width),
			y: clamp01(drag.focus.y - deltaY / drag.height),
		});
	};

	const endHeaderImageDrag = (event: React.PointerEvent<HTMLDivElement>) => {
		const drag = headerImageDragRef.current;
		if (drag?.pointerId !== event.pointerId) return;
		headerImageDragRef.current = null;
		setIsDraggingHeaderImage(false);
	};

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>{t("kanbanListDialog.title")}</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="kanban-list-title">
							{t("kanbanListDialog.listTitle")}
						</Label>
						<Input
							id="kanban-list-title"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							placeholder={t("kanbanListDialog.titlePlaceholder")}
							autoFocus
						/>
					</div>

					<div className="space-y-2">
						<div className="flex items-end justify-between gap-3">
							<Label>{t("kanbanListDialog.headerImage")}</Label>
							<span className="text-xs text-muted-foreground">
								{t("kanbanListDialog.headerImageFormat")}
							</span>
						</div>
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={handlePickImage}
								className="flex-1"
							>
								<ImagePlus className="h-4 w-4" />
								{t("kanbanListDialog.selectImage")}
							</Button>
							{headerImageSrc && (
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setHeaderImageSrc("");
										setHeaderImageFocus({ x: 0.5, y: 0.5 });
									}}
								>
									<X className="h-4 w-4" />
								</Button>
							)}
						</div>
						{headerImageSrc && (
							<div
								className={`relative overflow-hidden rounded-md border border-border bg-muted/30 ${
									isDraggingHeaderImage ? "cursor-grabbing" : "cursor-grab"
								}`}
								style={{ aspectRatio: KANBAN_LIST_IMAGE_ASPECT_RATIO }}
								onPointerDown={beginHeaderImageDrag}
								onPointerMove={updateHeaderImageDrag}
								onPointerUp={endHeaderImageDrag}
								onPointerCancel={endHeaderImageDrag}
							>
								<img
									src={headerImageSrc}
									alt={t("kanbanListDialog.imageAlt")}
									className="h-full w-full object-cover"
									style={{
										objectPosition: `${Math.round(headerImageFocus.x * 100)}% ${Math.round(
											headerImageFocus.y * 100,
										)}%`,
									}}
								/>
								<div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/35" />
							</div>
						)}
						{headerImageSrc && (
							<p className="text-xs text-muted-foreground">
								{t("kanbanListDialog.headerImageFocusHint")}
							</p>
						)}
					</div>

					<Button
						type="button"
						variant="outline"
						className="w-full justify-center"
						onClick={() => onAddCard(element.id)}
					>
						<Plus className="h-4 w-4" />
						{t("kanbanListDialog.addCard")}
					</Button>
				</div>

				<DialogFooter className="gap-2">
					<Button variant="outline" onClick={onClose}>
						{t("common.cancel")}
					</Button>
					<Button onClick={handleSave}>{t("common.save")}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
