/**
 * Gemeinsame Hilfsfunktionen fuer Library- und Board-Activity-Feeds.
 */

import type { useI18n } from "@/lib/i18n";
import type { WhiteboardActivityType } from "@skedra/shared";
import {
	Archive,
	FilePlus2,
	Link2,
	Pencil,
	RotateCcw,
	Trash2,
	UserPlus,
} from "lucide-react";

export type ActivityFeedScope = "library" | "board";

export type ActivityItem = {
	id: string;
	type: WhiteboardActivityType;
	createdAt: string | Date;
	metadata: { name?: string; previousName?: string; email?: string } | null;
	user: { id: string; name: string; image: string | null };
	whiteboard?: { id: string; name: string; archivedAt?: Date | string | null };
};

export const activityIcons: Record<WhiteboardActivityType, typeof FilePlus2> = {
	board_created: FilePlus2,
	board_renamed: Pencil,
	board_archived: Archive,
	board_restored: RotateCcw,
	board_deleted: Trash2,
	member_invited: UserPlus,
	presentation_shared: Link2,
};

export function formatActivityMessage(
	t: ReturnType<typeof useI18n>["t"],
	item: ActivityItem,
	scope: ActivityFeedScope,
	boardName?: string,
) {
	const resolvedBoardName = boardName ?? item.whiteboard?.name ?? "";
	const userName = item.user.name;
	const eventsKey =
		scope === "board"
			? "whiteboardPage.activity.events"
			: "project.activityFeed.events";

	switch (item.type) {
		case "board_created":
			return t(`${eventsKey}.boardCreated`, {
				user: userName,
				board: resolvedBoardName,
			});
		case "board_renamed":
			return t(`${eventsKey}.boardRenamed`, {
				user: userName,
				board: item.metadata?.name ?? resolvedBoardName,
				previous: item.metadata?.previousName ?? "",
			});
		case "board_archived":
			return t(`${eventsKey}.boardArchived`, {
				user: userName,
				board: resolvedBoardName,
			});
		case "board_restored":
			return t(`${eventsKey}.boardRestored`, {
				user: userName,
				board: resolvedBoardName,
			});
		case "board_deleted":
			return t(`${eventsKey}.boardDeleted`, {
				user: userName,
				board: resolvedBoardName,
			});
		case "member_invited":
			return t(`${eventsKey}.memberInvited`, {
				user: userName,
				board: resolvedBoardName,
				email: item.metadata?.email ?? "",
			});
		case "presentation_shared":
			return t(`${eventsKey}.presentationShared`, {
				user: userName,
				board: resolvedBoardName,
			});
		default:
			return resolvedBoardName;
	}
}
