import {
	CANVAS_BG_DARK,
	CANVAS_BG_LIGHT,
} from "@/components/canvas/properties-panel/constants";
import { ThemePicker } from "@/components/theme/theme-picker";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCanvasStore } from "@/hooks/use-canvas-store";
import { useI18n } from "@/lib/i18n";
import { useThemeStore } from "@/stores/theme";
import {
	Download,
	FileText,
	FolderOpen,
	HelpCircle,
	KeyRound,
	Menu,
	MonitorPlay,
	Save,
	Trash2,
	UserPlus,
	Users,
} from "lucide-react";
import { Link } from "react-router";

interface GuestCanvasChromeProps {
	isLoggedIn: boolean;
	managedBilling: boolean;
	onSave: () => void;
	onSaveSkedra: () => void;
	onSaveEncryptedSkedra: () => void;
	onOpenSkedra: () => void;
	onExportSvg: () => void;
	onExportPng: () => void;
	onExportPdf: () => void;
	onExportPptx: () => void;
	onClearCanvas: () => void;
	onOpenHelp: () => void;
	onOpenLiveCollaboration: () => void;
}

/** Excalidraw-aehnliche Gast-UI: Hamburger links, Teilen rechts. */
export function GuestCanvasChrome({
	isLoggedIn,
	managedBilling,
	onSave,
	onSaveSkedra,
	onSaveEncryptedSkedra,
	onOpenSkedra,
	onExportSvg,
	onExportPng,
	onExportPdf,
	onExportPptx,
	onClearCanvas,
	onOpenHelp,
	onOpenLiveCollaboration,
}: GuestCanvasChromeProps) {
	const { t, locale, setLocale } = useI18n();
	const theme = useThemeStore((state) => state.theme);
	const canvasBg = useCanvasStore((state) => state.canvasBg);
	const setCanvasBg = useCanvasStore((state) => state.setCanvasBg);

	const isDark =
		theme === "dark" ||
		(theme === "system" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);
	const canvasBgOptions = isDark ? CANVAS_BG_DARK : CANVAS_BG_LIGHT;

	return (
		<>
			{/* Hamburger-Menue oben links */}
			<div className="pointer-events-none absolute left-3 top-3 z-50">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="pointer-events-auto h-9 w-9 rounded-lg border border-border/60 bg-card/80 shadow-sm backdrop-blur-md"
							aria-label={t("guestCanvas.menu")}
						>
							<Menu className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-64">
						<DropdownMenuItem onClick={onSave}>
							<Save className="mr-2 h-4 w-4" />
							{t("guestCanvas.saveToCloud")}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onSaveSkedra}>
							<Save className="mr-2 h-4 w-4" />
							{t("guestCanvas.saveSkedra")}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onSaveEncryptedSkedra}>
							<KeyRound className="mr-2 h-4 w-4" />
							{t("guestCanvas.saveEncryptedSkedra")}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onOpenSkedra}>
							<FolderOpen className="mr-2 h-4 w-4" />
							{t("guestCanvas.openSkedra")}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={onExportSvg}>
							<Download className="mr-2 h-4 w-4" />
							{t("guestCanvas.exportSvg")}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onExportPng}>
							<Download className="mr-2 h-4 w-4" />
							{t("guestCanvas.exportPng")}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onExportPdf}>
							<FileText className="mr-2 h-4 w-4" />
							{t("guestCanvas.exportPdf")}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onExportPptx}>
							<MonitorPlay className="mr-2 h-4 w-4" />
							{t("guestCanvas.exportPptx")}
						</DropdownMenuItem>

						<DropdownMenuSeparator />

						{isLoggedIn ? (
							<>
								<DropdownMenuItem asChild>
									<Link to="/library">
										<FolderOpen className="mr-2 h-4 w-4" />
										{t("guestCanvas.myBoards")}
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link to="/settings">
										<KeyRound className="mr-2 h-4 w-4" />
										{t("settingsCenter.title") ?? "Einstellungen"}
									</Link>
								</DropdownMenuItem>
							</>
						) : (
							<>
								<DropdownMenuItem asChild>
									<Link
										to={`${managedBilling ? "/pricing" : "/login"}?redirect=${encodeURIComponent("/")}`}
									>
										<UserPlus className="mr-2 h-4 w-4" />
										{t("guestCanvas.signIn")}
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link
										to={`${managedBilling ? "/pricing" : "/register"}?redirect=${encodeURIComponent("/?save=1")}`}
									>
										<UserPlus className="mr-2 h-4 w-4 text-primary" />
										<span className="text-primary">
											{t("guestCanvas.signUp")}
										</span>
									</Link>
								</DropdownMenuItem>
							</>
						)}

						<DropdownMenuItem onClick={onOpenLiveCollaboration}>
							<Users className="mr-2 h-4 w-4" />
							{t("guestCanvas.liveCollaboration.menuLabel")}
						</DropdownMenuItem>

						<DropdownMenuItem onClick={onOpenHelp}>
							<HelpCircle className="mr-2 h-4 w-4" />
							{t("guestCanvas.help")}
						</DropdownMenuItem>

						<DropdownMenuItem
							onClick={onClearCanvas}
							className="text-destructive focus:text-destructive"
						>
							<Trash2 className="mr-2 h-4 w-4" />
							{t("guestCanvas.clearCanvas")}
						</DropdownMenuItem>

						<DropdownMenuSeparator />
						<DropdownMenuLabel>
							{t("guestCanvas.preferences")}
						</DropdownMenuLabel>

						<div className="px-2 py-1.5">
							<ThemePicker labelSet="guest" />
						</div>

						<div className="px-2 py-1.5">
							<p className="mb-1.5 text-xs text-muted-foreground">
								{t("common.language")}
							</p>
							<select
								value={locale}
								onChange={(event) =>
									setLocale(event.target.value as "de" | "en")
								}
								className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
							>
								<option value="de">{t("common.german")}</option>
								<option value="en">{t("common.english")}</option>
							</select>
						</div>

						<div className="px-2 py-1.5">
							<p className="mb-1.5 text-xs text-muted-foreground">
								{t("canvas.properties.drawingSurface")}
							</p>
							<div className="flex flex-wrap gap-1">
								{canvasBgOptions.map((bg, index) => (
									<button
										key={bg || "__default"}
										type="button"
										onClick={() => setCanvasBg(bg)}
										className={`h-5 w-5 rounded border-2 transition-all ${
											canvasBg === bg
												? "border-primary scale-110"
												: "border-border"
										}`}
										style={{ background: bg || "var(--background)" }}
										title={index === 0 ? t("common.default") : bg}
									/>
								))}
							</div>
						</div>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Teilen / Speichern oben rechts — wie Excalidraw */}
			<div className="pointer-events-none absolute right-3 top-3 z-50">
				<Button
					size="sm"
					className="pointer-events-auto shadow-md"
					onClick={onSave}
				>
					{t("guestCanvas.share")}
				</Button>
			</div>
		</>
	);
}
