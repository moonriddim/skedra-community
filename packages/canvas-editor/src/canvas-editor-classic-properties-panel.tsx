import {
	type AlignEdge,
	type ArrowHead,
	type ArrowMode,
	type ArrowTextOrientation,
	type ArrowTextSide,
	type CanvasElement,
	type CanvasPathDrawMode,
	DEFAULT_ARROW_HEAD_FILLED,
	DEFAULT_ARROW_HEAD_SCALE,
	type DistributionAxis,
	FRAME_SIZE_PRESET_CATEGORIES,
	type FlowchartConnectorMeta,
	type FlowchartConnectorRoute,
	type FlowchartNodeKind,
	type FlowchartNodeMeta,
	type FrameConstraintAxis,
	type FrameConstraints,
	type FrameSizePreset,
	type KanbanPriority,
	MAX_ARROW_HEAD_SCALE,
	MAX_CLOUD_ARC_RADIUS,
	MAX_POLYGON_SIDES,
	MAX_ROUGH_FILL_SCALE,
	MIN_ARROW_HEAD_SCALE,
	MIN_CLOUD_ARC_RADIUS,
	MIN_POLYGON_SIDES,
	MIN_ROUGH_FILL_SCALE,
	type RoughFillStyle,
	type StrokeStyle,
	getCanvasLayoutItemCount,
	getFrameSizePresetsByCategory,
	readFrameConstraints,
} from "@skedra/canvas-core";
import {
	AlignCenter,
	AlignHorizontalJustifyCenter,
	AlignHorizontalJustifyEnd,
	AlignHorizontalJustifyStart,
	AlignHorizontalSpaceBetween,
	AlignLeft,
	AlignRight,
	AlignVerticalJustifyCenter,
	AlignVerticalJustifyEnd,
	AlignVerticalJustifyStart,
	AlignVerticalSpaceBetween,
	ArrowDown,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	Bold,
	ChevronDown,
	ChevronsDown,
	ChevronsUp,
	Copy,
	Italic,
	Link,
	type LucideIcon,
	Pencil,
	Plus,
	Trash2,
	Underline,
} from "lucide-react";
import {
	type CSSProperties,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import {
	CANVAS_PATH_MODE_OPTIONS,
	type CanvasPathModeOption,
	resolveCanvasEditorPathMode,
} from "./path-editor-controller";

export type CanvasEditorPropertiesTranslate = (
	key: string,
	fallback: string,
	params?: Record<string, string | number>,
) => string;

export interface CanvasEditorTemplateSectionMeta {
	templateTool: string;
	templateSectionId: string;
	templateAccent: string;
	stickyColor?: string;
}

export interface CanvasEditorTemplateNoteMeta {
	templateTool: string;
	templateSectionId: string;
	templateAccent: string;
	templateNoteType: string;
}

/**
 * Host-neutral view state for the compact Skedra properties UI that existed
 * before the Web/SDK editor merge. Hosts own data; the shared editor owns UI.
 */
export interface CanvasEditorClassicPropertiesView {
	selected: CanvasElement[];
	hasSelection: boolean;
	isStickyNoteOnly: boolean;
	currentStickyNoteMode: "note" | "checklist";
	isKanbanListSelection: boolean;
	isKanbanCardSelection: boolean;
	kanbanList: CanvasElement | null;
	currentPriority: KanbanPriority | null;
	templateSection: CanvasEditorTemplateSectionMeta | null;
	isTemplateNoteSelection: boolean;
	templateNoteMeta: CanvasEditorTemplateNoteMeta | null;
	flowchartNode: CanvasElement | null;
	flowchartNodeMeta: FlowchartNodeMeta | null;
	flowchartConnector: CanvasElement | null;
	flowchartConnectorMeta: FlowchartConnectorMeta | null;
	flowchartInsertKind: FlowchartNodeKind;
	/* Frame-Optionen (optional, damit bestehende Hosts nicht brechen) */
	/** Einzelner selektierter einfacher Frame, sonst null. */
	frameElement?: CanvasElement | null;
	/** True, wenn das Frame-Werkzeug aktiv ist und nichts selektiert wurde. */
	framePresetToolActive?: boolean;
	/** Frame-Namen setzen (frameLabel). */
	onSetFrameLabel?: (label: string) => void;
	/** Inline-Umbenennen des Frame-Labels auf dem Canvas starten. */
	onRenameFrame?: () => void;
	/** Preset-Groesse auf den selektierten Frame anwenden. */
	onApplyFramePreset?: (preset: FrameSizePreset) => void;
	/** Platzierung eines neuen Frames mit Preset-Groesse starten. */
	onStartFramePresetPlacement?: (preset: FrameSizePreset) => void;
	/** Breite/Hoehe des selektierten Frames direkt setzen. */
	onSetFrameSize?: (size: { width: number; height: number }) => void;
	/** Selektierte Kinder einfacher Frames (Constraints-Sektion). */
	frameChildElements?: CanvasElement[];
	/** Constraints der selektierten Frame-Kinder setzen. */
	onSetFrameChildConstraints?: (constraints: Partial<FrameConstraints>) => void;
	/** Selektierten Frame als Bild exportieren. */
	onExportFrame?: (format: "png" | "svg") => void;
	showStroke: boolean;
	isTextOnly: boolean;
	hasMindmapBranch: boolean;
	selectedTemplateSection: CanvasEditorTemplateSectionMeta | null;
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
	showDimensions: boolean;
	singleGeometryElement: CanvasElement | null;
	geometryPresetTool:
		| "rectangle"
		| "ellipse"
		| "diamond"
		| "triangle"
		| "cloud"
		| null;
	currentShapeWidth: number;
	currentShapeHeight: number;
	ellipseDiameter: number;
	showPyramidOptions: boolean;
	currentPyramidSections: number;
	showPolygonOptions: boolean;
	currentPolygonSides: number;
	showCloudArcRadius: boolean;
	currentCloudArcRadius: number;
	currentOpacity: number;
	strokeColors: string[];
	showPathDrawMode: boolean;
	isCloudDrawMode: boolean;
	isPathElement: boolean;
	isArrowElement: boolean;
	showPathClosed: boolean;
	currentPathClosed: boolean;
	showArrowTextPosition: boolean;
	pathDrawMode: CanvasPathDrawMode;
	currentArrowMode: ArrowMode;
	currentArrowHeadStart: ArrowHead;
	currentArrowHeadEnd: ArrowHead;
	currentArrowHeadScale: number;
	currentArrowHeadFilled: boolean;
	showArrowHeadScale: boolean;
	showArrowHeadFill: boolean;
	currentArrowTextSide: ArrowTextSide;
	currentArrowTextOrientation: ArrowTextOrientation;
	hasTextElement: boolean;
	currentTextColor: string;
	currentFontFamily: string;
	currentFontSize: number;
	currentTextAlign: "left" | "center" | "right";
	currentFontWeight: NonNullable<CanvasElement["fontWeight"]>;
	currentFontStyle: NonNullable<CanvasElement["fontStyle"]>;
	currentTextDecoration: NonNullable<CanvasElement["textDecoration"]>;
	canvasBackground: string;
	canvasBackgroundOptions: readonly (string | null)[];
	onSetStickyNoteMode: (mode: "note" | "checklist") => void;
	onSetKanbanPriority: (priority: KanbanPriority | null) => void;
	onOpenKanbanList: () => void;
	onAddKanbanCard: () => void;
	onOpenKanbanCard: () => void;
	onAddTemplateNote: () => void;
	onSetFlowchartInsertKind: (kind: FlowchartNodeKind) => void;
	onEditFlowchartNodeText: () => void;
	onSetFlowchartNodeKind: (kind: FlowchartNodeKind) => void;
	onAddFlowchartNodeOnSide: (
		route: Exclude<FlowchartConnectorRoute, "left-up">,
		options?: { branch?: "next" | "yes" | "no"; label?: string },
	) => void;
	onSetFlowchartConnectorLabel: (
		label: string | undefined,
		textColor?: string,
	) => void;
	onEditFlowchartConnectorLabel: () => void;
	onSetProperty: (key: keyof CanvasElement, value: unknown) => void;
	onSetGeometryWidth: (value: number) => void;
	onSetGeometryHeight: (value: number) => void;
	onSetEllipseDiameter: (value: number) => void;
	onStartPresetGeometryPlacement: () => void;
	onPathDrawModeChange: (mode: CanvasPathDrawMode) => void;
	onArrowTextSideChange: (side: ArrowTextSide) => void;
	onArrowTextOrientationChange: (orientation: ArrowTextOrientation) => void;
	onSetCanvasBackground: (background: string) => void;
	onBringForward: () => void;
	onSendBackward: () => void;
	onBringToFront: () => void;
	onSendToBack: () => void;
	onAlign: (alignment: AlignEdge) => void;
	onDistribute: (axis: DistributionAxis) => void;
	onCopy: () => void;
	onDelete: () => void;
	onAddLink: () => void;
}

interface ClassicPanelProps {
	view: CanvasEditorClassicPropertiesView;
	className?: string;
	style?: CSSProperties;
	ariaLabel: string;
	disabled?: boolean;
	translate: CanvasEditorPropertiesTranslate;
}

const BG_COLORS = [
	"transparent",
	"#ffc9c9",
	"#b2f2bb",
	"#a5d8ff",
	"#ffec99",
	"#d0bfff",
];
const STICKY_COLORS = [
	"#fff3bf",
	"#d3f9d8",
	"#d0ebff",
	"#e5dbff",
	"#ffe3e3",
	"#ffec99",
];
const STROKE_WIDTHS = [1, 2, 4] as const;
const STROKE_STYLES = ["solid", "dashed", "dotted"] as const;
const ROUGHNESS_LEVELS = [0, 1, 2] as const;
const CORNER_RADIUS_PRESETS = [0, 25, 50, 100] as const;
const ROUGH_FILL_STYLES: RoughFillStyle[] = [
	"solid",
	"hachure",
	"cross-hatch",
	"dashed",
	"dots",
];
const ARROW_HEADS: ArrowHead[] = ["none", "arrow", "triangle", "dot"];
const FONT_FAMILIES = [
	{ value: "system-ui, sans-serif", label: "Sans Serif" },
	{ value: "Georgia, Cambria, Times New Roman, Times, serif", label: "Serif" },
	{
		value: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
		label: "Monospace",
	},
	{
		value: '"Kalam", "Architects Daughter", "Segoe Print", cursive',
		label: "Handschrift",
	},
	{
		value: '"Comic Neue", "Comic Sans MS", cursive',
		label: "Comic",
	},
	{ value: "Comic Sans MS, Comic Sans, cursive", label: "Comic Sans" },
	{
		value: "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
		label: "Impact",
	},
	{
		value: "Trebuchet MS, Lucida Grande, Lucida Sans, sans-serif",
		label: "Trebuchet",
	},
	{ value: "Verdana, Geneva, sans-serif", label: "Verdana" },
	{ value: "Courier New, Courier, monospace", label: "Courier New" },
	{
		value: "Palatino Linotype, Palatino, Book Antiqua, serif",
		label: "Palatino",
	},
	{
		value: "Garamond, Baskerville, Baskerville Old Face, serif",
		label: "Garamond",
	},
	{ value: "Arial, Helvetica, sans-serif", label: "Arial" },
];
const FONT_SIZES = [
	{ value: 14, label: "S" },
	{ value: 18, label: "M" },
	{ value: 24, label: "L" },
	{ value: 32, label: "XL" },
];
const KANBAN_PRIORITIES: Array<{
	value: KanbanPriority;
	color: string;
	labelKey: string;
	fallback: string;
}> = [
	{
		value: "low",
		color: "var(--kanban-priority-low, #51cf66)",
		labelKey: "canvas.properties.low",
		fallback: "Low",
	},
	{
		value: "medium",
		color: "var(--kanban-priority-medium, #fab005)",
		labelKey: "canvas.properties.medium",
		fallback: "Medium",
	},
	{
		value: "high",
		color: "var(--kanban-priority-high, #fd7e14)",
		labelKey: "canvas.properties.high",
		fallback: "High",
	},
	{
		value: "urgent",
		color: "var(--kanban-priority-urgent, #fa5252)",
		labelKey: "canvas.properties.urgent",
		fallback: "Urgent",
	},
];

const ALIGNMENT_ACTIONS: ReadonlyArray<{
	value: AlignEdge;
	Icon: LucideIcon;
	fallback: string;
}> = [
	{
		value: "left",
		Icon: AlignHorizontalJustifyStart,
		fallback: "Align left",
	},
	{
		value: "horizontal-center",
		Icon: AlignHorizontalJustifyCenter,
		fallback: "Center horizontally",
	},
	{
		value: "right",
		Icon: AlignHorizontalJustifyEnd,
		fallback: "Align right",
	},
	{ value: "top", Icon: AlignVerticalJustifyStart, fallback: "Align top" },
	{
		value: "vertical-center",
		Icon: AlignVerticalJustifyCenter,
		fallback: "Center vertically",
	},
	{
		value: "bottom",
		Icon: AlignVerticalJustifyEnd,
		fallback: "Align bottom",
	},
];

const DISTRIBUTION_ACTIONS: ReadonlyArray<{
	value: DistributionAxis;
	Icon: LucideIcon;
	labelKey: string;
	fallback: string;
}> = [
	{
		value: "horizontal",
		Icon: AlignHorizontalSpaceBetween,
		labelKey: "canvas.properties.distributeHorizontal",
		fallback: "Distribute horizontally",
	},
	{
		value: "vertical",
		Icon: AlignVerticalSpaceBetween,
		labelKey: "canvas.properties.distributeVertical",
		fallback: "Distribute vertically",
	},
];

function Section({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div>
			<p className="mb-1 font-medium text-[9px] text-muted-foreground uppercase tracking-wider">
				{label}
			</p>
			{children}
		</div>
	);
}

function ChoiceButton({
	active,
	onClick,
	children,
	title,
	className = "",
}: {
	active: boolean;
	onClick: () => void;
	children: ReactNode;
	title?: string;
	className?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			title={title}
			className={`flex flex-1 cursor-pointer items-center justify-center rounded border py-1 transition-all ${
				active
					? "border-primary bg-primary/20 text-card-foreground"
					: "border-border text-muted-foreground hover:border-muted-foreground"
			} ${className}`}
		>
			{children}
		</button>
	);
}

function ColorGrid({
	colors,
	active,
	onSelect,
	t,
}: {
	colors: readonly string[];
	active: string;
	onSelect: (color: string) => void;
	t: CanvasEditorPropertiesTranslate;
}) {
	return (
		<div className="flex flex-wrap gap-1">
			{colors.map((color) => (
				<button
					key={color}
					type="button"
					onClick={() => onSelect(color)}
					className={`h-5 w-5 cursor-pointer rounded border-2 transition-all ${
						active === color
							? "scale-110 border-primary"
							: "border-border hover:border-muted-foreground"
					}`}
					style={{
						background:
							color === "transparent"
								? "repeating-conic-gradient(#666 0% 25%, transparent 0% 50%) 50% / 8px 8px"
								: color,
					}}
					title={
						color === "transparent"
							? t("common.transparent", "Transparent")
							: color
					}
				/>
			))}
			<label
				className="relative h-5 w-5 cursor-pointer overflow-hidden rounded border-2 border-border transition-all hover:border-muted-foreground"
				style={{
					background:
						"conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
				}}
			>
				<input
					type="color"
					value={active === "transparent" ? "#000000" : active}
					onChange={(event) => onSelect(event.target.value)}
					className="absolute inset-0 cursor-pointer opacity-0"
					aria-label={t("canvas.properties.customColor", "Custom color")}
				/>
			</label>
		</div>
	);
}

function DimensionInput({
	label,
	value,
	onCommit,
}: {
	label: string;
	value: number;
	onCommit: (value: number) => void;
}) {
	const [draft, setDraft] = useState(String(value));
	useEffect(() => setDraft(String(value)), [value]);
	const commit = () => {
		const parsed = Number(draft);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			setDraft(String(value));
			return;
		}
		onCommit(parsed);
	};
	return (
		<label className="flex flex-col gap-1">
			<span className="text-[9px] text-muted-foreground uppercase tracking-wider">
				{label}
			</span>
			<input
				type="number"
				min={1}
				step={1}
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.key === "Enter") event.currentTarget.blur();
				}}
				className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] text-card-foreground outline-none transition-colors focus:border-primary"
			/>
		</label>
	);
}

