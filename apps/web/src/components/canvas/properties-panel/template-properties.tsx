/**
 * Vorlagen-Bereich und zugeordnete Haftnotizen.
 */

import type {
	TemplateSectionMeta,
	TemplateStickyNoteMeta,
} from "@/lib/canvas/template-tool-utils";
import { useI18n } from "@/lib/i18n";
import { Plus } from "lucide-react";
import { Section } from "./controls";

interface TemplatePropertiesProps {
	templateSection: TemplateSectionMeta | null;
	templateNoteMeta: TemplateStickyNoteMeta | null;
	isTemplateNoteSelection: boolean;
	selectedCount: number;
	onAddTemplateNote: () => void;
}

export function TemplateProperties({
	templateSection,
	templateNoteMeta,
	isTemplateNoteSelection,
	selectedCount,
	onAddTemplateNote,
}: TemplatePropertiesProps) {
	const { t } = useI18n();

	return (
		<>
			{templateSection && selectedCount === 1 && (
				<>
					<Section label={t("canvas.properties.templateSection")}>
						<div className="rounded border border-border px-2 py-1.5 text-[11px] text-muted-foreground">
							{t(
								`canvas.templateTools.sections.${templateSection.templateTool}.${templateSection.templateSectionId}`,
							)}
						</div>
					</Section>
					<Section label={t("canvas.properties.actions")}>
						<button
							type="button"
							onClick={onAddTemplateNote}
							className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-border hover:border-primary hover:bg-primary/10 transition-all cursor-pointer"
						>
							<Plus className="h-3.5 w-3.5" />
							<span>{t("canvas.templateTools.addNote")}</span>
						</button>
					</Section>
				</>
			)}

			{isTemplateNoteSelection && templateNoteMeta && (
				<Section label={t("canvas.properties.templateNoteType")}>
					<div className="space-y-2">
						<div className="flex items-center gap-2 rounded border border-border px-2 py-1.5">
							<div
								className="h-2.5 w-2.5 rounded-full"
								style={{ backgroundColor: templateNoteMeta.templateAccent }}
							/>
							<span className="text-[11px] font-medium">
								{t(
									`canvas.templateTools.noteTypes.${templateNoteMeta.templateNoteType}`,
								)}
							</span>
						</div>
						<div className="rounded border border-border px-2 py-1.5 text-[11px] text-muted-foreground">
							{t(
								`canvas.templateTools.sections.${templateNoteMeta.templateTool}.${templateNoteMeta.templateSectionId}`,
							)}
						</div>
					</div>
				</Section>
			)}
		</>
	);
}
