import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import { HelpCircle, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

type CanvasFooterEncryptionMode = "guest" | "cloud" | "local";

interface CanvasFooterProps {
	onOpenHelp: () => void;
	/** Welcher Verschlüsselungs-Hinweis im Tooltip erscheint */
	encryptionMode?: CanvasFooterEncryptionMode;
	/** Optionaler Hinweis oberhalb der Buttons (z. B. Gast-Onboarding-Pfeil) */
	annotation?: ReactNode;
}

function encryptionKeys(mode: CanvasFooterEncryptionMode) {
	if (mode === "guest") {
		return {
			label: "guestCanvas.encryption.label",
			title: "guestCanvas.encryption.title",
			description: "guestCanvas.encryption.description",
			help: "guestCanvas.help",
		} as const;
	}
	if (mode === "local") {
		return {
			label: "canvas.footer.encryption.label",
			title: "canvas.footer.encryption.localTitle",
			description: "canvas.footer.encryption.localDescription",
			help: "canvas.footer.help",
		} as const;
	}
	return {
		label: "canvas.footer.encryption.label",
		title: "canvas.footer.encryption.title",
		description: "canvas.footer.encryption.description",
		help: "canvas.footer.help",
	} as const;
}

/** Unten rechts: Verschlüsselungs-Hinweis und Hilfe (Gast- und Board-Canvas). */
export function CanvasFooter({
	onOpenHelp,
	encryptionMode = "cloud",
	annotation,
}: CanvasFooterProps) {
	const { t } = useI18n();
	const keys = encryptionKeys(encryptionMode);

	return (
		<TooltipProvider delayDuration={200}>
			<div className="pointer-events-none absolute bottom-4 right-4 z-50 flex flex-col items-end gap-2">
				{annotation}

				<div className="pointer-events-auto flex items-center gap-1.5">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-9 w-9 rounded-lg border border-border/60 bg-card/80 text-primary shadow-sm backdrop-blur-md"
								aria-label={t(keys.label)}
							>
								<ShieldCheck className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent
							side="top"
							align="end"
							className="max-w-xs text-left leading-relaxed"
						>
							<p className="font-medium">{t(keys.title)}</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{t(keys.description)}
							</p>
						</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-9 w-9 rounded-lg border border-border/60 bg-card/80 shadow-sm backdrop-blur-md"
								onClick={onOpenHelp}
								aria-label={t(keys.help)}
							>
								<HelpCircle className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="top" align="end">
							{t(keys.help)}
						</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</TooltipProvider>
	);
}
