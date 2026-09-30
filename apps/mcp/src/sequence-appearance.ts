import type { SequenceDiagramAppearance } from "@skedra/canvas-core";

export function getMcpSequenceAppearance(
	canvasBg: string,
	theme?: "light" | "dark",
): SequenceDiagramAppearance {
	const hex = /^#([\da-f]{6}|[\da-f]{3})$/i.exec(canvasBg)?.[1];
	const expanded =
		hex?.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
	const rgb = expanded
		? [0, 2, 4].map((offset) =>
				Number.parseInt(expanded.slice(offset, offset + 2), 16),
			)
		: null;
	const dark = theme
		? theme === "dark"
		: rgb
			? (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 < 128
			: true;
	return {
		fontFamily: "system-ui, sans-serif",
		stroke: dark ? "#e2e8f0" : "#334155",
		textColor: dark ? "#f1f5f9" : "#1e293b",
		messageStroke: dark ? "#5eead4" : "#0f766e",
		participantFill: dark ? "#15332e" : "#f0fdfa",
		participantStroke: dark ? "#5eead4" : "#0f766e",
		lifelineStroke: dark ? "#94a3b8" : "#64748b",
		activationFill: dark ? "#234c43" : "#ccfbf1",
		noteFill: dark ? "#3f3218" : "#fef3c7",
		noteStroke: dark ? "#fbbf24" : "#d97706",
		noteTextColor: dark ? "#fde68a" : "#713f12",
		fragmentStroke: dark ? "#94a3b8" : "#64748b",
		fragmentFill: "transparent",
	};
}
