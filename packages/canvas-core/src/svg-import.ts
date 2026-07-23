import {
	DOMParser,
	type Document,
	type Element,
	XMLSerializer,
} from "@xmldom/xmldom";
import * as pointsOnPathModule from "points-on-path";
import {
	type CanvasElementFactoryDefaults,
	createBaseCanvasElement,
} from "./element-factory";
import type { SvgMatrix, SvgPathElementData } from "./svg-path-element";
import type { CanvasElement, StrokeStyle } from "./types";

const IDENTITY_MATRIX: SvgMatrix = [1, 0, 0, 1, 0, 0];
const { pointsOnPath } = pointsOnPathModule;
const GEOMETRY_TAGS = new Set([
	"path",
	"rect",
	"circle",
	"ellipse",
	"line",
	"polyline",
	"polygon",
	"text",
]);
const CONTAINER_TAGS = new Set(["svg", "g", "a"]);
const IGNORED_TAGS = new Set([
	"defs",
	"title",
	"desc",
	"metadata",
	"style",
	"lineargradient",
	"radialgradient",
	"stop",
	"pattern",
	"clippath",
	"mask",
	"filter",
	"marker",
	"symbol",
]);
const UNSAFE_TAGS = new Set([
	"script",
	"foreignobject",
	"iframe",
	"object",
	"embed",
	"link",
	"audio",
	"video",
	"canvas",
	"animate",
	"animatemotion",
	"animatetransform",
	"set",
	"mpath",
]);
const URI_ATTRIBUTES = new Set(["href", "src"]);
const UNSUPPORTED_PRESENTATION_PROPERTIES = [
	"filter",
	"mask",
	"clip-path",
	"marker-start",
	"marker-mid",
	"marker-end",
] as const;
const UNSUPPORTED_TEXT_ATTRIBUTES = [
	"dx",
	"dy",
	"rotate",
	"textLength",
	"lengthAdjust",
	"dominant-baseline",
	"alignment-baseline",
	"writing-mode",
	"letter-spacing",
	"word-spacing",
	"text-decoration",
] as const;
const ABSOLUTE_LENGTH_PATTERN =
	/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:px|pt|pc|mm|cm|in)?$/i;

interface SvgPoint {
	x: number;
	y: number;
}

interface SvgBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface SvgStyle {
	fill: string;
	stroke: string;
	color: string;
	strokeWidth: number;
	opacity: number;
	fillOpacity: number;
	strokeOpacity: number;
	strokeLinecap: "butt" | "round" | "square";
	strokeLinejoin: "miter" | "round" | "bevel";
	strokeDasharray?: string;
	fillRule: "nonzero" | "evenodd";
	fontFamily: string;
	fontSize: number;
	fontWeight: "normal" | "bold";
	fontStyle: "normal" | "italic";
	textAnchor: "start" | "middle" | "end";
}

interface SvgGeometry {
	d: string;
	subpaths: SvgPoint[][];
	closed: boolean;
}

interface SvgLayout {
	scale: number;
	left: number;
	top: number;
	viewBox: SvgBounds;
	mapBounds: (bounds: SvgBounds) => SvgBounds;
}

export interface SvgImportOptions extends CanvasElementFactoryDefaults {
	/** Position for the center of the imported SVG. Defaults to its own center. */
	target?: { x: number; y: number };
	maxWidth?: number;
	maxHeight?: number;
	sourceName?: string;
}

export interface SvgImportResult {
	elements: CanvasElement[];
	usedFallback: boolean;
}

function tagName(element: Element): string {
	const qualifiedName = element.tagName.split(":");
	return (
		element.localName ||
		qualifiedName[qualifiedName.length - 1] ||
		""
	).toLowerCase();
}

function childElements(element: Element): Element[] {
	const children: Element[] = [];
	for (let index = 0; index < element.childNodes.length; index++) {
		const child = element.childNodes.item(index);
		if (child?.nodeType === 1) children.push(child as Element);
	}
	return children;
}

function allElements(root: Element): Element[] {
	const result: Element[] = [root];
	for (const child of childElements(root)) result.push(...allElements(child));
	return result;
}

function parseNumber(value: string | null, fallback = 0): number {
	if (value == null || value.trim() === "") return fallback;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function parseLength(value: string | null, fallback = 0): number {
	if (value == null || value.trim() === "") return fallback;
	const match = value
		.trim()
		.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(px|pt|pc|mm|cm|in)?$/i);
	if (!match) return fallback;
	const parsed = Number(match[1]);
	const unit = match[2]?.toLowerCase();
	const factor =
		unit === "pt"
			? 96 / 72
			: unit === "pc"
				? 16
				: unit === "mm"
					? 96 / 25.4
					: unit === "cm"
						? 96 / 2.54
						: unit === "in"
							? 96
							: 1;
	return parsed * factor;
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

function parseOpacity(value: string | null, fallback: number): number {
	if (value == null || value.trim() === "") return fallback;
	const normalized = value.trim();
	const parsed = Number.parseFloat(normalized);
	if (!Number.isFinite(parsed)) return fallback;
	return clamp01(normalized.endsWith("%") ? parsed / 100 : parsed);
}

function multiplyMatrix(left: SvgMatrix, right: SvgMatrix): SvgMatrix {
	const [a1, b1, c1, d1, e1, f1] = left;
	const [a2, b2, c2, d2, e2, f2] = right;
	return [
		a1 * a2 + c1 * b2,
		b1 * a2 + d1 * b2,
		a1 * c2 + c1 * d2,
		b1 * c2 + d1 * d2,
		a1 * e2 + c1 * f2 + e1,
		b1 * e2 + d1 * f2 + f1,
	];
}

function applyMatrix(matrix: SvgMatrix, point: SvgPoint): SvgPoint {
	const [a, b, c, d, e, f] = matrix;
	return {
		x: a * point.x + c * point.y + e,
		y: b * point.x + d * point.y + f,
	};
}

function parseTransform(value: string | null): SvgMatrix | null {
	if (!value?.trim()) return IDENTITY_MATRIX;
	let matrix = IDENTITY_MATRIX;
	const matcher = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
	let commandCount = 0;
	for (const match of value.matchAll(matcher)) {
		commandCount++;
		const values = (
			match[2].match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) ?? []
		).map(Number);
		if (values.some((item) => !Number.isFinite(item))) return null;
		const command = match[1].toLowerCase();
		let next: SvgMatrix;
		if (command === "matrix" && values.length === 6) {
			next = values as SvgMatrix;
		} else if (command === "translate" && values.length >= 1) {
			next = [1, 0, 0, 1, values[0], values[1] ?? 0];
		} else if (command === "scale" && values.length >= 1) {
			next = [values[0], 0, 0, values[1] ?? values[0], 0, 0];
		} else if (command === "rotate" && values.length >= 1) {
			const radians = (values[0] * Math.PI) / 180;
			const cos = Math.cos(radians);
			const sin = Math.sin(radians);
			const rotation: SvgMatrix = [cos, sin, -sin, cos, 0, 0];
			next =
				values.length >= 3
					? multiplyMatrix(
							multiplyMatrix([1, 0, 0, 1, values[1], values[2]], rotation),
							[1, 0, 0, 1, -values[1], -values[2]],
						)
					: rotation;
		} else if (command === "skewx" && values.length === 1) {
			next = [1, 0, Math.tan((values[0] * Math.PI) / 180), 1, 0, 0];
		} else if (command === "skewy" && values.length === 1) {
			next = [1, Math.tan((values[0] * Math.PI) / 180), 0, 1, 0, 0];
		} else {
			return null;
		}
		matrix = multiplyMatrix(matrix, next);
	}
	return commandCount > 0 ? matrix : null;
}

