/**
 * Nachrichtenliste eines Kommentar-Threads.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
	type MentionCandidate,
	memberToMentionHandle,
} from "@/lib/mention-utils";
import { getUserInitials } from "@/lib/user-initials";
import { Loader2, Trash2 } from "lucide-react";
import { formatRelativeTime } from "./format-relative-time";
import type {
	WhiteboardCommentMessage,
	WhiteboardCommentThread,
} from "./whiteboard-comment-types";

interface CommentThreadViewProps {
	thread: WhiteboardCommentThread;
	mentionCandidates?: MentionCandidate[];
	currentUserId?: string;
	canModerate?: boolean;
	deletingMessageId?: string | null;
	onDeleteMessage?: (messageId: string) => void;
	compact?: boolean;
}

export function CommentThreadView({
	thread,
	mentionCandidates = [],
	currentUserId,
	canModerate = false,
	deletingMessageId,
	onDeleteMessage,
	compact = false,
}: CommentThreadViewProps) {
	const { locale } = useI18n();

	const mentionColorByHandle = new Map(
		mentionCandidates.map((candidate) => [
			memberToMentionHandle(candidate.name).toLowerCase(),
			candidate.roleColor ?? "#14b8a6",
		]),
	);

	return (
		<div
			className={
				compact ? "space-y-2" : "max-h-56 space-y-3 overflow-y-auto pr-1"
			}
		>
			{thread.messages.map((message) => (
				<CommentMessageRow
					key={message.id}
					message={message}
					locale={locale}
					mentionColorByHandle={mentionColorByHandle}
					canDelete={
						!!onDeleteMessage &&
						(message.author.id === currentUserId || canModerate)
					}
					isDeleting={deletingMessageId === message.id}
					onDelete={() => onDeleteMessage?.(message.id)}
					compact={compact}
				/>
			))}
		</div>
	);
}

function CommentMessageRow({
	message,
	locale,
	mentionColorByHandle,
	canDelete,
	isDeleting,
	onDelete,
	compact,
}: {
	message: WhiteboardCommentMessage;
	locale: string;
	mentionColorByHandle: Map<string, string>;
	canDelete: boolean;
	isDeleting: boolean;
	onDelete: () => void;
	compact: boolean;
}) {
	return (
		<div
			className={
				compact
					? "flex gap-2"
					: "flex gap-2.5 rounded-xl border border-white/8 bg-black/6 px-2.5 py-2"
			}
		>
			<Avatar
				className={
					compact
						? "h-6 w-6 border border-white/10"
						: "h-7 w-7 border border-white/10"
				}
			>
				<AvatarImage
					src={message.author.image ?? undefined}
					alt={message.author.name}
				/>
				<AvatarFallback className="bg-white/10 text-[9px] text-white">
					{getUserInitials(message.author.name)}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<span className="truncate text-xs font-medium text-white">
							{message.author.name}
						</span>
						<span className="ml-2 text-[10px] text-white/45">
							{formatRelativeTime(locale, message.createdAt)}
						</span>
					</div>
					{canDelete ? (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={onDelete}
							disabled={isDeleting}
							className="h-6 w-6 shrink-0 text-white/45 hover:bg-white/10 hover:text-white"
						>
							{isDeleting ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<Trash2 className="h-3 w-3" />
							)}
						</Button>
					) : null}
				</div>
				<p className="mt-0.5 whitespace-pre-wrap text-sm leading-snug text-white/88">
					<CommentBodyText
						body={message.body}
						mentionColorByHandle={mentionColorByHandle}
					/>
				</p>
			</div>
		</div>
	);
}

/** Hebt @Erwähnungen im Kommentartext mit Rollenfarbe hervor. */
function CommentBodyText({
	body,
	mentionColorByHandle,
}: {
	body: string;
	mentionColorByHandle: Map<string, string>;
}) {
	const parts = body.split(/(@[\p{L}\p{N}_]+)/gu);
	let offset = 0;
	const tokens = parts.map((part) => {
		const key = `${offset}-${part}`;
		offset += part.length;
		return { key, part };
	});
	return (
		<>
			{tokens.map(({ key, part }) => {
				if (!part.startsWith("@")) {
					return <span key={`${key}-text`}>{part}</span>;
				}
				const handle = part.slice(1).toLowerCase();
				const color = mentionColorByHandle.get(handle) ?? "#14b8a6";
				return (
					<span
						key={`${key}-mention`}
						className="font-semibold"
						style={{ color }}
					>
						{part}
					</span>
				);
			})}
		</>
	);
}

/** Avatare der Thread-Teilnehmer (max. 3) für Listen und Marker. */
export function CommentThreadParticipantAvatars({
	thread,
	max = 3,
	size = "sm",
}: {
	thread: WhiteboardCommentThread;
	max?: number;
	size?: "sm" | "md";
}) {
	const participants = new Map<string, WhiteboardCommentThread["createdBy"]>();
	for (const message of thread.messages) {
		participants.set(message.author.id, message.author);
	}
	participants.set(thread.createdBy.id, thread.createdBy);

	const list = [...participants.values()].slice(0, max);
	const dim = size === "sm" ? "h-5 w-5" : "h-6 w-6";

	return (
		<div className="flex -space-x-1.5">
			{list.map((user) => (
				<Avatar key={user.id} className={`${dim} border-2 border-[#1a1d24]`}>
					<AvatarImage src={user.image ?? undefined} alt={user.name} />
					<AvatarFallback className="bg-primary/80 text-[8px] text-white">
						{getUserInitials(user.name)}
					</AvatarFallback>
				</Avatar>
			))}
		</div>
	);
}
