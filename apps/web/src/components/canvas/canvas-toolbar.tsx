/**
 * Canvas-Toolbar: Werkzeug-Auswahl, kompaktes Einfügen-Menü und Export.
 */

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCanvasStore } from "@/hooks/use-canvas-store";
import type { ImageUploadOptions } from "@/lib/canvas/image-utils";
import { pickAndBuildImageElements } from "@/lib/canvas/insert-image";
import { useI18n } from "@/lib/i18n";
import { createFlowchartTemplate } from "@/lib/templates/flowchart";
import { createMindmapTemplate } from "@/lib/templates/mindmap";
import { createRetrospectiveTemplate } from "@/lib/templates/retrospective";
import { createSwotTemplate } from "@/lib/templates/swot";
import { useThemeStore } from "@/stores/theme";
import type { CanvasElement, ToolType } from "@skedra/canvas-core";
import {
	ArrowUpRight,
	BookOpen,
	Circle,
	Diamond,
	Download,
	Eraser,
	FolderOpen,
	Frame,
	GitBranch,
	Hand,
	History,
	Image as ImageIcon,
	ImagePlus,
	Kanban,
	Lasso,
	LayoutTemplate,
	Lock,
	Minus,
	MonitorPlay,
	MousePointer2,
	Pencil,
	Pipette,
	Save,
	Square,
	StickyNote,
	Table2,
	Type,
	Unlock,
	Zap,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

interface CanvasToolbarProps {
	workspaceSlug?: string;
	addElements: (elements: CanvasElement[]) => void;
	getViewportCenter: () => { x: number; y: number };
	onExportSkedra?: () => void;
	onExportEncryptedSkedra?: () => void;
	onImportSkedra?: () => void;
	imageUploadOptions?: ImageUploadOptions;
}

interface ToolDef {
	tool: ToolType;
	icon: React.ReactNode;
	labelKey: `canvas.toolbar.${string}`;
	shortcut: string;
}

const NAV_TOOLS: ToolDef[] = [
	{
		tool: "pan",
		icon: <Hand className="h-3.5 w-3.5" />,
		labelKey: "canvas.toolbar.pan",
		shortcut: "H",
	},
	{
		tool: "select",
		icon: <MousePointer2 className="h-3.5 w-3.5" />,
		labelKey: "canvas.toolbar.select",
		shortcut: "1",
	},
	{
		tool: "lasso",
		icon: <Lasso className="h-3.5 w-3.5" />,
		labelKey: "canvas.toolbar.lasso",
		shortcut: "",
	},
];

const DRAW_TOOLS: ToolDef[] = [
	{
		tool: "rectangle",
		icon: <Square className="h-3.5 w-3.5" />,
		labelKey: "canvas.toolbar.rectangle",
		shortcut: "2",
	},
	{
		tool: "diamond",
		icon: <Diamond className="h-3.5 w-3.5" />,
		labelKey: "canvas.toolbar.diamond",
		shortcut: "3",
	},
	{
		tool: "ellipse",
		icon: <Circle className="h-3.5 w-3.5" />,
		labelKey: "canvas.toolbar.ellipse",
		shortcut: "4",
	},
	{
		tool: "arrow",
		icon: <ArrowUpRight className="h-3.5 w-3.5" />,
		labelKey: "canvas.toolbar.arrow",
		shortcut: "5",
	},
	{
		tool: "line",
		icon: <Minus className="h-3.5 w-3.5" />,
		labelKey: "canvas.toolbar.line",
		shortcut: "6",
	},
	{
		tool: "freehand",
		icon: <Pencil className="h-3.5 w-3.5" />,
		labelKey: "canvas.toolbar.freehand",
		shortcut: "7",
	},
	{
		tool: "text",
		icon: <Type className="h-3.5 w-3.5" />,
		labelKey: "canvas.toolbar.text",
		shortcut: "8",
	},
	{
		tool: "frame",
		icon: <Frame className="h-3.5 w-3.5" />,
		labelKey: "canvas.toolbar.frame",
		shortcut: "F",
	},
];

export function CanvasToolbar({
	addElements,
	getViewportCenter,
	onExportSkedra,
	onExportEncryptedSkedra,
	onImportSkedra,
	imageUploadOptions,
}: CanvasToolbarProps) {
	const store = useCanvasStore(
		useShallow((state) => ({
			activePanel: state.activePanel,
			activeTool: state.activeTool,
			strokeColor: state.strokeColor,
			toolLocked: state.toolLocked,
			activateEyedropper: state.activateEyedropper,
			setActivePanel: state.setActivePanel,
			setActiveTool: state.setActiveTool,
			toggleToolLocked: state.toggleToolLocked,
		})),
	);
	const { t } = useI18n();
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);

	const insertAtCenter = (
		factory: (x: number, y: number) => CanvasElement[],
	) => {
		const center = getViewportCenter();
		addElements(factory(center.x, center.y));
	};

	return (
		<TooltipProvider delayDuration={300}>
			<div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 rounded-xl border border-border bg-card/90 px-1.5 py-1 shadow-xl backdrop-blur-md">
				<ToolButton
					active={store.toolLocked}
					label={
						store.toolLocked
							? `${t("canvas.toolbar.unlockTool")} (Q)`
							: `${t("canvas.toolbar.lockTool")} (Q)`
					}
					onClick={store.toggleToolLocked}
				>
					{store.toolLocked ? (
						<Lock className="h-3.5 w-3.5" />
					) : (
						<Unlock className="h-3.5 w-3.5" />
					)}
				</ToolButton>

				<Divider />

				{NAV_TOOLS.map((toolDef) => (
					<ToolButton
						key={toolDef.tool}
						active={store.activeTool === toolDef.tool}
						label={
							toolDef.shortcut
								? `${t(toolDef.labelKey)} (${toolDef.shortcut})`
								: t(toolDef.labelKey)
						}
						onClick={() => store.setActiveTool(toolDef.tool)}
					>
						{toolDef.icon}
					</ToolButton>
				))}

				<Divider />

				{DRAW_TOOLS.map((toolDef) => (
					<ToolButton
						key={toolDef.tool}
						active={store.activeTool === toolDef.tool}
						label={`${t(toolDef.labelKey)} (${toolDef.shortcut})`}
						onClick={() => store.setActiveTool(toolDef.tool)}
					>
						{toolDef.icon}
					</ToolButton>
				))}

				<Divider />

				<ToolButton
					active={store.activeTool === "eraser"}
					label={`${t("canvas.toolbar.eraser")} (E)`}
					onClick={() => store.setActiveTool("eraser")}
				>
					<Eraser className="h-3.5 w-3.5" />
				</ToolButton>
				<ToolButton
					active={store.activeTool === "laser"}
					label={`${t("canvas.toolbar.laser")} (K)`}
					onClick={() => store.setActiveTool("laser")}
				>
					<Zap className="h-3.5 w-3.5" />
				</ToolButton>
				<ToolButton
					active={store.activeTool === "eyedropper"}
					label={`${t("canvas.toolbar.eyedropper")} (I)`}
					onClick={() => store.activateEyedropper("stroke")}
				>
					<Pipette className="h-3.5 w-3.5" />
				</ToolButton>
				<ToolButton
					label={`${t("canvas.toolbar.insertImage")} (9)`}
					onClick={async () => {
						const elementsToAdd = await pickAndBuildImageElements(
							getViewportCenter(),
							{ resolvedTheme },
							imageUploadOptions,
						);
						if (elementsToAdd.length > 0) addElements(elementsToAdd);
					}}
				>
					<ImagePlus className="h-3.5 w-3.5" />
				</ToolButton>

				<ToolButton
					label={t("canvas.toolbar.shapeLibrary")}
					active={store.activePanel === "library"}
					onClick={() => store.setActivePanel("library")}
				>
					<BookOpen className="h-3.5 w-3.5" />
				</ToolButton>

				<Divider />

				<DropdownMenu>
					<Tooltip>
						<TooltipTrigger asChild>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className={`flex items-center justify-center h-7 w-7 rounded-lg transition-colors cursor-pointer ${
										store.activePanel === "sticky" ||
										store.activePanel === "kanban" ||
										store.activePanel === "library"
											? "bg-primary/20 text-primary"
											: "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
									}`}
									aria-label={t("canvas.toolbar.insertMenu")}
								>
									<LayoutTemplate className="h-3.5 w-3.5" />
								</button>
							</DropdownMenuTrigger>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="text-xs">
							{t("canvas.toolbar.insertMenu")}
						</TooltipContent>
					</Tooltip>
					<DropdownMenuContent align="center" className="w-52">
						<DropdownMenuLabel>
							{t("canvas.toolbar.insertMenuPanels")}
						</DropdownMenuLabel>
						<DropdownMenuItem onClick={() => store.setActivePanel("sticky")}>
							<StickyNote className="mr-2 h-4 w-4" />
							{t("canvas.toolbar.stickyNote")}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => store.setActivePanel("kanban")}>
							<Kanban className="mr-2 h-4 w-4" />
							{t("canvas.toolbar.kanban")}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>
							{t("canvas.toolbar.insertMenuTemplates")}
						</DropdownMenuLabel>
						<DropdownMenuItem
							onClick={() => {
								const center = getViewportCenter();
								addElements(
									createMindmapTemplate(center.x, center.y, {
										resolvedTheme,
									}),
								);
							}}
						>
							<GitBranch className="mr-2 h-4 w-4" />
							{t("canvas.toolbar.insertMindmap")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => {
								const center = getViewportCenter();
								addElements(
									createFlowchartTemplate(center.x, center.y, {
										stroke: store.strokeColor,
										theme: { resolvedTheme },
									}),
								);
							}}
						>
							<GitBranch className="mr-2 h-4 w-4 rotate-90" />
							{t("canvas.toolbar.insertFlowchart")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => insertAtCenter(createRetrospectiveTemplate)}
						>
							<History className="mr-2 h-4 w-4" />
							{t("canvas.toolbar.insertRetrospective")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => insertAtCenter(createSwotTemplate)}
						>
							<Table2 className="mr-2 h-4 w-4" />
							{t("canvas.toolbar.insertSwot")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				<DropdownMenu>
					<Tooltip>
						<TooltipTrigger asChild>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground transition-colors cursor-pointer hover:bg-accent hover:text-accent-foreground"
									aria-label={t("canvas.toolbar.exportMenu")}
								>
									<Download className="h-3.5 w-3.5" />
								</button>
							</DropdownMenuTrigger>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="text-xs">
							{t("canvas.toolbar.exportMenu")}
						</TooltipContent>
					</Tooltip>
					<DropdownMenuContent align="center" className="w-48">
						{onImportSkedra && (
							<DropdownMenuItem onClick={onImportSkedra}>
								<FolderOpen className="mr-2 h-4 w-4" />
								{t("canvas.toolbar.openSkedra")}
							</DropdownMenuItem>
						)}
						{onExportSkedra && (
							<DropdownMenuItem onClick={() => onExportSkedra()}>
								<Save className="mr-2 h-4 w-4" />
								{t("canvas.toolbar.saveSkedra")}
							</DropdownMenuItem>
						)}
						{onExportEncryptedSkedra && (
							<DropdownMenuItem onClick={() => onExportEncryptedSkedra()}>
								<Lock className="mr-2 h-4 w-4" />
								{t("canvas.toolbar.saveEncryptedSkedra")}
							</DropdownMenuItem>
						)}
						{(onImportSkedra || onExportSkedra || onExportEncryptedSkedra) && (
							<DropdownMenuSeparator />
						)}
						<DropdownMenuItem
							onClick={() => {
								const svg =
									document.querySelector<SVGSVGElement>(".skedra-canvas svg");
								if (svg) {
									void import("@/lib/canvas/export-utils").then(
										({ exportSVG }) => exportSVG(svg),
									);
								}
							}}
						>
							<Download className="mr-2 h-4 w-4" />
							{t("canvas.toolbar.exportSvg")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => {
								const svg =
									document.querySelector<SVGSVGElement>(".skedra-canvas svg");
								if (svg) {
									void import("@/lib/canvas/export-utils").then(
										({ exportPNG }) => exportPNG(svg),
									);
								}
							}}
						>
							<ImageIcon className="mr-2 h-4 w-4" />
							{t("canvas.toolbar.exportPng")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => {
								const svg =
									document.querySelector<SVGSVGElement>(".skedra-canvas svg");
								if (svg) {
									void import("@/lib/canvas/export-utils").then(
										({ exportPDF }) => exportPDF(svg),
									);
								}
							}}
						>
							<Download className="mr-2 h-4 w-4" />
							{t("canvas.toolbar.exportPdf")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => {
								const svg =
									document.querySelector<SVGSVGElement>(".skedra-canvas svg");
								if (svg) {
									void import("@/lib/canvas/export-utils").then(
										({ exportPPTX }) => exportPPTX(svg),
									);
								}
							}}
						>
							<MonitorPlay className="mr-2 h-4 w-4" />
							{t("canvas.toolbar.exportPptx")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</TooltipProvider>
	);
}

function ToolButton({
	children,
	active,
	label,
	onClick,
}: {
	children: React.ReactNode;
	active?: boolean;
	label: string;
	onClick?: () => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onClick}
					className={`flex items-center justify-center h-7 w-7 rounded-lg transition-colors cursor-pointer ${
						active
							? "bg-primary/20 text-primary"
							: "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
					}`}
				>
					{children}
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom" className="text-xs">
				{label}
			</TooltipContent>
		</Tooltip>
	);
}

function Divider() {
	return <div className="w-px h-4 bg-border mx-0.5" />;
}
