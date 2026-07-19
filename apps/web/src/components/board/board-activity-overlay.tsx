/**
 * Activity feed for a board, either as the legacy overlay or embedded in the
 * unified canvas workspace panel.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { getUserInitials } from "@/lib/user-initials";
import { cn } from "@/lib/utils";
import { Loader2, X } from "lucide-react";
import { activityIcons, formatActivityMessage } from "./activity-feed-utils";

interface BoardActivityOverlayProps {
	whiteboardId: string;
	whiteboardName: string;
	open: boolean;
	onClose: () => void;
	embedded?: boolean;
	className?: string;
}

export function BoardActivityOverlay({
	whiteboardId,
	whiteboardName,
	open,
	onClose,
	embedded = false,
	className,
}: BoardActivityOverlayProps) {
	const { locale, t } = useI18n();
	const { data: activities, isLoading } =
		trpc.whiteboard.listBoardActivity.useQuery(
			{ whiteboardId, limit: 50 },
			{ enabled: (open || embedded) && !!whiteboardId },
		);

	const content = (
		<div
			className={cn(
				"flex flex-col overflow-hidden",
				embedded
					? "h-full w-full bg-transparent text-foreground"
					: "pointer-events-auto h-[calc(100vh-6rem)] w-[min(92vw,360px)] rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(8,10,12,0.06),rgba(8,10,12,0.18)_18%,rgba(8,10,12,0.32)_100%)] text-white shadow-[0_24px_80px_-28px_rgba(0,0,0,0.55)] backdrop-blur-md max-lg:h-[calc(100dvh-15.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-lg:w-[min(100%,360px)] max-lg:rounded-2xl",
				!embedded && !open && "pointer-events-none",
			)}
		>
			<div
				className={cn(
					"flex items-start justify-between gap-3 border-b px-4 py-4",
					embedded ? "border-border/70" : "border-white/10",
				)}
			>
				<div className="min-w-0">
					<p
						className={cn(
							"text-[11px] font-semibold uppercase tracking-[0.24em]",
							embedded ? "text-muted-foreground" : "text-white/55",
						)}
					>
						{t("whiteboardPage.activity.label")}
					</p>
					<h2
						className={cn(
							"mt-1 truncate text-sm font-semibold",
							embedded ? "text-foreground" : "text-white",
						)}
					>
						{whiteboardName}
					</h2>
					<p
						className={cn(
							"mt-1 text-xs",
							embedded ? "text-muted-foreground" : "text-white/55",
						)}
					>
						{t("whiteboardPage.activity.description")}
					</p>
				</div>
				{embedded ? null : (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="text-white/70 hover:bg-white/10 hover:text-white"
						aria-label={t("whiteboardPage.activity.close")}
					>
						<X className="h-4 w-4" />
					</Button>
				)}
			</div>

			<div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
				{isLoading ? (
					<div
						className={cn(
							"flex items-center gap-2 text-sm",
							embedded ? "text-muted-foreground" : "text-white/70",
						)}
					>
						<Loader2 className="h-4 w-4 animate-spin" />
						{t("common.loading")}
					</div>
				) : activities && activities.length > 0 ? (
					activities.map((item) => {
						const Icon = activityIcons[item.type];

						return (
							<div
								key={item.id}
								className={cn(
									"flex gap-3 rounded-2xl border px-3 py-2.5",
									embedded
										? "border-border/70 bg-muted/25"
										: "border-white/8 bg-black/8",
								)}
							>
								<div
									className={cn(
										"mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
										embedded
											? "bg-accent text-accent-foreground"
											: "bg-white/10 text-white",
									)}
								>
									<Icon className="h-4 w-4" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="mb-1 flex items-center gap-2">
										<Avatar
											className={cn(
												"h-5 w-5 border",
												embedded ? "border-border" : "border-white/10",
											)}
										>
											<AvatarImage
												src={item.user.image ?? undefined}
												alt={item.user.name}
											/>
											<AvatarFallback
												className={cn(
													"text-[9px]",
													embedded
														? "bg-muted text-muted-foreground"
														: "bg-white/10 text-white",
												)}
											>
												{getUserInitials(item.user.name)}
											</AvatarFallback>
										</Avatar>
										<span
											className={cn(
												"truncate text-xs font-medium",
												embedded ? "text-muted-foreground" : "text-white/80",
											)}
										>
											{item.user.name}
										</span>
									</div>
									<p
										className={cn(
											"text-sm leading-snug",
											embedded ? "text-foreground" : "text-white",
										)}
									>
										{formatActivityMessage(t, item, "board", whiteboardName)}
									</p>
									<p
										className={cn(
											"mt-1 text-[11px]",
											embedded ? "text-muted-foreground" : "text-white/45",
										)}
									>
										{new Date(item.createdAt).toLocaleString(locale)}
									</p>
								</div>
							</div>
						);
					})
				) : (
					<p
						className={cn(
							"py-8 text-center text-sm",
							embedded ? "text-muted-foreground" : "text-white/55",
						)}
					>
						{t("whiteboardPage.activity.empty")}
					</p>
				)}
			</div>
		</div>
	);

	if (embedded) return content;

	return (
		<div
			className={cn(
				"pointer-events-none absolute inset-y-0 right-0 z-50 flex items-start justify-end p-4 pt-20 transition-[transform,opacity] duration-300 ease-out max-lg:p-3 max-lg:pt-[calc(8rem+env(safe-area-inset-top))]",
				open ? "translate-x-0 opacity-100" : "translate-x-[108%] opacity-0",
				className,
			)}
			aria-hidden={!open}
		>
			{content}
		</div>
	);
}
