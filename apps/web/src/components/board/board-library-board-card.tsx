/**
 * Board-Karten in der Home-Bibliothek (Raster- und Listenansicht).
 */

import {
	BoardLibraryActionsMenu,
	type BoardLibraryTab,
} from "@/components/board/board-library-actions-menu";
import { LazyBoardCardPreview } from "@/components/board/lazy-board-card-preview";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
	Archive,
	Calendar,
	Clock,
	Eye,
	FileText,
	RotateCcw,
	User,
	Users,
} from "lucide-react";
import { Link } from "react-router";

export interface BoardLibraryBoard {
	id: string;
	name: string;
	ownerId: string;
	createdAt: Date | string;
	updatedAt: Date | string;
	archivedAt?: Date | string | null;
	presentationShareEnabled?: boolean | null;
	folderId?: string | null;
}

export interface BoardLibraryBoardActions {
	onRename: () => void;
	onArchive: () => void;
	onRestore: () => void;
	onPermanentDelete: () => void;
	folderOptions?: Array<{ id: string | null; name: string }>;
	onMoveToFolder?: (folderId: string | null) => void;
	isArchivePending?: boolean;
	isRestorePending?: boolean;
	isDeletePending?: boolean;
}

interface BoardOwnershipBadgesProps {
	isOwner: boolean;
	presentationShareEnabled?: boolean | null;
	variant: "overlay" | "inline";
}

function BoardOwnershipBadges({
	isOwner,
	presentationShareEnabled,
	variant,
}: BoardOwnershipBadgesProps) {
	const sharedClass =
		variant === "overlay"
			? "inline-flex items-center gap-1 rounded-full bg-indigo-500/95 text-[10px] font-bold text-white px-2 py-0.5 shadow-xs backdrop-blur-xs"
			: "inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 px-2 py-0.5";

	const ownerClass =
		variant === "overlay"
			? "inline-flex items-center gap-1 rounded-full bg-teal-500/95 text-[10px] font-bold text-white px-2 py-0.5 shadow-xs backdrop-blur-xs"
			: "inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-100 dark:bg-teal-950/20 dark:border-teal-900/30 text-[10px] font-semibold text-teal-600 dark:text-teal-400 px-2 py-0.5";

	const liveClass =
		variant === "overlay"
			? "inline-flex items-center gap-1 rounded-full bg-rose-500/95 text-[10px] font-bold text-white px-2 py-0.5 shadow-xs animate-pulse"
			: "inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 text-[10px] font-semibold text-rose-600 dark:text-rose-400 px-2 py-0.5";

	const liveLabel = variant === "overlay" ? "Live" : "Live-Freigabe";

	return (
		<>
			{!isOwner ? (
				<span className={sharedClass}>
					<Users className="h-3 w-3" />
					Geteilt
				</span>
			) : (
				<span className={ownerClass}>
					<User className="h-3 w-3" />
					{variant === "overlay" ? "Eigentümer" : "Besitzer"}
				</span>
			)}
			{presentationShareEnabled && (
				<span className={liveClass}>
					<Eye className="h-3 w-3" />
					{liveLabel}
				</span>
			)}
		</>
	);
}

interface BoardLibraryGridCardProps {
	tab: BoardLibraryTab;
	board: BoardLibraryBoard;
	isOwner: boolean;
	emptyPreviewLabel: string;
	actions: BoardLibraryBoardActions;
}

