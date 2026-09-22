import type { CanvasElement } from "@skedra/canvas-core";

function luminance(color: string | undefined): number | null {
	if (!color) return null;
	const normalized = color.trim().toLowerCase();
	if (normalized === "black") return 0;
	if (normalized === "white") return 1;
	const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(normalized)?.[1];
	const rgb =
		/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(
			normalized,
		);
	if (!hex && !rgb) return null;
	if (rgb?.[4] !== undefined && Number(rgb[4]) === 0) return null;
	const channels = hex
		? (hex.length === 3
				? [...hex].map((c) => c + c)
				: [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)]
			).map((c) => Number.parseInt(c, 16))
		: [Number(rgb?.[1]), Number(rgb?.[2]), Number(rgb?.[3])];
	const linear = channels.map((channel) => {
		const value = Math.min(255, channel) / 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

/** Keep saved symbol colors intact and choose a contrasting preview surface. */
export function getLibraryPreviewBackground(
	elements: readonly CanvasElement[],
): string {
	const colors: number[] = [];
	for (const element of elements) {
		if (element.opacity === 0) continue;
		const paints = [
			element.strokeWidth > 0 ? element.stroke : undefined,
			element.text ? (element.textColor ?? element.stroke) : undefined,
		];
		// Filled, unoutlined symbols still need a contrasting surface.
		if (!paints.some((paint) => luminance(paint) !== null))
			paints.push(element.fill);
		for (const paint of paints) {
			const value = luminance(paint);
			if (value !== null) colors.push(value);
		}
	}
	if (!colors.length) return "var(--background)";
	const candidates = ["#fafaf9", "#1a1a1a", "#808080"];
	let best = candidates[0];
	let bestScore = -1;
	for (const candidate of candidates) {
		const background = luminance(candidate) ?? 1;
		// Maximize the weakest contrast so mixed light/dark symbols stay visible.
		const score = Math.min(
			...colors.map(
				(color) =>
					(Math.max(color, background) + 0.05) /
					(Math.min(color, background) + 0.05),
			),
		);
		if (score > bestScore) {
			best = candidate;
			bestScore = score;
		}
	}
	return best;
}
