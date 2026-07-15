import {
	getCloudSvgPath,
	getEffectiveCornerRadius,
	getLinePath,
	getPyramidDividerSegments,
	getTrianglePoints,
	roundedRectSvgPath,
} from "@skedra/canvas-core";
import type {
	ArrowHeadData,
	CanvasElement,
	RoughFillStyle,
} from "@skedra/canvas-core";
import {
	DEFAULT_ROUGH_FILL_STYLE,
	roughPatternFillGaps,
} from "@skedra/canvas-core";
import { useMemo } from "react";
import rough from "roughjs";

interface RoughPreset {
	roughness: number;
	bowing: number;
	maxRandomnessOffset: number;
}

const ROUGH_PRESETS: Record<number, RoughPreset> = {
	1: { roughness: 1.18, bowing: 0.72, maxRandomnessOffset: 1.22 },
	2: { roughness: 1.82, bowing: 1.05, maxRandomnessOffset: 2.18 },
};

const EXACT_ROUGH: RoughPreset = {
	roughness: 0,
	bowing: 0,
	maxRandomnessOffset: 0,
};

/** Excalidraw-Bibliothek: stabiler Seed + etwas dezenteres Rough-Preset. */
const EXCALIDRAW_ROUGH: RoughPreset = {
	roughness: 1,
	bowing: 0.85,
	maxRandomnessOffset: 1.2,
};

const SVG_NS = "http://www.w3.org/2000/svg";

function getElementRoughSeed(el: CanvasElement): number {
	const seed = el.customData?.excalidrawSeed;
	if (typeof seed === "number" && Number.isFinite(seed)) {
		return Math.abs(Math.trunc(seed));
	}
	return hashCode(el.id);
}

function getRoughPreset(el: CanvasElement, level: number) {
	if (el.customData?.excalidrawImport === true && level > 0) {
		return EXCALIDRAW_ROUGH;
	}
	const preset = ROUGH_PRESETS[level] ?? ROUGH_PRESETS[1];
	if (el.type !== "triangle") return preset;
	return {
		roughness: preset.roughness * 1.18,
		bowing: preset.bowing * 1.2,
		maxRandomnessOffset: preset.maxRandomnessOffset * 1.28,
	};
}

function isFillCapableShape(el: CanvasElement): boolean {
	return (
		el.type === "rectangle" ||
		el.type === "ellipse" ||
		el.type === "diamond" ||
		el.type === "triangle" ||
		el.type === "cloud" ||
		(el.type === "line" && el.closed === true && (el.points?.length ?? 0) >= 3)
	);
}

export interface RoughShapeLayers {
	/** Geclippte Musterfuellung (rough.js, ohne Strich) */
	fillHtml: string | null;
	/** Skizzen-Strich (rough.js, ohne Fuellung) oder kombiniert bei Vollflaeche */
	strokeHtml: string | null;
	/** Exakter SVG-Strich ueber geclipptem Muster (Sauberkeit = exakt) */
	svgStrokeFallback: boolean;
	/** Zusaetzliche skizzierte Formdetails, zum Beispiel Pyramiden-Trennlinien. */
	detailHtml: string | null;
}

type RoughGenerator = ReturnType<typeof rough.svg>;
type RoughOptions = Parameters<RoughGenerator["rectangle"]>[4];

function createSvgGroup() {
	return document.createElementNS(SVG_NS, "g");
}

function createSvgPath() {
	return document.createElementNS(SVG_NS, "path");
}

function buildSolidRoundedRectFillHtml(el: CanvasElement): string | null {
	if (!el.fill || el.fill === "transparent") return null;
	const cornerR = getEffectiveCornerRadius(el);
	const group = createSvgGroup();
	const path = createSvgPath();
	path.setAttribute(
		"d",
		roundedRectSvgPath(
			el.x,
			el.y,
			Math.max(1, el.width),
			Math.max(1, el.height),
			cornerR,
		),
	);
	path.setAttribute("fill", el.fill);
	path.setAttribute("stroke", "none");
	group.appendChild(path);
	return group.innerHTML;
}

