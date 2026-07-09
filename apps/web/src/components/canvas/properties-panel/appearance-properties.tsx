/**
 * Strich, Fuellung, Groesse, Deckkraft und Form-Optionen.
 */

import type { TemplateSectionMeta } from "@/lib/canvas/template-tool-utils";
import { useI18n } from "@/lib/i18n";
import type {
	CanvasElement,
	RoughFillStyle,
	StrokeStyle,
} from "@skedra/canvas-core";
import {
	MAX_ROUGH_FILL_SCALE,
	MIN_ROUGH_FILL_SCALE,
} from "@skedra/canvas-core";
import {
	BG_COLORS,
	CORNER_RADIUS_PRESETS,
	ROUGHNESS_LEVELS,
	ROUGH_FILL_STYLES,
	STROKE_STYLES,
	STROKE_WIDTHS,
} from "./constants";
import { ColorGrid, DimensionInput, Section } from "./controls";

interface AppearancePropertiesProps {
	showStroke: boolean;
	isTextOnly: boolean;
	mindmapBranchRoot: CanvasElement | null;
	selectedTemplateSection: TemplateSectionMeta | null;
	currentStroke: string;
	showBackgroundFill: boolean;
	currentFill: string;
	showGeometryFill: boolean;
	currentRoughFillStyle: RoughFillStyle;
	showRoughFillScale: boolean;
	roughFillScalePercent: number;
	showStrokeWidth: boolean;
	currentStrokeWidth: number;
	showStrokeStyle: boolean;
	currentStrokeStyle: StrokeStyle;
	showRoughness: boolean;
	currentRoughness: number;
	showCornerRadius: boolean;
	currentCornerRadiusPercent: number;
	cornerRadiusWidth: number;
	cornerRadiusHeight: number;
	isCornerPresetActive: (percent: number) => boolean;
	showDimensions: boolean;
	singleGeometryElement: CanvasElement | null;
	geometryPresetTool: "rectangle" | "ellipse" | "diamond" | null;
	currentShapeWidth: number;
	currentShapeHeight: number;
	ellipseDiameter: number;
	currentOpacity: number;
	strokeColors: string[];
	onPropertyChange: (key: keyof CanvasElement, value: unknown) => void;
	onSetSingleGeometryWidth: (value: number) => void;
	onSetSingleGeometryHeight: (value: number) => void;
	onSetPerfectCircleDiameter: (value: number) => void;
	onStartPresetGeometryPlacement: () => void;
}

