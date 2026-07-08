import type { ArrowHead, ArrowMode, CanvasElement } from "./types";
import {
	DEFAULT_ARROW_HEAD_SCALE,
	MAX_ARROW_HEAD_SCALE,
	MIN_ARROW_HEAD_SCALE,
} from "./types";

const ARROW_HEAD_LENGTH_OPEN = 14;
const ARROW_HEAD_LENGTH_TRIANGLE = 12;

export type ArrowTextSide = "above" | "below";
export type ArrowTextOrientation = "horizontal" | "vertical";

export function arrowHeadLengthForType(
	type: ArrowHead | undefined,
	scale = DEFAULT_ARROW_HEAD_SCALE,
): number {
	if (!type || type === "none") return 0;
	const base =
		type === "triangle" ? ARROW_HEAD_LENGTH_TRIANGLE : ARROW_HEAD_LENGTH_OPEN;
	const clamped = Math.min(
		MAX_ARROW_HEAD_SCALE,
		Math.max(MIN_ARROW_HEAD_SCALE, scale ?? DEFAULT_ARROW_HEAD_SCALE),
	);
	return base * clamped;
}

export function smoothPath(points: [number, number][]): string {
	if (points.length === 0) return "";
	if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
	if (points.length === 2) {
		return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;
	}

	let d = `M ${points[0][0]} ${points[0][1]}`;
	for (let i = 1; i < points.length - 1; i++) {
		const midX = (points[i][0] + points[i + 1][0]) / 2;
		const midY = (points[i][1] + points[i + 1][1]) / 2;
		d += ` Q ${points[i][0]} ${points[i][1]} ${midX} ${midY}`;
	}
	const last = points[points.length - 1];
	d += ` L ${last[0]} ${last[1]}`;
	return d;
}

