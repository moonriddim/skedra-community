/**
 * Activity Feed — zeigt kuerzliche Board-Aktivitaeten in der Library.
 */

import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { Link } from "react-router";
import { activityIcons, formatActivityMessage } from "./activity-feed-utils";

export function ActivityFeed() {
	const { t } = useI18n();
	const { data: activities, isLoading } = trpc.whiteboard.listActivity.useQuery(
		{ limit: 25 },
	);

	return (
		<section className="rounded-2xl border border-border bg-card/80 p-5">
			<div className="mb-4">
				<p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
					{t("project.activityFeed.eyebrow")}
				</p>
				<h2 className="mt-1 text-lg font-semibold">
					{t("project.activityFeed.title")}
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					{t("project.activityFeed.description")}
				</p>
			</div>

			{isLoading ? (
				<div className="flex justify-center py-10">
					<Loader2 className="h-6 w-6 animate-spin text-primary" />
				</div>
			) : activities && activities.length > 0 ? (
				<ul className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
					{activities.map((item) => {
						const Icon = activityIcons[item.type];
						const isArchived = !!item.whiteboard.archivedAt;
						const canOpen =
							!isArchived &&
							item.type !== "board_deleted" &&
							item.whiteboard.id.length > 0;

						return (
							<li
								key={item.id}
								className="flex gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5"
							>
								<div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
									<Icon className="h-4 w-4" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm leading-snug text-foreground">
										{formatActivityMessage(t, item, "library")}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{new Date(item.createdAt).toLocaleString()}
									</p>
									{canOpen && (
										<Link
											to={`/board/${item.whiteboard.id}`}
											className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
										>
											{t("project.activityFeed.openBoard")}
										</Link>
									)}
								</div>
							</li>
						);
					})}
				</ul>
			) : (
				<p className="py-8 text-center text-sm text-muted-foreground">
					{t("project.activityFeed.empty")}
				</p>
			)}
		</section>
	);
}