function buildContinuousRoundedRectStrokeHtml(
	el: CanvasElement,
	preset: RoughPreset,
	passCount: number,
): string | null {
	const w = Math.max(1, el.width);
	const h = Math.max(1, el.height);
	const r = Math.min(getEffectiveCornerRadius(el), w / 2, h / 2);
	if (r <= 0) return null;

	const group = createSvgGroup();
	const k = 0.5522847498;
	const endpointJitter = preset.maxRandomnessOffset * 0.3;
	const sideJitter = preset.maxRandomnessOffset * (0.62 + preset.bowing * 0.1);
	const sideControlJitter = sideJitter * 0.46;
	const cornerControlJitter =
		preset.maxRandomnessOffset * (0.58 + preset.bowing * 0.14);
	const passes = Math.max(1, passCount);
	const organicOffset = (
		index: number,
		pass: number,
		axis: 0 | 1,
		amount: number,
	) => Math.sin((index + 1) * 1.47 + pass * 2.31 + axis * 1.13) * amount;
	type PathPoint = readonly [number, number];

	for (let pass = 0; pass < passes; pass++) {
		const passScale = pass === 0 ? 1 : 1.12;
		const pt = (index: number, x: number, y: number, amount = endpointJitter) =>
			[
				x + organicOffset(index, pass, 0, amount * passScale),
				y + organicOffset(index, pass, 1, amount * passScale),
			] as const;
		const ctrl = (index: number, x: number, y: number) =>
			pt(index, x, y, cornerControlJitter);
		const sidePt = (
			index: number,
			x: number,
			y: number,
			normalAxis: 0 | 1,
			amount = sideJitter,
		) =>
			[
				x +
					organicOffset(
						index,
						pass,
						0,
						(normalAxis === 0 ? amount : amount * 0.18) * passScale,
					),
				y +
					organicOffset(
						index,
						pass,
						1,
						(normalAxis === 1 ? amount : amount * 0.18) * passScale,
					),
			] as const;
		const sideAnchors = (
			from: PathPoint,
			to: PathPoint,
			startIndex: number,
			normalAxis: 0 | 1,
		): PathPoint[] => {
			const dx = to[0] - from[0];
			const dy = to[1] - from[1];
			const length = Math.hypot(dx, dy);
			const fractions =
				length > 300 ? [0.25, 0.5, 0.75] : length > 96 ? [1 / 3, 2 / 3] : [];
			return [
				from,
				...fractions.map((fraction, index) =>
					sidePt(
						startIndex + index,
						from[0] + dx * fraction,
						from[1] + dy * fraction,
						normalAxis,
					),
				),
				to,
			];
		};
		const sideSegments = (
			points: readonly PathPoint[],
			startIndex: number,
			normalAxis: 0 | 1,
		) => {
			const segments: string[] = [];
			for (let index = 0; index < points.length - 1; index++) {
				const from = points[index];
				const to = points[index + 1];
				if (!from || !to) continue;
				const dx = to[0] - from[0];
				const dy = to[1] - from[1];
				const c1 = sidePt(
					startIndex + index * 2,
					from[0] + dx / 3,
					from[1] + dy / 3,
					normalAxis,
					sideControlJitter,
				);
				const c2 = sidePt(
					startIndex + index * 2 + 1,
					from[0] + (dx * 2) / 3,
					from[1] + (dy * 2) / 3,
					normalAxis,
					sideControlJitter,
				);
				segments.push(
					`C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${to[0]} ${to[1]}`,
				);
			}
			return segments;
		};

		const topLeftStart = pt(0, el.x + r, el.y);
		const topRightStart = pt(1, el.x + w - r, el.y);
		const topRightEnd = pt(2, el.x + w, el.y + r);
		const bottomRightStart = pt(3, el.x + w, el.y + h - r);
		const bottomRightEnd = pt(4, el.x + w - r, el.y + h);
		const bottomLeftStart = pt(5, el.x + r, el.y + h);
		const bottomLeftEnd = pt(6, el.x, el.y + h - r);
		const topLeftEnd = pt(7, el.x, el.y + r);
		const topSide = sideAnchors(topLeftStart, topRightStart, 8, 1);
		const rightSide = sideAnchors(topRightEnd, bottomRightStart, 12, 0);
		const bottomSide = sideAnchors(bottomRightEnd, bottomLeftStart, 16, 1);
		const leftSide = sideAnchors(bottomLeftEnd, topLeftEnd, 20, 0);

		const d = [
			`M ${topLeftStart[0]} ${topLeftStart[1]}`,
			...sideSegments(topSide, 40, 1),
			`C ${ctrl(120, el.x + w - r + k * r, el.y).join(" ")} ${ctrl(
				121,
				el.x + w,
				el.y + r - k * r,
			).join(" ")} ${topRightEnd[0]} ${topRightEnd[1]}`,
			...sideSegments(rightSide, 60, 0),
			`C ${ctrl(122, el.x + w, el.y + h - r + k * r).join(" ")} ${ctrl(
				123,
				el.x + w - r + k * r,
				el.y + h,
			).join(" ")} ${bottomRightEnd[0]} ${bottomRightEnd[1]}`,
			...sideSegments(bottomSide, 80, 1),
			`C ${ctrl(124, el.x + r - k * r, el.y + h).join(" ")} ${ctrl(
				125,
				el.x,
				el.y + h - r + k * r,
			).join(" ")} ${bottomLeftEnd[0]} ${bottomLeftEnd[1]}`,
			...sideSegments(leftSide, 100, 0),
			`C ${ctrl(126, el.x, el.y + r - k * r).join(" ")} ${ctrl(
				127,
				el.x + r - k * r,
				el.y,
			).join(" ")} ${topLeftStart[0]} ${topLeftStart[1]}`,
		].join(" ");

		const path = createSvgPath();
		path.setAttribute("d", d);
		path.setAttribute("fill", "none");
		path.setAttribute("stroke", el.stroke);
		path.setAttribute("stroke-width", String(el.strokeWidth));
		path.setAttribute("stroke-linecap", "round");
		path.setAttribute("stroke-linejoin", "round");
		group.appendChild(path);
	}

	return group.innerHTML;
}

