import { readCanvasAttachmentFile } from "@/lib/canvas/attachment-utils";
import { KanbanAttachmentPreview } from "./kanban-attachment-preview";
/**
 * Detail-Dialog fuer Kanban-Karten.
 * Bearbeitet Titel, Beschreibung, Prioritaet, Faelligkeitsdatum/-zeit
 * und eine Checkliste.
 * Speichert direkt zurueck via updateElement (Yjs-Sync).
 */

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PickerInput } from "@/components/ui/picker-input";
import {
	type ImageUploadOptions,
	pickImageFile,
} from "@/lib/canvas/image-utils";
import {
	formatKanbanDateTime,
	getKanbanDueStatus,
} from "@/lib/canvas/kanban-due-status";
import { getKanbanPriorities } from "@/lib/canvas/kanban-options";
import { useI18n } from "@/lib/i18n";
import type {
	KanbanCardAttachment,
	KanbanChecklistItem,
	KanbanCoverImage,
	KanbanPriority,
} from "@skedra/canvas-core";
import {
	KANBAN_CARD_COVER_HEIGHT,
	computeKanbanCardHeight,
	normalizeKanbanAttachments,
	normalizeKanbanChecklist,
	normalizeKanbanCoverImage,
} from "@skedra/canvas-core";
import {
	type KanbanAssignmentOptions,
	getKanbanAssignmentBadgeCount,
} from "@skedra/canvas-core";
import { buildKanbanReflowUpdates } from "@skedra/canvas-core";
import type { CanvasElement } from "@skedra/canvas-core";
import { CanvasEditorKanbanCoverPosition } from "@skedra/canvas-editor";
import {
	Calendar,
	CheckSquare,
	ChevronDown,
	Clock3,
	Eye,
	EyeOff,
	GripVertical,
	ImagePlus,
	ImageUp,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { nanoid } from "nanoid";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { KanbanChecklistEditor } from "./kanban-checklist-editor";

interface KanbanCardDetailDialogProps {
	element: CanvasElement | null;
	elements: Map<string, CanvasElement>;
	assignmentOptions?: KanbanAssignmentOptions;
	onClose: () => void;
	onOpenMindmapSource?: (id: string) => void;
	onUpdate: (id: string, changes: Partial<CanvasElement>) => void;
	onUpdateElements: (
		updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
	) => void;
	onDelete: (id: string) => void;
	onPreviewElements?: (elements: CanvasElement[]) => void;
	imageUploadOptions?: ImageUploadOptions;
	resolveAssetUrl?: (src: string) => string;
}
type KanbanDialogSection = "cover" | "assignment" | "checklist" | "attachments";

export function KanbanCardDetailDialog({
	element,
	elements,
	assignmentOptions,
	onClose,
	onOpenMindmapSource,
	onUpdate,
	onUpdateElements,
	onDelete,
	onPreviewElements,
	imageUploadOptions,
	resolveAssetUrl,
}: KanbanCardDetailDialogProps) {
	const { t } = useI18n();
	const [dialogViewport, setDialogViewport] = useState(() => ({
		height: window.visualViewport?.height ?? window.innerHeight,
		top: window.visualViewport?.offsetTop ?? 0,
	}));
	useEffect(() => {
		const viewport = window.visualViewport;
		const update = () =>
			setDialogViewport({
				height: viewport?.height ?? window.innerHeight,
				top: viewport?.offsetTop ?? 0,
			});
		viewport?.addEventListener("resize", update);
		viewport?.addEventListener("scroll", update);
		window.addEventListener("resize", update);
		return () => {
			viewport?.removeEventListener("resize", update);
			viewport?.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
		};
	}, []);
	const kanbanPriorities = getKanbanPriorities();
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [priority, setPriority] = useState<KanbanPriority | null>(null);
	const [assigneeId, setAssigneeId] = useState("");
	const [roleId, setRoleId] = useState("");
	const [startDate, setStartDate] = useState("");
	const [startTime, setStartTime] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [dueTime, setDueTime] = useState("");
	const [dueComplete, setDueComplete] = useState(false);
	const [coverImage, setCoverImage] = useState<KanbanCoverImage | null>(null);
	const [checklist, setChecklist] = useState<KanbanChecklistItem[]>([]);
	const [attachments, setAttachments] = useState<KanbanCardAttachment[]>([]);
	const attachmentInput = useRef<HTMLInputElement>(null);
	const uploadGeneration = useRef(0);
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState("");
	// biome-ignore lint/correctness/useExhaustiveDependencies: Discard uploads started for a different card.
	useEffect(() => {
		uploadGeneration.current++;
		setUploading(false);
		setUploadError("");
		return () => {
			uploadGeneration.current++;
		};
	}, [element?.id]);
	const [draggedAttachmentId, setDraggedAttachmentId] = useState<string | null>(
		null,
	);
	const [dragOverAttachmentId, setDragOverAttachmentId] = useState<
		string | null
	>(null);
	const [hideCompleted, setHideCompleted] = useState(false);
	const [expandedSections, setExpandedSections] = useState<
		Record<KanbanDialogSection, boolean>
	>({
		cover: false,
		assignment: false,
		checklist: false,
		attachments: false,
	});
	const [loadedElementId, setLoadedElementId] = useState<string | null>(null);

	useEffect(() => {
		if (!element) {
			setLoadedElementId(null);
			return;
		}
		const nextCoverImage = normalizeKanbanCoverImage(element.customData);
		const nextAttachments = normalizeKanbanAttachments(element.customData);
		const nextChecklist = normalizeKanbanChecklist(
			element.customData?.checklist,
		);
		setTitle(element.text ?? "");
		setDescription(
			(element.customData?.description as string | undefined) ?? "",
		);
		const p = element.customData?.priority;
		setPriority(
			p === "low" || p === "medium" || p === "high" || p === "urgent"
				? p
				: null,
		);
		const nextAssigneeId =
			typeof element.customData?.assigneeId === "string"
				? element.customData.assigneeId
				: "";
		const nextRoleId =
			typeof element.customData?.roleId === "string"
				? element.customData.roleId
				: typeof element.customData?.groupId === "string"
					? element.customData.groupId
					: "";
		setAssigneeId(nextAssigneeId);
		setRoleId(nextRoleId);
		const startDateParts = splitDateTimeValue(
			(element.customData?.startDate as string | null | undefined) ?? "",
		);
		setStartDate(startDateParts.date);
		setStartTime(startDateParts.time);
		const dueDateParts = splitDueDateValue(
			(element.customData?.dueDate as string | null | undefined) ?? "",
		);
		setDueDate(dueDateParts.date);
		setDueTime(dueDateParts.time);
		setDueComplete(Boolean(element.customData?.dueComplete));
		setCoverImage(nextCoverImage);
		setAttachments(nextAttachments);
		setChecklist(nextChecklist);
		setHideCompleted(false);
		setExpandedSections({
			cover: Boolean(nextCoverImage),
			assignment: Boolean(
				nextAssigneeId ||
					nextRoleId ||
					typeof element.customData?.assigneeName === "string" ||
					typeof element.customData?.roleName === "string" ||
					typeof element.customData?.groupName === "string",
			),
			checklist: nextChecklist.length > 0,
			attachments: nextAttachments.length > 0,
		});
		setLoadedElementId(element.id);
	}, [element]);

	const draftChanges = useMemo<Partial<CanvasElement> | null>(() => {
		if (!element || loadedElementId !== element.id) return null;
		const nextTitle = title.trim() || t("canvas.kanban.newCard");
		const nextDescription = description.trim();
		const nextChecklist = normalizeKanbanChecklist(checklist);
		const nextStartDate = buildDueDateValue(startDate, startTime);
		const nextDueDate = buildDueDateValue(dueDate, dueTime);
		const selectedAssignee =
			assignmentOptions?.members.find((member) => member.id === assigneeId) ??
			null;
		const selectedRole =
			assignmentOptions?.roles.find((role) => role.id === roleId) ?? null;
		const assignmentBadges =
			(selectedAssignee ? 1 : 0) + (selectedRole ? 1 : 0);
		return {
			text: nextTitle,
			height: computeKanbanCardHeight({
				title: nextTitle,
				description: nextDescription,
				coverImage,
				checklist: nextChecklist,
				attachments,
				startDate: nextStartDate,
				dueDate: nextDueDate,
				assignmentBadges,
			}),
			customData: {
				...element.customData,
				skedraType: "kanban-card",
				description: nextDescription,
				priority,
				assigneeId: selectedAssignee?.id ?? null,
				assigneeName: selectedAssignee?.name ?? null,
				assigneeImage: selectedAssignee?.image ?? null,
				roleId: selectedRole?.id ?? null,
				roleName: selectedRole?.name ?? null,
				roleColor: selectedRole?.color ?? null,
				groupId: selectedRole?.id ?? null,
				groupName: selectedRole?.name ?? null,
				groupColor: selectedRole?.color ?? null,
				startDate: nextStartDate,
				dueDate: nextDueDate,
				dueComplete: nextDueDate ? dueComplete : false,
				coverImage,
				attachments,
				checklist: nextChecklist,
			},
		};
	}, [
		assigneeId,
		assignmentOptions,
		attachments,
		checklist,
		coverImage,
		description,
		dueComplete,
		dueDate,
		dueTime,
		element,
		loadedElementId,
		priority,
		roleId,
		startDate,
		startTime,
		t,
		title,
	]);

	useEffect(() => {
		if (!element || !draftChanges || !onPreviewElements) return;
		const previewElement = { ...element, ...draftChanges };
		if (!element.frameId) {
			onPreviewElements([previewElement]);
			return;
		}

		const nextElements = new Map(elements);
		nextElements.set(element.id, previewElement);
		const reflowUpdates = buildKanbanReflowUpdates(
			nextElements,
			new Set([element.id]),
			new Map([[element.id, element.frameId]]),
		);
		const previews = [previewElement];
		for (const update of reflowUpdates) {
			if (update.id === element.id) continue;
			const current = nextElements.get(update.id);
			if (current) previews.push({ ...current, ...update.changes });
		}
		onPreviewElements(previews);
	}, [draftChanges, element, elements, onPreviewElements]);

	useEffect(() => () => onPreviewElements?.([]), [onPreviewElements]);

	if (!element) return null;

	const handleSave = () => {
		if (!draftChanges) return;

		if (element.frameId) {
			const nextElements = new Map(elements);
			nextElements.set(element.id, { ...element, ...draftChanges });
			const reflowUpdates = buildKanbanReflowUpdates(
				nextElements,
				new Set([element.id]),
				new Map([[element.id, element.frameId]]),
			);
			onUpdateElements([
				{ id: element.id, changes: draftChanges },
				...reflowUpdates.filter((update) => update.id !== element.id),
			]);
		} else {
			onUpdate(element.id, draftChanges);
		}
		onClose();
	};

	const completedChecklistItems = checklist.filter(
		(item) => item.completed,
	).length;
	const checklistProgress =
		checklist.length > 0
			? Math.round((completedChecklistItems / checklist.length) * 100)
			: 0;
	const dueStatusPreview = getKanbanDueStatus(
		buildDueDateValue(dueDate, dueTime),
		dueComplete,
	);
	const selectedAssigneeName =
		assignmentOptions?.members.find((member) => member.id === assigneeId)
			?.name ??
		(typeof element.customData?.assigneeName === "string"
			? element.customData.assigneeName
			: "");
	const selectedRoleName =
		assignmentOptions?.roles.find((role) => role.id === roleId)?.name ??
		(typeof element.customData?.roleName === "string"
			? element.customData.roleName
			: typeof element.customData?.groupName === "string"
				? element.customData.groupName
				: "");
	const selectedRoleOption =
		assignmentOptions?.roles.find((role) => role.id === roleId) ?? null;
	const assignmentSummary = [selectedAssigneeName, selectedRoleName]
		.filter(Boolean)
		.join(" · ");
	const previewHeight = computeKanbanCardHeight({
		title: title.trim() || "Neue Karte",
		description: description,
		coverImage,
		checklist,
		attachments,
		startDate: buildDueDateValue(startDate, startTime),
		dueDate: buildDueDateValue(dueDate, dueTime),
		assignmentBadges: getKanbanAssignmentBadgeCount({
			assigneeName: assignmentOptions?.members.find(
				(member) => member.id === assigneeId,
			)?.name,
			roleName: assignmentOptions?.roles.find((role) => role.id === roleId)
				?.name,
		}),
	});
	const coverImagePreviewSrc = coverImage
		? (resolveAssetUrl?.(coverImage.src) ?? coverImage.src)
		: "";
	const recommendedCoverWidth = Math.max(1024, Math.ceil(element.width * 2));
	const recommendedCoverHeight = Math.round(
		(recommendedCoverWidth * KANBAN_CARD_COVER_HEIGHT) /
			Math.max(1, element.width),
	);

	const handlePickCover = async () => {
		const picked = await pickImageFile(imageUploadOptions);
		if (!picked) return;
		setCoverImage({
			id: createAttachmentId(),
			src: picked.src,
			name: picked.name,
			width: picked.width,
			height: picked.height,
			position: { x: 50, y: 50 },
		});
	};

	const handleAttachmentFiles = async (files: File[]) => {
		if (!files.length) return;
		const generation = ++uploadGeneration.current;
		setUploading(true);
		setUploadError("");
		const results = await Promise.allSettled(
			files.map((file) => readCanvasAttachmentFile(file, imageUploadOptions)),
		);
		if (uploadGeneration.current !== generation) return;
		const picked = results.flatMap((result) =>
			result.status === "fulfilled"
				? [{ id: createAttachmentId(), ...result.value }]
				: [],
		);
		setAttachments((current) => [...current, ...picked]);
		const failed = results.flatMap((result, index) =>
			result.status === "rejected" ? [files[index].name] : [],
		);
		if (failed.length)
			setUploadError(
				t("kanbanCardDialog.attachmentUploadError", {
					names: failed.join(", "),
					limit: Math.round(
						(imageUploadOptions?.maxImageBytes ?? 10 * 1024 * 1024) /
							(1024 * 1024),
					),
				}),
			);
		setUploading(false);
	};

	const handleRemoveAttachment = (attachmentId: string) => {
		setAttachments((current) =>
			current.filter((attachment) => attachment.id !== attachmentId),
		);
	};

	const handleReorderAttachments = (fromId: string, toId: string) => {
		if (fromId === toId) return;
		setAttachments((current) => {
			const fromIndex = current.findIndex(
				(attachment) => attachment.id === fromId,
			);
			const toIndex = current.findIndex((attachment) => attachment.id === toId);
			if (fromIndex === -1 || toIndex === -1) return current;
			const next = [...current];
			const [moved] = next.splice(fromIndex, 1);
			next.splice(toIndex, 0, moved);
			return next;
		});
	};

	const handleDelete = () => {
		onDelete(element.id);
		onClose();
	};

	const toggleSection = (section: KanbanDialogSection) => {
		setExpandedSections((current) => ({
			...current,
			[section]: !current[section],
		}));
	};

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				onOpenAutoFocus={(event) => event.preventDefault()}
				style={{
					maxHeight: dialogViewport.height - 24,
					top: dialogViewport.top + dialogViewport.height / 2,
				}}
				className="flex max-w-2xl flex-col gap-0 overflow-hidden p-0 max-lg:overflow-hidden max-lg:p-0 max-sm:p-0"
			>
				<DialogHeader className="shrink-0 border-b border-border px-4 py-5 pr-16 text-left">
					<DialogTitle className="text-base">
						{t("kanbanCardDialog.title")}
					</DialogTitle>
				</DialogHeader>
				{typeof element?.customData?.mindmapSourceId === "string" &&
					elements.has(element.customData.mindmapSourceId) &&
					onOpenMindmapSource && (
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								onOpenMindmapSource(
									element.customData?.mindmapSourceId as string,
								)
							}
						>
							{t("mindmapStudio.source")}:{" "}
							{elements.get(element.customData.mindmapSourceId)?.text}
						</Button>
					)}
				<div
					data-kanban-dialog-scroll="true"
					className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4"
				>
					<div className="min-w-0 space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="kanban-title">
								{t("kanbanCardDialog.cardTitle")}
							</Label>
							<Input
								id="kanban-title"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder={t("kanbanCardDialog.cardTitlePlaceholder")}
							/>
						</div>

						<CollapsibleDialogSection
							expanded={expandedSections.cover}
							onToggle={() => toggleSection("cover")}
							icon={<ImageUp className="h-4 w-4" />}
							title={t("kanbanCardDialog.cover")}
							summary={
								coverImage?.name ??
								t("kanbanCardDialog.automaticHeight", { height: previewHeight })
							}
						>
							<div className="flex gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={handlePickCover}
									className="flex-1"
								>
									<ImageUp className="h-4 w-4" />
									{coverImage
										? t("kanbanCardDialog.replaceCover")
										: t("kanbanCardDialog.addCover")}
								</Button>
								{coverImage && (
									<Button
										type="button"
										variant="outline"
										onClick={() => setCoverImage(null)}
										aria-label={`${t("common.delete")} ${t("kanbanCardDialog.cover")}`}
									>
										<X className="h-4 w-4" />
									</Button>
								)}
							</div>
							<p className="text-xs leading-relaxed text-muted-foreground">
								{t("kanbanCardDialog.coverRecommendedSize", {
									width: recommendedCoverWidth,
									height: recommendedCoverHeight,
								})}
							</p>
							{coverImage ? (
								<div className="overflow-hidden rounded-lg border border-border bg-muted/30">
									<CanvasEditorKanbanCoverPosition
										key={coverImage.id}
										src={coverImagePreviewSrc}
										alt={coverImage.name}
										imageWidth={coverImage.width}
										imageHeight={coverImage.height}
										aspectRatio={
											Math.max(1, element.width) / KANBAN_CARD_COVER_HEIGHT
										}
										position={coverImage.position}
										onChange={(position) =>
											setCoverImage((current) =>
												current ? { ...current, position } : null,
											)
										}
										labels={{
											hint: t("kanbanCardDialog.coverPositionHint"),
											horizontal: t("kanbanCardDialog.coverPositionHorizontal"),
											vertical: t("kanbanCardDialog.coverPositionVertical"),
											center: t("kanbanCardDialog.coverPositionCenter"),
										}}
									/>
									<div className="flex flex-wrap items-center gap-2 border-t border-border/70 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
										<div className="flex min-w-0 items-center gap-2 break-all">
											<ImageUp className="h-3.5 w-3.5" />
											<span>
												{t("kanbanCardDialog.activeCover", {
													name: coverImage.name,
												})}
											</span>
										</div>
										<span>{t("kanbanCardDialog.coverBanner")}</span>
									</div>
								</div>
							) : (
								<div className="rounded-lg border border-dashed border-border bg-background/50 px-4 py-5 text-center">
									<p className="text-sm font-medium">
										{t("kanbanCardDialog.noCoverTitle")}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{t("kanbanCardDialog.noCoverDescription")}
									</p>
								</div>
							)}
						</CollapsibleDialogSection>

						<div className="space-y-1.5">
							<Label htmlFor="kanban-description">
								{t("kanbanCardDialog.description")}
							</Label>
							<textarea
								id="kanban-description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder={t("kanbanCardDialog.descriptionPlaceholder")}
								rows={3}
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
							/>
						</div>

						<CollapsibleDialogSection
							expanded={expandedSections.assignment}
							onToggle={() => toggleSection("assignment")}
							icon={<Users className="h-4 w-4" />}
							title={t("kanbanCardDialog.assignment")}
							summary={
								assignmentSummary || t("kanbanCardDialog.assignmentDescription")
							}
						>
							<div className="grid gap-2.5 sm:grid-cols-2">
								<div className="space-y-1.5">
									<Label
										htmlFor="kanban-assignee"
										className="text-xs text-muted-foreground"
									>
										{t("kanbanCardDialog.assignee")}
									</Label>
									<select
										id="kanban-assignee"
										value={assigneeId}
										onChange={(event) => setAssigneeId(event.target.value)}
										className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
									>
										<option value="">{t("kanbanCardDialog.noAssignee")}</option>
										{assignmentOptions?.members.map((member) => (
											<option key={member.id} value={member.id}>
												{member.name}
											</option>
										))}
									</select>
								</div>
								<div className="space-y-1.5">
									<Label
										htmlFor="kanban-role"
										className="text-xs text-muted-foreground"
									>
										{t("kanbanCardDialog.role")}
									</Label>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<button
												id="kanban-role"
												type="button"
												className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors hover:border-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
											>
												<span className="flex min-w-0 items-center gap-2">
													<span
														className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
														style={{
															backgroundColor:
																selectedRoleOption?.color ?? "transparent",
														}}
														aria-hidden
													/>
													<span
														className="truncate"
														style={{
															color: selectedRoleOption?.color ?? undefined,
														}}
													>
														{selectedRoleOption?.name ??
															t("kanbanCardDialog.noRole")}
													</span>
												</span>
												<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
											</button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="start" className="w-56">
											<DropdownMenuItem
												className="gap-2"
												onClick={() => setRoleId("")}
											>
												<span className="h-2.5 w-2.5 shrink-0 rounded-full border border-border" />
												<span>{t("kanbanCardDialog.noRole")}</span>
											</DropdownMenuItem>
											{assignmentOptions?.roles.map((role) => (
												<DropdownMenuItem
													key={role.id}
													className="gap-2"
													onClick={() => setRoleId(role.id)}
												>
													<span
														className="h-2.5 w-2.5 shrink-0 rounded-full"
														style={{ backgroundColor: role.color ?? "#64748B" }}
														aria-hidden
													/>
													<span
														className="truncate"
														style={{ color: role.color ?? undefined }}
													>
														{role.name}
													</span>
												</DropdownMenuItem>
											))}
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</div>
						</CollapsibleDialogSection>

						<CollapsibleDialogSection
							expanded={expandedSections.checklist}
							onToggle={() => toggleSection("checklist")}
							icon={<CheckSquare className="h-4 w-4" />}
							title={t("kanbanCardDialog.checklist")}
							summary={
								checklist.length > 0
									? t("kanbanCardDialog.completedSummary", {
											completed: completedChecklistItems,
											total: checklist.length,
										})
									: t("kanbanCardDialog.checklistDescription")
							}
						>
							<div className="flex justify-end">
								{checklist.length > 0 && (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setHideCompleted((current) => !current)}
									>
										{hideCompleted ? (
											<Eye className="h-4 w-4" />
										) : (
											<EyeOff className="h-4 w-4" />
										)}
										{hideCompleted
											? t("kanbanCardDialog.showAll")
											: t("kanbanCardDialog.hideCompleted")}
									</Button>
								)}
							</div>

							{checklist.length > 0 && (
								<div className="space-y-1.5">
									<div className="flex items-center justify-between text-xs text-muted-foreground">
										<span>
											{t("kanbanCardDialog.completedSummary", {
												completed: completedChecklistItems,
												total: checklist.length,
											})}
										</span>
										<span>{checklistProgress}%</span>
									</div>
									<div className="h-2 overflow-hidden rounded-full bg-muted">
										<div
											className={`h-full rounded-full transition-all ${checklistProgress === 100 ? "bg-emerald-500" : "bg-primary"}`}
											style={{ width: `${checklistProgress}%` }}
										/>
									</div>
								</div>
							)}

							<KanbanChecklistEditor
								items={checklist}
								onChange={setChecklist}
								hideCompleted={hideCompleted}
							/>
						</CollapsibleDialogSection>

						<CollapsibleDialogSection
							expanded={expandedSections.attachments}
							onToggle={() => toggleSection("attachments")}
							icon={<ImagePlus className="h-4 w-4" />}
							title={t("kanbanCardDialog.attachments")}
							summary={
								attachments.length > 0
									? t("kanbanCardDialog.attachmentCount", {
											count: attachments.length,
										})
									: t("kanbanCardDialog.attachmentsDescription")
							}
						>
							<input
								ref={attachmentInput}
								data-kanban-attachment-upload="true"
								type="file"
								multiple
								className="hidden"
								onChange={(event) => {
									const files = Array.from(event.target.files ?? []);
									event.target.value = "";
									void handleAttachmentFiles(files);
								}}
							/>
							{uploadError && (
								<p
									role="alert"
									className="break-words text-sm text-destructive"
								>
									{uploadError}
								</p>
							)}
							<div className="flex gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => attachmentInput.current?.click()}
									disabled={uploading}
									className="flex-1"
								>
									<ImagePlus className="h-4 w-4" />
									{uploading
										? t("kanbanCardDialog.uploadingAttachments")
										: t("kanbanCardDialog.addAttachments")}
								</Button>
								{attachments.length > 0 && (
									<Button
										type="button"
										variant="outline"
										onClick={() => setAttachments([])}
										aria-label={`${t("common.delete")} ${t("kanbanCardDialog.attachments")}`}
									>
										<X className="h-4 w-4" />
									</Button>
								)}
							</div>
							<p className="text-xs text-muted-foreground">
								{t("kanbanCardDialog.attachmentsHint")}
							</p>
							{attachments.length > 0 ? (
								<div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
									{attachments.map((attachment) => {
										return (
											<div
												key={attachment.id}
												draggable
												onDragStart={(event) => {
													setDraggedAttachmentId(attachment.id);
													event.dataTransfer.effectAllowed = "move";
													event.dataTransfer.setData(
														"text/plain",
														attachment.id,
													);
												}}
												onDragOver={(event) => {
													event.preventDefault();
													event.dataTransfer.dropEffect = "move";
													setDragOverAttachmentId(attachment.id);
												}}
												onDrop={(event) => {
													event.preventDefault();
													const fromId =
														draggedAttachmentId ??
														event.dataTransfer.getData("text/plain");
													if (fromId)
														handleReorderAttachments(fromId, attachment.id);
													setDraggedAttachmentId(null);
													setDragOverAttachmentId(null);
												}}
												onDragEnd={() => {
													setDraggedAttachmentId(null);
													setDragOverAttachmentId(null);
												}}
												className={`overflow-hidden rounded-lg border bg-background transition-colors ${dragOverAttachmentId === attachment.id ? "border-primary ring-1 ring-primary/40" : "border-border"} ${draggedAttachmentId === attachment.id ? "opacity-60" : "opacity-100"}`}
											>
												<KanbanAttachmentPreview
													attachment={attachment}
													resolvedSrc={
														resolveAssetUrl?.(attachment.src) ?? attachment.src
													}
												/>
												<div className="space-y-1.5 p-2.5">
													<div className="flex items-center justify-between gap-2">
														<div className="flex min-w-0 items-center gap-2">
															<GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
															<p className="truncate text-sm font-medium">
																{attachment.name}
															</p>
														</div>
														<span className="text-[11px] text-muted-foreground">
															{t("kanbanCardDialog.attachment")}
														</span>
													</div>
													<div className="flex justify-end">
														<Button
															aria-label={`${t("common.delete")} ${attachment.name}`}
															type="button"
															variant="ghost"
															size="icon"
															onClick={() =>
																handleRemoveAttachment(attachment.id)
															}
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							) : (
								<p className="text-sm text-muted-foreground">
									{t("kanbanCardDialog.noAttachments")}
								</p>
							)}
						</CollapsibleDialogSection>

						<div className="space-y-1.5">
							<Label>{t("kanbanCardDialog.priority")}</Label>
							<div className="grid grid-cols-5 gap-1.5">
								<button
									type="button"
									onClick={() => setPriority(null)}
									className={`flex flex-col items-center gap-1 rounded-md border py-1 transition-all cursor-pointer ${
										priority === null
											? "border-primary bg-primary/10"
											: "border-border hover:border-muted-foreground"
									}`}
								>
									<div
										className="w-3 h-3 rounded-sm"
										style={{ backgroundColor: "var(--kanban-priority-none)" }}
									/>
									<span className="text-[10px]">{t("common.none")}</span>
								</button>
								{kanbanPriorities.map((p) => (
									<button
										key={p.value}
										type="button"
										onClick={() => setPriority(p.value)}
										className={`flex flex-col items-center gap-1 rounded-md border py-1 transition-all cursor-pointer ${
											priority === p.value
												? "border-primary bg-primary/10"
												: "border-border hover:border-muted-foreground"
										}`}
									>
										<div
											className="w-3 h-3 rounded-sm"
											style={{ backgroundColor: p.color }}
										/>
										<span className="text-[10px]">{p.label}</span>
									</button>
								))}
							</div>
						</div>

						<div className="space-y-1.5">
							<div className="grid items-end gap-2.5 sm:grid-cols-[minmax(0,1fr)_150px]">
								<div className="space-y-1.5">
									<Label
										htmlFor="kanban-startdate"
										className="flex min-h-5 items-center gap-1.5 text-sm font-medium"
									>
										<Calendar className="h-3.5 w-3.5" />
										{t("kanbanCardDialog.startDate")}
									</Label>
									<PickerInput
										id="kanban-startdate"
										icon={Calendar}
										type="date"
										value={startDate}
										onChange={(e) => {
											const nextDate = e.target.value;
											setStartDate(nextDate);
											if (!nextDate) setStartTime("");
										}}
									/>
								</div>
								<div className="space-y-1.5">
									<div className="flex min-h-5 items-center justify-between gap-2">
										<Label
											htmlFor="kanban-starttime"
											className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
										>
											<Clock3 className="h-3.5 w-3.5 shrink-0" />
											<span className="truncate">
												{t("kanbanCardDialog.optionalTime")}
											</span>
										</Label>
										{(startDate || startTime) && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-5 shrink-0 px-1.5 text-xs"
												onClick={() => {
													setStartDate("");
													setStartTime("");
												}}
											>
												{t("kanbanCardDialog.reset")}
											</Button>
										)}
									</div>
									<PickerInput
										id="kanban-starttime"
										icon={Clock3}
										type="time"
										value={startTime}
										onChange={(e) => setStartTime(e.target.value)}
										disabled={!startDate}
									/>
								</div>
							</div>
							<p className="text-xs text-muted-foreground">
								{t("kanbanCardDialog.startDateHint")}
							</p>
						</div>

						<div className="space-y-1.5">
							<div className="grid items-end gap-2.5 sm:grid-cols-[minmax(0,1fr)_150px]">
								<div className="space-y-1.5">
									<Label
										htmlFor="kanban-duedate"
										className="flex min-h-5 items-center gap-1.5 text-sm font-medium"
									>
										<Calendar className="h-3.5 w-3.5" />
										{t("kanbanCardDialog.dueDate")}
									</Label>
									<PickerInput
										id="kanban-duedate"
										icon={Calendar}
										type="date"
										value={dueDate}
										onChange={(e) => {
											const nextDate = e.target.value;
											setDueDate(nextDate);
											if (!nextDate) setDueTime("");
										}}
									/>
								</div>
								<div className="space-y-1.5">
									<div className="flex min-h-5 items-center justify-between gap-2">
										<Label
											htmlFor="kanban-duetime"
											className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
										>
											<Clock3 className="h-3.5 w-3.5 shrink-0" />
											<span className="truncate">
												{t("kanbanCardDialog.optionalTime")}
											</span>
										</Label>
										{(dueDate || dueTime) && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-5 shrink-0 px-1.5 text-xs"
												onClick={() => {
													setDueDate("");
													setDueTime("");
												}}
											>
												{t("kanbanCardDialog.reset")}
											</Button>
										)}
									</div>
									<PickerInput
										id="kanban-duetime"
										icon={Clock3}
										type="time"
										value={dueTime}
										onChange={(e) => setDueTime(e.target.value)}
										disabled={!dueDate}
									/>
								</div>
							</div>
							<p className="text-xs text-muted-foreground">
								{t("kanbanCardDialog.dueDateHint")}
							</p>
							{dueDate && (
								<div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-1.5 text-sm">
									<span className="text-xs text-muted-foreground">
										{t("kanbanCardDialog.preview")}
									</span>
									<span
										className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
										style={{
											color: dueStatusPreview.textColor,
											background: dueStatusPreview.background,
										}}
									>
										<span>{dueStatusPreview.icon}</span>
										<span>
											{dueStatusPreview.label}{" "}
											{formatKanbanDateTime(
												buildDueDateValue(dueDate, dueTime) ?? dueDate,
											)}
										</span>
									</span>
								</div>
							)}
							<label
								className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${dueDate ? "border-border bg-background" : "border-border/60 bg-muted/30 text-muted-foreground"}`}
							>
								<input
									type="checkbox"
									checked={dueComplete}
									onChange={(e) => setDueComplete(e.target.checked)}
									disabled={!dueDate}
									className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
								/>
								<span>{t("kanbanCardDialog.markDueComplete")}</span>
							</label>
						</div>
					</div>
				</div>
				<DialogFooter className="grid shrink-0 grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-t border-border bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:grid-cols-[auto_1fr_auto] sm:space-x-0">
					<Button
						variant="ghost"
						onClick={handleDelete}
						aria-label={t("common.delete")}
						className="min-w-0 px-2 text-destructive hover:text-destructive"
					>
						<Trash2 className="h-4 w-4 mr-1.5" />
						<span className="hidden sm:inline">{t("common.delete")}</span>
					</Button>
					<Button
						className="min-w-0 px-2 sm:justify-self-end"
						variant="outline"
						onClick={onClose}
					>
						{t("common.cancel")}
					</Button>
					<Button
						className="min-w-0 px-2"
						disabled={uploading}
						onClick={handleSave}
					>
						{t("common.save")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function CollapsibleDialogSection({
	expanded,
	onToggle,
	icon,
	title,
	summary,
	children,
}: {
	expanded: boolean;
	onToggle: () => void;
	icon: ReactNode;
	title: string;
	summary?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="min-w-0 overflow-hidden rounded-lg border border-border bg-muted/10">
			<button
				type="button"
				onClick={onToggle}
				className="flex w-full min-w-0 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/30"
			>
				<span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-foreground">
					{icon}
					<span className="truncate">{title}</span>
				</span>
				<span className="flex min-w-0 max-w-[48%] items-center gap-2 text-xs text-muted-foreground">
					{summary ? <span className="block truncate">{summary}</span> : null}
					<ChevronDown
						className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
					/>
				</span>
			</button>
			{expanded && (
				<div className="space-y-2.5 border-t border-border/70 p-3">
					{children}
				</div>
			)}
		</section>
	);
}

function splitDateTimeValue(value: string): { date: string; time: string } {
	if (!value) return { date: "", time: "" };

	const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}))?/);
	if (match) {
		return {
			date: match[1] ?? "",
			time: match[2] ?? "",
		};
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return { date: value, time: "" };

	const date = [
		parsed.getFullYear().toString().padStart(4, "0"),
		(parsed.getMonth() + 1).toString().padStart(2, "0"),
		parsed.getDate().toString().padStart(2, "0"),
	].join("-");
	const time = [parsed.getHours(), parsed.getMinutes()]
		.map((part) => part.toString().padStart(2, "0"))
		.join(":");
	return { date, time: time === "00:00" ? "" : time };
}

function splitDueDateValue(value: string): { date: string; time: string } {
	return splitDateTimeValue(value);
}

function buildDueDateValue(date: string, time: string): string | null {
	if (!date) return null;
	return time ? `${date}T${time}` : date;
}

function createAttachmentId(): string {
	return `att-${nanoid(10)}`;
}
