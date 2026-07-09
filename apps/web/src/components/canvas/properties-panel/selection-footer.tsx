/**
 * Ebenen, Selektions-Aktionen und Canvas-Hintergrund.
 */

import { useCanvasStore } from "@/hooks/use-canvas-store";
import { useI18n } from "@/lib/i18n";
import {
	ArrowDown,
	ArrowUp,
	ChevronsDown,
	ChevronsUp,
	Copy,
	Link,
	Trash2,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { ActionButton, Section } from "./controls";

interface SelectionFooterPropertiesProps {
	hasSelection: boolean;
	selectedIds: Set<string>;
	canvasBgOptions: readonly (string | null)[];
	onBringForward: () => void;
	onSendBackward: () => void;
	onBringToFront: () => void;
	onSendToBack: () => void;
	onCopy: () => void;
	onDeleteElements: (ids: string[]) => void;
	onAddLink: () => void;
}

export function SelectionFooterProperties({
	hasSelection,
	selectedIds,
	canvasBgOptions,
	onBringForward,
	onSendBackward,
	onBringToFront,
	onSendToBack,
	onCopy,
	onDeleteElements,
	onAddLink,
}: SelectionFooterPropertiesProps) {
	const drawingSurface = useCanvasStore(
		useShallow((state) => ({
			canvasBg: state.canvasBg,
			setCanvasBg: state.setCanvasBg,
		})),
	);
	const { t } = useI18n();

	return (
		<>
			{hasSelection && (
				<Section label={t("canvas.properties.layers")}>
					<div className="flex gap-1">
						<ActionButton
							title={t("canvas.contextMenu.sendToBack")}
							onClick={onSendToBack}
						>
							<ChevronsDown className="h-3 w-3" />
						</ActionButton>
						<ActionButton
							title={t("canvas.contextMenu.sendBackward")}
							onClick={onSendBackward}
						>
							<ArrowDown className="h-3 w-3" />
						</ActionButton>
						<ActionButton
							title={t("canvas.contextMenu.bringForward")}
							onClick={onBringForward}
						>
							<ArrowUp className="h-3 w-3" />
						</ActionButton>
						<ActionButton
							title={t("canvas.contextMenu.bringToFront")}
							onClick={onBringToFront}
						>
							<ChevronsUp className="h-3 w-3" />
						</ActionButton>
					</div>
				</Section>
			)}

			{hasSelection && (
				<Section label={t("canvas.properties.actions")}>
					<div className="flex gap-1">
						<ActionButton title={t("canvas.contextMenu.copy")} onClick={onCopy}>
							<Copy className="h-3 w-3" />
						</ActionButton>
						<ActionButton
							title={t("common.delete")}
							onClick={() => onDeleteElements(Array.from(selectedIds))}
							danger
						>
							<Trash2 className="h-3 w-3" />
						</ActionButton>
						<ActionButton
							title={t("canvas.contextMenu.addLink")}
							onClick={onAddLink}
						>
							<Link className="h-3 w-3" />
						</ActionButton>
					</div>
				</Section>
			)}

			<Section label={t("canvas.properties.drawingSurface")}>
				<div className="flex gap-1 flex-wrap">
					{canvasBgOptions.map((bg, i) => (
						<button
							key={bg || "__default"}
							type="button"
							onClick={() => drawingSurface.setCanvasBg(bg ?? "")}
							className={`w-5 h-5 rounded border-2 transition-all cursor-pointer ${
								drawingSurface.canvasBg === bg
									? "border-primary scale-110"
									: "border-border hover:border-muted-foreground"
							}`}
							style={{
								background: bg || "var(--background)",
							}}
							title={i === 0 ? t("common.default") : (bg ?? undefined)}
						/>
					))}
				</div>
			</Section>
		</>
	);
}
