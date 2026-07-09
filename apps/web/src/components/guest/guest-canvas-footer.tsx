import { CanvasFooter } from "@/components/canvas/canvas-footer";
import { GuestHelpArrowHint } from "@/components/guest/guest-onboarding-annotation";
import { useI18n } from "@/lib/i18n";

interface GuestCanvasFooterProps {
	onOpenHelp: () => void;
	/** Nur auf leerer Flaeche: Pfeil-Hinweis zum Hilfe-Button */
	showHelpAnnotation?: boolean;
}

/** Gast-Canvas: Footer mit optionalem Onboarding-Hinweis. */
export function GuestCanvasFooter({
	onOpenHelp,
	showHelpAnnotation = false,
}: GuestCanvasFooterProps) {
	const { t } = useI18n();

	return (
		<CanvasFooter
			onOpenHelp={onOpenHelp}
			encryptionMode="guest"
			annotation={
				showHelpAnnotation ? (
					<GuestHelpArrowHint label={t("guestCanvas.onboarding.helpHint")} />
				) : undefined
			}
		/>
	);
}