function FontDropdown({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [menuPosition, setMenuPosition] = useState<{
		top: number;
		left: number;
		maxHeight: number;
	} | null>(null);
	const triggerRef = useRef<HTMLDivElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const handler = (event: PointerEvent) => {
			const target = event.target as Node;
			if (
				!triggerRef.current?.contains(target) &&
				!menuRef.current?.contains(target)
			) {
				setOpen(false);
			}
		};
		document.addEventListener("pointerdown", handler, true);
		return () => document.removeEventListener("pointerdown", handler, true);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const updatePosition = () => {
			const trigger = triggerRef.current;
			if (!trigger) return;
			const rect = trigger.getBoundingClientRect();
			const viewportPadding = 8;
			const gap = 8;
			const menuWidth = 176;
			const maxHeight = Math.max(
				120,
				Math.min(256, window.innerHeight - viewportPadding * 2),
			);
			const rightPosition = rect.right + gap;
			const left =
				rightPosition + menuWidth <= window.innerWidth - viewportPadding
					? rightPosition
					: Math.max(viewportPadding, rect.left - menuWidth - gap);
			const top = Math.min(
				Math.max(viewportPadding, rect.top),
				Math.max(
					viewportPadding,
					window.innerHeight - maxHeight - viewportPadding,
				),
			);
			setMenuPosition({ top, left, maxHeight });
		};

		updatePosition();
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);
		return () => {
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [open]);

	const current =
		FONT_FAMILIES.find((font) => font.value === value) ?? FONT_FAMILIES[0];
	return (
		<div ref={triggerRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen((currentOpen) => !currentOpen)}
				className="flex w-full cursor-pointer items-center justify-between gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-card-foreground transition-all hover:border-muted-foreground"
			>
				<span
					className="truncate text-[11px]"
					style={{ fontFamily: current.value }}
				>
					{current.label}
				</span>
				<ChevronDown
					className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>
			{open &&
				menuPosition &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						ref={menuRef}
						data-text-editor-safe="true"
						className="scrollbar-thin fixed z-[300] w-44 overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-xl"
						style={menuPosition}
						onWheel={(event) => event.stopPropagation()}
					>
						{FONT_FAMILIES.map((font) => (
							<button
								key={font.value}
								type="button"
								onClick={() => {
									onChange(font.value);
									setOpen(false);
								}}
								className={`w-full cursor-pointer px-3 py-2 text-left text-[12px] transition-colors hover:bg-accent ${
									value === font.value
										? "bg-primary/15 font-medium text-primary"
										: "text-popover-foreground"
								}`}
								style={{ fontFamily: font.value }}
							>
								{font.label}
							</button>
						))}
					</div>,
					document.body,
				)}
		</div>
	);
}

