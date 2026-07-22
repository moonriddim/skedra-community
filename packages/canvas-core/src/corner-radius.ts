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

export function roundedDiamondSvgPath(
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
): string {
	const w = Math.max(1, width);
	const h = Math.max(1, height);
	const rx = Math.min(Math.max(0, radius), w / 4);
	const ry = Math.min(Math.max(0, radius), h / 4);
	const top = { x: x + w / 2, y };
	const right = { x: x + w, y: y + h / 2 };
	const bottom = { x: x + w / 2, y: y + h };
	const left = { x, y: y + h / 2 };
	if (rx <= 0 || ry <= 0) {
		return `M ${top.x} ${top.y} L ${right.x} ${right.y} L ${bottom.x} ${bottom.y} L ${left.x} ${left.y} Z`;
	}
	return [
		`M ${top.x + rx} ${top.y + ry}`,
		`L ${right.x - rx} ${right.y - ry}`,
		`C ${right.x} ${right.y} ${right.x} ${right.y} ${right.x - rx} ${right.y + ry}`,
		`L ${bottom.x + rx} ${bottom.y - ry}`,
		`C ${bottom.x} ${bottom.y} ${bottom.x} ${bottom.y} ${bottom.x - rx} ${bottom.y - ry}`,
		`L ${left.x + rx} ${left.y + ry}`,
		`C ${left.x} ${left.y} ${left.x} ${left.y} ${left.x + rx} ${left.y - ry}`,
		`L ${top.x - rx} ${top.y + ry}`,
		`C ${top.x} ${top.y} ${top.x} ${top.y} ${top.x + rx} ${top.y + ry}`,
		"Z",
	].join(" ");
}
