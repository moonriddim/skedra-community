/**
 * Befehlspalette (Excalidraw: Strg+/ oder Strg+Shift+P).
 */

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";

export interface CanvasCommand {
	id: string;
	labelKey: string;
	keywords?: string[];
	groupKey: string;
	run: () => void;
}

interface CanvasCommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	commands: CanvasCommand[];
}

export function CanvasCommandPalette({
	open,
	onOpenChange,
	commands,
}: CanvasCommandPaletteProps) {
	const { t } = useI18n();
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);

	useEffect(() => {
		if (!open) {
			setQuery("");
			setActiveIndex(0);
		}
	}, [open]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return commands;
		return commands.filter((command) => {
			const label = t(command.labelKey).toLowerCase();
			const keywords = command.keywords?.join(" ").toLowerCase() ?? "";
			return (
				label.includes(q) || keywords.includes(q) || command.id.includes(q)
			);
		});
	}, [commands, query, t]);

	const runCommand = (command: CanvasCommand) => {
		onOpenChange(false);
		command.run();
	};

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((index) => Math.min(filtered.length - 1, index + 1));
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((index) => Math.max(0, index - 1));
		}
		if (event.key === "Enter" && filtered[activeIndex]) {
			event.preventDefault();
			runCommand(filtered[activeIndex]);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg gap-3 p-0">
				<DialogHeader className="px-4 pt-4">
					<DialogTitle>{t("canvas.commandPalette.title")}</DialogTitle>
				</DialogHeader>
				<div className="px-4">
					<Input
						autoFocus
						value={query}
						onChange={(event) => {
							setQuery(event.target.value);
							setActiveIndex(0);
						}}
						onKeyDown={onKeyDown}
						placeholder={t("canvas.commandPalette.placeholder")}
					/>
				</div>
				<div className="max-h-72 overflow-y-auto border-t border-border">
					{filtered.length === 0 ? (
						<p className="px-4 py-6 text-sm text-muted-foreground">
							{t("canvas.commandPalette.empty")}
						</p>
					) : (
						filtered.map((command, index) => (
							<button
								key={command.id}
								type="button"
								className={`flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 ${
									index === activeIndex ? "bg-muted/60" : ""
								}`}
								onMouseEnter={() => setActiveIndex(index)}
								onClick={() => runCommand(command)}
							>
								<span className="font-medium">{t(command.labelKey)}</span>
								<span className="text-xs text-muted-foreground">
									{t(command.groupKey)}
								</span>
							</button>
						))
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