export function CanvasEditorClassicPropertiesPanel({
	view,
	className,
	style,
	ariaLabel,
	disabled,
	translate: t,
}: ClassicPanelProps) {
	return (
		<div
			data-text-editor-safe="true"
			className={[
				"canvas-editor__properties skedra-sdk__properties skedra-sdk__properties--classic rounded-xl border border-border bg-card/90 shadow-xl backdrop-blur-md p-2.5 space-y-2.5 text-card-foreground text-xs select-none",
				className,
			]
				.filter(Boolean)
				.join(" ")}
			style={style}
			aria-label={ariaLabel}
			aria-disabled={disabled || undefined}
			onWheel={(event) => event.stopPropagation()}
		>
			{view.isStickyNoteOnly && <StickyProperties view={view} t={t} />}
			<KanbanProperties view={view} t={t} />
			<TemplateProperties view={view} t={t} />
			<FlowchartProperties view={view} t={t} />
			<FrameProperties view={view} t={t} />
			<FrameConstraintProperties view={view} t={t} />
			<AppearanceProperties view={view} t={t} />
			<ArrowProperties view={view} t={t} />
			{view.hasTextElement && <TextProperties view={view} t={t} />}
			<SelectionFooter view={view} t={t} />
		</div>
	);
}

function StickyProperties({
	view,
	t,
}: {
	view: CanvasEditorClassicPropertiesView;
	t: CanvasEditorPropertiesTranslate;
}) {
	return (
		<>
			<Section
				label={t("canvas.properties.stickyNoteContent", "Sticky note content")}
			>
				<div className="flex gap-1">
					{(["note", "checklist"] as const).map((mode) => (
						<ChoiceButton
							key={mode}
							active={view.currentStickyNoteMode === mode}
							onClick={() => view.onSetStickyNoteMode(mode)}
							className="text-[10px]"
						>
							{mode === "note"
								? t("stickyNotes.modeNote", "Note")
								: t("stickyNotes.modeChecklist", "Checklist")}
						</ChoiceButton>
					))}
				</div>
			</Section>
			<Section
				label={t("canvas.properties.stickyNoteFill", "Sticky note color")}
			>
				<ColorGrid
					colors={STICKY_COLORS}
					active={view.currentFill}
					onSelect={(color) => view.onSetProperty("fill", color)}
					t={t}
				/>
			</Section>
		</>
	);
}

/** Anzeigenamen der Preset-Kategorien (uebersetzbar mit Fallback). */
const FRAME_PRESET_CATEGORY_LABELS: Record<
	FrameSizePreset["category"],
	{ key: string; fallback: string }
> = {
	phone: { key: "canvas.properties.framePresetPhone", fallback: "Phone" },
	tablet: { key: "canvas.properties.framePresetTablet", fallback: "Tablet" },
	desktop: {
		key: "canvas.properties.framePresetDesktop",
		fallback: "Desktop",
	},
	print: { key: "canvas.properties.framePresetPrint", fallback: "Print" },
	social: {
		key: "canvas.properties.framePresetSocial",
		fallback: "Social media",
	},
};

function framePresetCategoryLabel(
	category: FrameSizePreset["category"],
	t: CanvasEditorPropertiesTranslate,
): string {
	const entry = FRAME_PRESET_CATEGORY_LABELS[category];
	return t(entry.key, entry.fallback);
}

/** Eingabefeld fuer den Frame-Namen; committet bei Blur und Enter. */
function FrameNameInput({
	frame,
	onSetFrameLabel,
	t,
}: {
	frame: CanvasElement;
	onSetFrameLabel: (label: string) => void;
	t: CanvasEditorPropertiesTranslate;
}) {
	const [draft, setDraft] = useState(frame.frameLabel ?? "");
	/* Bei Frame-Wechsel oder externem Rename (Inline-Editor) neu uebernehmen */
	useEffect(() => {
		setDraft(frame.frameLabel ?? "");
	}, [frame.frameLabel]);
	const commit = () => {
		const next = draft.trim();
		if (next === (frame.frameLabel ?? "")) return;
		onSetFrameLabel(next);
	};
	return (
		<input
			type="text"
			value={draft}
			placeholder={t("canvas.properties.frameDefault", "Frame")}
			onChange={(event) => setDraft(event.target.value)}
			onBlur={commit}
			onKeyDown={(event) => {
				if (event.key === "Enter") event.currentTarget.blur();
				if (event.key === "Escape") {
					setDraft(frame.frameLabel ?? "");
					event.currentTarget.blur();
				}
			}}
			className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] text-card-foreground outline-none transition-colors focus:border-primary"
		/>
	);
}

/** Auswahl-Optionen fuer eine Constraint-Achse (Reihenfolge = Anzeige). */
const FRAME_CONSTRAINT_OPTIONS: ReadonlyArray<{
	value: FrameConstraintAxis;
	key: string;
	fallbackH: string;
	fallbackV: string;
}> = [
	{
		value: "start",
		key: "canvas.properties.constraintStart",
		fallbackH: "Left",
		fallbackV: "Top",
	},
	{
		value: "end",
		key: "canvas.properties.constraintEnd",
		fallbackH: "Right",
		fallbackV: "Bottom",
	},
	{
		value: "center",
		key: "canvas.properties.constraintCenter",
		fallbackH: "Center",
		fallbackV: "Center",
	},
	{
		value: "stretch",
		key: "canvas.properties.constraintStretch",
		fallbackH: "Stretch",
		fallbackV: "Stretch",
	},
	{
		value: "scale",
		key: "canvas.properties.constraintScale",
		fallbackH: "Scale",
		fallbackV: "Scale",
	},
];

/**
 * Constraints fuer Frame-Kinder: steuert, wie das Element beim Resize des
 * umgebenden Frames mitwandert. Gemischte Selektionen zeigen den ersten Wert.
 */
function FrameConstraintProperties({
	view,
	t,
}: {
	view: CanvasEditorClassicPropertiesView;
	t: CanvasEditorPropertiesTranslate;
}) {
	const children = view.frameChildElements ?? [];
	if (children.length === 0 || !view.onSetFrameChildConstraints) return null;
	const current = readFrameConstraints(children[0]);

	const renderAxis = (
		axis: "horizontal" | "vertical",
		activeValue: FrameConstraintAxis,
	) => (
		<div className="flex gap-1">
			{FRAME_CONSTRAINT_OPTIONS.map((option) => (
				<ChoiceButton
					key={option.value}
					active={activeValue === option.value}
					onClick={() =>
						view.onSetFrameChildConstraints?.({ [axis]: option.value })
					}
					className="text-[9px]"
					title={
						axis === "horizontal"
							? t(`${option.key}H`, option.fallbackH)
							: t(`${option.key}V`, option.fallbackV)
					}
				>
					{axis === "horizontal"
						? t(`${option.key}H`, option.fallbackH)
						: t(`${option.key}V`, option.fallbackV)}
				</ChoiceButton>
			))}
		</div>
	);

	return (
		<Section label={t("canvas.properties.frameConstraints", "Constraints")}>
			<div className="space-y-1.5">
				<div>
					<p className="mb-0.5 text-[9px] text-muted-foreground uppercase tracking-wider">
						{t("canvas.properties.constraintHorizontal", "Horizontal")}
					</p>
					{renderAxis("horizontal", current.horizontal)}
				</div>
				<div>
					<p className="mb-0.5 text-[9px] text-muted-foreground uppercase tracking-wider">
						{t("canvas.properties.constraintVertical", "Vertical")}
					</p>
					{renderAxis("vertical", current.vertical)}
				</div>
			</div>
		</Section>
	);
}

/**
 * Frame-Optionen: Name, eigene Groesse und Standard-Bildschirmgroessen.
 * Sichtbar bei selektiertem einfachen Frame oder aktivem Frame-Werkzeug.
 */
