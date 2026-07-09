import { Bold, Italic, Underline } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { FONT_FAMILIES, FONT_SIZES, TEXT_ALIGNS } from "./constants";
import { ColorGrid, FontDropdown, Section } from "./controls";

interface TextStyleSectionProps {
	strokeColors: string[];
	currentTextColor: string;
	currentFontFamily: string;
	currentFontSize: number;
	currentTextAlign: "left" | "center" | "right";
	currentFontWeight: string;
	currentFontStyle: string;
	currentTextDecoration: string;
	textColorLabel: string;
	onTextColorChange: (color: string) => void;
	onFontFamilyChange: (fontFamily: string) => void;
	onFontSizeChange: (fontSize: number) => void;
	onTextAlignChange: (textAlign: "left" | "center" | "right") => void;
	onFontWeightChange: (fontWeight: string) => void;
	onFontStyleChange: (fontStyle: string) => void;
	onTextDecorationChange: (textDecoration: string) => void;
}

export function TextStyleSection({
	strokeColors,
	currentTextColor,
	currentFontFamily,
	currentFontSize,
	currentTextAlign,
	currentFontWeight,
	currentFontStyle,
	currentTextDecoration,
	textColorLabel,
	onTextColorChange,
	onFontFamilyChange,
	onFontSizeChange,
	onTextAlignChange,
	onFontWeightChange,
	onFontStyleChange,
	onTextDecorationChange,
}: TextStyleSectionProps) {
	const { t } = useI18n();

	return (
		<>
			<Section label={textColorLabel}>
				<ColorGrid
					colors={strokeColors}
					active={currentTextColor}
					onSelect={onTextColorChange}
				/>
			</Section>

			<Section label={t("canvas.properties.fontFamily")}>
				<FontDropdown
					fonts={FONT_FAMILIES}
					value={currentFontFamily}
					onChange={onFontFamilyChange}
				/>
			</Section>

			<Section label={t("canvas.properties.style")}>
				<div className="flex gap-1">
					<button
						type="button"
						onClick={() =>
							onFontWeightChange(
								currentFontWeight === "bold" ? "normal" : "bold",
							)
						}
						className={`flex flex-1 cursor-pointer items-center justify-center rounded border py-1 transition-all ${
							currentFontWeight === "bold"
								? "border-primary bg-primary/20 text-card-foreground"
								: "border-border text-muted-foreground hover:border-muted-foreground"
						}`}
						title={t("canvas.properties.bold")}
					>
						<Bold className="h-3.5 w-3.5" />
					</button>
					<button
						type="button"
						onClick={() =>
							onFontStyleChange(
								currentFontStyle === "italic" ? "normal" : "italic",
							)
						}
						className={`flex flex-1 cursor-pointer items-center justify-center rounded border py-1 transition-all ${
							currentFontStyle === "italic"
								? "border-primary bg-primary/20 text-card-foreground"
								: "border-border text-muted-foreground hover:border-muted-foreground"
						}`}
						title={t("canvas.properties.italic")}
					>
						<Italic className="h-3.5 w-3.5" />
					</button>
					<button
						type="button"
						onClick={() =>
							onTextDecorationChange(
								currentTextDecoration === "underline" ? "none" : "underline",
							)
						}
						className={`flex flex-1 cursor-pointer items-center justify-center rounded border py-1 transition-all ${
							currentTextDecoration === "underline"
								? "border-primary bg-primary/20 text-card-foreground"
								: "border-border text-muted-foreground hover:border-muted-foreground"
						}`}
						title={t("canvas.properties.underline")}
					>
						<Underline className="h-3.5 w-3.5" />
					</button>
				</div>
			</Section>

			<Section label={t("canvas.properties.size")}>
				<div className="flex gap-1">
					{FONT_SIZES.map((fontSize) => (
						<button
							key={fontSize.value}
							type="button"
							onClick={() => onFontSizeChange(fontSize.value)}
							className={`flex-1 cursor-pointer rounded border py-1 font-medium text-[10px] transition-all ${
								currentFontSize === fontSize.value
									? "border-primary bg-primary/20 text-card-foreground"
									: "border-border text-muted-foreground hover:border-muted-foreground"
							}`}
						>
							{fontSize.label}
						</button>
					))}
				</div>
			</Section>

			<Section label={t("canvas.properties.alignment")}>
				<div className="flex gap-1">
					{TEXT_ALIGNS.map((textAlign) => (
						<button
							key={textAlign.value}
							type="button"
							onClick={() => onTextAlignChange(textAlign.value)}
							className={`flex flex-1 cursor-pointer items-center justify-center rounded border py-1 transition-all ${
								currentTextAlign === textAlign.value
									? "border-primary bg-primary/20 text-card-foreground"
									: "border-border text-muted-foreground hover:border-muted-foreground"
							}`}
							title={t(`canvas.properties.${textAlign.labelKey}`)}
						>
							{textAlign.icon}
						</button>
					))}
				</div>
			</Section>
		</>
	);
}
