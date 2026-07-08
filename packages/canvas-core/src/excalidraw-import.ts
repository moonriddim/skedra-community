import {
	type ArrowHead,
	type CanvasElement,
	DEFAULT_FONT_FAMILY,
	type ElementType,
	type RoughFillStyle,
	type StrokeStyle,
} from "./types";

export interface ExcalidrawImportOptions {
	createId: () => string;
	defaultStroke: string;
	defaultFontFamily?: string;
}

export interface ConvertedExcalidrawLibraryGroup {
	name: string;
	elements: CanvasElement[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback = 0): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function readPoints(value: unknown): [number, number][] | undefined {
	if (!Array.isArray(value)) return undefined;
	const points: [number, number][] = [];
	for (const entry of value) {
		if (!Array.isArray(entry) || entry.length < 2) continue;
		const x = readNumber(entry[0]);
		const y = readNumber(entry[1]);
		points.push([x, y]);
	}
	return points.length > 0 ? points : undefined;
}

function mapStrokeStyle(value: unknown): StrokeStyle {
	if (value === "dashed" || value === "dotted") return value;
	return "solid";
}

function mapRoughFillStyle(value: unknown): RoughFillStyle | undefined {
	if (
		value === "hachure" ||
		value === "cross-hatch" ||
		value === "zigzag" ||
		value === "dots"
	) {
		if (value === "cross-hatch") return "cross-hatch";
		if (value === "dots") return "dots";
		if (value === "zigzag") return "dashed";
		return "hachure";
	}
	return undefined;
}

function readExcalidrawGroupId(raw: Record<string, unknown>): string | null {
	const groupIds = raw.groupIds;
	if (!Array.isArray(groupIds) || groupIds.length === 0) return null;
	const first = groupIds[0];
	return typeof first === "string" ? first : null;
}

function mapArrowHead(value: unknown): ArrowHead | undefined {
	if (
		value === "arrow" ||
		value === "triangle" ||
		value === "dot" ||
		value === "bar"
	) {
		if (value === "triangle") return "triangle";
		if (value === "dot") return "dot";
		if (value === "bar") return "none";
		return "arrow";
	}
	return undefined;
}

function mapElementType(raw: Record<string, unknown>): ElementType | null {
	const type = readString(raw.type);
	switch (type) {
		case "rectangle":
			return "rectangle";
		case "ellipse":
			return "ellipse";
		case "diamond":
			return "diamond";
		case "line":
			return raw.endArrowhead || raw.startArrowhead ? "arrow" : "line";
		case "arrow":
			return "arrow";
		case "draw":
		case "freedraw":
			return "freehand";
		case "text":
			return "text";
		default:
			return null;
	}
}

export function convertExcalidrawElement(
	raw: Record<string, unknown>,
	options: ExcalidrawImportOptions,
): CanvasElement | null {
	if (raw.isDeleted === true) return null;

	const type = mapElementType(raw);
	if (!type) return null;

	const angle = readNumber(raw.angle);
	const rotation =
		Math.abs(angle) > Math.PI * 2 ? angle : (angle * 180) / Math.PI;
	const opacity = Math.round(readNumber(raw.opacity, 100));
	const excalRoughness = readNumber(raw.roughness, 0);
	const roughness = Math.min(2, Math.max(0, Math.round(excalRoughness)));
	const excalSeed = readNumber(raw.seed, 1);
	const excalGroupId = readExcalidrawGroupId(raw);

	const element: CanvasElement = {
		id: readString(raw.id, options.createId()),
		type,
		x: readNumber(raw.x),
		y: readNumber(raw.y),
		width: Math.max(1, readNumber(raw.width, 1)),
		height: Math.max(1, readNumber(raw.height, 1)),
		rotation,
		fill: readString(raw.backgroundColor, "transparent"),
		stroke: readString(raw.strokeColor, options.defaultStroke),
		strokeWidth: Math.max(1, readNumber(raw.strokeWidth, 1)),
		strokeStyle: mapStrokeStyle(raw.strokeStyle),
		opacity,
		locked: false,
		groupId: excalGroupId,
		flipX: false,
		flipY: false,
		roughness: roughness > 0 ? roughness : undefined,
		roughFillStyle: mapRoughFillStyle(raw.fillStyle),
		customData: {
			excalidrawSeed: excalSeed,
			excalidrawImport: true,
		},
	};

	if (type === "line" || type === "arrow" || type === "freehand") {
		element.points = readPoints(raw.points);
		if (type === "arrow") {
			element.arrowHeadStart = mapArrowHead(raw.startArrowhead);
			element.arrowHeadEnd = mapArrowHead(raw.endArrowhead) ?? "arrow";
			element.arrowMode = "straight";
		}
	}

	if (type === "text") {
		element.text = readString(raw.text);
		element.fontSize = readNumber(raw.fontSize, 20);
		element.fontFamily = readString(
			raw.fontFamily,
			options.defaultFontFamily ?? DEFAULT_FONT_FAMILY,
		);
	}

	return element;
}

export function convertExcalidrawLibraryGroups(
	library: unknown[],
	options: ExcalidrawImportOptions,
): ConvertedExcalidrawLibraryGroup[] {
	const groups: ConvertedExcalidrawLibraryGroup[] = [];
	for (let index = 0; index < library.length; index++) {
		const group = library[index];
		if (!Array.isArray(group)) continue;
		const elements = group.flatMap((raw) => {
			if (!isRecord(raw)) return [];
			const converted = convertExcalidrawElement(raw, options);
			return converted ? [converted] : [];
		});
		if (elements.length === 0) continue;
		groups.push({
			name: `Item ${index + 1}`,
			elements,
		});
	}
	return groups;
}
