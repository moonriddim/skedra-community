/**
 * Haftnotiz: Modus (Notiz/Checkliste) und Farbe.
 */

import type { StickyNoteMode } from "@/lib/canvas/sticky-note-utils";
import { getStickyColors } from "@/lib/canvas/sticky-note-utils";
import { useI18n } from "@/lib/i18n";
import { ColorGrid, Section } from "./controls";

interface StickyNotePropertiesProps {
	currentMode: StickyNoteMode;
	currentFill: string;
	onModeChange: (mode: StickyNoteMode) => void;
	onFillChange: (color: string) => void;
}

export function StickyNoteProperties({
	currentMode,
	currentFill,
	onModeChange,
	onFillChange,
}: StickyNotePropertiesProps) {
	const { t } = useI18n();
	const stickyColors = getStickyColors();

	return (
		<>
			<Section label={t("canvas.properties.stickyNoteContent")}>
				<div className="flex gap-1">
					{(["note", "checklist"] as const).map((mode) => (
						<button
							key={mode}
							type="button"
							onClick={() => onModeChange(mode)}
							className={`flex-1 rounded border py-1 text-[10px] transition-all cursor-pointer ${
								currentMode === mode
									? "border-primary bg-primary/20 font-semibold"
									: "border-border text-muted-foreground hover:border-muted-foreground"
							}`}
						>
							{mode === "note"
								? t("stickyNotes.modeNote")
								: t("stickyNotes.modeChecklist")}
						</button>
					))}
				</div>
			</Section>

			<Section label={t("canvas.properties.stickyNoteFill")}>
				<ColorGrid
					colors={stickyColors.map((color) => color.value)}
					active={currentFill}
					onSelect={onFillChange}
				/>
			</Section>
		</>
	);
}