function FrameProperties({
	view,
	t,
}: {
	view: CanvasEditorClassicPropertiesView;
	t: CanvasEditorPropertiesTranslate;
}) {
	const frame = view.frameElement ?? null;
	const showPresets = frame != null || view.framePresetToolActive === true;
	if (!showPresets) return null;

	const applyPreset = (preset: FrameSizePreset) => {
		if (frame) view.onApplyFramePreset?.(preset);
		else view.onStartFramePresetPlacement?.(preset);
	};

	return (
		<>
			{frame && (
				<Section label={t("canvas.properties.frameName", "Frame name")}>
					{view.onSetFrameLabel && (
						<FrameNameInput
							frame={frame}
							onSetFrameLabel={view.onSetFrameLabel}
							t={t}
						/>
					)}
					{view.onRenameFrame && (
						<button
							type="button"
							onClick={view.onRenameFrame}
							className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded border border-border py-1.5 transition-all hover:border-primary hover:bg-primary/10"
						>
							<Pencil className="h-3.5 w-3.5" />
							<span>
								{t("canvas.properties.frameRenameOnCanvas", "Rename on canvas")}
							</span>
						</button>
					)}
				</Section>
			)}
			{frame && view.onExportFrame && (
				<Section label={t("canvas.properties.frameExport", "Export frame")}>
					<div className="flex gap-1">
						{(["png", "svg"] as const).map((format) => (
							<ChoiceButton
								key={format}
								active={false}
								onClick={() => view.onExportFrame?.(format)}
								className="text-[10px] uppercase"
							>
								{format}
							</ChoiceButton>
						))}
					</div>
				</Section>
			)}
			{frame && view.onSetFrameSize && (
				<Section label={t("canvas.properties.dimensions", "Dimensions")}>
					<div className="grid grid-cols-2 gap-1">
						<DimensionInput
							label={t("canvas.properties.width", "Width")}
							value={Math.round(frame.width)}
							onCommit={(value) =>
								view.onSetFrameSize?.({
									width: value,
									height: Math.round(frame.height),
								})
							}
						/>
						<DimensionInput
							label={t("canvas.properties.height", "Height")}
							value={Math.round(frame.height)}
							onCommit={(value) =>
								view.onSetFrameSize?.({
									width: Math.round(frame.width),
									height: value,
								})
							}
						/>
					</div>
				</Section>
			)}
			<Section label={t("canvas.properties.framePresetSizes", "Preset sizes")}>
				{!frame && (
					<p className="mb-1.5 text-[10px] text-muted-foreground">
						{t(
							"canvas.properties.framePresetPlaceHint",
							"Pick a size, then click the canvas to place the frame.",
						)}
					</p>
				)}
				<div className="scrollbar-thin max-h-56 space-y-2 overflow-y-auto pr-0.5">
					{FRAME_SIZE_PRESET_CATEGORIES.map((category) => {
						const presets = getFrameSizePresetsByCategory(category);
						if (presets.length === 0) return null;
						return (
							<div key={category}>
								<p className="mb-0.5 text-[9px] text-muted-foreground uppercase tracking-wider">
									{framePresetCategoryLabel(category, t)}
								</p>
								<div className="space-y-0.5">
									{presets.map((preset) => {
										const active =
											frame != null &&
											Math.round(frame.width) === preset.width &&
											Math.round(frame.height) === preset.height;
										return (
											<button
												key={preset.id}
												type="button"
												onClick={() => applyPreset(preset)}
												className={`flex w-full cursor-pointer items-center justify-between rounded border px-2 py-1 text-[10px] transition-all ${
													active
														? "border-primary bg-primary/15 text-card-foreground"
														: "border-border text-muted-foreground hover:border-primary hover:bg-primary/10 hover:text-card-foreground"
												}`}
											>
												<span className="truncate">{preset.name}</span>
												<span className="ml-2 shrink-0 tabular-nums">
													{preset.width}×{preset.height}
												</span>
											</button>
										);
									})}
								</div>
							</div>
						);
					})}
				</div>
			</Section>
		</>
	);
}

function KanbanProperties({
	view,
	t,
}: {
	view: CanvasEditorClassicPropertiesView;
	t: CanvasEditorPropertiesTranslate;
}) {
	const actionClass =
		"w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-border hover:border-primary hover:bg-primary/10 transition-all cursor-pointer";
	return (
		<>
			{view.isKanbanListSelection && view.kanbanList && (
				<>
					<Section label={t("canvas.properties.listTitle", "List title")}>
						<button
							type="button"
							onClick={view.onOpenKanbanList}
							className={actionClass}
						>
							<Pencil className="h-3.5 w-3.5" />
							<span>{t("canvas.properties.editTitle", "Edit title")}</span>
						</button>
					</Section>
					<Section label={t("canvas.properties.actions", "Actions")}>
						<button
							type="button"
							onClick={view.onAddKanbanCard}
							className={actionClass}
						>
							<Plus className="h-3.5 w-3.5" />
							<span>{t("canvas.properties.addCard", "Add card")}</span>
						</button>
					</Section>
				</>
			)}
			{view.isKanbanCardSelection && (
				<Section label={t("canvas.properties.priority", "Priority")}>
					<div className="grid grid-cols-2 gap-1">
						<button
							type="button"
							onClick={() => view.onSetKanbanPriority(null)}
							className={`py-1 px-1.5 rounded border transition-all cursor-pointer flex items-center gap-1 ${
								view.currentPriority === null
									? "border-primary bg-primary/20"
									: "border-border hover:border-muted-foreground"
							}`}
						>
							<div
								className="w-2.5 h-2.5 rounded-sm"
								style={{
									backgroundColor: "var(--kanban-priority-none, #adb5bd)",
								}}
							/>
							<span className="text-[10px]">{t("common.none", "None")}</span>
						</button>
						{KANBAN_PRIORITIES.map((priority) => (
							<button
								key={priority.value}
								type="button"
								onClick={() => view.onSetKanbanPriority(priority.value)}
								className={`py-1 px-1.5 rounded border transition-all cursor-pointer flex items-center gap-1 ${
									view.currentPriority === priority.value
										? "border-primary bg-primary/20"
										: "border-border hover:border-muted-foreground"
								}`}
							>
								<div
									className="w-2.5 h-2.5 rounded-sm"
									style={{ backgroundColor: priority.color }}
								/>
								<span className="text-[10px]">
									{t(priority.labelKey, priority.fallback)}
								</span>
							</button>
						))}
					</div>
				</Section>
			)}
			{view.isKanbanCardSelection && view.selected.length === 1 && (
				<Section label={t("canvas.properties.actions", "Actions")}>
					<button
						type="button"
						onClick={view.onOpenKanbanCard}
						className={actionClass}
					>
						<Pencil className="h-3.5 w-3.5" />
						<span>{t("canvas.properties.editDetails", "Edit details")}</span>
					</button>
				</Section>
			)}
		</>
	);
}

function TemplateProperties({
	view,
	t,
}: {
	view: CanvasEditorClassicPropertiesView;
	t: CanvasEditorPropertiesTranslate;
}) {
	return (
		<>
			{view.templateSection && view.selected.length === 1 && (
				<>
					<Section
						label={t("canvas.properties.templateSection", "Template section")}
					>
						<div className="rounded border border-border px-2 py-1.5 text-[11px] text-muted-foreground">
							{t(
								`canvas.templateTools.sections.${view.templateSection.templateTool}.${view.templateSection.templateSectionId}`,
								view.templateSection.templateSectionId,
							)}
						</div>
					</Section>
					<Section label={t("canvas.properties.actions", "Actions")}>
						<button
							type="button"
							onClick={view.onAddTemplateNote}
							className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-border hover:border-primary hover:bg-primary/10 transition-all cursor-pointer"
						>
							<Plus className="h-3.5 w-3.5" />
							<span>{t("canvas.templateTools.addNote", "Add note")}</span>
						</button>
					</Section>
				</>
			)}
			{view.isTemplateNoteSelection && view.templateNoteMeta && (
				<Section
					label={t("canvas.properties.templateNoteType", "Template note")}
				>
					<div className="space-y-2">
						<div className="flex items-center gap-2 rounded border border-border px-2 py-1.5">
							<div
								className="h-2.5 w-2.5 rounded-full"
								style={{
									backgroundColor: view.templateNoteMeta.templateAccent,
								}}
							/>
							<span className="text-[11px] font-medium">
								{t(
									`canvas.templateTools.noteTypes.${view.templateNoteMeta.templateNoteType}`,
									view.templateNoteMeta.templateNoteType,
								)}
							</span>
						</div>
						<div className="rounded border border-border px-2 py-1.5 text-[11px] text-muted-foreground">
							{t(
								`canvas.templateTools.sections.${view.templateNoteMeta.templateTool}.${view.templateNoteMeta.templateSectionId}`,
								view.templateNoteMeta.templateSectionId,
							)}
						</div>
					</div>
				</Section>
			)}
		</>
	);
}