function parseStyleAttribute(value: string | null): Map<string, string> {
	const result = new Map<string, string>();
	for (const declaration of value?.split(";") ?? []) {
		const separator = declaration.indexOf(":");
		if (separator < 0) continue;
		const property = declaration.slice(0, separator).trim().toLowerCase();
		const propertyValue = declaration.slice(separator + 1).trim();
		if (property && propertyValue) result.set(property, propertyValue);
	}
	return result;
}

function styleValue(
	element: Element,
	inline: Map<string, string>,
	property: string,
): string | null {
	return inline.get(property) ?? element.getAttribute(property);
}

function resolvePaint(
	value: string | null,
	inherited: string,
	color: string,
): string {
	const paint = value?.trim() || inherited;
	const normalized = paint.toLowerCase();
	if (normalized === "currentcolor") return color;
	if (normalized === "none") return "transparent";
	return paint;
}

function deriveStyle(element: Element, parent: SvgStyle): SvgStyle {
	const inline = parseStyleAttribute(element.getAttribute("style"));
	const color = styleValue(element, inline, "color")?.trim() || parent.color;
	const opacity =
		parent.opacity * parseOpacity(styleValue(element, inline, "opacity"), 1);
	const fillOpacityValue = styleValue(element, inline, "fill-opacity");
	const strokeOpacityValue = styleValue(element, inline, "stroke-opacity");
	const rawFontWeight =
		styleValue(element, inline, "font-weight")?.trim().toLowerCase() ??
		parent.fontWeight;
	const rawFontStyle =
		styleValue(element, inline, "font-style")?.trim().toLowerCase() ??
		parent.fontStyle;
	const rawAnchor =
		styleValue(element, inline, "text-anchor")?.trim().toLowerCase() ??
		parent.textAnchor;
	const rawLinecap =
		styleValue(element, inline, "stroke-linecap")?.trim().toLowerCase() ??
		parent.strokeLinecap;
	const rawLinejoin =
		styleValue(element, inline, "stroke-linejoin")?.trim().toLowerCase() ??
		parent.strokeLinejoin;
	const rawFillRule =
		styleValue(element, inline, "fill-rule")?.trim().toLowerCase() ??
		parent.fillRule;
	return {
		fill: resolvePaint(styleValue(element, inline, "fill"), parent.fill, color),
		stroke: resolvePaint(
			styleValue(element, inline, "stroke"),
			parent.stroke,
			color,
		),
		color,
		strokeWidth: Math.max(
			0,
			parseLength(
				styleValue(element, inline, "stroke-width"),
				parent.strokeWidth,
			),
		),
		opacity,
		fillOpacity: parseOpacity(fillOpacityValue, parent.fillOpacity),
		strokeOpacity: parseOpacity(strokeOpacityValue, parent.strokeOpacity),
		strokeLinecap:
			rawLinecap === "round" || rawLinecap === "square" ? rawLinecap : "butt",
		strokeLinejoin:
			rawLinejoin === "round" || rawLinejoin === "bevel"
				? rawLinejoin
				: "miter",
		strokeDasharray:
			styleValue(element, inline, "stroke-dasharray")?.trim() ||
			parent.strokeDasharray,
		fillRule: rawFillRule === "evenodd" ? "evenodd" : "nonzero",
		fontFamily:
			styleValue(element, inline, "font-family")?.trim() || parent.fontFamily,
		fontSize: Math.max(
			1,
			parseLength(styleValue(element, inline, "font-size"), parent.fontSize),
		),
		fontWeight:
			rawFontWeight === "bold" || Number.parseInt(rawFontWeight, 10) >= 600
				? "bold"
				: "normal",
		fontStyle: rawFontStyle === "italic" ? "italic" : "normal",
		textAnchor:
			rawAnchor === "middle" || rawAnchor === "end" ? rawAnchor : "start",
	};
}

const ROOT_STYLE: SvgStyle = {
	fill: "#000000",
	stroke: "transparent",
	color: "#000000",
	strokeWidth: 1,
	opacity: 1,
	fillOpacity: 1,
	strokeOpacity: 1,
	strokeLinecap: "butt",
	strokeLinejoin: "miter",
	fillRule: "nonzero",
	fontFamily: "sans-serif",
	fontSize: 16,
	fontWeight: "normal",
	fontStyle: "normal",
	textAnchor: "start",
};

function parsePoints(value: string | null): SvgPoint[] {
	const values = (
		value?.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) ?? []
	).map(Number);
	const points: SvgPoint[] = [];
	for (let index = 0; index + 1 < values.length; index += 2) {
		points.push({ x: values[index], y: values[index + 1] });
	}
	return points;
}

