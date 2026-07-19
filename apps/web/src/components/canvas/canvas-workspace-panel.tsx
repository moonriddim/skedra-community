import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCanvasEditorFloatingPanel } from "@skedra/canvas-editor";
import {
	BookOpen,
	History,
	MessageSquare,
	MonitorPlay,
	Search,
	Share2,
	X,
} from "lucide-react";
import type { ReactNode } from "react";

export type CanvasWorkspaceTab =
	| "search"
	| "library"
	| "comments"
	| "activity"
	| "presentation";

interface CanvasWorkspacePanelProps {
	activeTab: CanvasWorkspaceTab;
	showComments: boolean;
	showActivity: boolean;
	onTabChange: (tab: CanvasWorkspaceTab) => void;
	onShare?: () => void;
	onClose: () => void;
	children: ReactNode;
}

const TABS = [
	{ id: "search", labelKey: "canvas.workspace.tabs.search", icon: Search },
	{ id: "library", labelKey: "canvas.workspace.tabs.library", icon: BookOpen },
	{
		id: "comments",
		labelKey: "canvas.workspace.tabs.comments",
		icon: MessageSquare,
	},
	{
		id: "activity",
		labelKey: "canvas.workspace.tabs.activity",
		icon: History,
	},
	{
		id: "presentation",
		labelKey: "canvas.workspace.tabs.presentation",
		icon: MonitorPlay,
	},
] as const;

export function CanvasWorkspacePanel({
	activeTab,
	showComments,
	showActivity,
	onTabChange,
	onShare,
	onClose,
	children,
}: CanvasWorkspacePanelProps) {
	const floatingPanel = useCanvasEditorFloatingPanel();
	const { t } = useI18n();
	const tabs = TABS.filter(
		(tab) =>
			(showComments || tab.id !== "comments") &&
			(showActivity || tab.id !== "activity"),
	);

	return (
		<aside
			ref={floatingPanel.panelRef}
			className="skedra-workspace-panel absolute bottom-3 right-3 top-14 z-50 flex w-[min(360px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/96 text-card-foreground shadow-2xl backdrop-blur-xl max-lg:bottom-[calc(4.75rem+env(safe-area-inset-bottom))] max-lg:left-3 max-lg:right-3 max-lg:top-[calc(4.25rem+env(safe-area-inset-top))] max-lg:w-auto"
			style={floatingPanel.panelStyle}
			aria-label={t("canvas.workspace.ariaLabel")}
			data-skedra-ui="workspace-panel"
		>
			<header
				className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5"
				{...floatingPanel.dragHandleProps}
			>
				<div
					className="flex items-center gap-1 rounded-xl border border-border/70 bg-muted/35 p-1"
					role="tablist"
					aria-label={t("canvas.workspace.toolsLabel")}
				>
					{tabs.map((tab) => {
						const Icon = tab.icon;
						const selected = activeTab === tab.id;
						const label = t(tab.labelKey);
						return (
							<button
								key={tab.id}
								type="button"
								role="tab"
								aria-selected={selected}
								aria-label={label}
								title={label}
								onClick={() => onTabChange(tab.id)}
								className={cn(
									"flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
									selected
										? "bg-primary text-primary-foreground shadow-sm"
										: "hover:bg-background/80 hover:text-foreground",
								)}
							>
								<Icon className="h-4 w-4" aria-hidden="true" />
							</button>
						);
					})}
				</div>

				<div className="flex items-center gap-1">
					{onShare ? (
						<button
							type="button"
							onClick={onShare}
							className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
							aria-label={t("canvas.workspace.share")}
							title={t("canvas.workspace.share")}
						>
							<Share2 className="h-4 w-4" aria-hidden="true" />
						</button>
					) : null}
					<button
						type="button"
						onClick={onClose}
						className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
						aria-label={t("canvas.workspace.close")}
						title={t("canvas.workspace.close")}
					>
						<X className="h-4 w-4" aria-hidden="true" />
					</button>
				</div>
			</header>

			<div className="min-h-0 flex-1 overflow-hidden">{children}</div>
		</aside>
	);
}