function FlowchartProperties({
	view,
	t,
}: {
	view: CanvasEditorClassicPropertiesView;
	t: CanvasEditorPropertiesTranslate;
}) {
	const nodeKinds: FlowchartNodeKind[] = ["start", "step", "decision", "end"];
	const gridButton =
		"min-h-9 rounded border px-2 py-1.5 text-[11px] text-center leading-tight whitespace-normal wrap-break-word transition-all cursor-pointer";
	const actionButton =
		"flex min-h-11 items-center justify-center gap-1.5 rounded border border-border px-2 py-1.5 text-center leading-tight whitespace-normal wrap-break-word hover:border-primary hover:bg-primary/10 transition-all cursor-pointer sm:flex-col sm:gap-0.5";
	return (
		<>
			{view.flowchartNodeMeta && view.flowchartNode && (
				<>
					<Section
						label={t("canvas.properties.flowchartNodeType", "Flowchart node")}
					>
						<div className="space-y-2 rounded border border-border px-2 py-1.5">
							<div className="text-[11px] text-muted-foreground">
								{t(
									`canvas.flowchart.nodeKinds.${view.flowchartNodeMeta.flowchartNodeKind}`,
									view.flowchartNodeMeta.flowchartNodeKind,
								)}
							</div>
							<button
								type="button"
								onClick={view.onEditFlowchartNodeText}
								className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded border border-border px-2 py-1.5 text-center text-[11px] leading-tight transition-all cursor-pointer hover:border-primary hover:bg-primary/10"
							>
								<Pencil className="h-3.5 w-3.5" />
								<span>
									{t("canvas.flowchart.editNodeText", "Edit node text")}
								</span>
							</button>
							<p className="text-[10px] leading-tight text-muted-foreground/80">
								{t("canvas.flowchart.doubleClickHint", "Double-click to edit")}
							</p>
						</div>
					</Section>
					<Section label={t("canvas.properties.nodeType", "Node type")}>
						<div className="grid grid-cols-2 gap-1.5">
							{nodeKinds.map((kind) => (
								<button
									key={kind}
									type="button"
									onClick={() => view.onSetFlowchartNodeKind(kind)}
									className={`${gridButton} ${
										view.flowchartNodeMeta?.flowchartNodeKind === kind
											? "border-primary bg-primary/10 text-primary"
											: "border-border hover:border-primary hover:bg-primary/5"
									}`}
								>
									{t(`canvas.flowchart.nodeKinds.${kind}`, kind)}
								</button>
							))}
						</div>
					</Section>
					<Section
						label={t("canvas.flowchart.insertNodeKind", "New node type")}
					>
						<div className="grid grid-cols-2 gap-1.5">
							{nodeKinds.map((kind) => (
								<button
									key={kind}
									type="button"
									onClick={() => view.onSetFlowchartInsertKind(kind)}
									className={`${gridButton} ${
										view.flowchartInsertKind === kind
											? "border-primary bg-primary/10 text-primary"
											: "border-border hover:border-primary hover:bg-primary/5"
									}`}
								>
									{t(`canvas.flowchart.nodeKinds.${kind}`, kind)}
								</button>
							))}
						</div>
					</Section>
					<Section label={t("canvas.properties.actions", "Actions")}>
						<div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
							<button
								type="button"
								onClick={() => view.onAddFlowchartNodeOnSide("up")}
								className={actionButton}
							>
								<ArrowUp className="h-3.5 w-3.5" />
								<span>{t("canvas.flowchart.attachTop", "Attach top")}</span>
							</button>
							<button
								type="button"
								onClick={() =>
									view.onAddFlowchartNodeOnSide(
										"right",
										view.flowchartNodeMeta?.flowchartNodeKind === "decision"
											? {
													branch: "yes",
													label: t("templateContent.flowchart.yes", "Yes"),
												}
											: undefined,
									)
								}
								className={actionButton}
							>
								<ArrowRight className="h-3.5 w-3.5" />
								<span>
									{view.flowchartNodeMeta.flowchartNodeKind === "decision"
										? t("canvas.flowchart.addYesBranch", "Add yes branch")
										: t("canvas.flowchart.attachRight", "Attach right")}
								</span>
							</button>
							<button
								type="button"
								onClick={() =>
									view.onAddFlowchartNodeOnSide(
										"down",
										view.flowchartNodeMeta?.flowchartNodeKind === "decision"
											? {
													branch: "no",
													label: t("templateContent.flowchart.no", "No"),
												}
											: undefined,
									)
								}
								className={actionButton}
							>
								<ArrowDown className="h-3.5 w-3.5" />
								<span>
									{view.flowchartNodeMeta.flowchartNodeKind === "decision"
										? t("canvas.flowchart.addNoBranch", "Add no branch")
										: t("canvas.flowchart.attachBottom", "Attach bottom")}
								</span>
							</button>
							<button
								type="button"
								onClick={() => view.onAddFlowchartNodeOnSide("left")}
								className={actionButton}
							>
								<ArrowLeft className="h-3.5 w-3.5" />
								<span>{t("canvas.flowchart.attachLeft", "Attach left")}</span>
							</button>
						</div>
					</Section>
				</>
			)}
			{view.flowchartConnectorMeta && view.flowchartConnector && (
				<Section
					label={t(
						"canvas.properties.flowchartConnectorLabel",
						"Connector label",
					)}
				>
					<div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
						{(["yes", "no"] as const).map((label) => (
							<button
								key={label}
								type="button"
								onClick={() =>
									view.onSetFlowchartConnectorLabel(
										t(`templateContent.flowchart.${label}`, label),
									)
								}
								className="min-h-10 rounded border border-border px-2 py-1.5 text-center hover:border-primary hover:bg-primary/10 transition-all cursor-pointer"
							>
								{t(`templateContent.flowchart.${label}`, label)}
							</button>
						))}
						<button
							type="button"
							onClick={view.onEditFlowchartConnectorLabel}
							className="min-h-10 rounded border border-border px-2 py-1.5 text-center hover:border-primary hover:bg-primary/10 transition-all cursor-pointer"
						>
							{t("canvas.flowchart.editConnectorLabel", "Edit label")}
						</button>
						<button
							type="button"
							onClick={() => view.onSetFlowchartConnectorLabel(undefined)}
							className="min-h-10 rounded border border-border px-2 py-1.5 text-center hover:border-primary hover:bg-primary/10 transition-all cursor-pointer"
						>
							{t("canvas.flowchart.clearConnectorLabel", "Clear label")}
						</button>
					</div>
				</Section>
			)}
		</>
	);
}

function FillStylePreview({ style }: { style: RoughFillStyle }) {
	if (style === "solid") {
		return <div className="h-3.5 w-3.5 rounded-sm bg-current opacity-80" />;
	}
	if (style === "dots") {
		return (
			<svg aria-hidden="true" viewBox="0 0 14 14" className="h-3.5 w-3.5">
				<rect
					x="1"
					y="1"
					width="12"
					height="12"
					fill="none"
					stroke="currentColor"
				/>
				<circle cx="4" cy="4" r="0.8" fill="currentColor" />
				<circle cx="8" cy="4" r="0.8" fill="currentColor" />
				<circle cx="4" cy="8" r="0.8" fill="currentColor" />
				<circle cx="8" cy="8" r="0.8" fill="currentColor" />
			</svg>
		);
	}
	return (
		<svg aria-hidden="true" viewBox="0 0 14 14" className="h-3.5 w-3.5">
			<rect
				x="1"
				y="1"
				width="12"
				height="12"
				fill="none"
				stroke="currentColor"
			/>
			<line
				x1="2"
				y1="12"
				x2="12"
				y2="2"
				stroke="currentColor"
				strokeDasharray={style === "dashed" ? "2 2" : undefined}
			/>
			{style === "cross-hatch" && (
				<line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" />
			)}
		</svg>
	);
}

function RoughnessPreview({ value }: { value: number }) {
	return (
		<svg aria-hidden="true" viewBox="0 0 20 12" className="h-3 w-5">
			{value === 0 ? (
				<line
					x1="2"
					y1="6"
					x2="18"
					y2="6"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
			) : value === 1 ? (
				<path
					d="M2 7 Q6 4, 10 6 T18 5"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
			) : (
				<path
					d="M2 8 Q5 2, 8 7 T14 4 T18 6"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
			)}
		</svg>
	);
}

