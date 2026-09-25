import { useEffect, useState } from "react";

/** Shared by canvas properties and the sticky-note editor. */
export function FontSizeControl({
	value,
	onChange,
	label,
	disabled = false,
}: {
	value: number;
	onChange: (value: number) => void;
	label: string;
	disabled?: boolean;
}) {
	const [draft, setDraft] = useState(String(value));
	useEffect(() => setDraft(String(value)), [value]);
	return (
		<div
			className="canvas-editor__font-size-control"
			data-text-editor-safe="true"
		>
			<input
				type="range"
				min={6}
				max={256}
				step={1}
				value={Math.min(256, Math.max(6, Number(draft) || value))}
				aria-label={label}
				disabled={disabled}
				onChange={(event) => {
					setDraft(event.target.value);
					onChange(Number(event.target.value));
				}}
			/>
			<input
				type="number"
				min={6}
				max={256}
				step={0.1}
				value={draft}
				aria-label={`${label} (px)`}
				disabled={disabled}
				onChange={(event) => {
					setDraft(event.target.value);
					const next = Number(event.target.value);
					if (
						event.target.value &&
						Number.isFinite(next) &&
						next >= 6 &&
						next <= 256
					)
						onChange(next);
				}}
				onBlur={() => {
					const next = Number(draft);
					if (!draft || !Number.isFinite(next)) setDraft(String(value));
					else {
						const size = Math.min(256, Math.max(6, next));
						setDraft(String(size));
						onChange(size);
					}
				}}
				onKeyDown={(event) => event.stopPropagation()}
			/>
		</div>
	);
}

/** Lets host property panels format the active note row without mutating the whole note. */
export function applyActiveStickyFontSize(
	id: string,
	fontSize: number,
): boolean {
	if (typeof document === "undefined") return false;
	const editor = Array.from(
		document.querySelectorAll<HTMLElement>("[data-sticky-note-editor]"),
	).find((node) => node.dataset.stickyNoteId === id);
	if (!editor) return false;
	return !editor.dispatchEvent(
		new CustomEvent("skedra-sticky-font-size", {
			detail: fontSize,
			cancelable: true,
		}),
	);
}
