import {
	type CanvasElement,
	WIREFRAME_BLANK_PRESET_IDS,
	WIREFRAME_COMPONENT_CATEGORIES,
	WIREFRAME_STARTER_PRESET_IDS,
	type WireframeComponentCategory,
	type WireframeComponentId,
	type WireframeInsertionTarget,
	type WireframePresetId,
	resolveWireframeInsertionTarget,
} from "@skedra/canvas-core";
import {
	CircleUserRound,
	Image as ImageIcon,
	LayoutDashboard,
	List,
	LogIn,
	type LucideIcon,
	Monitor,
	MousePointerClick,
	PanelLeft,
	PanelsTopLeft,
	Pin,
	Search,
	Settings,
	ShoppingBag,
	SlidersHorizontal,
	Smartphone,
	Square,
	Table2,
	Tablet,
	TextCursorInput,
	Type,
	X,
} from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";

export type CanvasEditorWireframeTranslate = (
	key: string,
	fallback: string,
) => string;

export interface CanvasEditorWireframePanelProps {
	elements: ReadonlyMap<string, CanvasElement>;
	selectedElements: readonly CanvasElement[];
	translate: CanvasEditorWireframeTranslate;
	className?: string;
	style?: CSSProperties;
	onInsertPreset: (preset: WireframePresetId) => void;
	onInsertComponent: (
		component: WireframeComponentId,
		target: WireframeInsertionTarget | null,
	) => void;
	onClose?: () => void;
}

type WireframePanelTab = "screens" | "components";

const COMPONENT_ICONS: Record<WireframeComponentId, LucideIcon> = {
	navbar: PanelsTopLeft,
	topbar: PanelsTopLeft,
	sidebar: PanelLeft,
	"bottom-nav": PanelsTopLeft,
	divider: SlidersHorizontal,
	hero: LayoutDashboard,
	"text-block": Type,
	card: Square,
	image: ImageIcon,
	avatar: CircleUserRound,
	list: List,
	skeleton: SlidersHorizontal,
	button: MousePointerClick,
	input: TextCursorInput,
	textarea: TextCursorInput,
	search: Search,
	checkbox: Square,
	radio: CircleUserRound,
	toggle: SlidersHorizontal,
	select: TextCursorInput,
	tabs: PanelsTopLeft,
	breadcrumb: List,
	table: Table2,
	pagination: SlidersHorizontal,
	modal: Square,
};

const PRESET_ICONS: Record<WireframePresetId, LucideIcon> = {
	"responsive-landing": PanelsTopLeft,
	"blank-desktop": Monitor,
	"blank-tablet": Tablet,
	"blank-mobile": Smartphone,
	dashboard: LayoutDashboard,
	"mobile-app": Smartphone,
	login: LogIn,
	ecommerce: ShoppingBag,
	settings: Settings,
};

