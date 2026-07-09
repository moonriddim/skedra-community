/**
 * Import- und Fehler-Dialoge fuer .skedra-Dateien im Canvas.
 */

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

interface SkedraCanvasFileDialogsProps {
	importDialogOpen: boolean;
	onImportDialogOpenChange: (open: boolean) => void;
	onConfirmImport: () => void;
	fileError: string;
	onClearFileError: () => void;
}

export function SkedraCanvasFileDialogs({
	importDialogOpen,
	onImportDialogOpenChange,
	onConfirmImport,
	fileError,
	onClearFileError,
}: SkedraCanvasFileDialogsProps) {
	const { t } = useI18n();

	return (
		<>
			<Dialog open={importDialogOpen} onOpenChange={onImportDialogOpenChange}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("skedraFile.importConfirmTitle")}</DialogTitle>
						<DialogDescription>
							{t("skedraFile.importConfirmDescription")}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => onImportDialogOpenChange(false)}
						>
							{t("common.cancel")}
						</Button>
						<Button onClick={onConfirmImport}>
							{t("skedraFile.importConfirmAction")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={!!fileError}
				onOpenChange={(open) => !open && onClearFileError()}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("skedraFile.errorTitle")}</DialogTitle>
						<DialogDescription>{fileError}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button onClick={onClearFileError}>{t("common.close")}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
