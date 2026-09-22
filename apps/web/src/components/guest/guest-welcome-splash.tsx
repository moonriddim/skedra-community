import { BrandLogo } from "@/components/brand/brand-logo";
import { useCanvasStore } from "@/hooks/use-canvas-store";
import { DISCORD_URL } from "@/lib/community-links";
import { useI18n } from "@/lib/i18n";
import { localizePublicPath } from "@/lib/public-path";
import {
	ArrowRight,
	Cloud,
	FolderOpen,
	HelpCircle,
	PenLine,
	StickyNote,
	Users,
} from "lucide-react";
import { Link } from "react-router";
import "./guest-welcome.css";

interface GuestWelcomeSplashProps {
	visible: boolean;
	onSave: () => void;
	onOpenHelp: () => void;
	onOpenLiveCollaboration: () => void;
	onOpenFile: () => void;
	isLoggedIn: boolean;
	managedBilling: boolean;
}

export function GuestWelcomeSplash({
	visible,
	onSave,
	onOpenHelp,
	onOpenLiveCollaboration,
	onOpenFile,
	isLoggedIn,
	managedBilling,
}: GuestWelcomeSplashProps) {
	const { t, locale } = useI18n();
	const setActiveTool = useCanvasStore((state) => state.setActiveTool);
	const setActivePanel = useCanvasStore((state) => state.setActivePanel);
	const publicPath = (path: string) => localizePublicPath(path, locale);
	if (!visible) return null;

	return (
		<div className="pointer-events-none absolute inset-0 z-30">
			<div className="studio-welcome-scroll">
				<section
					className="studio-welcome"
					aria-label={
						locale === "de" ? "Willkommen bei Skedra" : "Welcome to Skedra"
					}
				>
					<BrandLogo markClassName="h-10 w-10" wordmarkClassName="text-2xl" />
					<p className="studio-welcome-kicker">
						{locale === "de"
							? "GROSSE IDEEN FANGEN KLEIN AN."
							: "BIG IDEAS START SMALL."}
					</p>
					<h1>
						{locale === "de" ? "Was geht dir" : "What's on"}
						<br />
						<span>{locale === "de" ? "durch den Kopf?" : "your mind?"}</span>
					</h1>
					<p className="studio-welcome-description">
						{locale === "de"
							? "Eine Idee, ein Plan, ein erster Strich. Hier ist Platz dafür."
							: "An idea, a plan, a first sketch. There's room for it here."}
					</p>
					<div className="studio-start-actions">
						<button type="button" onClick={() => setActiveTool("freehand")}>
							<PenLine />
							<strong>
								{locale === "de" ? "Loszeichnen" : "Start drawing"}
							</strong>
							<span>
								{locale === "de" ? "Einfach anfangen" : "Make your first mark"}
							</span>
							<ArrowRight />
						</button>
						<button type="button" onClick={() => setActivePanel("sticky")}>
							<StickyNote />
							<strong>
								{locale === "de" ? "Ideen sammeln" : "Collect ideas"}
							</strong>
							<span>
								{locale === "de" ? "Mit Sticky Notes" : "With sticky notes"}
							</span>
							<ArrowRight />
						</button>
						<button type="button" onClick={onOpenFile}>
							<FolderOpen />
							<strong>
								{locale === "de" ? "Board öffnen" : "Open a board"}
							</strong>
							<span>
								{locale === "de" ? "Datei importieren" : "Import a file"}
							</span>
							<ArrowRight />
						</button>
					</div>
					<div className="studio-welcome-cloud">
						<div>
							<Cloud />
							<span>
								{locale === "de"
									? "Gemeinsam wird mehr daraus."
									: "Better ideas, together."}
							</span>
						</div>
						<button type="button" onClick={onOpenLiveCollaboration}>
							{locale === "de" ? "Zusammenarbeiten" : "Collaborate"}
							<ArrowRight />
						</button>
					</div>
					<p className="studio-storage-note">
						{t("guestCanvas.storageWarning")}
					</p>
					<nav
						className="studio-welcome-links"
						aria-label={
							locale === "de" ? "Mehr über Skedra" : "More about Skedra"
						}
					>
						<Link to={publicPath("/whiteboard")}>
							{locale === "de" ? "Skedra entdecken" : "Discover Skedra"}
						</Link>
						<button type="button" onClick={onOpenHelp}>
							<HelpCircle />
							{t("guestCanvas.help")}
						</button>
						<button type="button" onClick={onSave}>
							{t("guestCanvas.saveToCloud")}
						</button>
						<a href={DISCORD_URL} target="_blank" rel="noreferrer">
							<Users />
							Community
						</a>
						{!isLoggedIn && (
							<Link
								to={`/login?redirect=${encodeURIComponent(publicPath("/"))}`}
							>
								{t("guestCanvas.signIn")}
							</Link>
						)}
						{!isLoggedIn && (
							<Link to={managedBilling ? publicPath("/pricing") : "/register"}>
								{t("guestCanvas.signUp")}
							</Link>
						)}
					</nav>
					<Link
						className="studio-selfhost"
						to={publicPath("/open-source-whiteboard-self-hosted")}
					>
						{t("guestCanvas.selfHost.title")}
						<ArrowRight />
					</Link>
				</section>
			</div>
		</div>
	);
}