function rectPath(element: Element): string {
	const x = parseLength(element.getAttribute("x"));
	const y = parseLength(element.getAttribute("y"));
	const width = Math.max(0, parseLength(element.getAttribute("width")));
	const height = Math.max(0, parseLength(element.getAttribute("height")));
	const rx = Math.min(
		width / 2,
		Math.max(
			0,
			parseLength(
				element.getAttribute("rx"),
				parseLength(element.getAttribute("ry")),
			),
		),
	);
	const ry = Math.min(
		height / 2,
		Math.max(0, parseLength(element.getAttribute("ry"), rx)),
	);
	if (rx <= 0 || ry <= 0) {
		return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
	}
	return [
		`M ${x + rx} ${y}`,
		`H ${x + width - rx}`,
		`A ${rx} ${ry} 0 0 1 ${x + width} ${y + ry}`,
		`V ${y + height - ry}`,
		`A ${rx} ${ry} 0 0 1 ${x + width - rx} ${y + height}`,
		`H ${x + rx}`,
		`A ${rx} ${ry} 0 0 1 ${x} ${y + height - ry}`,
		`V ${y + ry}`,
		`A ${rx} ${ry} 0 0 1 ${x + rx} ${y}`,
		"Z",
	].join(" ");
}

function ellipsePath(element: Element, circle: boolean): string {
	const cx = parseLength(element.getAttribute("cx"));
	const cy = parseLength(element.getAttribute("cy"));
	const rx = Math.max(
		0,
		parseLength(element.getAttribute(circle ? "r" : "rx")),
	);
	const ry = circle ? rx : Math.max(0, parseLength(element.getAttribute("ry")));
	return [
		`M ${cx - rx} ${cy}`,
		`A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy}`,
		`A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`,
		"Z",
	].join(" ");
}

function geometryForElement(element: Element): SvgGeometry | null {
	const tag = tagName(element);
	let d = "";
	let closed = false;
	if (tag === "path") {
		d = element.getAttribute("d")?.trim() ?? "";
		closed = /z\s*$/i.test(d);
	} else if (tag === "rect") {
		d = rectPath(element);
		closed = true;
	} else if (tag === "circle" || tag === "ellipse") {
		d = ellipsePath(element, tag === "circle");
		closed = true;
	} else if (tag === "line") {
		d = `M ${parseLength(element.getAttribute("x1"))} ${parseLength(element.getAttribute("y1"))} L ${parseLength(element.getAttribute("x2"))} ${parseLength(element.getAttribute("y2"))}`;
	} else if (tag === "polyline" || tag === "polygon") {
		const points = parsePoints(element.getAttribute("points"));
		if (points.length < 2) return null;
		d = points
			.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
			.join(" ");
		closed = tag === "polygon";
		if (closed) d += " Z";
	} else {
		return null;
	}
	if (!d) return null;
	try {
		const sets = pointsOnPath(d, 0.35, 0.25);
		const subpaths = sets
			.filter((set) => set.length >= 2)
			.map((set) => {
				const stride = Math.max(1, Math.ceil(set.length / 1024));
				return set
					.filter(
						(_, index) => index % stride === 0 || index === set.length - 1,
					)
					.map(([x, y]) => ({ x, y }));
			});
		return subpaths.length > 0 ? { d, subpaths, closed } : null;
	} catch {
		return null;
	}
}

function hasUnsupportedLengthValue(value: string | null | undefined): boolean {
	if (value == null || value.trim() === "") return false;
	return !ABSOLUTE_LENGTH_PATTERN.test(value.trim());
}

function hasUnsupportedGeometryMeasurements(element: Element): boolean {
	const tag = tagName(element);
	const attributes =
		tag === "rect"
			? ["x", "y", "width", "height", "rx", "ry"]
			: tag === "circle"
				? ["cx", "cy", "r"]
				: tag === "ellipse"
					? ["cx", "cy", "rx", "ry"]
					: tag === "line"
						? ["x1", "y1", "x2", "y2"]
						: tag === "text"
							? ["x", "y"]
							: [];
	if (
		attributes.some((attribute) =>
			hasUnsupportedLengthValue(element.getAttribute(attribute)),
		)
	) {
		return true;
	}
	const inline = parseStyleAttribute(element.getAttribute("style"));
	return (
		hasUnsupportedLengthValue(
			inline.get("stroke-width") ?? element.getAttribute("stroke-width"),
		) ||
		hasUnsupportedLengthValue(
			inline.get("font-size") ?? element.getAttribute("font-size"),
		) ||
		/%|(?:em|ex|rem|ch|vw|vh|vmin|vmax)\b/i.test(
			inline.get("stroke-dasharray") ??
				element.getAttribute("stroke-dasharray") ??
				"",
		)
	);
}

function isNonRenderingGeometry(element: Element): boolean {
	const tag = tagName(element);
	if (tag === "rect") {
		return (
			parseLength(element.getAttribute("width")) <= 0 ||
			parseLength(element.getAttribute("height")) <= 0
		);
	}
	if (tag === "circle") {
		return parseLength(element.getAttribute("r")) <= 0;
	}
	if (tag === "ellipse") {
		return (
			parseLength(element.getAttribute("rx")) <= 0 ||
			parseLength(element.getAttribute("ry")) <= 0
		);
	}
	if (tag === "path") {
		return !(element.getAttribute("d")?.trim() ?? "");
	}
	if (tag === "polyline" || tag === "polygon") {
		return parsePoints(element.getAttribute("points")).length < 2;
	}
	return false;
}

function boundsFromSubpaths(subpaths: SvgPoint[][]): SvgBounds | null {
	const points = subpaths.flat();
	if (points.length === 0) return null;
	const minX = Math.min(...points.map((point) => point.x));
	const minY = Math.min(...points.map((point) => point.y));
	const maxX = Math.max(...points.map((point) => point.x));
	const maxY = Math.max(...points.map((point) => point.y));
	return {
		x: minX,
		y: minY,
		width: Math.max(0.01, maxX - minX),
		height: Math.max(0.01, maxY - minY),
	};
}

function transformSubpaths(
	subpaths: SvgPoint[][],
	matrix: SvgMatrix,
): SvgPoint[][] {
	return subpaths.map((path) =>
		path.map((point) => applyMatrix(matrix, point)),
	);
}

