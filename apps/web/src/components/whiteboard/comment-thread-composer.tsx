/**
 * Antwort-Eingabe für einen Kommentar-Thread (Popover + Sidebar) mit @-Erwähnungen.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useMentionAutocomplete } from "@/hooks/use-mention-autocomplete";
import { useI18n } from "@/lib/i18n";
import type { MentionCandidate } from "@/lib/mention-utils";
import { getUserInitials } from "@/lib/user-initials";
import { Loader2, Send } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { MentionSuggestions } from "./mention-suggestions";

interface CommentThreadComposerProps {
	currentUser?: { name: string; image: string | null };
	mentionCandidates?: MentionCandidate[];
	placeholder: string;
	isSending: boolean;
	autoFocus?: boolean;
	onSubmit: (body: string) => void;
}

export function CommentThreadComposer({
	currentUser,
	mentionCandidates = [],
	placeholder,
	isSending,
	autoFocus = false,
	onSubmit,
}: CommentThreadComposerProps) {
	const { t } = useI18n();
	const [draft, setDraft] = useState("");
	const [caretIndex, setCaretIndex] = useState(0);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const syncCaret = useCallback(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		setCaretIndex(textarea.selectionStart ?? draft.length);
	}, [draft.length]);

	const applyTextChange = useCallback((nextText: string, nextCaret: number) => {
		setDraft(nextText);
		setCaretIndex(nextCaret);
		requestAnimationFrame(() => {
			const textarea = textareaRef.current;
			if (!textarea) return;
			textarea.focus();
			textarea.setSelectionRange(nextCaret, nextCaret);
		});
	}, []);

	const mention = useMentionAutocomplete({
		candidates: mentionCandidates,
		text: draft,
		caretIndex,
		onTextChange: applyTextChange,
	});

	const handleSubmit = () => {
		const body = draft.trim();
		if (!body || isSending) return;
		onSubmit(body);
		setDraft("");
		setCaretIndex(0);
	};

	return (
		<div className="flex gap-2">
			{currentUser ? (
				<Avatar className="mt-0.5 h-7 w-7 shrink-0 border border-white/10">
					<AvatarImage
						src={currentUser.image ?? undefined}
						alt={currentUser.name}
					/>
					<AvatarFallback className="bg-white/10 text-[10px] text-white">
						{getUserInitials(currentUser.name)}
					</AvatarFallback>
				</Avatar>
			) : null}
			<div className="relative min-w-0 flex-1">
				{mention.isOpen ? (
					<MentionSuggestions
						suggestions={mention.suggestions}
						highlightIndex={mention.highlightIndex}
						onHighlight={mention.setHighlightIndex}
						onSelect={mention.selectSuggestion}
					/>
				) : null}
				<textarea
					ref={textareaRef}
					value={draft}
					onChange={(event) => {
						const nextText = event.target.value;
						const nextCaret = event.target.selectionStart ?? nextText.length;
						mention.handleTextUpdate(nextText, nextCaret);
					}}
					onSelect={syncCaret}
					onKeyUp={syncCaret}
					onClick={syncCaret}
					placeholder={placeholder}
					maxLength={2000}
					rows={2}
					className="min-h-[52px] w-full resize-none rounded-xl border border-white/10 bg-white/6 px-3 py-2 pr-10 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/10"
					onKeyDown={(event) => {
						if (mention.handleKeyDown(event)) return;
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							handleSubmit();
						}
					}}
				/>
				<Button
					type="button"
					size="icon"
					onClick={handleSubmit}
					disabled={isSending || draft.trim().length === 0}
					className="absolute bottom-1.5 right-1.5 h-7 w-7 rounded-lg border border-white/10 bg-white/8 text-white hover:bg-white/[0.14]"
					aria-label={t("whiteboardPage.comments.send")}
				>
					{isSending ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<Send className="h-3.5 w-3.5" />
					)}
				</Button>
			</div>
		</div>
	);
}
