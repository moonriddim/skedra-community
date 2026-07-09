/**
 * Kontextmenue-Aktionen fuer Boards in der Home-Bibliothek (Raster + Liste).
 */

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Archive,
	Edit,
	Eye,
	FolderOpen,
	MoreVertical,
	RotateCcw,
	Trash2,
} from "lucide-react";
import { Link } from "react-router";

export type BoardLibraryTab = "boards" | "archive";

interface BoardLibraryActionsMenuProps {
	tab: BoardLibraryTab;
	boardId: string;
	isOwner: boolean;
	isArchivePending?: boolean;
	isRestorePending?: boolean;
	isDeletePending?: boolean;
	onRename: () => void;
	onArchive: () => void;
	onRestore: () => void;
	onPermanentDelete: () => void;
	folderOptions?: Array<{ id: string | null; name: string }>;
	currentFolderId?: string | null;
	onMoveToFolder?: (folderId: string | null) => void;
	triggerClassName?: string;
}

export function BoardLibraryActionsMenu({
	tab,
	boardId,
	isOwner,
	isArchivePending,
	isRestorePending,
	isDeletePending,
	onRename,
	onArchive,
	onRestore,
	onPermanentDelete,
	folderOptions,
	currentFolderId,
	onMoveToFolder,
	triggerClassName = "h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground",
}: BoardLibraryActionsMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className={triggerClassName}>
					<MoreVertical className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52 rounded-xl p-1">
				<DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5 font-normal">
					Aktionen für dieses Board
				</DropdownMenuLabel>
				{tab === "boards" ? (
					<>
						<DropdownMenuItem asChild className="rounded-lg gap-2 text-xs">
							<Link to={`/board/${boardId}`}>
								<Eye className="h-3.5 w-3.5 text-muted-foreground" />
								Board öffnen
							</Link>
						</DropdownMenuItem>
						{isOwner && (
							<DropdownMenuItem
								onClick={onRename}
								className="rounded-lg gap-2 text-xs"
							>
								<Edit className="h-3.5 w-3.5 text-muted-foreground" />
								Umbenennen
							</DropdownMenuItem>
						)}
						{isOwner && folderOptions && folderOptions.length > 0 ? (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5 font-normal">
									In Sammlung verschieben
								</DropdownMenuLabel>
								{folderOptions.map((folder) => (
									<DropdownMenuItem
										key={folder.id ?? "root"}
										onClick={() => onMoveToFolder?.(folder.id)}
										disabled={currentFolderId === folder.id}
										className="rounded-lg gap-2 text-xs"
									>
										<FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
										{folder.name}
									</DropdownMenuItem>
								))}
							</>
						) : null}
						<DropdownMenuSeparator />
						{isOwner ? (
							<DropdownMenuItem
								onClick={onArchive}
								disabled={isArchivePending}
								className="rounded-lg gap-2 text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
							>
								<Archive className="h-3.5 w-3.5" />
								Archivieren (Papierkorb)
							</DropdownMenuItem>
						) : (
							<DropdownMenuItem
								disabled
								className="rounded-lg gap-2 text-xs opacity-50"
							>
								Nur Eigentümer können archivieren
							</DropdownMenuItem>
						)}
					</>
				) : (
					<>
						{isOwner ? (
							<>
								<DropdownMenuItem
									onClick={onRestore}
									disabled={isRestorePending}
									className="rounded-lg gap-2 text-xs text-primary focus:bg-primary/10 focus:text-primary"
								>
									<RotateCcw className="h-3.5 w-3.5" />
									Wiederherstellen
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={onPermanentDelete}
									disabled={isDeletePending}
									className="rounded-lg gap-2 text-xs text-destructive focus:bg-destructive/10 focus:text-destructive font-semibold"
								>
									<Trash2 className="h-3.5 w-3.5" />
									Endgültig löschen
								</DropdownMenuItem>
							</>
						) : (
							<DropdownMenuItem
								disabled
								className="rounded-lg gap-2 text-xs opacity-50"
							>
								Keine Berechtigung
							</DropdownMenuItem>
						)}
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