function isAxisAligned(matrix: SvgMatrix): boolean {
	return Math.abs(matrix[1]) < 1e-9 && Math.abs(matrix[2]) < 1e-9;
}

function isUniformAxisScale(matrix: SvgMatrix): boolean {
	return (
		isAxisAligned(matrix) &&
		Math.abs(Math.abs(matrix[0]) - Math.abs(matrix[3])) < 1e-9
	);
}

function isConformalMatrix(matrix: SvgMatrix): boolean {
	const xScale = Math.hypot(matrix[0], matrix[1]);
	const yScale = Math.hypot(matrix[2], matrix[3]);
	const dot = matrix[0] * matrix[2] + matrix[1] * matrix[3];
	return Math.abs(xScale - yScale) < 1e-9 && Math.abs(dot) < 1e-9;
}

function hasVisibleStroke(style: SvgStyle): boolean {
	return (
		style.stroke !== "transparent" &&
		style.strokeWidth > 0 &&
		style.strokeOpacity > 0
	);
}

function strokeStyle(style: SvgStyle): StrokeStyle {
	if (!style.strokeDasharray || style.strokeDasharray === "none")
		return "solid";
	const numbers = style.strokeDasharray.match(/\d*\.?\d+/g)?.map(Number) ?? [];
	return numbers.length >= 2 && numbers[0] <= style.strokeWidth * 1.5
		? "dotted"
		: "dashed";
}

function elementOpacity(style: SvgStyle): number {
	return Math.round(clamp01(style.opacity) * 100);
}

function matrixStrokeScale(matrix: SvgMatrix): number {
	const xScale = Math.hypot(matrix[0], matrix[1]);
	const yScale = Math.hypot(matrix[2], matrix[3]);
	return Math.max(0.01, (xScale + yScale) / 2);
}

function scaleStrokeDasharray(
	value: string | undefined,
	scale: number,
): string | undefined {
	if (!value || value === "none") return undefined;
	return value.replace(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi, (token) =>
		String(Number(token) * scale),
	);
}

function mapPoint(layout: SvgLayout, point: SvgPoint): SvgPoint {
	return {
		x: layout.left + (point.x - layout.viewBox.x) * layout.scale,
		y: layout.top + (point.y - layout.viewBox.y) * layout.scale,
	};
}

function makeBaseCustomData(
	element: Element,
	groupPath: string[],
	sourceName?: string,
): Record<string, unknown> {
	return {
		svgSourceTag: tagName(element),
		...(element.getAttribute("id")
			? { svgSourceId: element.getAttribute("id") }
			: {}),
		...(groupPath.length > 0 ? { svgGroupPath: groupPath } : {}),
		...(sourceName ? { svgSourceName: sourceName } : {}),
	};
}

function createPathElement(options: {
	element: Element;
	geometry: SvgGeometry;
	matrix: SvgMatrix;
	style: SvgStyle;
	layout: SvgLayout;
	defaults: CanvasElementFactoryDefaults;
	groupId: string | null;
	groupPath: string[];
	sourceName?: string;
}): CanvasElement | null {
	const transformed = transformSubpaths(
		options.geometry.subpaths,
		options.matrix,
	);
	const sourceBounds = boundsFromSubpaths(transformed);
	if (!sourceBounds) return null;
	const bounds = options.layout.mapBounds(sourceBounds);
	const normalizedSubpaths = transformed.map((path) =>
		path.map(
			(point) =>
				[
					(point.x - sourceBounds.x) / sourceBounds.width,
					(point.y - sourceBounds.y) / sourceBounds.height,
				] as [number, number],
		),
	);
	const importedStrokeWidth =
		options.style.strokeWidth *
		matrixStrokeScale(options.matrix) *
		options.layout.scale;
	const svgPath: SvgPathElementData = {
		d: options.geometry.d,
		transform: options.matrix,
		sourceBounds,
		subpaths: normalizedSubpaths,
		fillRule: options.style.fillRule,
		fillOpacity: options.style.fillOpacity,
		strokeOpacity: options.style.strokeOpacity,
		strokeLinecap: options.style.strokeLinecap,
		strokeLinejoin: options.style.strokeLinejoin,
		strokeDasharray: options.style.strokeDasharray,
		strokeStyle: strokeStyle(options.style),
		strokeWidth: importedStrokeWidth,
		sourceStrokeWidth: options.style.strokeWidth,
	};
	return createBaseCanvasElement(options.defaults, {
		type: "line",
		x: bounds.x,
		y: bounds.y,
		width: bounds.width,
		height: bounds.height,
		fill: options.style.fill,
		stroke: options.style.stroke,
		strokeWidth: importedStrokeWidth,
		strokeStyle: strokeStyle(options.style),
		opacity: elementOpacity(options.style),
		groupId: options.groupId,
		closed: options.geometry.closed || undefined,
		roughness: 0,
		points: [
			[0, 0],
			[bounds.width, bounds.height],
		],
		customData: {
			skedraType: "svg-path",
			...makeBaseCustomData(
				options.element,
				options.groupPath,
				options.sourceName,
			),
			svgPath,
		},
	});
}

function nativeCommon(options: {
	element: Element;
	matrix: SvgMatrix;
	style: SvgStyle;
	layout: SvgLayout;
	groupId: string | null;
	groupPath: string[];
	sourceName?: string;
}) {
	return {
		fill: options.style.fill,
		stroke: options.style.stroke,
		strokeWidth:
			options.style.strokeWidth *
			matrixStrokeScale(options.matrix) *
			options.layout.scale,
		strokeStyle: strokeStyle(options.style),
		opacity: elementOpacity(options.style),
		groupId: options.groupId,
		roughness: 0,
		customData: makeBaseCustomData(
			options.element,
			options.groupPath,
			options.sourceName,
		),
	};
}

