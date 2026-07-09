/**
 * Pfeil-/Pfad-Werkzeuge: Zeichenmodus, Pfeiltyp, Spitzen, Textposition.
 */

import { useI18n } from "@/lib/i18n";
import type { ArrowTextOrientation, ArrowTextSide } from "@skedra/canvas-core";
import type { ArrowHead, ArrowMode, CanvasElement } from "@skedra/canvas-core";
import {
	MAX_ARROW_HEAD_SCALE,
	MIN_ARROW_HEAD_SCALE,
} from "@skedra/canvas-core";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ARROW_HEAD_OPTIONS, ARROW_MODES, PATH_DRAW_MODES } from "./constants";
import { Section } from "./controls";

interface ArrowPropertiesProps {
	showPathDrawMode: boolean;
	isArrowElement: boolean;
	showArrowTextPosition: boolean;
	pathDrawMode: "normal" | "multi";
	currentArrowMode: ArrowMode;
	currentArrowHeadStart: ArrowHead;
	currentArrowHeadEnd: ArrowHead;
	currentArrowHeadScale: number;
	showArrowHeadScale: boolean;
	currentArrowTextSide: ArrowTextSide;
	currentArrowTextOrientation: ArrowTextOrientation;
	onPathDrawModeChange: (mode: "normal" | "multi") => void;
	onPropertyChange: (key: keyof CanvasElement, value: unknown) => void;
	onArrowTextSideChange: (side: ArrowTextSide) => void;
	onArrowTextOrientationChange: (orientation: ArrowTextOrientation) => void;
}