function fallbackLabel(id: string) {
	return id
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function joinClasses(...values: Array<string | false | null | undefined>) {
	return values.filter(Boolean).join(" ");
}

/**
 * Host-neutral wireframe catalog. Hosts own persistence, element factories,
 * viewport fitting and translations; the reusable interaction UI lives here.
 */
export function CanvasEditorWireframePanel({
	elements,
	selectedElements,
	translate: t,
	className,
	style,
	onInsertPreset,
	onInsertComponent,
	onClose,
}: CanvasEditorWireframePanelProps) {
	const [activeTab, setActiveTab] = useState<WireframePanelTab>("screens");
	const [query, setQuery] = useState("");
	const [pinned, setPinned] = useState(false);
	const target = useMemo(
		() => resolveWireframeInsertionTarget(elements, selectedElements),
		[elements, selectedElements],
	);
	const normalizedQuery = query.trim().toLocaleLowerCase();
	const filteredCategories = useMemo(() => {
		return Object.entries(WIREFRAME_COMPONENT_CATEGORIES).map(
			([category, componentIds]) => ({
				category: category as WireframeComponentCategory,
				componentIds: componentIds.filter((id) =>
					t(`wireframePanel.components.${id}`, fallbackLabel(id))
						.toLocaleLowerCase()
						.includes(normalizedQuery),
				),
			}),
		);
	}, [normalizedQuery, t]);
	const hasFilteredComponents = filteredCategories.some(
		({ componentIds }) => componentIds.length > 0,
	);

	return (
		<aside
			data-pinned={pinned}
			className={joinClasses(
				"canvas-editor__wireframe-panel absolute left-4 top-14 z-40 flex w-[min(100vw-2rem,360px)] flex-col overflow-hidden rounded-xl border border-border bg-card/95 text-card-foreground shadow-xl backdrop-blur-md max-lg:left-[calc(0.75rem+env(safe-area-inset-left))] max-lg:top-[calc(8rem+env(safe-area-inset-top))] max-lg:max-h-[calc(100dvh-15.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-lg:w-[min(100vw-1.5rem-env(safe-area-inset-left)-env(safe-area-inset-right),360px)]",
				pinned
					? "bottom-20 max-lg:bottom-[calc(5rem+env(safe-area-inset-bottom))]"
					: "h-[min(72vh,700px)]",
				className,
			)}
			style={style}
			aria-label={t("wireframePanel.title", "Wireframes")}
		>
			<header className="canvas-editor__panel-header flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2.5">
				<PanelsTopLeft className="canvas-editor__panel-title-icon h-4 w-4 shrink-0 text-primary" />
				<div className="canvas-editor__panel-heading min-w-0 flex-1">
					<h3 className="canvas-editor__panel-title truncate text-sm font-semibold">
						{t("wireframePanel.title", "Wireframes")}
					</h3>
					<p className="canvas-editor__panel-subtitle truncate text-[10px] text-muted-foreground">
						{t("wireframePanel.subtitle", "Editable screens and components")}
					</p>
				</div>
				<button
					type="button"
					onClick={() => setPinned((value) => !value)}
					className={joinClasses(
						"canvas-editor__panel-icon-button cursor-pointer rounded-md p-1 transition-colors max-lg:flex max-lg:h-11 max-lg:w-11 max-lg:items-center max-lg:justify-center",
						pinned
							? "bg-primary/15 text-primary"
							: "text-muted-foreground hover:bg-accent hover:text-foreground",
					)}
					aria-label={t("wireframePanel.pin", "Pin panel")}
				>
					<Pin className="h-3.5 w-3.5" />
				</button>
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						className="canvas-editor__panel-icon-button cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground max-lg:flex max-lg:h-11 max-lg:w-11 max-lg:items-center max-lg:justify-center"
						aria-label={t("common.close", "Close")}
					>
						<X className="h-4 w-4" />
					</button>
				)}
			</header>

			<div className="canvas-editor__wireframe-controls shrink-0 space-y-2 border-b border-border/60 px-3 py-2.5">
				<div
					role="tablist"
					aria-label={t("wireframePanel.tabsLabel", "Wireframe catalog")}
					className="canvas-editor__wireframe-tabs grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1"
				>
					{(["screens", "components"] as const).map((tab) => (
						<button
							key={tab}
							type="button"
							role="tab"
							aria-selected={activeTab === tab}
							data-active={activeTab === tab}
							onClick={() => setActiveTab(tab)}
							className={joinClasses(
								"canvas-editor__wireframe-tab flex h-8 cursor-pointer items-center justify-center rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
								activeTab === tab
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:bg-background/60 hover:text-foreground",
							)}
						>
							{t(
								`wireframePanel.tabs.${tab}`,
								tab === "screens" ? "Screens" : "Components",
							)}
						</button>
					))}
				</div>
				{activeTab === "components" && (
					<div className="canvas-editor__wireframe-search relative">
						<Search className="canvas-editor__wireframe-search-icon pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
						<input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t("wireframePanel.search", "Search components")}
							className="canvas-editor__wireframe-search-input flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 pl-8 text-xs text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
						/>
					</div>
				)}
			</div>

			<div className="canvas-editor__wireframe-body min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-3 py-3 [scrollbar-gutter:stable] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30 hover:scrollbar-thumb-muted-foreground/45">
				{activeTab === "screens" ? (
					<>
						<PresetSection
							title={t("wireframePanel.blankScreens", "Blank screens")}
							hint={t(
								"wireframePanel.blankScreensHint",
								"Start with an empty viewport",
							)}
							presets={WIREFRAME_BLANK_PRESET_IDS}
							columns={3}
							translate={t}
							onInsert={onInsertPreset}
						/>
						<PresetSection
							title={t("wireframePanel.starterScreens", "Starter screens")}
							hint={t(
								"wireframePanel.starterScreensHint",
								"Insert a complete editable layout",
							)}
							presets={WIREFRAME_STARTER_PRESET_IDS}
							columns={2}
							translate={t}
							onInsert={onInsertPreset}
						/>
					</>
				) : (
					<>
						<div className="canvas-editor__wireframe-target rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 text-[10px] leading-snug text-muted-foreground">
							{target?.frameId
								? t(
										"wireframePanel.targetSelected",
										"Insert into the selected screen",
									)
								: t("wireframePanel.targetCanvas", "Insert on the canvas")}
						</div>
						{filteredCategories.map(({ category, componentIds }) => {
							if (componentIds.length === 0) return null;
							return (
								<section
									key={category}
									className="canvas-editor__wireframe-section space-y-2"
								>
									<h4 className="canvas-editor__wireframe-section-title text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
										{t(
											`wireframePanel.categories.${category}`,
											fallbackLabel(category),
										)}
									</h4>
									<div
										className="canvas-editor__wireframe-grid grid grid-cols-2 gap-2"
										data-columns="2"
									>
										{componentIds.map((id) => {
											const Icon = COMPONENT_ICONS[id];
											return (
												<button
													key={id}
													type="button"
													onClick={() => onInsertComponent(id, target)}
													className="canvas-editor__wireframe-item canvas-editor__wireframe-item--component flex min-h-14 cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
												>
													<Icon className="canvas-editor__wireframe-item-icon h-4 w-4 shrink-0 text-primary" />
													<span className="canvas-editor__wireframe-item-label text-xs font-medium">
														{t(
															`wireframePanel.components.${id}`,
															fallbackLabel(id),
														)}
													</span>
												</button>
											);
										})}
									</div>
								</section>
							);
						})}
						{!hasFilteredComponents && (
							<p className="canvas-editor__panel-empty py-10 text-center text-xs text-muted-foreground">
								{t("wireframePanel.noResults", "No components found")}
							</p>
						)}
					</>
				)}
			</div>
		</aside>
	);
}

