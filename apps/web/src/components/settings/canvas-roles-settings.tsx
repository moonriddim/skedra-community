/**
 * Rollen pro Canvas unter Einstellungen (Board-Auswahl + Rechte-Editor).
 */

import { BoardRolesSettings } from "@/components/whiteboard/board-roles-settings";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

export function CanvasRolesSettings() {
	const { t } = useI18n();
	const [searchParams] = useSearchParams();
	const boardIdFromUrl = searchParams.get("boardId");

	const { data: boards, isLoading } = trpc.whiteboard.list.useQuery();
	const ownedBoards = useMemo(
		() => (boards ?? []).filter((board) => board.libraryAccess === "owner"),
		[boards],
	);

	const [selectedBoardId, setSelectedBoardId] = useState("");

	useEffect(() => {
		if (!ownedBoards.length) return;
		if (boardIdFromUrl && ownedBoards.some((b) => b.id === boardIdFromUrl)) {
			setSelectedBoardId(boardIdFromUrl);
			return;
		}
		if (
			!selectedBoardId ||
			!ownedBoards.some((b) => b.id === selectedBoardId)
		) {
			setSelectedBoardId(ownedBoards[0].id);
		}
	}, [boardIdFromUrl, ownedBoards, selectedBoardId]);

	if (isLoading) {
		return (
			<div className="flex justify-center py-12">
				<Loader2 className="h-6 w-6 animate-spin text-primary" />
			</div>
		);
	}

	if (ownedBoards.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				{t("settings.canvasRoles.noOwnedBoards")}
			</p>
		);
	}

	return (
		<div className="space-y-6 animate-in fade-in-50 duration-200">
			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-foreground">
					{t("settings.canvasRoles.title")}
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					{t("settings.canvasRoles.intro")}
				</p>

				<div className="mt-4 space-y-1.5">
					<label
						htmlFor="canvas-role-board"
						className="text-xs font-medium text-muted-foreground"
					>
						{t("settings.canvasRoles.boardLabel")}
					</label>
					<select
						id="canvas-role-board"
						className="flex h-10 w-full max-w-md rounded-md border border-border bg-background px-3 text-sm"
						value={selectedBoardId}
						onChange={(event) => setSelectedBoardId(event.target.value)}
					>
						{ownedBoards.map((board) => (
							<option key={board.id} value={board.id}>
								{board.name}
							</option>
						))}
					</select>
				</div>
			</div>

			{selectedBoardId ? (
				<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
					<BoardRolesSettings boardId={selectedBoardId} showHeader={false} />
				</div>
			) : null}
		</div>
	);
}
