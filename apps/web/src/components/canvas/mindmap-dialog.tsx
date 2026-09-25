import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { getMindmapNodeThemeOptions } from "@/lib/canvas/canvas-factory-defaults";
import { useI18n } from "@/lib/i18n";
import { useThemeStore } from "@/stores/theme";
import {
	type CanvasElement,
	createMindmapFromOutline,
} from "@skedra/canvas-core";
import { nanoid } from "nanoid";
import { useState } from "react";

/** Only shown on request, never as a selection properties panel. */
export function MindmapDialog({
	initialOutline,
	readOnly = false,
	onInsert,
	onClose,
}: {
	initialOutline: string;
	readOnly?: boolean;
	onInsert: (elements: CanvasElement[]) => void;
	onClose: () => void;
}) {
	const { t } = useI18n();
	const theme = {
		resolvedTheme: useThemeStore((state) => state.resolvedTheme),
	};
	const [outline, setOutline] = useState(initialOutline);
	const [error, setError] = useState(false);
	const insert = (elements: CanvasElement[]) => {
		onClose();
		onInsert(elements);
	};
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("mindmapStudio.outline")}</DialogTitle>
					<DialogDescription>
						{t("mindmapStudio.outlineHint")}
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-3 pt-2">
					<textarea
						aria-label={t("mindmapStudio.outline")}
						className="min-h-48 w-full rounded-md border border-border bg-background p-3 font-mono text-sm"
						value={outline}
						onChange={(event) => {
							setOutline(event.target.value);
							setError(false);
						}}
					/>
					{error && (
						<p role="alert" className="text-sm text-destructive">
							{t("mindmapStudio.invalid")}
						</p>
					)}
					<div className="flex flex-wrap gap-2">
						{!readOnly && (
							<Button
								disabled={!outline.trim()}
								onClick={() => {
									try {
										insert(
											createMindmapFromOutline(
												outline,
												nanoid,
												getMindmapNodeThemeOptions(theme),
											),
										);
									} catch {
										setError(true);
									}
								}}
							>
								{t("mindmapStudio.import")}
							</Button>
						)}
						<Button
							variant="outline"
							disabled={!outline.trim()}
							onClick={() => {
								const url = URL.createObjectURL(
									new Blob([outline], { type: "text/plain;charset=utf-8" }),
								);
								const link = document.createElement("a");
								link.href = url;
								link.download = "mindmap.txt";
								link.click();
								setTimeout(() => URL.revokeObjectURL(url), 1000);
							}}
						>
							{t("mindmapStudio.download")}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
