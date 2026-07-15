/**
 * AI Text-to-Diagram Panel — BYOK, persistierter Chat-Verlauf pro Board.
 */

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiElementsToCanvasElements } from "@/lib/canvas/api-elements";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/theme";
import type { CanvasElement } from "@skedra/canvas-core";
import { Loader2, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

function formatAssistantMessage(
	content: string,
	elementCount: number | null,
	t: (key: string, params?: Record<string, string | number>) => string,
) {
	if (content.startsWith("kanban:")) {
		const [, lists = "0", cards = "0"] = content.split(":");
		return t("whiteboardPage.ai.generatedKanban", {
			lists: Number(lists) || 0,
			cards: Number(cards) || 0,
		});
	}
	if (content.startsWith("mindmap:")) {
		const [, nodes = "0"] = content.split(":");
		return t("whiteboardPage.ai.generatedMindmap", {
			nodes: Number(nodes) || 0,
		});
	}
	if (content.startsWith("flowchart:")) {
		const [, nodes = "0", edges = "0"] = content.split(":");
		return t("whiteboardPage.ai.generatedFlowchart", {
			nodes: Number(nodes) || 0,
			edges: Number(edges) || 0,
		});
	}
	if (content.startsWith("stickyNotes:")) {
		const [, notes = "0"] = content.split(":");
		return t("whiteboardPage.ai.generatedStickyNotes", {
			notes: Number(notes) || 0,
		});
	}
	if (content.startsWith("retrospective:")) {
		const [, sections = "0", notes = "0"] = content.split(":");
		return t("whiteboardPage.ai.generatedRetrospective", {
			sections: Number(sections) || 0,
			notes: Number(notes) || 0,
		});
	}
	if (content.startsWith("swot:")) {
		const [, quadrants = "0", notes = "0"] = content.split(":");
		return t("whiteboardPage.ai.generatedSwot", {
			quadrants: Number(quadrants) || 0,
			notes: Number(notes) || 0,
		});
	}
	if (content.startsWith("frames:")) {
		const [, frames = "0"] = content.split(":");
		return t("whiteboardPage.ai.generatedFrames", {
			frames: Number(frames) || 0,
		});
	}
	if (content.startsWith("showcase:")) {
		return t("whiteboardPage.ai.generatedShowcase");
	}

	return t("whiteboardPage.ai.generated", {
		count: elementCount ?? 0,
	});
}

interface AiDiagramPanelProps {
	open: boolean;
	whiteboardId: string;
	onClose: () => void;
	onAddElements: (elements: CanvasElement[]) => void;
	className?: string;
}

export function AiDiagramPanel({
	open,
	whiteboardId,
	onClose,
	onAddElements,
	className,
}: AiDiagramPanelProps) {
	const { t } = useI18n();
	const [prompt, setPrompt] = useState("");
	const [error, setError] = useState<string | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const utils = trpc.useUtils();
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);

	const { data: aiSettings } = trpc.ai.getSettings.useQuery(undefined, {
		enabled: open,
	});

	const { data: messages = [], isLoading: messagesLoading } =
		trpc.ai.listMessages.useQuery(
			{ whiteboardId },
			{ enabled: open && !!whiteboardId },
		);

	const aiAvailable =
		aiSettings?.configured === true ||
		aiSettings?.platformFallbackAvailable === true;

	const clearHistory = trpc.ai.clearMessages.useMutation({
		onSuccess: async () => {
			await utils.ai.listMessages.invalidate({ whiteboardId });
		},
	});

	const generate = trpc.ai.generateDiagram.useMutation({
		onSuccess: async (result) => {
			const elements = apiElementsToCanvasElements(result.elements, {
				resolvedTheme,
			});
			onAddElements(elements);
			setPrompt("");
			setError(null);
			await utils.ai.listMessages.invalidate({ whiteboardId });
		},
		onError: async (mutationError) => {
			setError(mutationError.message);
			await utils.ai.listMessages.invalidate({ whiteboardId });
		},
	});

	// Bei neuen Nachrichten automatisch nach unten scrollen
	useEffect(() => {
		if (!open) return;
		const node = scrollRef.current;
		if (!node) return;
		node.scrollTop = node.scrollHeight;
	});

	const handleGenerate = () => {
		const trimmed = prompt.trim();
		if (!trimmed || generate.isPending) return;
		setError(null);
		generate.mutate({ whiteboardId, prompt: trimmed });
	};

	return (
		<div
			className={cn(
				"pointer-events-none absolute inset-y-0 left-0 z-50 flex items-start justify-start p-4 pt-20 transition-[transform,opacity] duration-300 ease-out max-lg:p-3 max-lg:pt-[calc(8rem+env(safe-area-inset-top))]",
				open ? "translate-x-0 opacity-100" : "-translate-x-[108%] opacity-0",
				className,
			)}
			aria-hidden={!open}
		>
			<div
				className={cn(
					"pointer-events-auto flex h-[min(78vh,620px)] w-[min(92vw,420px)] flex-col overflow-hidden rounded-[28px] border border-border bg-card/95 shadow-2xl backdrop-blur-md max-lg:max-h-[calc(100dvh-15.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-lg:w-[min(100%,420px)] max-lg:rounded-2xl",
					!open && "pointer-events-none",
				)}
			>
				<div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
					<div>
						<p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
							{t("whiteboardPage.ai.label")}
						</p>
						<h2 className="mt-1 text-sm font-semibold">
							{t("whiteboardPage.ai.title")}
						</h2>
					</div>
					<div className="flex items-center gap-1">
						{messages.length > 0 && (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								disabled={clearHistory.isPending}
								onClick={() => clearHistory.mutate({ whiteboardId })}
								title={t("whiteboardPage.ai.clearHistory")}
								aria-label={t("whiteboardPage.ai.clearHistory")}
							>
								{clearHistory.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Trash2 className="h-4 w-4" />
								)}
							</Button>
						)}
						<Button type="button" variant="ghost" size="icon" onClick={onClose}>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{!aiAvailable ? (
					<div className="flex flex-1 flex-col px-4 py-4">
						<div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
							<p>{t("whiteboardPage.ai.notConfigured")}</p>
							<Link
								to="/settings"
								className="mt-2 inline-block font-medium text-primary hover:underline"
							>
								{t("whiteboardPage.ai.openSettings")}
							</Link>
						</div>
					</div>
				) : (
					<>
						{!aiSettings?.configured &&
							aiSettings?.platformFallbackAvailable && (
								<p className="mx-4 mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
									{t("whiteboardPage.ai.platformFallback")}
								</p>
							)}

						<div
							ref={scrollRef}
							className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
						>
							{messagesLoading ? (
								<div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									{t("whiteboardPage.ai.loadingHistory")}
								</div>
							) : messages.length === 0 ? (
								<div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
									{t("whiteboardPage.ai.emptyHistory")}
								</div>
							) : (
								messages.map((message) => {
									const isUser = message.role === "user";
									return (
										<div
											key={message.id}
											className={cn(
												"max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
												isUser
													? "ml-auto bg-primary text-primary-foreground"
													: "mr-auto border border-border bg-muted/40 text-foreground",
											)}
										>
											{isUser ? (
												<p className="whitespace-pre-wrap">{message.content}</p>
											) : (
												<p>
													{formatAssistantMessage(
														message.content,
														message.elementCount,
														t,
													)}
												</p>
											)}
										</div>
									);
								})
							)}
							{generate.isPending && (
								<div className="mr-auto flex max-w-[92%] items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
									<Loader2 className="h-4 w-4 animate-spin" />
									{t("whiteboardPage.ai.generating")}
								</div>
							)}
						</div>

						<div className="flex flex-col gap-2 border-t border-border px-4 py-4">
							{error && <p className="text-sm text-destructive">{error}</p>}
							<Textarea
								value={prompt}
								onChange={(event) => setPrompt(event.target.value)}
								placeholder={t("whiteboardPage.ai.placeholder")}
								className="min-h-[88px] resize-none"
								onKeyDown={(event) => {
									if (event.key === "Enter" && !event.shiftKey) {
										event.preventDefault();
										handleGenerate();
									}
								}}
							/>
							<Button
								className="w-full"
								disabled={!prompt.trim() || generate.isPending}
								onClick={handleGenerate}
							>
								{generate.isPending ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<Sparkles className="mr-2 h-4 w-4" />
								)}
								{t("whiteboardPage.ai.generate")}
							</Button>
							<p className="text-xs text-muted-foreground">
								{t("whiteboardPage.ai.hint")}
							</p>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
