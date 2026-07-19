import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CanvasSearchMatch } from "@skedra/canvas-core";
import { ChevronDown, ChevronUp, Frame, Search, Type, X } from "lucide-react";
import {
	Fragment,
	type KeyboardEvent as ReactKeyboardEvent,
	useEffect,
	useMemo,
	useRef,
} from "react";

interface CanvasFindOnCanvasProps {
	open: boolean;
	embedded?: boolean;
	query: string;
	matches: readonly CanvasSearchMatch[];
	activeIndex: number | null;
	onQueryChange: (query: string) => void;
	onActiveIndexChange: (index: number) => void;
	onNext: () => void;
	onPrevious: () => void;
	onOpenChange: (open: boolean) => void;
}

function MatchPreview({ match }: { match: CanvasSearchMatch }) {
	const relativeStart = match.matchStart - match.previewStart;
	const relativeEnd = relativeStart + match.matchLength;
	const preview = match.sourceText.slice(match.previewStart, match.previewEnd);
	return (
		<span className="block truncate">
			{match.previewStart > 0 && "…"}
			{preview.slice(0, relativeStart)}
			<mark className="rounded-sm bg-yellow-300/70 px-0.5 text-inherit dark:bg-yellow-500/40">
				{preview.slice(relativeStart, relativeEnd)}
			</mark>
			{preview.slice(relativeEnd)}
			{match.previewEnd < match.sourceText.length && "…"}
		</span>
	);
}

export function CanvasFindOnCanvas({
	open,
	embedded = false,
	query,
	matches,
	activeIndex,
	onQueryChange,
	onActiveIndexChange,
	onNext,
	onPrevious,
	onOpenChange,
}: CanvasFindOnCanvasProps) {
	const { t } = useI18n();
	const inputRef = useRef<HTMLInputElement>(null);
	const groupedMatches = useMemo(
		() => ({
			frame: matches
				.map((match, index) => ({ match, index }))
				.filter((item) => item.match.kind === "frame"),
			text: matches
				.map((match, index) => ({ match, index }))
				.filter((item) => item.match.kind === "text"),
		}),
		[matches],
	);

	useEffect(() => {
		if (!open) return;
		requestAnimationFrame(() => {
			inputRef.current?.focus();
			inputRef.current?.select();
		});
	}, [open]);

	const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
		if (
			(event.ctrlKey || event.metaKey) &&
			event.key.toLocaleLowerCase() === "f"
		) {
			event.preventDefault();
			event.stopPropagation();
			inputRef.current?.focus();
			inputRef.current?.select();
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			onOpenChange(false);
		} else if (event.key === "Enter") {
			event.preventDefault();
			event.stopPropagation();
			if (event.shiftKey) onPrevious();
			else onNext();
		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			onNext();
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			onPrevious();
		}
	};

	if (!open) return null;

	const renderGroup = (
		kind: "frame" | "text",
		items: Array<{ match: CanvasSearchMatch; index: number }>,
	) => {
		if (items.length === 0) return null;
		const Icon = kind === "frame" ? Frame : Type;
		return (
			<Fragment key={kind}>
				<div className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					<Icon className="h-3.5 w-3.5" />
					{t(
						kind === "frame"
							? "canvas.findOnCanvas.groups.frames"
							: "canvas.findOnCanvas.groups.text",
					)}
				</div>
				{items.map(({ match, index }) => (
					<button
						key={match.key}
						type="button"
						className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
							activeIndex === index
								? "bg-accent text-accent-foreground"
								: "hover:bg-muted/70"
						}`}
						onClick={() => onActiveIndexChange(index)}
						ref={(element) => {
							if (activeIndex === index) {
								element?.scrollIntoView({ block: "nearest" });
							}
						}}
					>
						<MatchPreview match={match} />
					</button>
				))}
			</Fragment>
		);
	};

	return (
		<aside
			className={cn(
				"flex min-h-0 flex-col overflow-hidden text-card-foreground",
				embedded
					? "h-full bg-card"
					: "absolute right-3 top-14 z-50 max-h-[min(34rem,calc(100%-5rem))] w-[min(22rem,calc(100%-1.5rem))] rounded-xl border border-border bg-card/95 shadow-2xl backdrop-blur-md max-sm:left-3 max-sm:right-3 max-sm:w-auto",
			)}
			aria-label={t("canvas.findOnCanvas.title")}
			onKeyDownCapture={handleSearchKeyDown}
		>
			{!embedded && (
				<header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
					<Search className="h-4 w-4 text-muted-foreground" />
					<h2 className="flex-1 text-sm font-semibold">
						{t("canvas.findOnCanvas.title")}
					</h2>
					<button
						type="button"
						className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
						onClick={() => onOpenChange(false)}
						aria-label={t("canvas.findOnCanvas.close")}
					>
						<X className="h-4 w-4" />
					</button>
				</header>
			)}
			<div className={cn("p-3", embedded && "px-4 py-4")}>
				{embedded && (
					<h2 className="mb-3 text-base font-semibold text-foreground">
						{t("canvas.findOnCanvas.title")}
					</h2>
				)}
				<Input
					ref={inputRef}
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					placeholder={t("canvas.findOnCanvas.placeholder")}
					aria-label={t("canvas.findOnCanvas.placeholder")}
				/>
			</div>
			<div className="flex min-h-9 items-center border-y border-border px-3 text-xs text-muted-foreground">
				<span className="flex-1">
					{matches.length > 0
						? t("canvas.findOnCanvas.resultCount", {
								current: (activeIndex ?? 0) + 1,
								total: matches.length,
							})
						: query.trim()
							? t("canvas.findOnCanvas.noResults")
							: t("canvas.findOnCanvas.hint")}
				</span>
				<div className="flex items-center gap-0.5">
					<button
						type="button"
						className="rounded p-1 hover:bg-accent disabled:opacity-40"
						disabled={matches.length === 0}
						onClick={onPrevious}
						aria-label={t("canvas.findOnCanvas.previous")}
					>
						<ChevronUp className="h-4 w-4" />
					</button>
					<button
						type="button"
						className="rounded p-1 hover:bg-accent disabled:opacity-40"
						disabled={matches.length === 0}
						onClick={onNext}
						aria-label={t("canvas.findOnCanvas.next")}
					>
						<ChevronDown className="h-4 w-4" />
					</button>
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto">
				{renderGroup("frame", groupedMatches.frame)}
				{renderGroup("text", groupedMatches.text)}
			</div>
		</aside>
	);
}
