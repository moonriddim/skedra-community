import {
	CANVAS_COMMAND_GROUPS,
	type CanvasCommand,
	type CanvasCommandIconId,
	rankCanvasCommands,
} from "@/components/canvas/canvas-command-registry";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import type { ToolType } from "@skedra/canvas-core";
import {
	AlignCenterHorizontal,
	ArrowUpRight,
	ChevronsUp,
	Circle,
	ClipboardPaste,
	Cloud,
	Command,
	Copy,
	Diamond,
	Eraser,
	FlipHorizontal2,
	Frame,
	Grid3X3,
	Group,
	Hand,
	HelpCircle,
	ImagePlus,
	Lasso,
	Layers,
	Link2,
	Lock,
	type LucideIcon,
	Magnet,
	Maximize2,
	Minus,
	MousePointer2,
	PaintBucket,
	Pencil,
	Redo2,
	Search,
	Sparkles,
	Square,
	Trash2,
	Triangle,
	Type,
	Undo2,
	Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const LAST_USED_COMMAND_KEY = "skedra.canvas.command-browser.last-used";

const ICONS: Record<CanvasCommandIconId, LucideIcon> = {
	align: AlignCenterHorizontal,
	copy: Copy,
	delete: Trash2,
	duplicate: Layers,
	fit: Maximize2,
	flip: FlipHorizontal2,
	grid: Grid3X3,
	group: Group,
	help: HelpCircle,
	image: ImagePlus,
	layer: Layers,
	link: Link2,
	lock: Lock,
	paste: ClipboardPaste,
	redo: Redo2,
	search: Search,
	"select-all": ChevronsUp,
	snap: Magnet,
	tool: Command,
	undo: Undo2,
	zen: Sparkles,
};

const TOOL_ICONS: Partial<Record<ToolType, LucideIcon>> = {
	select: MousePointer2,
	lasso: Lasso,
	pan: Hand,
	rectangle: Square,
	diamond: Diamond,
	ellipse: Circle,
	triangle: Triangle,
	cloud: Cloud,
	arrow: ArrowUpRight,
	line: Minus,
	freehand: Pencil,
	text: Type,
	frame: Frame,
	eraser: Eraser,
	laser: Zap,
	eyedropper: PaintBucket,
};

interface CanvasCommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	commands: CanvasCommand[];
}

function formatShortcut(shortcut: string): string[] {
	const primary =
		typeof navigator !== "undefined" &&
		/Mac|iPhone|iPad/.test(navigator.platform)
			? "⌘"
			: "Ctrl";
	return shortcut.replace("Mod", primary).split("+").filter(Boolean);
}

function CommandShortcut({ shortcut }: { shortcut: string }) {
	return (
		<span className="ml-auto flex shrink-0 items-center gap-1 pl-3">
			{formatShortcut(shortcut).map((part) => (
				<kbd
					key={part}
					className="min-w-5 rounded border border-border bg-muted px-1.5 py-0.5 text-center font-mono text-[10px] text-muted-foreground"
				>
					{part}
				</kbd>
			))}
		</span>
	);
}

