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
import {
	exportPDF,
	exportPNG,
	exportPPTX,
	exportSVG,
} from "@/lib/canvas/export-utils";
import { clearLocalCanvasState } from "@/lib/canvas/local-canvas-storage";
import type { SkedraCanvasFileActions } from "@/lib/canvas/skedra-file-utils";
import {
	base64ToBytes,
	encryptYjsUpdate,
	generateE2eeKey,
	storeE2eeKey,
	withE2eeKeyFragmentPath,
} from "@/lib/e2ee";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

const SkedraCanvas = lazy(() =>
	import("@/components/canvas/skedra-canvas").then((m) => ({
		default: m.SkedraCanvas,
	})),
);

export function GuestCanvasPage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const { data: session } = authClient.useSession();
	const saveStateRef = useRef<(() => string | null) | null>(null);
	const clearCanvasRef = useRef<(() => void) | null>(null);
	const canvasFileRef = useRef<SkedraCanvasFileActions | null>(null);
	const canvasCommandRef = useRef<CanvasCommands | null>(null);
	const [elementCount, setElementCount] = useState(0);
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const [liveCollabDialogOpen, setLiveCollabDialogOpen] = useState(false);
	const [clearDialogOpen, setClearDialogOpen] = useState(false);
	const [boardName, setBoardName] = useState("");
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
		setSaveDialogOpen(true);
		setSearchParams({}, { replace: true });
	}, [searchParams, session?.user, setSearchParams]);

	useEffect(() => {
		if (searchParams.get("collab") !== "1" || !session?.user) return;
		setLiveCollabDialogOpen(true);
		setSearchParams({}, { replace: true });
	}, [searchParams, session?.user, setSearchParams]);

	const openHelp = () => canvasCommandRef.current?.openHelp();

	const handleSaveClick = () => {
		if (!session?.user) {
			navigate(`/login?redirect=${encodeURIComponent("/?save=1")}`);
			return;
		}
		setSaveError("");
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

		const key = generateE2eeKey();
		const e2eeInitialUpdate = await encryptYjsUpdate(
			base64ToBytes(stateBase64),
			key,
		);
		pendingE2eeKeyRef.current = key;
		createWithState.mutate({
			name: boardName.trim() || t("project.newCanvas"),
			e2eeInitialUpdate,
			e2eeKeyHint: `created-${new Date().toISOString().slice(0, 10)}`,
		});
	};

	const handleExportSvg = () => {
		const svg = document.querySelector<SVGSVGElement>(".skedra-canvas svg");
		if (svg) exportSVG(svg);
	};

	const handleExportPng = () => {
		const svg = document.querySelector<SVGSVGElement>(".skedra-canvas svg");
		if (svg) void exportPNG(svg);
	};

	const handleExportPdf = () => {
		const svg = document.querySelector<SVGSVGElement>(".skedra-canvas svg");
		if (svg) void exportPDF(svg);
	};

	const handleExportPptx = () => {
		const svg = document.querySelector<SVGSVGElement>(".skedra-canvas svg");
		if (svg) void exportPPTX(svg);
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
					onSave={handleSaveClick}
					onSaveSkedra={handleSaveSkedra}
					onSaveEncryptedSkedra={handleSaveEncryptedSkedra}
					onOpenSkedra={handleOpenSkedra}
					onExportSvg={handleExportSvg}
					onExportPng={handleExportPng}
					onExportPdf={handleExportPdf}
					onExportPptx={handleExportPptx}
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
							disabled={createWithState.isPending}
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
