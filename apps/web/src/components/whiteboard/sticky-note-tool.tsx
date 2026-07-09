import { getStickyColors } from "@/lib/canvas/sticky-note-utils";
import { useI18n } from "@/lib/i18n";
import { X } from "lucide-react";

interface StickyNoteToolProps {
	onPlaceStickyNote: (
		color: string,
		pointer: { clientX: number; clientY: number },
	) => void;
	onClose: () => void;
}

export function StickyNoteTool({
	onPlaceStickyNote,
	onClose,
}: StickyNoteToolProps) {
	const { t } = useI18n();
	const stickyColors = getStickyColors();

	const handlePickColor = (
		color: string,
		event: React.MouseEvent<HTMLButtonElement>,
	) => {
		onPlaceStickyNote(color, {
			clientX: event.clientX,
			clientY: event.clientY,
		});
	};

	return (
		<div className="absolute top-14 right-4 z-40 w-56 rounded-xl border border-border bg-card/95 p-3 text-card-foreground shadow-xl backdrop-blur">
			<div className="mb-2 flex items-center justify-between">
				<h3 className="text-sm font-semibold text-card-foreground">
					{t("stickyNotes.title")}
				</h3>
				<button
					type="button"
					onClick={onClose}
					className="cursor-pointer text-muted-foreground hover:text-foreground"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
			<p className="mb-3 text-xs text-muted-foreground">
				{t("stickyNotes.description")}
			</p>
			<div className="grid grid-cols-3 gap-2">
				{stickyColors.map((color) => (
					<button
						key={color.value}
						type="button"
						onClick={(event) => handlePickColor(color.value, event)}
						className="group flex cursor-pointer flex-col items-center gap-1 rounded-lg p-2 transition-colors hover:bg-accent"
						title={color.name}
					>
						<div
							className="h-10 w-10 rounded-md border border-black/10 shadow-sm transition-transform group-hover:scale-110"
							style={{ backgroundColor: color.value }}
						/>
						<span className="text-[10px] text-muted-foreground">
							{color.name}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}