function buildRoughNode(
	rc: RoughGenerator,
	el: CanvasElement,
	opts: RoughOptions,
): SVGGElement | null {
	switch (el.type) {
		case "rectangle": {
			const w = Math.max(1, el.width);
			const h = Math.max(1, el.height);
			const cornerR = getEffectiveCornerRadius(el);
			if (cornerR > 0) {
				return rc.path(roundedRectSvgPath(el.x, el.y, w, h, cornerR), opts);
			}
			return rc.rectangle(el.x, el.y, w, h, opts);
		}
		case "ellipse":
			return rc.ellipse(
				el.x + el.width / 2,
				el.y + el.height / 2,
				Math.max(1, el.width),
				Math.max(1, el.height),
				opts,
			);
		case "diamond": {
			const cx = el.x + el.width / 2;
			const cy = el.y + el.height / 2;
			return rc.polygon(
				[
					[cx, el.y],
					[el.x + el.width, cy],
					[cx, el.y + el.height],
					[el.x, cy],
				],
				opts,
			);
		}
		case "triangle":
			return rc.polygon(getTrianglePoints(el), opts);
		case "cloud":
			return rc.path(getCloudSvgPath(el), opts);
		case "line":
			if (el.points && el.points.length >= 2) {
				const absolutePoints = el.points.map(
					([px, py]) => [el.x + px, el.y + py] as [number, number],
				);
				return rc.path(
					getLinePath(absolutePoints, el.arrowMode, el.closed === true),
					opts,
				);
			}
			return null;
		case "arrow":
			if (el.points && el.points.length >= 2) {
				const absPts = el.points.map(
					([px, py]) => [el.x + px, el.y + py] as [number, number],
				);
				const arrowMode = el.arrowMode ?? "straight";
				if (arrowMode === "curve" && absPts.length > 2) {
					return rc.curve(absPts, opts);
				}
				return rc.linearPath(absPts, opts);
			}
			return null;
		case "freehand":
			if (el.points && el.points.length >= 2) {
				const absPts = el.points.map(
					([px, py]) => [el.x + px, el.y + py] as [number, number],
				);
				if (absPts.length >= 3) {
					return rc.curve(absPts, opts);
				}
				return rc.linearPath(absPts, opts);
			}
			return null;
		default:
			return null;
	}
}

function buildRoughPyramidDividerHtml(
	rc: RoughGenerator,
	el: CanvasElement,
	opts: RoughOptions,
): string | null {
	if (el.type !== "triangle") return null;
	const dividers = getPyramidDividerSegments(el, el.pyramidSections);
	if (dividers.length === 0) return null;
	const baseSeed = opts?.seed ?? getElementRoughSeed(el);
	return dividers
		.map(
			(divider, index) =>
				rc.line(divider.x1, divider.y1, divider.x2, divider.y2, {
					...opts,
					fill: undefined,
					fillStyle: undefined,
					seed: baseSeed + (index + 1) * 97,
				}).innerHTML,
		)
		.join("");
}