function AppearanceProperties({
	view,
	t,
}: {
	view: CanvasEditorClassicPropertiesView;
	t: CanvasEditorPropertiesTranslate;
}) {
	return (
		<>
			{view.showStroke && (
				<div data-property-focus="stroke">
					<Section
						label={
							view.isTextOnly
								? t("canvas.properties.color", "Color")
								: view.hasMindmapBranch
									? t("canvas.properties.branchColor", "Branch color")
									: view.selectedTemplateSection
										? t("canvas.properties.templateSection", "Template section")
										: t("canvas.properties.stroke", "Stroke")
						}
					>
						<ColorGrid
							colors={view.strokeColors}
							active={view.currentStroke}
							onSelect={(color) => view.onSetProperty("stroke", color)}
							t={t}
						/>
					</Section>
				</div>
			)}
			{view.showBackgroundFill && (
				<div data-property-focus="fill">
					<Section
						label={
							view.selectedTemplateSection
								? t("canvas.properties.stickyNoteFill", "Sticky note color")
								: t("canvas.properties.background", "Background")
						}
					>
						<ColorGrid
							colors={BG_COLORS}
							active={view.currentFill}
							onSelect={(color) => view.onSetProperty("fill", color)}
							t={t}
						/>
					</Section>
				</div>
			)}
			{view.showGeometryFill && (
				<div data-property-focus="fill">
					<Section label={t("canvas.properties.roughFillStyle", "Fill")}>
						<ColorGrid
							colors={BG_COLORS}
							active={view.currentFill}
							onSelect={(color) => view.onSetProperty("fill", color)}
							t={t}
						/>
						<p className="mt-2 mb-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
							{t("canvas.properties.fillPattern", "Fill pattern")}
						</p>
						<div className="flex gap-1 flex-wrap">
							{ROUGH_FILL_STYLES.map((style) => (
								<ChoiceButton
									key={style}
									active={view.currentRoughFillStyle === style}
									onClick={() => view.onSetProperty("roughFillStyle", style)}
									className="min-w-[2.5rem] text-card-foreground"
									title={t(`canvas.properties.fill${style}`, style)}
								>
									<FillStylePreview style={style} />
								</ChoiceButton>
							))}
						</div>
						{view.showRoughFillScale && (
							<div className="mt-2">
								<p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
									{t(
										"canvas.properties.roughFillScale",
										`Pattern scale (${view.roughFillScalePercent}%)`,
										{ value: view.roughFillScalePercent },
									)}
								</p>
								<input
									type="range"
									min={Math.round(MIN_ROUGH_FILL_SCALE * 100)}
									max={Math.round(MAX_ROUGH_FILL_SCALE * 100)}
									step={5}
									value={view.roughFillScalePercent}
									onChange={(event) =>
										view.onSetProperty(
											"roughFillScale",
											Number(event.target.value) / 100,
										)
									}
									className="w-full h-1 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
								/>
							</div>
						)}
					</Section>
				</div>
			)}
			{view.showStrokeWidth && (
				<Section label={t("canvas.properties.strokeWidth", "Stroke width")}>
					<div className="flex gap-1">
						{STROKE_WIDTHS.map((width) => (
							<ChoiceButton
								key={width}
								active={view.currentStrokeWidth === width}
								onClick={() => view.onSetProperty("strokeWidth", width)}
								title={t(
									`canvas.properties.${width === 1 ? "thin" : width === 2 ? "medium" : "thick"}`,
									String(width),
								)}
							>
								<div
									className="rounded-full bg-card-foreground"
									style={{ width: width * 5 + 6, height: width + 1 }}
								/>
							</ChoiceButton>
						))}
					</div>
				</Section>
			)}
			{view.showStrokeStyle && (
				<Section label={t("canvas.properties.strokeStyle", "Stroke style")}>
					<div className="flex gap-1">
						{STROKE_STYLES.map((style) => (
							<ChoiceButton
								key={style}
								active={view.currentStrokeStyle === style}
								onClick={() => view.onSetProperty("strokeStyle", style)}
								title={t(`canvas.properties.${style}`, style)}
							>
								<div
									className={`h-0.5 w-6 border-current ${
										style === "solid"
											? "bg-current"
											: style === "dashed"
												? "border-t-2 border-dashed"
												: "border-t-2 border-dotted"
									}`}
								/>
							</ChoiceButton>
						))}
					</div>
				</Section>
			)}
			{view.showRoughness && (
				<Section label={t("canvas.properties.roughness", "Roughness")}>
					<div className="flex gap-1">
						{ROUGHNESS_LEVELS.map((value) => (
							<ChoiceButton
								key={value}
								active={view.currentRoughness === value}
								onClick={() => view.onSetProperty("roughness", value)}
								title={t(
									`canvas.properties.${value === 0 ? "exact" : value === 1 ? "light" : "strong"}`,
									String(value),
								)}
							>
								<RoughnessPreview value={value} />
							</ChoiceButton>
						))}
					</div>
				</Section>
			)}
			{view.showCornerRadius && (
				<Section
					label={t(
						"canvas.properties.cornersWithPercent",
						`Corners (${view.currentCornerRadiusPercent}%)`,
						{ value: view.currentCornerRadiusPercent },
					)}
				>
					<div className="flex gap-1">
						{CORNER_RADIUS_PRESETS.map((percent) => (
							<ChoiceButton
								key={percent}
								active={
									Math.abs(view.currentCornerRadiusPercent - percent) <= 2 ||
									(percent === 100 && view.currentCornerRadiusPercent >= 98)
								}
								onClick={() =>
									view.onSetProperty("cornerRadiusPercent", percent)
								}
							>
								<div
									className="w-3.5 h-3.5 border-2 border-card-foreground/60"
									style={{
										borderRadius:
											percent === 0
												? 0
												: percent >= 100
													? "50%"
													: `${percent}%`,
									}}
								/>
							</ChoiceButton>
						))}
					</div>
					<input
						type="range"
						min={0}
						max={100}
						step={1}
						value={view.currentCornerRadiusPercent}
						onChange={(event) =>
							view.onSetProperty(
								"cornerRadiusPercent",
								Number(event.target.value),
							)
						}
						className="mt-2 w-full h-1 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
					/>
					<div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground uppercase tracking-wider">
						<span>{t("canvas.properties.square", "Square")}</span>
						<span>
							{Math.round(
								(view.currentCornerRadiusPercent / 100) *
									(Math.min(view.cornerRadiusWidth, view.cornerRadiusHeight) /
										2),
							)}
							px
						</span>
						<span>{t("canvas.properties.pill", "Pill")}</span>
					</div>
				</Section>
			)}
			{view.showDimensions &&
				(view.singleGeometryElement || view.geometryPresetTool) && (
					<Section label={t("canvas.properties.dimensions", "Dimensions")}>
						<div className="grid grid-cols-2 gap-1">
							<DimensionInput
								label={t("canvas.properties.width", "Width")}
								value={view.currentShapeWidth}
								onCommit={view.onSetGeometryWidth}
							/>
							<DimensionInput
								label={t("canvas.properties.height", "Height")}
								value={view.currentShapeHeight}
								onCommit={view.onSetGeometryHeight}
							/>
						</div>
						{(view.singleGeometryElement?.type === "ellipse" ||
							view.geometryPresetTool === "ellipse") && (
							<div className="mt-1.5">
								<DimensionInput
									label={t("canvas.properties.diameter", "Diameter")}
									value={view.ellipseDiameter}
									onCommit={view.onSetEllipseDiameter}
								/>
							</div>
						)}
						{view.geometryPresetTool && (
							<button
								type="button"
								onClick={view.onStartPresetGeometryPlacement}
								className="mt-1.5 w-full rounded border border-border px-2 py-1.5 text-[10px] font-medium text-card-foreground transition-all hover:border-primary hover:bg-primary/10 cursor-pointer"
							>
								{view.geometryPresetTool === "ellipse"
									? t(
											"canvas.properties.placeCircleCentered",
											"Place circle centered",
										)
									: t(
											"canvas.properties.placeShapeCentered",
											"Place shape centered",
										)}
							</button>
						)}
					</Section>
				)}
			{view.showPolygonOptions && (
				<Section label={t("canvas.properties.polygon", "Polygon")}>
					<div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
						<span>{t("canvas.properties.polygonSides", "Corners")}</span>
						<span className="font-medium text-card-foreground">
							{view.currentPolygonSides}
						</span>
					</div>
					<input
						type="range"
						min={MIN_POLYGON_SIDES}
						max={MAX_POLYGON_SIDES}
						step={1}
						value={view.currentPolygonSides}
						onChange={(event) =>
							view.onSetProperty("polygonSides", Number(event.target.value))
						}
						className="mt-2 w-full h-1 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
					/>
					<div className="mt-2 grid grid-cols-6 gap-1">
						{[4, 5, 6, 8, 10, 12].map((sides) => (
							<ChoiceButton
								key={sides}
								active={view.currentPolygonSides === sides}
								onClick={() => view.onSetProperty("polygonSides", sides)}
							>
								{sides}
							</ChoiceButton>
						))}
					</div>
					<p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">
						{view.currentPolygonSides === 4
							? t(
									"canvas.properties.polygonFourHint",
									"Four corners preserve the original rectangle or diamond.",
								)
							: t(
									"canvas.properties.polygonMultiHint",
									"The polygon adapts automatically when the shape is resized.",
								)}
					</p>
				</Section>
			)}
			{view.showPyramidOptions && (
				<Section
					label={t("canvas.properties.pyramidDiagram", "Pyramid diagram")}
				>
					<div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
						<span>{t("canvas.properties.pyramidSections", "Sections")}</span>
						<span className="font-medium text-card-foreground">
							{view.currentPyramidSections}
						</span>
					</div>
					<input
						type="range"
						min={1}
						max={12}
						step={1}
						value={view.currentPyramidSections}
						onChange={(event) =>
							view.onSetProperty("pyramidSections", Number(event.target.value))
						}
						className="mt-2 w-full h-1 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
					/>
					<div className="mt-2 grid grid-cols-6 gap-1">
						{[1, 2, 3, 4, 5, 6].map((sections) => (
							<ChoiceButton
								key={sections}
								active={view.currentPyramidSections === sections}
								onClick={() => view.onSetProperty("pyramidSections", sections)}
							>
								{sections}
							</ChoiceButton>
						))}
					</div>
					<p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">
						{view.currentPyramidSections === 1
							? t(
									"canvas.properties.pyramidSingleHint",
									"A single section renders a regular triangle.",
								)
							: t(
									"canvas.properties.pyramidMultiHint",
									"Dividers adapt automatically when the pyramid is resized.",
								)}
					</p>
				</Section>
			)}
			{view.showCloudArcRadius && (
				<Section label={t("canvas.properties.cloudArcs", "Cloud arcs")}>
					<div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
						<span>{t("canvas.properties.cloudArcRadius", "Arc radius")}</span>
						<span className="font-medium text-card-foreground">
							{Math.round(view.currentCloudArcRadius)}px
						</span>
					</div>
					<input
						type="range"
						min={MIN_CLOUD_ARC_RADIUS}
						max={MAX_CLOUD_ARC_RADIUS}
						step={1}
						value={view.currentCloudArcRadius}
						onChange={(event) =>
							view.onSetProperty("cloudArcRadius", Number(event.target.value))
						}
						className="mt-2 w-full h-1 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
					/>
					<div className="mt-2 grid grid-cols-5 gap-1">
						{[6, 12, 18, 28, 40].map((radius) => (
							<ChoiceButton
								key={radius}
								active={Math.round(view.currentCloudArcRadius) === radius}
								onClick={() => view.onSetProperty("cloudArcRadius", radius)}
							>
								{radius}
							</ChoiceButton>
						))}
					</div>
					<p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">
						{t(
							"canvas.properties.cloudArcRadiusHint",
							"Smaller values create more, tighter arcs; larger values create broader arcs.",
						)}
					</p>
				</Section>
			)}
			<Section
				label={t(
					"canvas.properties.opacity",
					`Opacity (${view.currentOpacity}%)`,
					{ value: view.currentOpacity },
				)}
			>
				<input
					type="range"
					min={0}
					max={100}
					value={view.currentOpacity}
					onChange={(event) =>
						view.onSetProperty("opacity", Number(event.target.value))
					}
					className="w-full h-1 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
				/>
			</Section>
		</>
	);
}

