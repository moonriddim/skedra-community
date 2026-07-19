/**
 * Kommentar-Sidebar am Board (Excalidraw-Stil): Suche, Filter, Thread-Liste.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
	CheckCheck,
	Loader2,
	MessageSquarePlus,
	Search,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CommentThreadParticipantAvatars } from "./comment-thread-view";
import { formatRelativeTime } from "./format-relative-time";
import type { WhiteboardCommentThread } from "./whiteboard-comment-types";

interface WhiteboardCommentsPanelProps {
	whiteboardName: string;
	open: boolean;
	embedded?: boolean;
	threads: WhiteboardCommentThread[];
	selectedThreadId: string | null;
	showResolved: boolean;
	placementActive: boolean;
	isLoading: boolean;
	onClose: () => void;
	onSelectThread: (threadId: string) => void;
	onToggleShowResolved: () => void;
	onStartPlacement: () => void;
	onMarkAllResolved?: () => void;
	className?: string;
}

export function WhiteboardCommentsPanel({
	whiteboardName,
	open,
	embedded = false,
	threads,
	selectedThreadId,
	showResolved,
	placementActive,
	isLoading,
	onClose,
	onSelectThread,
	onToggleShowResolved,
	onStartPlacement,
	className,
}: WhiteboardCommentsPanelProps) {
	const { locale, t } = useI18n();
	const [search, setSearch] = useState("");

	const filteredThreads = useMemo(() => {
		const query = search.trim().toLowerCase();
		return threads
			.filter((thread) => showResolved || !thread.resolvedAt)
			.filter((thread) => {
				if (!query) return true;
				return thread.messages.some(
					(message) =>
						message.body.toLowerCase().includes(query) ||
						message.author.name.toLowerCase().includes(query),
				);
			});
	}, [search, showResolved, threads]);

	const openCount = threads.filter((thread) => !thread.resolvedAt).length;

	return (
		<div
			className={cn(
				embedded
					? "h-full min-h-0 w-full"
					: "pointer-events-none absolute inset-y-0 right-0 z-50 flex items-start justify-end p-4 pt-20 transition-[transform,opacity] duration-300 ease-out max-lg:p-3 max-lg:pt-[calc(8rem+env(safe-area-inset-top))]",
				!embedded &&
					(open ? "translate-x-0 opacity-100" : "translate-x-[108%] opacity-0"),
				className,
			)}
			aria-hidden={!open}
		>
			<div
				className={cn(
					"pointer-events-auto flex flex-col overflow-hidden bg-card text-card-foreground",
					embedded
						? "h-full min-h-0 w-full"
						: "h-[calc(100vh-6rem)] w-[min(92vw,360px)] rounded-[28px] border border-border/80 bg-card/96 shadow-[0_24px_80px_-28px_rgba(0,0,0,0.55)] backdrop-blur-md max-lg:h-[calc(100dvh-15.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-lg:w-[min(100%,360px)] max-lg:rounded-2xl",
					!open && "pointer-events-none",
				)}
			>
				<div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-4">
					<div className="min-w-0">
						<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							{t("whiteboardPage.comments.label")}
						</p>
						<h2 className="mt-1 truncate text-sm font-semibold text-foreground">
							{whiteboardName}
						</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							{t("whiteboardPage.comments.description", { count: openCount })}
						</p>
					</div>
					{!embedded && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={onClose}
							className="text-muted-foreground hover:bg-accent hover:text-accent-foreground"
							aria-label={t("whiteboardPage.comments.close")}
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>

				<div className="space-y-3 border-b border-border/70 px-4 py-3">
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={t("whiteboardPage.comments.search")}
							className="h-9 border-border bg-muted/30 pl-9 text-sm text-foreground placeholder:text-muted-foreground"
						/>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							size="sm"
							variant="outline"
							className={cn(
								"h-8 border-border bg-background text-xs text-foreground hover:bg-accent",
								placementActive && "border-primary/50 bg-primary/15",
							)}
							onClick={onStartPlacement}
						>
							<MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />
							{t("whiteboardPage.comments.add")}
						</Button>
						<label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
							<input
								type="checkbox"
								checked={showResolved}
								onChange={onToggleShowResolved}
								className="rounded border-border"
							/>
							{t("whiteboardPage.comments.showResolved")}
						</label>
					</div>
				</div>

				<div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
					{isLoading ? (
						<div className="flex items-center gap-2 px-1 py-4 text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" />
							{t("common.loading")}
						</div>
					) : filteredThreads.length > 0 ? (
						filteredThreads.map((thread) => {
							const lastMessage = thread.messages[thread.messages.length - 1];
							if (!lastMessage) return null;

							return (
								<button
									key={thread.id}
									type="button"
									onClick={() => onSelectThread(thread.id)}
									className={cn(
										"w-full rounded-2xl border px-3 py-2.5 text-left transition-colors",
										thread.id === selectedThreadId
											? "border-primary/40 bg-primary/10"
											: "border-border/70 bg-muted/20 hover:bg-muted/45",
										thread.resolvedAt && "opacity-60",
									)}
								>
									<div className="flex items-start gap-2">
										<CommentThreadParticipantAvatars thread={thread} />
										<div className="min-w-0 flex-1">
											<div className="flex items-center justify-between gap-2">
												<span className="truncate text-xs font-medium text-foreground">
													{lastMessage.author.name}
												</span>
												<span className="shrink-0 text-[10px] text-muted-foreground">
													{formatRelativeTime(locale, lastMessage.createdAt)}
												</span>
											</div>
											<p className="mt-0.5 line-clamp-2 text-sm text-foreground/80">
												{lastMessage.body}
											</p>
											{thread.messages.length > 1 ? (
												<p className="mt-1 text-[10px] text-muted-foreground">
													{t("whiteboardPage.comments.replyCount", {
														count: thread.messages.length - 1,
													})}
												</p>
											) : null}
											{thread.resolvedAt ? (
												<p className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400/90">
													<CheckCheck className="h-3 w-3" />
													{t("whiteboardPage.comments.resolved")}
												</p>
											) : null}
										</div>
									</div>
								</button>
							);
						})
					) : (
						<p className="px-2 py-8 text-center text-sm text-muted-foreground">
							{t("whiteboardPage.comments.empty")}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
