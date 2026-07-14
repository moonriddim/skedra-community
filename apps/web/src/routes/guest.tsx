import type { CanvasCommands } from "@/components/canvas/canvas-commands";
import { GuestCanvasChrome } from "@/components/guest/guest-canvas-chrome";
import { GuestCanvasFooter } from "@/components/guest/guest-canvas-footer";
import { GuestLiveCollaborationDialog } from "@/components/guest/guest-live-collaboration-dialog";
import { GuestWelcomeSplash } from "@/components/guest/guest-welcome-splash";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCanvasStore } from "@/hooks/use-canvas-store";
import { authClient } from "@/lib/auth-client";
import { clearLocalCanvasState } from "@/lib/canvas/local-canvas-storage";
import type { SkedraCanvasFileActions } from "@/lib/canvas/skedra-file-utils";
import {
	base64ToBytes,
	createE2eeKeyHash,
	encryptYjsUpdate,
	generateE2eeKey,
	storeE2eeKey,
	withE2eeKeyFragmentPath,
} from "@/lib/e2ee";
import { useI18n } from "@/lib/i18n";
import { localizePublicPath } from "@/lib/public-path";
import { trpc } from "@/lib/trpc";
import { Check, Cloud, Loader2, LockKeyhole } from "lucide-react";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

const SkedraCanvas = lazy(() =>
	import("@/components/canvas/skedra-canvas").then((m) => ({
		default: m.SkedraCanvas,
	})),
);