export function useRoughShapeLayers(
	el: CanvasElement,
): RoughShapeLayers | null {
	return useMemo(() => {
		const r = el.roughness ?? 0;
		const hasFill =
			isFillCapableShape(el) && el.fill && el.fill !== "transparent";
		const fillStyle: RoughFillStyle =
			el.roughFillStyle ?? DEFAULT_ROUGH_FILL_STYLE;
		const patternGaps = roughPatternFillGaps(el.roughFillScale);
		const needsRoughStroke = r > 0;
		const needsPatternFill = !!hasFill && fillStyle !== "solid";

		if (!needsRoughStroke && !needsPatternFill) return null;
		if (
			(el.type === "line" || el.type === "arrow" || el.type === "freehand") &&
			!needsRoughStroke
		) {
			return null;
		}

		const preset = needsRoughStroke ? getRoughPreset(el, r) : EXACT_ROUGH;
		const svg = document.createElementNS(SVG_NS, "svg");
		const rc = rough.svg(svg);
		const isExcalidrawImport = el.customData?.excalidrawImport === true;
		const useContinuousRoundedRectStroke =
			needsRoughStroke &&
			el.type === "rectangle" &&
			getEffectiveCornerRadius(el) > 0;
		const baseOpts = {
			roughness: preset.roughness,
			bowing: preset.bowing,
			maxRandomnessOffset: preset.maxRandomnessOffset,
			stroke: el.stroke,
			strokeWidth: el.strokeWidth,
			seed: getElementRoughSeed(el),
			disableMultiStroke: isExcalidrawImport,
			preserveVertices: true,
			fillShapeRoughnessGain: 0.35,
		};
		const detailHtml = needsRoughStroke
			? buildRoughPyramidDividerHtml(rc, el, baseOpts)
			: null;

		if (needsPatternFill) {
			const fillNode = buildRoughNode(rc, el, {
				...baseOpts,
				stroke: "none",
				strokeWidth: 0,
				fill: el.fill,
				fillStyle,
				fillWeight: el.strokeWidth * 0.5,
				...patternGaps,
			});

			if (needsRoughStroke) {
				const strokeHtml = useContinuousRoundedRectStroke
					? buildContinuousRoundedRectStrokeHtml(
							el,
							preset,
							isExcalidrawImport ? 1 : 2,
						)
					: (buildRoughNode(rc, el, {
							...baseOpts,
							fill: undefined,
							fillStyle: undefined,
						})?.innerHTML ?? null);
				return {
					fillHtml: fillNode?.innerHTML ?? null,
					strokeHtml,
					svgStrokeFallback: false,
					detailHtml,
				};
			}

			return {
				fillHtml: fillNode?.innerHTML ?? null,
				strokeHtml: null,
				svgStrokeFallback: true,
				detailHtml: null,
			};
		}

		if (useContinuousRoundedRectStroke) {
			return {
				fillHtml: hasFill ? buildSolidRoundedRectFillHtml(el) : null,
				strokeHtml: buildContinuousRoundedRectStrokeHtml(
					el,
					preset,
					isExcalidrawImport ? 1 : 2,
				),
				svgStrokeFallback: false,
				detailHtml: null,
			};
		}

		const node = buildRoughNode(rc, el, {
			...baseOpts,
			fill: hasFill ? el.fill : undefined,
			fillStyle: hasFill ? fillStyle : undefined,
			fillWeight:
				hasFill && fillStyle !== "solid" ? el.strokeWidth * 0.5 : undefined,
			...(hasFill && fillStyle !== "solid" ? patternGaps : {}),
		});

		if (!node) return null;
		return {
			fillHtml: null,
			strokeHtml: node.innerHTML,
			svgStrokeFallback: false,
			detailHtml,
		};
	}, [el]);
}

function polygonStringToPoints(polygon: string): [number, number][] {
	return polygon
		.split(/\s+/)
		.filter(Boolean)
		.map((pair) => {
			const [x, y] = pair.split(",").map(Number);
			return [x, y] as [number, number];
		});
}

/** Skizzen-Pfeilspitze (rough.js) passend zur Sauberkeit */
export function roughArrowHeadHtml(
	head: ArrowHeadData | null,
	roughness: number,
	stroke: string,
	strokeWidth: number,
	seed: number,
	filled = true,
): string | null {
	if (!head || roughness <= 0) return null;

	const preset = ROUGH_PRESETS[roughness] ?? ROUGH_PRESETS[1];
	const svg = document.createElementNS(SVG_NS, "svg");
	const rc = rough.svg(svg);
	const baseOpts = {
		roughness: preset.roughness,
		bowing: preset.bowing,
		maxRandomnessOffset: preset.maxRandomnessOffset,
		stroke,
		strokeWidth,
		seed,
		preserveVertices: true,
		fillShapeRoughnessGain: 0.35,
		fill: undefined as string | undefined,
		fillStyle: undefined,
	};

	if (head.type === "lines" && head.lines) {
		const { x1, y1, x2, y2, x3, y3 } = head.lines;
		return (
			rc.linearPath(
				[
					[x1, y1],
					[x2, y2],
					[x3, y3],
				],
				baseOpts,
			)?.innerHTML ?? null
		);
	}
	if (head.type === "triangle" && head.polygon) {
		return (
			rc.polygon(polygonStringToPoints(head.polygon), {
				...baseOpts,
				fill: filled ? stroke : undefined,
				fillStyle: "solid",
			})?.innerHTML ?? null
		);
	}
	if (
		head.type === "dot" &&
		head.cx != null &&
		head.cy != null &&
		head.r != null
	) {
		return (
			rc.circle(head.cx, head.cy, head.r * 2, {
				...baseOpts,
				fill: filled ? stroke : undefined,
				fillStyle: "solid",
			})?.innerHTML ?? null
		);
	}
	return null;
}

function hashCode(s: string): number {
	let hash = 0;
	for (let i = 0; i < s.length; i++) {
		hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}