export function CanvasCommandPalette({
	open,
	onOpenChange,
	commands,
}: CanvasCommandPaletteProps) {
	const { t } = useI18n();
	const [query, setQuery] = useState("");
	const [activeId, setActiveId] = useState<string | null>(null);
	const [lastUsedId, setLastUsedId] = useState<string | null>(() =>
		typeof window === "undefined"
			? null
			: window.localStorage.getItem(LAST_USED_COMMAND_KEY),
	);
	const filtered = useMemo(
		() =>
			rankCanvasCommands(
				commands,
				query,
				(command) => t(command.labelKey),
				(command) => t(command.groupKey),
			),
		[commands, query, t],
	);
	const lastUsed = useMemo(
		() => commands.find((command) => command.id === lastUsedId) ?? null,
		[commands, lastUsedId],
	);
	const navigableCommands = useMemo(
		() =>
			!query && lastUsed
				? [
						lastUsed,
						...filtered.filter((command) => command.id !== lastUsed.id),
					]
				: filtered,
		[filtered, lastUsed, query],
	);

	useEffect(() => {
		if (!open) {
			setQuery("");
			setActiveId(null);
			return;
		}
		setActiveId(lastUsed?.id ?? commands[0]?.id ?? null);
	}, [commands, lastUsed?.id, open]);

	useEffect(() => {
		if (
			activeId &&
			navigableCommands.some((command) => command.id === activeId)
		) {
			return;
		}
		setActiveId(navigableCommands[0]?.id ?? null);
	}, [activeId, navigableCommands]);

	const runCommand = (command: CanvasCommand) => {
		setLastUsedId(command.id);
		window.localStorage.setItem(LAST_USED_COMMAND_KEY, command.id);
		onOpenChange(false);
		requestAnimationFrame(command.run);
	};

	const moveActive = (delta: number) => {
		if (navigableCommands.length === 0) return;
		const currentIndex = navigableCommands.findIndex(
			(command) => command.id === activeId,
		);
		const nextIndex =
			(currentIndex + delta + navigableCommands.length) %
			navigableCommands.length;
		setActiveId(navigableCommands[nextIndex]?.id ?? null);
	};

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveActive(1);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			moveActive(-1);
		} else if (event.key === "Enter") {
			const command = navigableCommands.find(
				(candidate) => candidate.id === activeId,
			);
			if (command) {
				event.preventDefault();
				runCommand(command);
			}
		}
	};

	const renderCommand = (command: CanvasCommand) => {
		const Icon = command.tool
			? (TOOL_ICONS[command.tool] ?? Command)
			: ICONS[command.icon];
		const selected = command.id === activeId;
		return (
			<button
				key={command.id}
				ref={(element) => {
					if (!selected) return;
					element?.scrollIntoView({ block: "nearest" });
				}}
				type="button"
				aria-current={selected ? "true" : undefined}
				className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
					selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/70"
				}`}
				onMouseMove={() => setActiveId(command.id)}
				onClick={() => runCommand(command)}
			>
				<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground">
					<Icon className="h-4 w-4" />
				</span>
				<span className="min-w-0 flex-1 truncate font-medium">
					{t(command.labelKey)}
				</span>
				{command.shortcuts[0] && (
					<CommandShortcut shortcut={command.shortcuts[0]} />
				)}
			</button>
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[min(750px,calc(100dvh-2rem))] max-w-2xl flex-col gap-0 overflow-hidden p-0">
				<DialogHeader className="border-b border-border px-5 pb-3 pt-5">
					<DialogTitle>{t("canvas.commandPalette.title")}</DialogTitle>
					<div className="relative pt-2">
						<Search className="pointer-events-none absolute left-3 top-1/2 mt-1 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							autoFocus
							value={query}
							onChange={(event) => {
								setQuery(event.target.value);
								setActiveId(null);
							}}
							onKeyDown={onKeyDown}
							placeholder={t("canvas.commandPalette.placeholder")}
							className="pl-9 pr-12"
						/>
					</div>
					<div className="flex items-center justify-center gap-4 pt-1 text-[10px] text-muted-foreground max-sm:hidden">
						<span>{t("canvas.commandPalette.hints.navigate")}</span>
						<span>{t("canvas.commandPalette.hints.run")}</span>
						<span>{t("canvas.commandPalette.hints.close")}</span>
					</div>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto p-3">
					{filtered.length === 0 ? (
						<div className="flex flex-col items-center gap-2 px-4 py-12 text-sm text-muted-foreground">
							<Search className="h-5 w-5" />
							{t("canvas.commandPalette.empty")}
						</div>
					) : (
						<>
							{!query && lastUsed && (
								<section className="pb-3">
									<h3 className="px-2.5 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										{t("canvas.commandPalette.groups.recent")}
									</h3>
									{renderCommand(lastUsed)}
								</section>
							)}
							{CANVAS_COMMAND_GROUPS.filter(
								(group) => group !== "canvas.commandPalette.groups.recent",
							).map((group) => {
								const groupCommands = filtered.filter(
									(command) =>
										command.groupKey === group &&
										(query || command.id !== lastUsed?.id),
								);
								if (groupCommands.length === 0) return null;
								return (
									<section key={group} className="pb-3 last:pb-0">
										<h3 className="px-2.5 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
											{t(group)}
										</h3>
										{groupCommands.map(renderCommand)}
									</section>
								);
							})}
						</>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