function PathModePreview({ mode }: { mode: CanvasPathModeOption }) {
	return (
		<svg aria-hidden="true" viewBox="0 0 20 12" className="h-3 w-5">
			{mode === "curve" ? (
				<path
					d="M2 9 C6 1 11 1 18 7"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
			) : (
				<polyline
					points="2,9 7,3 12,9 18,3"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinejoin="round"
				/>
			)}
		</svg>
	);
}

function ArrowHeadPreview({ head }: { head: ArrowHead }) {
	return (
		<svg aria-hidden="true" viewBox="0 0 20 12" className="h-3 w-5">
			<line
				x1="2"
				y1="6"
				x2={head === "none" ? "16" : "13"}
				y2="6"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			{head === "arrow" && (
				<path
					d="M 11 2.5 L 17 6 L 11 9.5"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
			)}
			{head === "triangle" && (
				<polygon points="18,6 12,2 12,10" fill="currentColor" />
			)}
			{head === "dot" && <circle cx="15" cy="6" r="3" fill="currentColor" />}
		</svg>
	);
}

function ArrowProperties({
	view,
	t,
}: {
	view: CanvasEditorClassicPropertiesView;
	t: CanvasEditorPropertiesTranslate;
}) {
	const arrowHeadScalePercent = Math.round(
		(view.currentArrowHeadScale ?? DEFAULT_ARROW_HEAD_SCALE) * 100,
	);
	const filled = view.currentArrowHeadFilled ?? DEFAULT_ARROW_HEAD_FILLED;
	return (
		<>
			{view.showPathDrawMode && (
				<Section
					label={t(
						view.isCloudDrawMode
							? "canvas.properties.cloudDrawMode"
							: "canvas.properties.pathDrawMode",
						"Drawing mode",
					)}
				>
					<div className="flex gap-1">
						{(["normal", "multi"] as const).map((mode) => (
							<ChoiceButton
								key={mode}
								active={view.pathDrawMode === mode}
								onClick={() => view.onPathDrawModeChange(mode)}
								className="text-[10px] font-medium"
							>
								{view.isCloudDrawMode
									? mode === "normal"
										? t("canvas.properties.cloudDrawRectangle", "Rectangle")
										: t("canvas.properties.cloudDrawPoints", "Point by point")
									: mode === "normal"
										? t("canvas.properties.pathDrawNormal", "Single path")
										: t("canvas.properties.pathDrawMulti", "Multiline path")}
							</ChoiceButton>
						))}
					</div>
				</Section>
			)}
			{view.isPathElement && (
				<Section label={t("canvas.properties.pathStyle", "Path style")}>
					<div className="flex gap-1">
						{CANVAS_PATH_MODE_OPTIONS.map((mode) => (
							<ChoiceButton
								key={mode}
								active={
									resolveCanvasEditorPathMode(view.currentArrowMode) === mode
								}
								onClick={() => view.onSetProperty("arrowMode", mode)}
								title={t(
									`canvas.properties.${mode === "straight" ? "cornered" : "curve"}`,
									mode,
								)}
							>
								<PathModePreview mode={mode} />
							</ChoiceButton>
						))}
					</div>
				</Section>
			)}
			{view.showPathClosed && (
				<Section label={t("canvas.properties.pathClosure", "Path closure")}>
					<div className="flex gap-1">
						{([false, true] as const).map((closed) => (
							<ChoiceButton
								key={String(closed)}
								active={view.currentPathClosed === closed}
								onClick={() => view.onSetProperty("closed", closed)}
								className="text-[10px] font-medium"
							>
								{closed
									? t("canvas.properties.pathClosed", "Closed")
									: t("canvas.properties.pathOpen", "Open")}
							</ChoiceButton>
						))}
					</div>
				</Section>
			)}
			{view.isArrowElement && (
				<Section label={t("canvas.properties.arrowHeads", "Arrow heads")}>
					{(["start", "end"] as const).map((side) => {
						const current =
							side === "start"
								? view.currentArrowHeadStart
								: view.currentArrowHeadEnd;
						return (
							<div
								key={side}
								className={`flex gap-0.5 items-center ${side === "start" ? "mb-1" : ""}`}
							>
								<span className="text-[8px] text-muted-foreground w-7 shrink-0">
									{t(`canvas.properties.${side}`, side)}
								</span>
								<div className="flex gap-1 flex-1">
									{ARROW_HEADS.map((head) => (
										<ChoiceButton
											key={head}
											active={current === head}
											onClick={() =>
												view.onSetProperty(
													side === "start" ? "arrowHeadStart" : "arrowHeadEnd",
													head,
												)
											}
											title={t(
												`canvas.properties.${head === "arrow" ? "open" : head}`,
												head,
											)}
										>
											<ArrowHeadPreview head={head} />
										</ChoiceButton>
									))}
								</div>
							</div>
						);
					})}
					{view.showArrowHeadScale && (
						<div className="mt-2">
							<p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
								{t(
									"canvas.properties.arrowHeadSize",
									`Arrow head size (${arrowHeadScalePercent}%)`,
									{ value: arrowHeadScalePercent },
								)}
							</p>
							<input
								type="range"
								min={Math.round(MIN_ARROW_HEAD_SCALE * 100)}
								max={Math.round(MAX_ARROW_HEAD_SCALE * 100)}
								step={5}
								value={arrowHeadScalePercent}
								onChange={(event) =>
									view.onSetProperty(
										"arrowHeadScale",
										Number(event.target.value) / 100,
									)
								}
								className="w-full h-1 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
							/>
						</div>
					)}
					{view.showArrowHeadFill && (
						<div className="mt-2">
							<p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
								{t("canvas.properties.arrowHeadFill", "Arrow head fill")}
							</p>
							<div className="flex gap-1">
								{([true, false] as const).map((value) => (
									<ChoiceButton
										key={String(value)}
										active={filled === value}
										onClick={() => view.onSetProperty("arrowHeadFilled", value)}
										className="text-[10px] font-medium"
									>
										{value
											? t("canvas.properties.filled", "Filled")
											: t("canvas.properties.hollow", "Hollow")}
									</ChoiceButton>
								))}
							</div>
						</div>
					)}
				</Section>
			)}
			{view.showArrowTextPosition && (
				<Section label={t("canvas.properties.arrowTextPosition", "Arrow text")}>
					<div className="flex gap-1">
						{(["above", "below"] as const).map((side) => (
							<ChoiceButton
								key={side}
								active={view.currentArrowTextSide === side}
								onClick={() => view.onArrowTextSideChange(side)}
								className="gap-1"
							>
								{side === "above" ? (
									<ArrowUp className="h-3.5 w-3.5" />
								) : (
									<ArrowDown className="h-3.5 w-3.5" />
								)}
								<span className="text-[10px] font-medium">
									{side === "above"
										? t("canvas.properties.top", "Top")
										: t("canvas.properties.bottom", "Bottom")}
								</span>
							</ChoiceButton>
						))}
					</div>
					<p className="mt-2 mb-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
						{t("canvas.properties.arrowTextOrientation", "Text orientation")}
					</p>
					<div className="flex gap-1">
						{(["horizontal", "vertical"] as const).map((orientation) => (
							<ChoiceButton
								key={orientation}
								active={view.currentArrowTextOrientation === orientation}
								onClick={() => view.onArrowTextOrientationChange(orientation)}
							>
								<span
									className="text-[11px] font-semibold leading-none"
									style={
										orientation === "vertical"
											? { writingMode: "vertical-rl" }
											: undefined
									}
								>
									Aa
								</span>
							</ChoiceButton>
						))}
					</div>
				</Section>
			)}
		</>
	);
}

