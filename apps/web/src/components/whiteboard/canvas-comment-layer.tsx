/**
 * Canvas-Kommentare: Marker an Welt-Positionen + Thread-Popover (Excalidraw-Stil).
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { MentionCandidate } from "@/lib/mention-utils";
import { getUserInitials } from "@/lib/user-initials";
import { cn } from "@/lib/utils";
import type { Viewport } from "@skedra/canvas-core";
import { Check, MessageSquarePlus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CommentThreadComposer } from "./comment-thread-composer";
import {
	CommentThreadParticipantAvatars,
	CommentThreadView,
} from "./comment-thread-view";
import type { WhiteboardCommentThread } from "./whiteboard-comment-types";

function canvasToScreen(viewport: Viewport, x: number, y: number) {
	return {
		left: viewport.x + x * viewport.zoom,
		top: viewport.y + y * viewport.zoom,
	};
}

export interface PendingCommentPlacement {
	x: number;
	y: number;
}

export interface CanvasCommentLayerProps {
	viewport: Viewport;
	threads: WhiteboardCommentThread[];
	showResolved: boolean;
	selectedThreadId: string | null;
	pendingPlacement: PendingCommentPlacement | null;
	placementActive: boolean;
	currentUser?: { id: string; name: string; image: string | null };
	mentionCandidates?: MentionCandidate[];
	canModerate?: boolean;
	canComment?: boolean;
	isSending?: boolean;
	deletingMessageId?: string | null;
	onSelectThread: (threadId: string | null) => void;
	onCanvasClick: (x: number, y: number) => void;
	onCreateThread: (body: string) => void;
	onReply: (threadId: string, body: string) => void;
	onResolve: (threadId: string, resolved: boolean) => void;
	onDeleteThread: (threadId: string) => void;
	onDeleteMessage: (messageId: string) => void;
	onCancelPlacement: () => void;
	svgRef: React.RefObject<SVGSVGElement | null>;
}

export function CanvasCommentLayer({
	viewport,
	threads,
	showResolved,
	selectedThreadId,
	pendingPlacement,
	placementActive,
	currentUser,
	mentionCandidates = [],
	canModerate = false,
	canComment = true,
	isSending = false,
	deletingMessageId,
	onSelectThread,
	onCanvasClick,
	onCreateThread,
	onReply,
	onResolve,
	onDeleteThread,
	onDeleteMessage,
	onCancelPlacement,
	svgRef,
}: CanvasCommentLayerProps) {
	const { t } = useI18n();

	const visibleThreads = useMemo(
		() => threads.filter((thread) => showResolved || !thread.resolvedAt),
		[showResolved, threads],
	);

	const selectedThread =
		threads.find((thread) => thread.id === selectedThreadId) ?? null;

	const handleOverlayPointerDown = (
		event: React.PointerEvent<HTMLDivElement>,
	) => {
		if (!placementActive && !pendingPlacement) return;
		if (event.button !== 0) return;

		const svg = svgRef.current;
		if (!svg) return;

		const rect = svg.getBoundingClientRect();
		const x = (event.clientX - rect.left - viewport.x) / viewport.zoom;
		const y = (event.clientY - rect.top - viewport.y) / viewport.zoom;

		event.preventDefault();
		event.stopPropagation();
		onCanvasClick(x, y);
	};

	return (
		<div
			className={cn(
				"absolute inset-0 z-40",
				placementActive || pendingPlacement
					? "cursor-crosshair"
					: "pointer-events-none",
			)}
			onPointerDown={
				placementActive || pendingPlacement
					? handleOverlayPointerDown
					: undefined
			}
		>
			{visibleThreads.map((thread) => {
				const screen = canvasToScreen(viewport, thread.x, thread.y);
				const isSelected = thread.id === selectedThreadId;
				const resolved = !!thread.resolvedAt;
				const leadAuthor =
					thread.messages[thread.messages.length - 1]?.author ??
					thread.createdBy;
				const leadRoleColor = mentionCandidates.find(
					(candidate) => candidate.id === leadAuthor.id,
				)?.roleColor;

				return (
					<button
						key={thread.id}
						type="button"
						className={cn(
							"pointer-events-auto absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-lg transition-transform hover:scale-105",
							isSelected
								? "border-primary ring-2 ring-primary/40"
								: "border-white",
							resolved && "opacity-55",
						)}
						style={{
							transform: `translate(${screen.left}px, ${screen.top}px) translate(-50%, -50%)`,
						}}
						onClick={(event) => {
							event.stopPropagation();
							onSelectThread(isSelected ? null : thread.id);
						}}
						aria-label={t("whiteboardPage.comments.openThread")}
					>
						<Avatar
							className="h-8 w-8"
							style={
								leadRoleColor
									? { boxShadow: `0 0 0 2px ${leadRoleColor}` }
									: undefined
							}
						>
							<AvatarImage
								src={leadAuthor.image ?? undefined}
								alt={leadAuthor.name}
							/>
							<AvatarFallback className="bg-primary text-[10px] text-white">
								{getUserInitials(leadAuthor.name)}
							</AvatarFallback>
						</Avatar>
						{thread.messages.length > 1 ? (
							<span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
								{thread.messages.length}
							</span>
						) : null}
					</button>
				);
			})}

			{pendingPlacement ? (
				<PendingCommentPopover
					viewport={viewport}
					pending={pendingPlacement}
					currentUser={currentUser}
					mentionCandidates={mentionCandidates}
					isSending={isSending}
					onSubmit={onCreateThread}
					onCancel={onCancelPlacement}
				/>
			) : null}

			{selectedThread && !pendingPlacement ? (
				<ThreadPopover
					thread={selectedThread}
					viewport={viewport}
					currentUser={currentUser}
					mentionCandidates={mentionCandidates}
					canModerate={canModerate}
					canComment={canComment}
					isSending={isSending}
					deletingMessageId={deletingMessageId}
					onClose={() => onSelectThread(null)}
					onReply={(body) => onReply(selectedThread.id, body)}
					onResolve={(resolved) => onResolve(selectedThread.id, resolved)}
					onDeleteThread={() => onDeleteThread(selectedThread.id)}
					onDeleteMessage={onDeleteMessage}
				/>
			) : null}

			{placementActive && !pendingPlacement ? (
				<div className="pointer-events-none absolute left-1/2 top-20 z-40 -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-sm text-white shadow-lg backdrop-blur-md">
					<MessageSquarePlus className="mr-2 inline h-4 w-4" />
					{t("whiteboardPage.comments.placementHint")}
				</div>
			) : null}
		</div>
	);
}

function PendingCommentPopover({
	viewport,
	pending,
	currentUser,
	mentionCandidates,
	isSending,
	onSubmit,
	onCancel,
}: {
	viewport: Viewport;
	pending: PendingCommentPlacement;
	currentUser?: { id: string; name: string; image: string | null };
	mentionCandidates: MentionCandidate[];
	isSending: boolean;
	onSubmit: (body: string) => void;
	onCancel: () => void;
}) {
	const { t } = useI18n();
	const screen = canvasToScreen(viewport, pending.x, pending.y);

	return (
		<div
			className="pointer-events-auto absolute z-40 w-[min(92vw,320px)]"
			style={{
				left: Math.min(Math.max(screen.left + 16, 12), window.innerWidth - 332),
				top: Math.min(Math.max(screen.top + 16, 72), window.innerHeight - 280),
			}}
			onPointerDown={(event) => event.stopPropagation()}
		>
			<div className="rounded-2xl border border-white/12 bg-[#1a1d24]/95 p-3 text-white shadow-2xl backdrop-blur-md">
				<div className="mb-2 flex items-center justify-between">
					<p className="text-xs font-medium text-white/70">
						{t("whiteboardPage.comments.newThread")}
					</p>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-7 w-7 text-white/60 hover:bg-white/10"
						onClick={onCancel}
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<CommentThreadComposer
					currentUser={currentUser}
					mentionCandidates={mentionCandidates}
					placeholder={t("whiteboardPage.comments.replyPlaceholder")}
					isSending={isSending}
					autoFocus
					onSubmit={onSubmit}
				/>
			</div>
		</div>
	);
}

function ThreadPopover({
	thread,
	viewport,
	currentUser,
	mentionCandidates,
	canModerate,
	canComment,
	isSending,
	deletingMessageId,
	onClose,
	onReply,
	onResolve,
	onDeleteThread,
	onDeleteMessage,
}: {
	thread: WhiteboardCommentThread;
	viewport: Viewport;
	currentUser?: { id: string; name: string; image: string | null };
	mentionCandidates: MentionCandidate[];
	canModerate: boolean;
	canComment: boolean;
	isSending: boolean;
	deletingMessageId?: string | null;
	onClose: () => void;
	onReply: (body: string) => void;
	onResolve: (resolved: boolean) => void;
	onDeleteThread: () => void;
	onDeleteMessage: (messageId: string) => void;
}) {
	const { t } = useI18n();
	const popoverRef = useRef<HTMLDivElement>(null);
	const screen = canvasToScreen(viewport, thread.x, thread.y);
	const resolved = !!thread.resolvedAt;

	const [position, setPosition] = useState({
		left: screen.left + 20,
		top: screen.top - 8,
	});

	useEffect(() => {
		const el = popoverRef.current;
		if (!el) {
			setPosition({ left: screen.left + 20, top: screen.top - 8 });
			return;
		}

		const width = el.offsetWidth || 320;
		const height = el.offsetHeight || 360;
		const margin = 12;

		setPosition({
			left: Math.min(
				Math.max(screen.left + 20, margin),
				window.innerWidth - width - margin,
			),
			top: Math.min(
				Math.max(screen.top - 8, 72),
				window.innerHeight - height - margin,
			),
		});
	}, [screen.left, screen.top]);

	return (
		<div
			ref={popoverRef}
			className="pointer-events-auto absolute z-40 w-[min(92vw,320px)]"
			style={{ left: position.left, top: position.top }}
			onPointerDown={(event) => event.stopPropagation()}
		>
			<div className="rounded-2xl border border-white/12 bg-[#1a1d24]/95 text-white shadow-2xl backdrop-blur-md">
				<div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
					<CommentThreadParticipantAvatars thread={thread} size="md" />
					<div className="flex items-center gap-0.5">
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white"
							title={
								resolved
									? t("whiteboardPage.comments.reopen")
									: t("whiteboardPage.comments.resolve")
							}
							onClick={() => onResolve(!resolved)}
						>
							<Check className="h-4 w-4" />
						</Button>
						{(canModerate || thread.createdBy.id === currentUser?.id) && (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-rose-300"
								onClick={onDeleteThread}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						)}
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-7 w-7 text-white/60 hover:bg-white/10"
							onClick={onClose}
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</div>

				<div className="px-3 py-3">
					<CommentThreadView
						thread={thread}
						mentionCandidates={mentionCandidates}
						currentUserId={currentUser?.id}
						canModerate={canModerate}
						deletingMessageId={deletingMessageId}
						onDeleteMessage={onDeleteMessage}
					/>
					{canComment ? (
						<div className="mt-3 border-t border-white/10 pt-3">
							<CommentThreadComposer
								currentUser={currentUser}
								mentionCandidates={mentionCandidates}
								placeholder={t("whiteboardPage.comments.replyPlaceholder")}
								isSending={isSending}
								onSubmit={onReply}
							/>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
