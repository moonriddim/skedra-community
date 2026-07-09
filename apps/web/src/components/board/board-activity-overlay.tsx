/**
 * Activity-Feed pro Board — gleiches Slide-in-Panel wie der Whiteboard-Chat.
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
	className?: string;
}

export function BoardActivityOverlay({
	whiteboardId,
	whiteboardName,
	open,
	onClose,
	className,
}: BoardActivityOverlayProps) {
	const { locale, t } = useI18n();

	const { data: activities, isLoading } =
		trpc.whiteboard.listBoardActivity.useQuery(
			{ whiteboardId, limit: 50 },
			{ enabled: open && !!whiteboardId },
		);

	return (
		<div
			className={cn(
				"pointer-events-none absolute inset-y-0 right-0 z-50 flex items-start justify-end p-4 pt-20 transition-[transform,opacity] duration-300 ease-out",
				open ? "translate-x-0 opacity-100" : "translate-x-[108%] opacity-0",
				className,
			)}
			aria-hidden={!open}
		>
			<div
				className={cn(
					"pointer-events-auto flex h-[calc(100vh-6rem)] w-[min(92vw,360px)] flex-col overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(8,10,12,0.06),rgba(8,10,12,0.18)_18%,rgba(8,10,12,0.32)_100%)] text-white shadow-[0_24px_80px_-28px_rgba(0,0,0,0.55)] backdrop-blur-md",
					!open && "pointer-events-none",
				)}
			>
				<div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4">
					<div className="min-w-0">
						<p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
							{t("whiteboardPage.activity.label")}
						</p>
						<h2 className="mt-1 truncate text-sm font-semibold text-white">
							{whiteboardName}
						</h2>
						<p className="mt-1 text-xs text-white/55">
							{t("whiteboardPage.activity.description")}
						</p>
					</div>
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
				</div>

				<div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
					{isLoading ? (
						<div className="flex items-center gap-2 text-sm text-white/70">
							<Loader2 className="h-4 w-4 animate-spin" />
							{t("common.loading")}
						</div>
					) : activities && activities.length > 0 ? (
						activities.map((item) => {
							const Icon = activityIcons[item.type];

							return (
								<div
									key={item.id}
									className="flex gap-3 rounded-2xl border border-white/8 bg-black/8 px-3 py-2.5"
								>
									<div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
										<Icon className="h-4 w-4" />
									</div>
									<div className="min-w-0 flex-1">
										<div className="mb-1 flex items-center gap-2">
											<Avatar className="h-5 w-5 border border-white/10">
												<AvatarImage
													src={item.user.image ?? undefined}
													alt={item.user.name}
												/>
												<AvatarFallback className="bg-white/10 text-[9px] text-white">
													{getUserInitials(item.user.name)}
												</AvatarFallback>
											</Avatar>
											<span className="truncate text-xs font-medium text-white/80">
												{item.user.name}
											</span>
										</div>
										<p className="text-sm leading-snug text-white">
											{formatActivityMessage(t, item, "board", whiteboardName)}
										</p>
										<p className="mt-1 text-[11px] text-white/45">
											{new Date(item.createdAt).toLocaleString(locale)}
										</p>
									</div>
								</div>
							);
						})
					) : (
						<p className="py-8 text-center text-sm text-white/55">
							{t("whiteboardPage.activity.empty")}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