function createNativeElement(options: {
	element: Element;
	matrix: SvgMatrix;
	style: SvgStyle;
	layout: SvgLayout;
	defaults: CanvasElementFactoryDefaults;
	groupId: string | null;
	groupPath: string[];
	sourceName?: string;
}): CanvasElement | null {
	const tag = tagName(options.element);
	const common = nativeCommon(options);
	if (
		(tag === "line" || tag === "polyline" || tag === "polygon") &&
		(!hasVisibleStroke(options.style) || isConformalMatrix(options.matrix))
	) {
		const points =
			tag === "line"
				? [
						{
							x: parseLength(options.element.getAttribute("x1")),
							y: parseLength(options.element.getAttribute("y1")),
						},
						{
							x: parseLength(options.element.getAttribute("x2")),
							y: parseLength(options.element.getAttribute("y2")),
						},
					]
				: parsePoints(options.element.getAttribute("points"));
		if (points.length < 2) return null;
		const mapped = points.map((point) =>
			mapPoint(options.layout, applyMatrix(options.matrix, point)),
		);
		const bounds = boundsFromSubpaths([mapped]);
		if (!bounds) return null;
		const importedStrokeWidth = common.strokeWidth;
		return createBaseCanvasElement(options.defaults, {
			type: "line",
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
			points: mapped.map(
				(point) => [point.x - bounds.x, point.y - bounds.y] as [number, number],
			),
			closed: tag === "polygon" || undefined,
			...common,
			customData: {
				...common.customData,
				svgImportedLine: {
					fillRule: options.style.fillRule,
					fillOpacity: options.style.fillOpacity,
					strokeOpacity: options.style.strokeOpacity,
					strokeLinecap: options.style.strokeLinecap,
					strokeLinejoin: options.style.strokeLinejoin,
					strokeDasharray: scaleStrokeDasharray(
						options.style.strokeDasharray,
						matrixStrokeScale(options.matrix) * options.layout.scale,
					),
					strokeStyle: common.strokeStyle,
					strokeWidth: importedStrokeWidth,
				},
			},
		});
	}
	if (
		Math.abs(options.style.fillOpacity - 1) > 1e-9 ||
		Math.abs(options.style.strokeOpacity - 1) > 1e-9 ||
		(options.style.strokeDasharray != null &&
			options.style.strokeDasharray !== "none")
	) {
		return null;
	}
	if (
		tag === "rect" &&
		isAxisAligned(options.matrix) &&
		(!hasVisibleStroke(options.style) || isUniformAxisScale(options.matrix))
	) {
		const x = parseLength(options.element.getAttribute("x"));
		const y = parseLength(options.element.getAttribute("y"));
		const width = Math.max(
			0.01,
			parseLength(options.element.getAttribute("width")),
		);
		const height = Math.max(
			0.01,
			parseLength(options.element.getAttribute("height")),
		);
		const first = applyMatrix(options.matrix, { x, y });
		const opposite = applyMatrix(options.matrix, {
			x: x + width,
			y: y + height,
		});
		const sourceBounds: SvgBounds = {
			x: Math.min(first.x, opposite.x),
			y: Math.min(first.y, opposite.y),
			width: Math.max(0.01, Math.abs(opposite.x - first.x)),
			height: Math.max(0.01, Math.abs(opposite.y - first.y)),
		};
		const bounds = options.layout.mapBounds(sourceBounds);
		const rx = Math.min(
			width / 2,
			Math.max(
				0,
				parseLength(
					options.element.getAttribute("rx"),
					parseLength(options.element.getAttribute("ry")),
				),
			),
		);
		const resolvedRy = Math.min(
			height / 2,
			Math.max(0, parseLength(options.element.getAttribute("ry"), rx)),
		);
		const rxCanvas = rx * Math.abs(options.matrix[0]) * options.layout.scale;
		const ryCanvas =
			resolvedRy * Math.abs(options.matrix[3]) * options.layout.scale;
		return createBaseCanvasElement(options.defaults, {
			type: "rectangle",
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
			...common,
			customData: {
				...common.customData,
				...(rxCanvas > 0 || ryCanvas > 0
					? {
							svgImportedRect: {
								rxRatio: Math.min(0.5, rxCanvas / bounds.width),
								ryRatio: Math.min(0.5, ryCanvas / bounds.height),
							},
						}
					: {}),
			},
		});
	}
	if (
		(tag === "circle" || tag === "ellipse") &&
		isAxisAligned(options.matrix) &&
		(!hasVisibleStroke(options.style) || isUniformAxisScale(options.matrix))
	) {
		const cx = parseLength(options.element.getAttribute("cx"));
		const cy = parseLength(options.element.getAttribute("cy"));
		const rx = Math.max(
			0.01,
			parseLength(options.element.getAttribute(tag === "circle" ? "r" : "rx")),
		);
		const ry =
			tag === "circle"
				? rx
				: Math.max(0.01, parseLength(options.element.getAttribute("ry")));
		const first = applyMatrix(options.matrix, {
			x: cx - rx,
			y: cy - ry,
		});
		const opposite = applyMatrix(options.matrix, {
			x: cx + rx,
			y: cy + ry,
		});
		const bounds = options.layout.mapBounds({
			x: Math.min(first.x, opposite.x),
			y: Math.min(first.y, opposite.y),
			width: Math.max(0.01, Math.abs(opposite.x - first.x)),
			height: Math.max(0.01, Math.abs(opposite.y - first.y)),
		});
		return createBaseCanvasElement(options.defaults, {
			type: "ellipse",
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
			...common,
		});
	}
	return null;
}

function hasUnsupportedTextLayout(element: Element): boolean {
	if (element.getElementsByTagName("tspan").length > 0) return true;
	const inline = parseStyleAttribute(element.getAttribute("style"));
	return (
		UNSUPPORTED_TEXT_ATTRIBUTES.some((attribute) =>
			Boolean(element.getAttribute(attribute)),
		) ||
		[
			"dominant-baseline",
			"alignment-baseline",
			"writing-mode",
			"letter-spacing",
			"word-spacing",
			"text-decoration",
			"direction",
		].some((property) => {
			const value = inline.get(property);
			return value != null && value.trim() !== "" && value.trim() !== "normal";
		})
	);
}