export function BoardLibraryGridCard({
	tab,
	board,
	isOwner,
	emptyPreviewLabel,
	actions,
}: BoardLibraryGridCardProps) {
	const { t } = useI18n();
	const isActiveTab = tab === "boards";

	return (
		<article className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
			<div className="relative">
				{isActiveTab ? (
					<Link to={`/board/${board.id}`} className="block">
						<LazyBoardCardPreview
							boardId={board.id}
							emptyLabel={emptyPreviewLabel}
						/>
					</Link>
				) : (
					<div className="block opacity-65 grayscale-30">
						<LazyBoardCardPreview
							boardId={board.id}
							emptyLabel={emptyPreviewLabel}
						/>
					</div>
				)}

				<div className="absolute left-3 top-3 flex gap-1.5">
					<BoardOwnershipBadges
						isOwner={isOwner}
						presentationShareEnabled={board.presentationShareEnabled}
						variant="overlay"
					/>
				</div>
			</div>

			<div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3 bg-card/60">
				<div className="min-w-0 flex-1">
					{isActiveTab ? (
						<Link to={`/board/${board.id}`} className="block min-w-0">
							<p className="truncate font-semibold text-sm hover:text-primary transition-colors text-foreground">
								{board.name}
							</p>
							<p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
								<Clock className="h-3 w-3 shrink-0" />
								<span>
									Aktualisiert {new Date(board.updatedAt).toLocaleDateString()}
								</span>
							</p>
						</Link>
					) : (
						<div className="min-w-0">
							<p className="truncate font-semibold text-sm text-foreground">
								{board.name}
							</p>
							<p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
								<Archive className="h-3 w-3 shrink-0" />
								<span>
									{t("project.canvasLibrary.archivedAt", {
										date: new Date(
											board.archivedAt
												? String(board.archivedAt)
												: String(board.updatedAt),
										).toLocaleDateString(),
									})}
								</span>
							</p>
						</div>
					)}
				</div>

				<div className="shrink-0">
					<BoardLibraryActionsMenu
						tab={tab}
						boardId={board.id}
						isOwner={isOwner}
						currentFolderId={board.folderId ?? null}
						{...actions}
						triggerClassName="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/80"
					/>
				</div>
			</div>
		</article>
	);
}

interface BoardLibraryListRowProps {
	tab: BoardLibraryTab;
	board: BoardLibraryBoard;
	isOwner: boolean;
	actions: BoardLibraryBoardActions;
}

export function BoardLibraryListRow({
	tab,
	board,
	isOwner,
	actions,
}: BoardLibraryListRowProps) {
	const isActiveTab = tab === "boards";

	return (
		<div className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
			<div className="flex items-center gap-3 min-w-0 flex-1">
				<div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background border border-border/80 text-muted-foreground shadow-2xs">
					<FileText className="h-5 w-5 text-primary/80" />
				</div>

				<div className="min-w-0 flex-1">
					{isActiveTab ? (
						<Link to={`/board/${board.id}`} className="block">
							<span className="font-semibold text-sm hover:text-primary transition-colors text-foreground block truncate">
								{board.name}
							</span>
						</Link>
					) : (
						<span className="font-semibold text-sm text-foreground block truncate">
							{board.name}
						</span>
					)}

					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground">
						<span className="flex items-center gap-1">
							<Calendar className="h-3 w-3" />
							Erstellt am {new Date(board.createdAt).toLocaleDateString()}
						</span>
						<span className="hidden sm:inline">•</span>
						<span className="flex items-center gap-1">
							<Clock className="h-3 w-3" />
							Aktualisiert {new Date(board.updatedAt).toLocaleDateString()}
						</span>
					</div>
				</div>
			</div>

			<div className="hidden md:flex items-center gap-2 px-4 shrink-0">
				<BoardOwnershipBadges
					isOwner={isOwner}
					presentationShareEnabled={board.presentationShareEnabled}
					variant="inline"
				/>
			</div>

			<div className="flex items-center gap-2 ml-4">
				{isActiveTab ? (
					<Button
						asChild
						variant="outline"
						size="sm"
						className="hidden sm:inline-flex h-8 rounded-lg text-xs font-semibold border-border/80"
					>
						<Link to={`/board/${board.id}`}>Öffnen</Link>
					</Button>
				) : (
					isOwner && (
						<Button
							variant="outline"
							size="sm"
							className="hidden sm:inline-flex h-8 rounded-lg text-xs font-semibold border-border/80 text-primary hover:bg-primary/5 hover:text-primary"
							onClick={actions.onRestore}
							disabled={actions.isRestorePending}
						>
							<RotateCcw className="mr-1 h-3.5 w-3.5" />
							Wiederherstellen
						</Button>
					)
				)}

				<BoardLibraryActionsMenu
					tab={tab}
					boardId={board.id}
					isOwner={isOwner}
					currentFolderId={board.folderId ?? null}
					{...actions}
				/>
			</div>
		</div>
	);
}
