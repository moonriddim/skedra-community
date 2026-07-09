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
import { pickImageFile, pickImageFiles } from "@/lib/canvas/image-utils";
import {
	formatKanbanDateTime,
	getKanbanDueStatus,
} from "@/lib/canvas/kanban-due-status";
import { getKanbanPriorities } from "@/lib/canvas/kanban-options";
import { useI18n } from "@/lib/i18n";
import type {
	KanbanCardAttachment,
	KanbanChecklistItem,
	KanbanPriority,
} from "@skedra/canvas-core";
import {
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
	Plus,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { nanoid } from "nanoid";
import { type ReactNode, useEffect, useState } from "react";

interface KanbanCardDetailDialogProps {
	element: CanvasElement | null;
	elements: Map<string, CanvasElement>;
	assignmentOptions?: KanbanAssignmentOptions;
	onClose: () => void;
	onUpdate: (id: string, changes: Partial<CanvasElement>) => void;
	onUpdateElements: (
		updates: Array<{ id: string; changes: Partial<CanvasElement> }>,
	) => void;
	onDelete: (id: string) => void;
}
type KanbanDialogSection = "cover" | "assignment" | "checklist" | "attachments";

export function KanbanCardDetailDialog({
	element,
	elements,
	assignmentOptions,
	onClose,
	onUpdate,
	onUpdateElements,
	onDelete,
}: KanbanCardDetailDialogProps) {
	const { t } = useI18n();
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
	const [coverImage, setCoverImage] = useState<KanbanCardAttachment | null>(
		null,
	);
	const [checklist, setChecklist] = useState<KanbanChecklistItem[]>([]);
	const [attachments, setAttachments] = useState<KanbanCardAttachment[]>([]);
	const [draggedAttachmentId, setDraggedAttachmentId] = useState<string | null>(
		null,
	);
	const [dragOverAttachmentId, setDragOverAttachmentId] = useState<
		string | null
	>(null);
	const [newChecklistItem, setNewChecklistItem] = useState("");
	const [hideCompleted, setHideCompleted] = useState(false);
	const [expandedSections, setExpandedSections] = useState<
		Record<KanbanDialogSection, boolean>
	>({
		cover: false,
		assignment: false,
		checklist: false,
		attachments: false,
	});

	useEffect(() => {
		if (!element) return;
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
		setNewChecklistItem("");
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
	}, [element]);

	if (!element) return null;

	const handleSave = () => {
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
		const nextHeight = computeKanbanCardHeight({
			title: nextTitle,
			description: nextDescription,
			coverImage,
			checklist: nextChecklist,
			attachments,
			startDate: nextStartDate,
			dueDate: nextDueDate,
			assignmentBadges,
		});
		const baseChanges: Partial<CanvasElement> = {
			text: nextTitle,
			height: nextHeight,
			customData: {
				...(element.customData ?? {}),
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
				imageSrc: coverImage?.src ?? null,
				attachments,
				coverAttachmentId: null,
				checklist: nextChecklist,
			},
		};

		if (element.frameId) {
			const nextElements = new Map(elements);
			nextElements.set(element.id, { ...element, ...baseChanges });
			const reflowUpdates = buildKanbanReflowUpdates(
				nextElements,
				new Set([element.id]),
				new Map([[element.id, element.frameId]]),
			);
			onUpdateElements([
				{ id: element.id, changes: baseChanges },
				...reflowUpdates.filter((update) => update.id !== element.id),
			]);
		} else {
			onUpdate(element.id, baseChanges);
		}
		onClose();
	};

	const handleAddChecklistItems = () => {
		const items = newChecklistItem
			.split(/\r?\n/)
			.map((item) => item.trim())
			.filter(Boolean)
			.map(
				(text) =>
					({
						id: createChecklistItemId(),
						text,
						completed: false,
					}) satisfies KanbanChecklistItem,
			);

		if (items.length === 0) return;
		setChecklist((current) => [...current, ...items]);
		setNewChecklistItem("");
	};

	const completedChecklistItems = checklist.filter(
		(item) => item.completed,
	).length;
	const checklistProgress =
		checklist.length > 0
			? Math.round((completedChecklistItems / checklist.length) * 100)
			: 0;
	const visibleChecklist = hideCompleted
		? checklist.filter((item) => !item.completed)
		: checklist;
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

	const handlePickCover = async () => {
		const picked = await pickImageFile();
		if (!picked) return;
		setCoverImage({
			id: createAttachmentId(),
			src: picked.src,
			name: picked.name,
			width: picked.width,
			height: picked.height,
		});
	};

	const handlePickAttachment = async () => {
		const picked = await pickImageFiles();
		if (picked.length === 0) return;
		setAttachments((current) => [
			...current,
			...picked.map((image) => ({
				id: createAttachmentId(),
				src: image.src,
				name: image.name,
				width: image.width,
				height: image.height,
			})),
		]);
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
			<DialogContent className="max-h-[86vh] max-w-2xl gap-0 overflow-hidden p-0">
				<div className="m-3 max-h-[calc(86vh-1.5rem)] overflow-x-hidden overflow-y-auto rounded-md px-2 py-2 pr-4 [scrollbar-gutter:stable] sm:m-4 sm:max-h-[calc(86vh-2rem)] sm:pr-5">
					<DialogHeader className="space-y-1 pr-8">
						<DialogTitle className="text-base">
							{t("kanbanCardDialog.title")}
						</DialogTitle>
					</DialogHeader>

					<div className="space-y-3">
						<div className="space-y-1.5">
							<Label htmlFor="kanban-title">
								{t("kanbanCardDialog.cardTitle")}
							</Label>
							<Input
								id="kanban-title"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder={t("kanbanCardDialog.cardTitlePlaceholder")}
								autoFocus
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
									>
										<X className="h-4 w-4" />
									</Button>
								)}
							</div>
							{coverImage ? (
								<div className="overflow-hidden rounded-lg border border-border bg-muted/30">
									<img
										src={coverImage.src}
										alt={coverImage.name}
										className="h-28 w-full object-cover"
									/>
									<div className="flex items-center justify-between gap-2 border-t border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
										<div className="flex items-center gap-2">
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

							<div className="space-y-1.5">
								<textarea
									value={newChecklistItem}
									onChange={(e) => setNewChecklistItem(e.target.value)}
									placeholder={t("kanbanCardDialog.checkpointPlaceholder")}
									rows={2}
									className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
								/>
								<div className="flex justify-end">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleAddChecklistItems}
										disabled={!newChecklistItem.trim()}
									>
										<Plus className="h-4 w-4" />
										{t("kanbanCardDialog.addCheckpoint")}
									</Button>
								</div>
							</div>

							{visibleChecklist.length > 0 ? (
								<div className="space-y-1.5">
									{visibleChecklist.map((item) => (
										<div
											key={item.id}
											className="flex items-start gap-2 rounded-md border border-border bg-background px-2.5 py-1.5"
										>
											<input
												type="checkbox"
												checked={item.completed}
												onChange={(e) => {
													const completed = e.target.checked;
													setChecklist((current) =>
														current.map((entry) =>
															entry.id === item.id
																? { ...entry, completed }
																: entry,
														),
													);
												}}
												className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
											/>
											<Input
												value={item.text}
												onChange={(e) => {
													const text = e.target.value;
													setChecklist((current) =>
														current.map((entry) =>
															entry.id === item.id ? { ...entry, text } : entry,
														),
													);
												}}
												className={`h-9 ${item.completed ? "text-muted-foreground line-through" : ""}`}
											/>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() =>
													setChecklist((current) =>
														current.filter((entry) => entry.id !== item.id),
													)
												}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
							) : checklist.length > 0 ? (
								<p className="text-sm text-muted-foreground">
									{t("kanbanCardDialog.allCompletedHidden")}
								</p>
							) : (
								<p className="text-sm text-muted-foreground">
									{t("kanbanCardDialog.noCheckpoints")}
								</p>
							)}
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
							<div className="flex gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={handlePickAttachment}
									className="flex-1"
								>
									<ImagePlus className="h-4 w-4" />
									{t("kanbanCardDialog.addAttachments")}
								</Button>
								{attachments.length > 0 && (
									<Button
										type="button"
										variant="outline"
										onClick={() => setAttachments([])}
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
												<img
													src={attachment.src}
													alt={attachment.name}
													className="h-20 w-full object-cover"
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

					<DialogFooter className="flex-row justify-between gap-2 pt-3 sm:justify-between">
						<Button
							variant="ghost"
							onClick={handleDelete}
							className="text-destructive hover:text-destructive"
						>
							<Trash2 className="h-4 w-4 mr-1.5" />
							{t("common.delete")}
						</Button>
						<div className="flex gap-2">
							<Button variant="outline" onClick={onClose}>
								{t("common.cancel")}
							</Button>
							<Button onClick={handleSave}>{t("common.save")}</Button>
						</div>
					</DialogFooter>
				</div>
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

function createChecklistItemId(): string {
	return `check-${nanoid(10)}`;
}

function createAttachmentId(): string {
	return `att-${nanoid(10)}`;
}