export function linePath(points: [number, number][]): string {
	if (!points || points.length < 2) return "";
	return points.reduce(
		(path, [x, y], index) =>
			`${path}${index === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`}`,
		"",
	);
}

export function quadBezierPath(points: [number, number][]): string {
	if (!points || points.length < 3) return linePath(points);
	const [start, ctrl, end] = points;
	return `M ${start[0]} ${start[1]} Q ${ctrl[0]} ${ctrl[1]} ${end[0]} ${end[1]}`;
}

function cubicBezierPath(points: [number, number][]): string {
	if (!points || points.length < 4) return quadBezierPath(points);
	const [start, ctrl1, ctrl2, end] = points;
	return `M ${start[0]} ${start[1]} C ${ctrl1[0]} ${ctrl1[1]} ${ctrl2[0]} ${ctrl2[1]} ${end[0]} ${end[1]}`;
}

export function getArrowPath(
	points: [number, number][],
	mode: ArrowMode | undefined,
): string {
	if (mode === "curve") {
		return points.length === 4
			? cubicBezierPath(points)
			: points.length > 3
				? smoothPath(points)
				: quadBezierPath(points);
	}
	if (mode === "elbow") return elbowPath(points);
	return linePath(points);
}

function getArrowMidpointAndTangent(
	points: [number, number][],
	mode: ArrowMode | undefined,
): { point: [number, number]; tangent: [number, number] } {
	if (!points || points.length < 2) {
		return { point: [0, 0], tangent: [1, 0] };
	}

	if (mode === "curve" && points.length === 4) {
		const [start, ctrl1, ctrl2, end] = points;
		const t = 0.5;
		const mt = 1 - t;
		const point: [number, number] = [
			mt * mt * mt * start[0] +
				3 * mt * mt * t * ctrl1[0] +
				3 * mt * t * t * ctrl2[0] +
				t * t * t * end[0],
			mt * mt * mt * start[1] +
				3 * mt * mt * t * ctrl1[1] +
				3 * mt * t * t * ctrl2[1] +
				t * t * t * end[1],
		];
		const tangent: [number, number] = [
			3 * mt * mt * (ctrl1[0] - start[0]) +
				6 * mt * t * (ctrl2[0] - ctrl1[0]) +
				3 * t * t * (end[0] - ctrl2[0]),
			3 * mt * mt * (ctrl1[1] - start[1]) +
				6 * mt * t * (ctrl2[1] - ctrl1[1]) +
				3 * t * t * (end[1] - ctrl2[1]),
		];
		return { point, tangent };
	}

	if (mode === "curve" && points.length >= 3) {
		const [start, ctrl, end] = points;
		const t = 0.5;
		const mt = 1 - t;
		const point: [number, number] = [
			mt * mt * start[0] + 2 * mt * t * ctrl[0] + t * t * end[0],
			mt * mt * start[1] + 2 * mt * t * ctrl[1] + t * t * end[1],
		];
		const tangent: [number, number] = [
			2 * mt * (ctrl[0] - start[0]) + 2 * t * (end[0] - ctrl[0]),
			2 * mt * (ctrl[1] - start[1]) + 2 * t * (end[1] - ctrl[1]),
		];
		return { point, tangent };
	}

	const segments = points.slice(0, -1).map((start, index) => {
		const end = points[index + 1];
		return {
			start,
			end,
			length: Math.hypot(end[0] - start[0], end[1] - start[1]),
		};
	});
	const totalLength = segments.reduce(
		(sum, segment) => sum + segment.length,
		0,
	);
	if (totalLength === 0) {
		return { point: points[0], tangent: [1, 0] };
	}

	let traveled = 0;
	const midpointLength = totalLength / 2;
	for (const segment of segments) {
		if (traveled + segment.length >= midpointLength) {
			const remaining = midpointLength - traveled;
			const ratio = segment.length === 0 ? 0 : remaining / segment.length;
			const point: [number, number] = [
				segment.start[0] + (segment.end[0] - segment.start[0]) * ratio,
				segment.start[1] + (segment.end[1] - segment.start[1]) * ratio,
			];
			const tangent: [number, number] = [
				segment.end[0] - segment.start[0],
				segment.end[1] - segment.start[1],
			];
			return { point, tangent };
		}
		traveled += segment.length;
	}

	const start = points[0];
	const end = points[points.length - 1];
	return {
		point: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
		tangent: [end[0] - start[0], end[1] - start[1]],
	};
}

export function getArrowTextSideFromPoint(
	points: [number, number][],
	mode: ArrowMode | undefined,
	x: number,
	y: number,
): ArrowTextSide {
	const { point, tangent } = getArrowMidpointAndTangent(points, mode);
	const length = Math.hypot(tangent[0], tangent[1]) || 1;
	const normalX = tangent[1] / length;
	const normalY = -tangent[0] / length;
	const relX = x - point[0];
	const relY = y - point[1];
	return relX * normalX + relY * normalY >= 0 ? "above" : "below";
}

export function resolveArrowTextOffset(
	fontSize: number,
	strokeWidth: number,
	orientation: ArrowTextOrientation,
	text: string,
): number {
	const gap = 4 + strokeWidth * 0.5;
	const lines = text.split("\n");
	const lineHeight = fontSize * 1.35;
	if (orientation === "horizontal") {
		const halfBlock = ((lines.length - 1) * lineHeight + fontSize) / 2;
		return gap + halfBlock;
	}

	const longestLine = lines.reduce(
		(max, line) => Math.max(max, line.length),
		0,
	);
	const estimatedTextWidth = Math.max(fontSize, longestLine * fontSize * 0.58);
	return gap + estimatedTextWidth / 2;
}

function normalizeReadableTextAngle(degrees: number): number {
	let normalized = ((degrees + 180) % 360) - 180;
	if (normalized > 90) normalized -= 180;
	if (normalized < -90) normalized += 180;
	return normalized;
}

export function resolveArrowTextRotationDeg(
	tangentAngle: number,
	orientation: ArrowTextOrientation,
): number {
	const alongArrowDeg = (tangentAngle * 180) / Math.PI;
	const rotationDeg =
		orientation === "vertical" ? alongArrowDeg + 90 : alongArrowDeg;
	return normalizeReadableTextAngle(rotationDeg);
}

export function getArrowTextMetrics(
	points: [number, number][],
	mode: ArrowMode | undefined,
	side: ArrowTextSide,
	offset = 10,
): {
	anchor: [number, number];
	path: string;
	tangentAngle: number;
} {
	const { point, tangent } = getArrowMidpointAndTangent(points, mode);
	const length = Math.hypot(tangent[0], tangent[1]) || 1;
	const normalX = tangent[1] / length;
	const normalY = -tangent[0] / length;
	const direction = side === "above" ? 1 : -1;
	const offsetX = normalX * offset * direction;
	const offsetY = normalY * offset * direction;
	const offsetPoints = points.map(
		([pointX, pointY]) =>
			[pointX + offsetX, pointY + offsetY] as [number, number],
	);

	return {
		anchor: [point[0] + offsetX, point[1] + offsetY],
		path: getArrowPath(offsetPoints, mode),
		tangentAngle: Math.atan2(tangent[1], tangent[0]),
	};
}

function getPathTextLabelBounds(el: CanvasElement): {
	centerX: number;
	centerY: number;
	width: number;
	height: number;
	rotationDeg: number;
} | null {
	if (el.type !== "arrow" && el.type !== "line") return null;
	if (!el.points || el.points.length < 2) return null;

	const rawText = el.text ?? "";
	if (!rawText.replace(/\s/g, "").length) return null;

	const customData = readElementCustomData(el.customData);
	const labelSide =
		(customData.arrowTextSide as ArrowTextSide | undefined) ?? "above";
	const orientation =
		(customData.arrowTextOrientation as ArrowTextOrientation | undefined) ??
		"horizontal";
	const fontSize = el.fontSize ?? 16;
	const labelOffset = resolveArrowTextOffset(
		fontSize,
		el.strokeWidth,
		orientation,
		rawText,
	);
	const labelMetrics = getArrowTextMetrics(
		el.points,
		el.type === "arrow" ? el.arrowMode : undefined,
		labelSide,
		labelOffset,
	);

	const lines = rawText.split("\n");
	const lineHeight = fontSize * 1.35;
	const longestLine = lines.reduce(
		(max, line) => Math.max(max, line.length),
		0,
	);

	return {
		centerX: el.x + labelMetrics.anchor[0],
		centerY: el.y + labelMetrics.anchor[1],
		width: Math.max(fontSize, longestLine * fontSize * 0.58),
		height: lines.length * lineHeight,
		rotationDeg: resolveArrowTextRotationDeg(
			labelMetrics.tangentAngle,
			orientation,
		),
	};
}

export function pathTextLabelHitTest(
	el: CanvasElement,
	px: number,
	py: number,
	tolerance = 8,
): boolean {
	const bounds = getPathTextLabelBounds(el);
	if (!bounds) return false;

	const { centerX, centerY, width, height, rotationDeg } = bounds;
	const dx = px - centerX;
	const dy = py - centerY;
	const rad = (-rotationDeg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const localX = dx * cos - dy * sin;
	const localY = dx * sin + dy * cos;

	return (
		Math.abs(localX) <= width / 2 + tolerance &&
		Math.abs(localY) <= height / 2 + tolerance
	);
}

export function elbowPath(points: [number, number][], radius = 12): string {
	if (!points || points.length < 2) return "";
	if (points.length === 2) return linePath(points);

	let d = `M ${points[0][0]} ${points[0][1]}`;

	for (let i = 1; i < points.length - 1; i++) {
		const prev = points[i - 1];
		const curr = points[i];
		const next = points[i + 1];

		const dx1 = curr[0] - prev[0];
		const dy1 = curr[1] - prev[1];
		const dx2 = next[0] - curr[0];
		const dy2 = next[1] - curr[1];
		const len1 = Math.hypot(dx1, dy1);
		const len2 = Math.hypot(dx2, dy2);

		const r = Math.min(radius, len1 / 2, len2 / 2);

		const beforeX = curr[0] - (dx1 / len1) * r;
		const beforeY = curr[1] - (dy1 / len1) * r;
		const afterX = curr[0] + (dx2 / len2) * r;
		const afterY = curr[1] + (dy2 / len2) * r;

		d += ` L ${beforeX} ${beforeY}`;
		d += ` Q ${curr[0]} ${curr[1]} ${afterX} ${afterY}`;
	}

	const last = points[points.length - 1];
	d += ` L ${last[0]} ${last[1]}`;
	return d;
}

function arrowHeadLines(
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	headLength = 14,
): { x1: number; y1: number; x2: number; y2: number; x3: number; y3: number } {
	const angle = Math.atan2(toY - fromY, toX - fromX);
	const a1 = angle - Math.PI / 7;
	const a2 = angle + Math.PI / 7;

	return {
		x1: toX - headLength * Math.cos(a1),
		y1: toY - headLength * Math.sin(a1),
		x2: toX,
		y2: toY,
		x3: toX - headLength * Math.cos(a2),
		y3: toY - headLength * Math.sin(a2),
	};
}

function arrowHeadPoints(
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	headLength = 12,
): string {
	const angle = Math.atan2(toY - fromY, toX - fromX);
	const a1 = angle - Math.PI / 6;
	const a2 = angle + Math.PI / 6;

	const x1 = toX - headLength * Math.cos(a1);
	const y1 = toY - headLength * Math.sin(a1);
	const x2 = toX - headLength * Math.cos(a2);
	const y2 = toY - headLength * Math.sin(a2);

	return `${toX},${toY} ${x1},${y1} ${x2},${y2}`;
}

export interface ArrowHeadData {
	type: "lines" | "triangle" | "dot";
	lines?: {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		x3: number;
		y3: number;
	};
	polygon?: string;
	cx?: number;
	cy?: number;
	r?: number;
}

export function renderArrowHead(
	type: ArrowHead | undefined,
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	_stroke: string,
	headLength = 14,
): ArrowHeadData | null {
	if (!type || type === "none") return null;
	if (type === "arrow") {
		return {
			type: "lines",
			lines: arrowHeadLines(fromX, fromY, toX, toY, headLength),
		};
	}
	if (type === "triangle") {
		return {
			type: "triangle",
			polygon: arrowHeadPoints(fromX, fromY, toX, toY, headLength),
		};
	}
	if (type === "dot") {
		return { type: "dot", cx: toX, cy: toY, r: headLength / 2.5 };
	}
	return null;
}

function readElementCustomData(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object") return {};
	return { ...(value as Record<string, unknown>) };
}