function createTextElement(options: {
	element: Element;
	matrix: SvgMatrix;
	style: SvgStyle;
	layout: SvgLayout;
	defaults: CanvasElementFactoryDefaults;
	groupId: string | null;
	groupPath: string[];
	sourceName?: string;
}): CanvasElement | null {
	if (
		!isUniformAxisScale(options.matrix) ||
		options.matrix[0] <= 0 ||
		options.matrix[3] <= 0 ||
		hasUnsupportedTextLayout(options.element)
	) {
		return null;
	}
	const text = options.element.textContent?.replace(/\s+/g, " ").trim() ?? "";
	if (!text) return null;
	const origin = applyMatrix(options.matrix, {
		x: parseLength(options.element.getAttribute("x")),
		y: parseLength(options.element.getAttribute("y")),
	});
	const mapped = mapPoint(options.layout, origin);
	const fontSize =
		options.style.fontSize * Math.abs(options.matrix[3]) * options.layout.scale;
	const width = Math.max(fontSize, text.length * fontSize * 0.62);
	const x =
		options.style.textAnchor === "middle"
			? mapped.x - width / 2
			: options.style.textAnchor === "end"
				? mapped.x - width
				: mapped.x;
	return createBaseCanvasElement(options.defaults, {
		type: "text",
		x,
		y: mapped.y - fontSize,
		width,
		height: fontSize * 1.25,
		fill: "transparent",
		stroke: "transparent",
		strokeWidth: 0,
		opacity: Math.round(
			clamp01(options.style.opacity * options.style.fillOpacity) * 100,
		),
		groupId: options.groupId,
		text,
		textColor: options.style.fill,
		fontSize,
		fontFamily: options.style.fontFamily,
		fontWeight: options.style.fontWeight,
		fontStyle: options.style.fontStyle,
		textAlign:
			options.style.textAnchor === "middle"
				? "center"
				: options.style.textAnchor === "end"
					? "right"
					: "left",
		customData: makeBaseCustomData(
			options.element,
			options.groupPath,
			options.sourceName,
		),
	});
}

function hasMeaningfulPresentationValue(
	value: string | null | undefined,
): boolean {
	if (value == null) return false;
	const normalized = value.trim().toLowerCase();
	return normalized !== "" && normalized !== "none" && normalized !== "normal";
}

