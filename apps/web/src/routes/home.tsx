/**
 * HomePage — Die "Mediathek" / Canvas-Bibliothek des Benutzers.
 * Hier werden alle aktiven und archivierten Boards verwaltet, gesucht, gefiltert und sortiert.
 * Außerdem können neue Boards direkt über Schnellstart-Vorlagen angelegt werden.
 */

import { ActivityFeed } from "@/components/board";
import { BoardAppearanceMenu } from "@/components/board/board-appearance-menu";
import {
	BoardLibraryGridCard,
	BoardLibraryListRow,
} from "@/components/board/board-library-board-card";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
	type UnlockedUserE2eeIdentity,
	base64ToBytes,
	createE2eeKeyHash,
	encryptBoardKeyForRecipient,
	encryptYjsUpdate,
	generateE2eeKey,
	readUnlockedUserE2eeIdentity,
	storeE2eeKey,
	unlockOrCreateUserE2eeIdentity,
	withE2eeKeyFragmentPath,
} from "@/lib/e2ee";
import { useI18n } from "@/lib/i18n";
import { TEMPLATES, createBase64StateFromElements } from "@/lib/templates";
import { trpc } from "@/lib/trpc";
import { useThemeStore } from "@/stores/theme";
import {
	Archive,
	ArrowUpDown,
	Calendar,
	Check,
	ChevronDown,
	Clock,
	Cloud,
	FileDown,
	FileUp,
	FolderPlus,
	Grid,
	Info,
	LayoutGrid,
	List,
	Loader2,
	LockKeyhole,
	LogOut,
	PenLine,
	Plus,
	Search,
	Settings,
	SlidersHorizontal,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

// Bestimmung der Tab-Optionen
type LibraryTab = "boards" | "archive";
// Filteroptionen für die aktiven Boards
type VisibilityFilter = "all" | "mine" | "shared";
// Sortieroptionen
type SortOption = "updatedAt" | "createdAt" | "name";
// Darstellungsmodi
type ViewMode = "grid" | "list";
type FolderFilter = "all" | "unfiled" | string;
type PendingCreateAction =
	| { type: "blank" }
	| { type: "template"; templateId: string; templateTitleKey: string };
type BoardEncryptionMode = "server" | "e2ee";

export function HomePage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { data: session } = authClient.useSession();
	const utils = trpc.useUtils();
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);

	// --- ZUSTAND DER BENUTZEROBERFLÄCHE ---
	const [tab, setTab] = useState<LibraryTab>("boards");
	const [searchQuery, setSearchQuery] = useState("");
	const [filter, setFilter] = useState<VisibilityFilter>("all");
	const [sortBy, setSortBy] = useState<SortOption>("updatedAt");
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");

	// --- DIALOG-ZUSTÄNDE ---
	const [renameBoardId, setRenameBoardId] = useState<string | null>(null);
	const [renameBoardName, setRenameBoardName] = useState("");
	const [deleteBoardId, setDeleteBoardId] = useState<string | null>(null);
	const [deleteBoardName, setDeleteBoardName] = useState("");

	// --- NEUER CANVAS-ZUSTAND (SCHNELLSTART) ---
	const [newName, setNewName] = useState("");
	const [newFolderName, setNewFolderName] = useState("");
	const [pendingCreateAction, setPendingCreateAction] =
		useState<PendingCreateAction | null>(null);
	const [encryptionChoiceOpen, setEncryptionChoiceOpen] = useState(false);
	const [selectedEncryptionMode, setSelectedEncryptionMode] =
		useState<BoardEncryptionMode | null>(null);
	const [createEncryptionError, setCreateEncryptionError] = useState("");
	const [e2eeUnlockOpen, setE2eeUnlockOpen] = useState(false);
	const [e2eeUnlockPassword, setE2eeUnlockPassword] = useState("");
	const [e2eeUnlockError, setE2eeUnlockError] = useState("");
	const [e2eeUnlockLoading, setE2eeUnlockLoading] = useState(false);

	// --- TRPC QUERIES ---
	// Aktive Boards abrufen
	const { data: boards, isLoading } = trpc.whiteboard.list.useQuery(undefined, {
		enabled: tab === "boards",
	});
	// Archivierte Boards abrufen
	const { data: archivedBoards, isLoading: archiveLoading } =
		trpc.whiteboard.listArchived.useQuery(undefined, {
			enabled: tab === "archive",
		});
	const { data: folders = [] } = trpc.whiteboard.listFolders.useQuery();
	const identityQuery = trpc.userE2ee.getIdentity.useQuery(undefined, {
		enabled: false,
		retry: false,
	});
	// --- TRPC MUTATIONS ---
	// Normales neues Board anlegen (blanko)
	const createBoard = trpc.whiteboard.create.useMutation({
		onSuccess: () => {
			void utils.whiteboard.list.invalidate();
			void utils.whiteboard.listActivity.invalidate();
		},
	});

	// Neues Board basierend auf einem Y.Doc-Zustand (Vorlagen) anlegen
	const createBoardWithState = trpc.whiteboard.createWithState.useMutation({
		onSuccess: () => {
			void utils.whiteboard.list.invalidate();
			void utils.whiteboard.listActivity.invalidate();
		},
	});

	// Board umbenennen
	const updateBoard = trpc.whiteboard.update.useMutation({
		onSuccess: () => {
			void utils.whiteboard.list.invalidate();
			void utils.whiteboard.listArchived.invalidate();
			void utils.whiteboard.listActivity.invalidate();
			setRenameBoardId(null);
		},
	});

	const createFolder = trpc.whiteboard.createFolder.useMutation({
		onSuccess: () => {
			setNewFolderName("");
			void utils.whiteboard.listFolders.invalidate();
		},
	});
	const saveIdentity = trpc.userE2ee.saveIdentity.useMutation();

	// Board ins Archiv verschieben (Papierkorb)
	const archiveBoard = trpc.whiteboard.archive.useMutation({
		onSuccess: () => {
			void utils.whiteboard.list.invalidate();
			void utils.whiteboard.listArchived.invalidate();
			void utils.whiteboard.listActivity.invalidate();
		},
	});

	// Board aus dem Archiv wiederherstellen
	const restoreBoard = trpc.whiteboard.restore.useMutation({
		onSuccess: () => {
			void utils.whiteboard.list.invalidate();
			void utils.whiteboard.listArchived.invalidate();
			void utils.whiteboard.listActivity.invalidate();
		},
	});

	// Board endgültig und unwiderruflich löschen
	const permanentDeleteBoard = trpc.whiteboard.permanentDelete.useMutation({
		onSuccess: () => {
			void utils.whiteboard.listArchived.invalidate();
			void utils.whiteboard.listActivity.invalidate();
			setDeleteBoardId(null);
		},
	});

	// --- LOGIK-FUNKTIONEN ---
	// Einfaches neues Canvas erstellen
	const openEncryptedBoard = (boardId: string, key: string) => {
		storeE2eeKey(boardId, key);
		navigate(withE2eeKeyFragmentPath(`/board/${boardId}`, key));
	};

	const createOwnEncryptedBoardKey = async ({
		boardId,
		key,
		keyHash,
		identity,
	}: {
		boardId: string;
		key: string;
		keyHash: string;
		identity: UnlockedUserE2eeIdentity;
	}) => {
		if (!session?.user?.id) {
			throw new Error("User session missing for E2EE identity");
		}
		return encryptBoardKeyForRecipient({
			boardKey: key,
			recipientPublicKey: identity.publicKey,
			boardId,
			recipientUserId: session.user.id,
			keyHash,
		});
	};

	const createBlankBoard = async (
		mode: BoardEncryptionMode,
		identity?: UnlockedUserE2eeIdentity,
	) => {
		const boardId = crypto.randomUUID();
		const name = newName.trim() || t("project.newCanvas");
		const folderId =
			folderFilter !== "all" && folderFilter !== "unfiled"
				? folderFilter
				: undefined;
		if (mode === "server") {
			const board = await createBoard.mutateAsync({
				id: boardId,
				name,
				encryptionMode: "server",
				folderId,
			});
			navigate(`/board/${board.id}`);
			setNewName("");
			return;
		}
		if (!identity) throw new Error("E2EE identity missing");
		const key = generateE2eeKey();
		const e2eeKeyHash = await createE2eeKeyHash(key);
		const ownEncryptedBoardKey = await createOwnEncryptedBoardKey({
			boardId,
			key,
			keyHash: e2eeKeyHash,
			identity,
		});
		const board = await createBoard.mutateAsync({
			id: boardId,
			name,
			encryptionMode: "e2ee",
			e2eeKeyHash,
			ownEncryptedBoardKey,
			folderId,
		});
		openEncryptedBoard(board.id, key);
		setNewName("");
	};

	// Ein Board über eine Schnellstart-Vorlage erstellen
	const createBoardFromTemplate = async (
		action: Extract<PendingCreateAction, { type: "template" }>,
		mode: BoardEncryptionMode,
		identity?: UnlockedUserE2eeIdentity,
	) => {
		const template = TEMPLATES.find((t) => t.id === action.templateId);
		if (!template) return;

		// 0,0 ist das Zentrum für die Vorlagen-Initalisierung
		const elements = template.create(0, 0, { resolvedTheme });
		const stateBase64 = createBase64StateFromElements(elements);
		const templateName = t(action.templateTitleKey) || template.name;
		const boardId = crypto.randomUUID();
		const folderId =
			folderFilter !== "all" && folderFilter !== "unfiled"
				? folderFilter
				: undefined;
		if (mode === "server") {
			const board = await createBoardWithState.mutateAsync({
				id: boardId,
				name: templateName,
				encryptionMode: "server",
				stateBase64,
				folderId,
			});
			navigate(`/board/${board.id}`);
			return;
		}
		if (!identity) throw new Error("E2EE identity missing");
		const key = generateE2eeKey();
		const e2eeKeyHash = await createE2eeKeyHash(key);
		const e2eeInitialUpdate = await encryptYjsUpdate(
			base64ToBytes(stateBase64),
			key,
		);
		const ownEncryptedBoardKey = await createOwnEncryptedBoardKey({
			boardId,
			key,
			keyHash: e2eeKeyHash,
			identity,
		});

		const board = await createBoardWithState.mutateAsync({
			id: boardId,
			name: templateName,
			encryptionMode: "e2ee",
			e2eeInitialUpdate,
			e2eeKeyHint: `created-${new Date().toISOString().slice(0, 10)}`,
			e2eeKeyHash,
			ownEncryptedBoardKey,
			folderId,
		});
		openEncryptedBoard(board.id, key);
	};

	const runCreateAction = async (
		action: PendingCreateAction,
		mode: BoardEncryptionMode,
		identity?: UnlockedUserE2eeIdentity,
	) => {
		if (action.type === "template") {
			await createBoardFromTemplate(action, mode, identity);
			return;
		}
		await createBlankBoard(mode, identity);
	};

	const startCreateAction = (action: PendingCreateAction) => {
		setPendingCreateAction(action);
		setSelectedEncryptionMode(null);
		setCreateEncryptionError("");
		setEncryptionChoiceOpen(true);
	};

	const handleConfirmEncryptionMode = async () => {
		if (!pendingCreateAction || !selectedEncryptionMode) return;
		const action = pendingCreateAction;
		setCreateEncryptionError("");
		try {
			if (selectedEncryptionMode === "server") {
				await runCreateAction(action, "server");
				setEncryptionChoiceOpen(false);
				setPendingCreateAction(null);
				return;
			}

			const identity = readUnlockedUserE2eeIdentity(session?.user?.email);
			if (identity) {
				await runCreateAction(action, "e2ee", identity);
				setEncryptionChoiceOpen(false);
				setPendingCreateAction(null);
				return;
			}

			setEncryptionChoiceOpen(false);
			setE2eeUnlockPassword("");
			setE2eeUnlockError("");
			setE2eeUnlockOpen(true);
		} catch (error) {
			setCreateEncryptionError(
				error instanceof Error
					? error.message
					: t("apiErrors.common.badRequest"),
			);
		}
	};

	const handleUnlockIdentityAndCreate = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!session?.user?.email || !pendingCreateAction) return;
		setE2eeUnlockLoading(true);
		setE2eeUnlockError("");
		try {
			const identityResult = await identityQuery.refetch();
			const identity = await unlockOrCreateUserE2eeIdentity({
				email: session.user.email,
				password: e2eeUnlockPassword,
				existingIdentity: identityResult.data ?? null,
				saveIdentity: saveIdentity.mutateAsync,
			});
			const action = pendingCreateAction;
			setPendingCreateAction(null);
			setE2eeUnlockOpen(false);
			setE2eeUnlockPassword("");
			await runCreateAction(action, "e2ee", identity);
		} catch (error) {
			console.error("E2EE identity unlock failed", error);
			setE2eeUnlockError(
				"Die E2EE-Identity konnte nicht entsperrt werden. Pruefe dein Konto-Passwort oder deinen E2EE-Sicherheitscode.",
			);
		} finally {
			setE2eeUnlockLoading(false);
		}
	};

	const handleCreate = () => {
		startCreateAction({ type: "blank" });
	};

	const handleCreateFromTemplate = (
		templateId: string,
		templateTitleKey: string,
	) => {
		startCreateAction({ type: "template", templateId, templateTitleKey });
	};

	const handleCreateFolder = () => {
		const name = newFolderName.trim();
		if (!name) return;
		createFolder.mutate({ name });
	};

	// Umbenennen-Dialog öffnen
	const openRenameDialog = (id: string, currentName: string) => {
		setRenameBoardId(id);
		setRenameBoardName(currentName);
	};

	// Umbenennen abspeichern
	const handleRenameSubmit = () => {
		if (!renameBoardId || !renameBoardName.trim()) return;
		updateBoard.mutate({
			id: renameBoardId,
			name: renameBoardName.trim(),
		});
	};

	// Löschbestätigungs-Dialog öffnen
	const openDeleteConfirmation = (id: string, name: string) => {
		setDeleteBoardId(id);
		setDeleteBoardName(name);
	};

	// Endgültiges Löschen ausführen
	const handleDeleteSubmit = () => {
		if (!deleteBoardId) return;
		permanentDeleteBoard.mutate({ id: deleteBoardId });
	};

	// --- FILTERUNG & SORTIERUNG (CLIENT-SIDE) ---
	const rawBoards = tab === "boards" ? boards : archivedBoards;
	const isDataLoading = tab === "boards" ? isLoading : archiveLoading;

	const processedBoards = useMemo(() => {
		if (!rawBoards) return [];

		// 1. Suche nach Name filtern
		let items = rawBoards.filter((board) =>
			board.name.toLowerCase().includes(searchQuery.toLowerCase()),
		);

		// 2. Visibilitäts-Filter (nur bei aktiven Boards relevant)
		if (tab === "boards" && filter !== "all") {
			if (filter === "mine") {
				items = items.filter((b) => b.ownerId === session?.user?.id);
			} else if (filter === "shared") {
				items = items.filter((b) => b.ownerId !== session?.user?.id);
			}
		}

		if (tab === "boards" && folderFilter !== "all") {
			items = items.filter((board) =>
				folderFilter === "unfiled"
					? "folderId" in board && !board.folderId
					: "folderId" in board && board.folderId === folderFilter,
			);
		}

		// 3. Sortierung anwenden
		items = [...items].sort((a, b) => {
			if (sortBy === "name") {
				return a.name.localeCompare(b.name);
			}
			if (sortBy === "createdAt") {
				return (
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);
			}
			// Default: updatedAt desc
			return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
		});

		return items;
	}, [
		rawBoards,
		searchQuery,
		filter,
		sortBy,
		tab,
		folderFilter,
		session?.user?.id,
	]);

	const folderOptions = useMemo(
		() => [
			{ id: null, name: "Ohne Sammlung" },
			...folders.map((folder) => ({ id: folder.id, name: folder.name })),
		],
		[folders],
	);

	return (
		<div className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 md:py-10">
			{/* HEADER-BEREICH */}
			<header className="mb-10 flex flex-col justify-between gap-6 rounded-3xl border border-border/80 bg-gradient-to-r from-card/90 via-card/50 to-card/90 p-6 shadow-sm sm:flex-row sm:items-center">
				<div className="space-y-4">
					<BrandLogo markClassName="h-12 w-12" wordmarkClassName="text-2xl" />
					<div className="space-y-1">
						<span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wider text-primary uppercase">
							Workspace
						</span>
						<h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
							{t("project.canvasLibrary.title")}
						</h1>
						<p className="text-sm text-muted-foreground">
							{t("project.canvasLibrary.description")}
						</p>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<BoardAppearanceMenu />
					<Button
						asChild
						variant="outline"
						size="sm"
						className="h-10 rounded-xl border-border/60 hover:bg-accent/60"
					>
						<Link to="/settings">
							<Settings className="mr-2 h-4.5 w-4.5 text-muted-foreground" />
							{t("settingsCenter.title") ?? "Einstellungen"}
						</Link>
					</Button>
					<div className="h-6 w-px bg-border/80 hidden sm:block" />
					<div className="flex items-center gap-3">
						<div className="hidden flex-col text-right md:flex">
							<span className="text-xs text-muted-foreground">
								Eingeloggt als
							</span>
							<span className="text-sm font-semibold">
								{session?.user?.name}
							</span>
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="h-10 rounded-xl hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
							onClick={() => authClient.signOut()}
						>
							<LogOut className="mr-2 h-4.5 w-4.5" />
							{t("common.logout")}
						</Button>
					</div>
				</div>
			</header>

			{/* HAUPTGRID: LINKS MAIN CONTENT, RECHTS AKTIVITÄTS-FEED */}
			<div className="grid gap-8 xl:grid-cols-[1fr_340px]">
				<main className="space-y-8 min-w-0">
					{/* Sektion 1: SCHNELLSTART / VORLAGEN (Nur im aktiven Boards-Tab sichtbar) */}
					{tab === "boards" && (
						<section className="space-y-4">
							<div className="flex items-center justify-between">
								<h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
									<Sparkles className="h-4.5 w-4.5 text-primary" />
									Schnellstart mit Vorlagen
								</h2>
								<span className="text-xs text-muted-foreground">
									Wähle ein Modell oder starte leer
								</span>
							</div>

							<div className="grid gap-4 grid-cols-2 md:grid-cols-5">
								{/* Vorlagen-Karten dynamisch aus dem TEMPLATES array */}
								{TEMPLATES.map((tmpl) => {
									// Übersetzungs-Keys für Vorlagen
									const titleKey = `templates.${tmpl.id}.name`;
									const descKey = `templates.${tmpl.id}.description`;
									return (
										<button
											key={tmpl.id}
											type="button"
											onClick={() =>
												handleCreateFromTemplate(tmpl.id, titleKey)
											}
											disabled={
												createBoard.isPending || createBoardWithState.isPending
											}
											className="group flex flex-col items-start text-left rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm"
										>
											<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-background border border-border text-lg shadow-sm transition-transform group-hover:scale-105">
												{tmpl.icon}
											</div>
											<h3 className="font-semibold text-sm text-foreground truncate w-full">
												{t(titleKey) || tmpl.name}
											</h3>
											<p className="mt-1 text-xs text-muted-foreground leading-snug line-clamp-2">
												{t(descKey) || tmpl.description}
											</p>
										</button>
									);
								})}

								{/* Karte 5: Leeres Board */}
								<button
									type="button"
									onClick={handleCreate}
									disabled={
										createBoard.isPending || createBoardWithState.isPending
									}
									className="group flex flex-col items-start text-left rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 transition-all hover:border-primary hover:bg-primary/10 hover:shadow-sm"
								>
									<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition-transform group-hover:scale-105">
										<Plus className="h-5 w-5" />
									</div>
									<h3 className="font-semibold text-sm text-foreground">
										Leeres Canvas
									</h3>
									<p className="mt-1 text-xs text-muted-foreground leading-snug">
										Mit einer leeren, unendlichen Zeichenfläche starten.
									</p>
								</button>
							</div>

							{/* Manuelle Eingabe für neues Canvas */}
							<div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/80 bg-card/40 p-4 backdrop-blur-sm">
								<div className="min-w-[200px] flex-1">
									<label
										htmlFor="new-board-name"
										className="mb-1 block text-xs font-medium text-muted-foreground"
									>
										Individueller Board-Name (optional)
									</label>
									<Input
										id="new-board-name"
										value={newName}
										onChange={(e) => setNewName(e.target.value)}
										placeholder="z.B. Marketing-Planung, Sprint 30..."
										className="h-10 rounded-xl"
										onKeyDown={(e) => e.key === "Enter" && handleCreate()}
									/>
								</div>
								<Button
									onClick={handleCreate}
									disabled={
										createBoard.isPending || createBoardWithState.isPending
									}
									className="h-10 rounded-xl px-5"
								>
									{createBoard.isPending ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<Plus className="mr-2 h-4 w-4" />
									)}
									Erstellen
								</Button>
							</div>
						</section>
					)}

					{tab === "boards" && (
						<section className="space-y-3">
							<div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/40 p-4 md:flex-row md:items-center md:justify-between">
								<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
									<button
										type="button"
										onClick={() => setFolderFilter("all")}
										className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
											folderFilter === "all"
												? "bg-primary text-white"
												: "bg-background text-muted-foreground hover:text-foreground"
										}`}
									>
										Alle Sammlungen
									</button>
									<button
										type="button"
										onClick={() => setFolderFilter("unfiled")}
										className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
											folderFilter === "unfiled"
												? "bg-primary text-white"
												: "bg-background text-muted-foreground hover:text-foreground"
										}`}
									>
										Ohne Sammlung
									</button>
									{folders.map((folder) => (
										<button
											key={folder.id}
											type="button"
											onClick={() => setFolderFilter(folder.id)}
											className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
												folderFilter === folder.id
													? "bg-primary text-white"
													: "bg-background text-muted-foreground hover:text-foreground"
											}`}
										>
											{folder.name}
										</button>
									))}
								</div>
								<div className="flex min-w-[220px] gap-2">
									<Input
										value={newFolderName}
										onChange={(event) => setNewFolderName(event.target.value)}
										onKeyDown={(event) =>
											event.key === "Enter" && handleCreateFolder()
										}
										placeholder="Neue Sammlung"
										className="h-9 rounded-xl text-xs"
									/>
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="h-9 rounded-xl"
										disabled={!newFolderName.trim() || createFolder.isPending}
										onClick={handleCreateFolder}
									>
										<FolderPlus className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</section>
					)}

					{/* STEUERUNGSBAR: SEARCH, FILTERS, VIEW TOGGLES */}
					<section className="space-y-4">
						{/* Tabs zur Unterscheidung: Boards vs Papierkorb */}
						<div className="flex border-b border-border/60">
							<button
								type="button"
								onClick={() => {
									setTab("boards");
									setSearchQuery("");
								}}
								className={`pb-3 text-sm font-semibold tracking-wide transition-all px-4 border-b-2 -mb-px flex items-center gap-2 ${
									tab === "boards"
										? "border-primary text-primary"
										: "border-transparent text-muted-foreground hover:text-foreground"
								}`}
							>
								<PenLine className="h-4.5 w-4.5" />
								{t("project.canvasLibrary.tabBoards")}
								{boards && boards.length > 0 && (
									<span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-bold">
										{boards.length}
									</span>
								)}
							</button>
							<button
								type="button"
								onClick={() => {
									setTab("archive");
									setSearchQuery("");
									setFolderFilter("all");
								}}
								className={`pb-3 text-sm font-semibold tracking-wide transition-all px-4 border-b-2 -mb-px flex items-center gap-2 ${
									tab === "archive"
										? "border-primary text-primary"
										: "border-transparent text-muted-foreground hover:text-foreground"
								}`}
							>
								<Archive className="h-4.5 w-4.5" />
								{t("project.canvasLibrary.tabArchive")}
								{archivedBoards && archivedBoards.length > 0 && (
									<span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-bold">
										{archivedBoards.length}
									</span>
								)}
							</button>
						</div>

						{/* FILTER- UND SUCHKONTROLLEN */}
						<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
							{/* Suchfeld */}
							<div className="relative flex-1 max-w-md">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder={
										t("project.canvasLibrary.searchPlaceholder") ||
										"Boards durchsuchen..."
									}
									className="pl-9 pr-8 h-10 rounded-xl"
								/>
								{searchQuery && (
									<button
										type="button"
										onClick={() => setSearchQuery("")}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									>
										<X className="h-4 w-4" />
									</button>
								)}
							</div>

							{/* Filter-Kapseln & Sortierung */}
							<div className="flex flex-wrap items-center gap-3">
								{/* Visibilitäts-Filter (nur bei aktiven Boards sinnvoll) */}
								{tab === "boards" && (
									<div className="flex items-center bg-card border border-border/80 p-0.5 rounded-xl">
										<button
											type="button"
											onClick={() => setFilter("all")}
											className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
												filter === "all"
													? "bg-primary text-white shadow-sm"
													: "text-muted-foreground hover:text-foreground"
											}`}
										>
											{t("project.canvasLibrary.all") || "Alle"}
										</button>
										<button
											type="button"
											onClick={() => setFilter("mine")}
											className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
												filter === "mine"
													? "bg-primary text-white shadow-sm"
													: "text-muted-foreground hover:text-foreground"
											}`}
										>
											{t("project.canvasLibrary.mine") || "Meine"}
										</button>
										<button
											type="button"
											onClick={() => setFilter("shared")}
											className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
												filter === "shared"
													? "bg-primary text-white shadow-sm"
													: "text-muted-foreground hover:text-foreground"
											}`}
										>
											{t("project.canvasLibrary.shared") || "Geteilt"}
										</button>
									</div>
								)}

								{/* Sortier-Auswahl */}
								<div className="relative">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="outline"
												size="sm"
												className="h-10 rounded-xl gap-2 text-xs font-semibold border-border/80"
											>
												<ArrowUpDown className="h-4 w-4 text-muted-foreground" />
												<span>
													{sortBy === "updatedAt" && "Zuletzt aktualisiert"}
													{sortBy === "createdAt" && "Erstellungsdatum"}
													{sortBy === "name" && "Name (A-Z)"}
												</span>
												<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent
											align="end"
											className="w-48 rounded-xl p-1"
										>
											<DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5 font-normal">
												Sortieren nach
											</DropdownMenuLabel>
											<DropdownMenuItem
												onClick={() => setSortBy("updatedAt")}
												className="rounded-lg gap-2 text-xs"
											>
												<Clock className="h-3.5 w-3.5 text-muted-foreground" />
												Zuletzt aktualisiert
												{sortBy === "updatedAt" && (
													<Check className="ml-auto h-3.5 w-3.5 text-primary" />
												)}
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => setSortBy("createdAt")}
												className="rounded-lg gap-2 text-xs"
											>
												<Calendar className="h-3.5 w-3.5 text-muted-foreground" />
												Erstellungsdatum
												{sortBy === "createdAt" && (
													<Check className="ml-auto h-3.5 w-3.5 text-primary" />
												)}
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => setSortBy("name")}
												className="rounded-lg gap-2 text-xs"
											>
												<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
												Name (A-Z)
												{sortBy === "name" && (
													<Check className="ml-auto h-3.5 w-3.5 text-primary" />
												)}
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>

								{/* Grid/List View Toggles */}
								<div className="flex items-center bg-card border border-border/80 p-0.5 rounded-xl">
									<button
										type="button"
										onClick={() => setViewMode("grid")}
										className={`p-1.5 rounded-lg transition-all ${
											viewMode === "grid"
												? "bg-accent text-foreground shadow-xs"
												: "text-muted-foreground hover:text-foreground"
										}`}
										title="Rasteransicht"
									>
										<Grid className="h-4 w-4" />
									</button>
									<button
										type="button"
										onClick={() => setViewMode("list")}
										className={`p-1.5 rounded-lg transition-all ${
											viewMode === "list"
												? "bg-accent text-foreground shadow-xs"
												: "text-muted-foreground hover:text-foreground"
										}`}
										title="Listenansicht"
									>
										<List className="h-4 w-4" />
									</button>
								</div>
							</div>
						</div>
					</section>

					{/* BOARD-GRID ODER -LISTE RENDERN */}
					<section>
						{tab === "archive" && (
							<div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400">
								<Info className="h-4 w-4 shrink-0" />
								<span>{t("project.canvasLibrary.archiveDescription")}</span>
							</div>
						)}

						{isDataLoading ? (
							<div className="flex flex-col items-center justify-center py-24 gap-3">
								<Loader2 className="h-8 w-8 animate-spin text-primary" />
								<p className="text-sm text-muted-foreground">
									Lade deine Boards...
								</p>
							</div>
						) : processedBoards && processedBoards.length > 0 ? (
							viewMode === "grid" ? (
								<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
									{processedBoards.map((board) => (
										<BoardLibraryGridCard
											key={board.id}
											tab={tab}
											board={board}
											isOwner={board.ownerId === session?.user?.id}
											emptyPreviewLabel={t(
												"project.canvasLibrary.emptyPreview",
											)}
											actions={{
												onRename: () => openRenameDialog(board.id, board.name),
												onArchive: () => archiveBoard.mutate({ id: board.id }),
												onRestore: () => restoreBoard.mutate({ id: board.id }),
												onPermanentDelete: () =>
													openDeleteConfirmation(board.id, board.name),
												folderOptions,
												onMoveToFolder: (folderId) =>
													updateBoard.mutate({
														id: board.id,
														folderId,
													}),
												isArchivePending: archiveBoard.isPending,
												isRestorePending: restoreBoard.isPending,
												isDeletePending: permanentDeleteBoard.isPending,
											}}
										/>
									))}
								</div>
							) : (
								<div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border/60">
									{processedBoards.map((board) => (
										<BoardLibraryListRow
											key={board.id}
											tab={tab}
											board={board}
											isOwner={board.ownerId === session?.user?.id}
											actions={{
												onRename: () => openRenameDialog(board.id, board.name),
												onArchive: () => archiveBoard.mutate({ id: board.id }),
												onRestore: () => restoreBoard.mutate({ id: board.id }),
												onPermanentDelete: () =>
													openDeleteConfirmation(board.id, board.name),
												folderOptions,
												onMoveToFolder: (folderId) =>
													updateBoard.mutate({
														id: board.id,
														folderId,
													}),
												isArchivePending: archiveBoard.isPending,
												isRestorePending: restoreBoard.isPending,
												isDeletePending: permanentDeleteBoard.isPending,
											}}
										/>
									))}
								</div>
							)
						) : (
							/* Leerer Zustand */
							<div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-card/10 py-24 text-center p-6">
								{tab === "boards" ? (
									<>
										<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
											<PenLine className="h-6 w-6" />
										</div>
										<p className="text-lg font-bold text-foreground">
											{searchQuery
												? "Keine Übereinstimmung"
												: t("project.canvasLibrary.emptyTitle")}
										</p>
										<p className="mt-2 max-w-sm text-sm text-muted-foreground">
											{searchQuery
												? "Keine Boards entsprechen deiner Suche. Versuche es mit einem anderen Begriff oder setze die Filter zurück."
												: t("project.canvasLibrary.emptyDescription")}
										</p>
										{searchQuery && (
											<Button
												variant="outline"
												size="sm"
												onClick={() => setSearchQuery("")}
												className="mt-4 rounded-xl"
											>
												Suche leeren
											</Button>
										)}
									</>
								) : (
									<>
										<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
											<Archive className="h-6 w-6" />
										</div>
										<p className="text-lg font-bold text-foreground">
											{searchQuery
												? "Nichts im Papierkorb gefunden"
												: t("project.canvasLibrary.archiveEmptyTitle")}
										</p>
										<p className="mt-2 max-w-sm text-sm text-muted-foreground">
											{searchQuery
												? "Es gibt keine gelöschten Boards, die deiner Suche entsprechen."
												: t("project.canvasLibrary.archiveEmptyDescription")}
										</p>
									</>
								)}
							</div>
						)}
					</section>
				</main>

				{/* SEITENBAR: AKTIVITÄTSFEED */}
				<aside className="xl:sticky xl:top-8 xl:self-start space-y-6">
					<ActivityFeed />
				</aside>
			</div>

			{/* --- DIALOGE --- */}

			<Dialog
				open={encryptionChoiceOpen}
				onOpenChange={(open) => {
					setEncryptionChoiceOpen(open);
					if (!open) {
						setSelectedEncryptionMode(null);
						if (!e2eeUnlockOpen) setPendingCreateAction(null);
					}
				}}
			>
				<DialogContent className="max-w-2xl rounded-2xl">
					<DialogHeader>
						<DialogTitle>{t("boardCreation.title")}</DialogTitle>
						<DialogDescription>
							{t("boardCreation.description")}
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-3 py-2 sm:grid-cols-2">
						<button
							type="button"
							aria-pressed={selectedEncryptionMode === "server"}
							onClick={() => setSelectedEncryptionMode("server")}
							className={`rounded-2xl border p-4 text-left transition-all ${
								selectedEncryptionMode === "server"
									? "border-primary bg-primary/10 ring-2 ring-primary/20"
									: "border-border bg-card hover:border-primary/50 hover:bg-accent/40"
							}`}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
									<Cloud className="h-5 w-5" />
								</div>
								{selectedEncryptionMode === "server" ? (
									<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
										<Check className="h-4 w-4" />
									</div>
								) : null}
							</div>
							<h3 className="mt-4 font-semibold">
								{t("boardCreation.serverTitle")}
							</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								{t("boardCreation.serverDescription")}
							</p>
							<div className="mt-4 rounded-xl bg-background/70 p-3 text-xs text-muted-foreground">
								{t("boardCreation.serverDetails")}
							</div>
						</button>

						<button
							type="button"
							aria-pressed={selectedEncryptionMode === "e2ee"}
							onClick={() => setSelectedEncryptionMode("e2ee")}
							className={`rounded-2xl border p-4 text-left transition-all ${
								selectedEncryptionMode === "e2ee"
									? "border-primary bg-primary/10 ring-2 ring-primary/20"
									: "border-border bg-card hover:border-primary/50 hover:bg-accent/40"
							}`}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
									<LockKeyhole className="h-5 w-5" />
								</div>
								{selectedEncryptionMode === "e2ee" ? (
									<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
										<Check className="h-4 w-4" />
									</div>
								) : null}
							</div>
							<h3 className="mt-4 font-semibold">
								{t("boardCreation.e2eeTitle")}
							</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								{t("boardCreation.e2eeDescription")}
							</p>
							<div className="mt-4 rounded-xl bg-background/70 p-3 text-xs text-muted-foreground">
								{t("boardCreation.e2eeDetails")}
							</div>
						</button>
					</div>

					<p className="text-xs text-muted-foreground">
						{t("boardCreation.permanentHint")}
					</p>
					{createEncryptionError ? (
						<p className="text-sm text-destructive">{createEncryptionError}</p>
					) : null}
					<DialogFooter className="gap-2">
						<DialogClose asChild>
							<Button variant="outline" type="button">
								{t("common.cancel")}
							</Button>
						</DialogClose>
						<Button
							type="button"
							disabled={
								!selectedEncryptionMode ||
								createBoard.isPending ||
								createBoardWithState.isPending
							}
							onClick={() => void handleConfirmEncryptionMode()}
						>
							{createBoard.isPending || createBoardWithState.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							{t("boardCreation.continue")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={e2eeUnlockOpen}
				onOpenChange={(open) => {
					setE2eeUnlockOpen(open);
					if (!open) {
						setPendingCreateAction(null);
						setE2eeUnlockPassword("");
						setE2eeUnlockError("");
					}
				}}
			>
				<DialogContent className="max-w-md rounded-2xl">
					<DialogHeader>
						<DialogTitle>E2EE-Identity entsperren</DialogTitle>
						<DialogDescription>
							Entsperre deine User-Identity mit deinem Konto-Passwort oder
							E2EE-Sicherheitscode, damit Skedra den Board-Schluessel als
							Recovery-Umschlag fuer dich speichern kann.
						</DialogDescription>
					</DialogHeader>
					<form className="space-y-4" onSubmit={handleUnlockIdentityAndCreate}>
						<Input
							type="password"
							value={e2eeUnlockPassword}
							onChange={(event) => setE2eeUnlockPassword(event.target.value)}
							placeholder="Passwort oder E2EE-Sicherheitscode"
							autoFocus
							required
						/>
						{e2eeUnlockError ? (
							<p className="text-sm text-destructive">{e2eeUnlockError}</p>
						) : null}
						<DialogFooter className="gap-2">
							<DialogClose asChild>
								<Button variant="outline" type="button">
									Abbrechen
								</Button>
							</DialogClose>
							<Button
								type="submit"
								disabled={e2eeUnlockLoading || !e2eeUnlockPassword}
							>
								{e2eeUnlockLoading ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : null}
								Entsperren
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* 1. UMBENENNEN-DIALOG */}
			<Dialog
				open={renameBoardId !== null}
				onOpenChange={(open) => !open && setRenameBoardId(null)}
			>
				<DialogContent className="max-w-md rounded-2xl">
					<DialogHeader>
						<DialogTitle>Board umbenennen</DialogTitle>
						<DialogDescription>
							Gib einen neuen Namen für dein Whiteboard ein. Diese Änderung wird
							sofort für alle Mitarbeiter aktiv.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-3">
						<label
							htmlFor="rename-input"
							className="text-xs font-semibold text-muted-foreground"
						>
							Name des Boards
						</label>
						<Input
							id="rename-input"
							value={renameBoardName}
							onChange={(e) => setRenameBoardName(e.target.value)}
							placeholder="z.B. Marketing Brainstorming"
							className="h-10 rounded-xl"
							onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
						/>
					</div>
					<DialogFooter className="gap-2">
						<DialogClose asChild>
							<Button variant="outline" size="sm" className="rounded-xl h-10">
								Abbrechen
							</Button>
						</DialogClose>
						<Button
							onClick={handleRenameSubmit}
							disabled={updateBoard.isPending || !renameBoardName.trim()}
							size="sm"
							className="rounded-xl h-10 px-5"
						>
							{updateBoard.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Speichern
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* 2. ENDGÜLTIG LÖSCHEN BESTÄTIGUNGSDIALOG */}
			<Dialog
				open={deleteBoardId !== null}
				onOpenChange={(open) => !open && setDeleteBoardId(null)}
			>
				<DialogContent className="max-w-md rounded-2xl border-destructive/20">
					<DialogHeader>
						<DialogTitle className="text-destructive flex items-center gap-2">
							<Trash2 className="h-5 w-5" />
							Board unwiderruflich löschen?
						</DialogTitle>
						<DialogDescription>
							Bist du sicher, dass du das Board{" "}
							<strong className="text-foreground">"{deleteBoardName}"</strong>{" "}
							endgültig löschen möchtest? Diese Aktion kann nicht rückgängig
							gemacht werden. Alle Daten und Verläufe gehen verloren.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 mt-4">
						<DialogClose asChild>
							<Button variant="outline" size="sm" className="rounded-xl h-10">
								Abbrechen
							</Button>
						</DialogClose>
						<Button
							variant="destructive"
							onClick={handleDeleteSubmit}
							disabled={permanentDeleteBoard.isPending}
							size="sm"
							className="rounded-xl h-10 px-5 bg-destructive hover:bg-destructive/90"
						>
							{permanentDeleteBoard.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Endgültig löschen
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
