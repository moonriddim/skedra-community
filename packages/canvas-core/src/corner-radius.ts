import type { CanvasElement } from "./types";

type CornerRadiusElement = Pick<
	CanvasElement,
	"width" | "height" | "cornerRadius" | "cornerRadiusPercent"
>;

function maxCornerRadius(width: number, height: number): number {
	const shortSide = Math.min(Math.max(1, width), Math.max(1, height));
	return shortSide / 2;
}

function cornerRadiusFromPercent(
	percent: number,
	width: number,
	height: number,
): number {
	const clamped = Math.min(100, Math.max(0, percent));
	return Math.round((clamped / 100) * maxCornerRadius(width, height));
}

function cornerRadiusToPercent(
	radius: number,
	width: number,
	height: number,
): number {
	const max = maxCornerRadius(width, height);
	if (max <= 0) return 0;
	return Math.min(100, Math.round((Math.max(0, radius) / max) * 100));
}

export function getCornerRadiusPercent(el: CornerRadiusElement): number {
	if (el.cornerRadiusPercent != null) {
		return Math.min(100, Math.max(0, Math.round(el.cornerRadiusPercent)));
	}
	return cornerRadiusToPercent(el.cornerRadius ?? 0, el.width, el.height);
}

export function getEffectiveCornerRadius(el: CornerRadiusElement): number {
	if (el.cornerRadiusPercent != null) {
		return cornerRadiusFromPercent(el.cornerRadiusPercent, el.width, el.height);
	}
	const max = maxCornerRadius(el.width, el.height);
	return Math.min(el.cornerRadius ?? 0, max);
}

export function roundedRectSvgPath(
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
): string {
	const w = Math.max(1, width);
	const h = Math.max(1, height);
	const r = Math.min(Math.max(0, radius), w / 2, h / 2);
	if (r <= 0) {
		return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
	}
	return [
		`M ${x + r} ${y}`,
		`H ${x + w - r}`,
		`A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
		`V ${y + h - r}`,
		`A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
		`H ${x + r}`,
		`A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
		`V ${y + r}`,
		`A ${r} ${r} 0 0 1 ${x + r} ${y}`,
		"Z",
	].join(" ");
}