export function AppearanceProperties({
	showStroke,
	isTextOnly,
	mindmapBranchRoot,
	selectedTemplateSection,
	currentStroke,
	showBackgroundFill,
	currentFill,
	showGeometryFill,
	currentRoughFillStyle,
	showRoughFillScale,
	roughFillScalePercent,
	showStrokeWidth,
	currentStrokeWidth,
	showStrokeStyle,
	currentStrokeStyle,
	showRoughness,
	currentRoughness,
	showCornerRadius,
	currentCornerRadiusPercent,
	cornerRadiusWidth,
	cornerRadiusHeight,
	isCornerPresetActive,
	showDimensions,
	singleGeometryElement,
	geometryPresetTool,
	currentShapeWidth,
	currentShapeHeight,
	ellipseDiameter,
	currentOpacity,
	strokeColors,
	onPropertyChange,
	onSetSingleGeometryWidth,
	onSetSingleGeometryHeight,
	onSetPerfectCircleDiameter,
	onStartPresetGeometryPlacement,
}: AppearancePropertiesProps) {
	const { t } = useI18n();

	return (
		<>
			{showStroke && (
				<div data-property-focus="stroke">
					<Section
						label={
							isTextOnly
								? t("canvas.properties.color")
								: mindmapBranchRoot
									? t("canvas.properties.branchColor")
									: selectedTemplateSection
										? t("canvas.properties.templateSection")
										: t("canvas.properties.stroke")
						}
					>
						<ColorGrid
							colors={strokeColors}
							active={currentStroke}
							onSelect={(c) => onPropertyChange("stroke", c)}
						/>
					</Section>
				</div>
			)}

			{showBackgroundFill && (
				<div data-property-focus="fill">
					<Section
						label={
							selectedTemplateSection
								? t("canvas.properties.stickyNoteFill")
								: t("canvas.properties.background")
						}
					>
						<ColorGrid
							colors={BG_COLORS}
							active={currentFill}
							onSelect={(c) => onPropertyChange("fill", c)}
						/>
					</Section>
				</div>
			)}

			{showGeometryFill && (
				<div data-property-focus="fill">
					<Section label={t("canvas.properties.roughFillStyle")}>
						<ColorGrid
							colors={BG_COLORS}
							active={currentFill}
							onSelect={(c) => onPropertyChange("fill", c)}
						/>
						<p className="mt-2 mb-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
							{t("canvas.properties.fillPattern")}
						</p>
						<div className="flex gap-1 flex-wrap">
							{ROUGH_FILL_STYLES.map((fs) => (
								<button
									key={fs.value}
									type="button"
									onClick={() => onPropertyChange("roughFillStyle", fs.value)}
									className={`flex-1 min-w-[2.5rem] py-1 rounded border transition-all cursor-pointer flex items-center justify-center text-card-foreground ${
										currentRoughFillStyle === fs.value
											? "border-primary bg-primary/20"
											: "border-border hover:border-muted-foreground"
									}`}
									title={t(`canvas.properties.${fs.labelKey}`)}
								>
									{fs.preview}
								</button>
							))}
						</div>
						{showRoughFillScale && (
							<div className="mt-2">
								<p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
									{t("canvas.properties.roughFillScale", {
										value: roughFillScalePercent,
									})}
								</p>
								<input
									type="range"
									min={Math.round(MIN_ROUGH_FILL_SCALE * 100)}
									max={Math.round(MAX_ROUGH_FILL_SCALE * 100)}
									step={5}
									value={roughFillScalePercent}
									onChange={(e) =>
										onPropertyChange(
											"roughFillScale",
											Number(e.target.value) / 100,
										)
									}
									className="w-full h-1 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
								/>
							</div>
						)}
					</Section>
				</div>
			)}

			{showStrokeWidth && (
				<Section label={t("canvas.properties.strokeWidth")}>
					<div className="flex gap-1">
						{STROKE_WIDTHS.map((sw) => (
							<button
								key={sw.value}
								type="button"
								onClick={() => onPropertyChange("strokeWidth", sw.value)}
								className={`flex-1 py-1 rounded border transition-all cursor-pointer flex items-center justify-center ${
									currentStrokeWidth === sw.value
										? "border-primary bg-primary/20"
										: "border-border hover:border-muted-foreground"
								}`}
								title={t(`canvas.properties.${sw.labelKey}`)}
							>
								<div
									className="rounded-full bg-card-foreground"
									style={{ width: sw.value * 5 + 6, height: sw.value + 1 }}
								/>
							</button>
						))}
					</div>
				</Section>
			)}

			{showStrokeStyle && (
				<Section label={t("canvas.properties.strokeStyle")}>
					<div className="flex gap-1">
						{STROKE_STYLES.map((ss) => (
							<button
								key={ss.value}
								type="button"
								onClick={() => onPropertyChange("strokeStyle", ss.value)}
								className={`flex-1 py-1 rounded border transition-all cursor-pointer flex items-center justify-center text-card-foreground ${
									currentStrokeStyle === ss.value
										? "border-primary bg-primary/20"
										: "border-border hover:border-muted-foreground"
								}`}
								title={t(`canvas.properties.${ss.labelKey}`)}
							>
								{ss.preview}
							</button>
						))}
					</div>
				</Section>
			)}

			{showRoughness && (
				<Section label={t("canvas.properties.roughness")}>
					<div className="flex gap-1">
						{ROUGHNESS_LEVELS.map((rl) => (
							<button
								key={rl.value}
								type="button"
								onClick={() => onPropertyChange("roughness", rl.value)}
								className={`flex-1 py-1 rounded border transition-all cursor-pointer flex items-center justify-center text-card-foreground ${
									currentRoughness === rl.value
										? "border-primary bg-primary/20"
										: "border-border hover:border-muted-foreground"
								}`}
								title={t(`canvas.properties.${rl.labelKey}`)}
							>
								{rl.icon}
							</button>
						))}
					</div>
				</Section>
			)}

			{showCornerRadius && (
				<Section
					label={t("canvas.properties.cornersWithPercent", {
						value: currentCornerRadiusPercent,
					})}
				>
					<div className="flex gap-1">
						{CORNER_RADIUS_PRESETS.map((cr) => (
							<button
								key={cr.percent}
								type="button"
								onClick={() =>
									onPropertyChange("cornerRadiusPercent", cr.percent)
								}
								className={`flex-1 min-w-[2rem] py-1 rounded border transition-all cursor-pointer flex items-center justify-center ${
									isCornerPresetActive(cr.percent)
										? "border-primary bg-primary/20"
										: "border-border hover:border-muted-foreground"
								}`}
								title={t(`canvas.properties.${cr.labelKey}`)}
							>
								<div
									className="w-3.5 h-3.5 border-2 border-card-foreground/60"
									style={{
										borderRadius:
											cr.percent === 0
												? 0
												: cr.percent >= 100
													? "50%"
													: `${cr.percent}%`,
									}}
								/>
							</button>
						))}
					</div>
					<input
						type="range"
						min={0}
						max={100}
						step={1}
						value={currentCornerRadiusPercent}
						onChange={(e) =>
							onPropertyChange("cornerRadiusPercent", Number(e.target.value))
						}
						className="mt-2 w-full h-1 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
					/>
					<div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground uppercase tracking-wider">
						<span>{t("canvas.properties.square")}</span>
						<span>
							{t("canvas.properties.cornerRadiusDetail", {
								percent: currentCornerRadiusPercent,
								px: Math.round(
									(currentCornerRadiusPercent / 100) *
										(Math.min(cornerRadiusWidth, cornerRadiusHeight) / 2),
								),
							})}
						</span>
						<span>{t("canvas.properties.pill")}</span>
					</div>
				</Section>
			)}

			{showDimensions && (singleGeometryElement || geometryPresetTool) && (
				<Section label={t("canvas.properties.dimensions")}>
					<div className="grid grid-cols-2 gap-1">
						<DimensionInput
							label={t("canvas.properties.width")}
							value={currentShapeWidth}
							onCommit={onSetSingleGeometryWidth}
						/>
						<DimensionInput
							label={t("canvas.properties.height")}
							value={currentShapeHeight}
							onCommit={onSetSingleGeometryHeight}
						/>
					</div>

					{(singleGeometryElement?.type === "ellipse" ||
						geometryPresetTool === "ellipse") && (
						<div className="mt-1.5 space-y-1">
							<DimensionInput
								label={t("canvas.properties.diameter")}
								value={ellipseDiameter}
								onCommit={onSetPerfectCircleDiameter}
							/>
						</div>
					)}

					{geometryPresetTool && (
						<button
							type="button"
							onClick={onStartPresetGeometryPlacement}
							className="mt-1.5 w-full rounded border border-border px-2 py-1.5 text-[10px] font-medium text-card-foreground transition-all hover:border-primary hover:bg-primary/10 cursor-pointer"
						>
							{geometryPresetTool === "ellipse"
								? t("canvas.properties.placeCircleCentered")
								: t("canvas.properties.placeShapeCentered")}
						</button>
					)}
				</Section>
			)}

			<Section
				label={t("canvas.properties.opacity", { value: currentOpacity })}
			>
				<input
					type="range"
					min={0}
					max={100}
					value={currentOpacity}
					onChange={(e) => onPropertyChange("opacity", Number(e.target.value))}
					className="w-full h-1 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
				/>
			</Section>
		</>
	);
}
