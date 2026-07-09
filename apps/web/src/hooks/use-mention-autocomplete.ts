import {
	type MentionCandidate,
	filterMentionCandidates,
	getActiveMentionAtCaret,
	insertMentionInText,
} from "@/lib/mention-utils";
import { useCallback, useMemo, useState } from "react";

interface UseMentionAutocompleteOptions {
	candidates: MentionCandidate[];
	text: string;
	caretIndex: number;
	onTextChange: (nextText: string, nextCaret: number) => void;
}

/**
 * Steuert @-Vorschläge im Kommentar-Textfeld (Pfeiltasten, Enter, Escape).
 */
export function useMentionAutocomplete({
	candidates,
	text,
	caretIndex,
	onTextChange,
}: UseMentionAutocompleteOptions) {
	const [highlightIndex, setHighlightIndex] = useState(0);

	const activeMention = useMemo(
		() => getActiveMentionAtCaret(text, caretIndex),
		[text, caretIndex],
	);

	const suggestions = useMemo(() => {
		if (!activeMention) return [];
		return filterMentionCandidates(candidates, activeMention.query).slice(0, 8);
	}, [activeMention, candidates]);

	const isOpen = !!activeMention;
	const hasSuggestions = suggestions.length > 0;

	const safeHighlightIndex = hasSuggestions
		? Math.min(highlightIndex, suggestions.length - 1)
		: 0;

	const selectSuggestion = useCallback(
		(member: MentionCandidate) => {
			if (!activeMention) return;
			const { nextText, nextCaret } = insertMentionInText(
				text,
				caretIndex,
				activeMention.mentionStart,
				member,
			);
			onTextChange(nextText, nextCaret);
			setHighlightIndex(0);
		},
		[activeMention, caretIndex, onTextChange, text],
	);

	const handleTextUpdate = useCallback(
		(nextText: string, nextCaret: number) => {
			onTextChange(nextText, nextCaret);
			setHighlightIndex(0);
		},
		[onTextChange],
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (!isOpen) return false;

			if (hasSuggestions && event.key === "ArrowDown") {
				event.preventDefault();
				setHighlightIndex((current) => (current + 1) % suggestions.length);
				return true;
			}

			if (hasSuggestions && event.key === "ArrowUp") {
				event.preventDefault();
				setHighlightIndex(
					(current) => (current - 1 + suggestions.length) % suggestions.length,
				);
				return true;
			}

			if (event.key === "Escape") {
				event.preventDefault();
				setHighlightIndex(0);
				return true;
			}

			if (hasSuggestions && (event.key === "Enter" || event.key === "Tab")) {
				const selected = suggestions[safeHighlightIndex];
				if (selected) {
					event.preventDefault();
					selectSuggestion(selected);
					return true;
				}
			}

			return false;
		},
		[hasSuggestions, isOpen, safeHighlightIndex, selectSuggestion, suggestions],
	);

	return {
		isOpen,
		hasSuggestions,
		suggestions,
		highlightIndex: safeHighlightIndex,
		setHighlightIndex,
		selectSuggestion,
		handleTextUpdate,
		handleKeyDown,
	};
}
