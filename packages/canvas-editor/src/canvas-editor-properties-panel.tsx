import type { CanvasElement, CanvasPathDrawMode } from "@skedra/canvas-core";
import type { CSSProperties } from "react";
import { useOptionalCanvasEditorServices } from "./canvas-editor";
import {
	CanvasEditorClassicPropertiesPanel,
	type CanvasEditorClassicPropertiesView,
	type CanvasEditorPropertiesTranslate,
} from "./canvas-editor-classic-properties-panel";
import {
	CANVAS_PATH_MODE_OPTIONS,
	resolveCanvasEditorPathMode,
} from "./path-editor-controller";

export type CanvasEditorAlignment =
	| "top"
	| "bottom"
	| "left"
	| "right"
	| "horizontal-center"
	| "vertical-center";
export type CanvasEditorDistribution = "horizontal" | "vertical";
export type CanvasEditorLayerCommand =
	| "bring-forward"
	| "send-backward"
	| "bring-to-front"
	| "send-to-back";
export interface CanvasEditorFlowchartStepOptions {
	branch?: "next" | "yes" | "no";
	route?: "up" | "right" | "down" | "left" | "left-up";
	nodeKind?: "start" | "step" | "decision" | "end";
	label?: string;
}
export interface CanvasEditorKanbanCardDetails {
	title?: string;
	description?: string;
	priority?: "low" | "medium" | "high" | "urgent" | null;
	startDate?: string | null;
	dueDate?: string | null;
	assigneeId?: string | null;
	assigneeName?: string | null;
	roleId?: string | null;
	roleName?: string | null;
	groupId?: string | null;
	groupName?: string | null;
	checklist?: Array<{ id: string; text: string; completed: boolean }>;
	attachments?: Array<{
		id: string;
		src: string;
		name: string;
		width: number;
		height: number;
	}>;
	coverImage?: {
		id: string;
		src: string;
		name: string;
		width: number;
		height: number;
	} | null;
}

export interface CanvasEditorPropertiesPanelProps {
	selected: CanvasElement[];
	mode?: "selection" | "defaults";
	readOnly?: boolean;
	className?: string;
	style?: CSSProperties;
	ariaLabel?: string;
	translate?: CanvasEditorPropertiesTranslate;
	classicView?: CanvasEditorClassicPropertiesView;
	canvasBackground?: {
		value: string;
		options: readonly string[];
		onChange: (value: string) => void;
	};
	pathDrawMode?: CanvasPathDrawMode;
	onPathDrawModeChange?: (mode: CanvasPathDrawMode) => void;
	onSetProperties: (properties: Partial<CanvasElement>) => void;
	onSetGeometryWidth?: (width: number) => void;
	onSetGeometryHeight?: (height: number) => void;
	onSetEllipseDiameter?: (diameter: number) => void;
	onPlaceDefaultElement?: () => void;
	onDelete: () => void;
	onGroup: () => void;
	onUngroup: () => void;
	onAlign: (alignment: CanvasEditorAlignment) => void;
	onDistribute: (axis: CanvasEditorDistribution) => void;
	onLayer: (command: CanvasEditorLayerCommand) => void;
	onFlip: (axis: "horizontal" | "vertical") => void;
	onLock: (locked?: boolean) => void;
	onCropImage: (
		id: string,
		crop: { x: number; y: number; width: number; height: number },
	) => void;
	onStartImageCrop?: (id: string) => void;
	onAddFlowchartStep: (
		nodeId: string,
		options?: CanvasEditorFlowchartStepOptions,
	) => void;
	onSetFlowchartNodeKind: (
		nodeId: string,
		kind: "start" | "step" | "decision" | "end",
	) => void;
	flowchartInsertKind?: "start" | "step" | "decision" | "end";
	onFlowchartInsertKindChange?: (
		kind: "start" | "step" | "decision" | "end",
	) => void;
	onAddFlowchartNodeOnSide?: (
		route: "up" | "right" | "down" | "left",
		options?: { branch?: "next" | "yes" | "no"; label?: string },
	) => void;
	onEditFlowchartNodeText?: () => void;
	onEditFlowchartConnectorLabel?: () => void;
	onSetFlowchartConnectorLabel?: (label: string | undefined) => void;
	onUpdateKanbanCard: (
		cardId: string,
		details: CanvasEditorKanbanCardDetails,
	) => void;
	onUpdateKanbanList: (
		listId: string,
		details: { name?: string; description?: string; wipLimit?: number | null },
	) => void;
	onOpenKanbanCard?: (cardId: string) => void;
	onOpenKanbanList?: (listId: string) => void;
	onAddKanbanCard?: (listId: string) => void;
	onAddTemplateSticky?: (sectionId: string) => void;
	onCopy?: () => void;
}

