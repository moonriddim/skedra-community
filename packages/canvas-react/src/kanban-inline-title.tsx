import { useCallback, useRef, useState } from "react";

/** Keep the draft local: collaboration updates must not replace unfinished typing. */
export function KanbanInlineTitle({
	title,
	placeholder,
	label,
	onSave,
}: {
	title: string;
	placeholder: string;
	label: string;
	onSave: (title: string) => void;
}) {
	const [draft, setDraft] = useState<string | null>(null);
	const cancel = useRef(false);
	const focusInput = useCallback((node: HTMLTextAreaElement | null) => {
		if (node) {
			node.focus({ preventScroll: true });
			node.setSelectionRange(node.value.length, node.value.length);
		}
	}, []);
	const style = {
		width: "100%",
		minHeight: 40,
		padding: 0,
		margin: 0,
		border: 0,
		borderRadius: 4,
		background: "transparent",
		color: "inherit",
		font: "inherit",
		textAlign: "left" as const,
		lineHeight: 1.3,
		boxSizing: "border-box" as const,
	};
	return draft === null ? (
		<button
			type="button"
			aria-label={label}
			style={{
				...style,
				cursor: "text",
				whiteSpace: "pre-wrap",
				wordBreak: "break-word",
				display: "-webkit-box",
				WebkitLineClamp: 3,
				WebkitBoxOrient: "vertical",
				overflow: "hidden",
			}}
			onClick={() => {
				cancel.current = false;
				setDraft(title);
			}}
		>
			{title || placeholder}
		</button>
	) : (
		<textarea
			aria-label={label}
			value={draft}
			rows={2}
			ref={focusInput}
			style={{
				...style,
				resize: "none",
				outline: "2px solid var(--color-primary, #14b8a6)",
				fontSize: "max(16px, 1em)",
			}}
			onChange={(event) => setDraft(event.target.value)}
			onBlur={(event) => {
				const value = event.currentTarget.value;
				if (!cancel.current && value !== title) onSave(value);
				setDraft(null);
			}}
			onKeyDown={(event) => {
				if (event.nativeEvent.isComposing) return;
				if (event.key === "Escape") {
					event.preventDefault();
					cancel.current = true;
					event.currentTarget.blur();
				}
				if (event.key === "Enter" && !event.shiftKey) {
					event.preventDefault();
					event.currentTarget.blur();
				}
			}}
		/>
	);
}
