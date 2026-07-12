import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { LogIn, Play, UserPlus } from "lucide-react";
import { Link } from "react-router";

interface GuestLiveCollaborationDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isLoggedIn: boolean;
	managedBilling: boolean;
	onStartSession: () => void;
}

/** Excalidraw-aehnlicher Dialog fuer Live-Zusammenarbeit (Account erforderlich). */
export function GuestLiveCollaborationDialog({
	open,
	onOpenChange,
	isLoggedIn,
	managedBilling,
	onStartSession,
}: GuestLiveCollaborationDialogProps) {
	const { t } = useI18n();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader className="text-center sm:text-center">
					<DialogTitle className="font-display text-2xl text-primary">
						{t("guestCanvas.liveCollaboration.title")}
					</DialogTitle>
					<DialogDescription className="text-sm leading-relaxed">
						{t("guestCanvas.liveCollaboration.description")}
					</DialogDescription>
					<p className="text-xs text-muted-foreground">
						{t("guestCanvas.liveCollaboration.privacy")}
					</p>
				</DialogHeader>

				{isLoggedIn ? (
					<DialogFooter className="sm:justify-center">
						<Button className="w-full gap-2 sm:w-auto" onClick={onStartSession}>
							<Play className="h-4 w-4 fill-current" />
							{t("guestCanvas.liveCollaboration.startSession")}
						</Button>
					</DialogFooter>
				) : (
					<div className="space-y-3">
						<p className="text-center text-sm text-muted-foreground">
							{t("guestCanvas.liveCollaboration.accountRequired")}
						</p>
						<div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
							<Button asChild variant="default" className="gap-2">
								<Link
									to={`${managedBilling ? "/subscribe" : "/register"}?redirect=${encodeURIComponent("/?collab=1")}`}
								>
									<UserPlus className="h-4 w-4" />
									{t("guestCanvas.signUp")}
								</Link>
							</Button>
							<Button asChild variant="outline" className="gap-2">
								<Link
									to={`${managedBilling ? "/subscribe" : "/login"}?redirect=${encodeURIComponent("/?collab=1")}`}
								>
									<LogIn className="h-4 w-4" />
									{t("guestCanvas.signIn")}
								</Link>
							</Button>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