export function GuestCanvasPage() {
	const { t, locale } = useI18n();
	const publicPath = (path: string) => localizePublicPath(path, locale);
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const { data: session } = authClient.useSession();
	const { data: publicConfig } = trpc.billing.getPublicConfig.useQuery();
	const { data: billing } = trpc.billing.getStatus.useQuery(undefined, {
		enabled: Boolean(session?.user && publicConfig?.managed),
		retry: false,
	});
	const saveStateRef = useRef<(() => string | null) | null>(null);
	const clearCanvasRef = useRef<(() => void) | null>(null);
	const canvasFileRef = useRef<SkedraCanvasFileActions | null>(null);
	const canvasCommandRef = useRef<CanvasCommands | null>(null);
	const [elementCount, setElementCount] = useState(0);
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const [liveCollabDialogOpen, setLiveCollabDialogOpen] = useState(false);
	const [clearDialogOpen, setClearDialogOpen] = useState(false);
	const [boardName, setBoardName] = useState("");
	const [saveEncryptionMode, setSaveEncryptionMode] = useState<
		"server" | "e2ee" | null
	>(null);
	const [saveError, setSaveError] = useState("");
	const pendingE2eeKeyRef = useRef<string | null>(null);
	const zenMode = useCanvasStore((state) => state.zenMode);

	const createWithState = trpc.whiteboard.createWithState.useMutation({
		onSuccess: (board) => {
			const key = pendingE2eeKeyRef.current;
			if (key) {
				storeE2eeKey(board.id, key);
			}
			pendingE2eeKeyRef.current = null;
			clearLocalCanvasState();
			navigate(
				key
					? withE2eeKeyFragmentPath(`/board/${board.id}`, key)
					: `/board/${board.id}`,
				{ replace: true },
			);
		},
		onError: (error) => {
			pendingE2eeKeyRef.current = null;
			setSaveError(error.message);
		},
	});

	useEffect(() => {
		if (searchParams.get("save") !== "1" || !session?.user) return;
		if (publicConfig?.managed && !billing?.accessGranted) return;
		setSaveEncryptionMode(null);
		setSaveDialogOpen(true);
		setSearchParams({}, { replace: true });
	}, [
		billing?.accessGranted,
		publicConfig?.managed,
		searchParams,
		session?.user,
		setSearchParams,
	]);

	useEffect(() => {
		if (searchParams.get("collab") !== "1" || !session?.user) return;
		if (publicConfig?.managed && !billing?.accessGranted) return;
		setLiveCollabDialogOpen(true);
		setSearchParams({}, { replace: true });
	}, [
		billing?.accessGranted,
		publicConfig?.managed,
		searchParams,
		session?.user,
		setSearchParams,
	]);

	const openHelp = () => canvasCommandRef.current?.openHelp();

	const handleSaveClick = () => {
		if (publicConfig?.managed !== false && !billing?.accessGranted) {
			navigate(
				`${publicPath("/pricing")}?redirect=${encodeURIComponent(`${publicPath("/")}?save=1`)}`,
			);
			return;
		}
		if (!session?.user) {
			navigate(
				`/login?redirect=${encodeURIComponent(`${publicPath("/")}?save=1`)}`,
			);
			return;
		}
		setSaveError("");
		setSaveEncryptionMode(null);
		setBoardName((current) => current || t("project.newCanvas"));
		setSaveDialogOpen(true);
	};

	const handleLiveCollaborationClick = () => {
		setLiveCollabDialogOpen(true);
	};

	/** Live-Session: Board in Cloud speichern, danach Realtime auf /board/:id */
	const handleStartLiveSession = () => {
		setLiveCollabDialogOpen(false);
		handleSaveClick();
	};

	const handleConfirmSave = async () => {
		const stateBase64 = saveStateRef.current?.();
		if (!stateBase64) {
			setSaveError(t("guestCanvas.saveEmptyError"));
			return;
		}
		if (!saveEncryptionMode) {
			setSaveError(t("boardCreation.description"));
			return;
		}

		if (saveEncryptionMode === "server") {
			pendingE2eeKeyRef.current = null;
			createWithState.mutate({
				name: boardName.trim() || t("project.newCanvas"),
				encryptionMode: "server",
				stateBase64,
			});
			return;
		}

		const key = generateE2eeKey();
		const e2eeKeyHash = await createE2eeKeyHash(key);
		const e2eeInitialUpdate = await encryptYjsUpdate(
			base64ToBytes(stateBase64),
			key,
		);
		pendingE2eeKeyRef.current = key;
		createWithState.mutate({
			name: boardName.trim() || t("project.newCanvas"),
			encryptionMode: "e2ee",
			e2eeInitialUpdate,
			e2eeKeyHint: `created-${new Date().toISOString().slice(0, 10)}`,
			e2eeKeyHash,
		});
	};

	const handleExportVisual = (format: "svg" | "png" | "pdf" | "pptx") => {
		void canvasCommandRef.current?.exportVisual(format);
	};

	const handleSaveSkedra = () => {
		canvasFileRef.current?.exportSkedra();
	};

	const handleSaveEncryptedSkedra = () => {
		void canvasFileRef.current?.exportEncryptedSkedra();
	};

	const handleOpenSkedra = () => {
		void canvasFileRef.current?.importSkedra();
	};

	const handleClearCanvas = () => {
		clearCanvasRef.current?.();
		const canvasStore = useCanvasStore.getState();
		canvasStore.clearSelection();
		canvasStore.resetViewport();
		setClearDialogOpen(false);
	};

	return (
		<div className="relative h-screen overflow-hidden bg-background">
			{!zenMode && (
				<GuestCanvasChrome
					isLoggedIn={!!session?.user}
					managedBilling={publicConfig?.managed !== false}
					onSave={handleSaveClick}
					onSaveSkedra={handleSaveSkedra}
					onSaveEncryptedSkedra={handleSaveEncryptedSkedra}
					onOpenSkedra={handleOpenSkedra}
					onExportSvg={() => handleExportVisual("svg")}
					onExportPng={() => handleExportVisual("png")}
					onExportPdf={() => handleExportVisual("pdf")}
					onExportPptx={() => handleExportVisual("pptx")}
					onClearCanvas={() => setClearDialogOpen(true)}
					onOpenHelp={openHelp}
					onOpenLiveCollaboration={handleLiveCollaborationClick}
				/>
			)}

			<Suspense
				fallback={
					<div className="flex h-full items-center justify-center">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
					</div>
				}
			>
				<SkedraCanvas
					localMode
					getSaveStateRef={saveStateRef}
					clearCanvasRef={clearCanvasRef}
					canvasFileRef={canvasFileRef}
					canvasCommandRef={canvasCommandRef}
					helpGuestMode
					onRequestClearCanvas={() => setClearDialogOpen(true)}
					onElementCountChange={setElementCount}
					presenceEnabled={false}
				/>
			</Suspense>

			<GuestWelcomeSplash
				visible={elementCount === 0 && !zenMode}
				onSave={handleSaveClick}
				onOpenHelp={openHelp}
				onOpenLiveCollaboration={handleLiveCollaborationClick}
				isLoggedIn={!!session?.user}
				managedBilling={publicConfig?.managed !== false}
			/>

			{!zenMode && (
				<GuestCanvasFooter
					onOpenHelp={openHelp}
					showHelpAnnotation={elementCount === 0}
				/>
			)}

			<GuestLiveCollaborationDialog
				open={liveCollabDialogOpen}
				onOpenChange={setLiveCollabDialogOpen}
				isLoggedIn={!!session?.user}
				managedBilling={publicConfig?.managed !== false}
				onStartSession={handleStartLiveSession}
			/>

			<Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("guestCanvas.saveDialogTitle")}</DialogTitle>
						<DialogDescription>
							{t("guestCanvas.saveDialogDescription")}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<label className="text-sm font-medium" htmlFor="guest-board-name">
							{t("guestCanvas.boardName")}
						</label>
						<Input
							id="guest-board-name"
							value={boardName}
							onChange={(event) => setBoardName(event.target.value)}
							placeholder={t("project.newCanvas")}
						/>
						<div className="grid gap-2 pt-2 sm:grid-cols-2">
							<button
								type="button"
								onClick={() => setSaveEncryptionMode("server")}
								className={`rounded-xl border p-3 text-left ${
									saveEncryptionMode === "server"
										? "border-primary bg-primary/10"
										: "border-border hover:border-primary/50"
								}`}
							>
								<div className="flex items-center justify-between gap-2">
									<Cloud className="h-5 w-5 text-sky-500" />
									{saveEncryptionMode === "server" ? (
										<Check className="h-4 w-4 text-primary" />
									) : null}
								</div>
								<p className="mt-2 text-sm font-medium">
									{t("boardCreation.serverTitle")}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{t("boardCreation.serverDescription")}
								</p>
							</button>
							<button
								type="button"
								onClick={() => setSaveEncryptionMode("e2ee")}
								className={`rounded-xl border p-3 text-left ${
									saveEncryptionMode === "e2ee"
										? "border-primary bg-primary/10"
										: "border-border hover:border-primary/50"
								}`}
							>
								<div className="flex items-center justify-between gap-2">
									<LockKeyhole className="h-5 w-5 text-emerald-500" />
									{saveEncryptionMode === "e2ee" ? (
										<Check className="h-4 w-4 text-primary" />
									) : null}
								</div>
								<p className="mt-2 text-sm font-medium">
									{t("boardCreation.e2eeTitle")}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{t("boardCreation.e2eeDescription")}
								</p>
							</button>
						</div>
						{saveError && (
							<p className="text-sm text-destructive">{saveError}</p>
						)}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button
							onClick={handleConfirmSave}
							disabled={createWithState.isPending || !saveEncryptionMode}
						>
							{createWithState.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							{t("guestCanvas.saveToCloud")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("guestCanvas.clearCanvas")}</DialogTitle>
						<DialogDescription>
							{t("guestCanvas.clearCanvasDescription")}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setClearDialogOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button variant="destructive" onClick={handleClearCanvas}>
							{t("guestCanvas.clearCanvasConfirm")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