function PresetSection({
	title,
	hint,
	presets,
	columns,
	translate: t,
	onInsert,
}: {
	title: string;
	hint: string;
	presets: readonly WireframePresetId[];
	columns: 2 | 3;
	translate: CanvasEditorWireframeTranslate;
	onInsert: (preset: WireframePresetId) => void;
}) {
	return (
		<section className="canvas-editor__wireframe-section space-y-2">
			<div className="canvas-editor__wireframe-section-heading">
				<h4 className="canvas-editor__wireframe-section-title text-xs font-semibold">
					{title}
				</h4>
				<p className="canvas-editor__wireframe-section-hint text-[10px] leading-snug text-muted-foreground">
					{hint}
				</p>
			</div>
			<div
				data-columns={columns}
				className={
					columns === 3
						? "canvas-editor__wireframe-grid grid grid-cols-3 gap-2"
						: "canvas-editor__wireframe-grid grid grid-cols-2 gap-2"
				}
			>
				{presets.map((id) => {
					const Icon = PRESET_ICONS[id];
					return (
						<button
							key={id}
							type="button"
							onClick={() => onInsert(id)}
							className="canvas-editor__wireframe-item canvas-editor__wireframe-item--preset flex min-h-20 cursor-pointer flex-col items-start justify-between rounded-lg border border-border/70 bg-background p-3 text-left text-[11px] transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							<Icon className="canvas-editor__wireframe-item-icon h-5 w-5 text-primary" />
							<span className="canvas-editor__wireframe-item-label text-xs font-medium">
								{t(`wireframePanel.presets.${id}`, fallbackLabel(id))}
							</span>
						</button>
					);
				})}
			</div>
		</section>
	);
}