export function CanvasEditorPropertiesPanel({
	selected,
	mode = "selection",
	readOnly = false,
	className,
	style,
	ariaLabel = "Canvas properties",
	translate,
	classicView,
	canvasBackground,
	pathDrawMode,
	onPathDrawModeChange,
	onSetProperties,
	onSetGeometryWidth,
	onSetGeometryHeight,
	onSetEllipseDiameter,
	onPlaceDefaultElement,
	onDelete,
	onGroup,
	onUngroup,
	onAlign,
	onDistribute,
	onLayer,
	onFlip,
	onLock,
	onCropImage,
	onStartImageCrop,
	onAddFlowchartStep,
	onSetFlowchartNodeKind,
	flowchartInsertKind = "step",
	onFlowchartInsertKindChange,
	onAddFlowchartNodeOnSide,
	onEditFlowchartNodeText,
	onEditFlowchartConnectorLabel,
	onSetFlowchartConnectorLabel,
	onUpdateKanbanCard,
	onUpdateKanbanList,
	onOpenKanbanCard,
	onOpenKanbanList,
	onAddKanbanCard,
	onAddTemplateSticky,
	onCopy,
}: CanvasEditorPropertiesPanelProps) {
	const services = useOptionalCanvasEditorServices();
	if (selected.length === 0) return null;
	const element = selected[0];
	const defaultsMode = mode === "defaults";
	const disabled = readOnly;
	const t =
		translate ??
		services?.translations?.translate ??
		((_key, fallback) => fallback);
	if (classicView) {
		return (
			<CanvasEditorClassicPropertiesPanel
				view={classicView}
				className={className}
				style={style}
				ariaLabel={
					ariaLabel === "Canvas properties"
						? t("canvas.properties.ariaLabel", ariaLabel)
						: ariaLabel
				}
				disabled={disabled}
				translate={t}
			/>
		);
	}
	const custom = element.customData ?? {};
	const isFlowchart = custom.skedraType === "flowchart-node";
	const isFlowchartConnector = custom.skedraType === "flowchart-connector";
	const isKanbanCard = custom.skedraType === "kanban-card";
	const isKanbanList = custom.skedraType === "kanban-list";
	const isTemplateSection = custom.skedraType === "template-section";
	const crop =
		element.type === "image" &&
		custom.imageCrop &&
		typeof custom.imageCrop === "object"
			? (custom.imageCrop as Partial<{
					x: number;
					y: number;
					width: number;
					height: number;
				}>)
			: { x: 0, y: 0, width: 1, height: 1 };
	const updateCrop = (key: "x" | "y" | "width" | "height", value: number) => {
		onCropImage(element.id, {
			x: crop.x ?? 0,
			y: crop.y ?? 0,
			width: crop.width ?? 1,
			height: crop.height ?? 1,
			[key]: value,
		});
	};
	const numberValue = (value: number | undefined, fallback: number) =>
		Number.isFinite(value) ? value : fallback;

	return (
		<aside
			className={[
				"canvas-editor__properties",
				"skedra-sdk__properties",
				className,
			]
				.filter(Boolean)
				.join(" ")}
			style={style}
			aria-label={
				ariaLabel === "Canvas properties"
					? t("canvas.properties.ariaLabel", ariaLabel)
					: ariaLabel
			}
		>
			<header className="skedra-sdk__properties-header">
				<div>
					<strong>
						{defaultsMode
							? t("canvas.properties.defaults", `${element.type} defaults`)
							: selected.length === 1
								? element.type
								: t(
										"canvas.properties.elementCount",
										`${selected.length} elements`,
									)}
					</strong>
					{!defaultsMode && (
						<small>
							{selected.length === 1
								? element.id
								: t(
										"canvas.properties.multipleSelection",
										"Multiple selection",
									)}
						</small>
					)}
				</div>
				{!defaultsMode && (
					<button type="button" disabled={disabled} onClick={onDelete}>
						{t("canvas.properties.delete", "Delete")}
					</button>
				)}
			</header>

			{canvasBackground && (
				<section>
					<h3>{t("canvas.properties.drawingSurface", "Canvas")}</h3>
					<div
						className="skedra-sdk__property-actions"
						aria-label={t("canvas.properties.background", "Background")}
					>
						{canvasBackground.options.map((color) => (
							<button
								key={color || "theme-default"}
								type="button"
								disabled={disabled}
								data-active={canvasBackground.value === color}
								aria-label={
									color ||
									t("canvas.properties.themeBackground", "Theme background")
								}
								title={
									color ||
									t("canvas.properties.themeBackground", "Theme background")
								}
								style={{
									background: color || "var(--skedra-sdk-background)",
								}}
								onClick={() => canvasBackground.onChange(color)}
							/>
						))}
					</div>
				</section>
			)}

			<section>
				<h3>{t("canvas.properties.geometry", "Geometry")}</h3>
				<div className="skedra-sdk__property-grid">
					{(defaultsMode
						? (["width", "height"] as const)
						: (["x", "y", "width", "height", "rotation"] as const)
					).map((key) => (
						<label key={key}>
							<span>
								{key === "width"
									? t("canvas.properties.width", "Width")
									: key === "height"
										? t("canvas.properties.height", "Height")
										: key}
							</span>
							<input
								type="number"
								disabled={disabled || selected.length !== 1}
								value={numberValue(element[key], 0)}
								min={key === "width" || key === "height" ? 1 : undefined}
								onChange={(event) => {
									const value = Number(event.target.value);
									if (key === "width" && onSetGeometryWidth) {
										onSetGeometryWidth(value);
									} else if (key === "height" && onSetGeometryHeight) {
										onSetGeometryHeight(value);
									} else {
										onSetProperties({ [key]: value });
									}
								}}
							/>
						</label>
					))}
				</div>
				{element.type === "ellipse" && onSetEllipseDiameter && (
					<label className="skedra-sdk__property-stack">
						<span>{t("canvas.properties.diameter", "Diameter")}</span>
						<input
							type="number"
							min={1}
							disabled={disabled}
							value={Math.max(element.width, element.height)}
							onChange={(event) =>
								onSetEllipseDiameter(Number(event.target.value))
							}
						/>
					</label>
				)}
				{defaultsMode && onPlaceDefaultElement && (
					<button
						type="button"
						disabled={disabled}
						onClick={onPlaceDefaultElement}
					>
						{element.type === "ellipse"
							? t(
									"canvas.properties.placeCircleCentered",
									"Place circle at cursor",
								)
							: t(
									"canvas.properties.placeShapeCentered",
									"Place shape at cursor",
								)}
					</button>
				)}
			</section>

			<section>
				<h3>{t("canvas.properties.appearance", "Appearance")}</h3>
				<div className="skedra-sdk__property-grid">
					<label>
						<span>{t("canvas.properties.stroke", "Stroke")}</span>
						<input
							type="color"
							data-skedra-property="stroke"
							disabled={disabled}
							value={
								element.stroke === "transparent" ? "#000000" : element.stroke
							}
							onChange={(event) =>
								onSetProperties({ stroke: event.target.value })
							}
						/>
					</label>
					<label>
						<span>{t("canvas.properties.roughFillStyle", "Fill")}</span>
						<input
							type="color"
							data-skedra-property="fill"
							disabled={disabled}
							value={element.fill === "transparent" ? "#ffffff" : element.fill}
							onChange={(event) =>
								onSetProperties({ fill: event.target.value })
							}
						/>
					</label>
					<label>
						<span>{t("canvas.properties.strokeWidth", "Stroke width")}</span>
						<input
							type="number"
							min="0"
							max="32"
							step="0.5"
							disabled={disabled}
							value={element.strokeWidth}
							onChange={(event) =>
								onSetProperties({ strokeWidth: Number(event.target.value) })
							}
						/>
					</label>
					<label>
						<span>{t("canvas.properties.strokeStyle", "Stroke style")}</span>
						<select
							disabled={disabled}
							value={element.strokeStyle}
							onChange={(event) =>
								onSetProperties({
									strokeStyle: event.target
										.value as CanvasElement["strokeStyle"],
								})
							}
						>
							<option value="solid">
								{t("canvas.properties.solid", "Solid")}
							</option>
							<option value="dashed">
								{t("canvas.properties.dashed", "Dashed")}
							</option>
							<option value="dotted">
								{t("canvas.properties.dotted", "Dotted")}
							</option>
						</select>
					</label>
					<label>
						<span>{t("canvas.properties.opacityLabel", "Opacity")}</span>
						<input
							type="range"
							min="0"
							max="100"
							disabled={disabled}
							value={element.opacity}
							onChange={(event) =>
								onSetProperties({ opacity: Number(event.target.value) })
							}
						/>
					</label>
					<label>
						<span>
							{t("canvas.properties.cornerRadius", "Corner radius %")}
						</span>
						<input
							type="number"
							min="0"
							max="50"
							disabled={disabled}
							value={numberValue(element.cornerRadiusPercent, 0)}
							onChange={(event) =>
								onSetProperties({
									cornerRadiusPercent: Number(event.target.value),
									cornerRadius: undefined,
								})
							}
						/>
					</label>
					<label>
						<span>{t("canvas.properties.roughness", "Roughness")}</span>
						<input
							type="range"
							min="0"
							max="3"
							step="0.1"
							disabled={disabled}
							value={numberValue(element.roughness, 0)}
							onChange={(event) =>
								onSetProperties({ roughness: Number(event.target.value) })
							}
						/>
					</label>
					<label>
						<span>{t("canvas.properties.roughFillStyle", "Fill style")}</span>
						<select
							disabled={disabled}
							value={element.roughFillStyle ?? "solid"}
							onChange={(event) =>
								onSetProperties({
									roughFillStyle: event.target
										.value as CanvasElement["roughFillStyle"],
								})
							}
						>
							<option value="solid">
								{t("canvas.properties.fillSolid", "Solid")}
							</option>
							<option value="hachure">
								{t("canvas.properties.fillHachure", "Hachure")}
							</option>
							<option value="cross-hatch">
								{t("canvas.properties.fillCrossHatch", "Cross hatch")}
							</option>
							<option value="dots">
								{t("canvas.properties.fillDots", "Dots")}
							</option>
							<option value="dashed">
								{t("canvas.properties.fillDashed", "Dashed")}
							</option>
						</select>
					</label>
					<label>
						<span>{t("canvas.properties.patternScale", "Pattern scale")}</span>
						<input
							type="number"
							min="0.25"
							max="4"
							step="0.25"
							disabled={disabled}
							value={numberValue(element.roughFillScale, 1)}
							onChange={(event) =>
								onSetProperties({ roughFillScale: Number(event.target.value) })
							}
						/>
					</label>
				</div>
				<button
					type="button"
					disabled={disabled}
					onClick={() => onSetProperties({ fill: "transparent" })}
				>
					{t("canvas.properties.transparent", "Transparent fill")}
				</button>
			</section>

			{element.type !== "image" && (
				<section>
					<h3>{t("canvas.properties.text", "Text")}</h3>
					<label className="skedra-sdk__property-stack">
						<span>{t("canvas.properties.stickyNoteContent", "Content")}</span>
						<textarea
							disabled={disabled}
							value={element.text ?? ""}
							onChange={(event) =>
								onSetProperties({ text: event.target.value })
							}
						/>
					</label>
					<div className="skedra-sdk__property-grid">
						<label>
							<span>{t("canvas.properties.textColor", "Color")}</span>
							<input
								type="color"
								disabled={disabled}
								value={element.textColor ?? element.stroke}
								onChange={(event) =>
									onSetProperties({ textColor: event.target.value })
								}
							/>
						</label>
						<label>
							<span>{t("canvas.properties.size", "Size")}</span>
							<input
								type="number"
								min="8"
								max="256"
								disabled={disabled}
								value={numberValue(element.fontSize, 16)}
								onChange={(event) =>
									onSetProperties({ fontSize: Number(event.target.value) })
								}
							/>
						</label>
						<label>
							<span>{t("canvas.properties.fontFamily", "Font")}</span>
							<input
								type="text"
								data-skedra-property="font"
								disabled={disabled}
								value={element.fontFamily ?? ""}
								onChange={(event) =>
									onSetProperties({ fontFamily: event.target.value })
								}
							/>
						</label>
						<label>
							<span>{t("canvas.properties.alignment", "Align")}</span>
							<select
								disabled={disabled}
								value={element.textAlign ?? "left"}
								onChange={(event) =>
									onSetProperties({
										textAlign: event.target.value as CanvasElement["textAlign"],
									})
								}
							>
								<option value="left">
									{t("canvas.properties.left", "Left")}
								</option>
								<option value="center">
									{t("canvas.properties.center", "Center")}
								</option>
								<option value="right">
									{t("canvas.properties.right", "Right")}
								</option>
							</select>
						</label>
						<label>
							<span>{t("canvas.properties.weight", "Weight")}</span>
							<select
								disabled={disabled}
								value={element.fontWeight ?? "normal"}
								onChange={(event) =>
									onSetProperties({
										fontWeight: event.target
											.value as CanvasElement["fontWeight"],
									})
								}
							>
								<option value="normal">
									{t("canvas.properties.normal", "Normal")}
								</option>
								<option value="bold">
									{t("canvas.properties.bold", "Bold")}
								</option>
							</select>
						</label>
						<label>
							<span>{t("canvas.properties.style", "Style")}</span>
							<select
								disabled={disabled}
								value={element.fontStyle ?? "normal"}
								onChange={(event) =>
									onSetProperties({
										fontStyle: event.target.value as CanvasElement["fontStyle"],
									})
								}
							>
								<option value="normal">
									{t("canvas.properties.normal", "Normal")}
								</option>
								<option value="italic">
									{t("canvas.properties.italic", "Italic")}
								</option>
							</select>
						</label>
						<label>
							<span>{t("canvas.properties.decoration", "Decoration")}</span>
							<select
								disabled={disabled}
								value={element.textDecoration ?? "none"}
								onChange={(event) =>
									onSetProperties({
										textDecoration: event.target
											.value as CanvasElement["textDecoration"],
									})
								}
							>
								<option value="none">
									{t("canvas.properties.none", "None")}
								</option>
								<option value="underline">
									{t("canvas.properties.underline", "Underline")}
								</option>
							</select>
						</label>
					</div>
				</section>
			)}

			{(element.type === "arrow" || element.type === "line") && (
				<section>
					<h3>{t("canvas.properties.pathAndArrow", "Path and arrow")}</h3>
					<div className="skedra-sdk__property-grid">
						{pathDrawMode && onPathDrawModeChange && (
							<label>
								<span>{t("canvas.properties.pathDrawMode", "Drawing")}</span>
								<select
									disabled={disabled}
									value={pathDrawMode}
									onChange={(event) =>
										onPathDrawModeChange(
											event.target.value as CanvasPathDrawMode,
										)
									}
								>
									<option value="normal">
										{t("canvas.properties.pathDrawNormal", "Single path")}
									</option>
									<option value="multi">
										{t("canvas.properties.pathDrawMulti", "Multiline path")}
									</option>
								</select>
							</label>
						)}
						<label>
							<span>{t("canvas.properties.pathStyle", "Mode")}</span>
							<select
								disabled={disabled}
								value={resolveCanvasEditorPathMode(element.arrowMode)}
								onChange={(event) =>
									onSetProperties({
										arrowMode: event.target.value as CanvasElement["arrowMode"],
									})
								}
							>
								{CANVAS_PATH_MODE_OPTIONS.map((mode) => (
									<option key={mode} value={mode}>
										{mode === "straight"
											? t("canvas.properties.cornered", "Corners")
											: t("canvas.properties.curve", "Curve")}
									</option>
								))}
							</select>
						</label>
						<label>
							<span>{t("canvas.properties.startArrowHead", "Start head")}</span>
							<select
								disabled={disabled}
								value={element.arrowHeadStart ?? "none"}
								onChange={(event) =>
									onSetProperties({
										arrowHeadStart: event.target
											.value as CanvasElement["arrowHeadStart"],
									})
								}
							>
								<option value="none">
									{t("canvas.properties.none", "None")}
								</option>
								<option value="arrow">
									{t("canvas.properties.open", "Arrow")}
								</option>
								<option value="triangle">
									{t("canvas.properties.triangle", "Triangle")}
								</option>
								<option value="dot">{t("canvas.properties.dot", "Dot")}</option>
							</select>
						</label>
						<label>
							<span>{t("canvas.properties.endArrowHead", "End head")}</span>
							<select
								disabled={disabled}
								value={
									element.arrowHeadEnd ??
									(element.type === "arrow" ? "arrow" : "none")
								}
								onChange={(event) =>
									onSetProperties({
										arrowHeadEnd: event.target
											.value as CanvasElement["arrowHeadEnd"],
									})
								}
							>
								<option value="none">
									{t("canvas.properties.none", "None")}
								</option>
								<option value="arrow">
									{t("canvas.properties.open", "Arrow")}
								</option>
								<option value="triangle">
									{t("canvas.properties.triangle", "Triangle")}
								</option>
								<option value="dot">{t("canvas.properties.dot", "Dot")}</option>
							</select>
						</label>
						<label>
							<span>{t("canvas.properties.arrowHeadScale", "Head scale")}</span>
							<input
								type="number"
								min="0.25"
								max="4"
								step="0.25"
								disabled={disabled}
								value={numberValue(element.arrowHeadScale, 1)}
								onChange={(event) =>
									onSetProperties({
										arrowHeadScale: Number(event.target.value),
									})
								}
							/>
						</label>
					</div>
					{element.type === "line" && (element.points?.length ?? 0) >= 3 && (
						<label>
							<input
								type="checkbox"
								disabled={disabled}
								checked={element.closed === true}
								onChange={(event) =>
									onSetProperties({ closed: event.target.checked })
								}
							/>{" "}
							{t("canvas.properties.pathClosed", "Closed shape")}
						</label>
					)}
					<label>
						<input
							type="checkbox"
							disabled={disabled}
							checked={element.arrowHeadFilled ?? true}
							onChange={(event) =>
								onSetProperties({ arrowHeadFilled: event.target.checked })
							}
						/>{" "}
						{t("canvas.properties.filledArrowHeads", "Filled arrow heads")}
					</label>
				</section>
			)}

			{element.type === "arrow" && (
				<section>
					<h3>{t("canvas.properties.arrowTextPosition", "Arrow text")}</h3>
					<div className="skedra-sdk__property-grid">
						<label>
							<span>
								{t("canvas.properties.arrowTextPosition", "Position")}
							</span>
							<select
								disabled={disabled}
								value={String(custom.arrowTextSide ?? "above")}
								onChange={(event) =>
									onSetProperties({
										customData: {
											...custom,
											arrowTextSide: event.target.value,
										},
									})
								}
							>
								<option value="above">
									{t("canvas.properties.textAbove", "Above")}
								</option>
								<option value="below">
									{t("canvas.properties.textBelow", "Below")}
								</option>
							</select>
						</label>
						<label>
							<span>
								{t("canvas.properties.arrowTextOrientation", "Orientation")}
							</span>
							<select
								disabled={disabled}
								value={String(custom.arrowTextOrientation ?? "horizontal")}
								onChange={(event) =>
									onSetProperties({
										customData: {
											...custom,
											arrowTextOrientation: event.target.value,
										},
									})
								}
							>
								<option value="horizontal">
									{t("canvas.properties.textHorizontal", "Horizontal")}
								</option>
								<option value="vertical">
									{t("canvas.properties.textVertical", "Vertical")}
								</option>
							</select>
						</label>
					</div>
				</section>
			)}

			{custom.skedraType === "sticky-note" && (
				<section>
					<h3>{t("canvas.properties.stickyNote", "Sticky note")}</h3>
					<label className="skedra-sdk__property-stack">
						<span>{t("canvas.properties.contentMode", "Content mode")}</span>
						<select
							disabled={disabled}
							value={String(custom.stickyNoteMode ?? "note")}
							onChange={(event) =>
								onSetProperties({
									customData: {
										...custom,
										stickyNoteMode: event.target.value,
										stickyChecklist:
											event.target.value === "checklist"
												? (custom.stickyChecklist ?? [])
												: [],
									},
								})
							}
						>
							<option value="note">
								{t("canvas.properties.note", "Note")}
							</option>
							<option value="checklist">
								{t("canvas.properties.checklist", "Checklist")}
							</option>
						</select>
					</label>
				</section>
			)}

			{element.type === "image" && (
				<section>
					<h3>{t("canvas.properties.imageCrop", "Image crop")}</h3>
					{onStartImageCrop && (
						<button
							type="button"
							disabled={disabled}
							onClick={() => onStartImageCrop(element.id)}
						>
							{t("canvas.properties.editCrop", "Edit crop on canvas")}
						</button>
					)}
					<div className="skedra-sdk__property-grid">
						{(["x", "y", "width", "height"] as const).map((key) => (
							<label key={key}>
								<span>{key}</span>
								<input
									type="number"
									min="0"
									max="1"
									step="0.01"
									disabled={disabled}
									value={
										crop[key] ?? (key === "width" || key === "height" ? 1 : 0)
									}
									onChange={(event) =>
										updateCrop(key, Number(event.target.value))
									}
								/>
							</label>
						))}
					</div>
					<button
						type="button"
						disabled={disabled}
						onClick={() =>
							onCropImage(element.id, { x: 0, y: 0, width: 1, height: 1 })
						}
					>
						{t("canvas.properties.resetCrop", "Reset crop")}
					</button>
				</section>
			)}

			{isFlowchart && (
				<section>
					<h3>{t("canvas.properties.flowchart", "Flowchart")}</h3>
					{onEditFlowchartNodeText && (
						<button
							type="button"
							disabled={disabled}
							onClick={onEditFlowchartNodeText}
						>
							{t("canvas.flowchart.editNodeText", "Edit text")}
						</button>
					)}
					<label className="skedra-sdk__property-stack">
						<span>{t("canvas.flowchart.insertNodeKind", "New node type")}</span>
						<select
							disabled={disabled || !onFlowchartInsertKindChange}
							value={flowchartInsertKind}
							onChange={(event) =>
								onFlowchartInsertKindChange?.(
									event.target.value as typeof flowchartInsertKind,
								)
							}
						>
							<option value="start">
								{t("canvas.flowchart.nodeKinds.start", "Start")}
							</option>
							<option value="step">
								{t("canvas.flowchart.nodeKinds.step", "Step")}
							</option>
							<option value="decision">
								{t("canvas.flowchart.nodeKinds.decision", "Decision")}
							</option>
							<option value="end">
								{t("canvas.flowchart.nodeKinds.end", "End")}
							</option>
						</select>
					</label>
					<select
						disabled={disabled}
						aria-label={t("canvas.properties.flowchartNodeType", "Node type")}
						value={String(custom.flowchartNodeKind ?? "step")}
						onChange={(event) =>
							onSetFlowchartNodeKind(
								element.id,
								event.target.value as "start" | "step" | "decision" | "end",
							)
						}
					>
						<option value="start">
							{t("canvas.flowchart.nodeKinds.start", "Start")}
						</option>
						<option value="step">
							{t("canvas.flowchart.nodeKinds.step", "Step")}
						</option>
						<option value="decision">
							{t("canvas.flowchart.nodeKinds.decision", "Decision")}
						</option>
						<option value="end">
							{t("canvas.flowchart.nodeKinds.end", "End")}
						</option>
					</select>
					{onAddFlowchartNodeOnSide && (
						<div className="skedra-sdk__property-actions">
							{(
								[
									["up", "canvas.flowchart.attachTop", "Add above", undefined],
									[
										"right",
										custom.flowchartNodeKind === "decision"
											? "canvas.flowchart.addYesBranch"
											: "canvas.flowchart.attachRight",
										custom.flowchartNodeKind === "decision"
											? "Add yes branch"
											: "Add right",
										custom.flowchartNodeKind === "decision"
											? {
													branch: "yes" as const,
													label: t("templateContent.flowchart.yes", "Yes"),
												}
											: undefined,
									],
									[
										"down",
										custom.flowchartNodeKind === "decision"
											? "canvas.flowchart.addNoBranch"
											: "canvas.flowchart.attachBottom",
										custom.flowchartNodeKind === "decision"
											? "Add no branch"
											: "Add below",
										custom.flowchartNodeKind === "decision"
											? {
													branch: "no" as const,
													label: t("templateContent.flowchart.no", "No"),
												}
											: undefined,
									],
									[
										"left",
										"canvas.flowchart.attachLeft",
										"Add left",
										undefined,
									],
								] as const
							).map(([route, key, fallback, options]) => (
								<button
									key={route}
									type="button"
									disabled={disabled}
									onClick={() => onAddFlowchartNodeOnSide(route, options)}
								>
									{t(key, fallback)}
								</button>
							))}
						</div>
					)}
					{!onAddFlowchartNodeOnSide && (
						<div className="skedra-sdk__property-actions">
							<button
								type="button"
								disabled={disabled}
								onClick={() =>
									onAddFlowchartStep(element.id, { branch: "next" })
								}
							>
								{t("canvas.flowchart.addStep", "Add step")}
							</button>
							<button
								type="button"
								disabled={disabled}
								onClick={() =>
									onAddFlowchartStep(element.id, { branch: "yes" })
								}
							>
								{t("canvas.flowchart.addYesBranch", "Add yes branch")}
							</button>
							<button
								type="button"
								disabled={disabled}
								onClick={() => onAddFlowchartStep(element.id, { branch: "no" })}
							>
								{t("canvas.flowchart.addNoBranch", "Add no branch")}
							</button>
						</div>
					)}
				</section>
			)}

			{isFlowchartConnector && (
				<section>
					<h3>
						{t("canvas.properties.flowchartConnector", "Flowchart connector")}
					</h3>
					{onEditFlowchartConnectorLabel && (
						<button
							type="button"
							disabled={disabled}
							onClick={onEditFlowchartConnectorLabel}
						>
							{t("canvas.flowchart.editConnectorLabel", "Edit label")}
						</button>
					)}
					<label className="skedra-sdk__property-stack">
						<span>
							{t("canvas.properties.flowchartConnectorLabel", "Label")}
						</span>
						<input
							type="text"
							disabled={disabled}
							value={element.text ?? ""}
							onChange={(event) => {
								const label = event.target.value || undefined;
								if (onSetFlowchartConnectorLabel) {
									onSetFlowchartConnectorLabel(label);
								} else {
									onSetProperties({ text: label });
								}
							}}
						/>
					</label>
					<div className="skedra-sdk__property-actions">
						{onSetFlowchartConnectorLabel && (
							<>
								<button
									type="button"
									disabled={disabled}
									onClick={() =>
										onSetFlowchartConnectorLabel(
											t("templateContent.flowchart.yes", "Yes"),
										)
									}
								>
									{t("templateContent.flowchart.yes", "Yes")}
								</button>
								<button
									type="button"
									disabled={disabled}
									onClick={() =>
										onSetFlowchartConnectorLabel(
											t("templateContent.flowchart.no", "No"),
										)
									}
								>
									{t("templateContent.flowchart.no", "No")}
								</button>
							</>
						)}
						{(["Yes", "No"] as const).map((label) => (
							<button
								key={label}
								type="button"
								disabled={disabled}
								onClick={() => onSetProperties({ text: label })}
							>
								{label === "Yes"
									? t("canvas.properties.yes", "Yes")
									: t("canvas.properties.no", "No")}
							</button>
						))}
						<button
							type="button"
							disabled={disabled}
							onClick={() =>
								onSetFlowchartConnectorLabel
									? onSetFlowchartConnectorLabel(undefined)
									: onSetProperties({ text: undefined })
							}
						>
							{t("canvas.flowchart.clearConnectorLabel", "Clear label")}
						</button>
					</div>
				</section>
			)}

			{isKanbanCard && (
				<section>
					<h3>{t("canvas.properties.kanbanCard", "Kanban card")}</h3>
					{onOpenKanbanCard && (
						<button
							type="button"
							disabled={disabled}
							onClick={() => onOpenKanbanCard(element.id)}
						>
							{t("canvas.properties.editDetails", "Open details")}
						</button>
					)}
					<label className="skedra-sdk__property-stack">
						<span>{t("canvas.properties.description", "Description")}</span>
						<textarea
							disabled={disabled}
							value={String(custom.description ?? "")}
							onChange={(event) =>
								onUpdateKanbanCard(element.id, {
									description: event.target.value,
								})
							}
						/>
					</label>
					<div className="skedra-sdk__property-grid">
						<label>
							<span>{t("canvas.properties.priority", "Priority")}</span>
							<select
								disabled={disabled}
								value={String(custom.priority ?? "")}
								onChange={(event) =>
									onUpdateKanbanCard(element.id, {
										priority: (event.target.value ||
											null) as CanvasEditorKanbanCardDetails["priority"],
									})
								}
							>
								<option value="">{t("canvas.properties.none", "None")}</option>
								<option value="low">{t("canvas.properties.low", "Low")}</option>
								<option value="medium">
									{t("canvas.properties.medium", "Medium")}
								</option>
								<option value="high">
									{t("canvas.properties.high", "High")}
								</option>
								<option value="urgent">
									{t("canvas.properties.urgent", "Urgent")}
								</option>
							</select>
						</label>
						<label>
							<span>{t("canvas.properties.start", "Start")}</span>
							<input
								type="date"
								disabled={disabled}
								value={String(custom.startDate ?? "")}
								onChange={(event) =>
									onUpdateKanbanCard(element.id, {
										startDate: event.target.value || null,
									})
								}
							/>
						</label>
						<label>
							<span>{t("canvas.properties.due", "Due")}</span>
							<input
								type="date"
								disabled={disabled}
								value={String(custom.dueDate ?? "")}
								onChange={(event) =>
									onUpdateKanbanCard(element.id, {
										dueDate: event.target.value || null,
									})
								}
							/>
						</label>
						<label>
							<span>{t("canvas.properties.assignee", "Assignee")}</span>
							<input
								type="text"
								disabled={disabled}
								value={String(custom.assigneeName ?? "")}
								onChange={(event) =>
									onUpdateKanbanCard(element.id, {
										assigneeName: event.target.value || null,
									})
								}
							/>
						</label>
						<label>
							<span>{t("canvas.properties.role", "Role")}</span>
							<input
								type="text"
								disabled={disabled}
								value={String(custom.roleName ?? "")}
								onChange={(event) =>
									onUpdateKanbanCard(element.id, {
										roleName: event.target.value || null,
									})
								}
							/>
						</label>
						<label>
							<span>{t("canvas.properties.group", "Group")}</span>
							<input
								type="text"
								disabled={disabled}
								value={String(custom.groupName ?? "")}
								onChange={(event) =>
									onUpdateKanbanCard(element.id, {
										groupName: event.target.value || null,
									})
								}
							/>
						</label>
					</div>
				</section>
			)}

			{isKanbanList && (
				<section>
					<h3>{t("canvas.properties.kanbanList", "Kanban list")}</h3>
					<div className="skedra-sdk__property-actions">
						{onOpenKanbanList && (
							<button
								type="button"
								disabled={disabled}
								onClick={() => onOpenKanbanList(element.id)}
							>
								{t("canvas.properties.editDetails", "Open details")}
							</button>
						)}
						{onAddKanbanCard && (
							<button
								type="button"
								disabled={disabled}
								onClick={() => onAddKanbanCard(element.id)}
							>
								{t("canvas.properties.addCard", "Add card")}
							</button>
						)}
					</div>
					<label className="skedra-sdk__property-stack">
						<span>{t("canvas.properties.description", "Description")}</span>
						<textarea
							disabled={disabled}
							value={String(custom.description ?? "")}
							onChange={(event) =>
								onUpdateKanbanList(element.id, {
									description: event.target.value,
								})
							}
						/>
					</label>
					<label>
						<span>{t("canvas.properties.wipLimit", "WIP limit")}</span>
						<input
							type="number"
							min="0"
							disabled={disabled}
							value={Number(custom.wipLimit ?? 0)}
							onChange={(event) =>
								onUpdateKanbanList(element.id, {
									wipLimit: Number(event.target.value) || null,
								})
							}
						/>
					</label>
				</section>
			)}

			{isTemplateSection && onAddTemplateSticky && (
				<section>
					<h3>{t("canvas.properties.template", "Template")}</h3>
					<button
						type="button"
						disabled={disabled}
						onClick={() => onAddTemplateSticky(element.id)}
					>
						{t("canvas.properties.addNote", "Add note")}
					</button>
				</section>
			)}

			{!defaultsMode && (
				<section>
					<h3>{t("canvas.properties.arrange", "Arrange")}</h3>
					<div className="skedra-sdk__property-actions">
						{(
							[
								"left",
								"right",
								"top",
								"bottom",
								"horizontal-center",
								"vertical-center",
							] as const
						).map((alignment) => (
							<button
								key={alignment}
								type="button"
								disabled={disabled || selected.length < 2}
								onClick={() => onAlign(alignment)}
							>
								{t(`canvas.properties.align.${alignment}`, alignment)}
							</button>
						))}
						<button
							type="button"
							disabled={disabled || selected.length < 3}
							onClick={() => onDistribute("horizontal")}
						>
							{t("canvas.properties.distributeHorizontal", "Distribute H")}
						</button>
						<button
							type="button"
							disabled={disabled || selected.length < 3}
							onClick={() => onDistribute("vertical")}
						>
							{t("canvas.properties.distributeVertical", "Distribute V")}
						</button>
						<button
							type="button"
							disabled={disabled || selected.length < 2}
							onClick={onGroup}
						>
							{t("canvas.properties.groupSelection", "Group")}
						</button>
						<button type="button" disabled={disabled} onClick={onUngroup}>
							{t("canvas.properties.ungroupSelection", "Ungroup")}
						</button>
						{(
							[
								"bring-forward",
								"send-backward",
								"bring-to-front",
								"send-to-back",
							] as const
						).map((command) => (
							<button
								key={command}
								type="button"
								disabled={disabled}
								onClick={() => onLayer(command)}
							>
								{t(`canvas.properties.layer.${command}`, command)}
							</button>
						))}
						<button
							type="button"
							disabled={disabled}
							onClick={() => onFlip("horizontal")}
						>
							{t("canvas.properties.flipHorizontal", "Flip H")}
						</button>
						<button
							type="button"
							disabled={disabled}
							onClick={() => onFlip("vertical")}
						>
							{t("canvas.properties.flipVertical", "Flip V")}
						</button>
						<button type="button" disabled={disabled} onClick={() => onLock()}>
							{selected.every((item) => item.locked)
								? t("canvas.properties.unlock", "Unlock")
								: t("canvas.properties.lock", "Lock")}
						</button>
						{onCopy && (
							<button type="button" disabled={disabled} onClick={onCopy}>
								{t("canvas.properties.copy", "Copy")}
							</button>
						)}
					</div>
					<label className="skedra-sdk__property-stack">
						<span>{t("canvas.properties.link", "Link")}</span>
						<input
							type="url"
							disabled={disabled}
							value={element.link ?? ""}
							onChange={(event) =>
								onSetProperties({ link: event.target.value || undefined })
							}
						/>
					</label>
				</section>
			)}
		</aside>
	);
}