function hasUnsupportedEffects(element: Element, style: SvgStyle): boolean {
	const inline = parseStyleAttribute(element.getAttribute("style"));
	const unsupportedProperty = UNSUPPORTED_PRESENTATION_PROPERTIES.some(
		(property) =>
			hasMeaningfulPresentationValue(
				inline.get(property) ?? element.getAttribute(property),
			),
	);
	const containerOpacity =
		CONTAINER_TAGS.has(tagName(element)) &&
		styleValue(element, inline, "opacity") != null &&
		parseOpacity(styleValue(element, inline, "opacity"), 1) < 1;
	return (
		Boolean(element.getAttribute("class")) ||
		unsupportedProperty ||
		containerOpacity ||
		[
			"mix-blend-mode",
			"isolation",
			"paint-order",
			"vector-effect",
			"transform",
			"transform-origin",
		].some((property) =>
			hasMeaningfulPresentationValue(inline.get(property)),
		) ||
		hasMeaningfulPresentationValue(element.getAttribute("vector-effect")) ||
		/url\s*\(/i.test(style.fill) ||
		/url\s*\(/i.test(style.stroke) ||
		/var\s*\(/i.test(style.fill) ||
		/var\s*\(/i.test(style.stroke)
	);
}

function isSafeEmbeddedUri(value: string): boolean {
	return (
		/^#[^\s]+$/.test(value) ||
		/^data:image\/(?:png|jpeg|gif|webp)(?:;base64)?,/i.test(value)
	);
}

function decodeCssEscapes(value: string): string {
	return value
		.replace(/\\([0-9a-f]{1,6})\s?/gi, (_match, hex: string) =>
			String.fromCodePoint(Number.parseInt(hex, 16)),
		)
		.replace(/\\(.)/gs, "$1");
}

function sanitizeCssUrls(value: string): string {
	return decodeCssEscapes(value).replace(
		/url\(\s*(['"]?)([^)]*?)\1\s*\)/gi,
		(_match, _quote: string, rawTarget: string) => {
			const target = rawTarget.trim();
			return /^#[^\s]+$/.test(target) ? `url("${target}")` : "none";
		},
	);
}

function sanitizeInlineStyle(value: string): string {
	const safeDeclarations: string[] = [];
	for (const declaration of decodeCssEscapes(value).split(";")) {
		const separator = declaration.indexOf(":");
		if (separator < 0) continue;
		const property = declaration.slice(0, separator).trim().toLowerCase();
		let propertyValue = declaration.slice(separator + 1).trim();
		if (
			!property ||
			!propertyValue ||
			property === "behavior" ||
			property === "-moz-binding" ||
			property.startsWith("on") ||
			/@import|expression\s*\(/i.test(propertyValue)
		) {
			continue;
		}
		propertyValue = sanitizeCssUrls(propertyValue);
		safeDeclarations.push(`${property}: ${propertyValue}`);
	}
	return safeDeclarations.join("; ");
}

function sanitizeStylesheet(value: string): string {
	return sanitizeCssUrls(
		decodeCssEscapes(value)
			.replace(/@import(?:\s+url\([^)]*\)|\s+[^;]+);?/gi, "")
			.replace(/expression\s*\([^)]*\)/gi, "none")
			.replace(/(?:behavior|-moz-binding)\s*:[^;}]+;?/gi, ""),
	);
}

function sanitizeDocument(document: Document): void {
	const root = document.documentElement;
	if (!root) return;
	for (const element of allElements(root)) {
		const tag = tagName(element);
		if (UNSAFE_TAGS.has(tag)) {
			element.parentNode?.removeChild(element);
			continue;
		}
		const attributes = [];
		for (let index = 0; index < element.attributes.length; index++) {
			const attribute = element.attributes.item(index);
			if (attribute) attributes.push(attribute);
		}
		for (const attribute of attributes) {
			const name = attribute.name.toLowerCase();
			const value = attribute.value.trim();
			if (name.startsWith("on")) {
				element.removeAttribute(attribute.name);
				continue;
			}
			if (
				(URI_ATTRIBUTES.has(name) || name.endsWith(":href")) &&
				!isSafeEmbeddedUri(value)
			) {
				element.removeAttribute(attribute.name);
				continue;
			}
			if (name === "style") {
				const sanitized = sanitizeInlineStyle(value);
				if (sanitized) element.setAttribute(attribute.name, sanitized);
				else element.removeAttribute(attribute.name);
				continue;
			}
			if (/url\s*\(/i.test(value)) {
				element.setAttribute(attribute.name, sanitizeCssUrls(value));
			}
		}
		if (tag === "style" && element.textContent) {
			element.textContent = sanitizeStylesheet(element.textContent);
		}
	}
}

function viewBoxForRoot(root: Element): SvgBounds | null {
	const values = root
		.getAttribute("viewBox")
		?.trim()
		.split(/[\s,]+/)
		.map(Number);
	if (
		values?.length === 4 &&
		values.every(Number.isFinite) &&
		values[2] > 0 &&
		values[3] > 0
	) {
		return {
			x: values[0],
			y: values[1],
			width: values[2],
			height: values[3],
		};
	}
	const width = parseLength(root.getAttribute("width"));
	const height = parseLength(root.getAttribute("height"));
	return width > 0 && height > 0 ? { x: 0, y: 0, width, height } : null;
}

function createLayout(
	root: Element,
	viewBox: SvgBounds,
	options: SvgImportOptions,
): SvgLayout {
	const declaredWidth = parseLength(root.getAttribute("width"), viewBox.width);
	const declaredHeight = parseLength(
		root.getAttribute("height"),
		viewBox.height,
	);
	const naturalScale = Math.min(
		declaredWidth > 0 ? declaredWidth / viewBox.width : 1,
		declaredHeight > 0 ? declaredHeight / viewBox.height : 1,
	);
	const maxScale = Math.min(
		options.maxWidth
			? options.maxWidth / viewBox.width
			: Number.POSITIVE_INFINITY,
		options.maxHeight
			? options.maxHeight / viewBox.height
			: Number.POSITIVE_INFINITY,
	);
	const scale = Math.max(0.0001, Math.min(naturalScale || 1, maxScale));
	const width = viewBox.width * scale;
	const height = viewBox.height * scale;
	const target = options.target ?? {
		x: viewBox.x + viewBox.width / 2,
		y: viewBox.y + viewBox.height / 2,
	};
	const left = target.x - width / 2;
	const top = target.y - height / 2;
	return {
		scale,
		left,
		top,
		viewBox,
		mapBounds: (bounds) => ({
			x: left + (bounds.x - viewBox.x) * scale,
			y: top + (bounds.y - viewBox.y) * scale,
			width: Math.max(0.01, bounds.width * scale),
			height: Math.max(0.01, bounds.height * scale),
		}),
	};
}

function collectNodeBounds(
	element: Element,
	parentMatrix: SvgMatrix,
): SvgBounds | null {
	const localMatrix = parseTransform(element.getAttribute("transform"));
	if (!localMatrix) return null;
	const matrix = multiplyMatrix(parentMatrix, localMatrix);
	const geometry = geometryForElement(element);
	if (geometry) {
		return boundsFromSubpaths(transformSubpaths(geometry.subpaths, matrix));
	}
	if (tagName(element) === "image") {
		const x = parseLength(element.getAttribute("x"));
		const y = parseLength(element.getAttribute("y"));
		const width = Math.max(0.01, parseLength(element.getAttribute("width")));
		const height = Math.max(0.01, parseLength(element.getAttribute("height")));
		return boundsFromSubpaths([
			[
				applyMatrix(matrix, { x, y }),
				applyMatrix(matrix, { x: x + width, y }),
				applyMatrix(matrix, { x: x + width, y: y + height }),
				applyMatrix(matrix, { x, y: y + height }),
			],
		]);
	}
	const bounds = childElements(element)
		.map((child) => collectNodeBounds(child, matrix))
		.filter((item): item is SvgBounds => item !== null);
	if (bounds.length === 0) return null;
	const minX = Math.min(...bounds.map((item) => item.x));
	const minY = Math.min(...bounds.map((item) => item.y));
	const maxX = Math.max(...bounds.map((item) => item.x + item.width));
	const maxY = Math.max(...bounds.map((item) => item.y + item.height));
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function escapeXmlAttribute(value: string | number): string {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function inheritedStyleMarkup(style: SvgStyle): string {
	const attributes: Array<[string, string | number | undefined]> = [
		["fill", style.fill],
		["stroke", style.stroke],
		["color", style.color],
		["stroke-width", style.strokeWidth],
		["opacity", style.opacity],
		["fill-opacity", style.fillOpacity],
		["stroke-opacity", style.strokeOpacity],
		["stroke-linecap", style.strokeLinecap],
		["stroke-linejoin", style.strokeLinejoin],
		["stroke-dasharray", style.strokeDasharray],
		["fill-rule", style.fillRule],
		["font-family", style.fontFamily],
		["font-size", style.fontSize],
		["font-weight", style.fontWeight],
		["font-style", style.fontStyle],
		["text-anchor", style.textAnchor],
	];
	return attributes
		.filter(
			(entry): entry is [string, string | number] => entry[1] !== undefined,
		)
		.map(([name, value]) => `${name}="${escapeXmlAttribute(value)}"`)
		.join(" ");
}

function elementHasFilterEffect(element: Element): boolean {
	const inline = parseStyleAttribute(element.getAttribute("style"));
	return hasMeaningfulPresentationValue(
		inline.get("filter") ?? element.getAttribute("filter"),
	);
}

function createFallbackElement(options: {
	root: Element;
	element: Element;
	parentMatrix: SvgMatrix;
	parentStyle: SvgStyle;
	layout: SvgLayout;
	defaults: CanvasElementFactoryDefaults;
	groupId: string | null;
	groupPath: string[];
	sourceName?: string;
}): CanvasElement {
	const measuredBounds =
		collectNodeBounds(options.element, options.parentMatrix) ??
		options.layout.viewBox;
	const padding = Math.max(
		2,
		options.parentStyle.strokeWidth * 2,
		Math.max(measuredBounds.width, measuredBounds.height) * 0.04,
	);
	const useRootBounds =
		options.element === options.root ||
		allElements(options.element).some(elementHasFilterEffect);
	const fallbackBounds = useRootBounds
		? options.layout.viewBox
		: {
				x: measuredBounds.x - padding,
				y: measuredBounds.y - padding,
				width: measuredBounds.width + padding * 2,
				height: measuredBounds.height + padding * 2,
			};
	const bounds = options.layout.mapBounds(fallbackBounds);
	const serializer = new XMLSerializer();
	const defs = allElements(options.root)
		.filter((child) => tagName(child) === "defs" || tagName(child) === "style")
		.map((child) => serializer.serializeToString(child))
		.join("");
	const markup = [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fallbackBounds.x} ${fallbackBounds.y} ${fallbackBounds.width} ${fallbackBounds.height}">`,
		defs,
		`<g ${inheritedStyleMarkup(options.parentStyle)} transform="matrix(${options.parentMatrix.join(" ")})">`,
		serializer.serializeToString(options.element),
		"</g></svg>",
	].join("");
	return createBaseCanvasElement(options.defaults, {
		type: "image",
		x: bounds.x,
		y: bounds.y,
		width: bounds.width,
		height: bounds.height,
		fill: "transparent",
		stroke: "transparent",
		strokeWidth: 0,
		groupId: options.groupId,
		customData: {
			imageSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`,
			imageAlt: options.sourceName ?? "SVG fallback",
			naturalWidth: fallbackBounds.width,
			naturalHeight: fallbackBounds.height,
			imageCrop: { x: 0, y: 0, width: 1, height: 1 },
			skedraType: "svg-fallback",
			...makeBaseCustomData(
				options.element,
				options.groupPath,
				options.sourceName,
			),
		},
	});
}

/**
 * Converts SVG markup into individually editable canvas elements. Geometry and
 * transforms stay vector-based; unsupported effects are isolated as SVG-image
 * fallbacks so the rest of the artwork remains editable.
 */
export function parseSvgToCanvasElements(
	markup: string,
	options: SvgImportOptions,
): SvgImportResult | null {
	if (!/<svg(?:\s|>)/i.test(markup)) return null;
	if (/<!DOCTYPE|<!ENTITY/i.test(markup)) return null;
	let document: Document;
	let parseIssue = false;
	try {
		document = new DOMParser({
			onError: () => {
				parseIssue = true;
			},
		}).parseFromString(markup, "image/svg+xml");
	} catch {
		return null;
	}
	if (parseIssue || document.getElementsByTagName("parsererror").length > 0) {
		return null;
	}
	const root = document.documentElement;
	if (!root || tagName(root) !== "svg") return null;
	sanitizeDocument(document);
	const viewBox = viewBoxForRoot(root);
	if (!viewBox) return null;
	const layout = createLayout(root, viewBox, options);
	const sharedGroupId = options.createId();
	const elements: CanvasElement[] = [];
	let usedFallback = false;

	const addFallback = (
		element: Element,
		parentMatrix: SvgMatrix,
		parentStyle: SvgStyle,
		groupPath: string[],
	) => {
		elements.push(
			createFallbackElement({
				root,
				element,
				parentMatrix,
				parentStyle,
				layout,
				defaults: options,
				groupId: sharedGroupId,
				groupPath,
				sourceName: options.sourceName,
			}),
		);
		usedFallback = true;
	};

	const visit = (
		element: Element,
		parentMatrix: SvgMatrix,
		parentStyle: SvgStyle,
		groupPath: string[],
	) => {
		const tag = tagName(element);
		if (IGNORED_TAGS.has(tag) || UNSAFE_TAGS.has(tag)) return;
		if (
			tag === "image" &&
			!element.getAttribute("href") &&
			!element.getAttribute("xlink:href")
		) {
			return;
		}
		const localMatrix = parseTransform(element.getAttribute("transform"));
		const style = deriveStyle(element, parentStyle);
		const inline = parseStyleAttribute(element.getAttribute("style"));
		const display = (element.getAttribute("display") ?? inline.get("display"))
			?.trim()
			.toLowerCase();
		const visibility = (
			element.getAttribute("visibility") ?? inline.get("visibility")
		)
			?.trim()
			.toLowerCase();
		if (
			display === "none" ||
			visibility === "hidden" ||
			visibility === "collapse" ||
			style.opacity <= 0 ||
			isNonRenderingGeometry(element)
		) {
			return;
		}
		if (
			!localMatrix ||
			hasUnsupportedEffects(element, style) ||
			hasUnsupportedGeometryMeasurements(element)
		) {
			addFallback(element, parentMatrix, parentStyle, groupPath);
			return;
		}
		const matrix = multiplyMatrix(parentMatrix, localMatrix);
		if (CONTAINER_TAGS.has(tag)) {
			if (
				tag === "svg" &&
				element !== root &&
				element.getAttribute("viewBox")
			) {
				addFallback(element, parentMatrix, parentStyle, groupPath);
				return;
			}
			const id = element.getAttribute("id");
			const nextPath = id ? [...groupPath, id] : groupPath;
			for (const child of childElements(element)) {
				visit(child, matrix, style, nextPath);
			}
			return;
		}
		if (tag === "text") {
			const text = createTextElement({
				element,
				matrix,
				style,
				layout,
				defaults: options,
				groupId: sharedGroupId,
				groupPath,
				sourceName: options.sourceName,
			});
			if (text) {
				elements.push(text);
				return;
			}
		} else if (GEOMETRY_TAGS.has(tag)) {
			const native = createNativeElement({
				element,
				matrix,
				style,
				layout,
				defaults: options,
				groupId: sharedGroupId,
				groupPath,
				sourceName: options.sourceName,
			});
			if (native) {
				elements.push(native);
				return;
			}
			const geometry = geometryForElement(element);
			const path = geometry
				? createPathElement({
						element,
						geometry,
						matrix,
						style,
						layout,
						defaults: options,
						groupId: sharedGroupId,
						groupPath,
						sourceName: options.sourceName,
					})
				: null;
			if (path) {
				elements.push(path);
				return;
			}
		}
		addFallback(element, parentMatrix, parentStyle, groupPath);
	};

	const hasStylesheet = allElements(root).some(
		(element) =>
			tagName(element) === "style" && Boolean(element.textContent?.trim()),
	);
	if (hasStylesheet) {
		addFallback(root, IDENTITY_MATRIX, ROOT_STYLE, []);
	} else {
		visit(root, IDENTITY_MATRIX, ROOT_STYLE, []);
	}
	if (elements.length === 0) return null;
	if (elements.length === 1) elements[0] = { ...elements[0], groupId: null };
	return { elements, usedFallback };
}