export function ArrowProperties({
	showPathDrawMode,
	isArrowElement,
	showArrowTextPosition,
	pathDrawMode,
	currentArrowMode,
	currentArrowHeadStart,
	currentArrowHeadEnd,
	currentArrowHeadScale,
	showArrowHeadScale,
	currentArrowTextSide,
	currentArrowTextOrientation,
	onPathDrawModeChange,
	onPropertyChange,
	onArrowTextSideChange,
	onArrowTextOrientationChange,
}: ArrowPropertiesProps) {
	const { t } = useI18n();
	const arrowHeadScalePercent = Math.round(currentArrowHeadScale * 100);

	return (
		<>
			{showPathDrawMode && (
				<Section label={t("canvas.properties.pathDrawMode")}>
					<div className="flex gap-1">
						{PATH_DRAW_MODES.map((mode) => (
							<button
								key={mode.value}
								type="button"
								onClick={() => onPathDrawModeChange(mode.value)}
								className={`flex-1 py-1 rounded border transition-all cursor-pointer text-[10px] font-medium ${
									pathDrawMode === mode.value
										? "border-primary bg-primary/20 text-card-foreground"
										: "border-border hover:border-muted-foreground text-muted-foreground"
								}`}
								title={t(`canvas.properties.${mode.labelKey}`)}
							>
								{t(`canvas.properties.${mode.labelKey}`)}
							</button>
						))}
					</div>
				</Section>
			)}

			{isArrowElement && (
				<Section label={t("canvas.properties.arrowType")}>
					<div className="flex gap-1">
						{ARROW_MODES.map((am) => (
							<button
								key={am.value}
								type="button"
								onClick={() => onPropertyChange("arrowMode", am.value)}
								className={`flex-1 py-1 rounded border transition-all cursor-pointer flex items-center justify-center text-card-foreground ${
									currentArrowMode === am.value
										? "border-primary bg-primary/20"
										: "border-border hover:border-muted-foreground"
								}`}
								title={t(`canvas.properties.${am.labelKey}`)}
							>
								{am.icon}
							</button>
						))}
					</div>
				</Section>
			)}

			{isArrowElement && (
				<Section label={t("canvas.properties.arrowHeads")}>
					<div className="flex gap-0.5 items-center mb-1">
						<span className="text-[8px] text-muted-foreground w-7 shrink-0">
							{t("canvas.properties.start")}
						</span>
						<div className="flex gap-1 flex-1">
							{ARROW_HEAD_OPTIONS.map((ah) => (
								<button
									key={ah.value}
									type="button"
									onClick={() => onPropertyChange("arrowHeadStart", ah.value)}
									className={`flex-1 py-1 rounded border transition-all cursor-pointer flex items-center justify-center text-card-foreground ${
										currentArrowHeadStart === ah.value
											? "border-primary bg-primary/20"
											: "border-border hover:border-muted-foreground"
									}`}
									title={
										ah.labelKey === "none"
											? t("common.none")
											: t(`canvas.properties.${ah.labelKey}`)
									}
								>
									{ah.icon}
								</button>
							))}
						</div>
					</div>
					<div className="flex gap-0.5 items-center">
						<span className="text-[8px] text-muted-foreground w-7 shrink-0">
							{t("canvas.properties.end")}
						</span>
						<div className="flex gap-1 flex-1">
							{ARROW_HEAD_OPTIONS.map((ah) => (
								<button
									key={ah.value}
									type="button"
									onClick={() => onPropertyChange("arrowHeadEnd", ah.value)}
									className={`flex-1 py-1 rounded border transition-all cursor-pointer flex items-center justify-center text-card-foreground ${
										currentArrowHeadEnd === ah.value
											? "border-primary bg-primary/20"
											: "border-border hover:border-muted-foreground"
									}`}
									title={
										ah.labelKey === "none"
											? t("common.none")
											: t(`canvas.properties.${ah.labelKey}`)
									}
								>
									{ah.icon}
								</button>
							))}
						</div>
					</div>
					{showArrowHeadScale && (
						<div className="mt-2">
							<p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
								{t("canvas.properties.arrowHeadSize", {
									value: arrowHeadScalePercent,
								})}
							</p>
							<input
								type="range"
								min={Math.round(MIN_ARROW_HEAD_SCALE * 100)}
								max={Math.round(MAX_ARROW_HEAD_SCALE * 100)}
								step={5}
								value={arrowHeadScalePercent}
								onChange={(e) =>
									onPropertyChange(
										"arrowHeadScale",
										Number(e.target.value) / 100,
									)
								}
								className="w-full h-1 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
							/>
						</div>
					)}
				</Section>
			)}

			{showArrowTextPosition && (
				<Section label={t("canvas.properties.arrowTextPosition")}>
					<div className="flex gap-1">
						<button
							type="button"
							onPointerDown={(e) => e.stopPropagation()}
							onClick={() => onArrowTextSideChange("above")}
							className={`flex-1 py-1 rounded border transition-all cursor-pointer flex items-center justify-center gap-1 ${
								currentArrowTextSide === "above"
									? "border-primary bg-primary/20 text-card-foreground"
									: "border-border hover:border-muted-foreground text-muted-foreground"
							}`}
							title={t("canvas.properties.textAbove")}
						>
							<ArrowUp className="h-3.5 w-3.5" />
							<span className="text-[10px] font-medium">
								{t("canvas.properties.top")}
							</span>
						</button>
						<button
							type="button"
							onPointerDown={(e) => e.stopPropagation()}
							onClick={() => onArrowTextSideChange("below")}
							className={`flex-1 py-1 rounded border transition-all cursor-pointer flex items-center justify-center gap-1 ${
								currentArrowTextSide === "below"
									? "border-primary bg-primary/20 text-card-foreground"
									: "border-border hover:border-muted-foreground text-muted-foreground"
							}`}
							title={t("canvas.properties.textBelow")}
						>
							<ArrowDown className="h-3.5 w-3.5" />
							<span className="text-[10px] font-medium">
								{t("canvas.properties.bottom")}
							</span>
						</button>
					</div>
					<p className="mt-2 mb-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
						{t("canvas.properties.arrowTextOrientation")}
					</p>
					<div className="flex gap-1">
						<button
							type="button"
							onPointerDown={(e) => e.stopPropagation()}
							onClick={() => onArrowTextOrientationChange("horizontal")}
							className={`flex-1 py-1 rounded border transition-all cursor-pointer flex items-center justify-center ${
								currentArrowTextOrientation === "horizontal"
									? "border-primary bg-primary/20 text-card-foreground"
									: "border-border hover:border-muted-foreground text-muted-foreground"
							}`}
							title={t("canvas.properties.textHorizontal")}
						>
							<span className="text-[11px] font-semibold tracking-wide">
								Aa
							</span>
						</button>
						<button
							type="button"
							onPointerDown={(e) => e.stopPropagation()}
							onClick={() => onArrowTextOrientationChange("vertical")}
							className={`flex-1 py-1 rounded border transition-all cursor-pointer flex items-center justify-center ${
								currentArrowTextOrientation === "vertical"
									? "border-primary bg-primary/20 text-card-foreground"
									: "border-border hover:border-muted-foreground text-muted-foreground"
							}`}
							title={t("canvas.properties.textVertical")}
						>
							<span
								className="text-[11px] font-semibold leading-none"
								style={{ writingMode: "vertical-rl" }}
							>
								Aa
							</span>
						</button>
					</div>
				</Section>
			)}
		</>
	);
}