function TextProperties({
	view,
	t,
}: {
	view: CanvasEditorClassicPropertiesView;
	t: CanvasEditorPropertiesTranslate;
}) {
	const textAligns = [
		{ value: "left" as const, icon: <AlignLeft className="h-3.5 w-3.5" /> },
		{
			value: "center" as const,
			icon: <AlignCenter className="h-3.5 w-3.5" />,
		},
		{
			value: "right" as const,
			icon: <AlignRight className="h-3.5 w-3.5" />,
		},
	];
	return (
		<div data-property-focus="font" className="space-y-2.5">
			<Section label={t("canvas.properties.textColor", "Text color")}>
				<ColorGrid
					colors={view.strokeColors}
					active={view.currentTextColor}
					onSelect={(color) => view.onSetProperty("textColor", color)}
					t={t}
				/>
			</Section>
			<Section label={t("canvas.properties.fontFamily", "Font family")}>
				<FontDropdown
					value={view.currentFontFamily}
					onChange={(font) => view.onSetProperty("fontFamily", font)}
				/>
			</Section>
			<Section label={t("canvas.properties.style", "Style")}>
				<div className="flex gap-1">
					<ChoiceButton
						active={view.currentFontWeight === "bold"}
						onClick={() =>
							view.onSetProperty(
								"fontWeight",
								view.currentFontWeight === "bold" ? "normal" : "bold",
							)
						}
						title={t("canvas.properties.bold", "Bold")}
					>
						<Bold className="h-3.5 w-3.5" />
					</ChoiceButton>
					<ChoiceButton
						active={view.currentFontStyle === "italic"}
						onClick={() =>
							view.onSetProperty(
								"fontStyle",
								view.currentFontStyle === "italic" ? "normal" : "italic",
							)
						}
						title={t("canvas.properties.italic", "Italic")}
					>
						<Italic className="h-3.5 w-3.5" />
					</ChoiceButton>
					<ChoiceButton
						active={view.currentTextDecoration === "underline"}
						onClick={() =>
							view.onSetProperty(
								"textDecoration",
								view.currentTextDecoration === "underline"
									? "none"
									: "underline",
							)
						}
						title={t("canvas.properties.underline", "Underline")}
					>
						<Underline className="h-3.5 w-3.5" />
					</ChoiceButton>
				</div>
			</Section>
			<Section label={t("canvas.properties.size", "Size")}>
				<div className="flex gap-1">
					{FONT_SIZES.map((size) => (
						<ChoiceButton
							key={size.value}
							active={view.currentFontSize === size.value}
							onClick={() => view.onSetProperty("fontSize", size.value)}
							className="font-medium text-[10px]"
						>
							{size.label}
						</ChoiceButton>
					))}
				</div>
			</Section>
			<Section label={t("canvas.properties.alignment", "Alignment")}>
				<div className="flex gap-1">
					{textAligns.map((align) => (
						<ChoiceButton
							key={align.value}
							active={view.currentTextAlign === align.value}
							onClick={() => view.onSetProperty("textAlign", align.value)}
							title={t(`canvas.properties.${align.value}`, align.value)}
						>
							{align.icon}
						</ChoiceButton>
					))}
				</div>
			</Section>
		</div>
	);
}

function ActionButton({
	children,
	title,
	onClick,
	danger,
	disabled,
}: {
	children: ReactNode;
	title: string;
	onClick: () => void;
	danger?: boolean;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			title={title}
			aria-label={title}
			onClick={onClick}
			disabled={disabled}
			className={`flex flex-1 items-center justify-center rounded border border-border py-1.5 transition-all ${
				disabled
					? "cursor-not-allowed opacity-40"
					: "cursor-pointer hover:border-muted-foreground"
			} ${
				danger
					? "text-destructive hover:bg-destructive/10"
					: "text-card-foreground hover:bg-accent"
			}`}
		>
			{children}
		</button>
	);
}

function SelectionFooter({
	view,
	t,
}: {
	view: CanvasEditorClassicPropertiesView;
	t: CanvasEditorPropertiesTranslate;
}) {
	const layoutItemCount = getCanvasLayoutItemCount(view.selected);
	return (
		<>
			{layoutItemCount >= 2 && (
				<Section label={t("canvas.properties.arrange", "Arrange")}>
					<div className="grid grid-cols-3 gap-1">
						{ALIGNMENT_ACTIONS.map(({ value, Icon, fallback }) => {
							const title = t(`canvas.properties.align.${value}`, fallback);
							return (
								<ActionButton
									key={value}
									title={title}
									onClick={() => view.onAlign(value)}
								>
									<Icon className="h-3.5 w-3.5" />
								</ActionButton>
							);
						})}
					</div>
					<div className="mt-1 flex gap-1">
						{DISTRIBUTION_ACTIONS.map(({ value, Icon, labelKey, fallback }) => {
							const title = t(labelKey, fallback);
							return (
								<ActionButton
									key={value}
									title={title}
									disabled={layoutItemCount < 3}
									onClick={() => view.onDistribute(value)}
								>
									<Icon className="h-3.5 w-3.5" />
								</ActionButton>
							);
						})}
					</div>
				</Section>
			)}
			{view.hasSelection && (
				<Section label={t("canvas.properties.layers", "Layers")}>
					<div className="flex gap-1">
						<ActionButton
							title={t("canvas.contextMenu.sendToBack", "Send to back")}
							onClick={view.onSendToBack}
						>
							<ChevronsDown className="h-3 w-3" />
						</ActionButton>
						<ActionButton
							title={t("canvas.contextMenu.sendBackward", "Send backward")}
							onClick={view.onSendBackward}
						>
							<ArrowDown className="h-3 w-3" />
						</ActionButton>
						<ActionButton
							title={t("canvas.contextMenu.bringForward", "Bring forward")}
							onClick={view.onBringForward}
						>
							<ArrowUp className="h-3 w-3" />
						</ActionButton>
						<ActionButton
							title={t("canvas.contextMenu.bringToFront", "Bring to front")}
							onClick={view.onBringToFront}
						>
							<ChevronsUp className="h-3 w-3" />
						</ActionButton>
					</div>
				</Section>
			)}
			{view.hasSelection && (
				<Section label={t("canvas.properties.actions", "Actions")}>
					<div className="flex gap-1">
						<ActionButton
							title={t("canvas.contextMenu.copy", "Copy")}
							onClick={view.onCopy}
						>
							<Copy className="h-3 w-3" />
						</ActionButton>
						<ActionButton
							title={t("common.delete", "Delete")}
							onClick={view.onDelete}
							danger
						>
							<Trash2 className="h-3 w-3" />
						</ActionButton>
						<ActionButton
							title={t("canvas.contextMenu.addLink", "Add link")}
							onClick={view.onAddLink}
						>
							<Link className="h-3 w-3" />
						</ActionButton>
					</div>
				</Section>
			)}
			<Section label={t("canvas.properties.drawingSurface", "Drawing surface")}>
				<div className="flex gap-1 flex-wrap">
					{view.canvasBackgroundOptions.map((background, index) => (
						<button
							key={background || "__default"}
							type="button"
							onClick={() => view.onSetCanvasBackground(background ?? "")}
							className={`w-5 h-5 rounded border-2 transition-all cursor-pointer ${
								view.canvasBackground === background
									? "border-primary scale-110"
									: "border-border hover:border-muted-foreground"
							}`}
							style={{ background: background || "var(--background)" }}
							title={
								index === 0
									? t("common.default", "Default")
									: (background ?? undefined)
							}
						/>
					))}
				</div>
			</Section>
		</>
	);
}
