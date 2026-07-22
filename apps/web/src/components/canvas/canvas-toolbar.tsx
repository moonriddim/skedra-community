/**
 * Community adapter for the shared canvas-editor toolbar.
 */

import { useCanvasStore } from "@/hooks/use-canvas-store";
import type { ImageUploadOptions } from "@/lib/canvas/image-utils";
import { pickAndBuildImageElements } from "@/lib/canvas/insert-image";
import { useI18n } from "@/lib/i18n";
import { createFlowchartTemplate } from "@/lib/templates/flowchart";
import { createGanttTemplate } from "@/lib/templates/gantt";
import { createMindmapTemplate } from "@/lib/templates/mindmap";
import { createRetrospectiveTemplate } from "@/lib/templates/retrospective";
import { createSwotTemplate } from "@/lib/templates/swot";
import { useThemeStore } from "@/stores/theme";
import {
	type CanvasElement,
	findGanttChartElement,
	getGanttChartMeta,
	getGanttChartSize,
} from "@skedra/canvas-core";
import {
	type CanvasEditorToolId,
	CanvasEditorToolbar,
	type CanvasEditorToolbarItem,
	type CanvasEditorToolbarMenuItem,
} from "@skedra/canvas-editor";
import {
	ArrowUpRight,
	ChartGantt,
	Circle,
	Cloud,
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
	Layers,
	LayoutTemplate,
	Lock,
	Minus,
	MonitorPlay,
	MousePointer2,
	PanelsTopLeft,
	Pencil,
	Pipette,
	Save,
	Shapes,
	Square,
	StickyNote,
	Table2,
	Triangle,
	Type,
	Unlock,
	Workflow,
	Zap,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

interface CanvasToolbarProps {
	workspaceSlug?: string;
	elements: Map<string, CanvasElement>;
	addElements: (elements: CanvasElement[]) => void;
	getViewportCenter: () => { x: number; y: number };
	onExportSkedra?: () => void;
	onExportExcalidraw?: () => void;
	onExportEncryptedSkedra?: () => void;
	onImportSkedra?: () => void;
	onExportVisual: (format: "svg" | "png" | "pdf" | "pptx") => Promise<void>;
	imageUploadOptions?: ImageUploadOptions;
}

const TOOL_ICONS: Record<CanvasEditorToolId, React.ReactNode> = {
	select: <MousePointer2 className="h-3.5 w-3.5" />,
	lasso: <Lasso className="h-3.5 w-3.5" />,
	pan: <Hand className="h-3.5 w-3.5" />,
	rectangle: <Square className="h-3.5 w-3.5" />,
	diamond: <Diamond className="h-3.5 w-3.5" />,
	ellipse: <Circle className="h-3.5 w-3.5" />,
	triangle: <Triangle className="h-3.5 w-3.5" />,
	cloud: <Cloud className="h-3.5 w-3.5" />,
	arrow: <ArrowUpRight className="h-3.5 w-3.5" />,
	line: <Minus className="h-3.5 w-3.5" />,
	freehand: <Pencil className="h-3.5 w-3.5" />,
	text: <Type className="h-3.5 w-3.5" />,
	frame: <Frame className="h-3.5 w-3.5" />,
	eraser: <Eraser className="h-3.5 w-3.5" />,
	laser: <Zap className="h-3.5 w-3.5" />,
	eyedropper: <Pipette className="h-3.5 w-3.5" />,
	"sticky-note": <StickyNote className="h-3.5 w-3.5" />,
	kanban: <Kanban className="h-3.5 w-3.5" />,
	mindmap: <GitBranch className="h-3.5 w-3.5" />,
};

export function CanvasToolbar({
	elements,
	addElements,
	getViewportCenter,
	onExportSkedra,
	onExportExcalidraw,
	onExportEncryptedSkedra,
	onImportSkedra,
	onExportVisual,
	imageUploadOptions,
}: CanvasToolbarProps) {
	const store = useCanvasStore(
		useShallow((state) => ({
			activePanel: state.activePanel,
			activeTool: state.activeTool,
			strokeColor: state.strokeColor,
			selectedIds: state.selectedIds,
			toolLocked: state.toolLocked,
			activateEyedropper: state.activateEyedropper,
			setActivePanel: state.setActivePanel,
			setActiveTool: state.setActiveTool,
			setSelectedIds: state.setSelectedIds,
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
	const activateTool = (tool: CanvasEditorToolId) => {
		if (tool === "eyedropper") store.activateEyedropper("stroke");
		else if (tool === "sticky-note") store.setActivePanel("sticky");
		else if (tool === "kanban") store.setActivePanel("kanban");
		else if (tool === "mindmap") {
			const center = getViewportCenter();
			addElements(createMindmapTemplate(center.x, center.y, { resolvedTheme }));
		} else store.setActiveTool(tool);
	};
	const insertImage = async () => {
		const elements = await pickAndBuildImageElements(
			getViewportCenter(),
			{ resolvedTheme },
			imageUploadOptions,
		);
		if (elements.length > 0) addElements(elements);
	};
	const createNewGantt = () => {
		const existingCount = Array.from(elements.values()).filter(
			(element) => getGanttChartMeta(element) !== null,
		).length;
		const selectedElement = Array.from(store.selectedIds)
			.map((id) => elements.get(id))
			.find((element): element is CanvasElement => element !== undefined);
		const selectedChart = selectedElement
			? findGanttChartElement(elements.values(), selectedElement)
			: null;
		const size = getGanttChartSize();
		const center = selectedChart
			? {
					x: selectedChart.x + selectedChart.width + 80 + size.width / 2,
					y: selectedChart.y + size.height / 2,
				}
			: getViewportCenter();
		const defaultTitle = t("canvas.toolbar.insertGantt");
		const created = createGanttTemplate(center.x, center.y, {
			resolvedTheme,
		}).map((element, index) =>
			index === 0
				? {
						...element,
						frameLabel:
							existingCount === 0
								? defaultTitle
								: `${defaultTitle} ${existingCount + 1}`,
					}
				: element,
		);
		addElements(created);
		if (created[0]) store.setSelectedIds(new Set([created[0].id]));
		if (store.activePanel !== "gantt") store.setActivePanel("gantt");
	};
	const insertMenuItems: CanvasEditorToolbarMenuItem[] = [
		{
			type: "label",
			id: "panels-label",
			label: t("canvas.toolbar.insertMenuPanels"),
		},
		{
			id: "sticky-note",
			label: t("canvas.toolbar.stickyNote"),
			icon: <StickyNote className="h-4 w-4" />,
			onSelect: () => store.setActivePanel("sticky"),
		},
		{
			id: "kanban",
			label: t("canvas.toolbar.kanban"),
			icon: <Kanban className="h-4 w-4" />,
			onSelect: () => store.setActivePanel("kanban"),
		},
		{
			type: "separator",
			id: "panels-separator",
			label: "",
		},
		{
			type: "label",
			id: "templates-label",
			label: t("canvas.toolbar.insertMenuTemplates"),
		},
		{
			id: "mindmap",
			label: t("canvas.toolbar.insertMindmap"),
			icon: <GitBranch className="h-4 w-4" />,
			onSelect: () => {
				const center = getViewportCenter();
				addElements(
					createMindmapTemplate(center.x, center.y, { resolvedTheme }),
				);
			},
		},
		{
			id: "flowchart",
			label: t("canvas.toolbar.insertFlowchart"),
			icon: <GitBranch className="h-4 w-4 rotate-90" />,
			onSelect: () => {
				const center = getViewportCenter();
				addElements(
					createFlowchartTemplate(center.x, center.y, {
						stroke: store.strokeColor,
						theme: { resolvedTheme },
					}),
				);
			},
		},
		{
			id: "sequence-diagram",
			label: t("canvas.toolbar.insertSequenceDiagram"),
			icon: <Workflow className="h-4 w-4" />,
			onSelect: () => store.setActivePanel("sequence-diagram"),
		},
		{
			id: "gantt",
			label: t("canvas.toolbar.insertGantt"),
			icon: <ChartGantt className="h-4 w-4" />,
			secondaryActions: [
				{
					id: "gantt-new",
					label: t("ganttStudio.newChart"),
					onSelect: createNewGantt,
				},
			],
			onSelect: () => {
				const selected = Array.from(store.selectedIds)
					.map((id) => elements.get(id))
					.find((element): element is CanvasElement => element !== undefined);
				const chart = selected
					? findGanttChartElement(elements.values(), selected)
					: null;
				if (chart) {
					store.setSelectedIds(new Set([chart.id]));
					store.setActivePanel("gantt");
					return;
				}
				createNewGantt();
			},
		},
		{
			type: "separator",
			id: "diagrams-separator",
			label: "",
		},
		{
			type: "label",
			id: "workshops-label",
			label: t("canvas.toolbar.insertMenuWorkshops"),
		},
		{
			id: "wireframe",
			label: t("canvas.toolbar.insertWireframe"),
			icon: <PanelsTopLeft className="h-4 w-4" />,
			onSelect: () => store.setActivePanel("wireframe"),
		},
		{
			id: "retrospective",
			label: t("canvas.toolbar.insertRetrospective"),
			icon: <History className="h-4 w-4" />,
			onSelect: () => insertAtCenter(createRetrospectiveTemplate),
		},
		{
			id: "swot",
			label: t("canvas.toolbar.insertSwot"),
			icon: <Table2 className="h-4 w-4" />,
			onSelect: () => insertAtCenter(createSwotTemplate),
		},
	];
	const exportMenuItems: CanvasEditorToolbarMenuItem[] = [
		...(onImportSkedra
			? [
					{
						id: "open-skedra",
						label: t("canvas.toolbar.openSkedra"),
						icon: <FolderOpen className="h-4 w-4" />,
						onSelect: onImportSkedra,
					},
				]
			: []),
		...(onExportSkedra
			? [
					{
						id: "save-skedra",
						label: t("canvas.toolbar.saveSkedra"),
						icon: <Save className="h-4 w-4" />,
						onSelect: onExportSkedra,
					},
				]
			: []),
		...(onExportExcalidraw
			? [
					{
						id: "save-excalidraw",
						label: t("canvas.toolbar.saveExcalidraw"),
						icon: <Download className="h-4 w-4" />,
						onSelect: onExportExcalidraw,
					},
				]
			: []),
		...(onExportEncryptedSkedra
			? [
					{
						id: "save-encrypted-skedra",
						label: t("canvas.toolbar.saveEncryptedSkedra"),
						icon: <Lock className="h-4 w-4" />,
						onSelect: onExportEncryptedSkedra,
					},
				]
			: []),
		{
			id: "export-svg",
			label: t("canvas.toolbar.exportSvg"),
			icon: <Download className="h-4 w-4" />,
			onSelect: () => onExportVisual("svg"),
		},
		{
			id: "export-png",
			label: t("canvas.toolbar.exportPng"),
			icon: <ImageIcon className="h-4 w-4" />,
			onSelect: () => onExportVisual("png"),
		},
		{
			id: "export-pdf",
			label: t("canvas.toolbar.exportPdf"),
			icon: <Download className="h-4 w-4" />,
			onSelect: () => onExportVisual("pdf"),
		},
		{
			id: "export-pptx",
			label: t("canvas.toolbar.exportPptx"),
			icon: <MonitorPlay className="h-4 w-4" />,
			onSelect: () => onExportVisual("pptx"),
		},
	];
	const items: CanvasEditorToolbarItem[] = [
		{
			type: "action",
			id: "insert-image",
			label: `${t("canvas.toolbar.insertImage")} (9)`,
			icon: <ImagePlus className="h-3.5 w-3.5" />,
			onSelect: insertImage,
		},
		{
			type: "action",
			id: "layers",
			label: t("canvas.toolbar.layers"),
			icon: <Layers className="h-3.5 w-3.5" />,
			active: store.activePanel === "layers",
			onSelect: () =>
				store.setActivePanel(store.activePanel === "layers" ? null : "layers"),
		},
		{ type: "separator", id: "insert-separator" },
		{
			type: "menu",
			id: "insert-menu",
			label: t("canvas.toolbar.insertMenu"),
			icon: <LayoutTemplate className="h-3.5 w-3.5" />,
			popoverClassName:
				"canvas-editor__toolbar-popover--insert-menu min-w-64 max-w-[calc(100vw-2rem)]",
			active:
				store.activePanel === "sticky" ||
				store.activePanel === "kanban" ||
				store.activePanel === "wireframe" ||
				store.activePanel === "sequence-diagram" ||
				store.activePanel === "gantt",
			items: insertMenuItems,
		},
		{
			type: "menu",
			id: "export-menu",
			label: t("canvas.toolbar.exportMenu"),
			icon: <Download className="h-3.5 w-3.5" />,
			items: exportMenuItems,
		},
	];
	return (
		<CanvasEditorToolbar
			toolStrip={{
				activeTool:
					store.activePanel === "sticky"
						? "sticky-note"
						: store.activePanel === "kanban"
							? "kanban"
							: store.activeTool,
				onToolSelect: activateTool,
				renderIcon: (tool) => TOOL_ICONS[tool],
				includeTool: (definition) => definition.group !== "structured",
				toolLocked: store.toolLocked,
				onToolLockChange: () => store.toggleToolLocked(),
				renderToolLockIcon: (locked) =>
					locked ? (
						<Lock className="h-3.5 w-3.5" />
					) : (
						<Unlock className="h-3.5 w-3.5" />
					),
				getButtonClassName: (_tool, active) =>
					`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors ${
						active
							? "bg-primary/20 text-primary"
							: "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
					}`,
				classes: {
					divider: "mx-0.5 h-4 w-px bg-border",
					pathSelect:
						"h-7 rounded-md border border-border bg-background px-1 text-[11px] text-foreground",
				},
			}}
			items={items}
			responsive={{
				moreLabel: t("canvas.toolbar.moreTools"),
				moreIcon: <Shapes className="h-4 w-4" />,
				popoverClassName: "canvas-editor__toolbar-popover--mobile-more",
			}}
			classes={{
				root: "rounded-xl border border-border bg-card/90 px-1.5 py-1 shadow-xl backdrop-blur-md",
				action:
					"flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
				actionActive: "bg-primary/20 text-primary",
				separator: "mx-0.5 h-4 w-px bg-border",
				popover:
					"w-52 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl",
				menuItem:
					"group flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground group-hover:[&>svg]:text-primary",
				menuLabel:
					"px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
				menuSeparator: "mx-1 my-1 h-px border-0 bg-border/80",
			}}
		/>
	);
}
