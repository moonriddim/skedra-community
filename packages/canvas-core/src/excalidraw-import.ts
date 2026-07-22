import {
	type ArrowHead,
	type CanvasElement,
	type CanvasElementBinding,
	DEFAULT_FONT_FAMILY,
	type ElementType,
	type RoughFillStyle,
	type StrokeStyle,
} from "./types";

const EXCALIDRAW_FILE_TYPE = "excalidraw" as const;
const EXCALIDRAW_CLIPBOARD_TYPE = "excalidraw/clipboard" as const;
const EXCALIDRAW_VERSION = 2;
const EXCALIDRAW_META_KEY = "excalidraw";
const SKEDRA_INTEROP_KEY = "skedra";
export const SKEDRA_CLIPBOARD_TYPE = "skedra-clipboard" as const;

const EXCALIDRAW_FONT_FAMILIES: Record<number, string> = {
	1: '"Virgil", "Kalam", "Segoe Print", cursive',
	2: 'Helvetica, Arial, "Liberation Sans", sans-serif',
	3: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
	5: '"Excalifont", "Virgil", "Kalam", cursive',
	6: '"Nunito", Arial, sans-serif',
	7: '"Lilita One", Arial, sans-serif',
	8: '"Comic Shanns", "Comic Sans MS", cursive',
	9: '"Liberation Sans", Arial, sans-serif',
	10: '"Assistant", Arial, sans-serif',
	998: "sans-serif",
	999: "monospace",
};

const CANVAS_ELEMENT_TYPE_SET = new Set<ElementType>([
	"rectangle",
	"ellipse",
	"diamond",
	"triangle",
	"cloud",
	"line",
	"arrow",
	"image",
	"text",
	"freehand",
	"frame",
]);

export interface ExcalidrawImportOptions {
	createId: () => string;
	defaultStroke: string;
	defaultFontFamily?: string;
	files?: Record<string, unknown>;
}

export interface ExcalidrawExportOptions {
	source?: string;
	canvasBg?: string;
	viewport?: { x: number; y: number; zoom: number };
	now?: number;
}

export interface ExcalidrawSceneFile {
	type: typeof EXCALIDRAW_FILE_TYPE;
	version: number;
	source: string;
	elements: Record<string, unknown>[];
	appState: Record<string, unknown>;
	files: Record<string, unknown>;
}

export interface ConvertedExcalidrawScene {
	elements: CanvasElement[];
	appState: Record<string, unknown>;
	files: Record<string, unknown>;
	source?: string;
}

export interface ConvertedExcalidrawLibraryGroup {
	name: string;
	elements: CanvasElement[];
}

interface ExcalidrawElementMetadata {
	element: Record<string, unknown>;
	originalElementId: string;
	primaryGroupId: string | null;
	file?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
	if (typeof structuredClone === "function") return structuredClone(value);
	return JSON.parse(JSON.stringify(value)) as T;
}

function omitRecordKeys(
	value: Record<string, unknown>,
	keys: readonly string[],
): Record<string, unknown> {
	const omitted = new Set(keys);
	return Object.fromEntries(
		Object.entries(value).filter(([key]) => !omitted.has(key)),
	);
}

function readNumber(value: unknown, fallback = 0): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readOptionalNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

function readString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function readOptionalString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function readPoints(value: unknown): [number, number][] | undefined {
	if (!Array.isArray(value)) return undefined;
	const points: [number, number][] = [];
	for (const entry of value) {
		if (!Array.isArray(entry) || entry.length < 2) continue;
		const x = readOptionalNumber(entry[0]);
		const y = readOptionalNumber(entry[1]);
		if (x === undefined || y === undefined) continue;
		points.push([x, y]);
	}
	return points.length > 0 ? points : undefined;
}

function readBinding(value: unknown): CanvasElementBinding | null {
	if (!isRecord(value) || typeof value.elementId !== "string") return null;
	const fixedPoint = readPoints(
		Array.isArray(value.fixedPoint) ? [value.fixedPoint] : undefined,
	)?.[0];
	return {
		elementId: value.elementId,
		...(readOptionalNumber(value.focus) !== undefined
			? { focus: readNumber(value.focus) }
			: {}),
		...(readOptionalNumber(value.gap) !== undefined
			? { gap: readNumber(value.gap) }
			: {}),
		...(value.fixedPoint === null
			? { fixedPoint: null }
			: fixedPoint
				? { fixedPoint }
				: {}),
		...(value.mode === "inside" ||
		value.mode === "orbit" ||
		value.mode === "skip"
			? { mode: value.mode }
			: {}),
	};
}

function readStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((entry): entry is string => typeof entry === "string");
}

function mapStrokeStyle(value: unknown): StrokeStyle {
	if (value === "dashed" || value === "dotted") return value;
	return "solid";
}

function mapRoughFillStyle(value: unknown): RoughFillStyle | undefined {
	if (value === "solid") return "solid";
	if (value === "cross-hatch") return "cross-hatch";
	if (value === "dots") return "dots";
	if (value === "zigzag") return "dashed";
	if (value === "hachure") return "hachure";
	return undefined;
}

function mapFillStyleToExcalidraw(value: RoughFillStyle | undefined) {
	if (value === "cross-hatch") return "cross-hatch";
	if (value === "dots") return "dots";
	if (value === "dashed") return "zigzag";
	if (value === "hachure") return "hachure";
	return "solid";
}

function readExcalidrawGroupIds(raw: Record<string, unknown>): string[] {
	return readStringArray(raw.groupIds);
}

function readExcalidrawGroupId(raw: Record<string, unknown>): string | null {
	return readExcalidrawGroupIds(raw)[0] ?? null;
}

function mapArrowHead(value: unknown): ArrowHead | undefined {
	if (value == null) return "none";
	if (value === "triangle" || value === "triangle_outline") return "triangle";
	if (value === "dot" || value === "circle" || value === "circle_outline") {
		return "dot";
	}
	if (value === "bar") return "none";
	if (typeof value === "string") return "arrow";
	return undefined;
}

function mapArrowHeadToExcalidraw(value: ArrowHead | undefined): string | null {
	if (!value || value === "none") return null;
	if (value === "dot") return "circle";
	return value;
}

function mapElementType(raw: Record<string, unknown>): ElementType | null {
	const type = readString(raw.type);
	switch (type) {
		case "rectangle":
		case "embeddable":
		case "iframe":
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
		case "image":
			return "image";
		case "frame":
		case "magicframe":
			return "frame";
		default:
			return null;
	}
}

function mapCanvasTypeToExcalidraw(type: ElementType): string {
	if (type === "freehand") return "freedraw";
	if (type === "triangle" || type === "cloud") return "rectangle";
	return type;
}

function mapFontFamilyFromExcalidraw(value: unknown, fallback: string): string {
	if (typeof value === "number") {
		return EXCALIDRAW_FONT_FAMILIES[value] ?? fallback;
	}
	return typeof value === "string" && value.trim() ? value : fallback;
}

function mapFontFamilyToExcalidraw(value: string | undefined): number {
	if (!value) return 5;
	const normalized = value.toLowerCase();
	if (normalized.includes("virgil")) return 1;
	if (normalized.includes("excalifont")) return 5;
	if (normalized.includes("cascadia")) return 3;
	if (normalized.includes("comic shanns")) return 8;
	if (normalized.includes("nunito")) return 6;
	if (normalized.includes("lilita")) return 7;
	if (normalized.includes("assistant")) return 10;
	if (normalized.includes("liberation sans")) return 9;
	if (normalized.includes("mono")) return 3;
	if (normalized.includes("helvetica") || normalized.includes("arial"))
		return 2;
	return 5;
}

function readRoundnessChanges(raw: Record<string, unknown>): {
	cornerRadius?: number;
	cornerRadiusPercent?: number;
} {
	if (raw.strokeSharpness === "round") return { cornerRadiusPercent: 50 };
	if (!isRecord(raw.roundness)) return {};
	const value = readOptionalNumber(raw.roundness.value);
	if (value !== undefined) return { cornerRadius: Math.max(0, value) };
	return raw.roundness.type === 3
		? { cornerRadius: 32 }
		: { cornerRadiusPercent: 50 };
}

function getRawCustomData(raw: Record<string, unknown>) {
	return isRecord(raw.customData) ? cloneValue(raw.customData) : {};
}

function getExcalidrawFile(
	raw: Record<string, unknown>,
	files: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	const fileId = readOptionalString(raw.fileId);
	const file = fileId && files?.[fileId];
	return isRecord(file) ? cloneValue(file) : undefined;
}

function buildExcalidrawMetadata(
	raw: Record<string, unknown>,
	options: ExcalidrawImportOptions,
): ExcalidrawElementMetadata {
	const sourceFile = getExcalidrawFile(raw, options.files);
	const file = sourceFile ? omitRecordKeys(sourceFile, ["dataURL"]) : undefined;
	return {
		element: cloneValue(raw),
		originalElementId: readString(raw.id),
		primaryGroupId: readExcalidrawGroupId(raw),
		file,
	};
}

function readSkedraInterop(raw: Record<string, unknown>) {
	if (!isRecord(raw.customData)) return null;
	const value = raw.customData[SKEDRA_INTEROP_KEY];
	return isRecord(value) && value.version === 1 ? value : null;
}

function restoreSkedraSnapshot(
	converted: CanvasElement,
	raw: Record<string, unknown>,
): CanvasElement {
	const interop = readSkedraInterop(raw);
	const snapshot = interop?.element;
	if (
		!isRecord(snapshot) ||
		!CANVAS_ELEMENT_TYPE_SET.has(snapshot.type as ElementType)
	) {
		return converted;
	}

	const snapshotCustomData = isRecord(snapshot.customData)
		? cloneValue(snapshot.customData)
		: {};
	return {
		...(cloneValue(snapshot) as unknown as CanvasElement),
		id: converted.id,
		x: converted.x,
		y: converted.y,
		width: converted.width,
		height: converted.height,
		rotation: converted.rotation,
		fill: converted.fill,
		stroke: converted.stroke,
		strokeWidth: converted.strokeWidth,
		strokeStyle: converted.strokeStyle,
		opacity: converted.opacity,
		locked: converted.locked,
		groupId: converted.groupId,
		frameId: converted.frameId,
		containerId: converted.containerId,
		startBinding: converted.startBinding,
		endBinding: converted.endBinding,
		link: converted.link,
		flipX: converted.flipX,
		flipY: converted.flipY,
		...(converted.points ? { points: converted.points } : {}),
		customData: {
			...snapshotCustomData,
			...(converted.customData ?? {}),
		},
	};
}

function getImageCustomData(
	raw: Record<string, unknown>,
	file: Record<string, unknown> | undefined,
) {
	const dataUrl = readOptionalString(file?.dataURL);
	const crop = isRecord(raw.crop) ? raw.crop : null;
	const naturalWidth = readNumber(crop?.naturalWidth, readNumber(raw.width, 1));
	const naturalHeight = readNumber(
		crop?.naturalHeight,
		readNumber(raw.height, 1),
	);
	const imageCrop = crop
		? {
				x: readNumber(crop.x) / Math.max(1, naturalWidth),
				y: readNumber(crop.y) / Math.max(1, naturalHeight),
				width: readNumber(crop.width, naturalWidth) / Math.max(1, naturalWidth),
				height:
					readNumber(crop.height, naturalHeight) / Math.max(1, naturalHeight),
			}
		: { x: 0, y: 0, width: 1, height: 1 };
	return {
		...(dataUrl ? { imageSrc: dataUrl } : {}),
		naturalWidth,
		naturalHeight,
		imageCrop,
	};
}

export function convertExcalidrawElement(
	raw: Record<string, unknown>,
	options: ExcalidrawImportOptions,
): CanvasElement | null {
	if (raw.isDeleted === true) return null;

	const type = mapElementType(raw);
	if (!type) return null;

	const angle = readNumber(raw.angle);
	const groupId = readExcalidrawGroupId(raw);
	const file = getExcalidrawFile(raw, options.files);
	const rawCustomData = getRawCustomData(raw);
	const roughness = Math.max(0, readNumber(raw.roughness, 0));
	const rawFrameId = readOptionalString(raw.frameId);
	const scale = Array.isArray(raw.scale) ? raw.scale : undefined;
	const element: CanvasElement = {
		id: readString(raw.id, options.createId()),
		type,
		x: readNumber(raw.x),
		y: readNumber(raw.y),
		width: Math.max(0, readNumber(raw.width, 1)),
		height: Math.max(0, readNumber(raw.height, 1)),
		rotation: (angle * 180) / Math.PI,
		fill: readString(raw.backgroundColor, "transparent"),
		stroke: readString(raw.strokeColor, options.defaultStroke),
		strokeWidth: Math.max(0, readNumber(raw.strokeWidth, 1)),
		strokeStyle: mapStrokeStyle(raw.strokeStyle),
		opacity: readNumber(raw.opacity, 100),
		locked: raw.locked === true,
		groupId,
		stackIndex: readOptionalString(raw.index),
		frameId: rawFrameId,
		containerId:
			raw.containerId === null ? null : readOptionalString(raw.containerId),
		link: readOptionalString(raw.link),
		flipX: readNumber(scale?.[0], 1) < 0,
		flipY: readNumber(scale?.[1], 1) < 0,
		roughness: roughness > 0 ? roughness : undefined,
		roughFillStyle: mapRoughFillStyle(raw.fillStyle),
		...readRoundnessChanges(raw),
		customData: {
			...rawCustomData,
			...(type === "image" ? getImageCustomData(raw, file) : {}),
			excalidrawSeed: readNumber(raw.seed, 1),
			excalidrawImport: true,
			[EXCALIDRAW_META_KEY]: buildExcalidrawMetadata(raw, options),
		},
	};

	if (type === "line" || type === "arrow" || type === "freehand") {
		element.points = readPoints(raw.points);
		if (type === "line") element.closed = raw.polygon === true;
		if (type === "line" || type === "arrow") {
			element.startBinding = readBinding(raw.startBinding);
			element.endBinding = readBinding(raw.endBinding);
		}
		if (type === "arrow") {
			element.arrowHeadStart = mapArrowHead(raw.startArrowhead);
			element.arrowHeadEnd = mapArrowHead(raw.endArrowhead) ?? "arrow";
			element.arrowMode =
				raw.elbowed === true
					? "elbow"
					: isRecord(raw.roundness) || raw.strokeSharpness === "round"
						? "curve"
						: "straight";
		}
	}

	if (type === "text") {
		element.text = readString(raw.text);
		element.textColor = element.stroke;
		element.fontSize = readNumber(raw.fontSize, 20);
		element.fontFamily = mapFontFamilyFromExcalidraw(
			raw.fontFamily,
			options.defaultFontFamily ?? DEFAULT_FONT_FAMILY,
		);
		element.textAlign =
			raw.textAlign === "center" || raw.textAlign === "right"
				? raw.textAlign
				: "left";
		element.verticalAlign =
			raw.verticalAlign === "middle" || raw.verticalAlign === "bottom"
				? raw.verticalAlign
				: "top";
		element.baseline = readOptionalNumber(raw.baseline);
		element.lineHeight = readOptionalNumber(raw.lineHeight);
	}

	if (type === "frame") {
		element.frameLabel = readOptionalString(raw.name);
	}

	return restoreSkedraSnapshot(element, raw);
}

function isGeneratedSkedraText(raw: Record<string, unknown>) {
	if (!isRecord(raw.customData)) return false;
	return typeof raw.customData.skedraGeneratedTextFor === "string";
}

function mergeGeneratedTextElements(
	rawElements: Record<string, unknown>[],
	convertedByRawId: Map<string, CanvasElement>,
) {
	const skippedIds = new Set<string>();
	const parentsWithMergedText = new Set<string>();
	for (const raw of rawElements) {
		if (!isGeneratedSkedraText(raw)) continue;
		const rawId = readString(raw.id);
		const parentId =
			readOptionalString(raw.containerId) ??
			(isRecord(raw.customData)
				? readOptionalString(raw.customData.skedraGeneratedTextFor)
				: undefined);
		const textElement = convertedByRawId.get(rawId);
		const parent = parentId ? convertedByRawId.get(parentId) : undefined;
		if (!textElement || !parentId || !parent) continue;
		parent.text = textElement.text ?? "";
		parent.textColor = textElement.textColor;
		parent.fontSize = textElement.fontSize;
		parent.fontFamily = textElement.fontFamily;
		parent.textAlign = textElement.textAlign;
		parent.verticalAlign = textElement.verticalAlign;
		parent.baseline = textElement.baseline;
		parent.lineHeight = textElement.lineHeight;
		skippedIds.add(rawId);
		parentsWithMergedText.add(parentId);
	}

	for (const raw of rawElements) {
		const interop = readSkedraInterop(raw);
		const generatedTextId = readOptionalString(interop?.generatedTextId);
		if (!generatedTextId || convertedByRawId.has(generatedTextId)) continue;
		const rawId = readString(raw.id);
		if (parentsWithMergedText.has(rawId)) continue;
		const parent = convertedByRawId.get(rawId);
		if (parent) parent.text = "";
	}
	return skippedIds;
}

function convertExcalidrawElements(
	rawElements: Record<string, unknown>[],
	options: ExcalidrawImportOptions,
) {
	const convertedByRawId = new Map<string, CanvasElement>();
	for (const raw of rawElements) {
		const converted = convertExcalidrawElement(raw, options);
		if (converted)
			convertedByRawId.set(readString(raw.id, converted.id), converted);
	}
	const skippedIds = mergeGeneratedTextElements(rawElements, convertedByRawId);
	return rawElements.flatMap((raw) => {
		const id = readString(raw.id);
		if (skippedIds.has(id)) return [];
		const converted = convertedByRawId.get(id);
		return converted ? [converted] : [];
	});
}

export function convertExcalidrawLibraryGroups(
	library: unknown[],
	options: ExcalidrawImportOptions,
): ConvertedExcalidrawLibraryGroup[] {
	const groups: ConvertedExcalidrawLibraryGroup[] = [];
	for (let index = 0; index < library.length; index++) {
		const entry = library[index];
		const group = Array.isArray(entry)
			? entry
			: isRecord(entry) && Array.isArray(entry.elements)
				? entry.elements
				: null;
		if (!group) continue;
		const rawElements = group.filter(isRecord);
		const elements = convertExcalidrawElements(rawElements, options);
		if (elements.length === 0) continue;
		groups.push({
			name:
				isRecord(entry) && typeof entry.name === "string"
					? entry.name
					: `Item ${index + 1}`,
			elements,
		});
	}
	return groups;
}

/** Converts an Excalidraw scene or clipboard payload into editable Skedra elements. */
export function parseExcalidrawScene(
	value: string | unknown,
	options: ExcalidrawImportOptions,
): ConvertedExcalidrawScene | null {
	let parsed: unknown = value;
	if (typeof value === "string") {
		try {
			parsed = JSON.parse(value);
		} catch {
			return null;
		}
	}
	if (
		!isRecord(parsed) ||
		(parsed.type !== EXCALIDRAW_FILE_TYPE &&
			parsed.type !== EXCALIDRAW_CLIPBOARD_TYPE) ||
		!Array.isArray(parsed.elements)
	) {
		return null;
	}
	const files = isRecord(parsed.files) ? cloneValue(parsed.files) : {};
	const rawElements = parsed.elements.filter(isRecord);
	return {
		elements: convertExcalidrawElements(rawElements, { ...options, files }),
		appState: isRecord(parsed.appState) ? cloneValue(parsed.appState) : {},
		files,
		source: readOptionalString(parsed.source),
	};
}

/**
 * Parses the plain-text clipboard payload emitted by Excalidraw-compatible
 * tools such as drwn.io. `null` means the clipboard uses a different format.
 */
export function parseExcalidrawClipboard(
	value: string,
	options: ExcalidrawImportOptions,
): CanvasElement[] | null {
	return parseExcalidrawScene(value, options)?.elements ?? null;
}

function readExcalidrawMetadata(
	element: CanvasElement,
): ExcalidrawElementMetadata | null {
	const value = element.customData?.[EXCALIDRAW_META_KEY];
	if (!isRecord(value) || !isRecord(value.element)) return null;
	return {
		element: cloneValue(value.element),
		originalElementId: readString(value.originalElementId, element.id),
		primaryGroupId:
			typeof value.primaryGroupId === "string" ? value.primaryGroupId : null,
		file: isRecord(value.file) ? cloneValue(value.file) : undefined,
	};
}

function stripInternalMetadata(
	element: CanvasElement,
): Record<string, unknown> {
	const snapshot = cloneValue(element) as unknown as Record<string, unknown>;
	if (isRecord(snapshot.customData)) {
		let customData = omitRecordKeys(snapshot.customData, [
			EXCALIDRAW_META_KEY,
			SKEDRA_INTEROP_KEY,
		]);
		if (
			element.type === "image" &&
			typeof customData.imageSrc === "string" &&
			customData.imageSrc.startsWith("data:")
		) {
			customData = omitRecordKeys(customData, ["imageSrc"]);
		}
		snapshot.customData =
			Object.keys(customData).length > 0 ? customData : undefined;
	}
	return snapshot;
}

function createSeed(value: string) {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return Math.max(1, Math.abs(hash | 0));
}

function createVersionNonce(value: string) {
	return createSeed(`${value}:version`);
}

function resolveExportGroupIds(
	element: CanvasElement,
	metadata: ExcalidrawElementMetadata | null,
) {
	if (!element.groupId) return [];
	const rawGroupIds = metadata ? readExcalidrawGroupIds(metadata.element) : [];
	if (
		metadata?.primaryGroupId &&
		element.groupId === metadata.primaryGroupId &&
		rawGroupIds.length > 0
	) {
		return rawGroupIds;
	}
	return [element.groupId];
}

function remapElementReference(
	value: unknown,
	originalToCurrentId: Map<string, string>,
) {
	if (!isRecord(value)) return value == null ? null : value;
	const binding = cloneValue(value);
	if (typeof binding.elementId === "string") {
		binding.elementId =
			originalToCurrentId.get(binding.elementId) ?? binding.elementId;
	}
	return binding;
}

function remapBoundElements(
	value: unknown,
	originalToCurrentId: Map<string, string>,
): Record<string, unknown>[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		if (!isRecord(entry) || typeof entry.id !== "string") return [];
		return [
			{
				...cloneValue(entry),
				id: originalToCurrentId.get(entry.id) ?? entry.id,
			},
		];
	});
}

function resolveRawArrowHead(current: ArrowHead | undefined, raw: unknown) {
	return current === mapArrowHead(raw)
		? (raw ?? null)
		: mapArrowHeadToExcalidraw(current);
}

function resolveRawFillStyle(
	current: RoughFillStyle | undefined,
	raw: unknown,
) {
	return current === mapRoughFillStyle(raw)
		? (raw ?? "solid")
		: mapFillStyleToExcalidraw(current);
}

function resolveRawElementType(
	element: CanvasElement,
	metadata: ExcalidrawElementMetadata | null,
) {
	const rawType = metadata?.element.type;
	if (
		metadata &&
		typeof rawType === "string" &&
		mapElementType(metadata.element) === element.type
	) {
		return rawType;
	}
	return mapCanvasTypeToExcalidraw(element.type);
}

function buildRoundness(
	element: CanvasElement,
	raw: Record<string, unknown>,
): Record<string, unknown> | null {
	if (
		element.arrowMode === "curve" &&
		(element.type === "line" || element.type === "arrow")
	) {
		return { type: 2 };
	}
	if (
		(element.cornerRadius ?? 0) <= 0 &&
		(element.cornerRadiusPercent ?? 0) <= 0
	) {
		return null;
	}
	if (isRecord(raw.roundness)) {
		return cloneValue(raw.roundness);
	}
	return element.cornerRadius != null
		? { type: 3, value: element.cornerRadius }
		: { type: 3 };
}

function mergeExportCustomData(
	element: CanvasElement,
	raw: Record<string, unknown>,
	generatedTextId?: string,
) {
	const rawCustomData = isRecord(raw.customData)
		? omitRecordKeys(cloneValue(raw.customData), [SKEDRA_INTEROP_KEY])
		: {};
	const canvasCustomData = omitRecordKeys(
		cloneValue(element.customData ?? {}),
		[EXCALIDRAW_META_KEY],
	);
	return {
		...rawCustomData,
		...canvasCustomData,
		[SKEDRA_INTEROP_KEY]: {
			version: 1,
			element: stripInternalMetadata(element),
			...(generatedTextId ? { generatedTextId } : {}),
		},
	};
}

function buildImageCrop(element: CanvasElement) {
	const naturalWidth = readNumber(
		element.customData?.naturalWidth,
		element.width,
	);
	const naturalHeight = readNumber(
		element.customData?.naturalHeight,
		element.height,
	);
	const crop = isRecord(element.customData?.imageCrop)
		? element.customData.imageCrop
		: null;
	if (!crop) return null;
	return {
		x: readNumber(crop.x) * naturalWidth,
		y: readNumber(crop.y) * naturalHeight,
		width: readNumber(crop.width, 1) * naturalWidth,
		height: readNumber(crop.height, 1) * naturalHeight,
		naturalWidth,
		naturalHeight,
	};
}

function dataUrlMimeType(value: string) {
	const match = /^data:([^;,]+)/u.exec(value);
	return match?.[1] ?? "application/octet-stream";
}

function buildImageFile(
	element: CanvasElement,
	metadata: ExcalidrawElementMetadata | null,
	fileId: string,
	now: number,
) {
	const imageSrc = readOptionalString(element.customData?.imageSrc);
	if (!imageSrc?.startsWith("data:")) return metadata?.file;
	return {
		...(metadata?.file ?? {}),
		id: fileId,
		dataURL: imageSrc,
		mimeType: dataUrlMimeType(imageSrc),
		created: readNumber(metadata?.file?.created, now),
		lastRetrieved: now,
	};
}

function buildBaseExcalidrawElement(options: {
	element: CanvasElement;
	metadata: ExcalidrawElementMetadata | null;
	originalToCurrentId: Map<string, string>;
	now: number;
	generatedTextId?: string;
}) {
	const { element, metadata, originalToCurrentId, now, generatedTextId } =
		options;
	const raw = metadata?.element ?? {};
	const rawFrameId = readOptionalString(raw.frameId);
	const frameId = element.frameId
		? (originalToCurrentId.get(element.frameId) ?? element.frameId)
		: rawFrameId
			? (originalToCurrentId.get(rawFrameId) ?? rawFrameId)
			: null;
	const previousGeneratedTextId = readOptionalString(
		readSkedraInterop(raw)?.generatedTextId,
	);
	const boundElements = remapBoundElements(
		raw.boundElements,
		originalToCurrentId,
	).filter((entry) => entry.id !== previousGeneratedTextId);
	if (
		generatedTextId &&
		!boundElements.some((entry) => entry.id === generatedTextId)
	) {
		boundElements.push({ id: generatedTextId, type: "text" });
	}
	const type = resolveRawElementType(element, metadata);
	const output: Record<string, unknown> = {
		...cloneValue(raw),
		id: element.id,
		type,
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
		angle: (element.rotation * Math.PI) / 180,
		strokeColor: element.stroke,
		backgroundColor: element.fill,
		fillStyle: resolveRawFillStyle(element.roughFillStyle, raw.fillStyle),
		strokeWidth: element.strokeWidth,
		strokeStyle: element.strokeStyle,
		roughness: element.roughness ?? 0,
		opacity: element.opacity,
		seed: readNumber(
			element.customData?.excalidrawSeed,
			readNumber(raw.seed, createSeed(element.id)),
		),
		version: Math.max(1, Math.trunc(readNumber(raw.version, 1))),
		versionNonce: Math.trunc(
			readNumber(raw.versionNonce, createVersionNonce(element.id)),
		),
		index: element.stackIndex ?? readOptionalString(raw.index) ?? null,
		isDeleted: false,
		groupIds: resolveExportGroupIds(element, metadata),
		frameId,
		roundness: buildRoundness(element, raw),
		boundElements,
		updated: Math.trunc(readNumber(raw.updated, now)),
		link: element.link ?? null,
		locked: element.locked,
		customData: mergeExportCustomData(element, raw, generatedTextId),
	};

	if (type === "line" || type === "arrow" || type === "freedraw") {
		output.points = cloneValue(
			element.points ?? [
				[0, 0],
				[element.width, element.height],
			],
		);
	}
	if (type === "line") {
		output.polygon = element.closed === true;
		output.startBinding = remapElementReference(
			element.startBinding !== undefined
				? element.startBinding
				: raw.startBinding,
			originalToCurrentId,
		);
		output.endBinding = remapElementReference(
			element.endBinding !== undefined ? element.endBinding : raw.endBinding,
			originalToCurrentId,
		);
		output.startArrowhead = resolveRawArrowHead(
			element.arrowHeadStart,
			raw.startArrowhead,
		);
		output.endArrowhead = resolveRawArrowHead(
			element.arrowHeadEnd,
			raw.endArrowhead,
		);
	}
	if (type === "arrow") {
		output.elbowed = element.arrowMode === "elbow";
		output.startBinding = remapElementReference(
			element.startBinding !== undefined
				? element.startBinding
				: raw.startBinding,
			originalToCurrentId,
		);
		output.endBinding = remapElementReference(
			element.endBinding !== undefined ? element.endBinding : raw.endBinding,
			originalToCurrentId,
		);
		output.startArrowhead = resolveRawArrowHead(
			element.arrowHeadStart,
			raw.startArrowhead,
		);
		output.endArrowhead = resolveRawArrowHead(
			element.arrowHeadEnd ?? "arrow",
			raw.endArrowhead,
		);
	}
	if (type === "freedraw") {
		output.pressures = Array.isArray(raw.pressures)
			? cloneValue(raw.pressures)
			: [];
		output.simulatePressure = raw.simulatePressure !== false;
		output.strokeOptions = isRecord(raw.strokeOptions)
			? cloneValue(raw.strokeOptions)
			: { variability: "variable", streamline: 0.5 };
	}
	if (type === "text") {
		output.text = element.text ?? "";
		output.originalText = element.text ?? "";
		output.fontSize = element.fontSize ?? 20;
		output.fontFamily =
			element.fontFamily === mapFontFamilyFromExcalidraw(raw.fontFamily, "")
				? raw.fontFamily
				: mapFontFamilyToExcalidraw(element.fontFamily);
		output.textAlign = element.textAlign ?? "left";
		output.verticalAlign = element.verticalAlign ?? "top";
		const containerId =
			element.containerId !== undefined
				? element.containerId
				: (readOptionalString(raw.containerId) ?? null);
		output.containerId = containerId
			? (originalToCurrentId.get(containerId) ?? containerId)
			: null;
		output.autoResize = raw.autoResize !== false;
		output.lineHeight = element.lineHeight ?? readNumber(raw.lineHeight, 1.25);
		if (element.baseline !== undefined || raw.baseline !== undefined) {
			output.baseline = element.baseline ?? raw.baseline;
		}
	}
	if (type === "frame" || type === "magicframe") {
		output.name = element.frameLabel ?? readOptionalString(raw.name) ?? null;
	}
	if (type === "image") {
		const fileId = readOptionalString(raw.fileId) ?? `skedra-${element.id}`;
		output.fileId = fileId;
		output.status = "saved";
		output.scale = [element.flipX ? -1 : 1, element.flipY ? -1 : 1];
		output.crop = buildImageCrop(element);
	}
	return output;
}

function estimateTextHeight(element: CanvasElement) {
	const fontSize = element.fontSize ?? 20;
	const lineHeight = element.lineHeight ?? 1.25;
	return Math.max(
		fontSize * lineHeight,
		(element.text ?? "").split("\n").length * fontSize * lineHeight,
	);
}

function buildGeneratedTextElement(options: {
	parent: CanvasElement;
	id: string;
	originalToCurrentId: Map<string, string>;
	now: number;
}) {
	const { parent, id, originalToCurrentId, now } = options;
	const textHeight = Math.min(
		parent.height || Number.POSITIVE_INFINITY,
		estimateTextHeight(parent),
	);
	const textWidth = Math.max(1, parent.width - 10);
	const textElement: CanvasElement = {
		id,
		type: "text",
		x: parent.x + (parent.width - textWidth) / 2,
		y: parent.y + (parent.height - textHeight) / 2,
		width: textWidth,
		height: textHeight,
		rotation: parent.rotation,
		fill: "transparent",
		stroke: parent.textColor ?? parent.stroke,
		strokeWidth: 1,
		strokeStyle: "solid",
		opacity: parent.opacity,
		locked: parent.locked,
		groupId: parent.groupId,
		stackIndex: undefined,
		frameId: parent.frameId,
		flipX: false,
		flipY: false,
		text: parent.text ?? "",
		textColor: parent.textColor ?? parent.stroke,
		fontSize: parent.fontSize ?? 20,
		fontFamily: parent.fontFamily,
		textAlign: parent.textAlign ?? "center",
		verticalAlign: parent.verticalAlign ?? "middle",
		baseline: parent.baseline,
		lineHeight: parent.lineHeight,
		customData: { skedraGeneratedTextFor: parent.id },
	};
	const output = buildBaseExcalidrawElement({
		element: textElement,
		metadata: null,
		originalToCurrentId,
		now,
	});
	output.containerId = parent.id;
	output.customData = { skedraGeneratedTextFor: parent.id };
	return output;
}

/** Builds a valid editable Excalidraw v2 scene from Skedra canvas elements. */
export function createExcalidrawFile(
	elements: Iterable<CanvasElement>,
	options: ExcalidrawExportOptions = {},
): ExcalidrawSceneFile {
	const sourceElements = Array.from(elements);
	const now = options.now ?? Date.now();
	const metadataById = new Map(
		sourceElements.map((element) => [
			element.id,
			readExcalidrawMetadata(element),
		]),
	);
	const originalToCurrentId = new Map<string, string>();
	for (const element of sourceElements) {
		const metadata = metadataById.get(element.id);
		originalToCurrentId.set(
			metadata?.originalElementId ?? element.id,
			element.id,
		);
	}

	const files: Record<string, unknown> = {};
	const exportedElements: Record<string, unknown>[] = [];
	for (const element of sourceElements) {
		const metadata = metadataById.get(element.id) ?? null;
		const hasInlineText =
			element.type !== "text" && (element.text?.length ?? 0) > 0;
		const generatedTextId = hasInlineText
			? `${element.id}__skedra_text`
			: undefined;
		const output = buildBaseExcalidrawElement({
			element,
			metadata,
			originalToCurrentId,
			now,
			generatedTextId,
		});
		exportedElements.push(output);
		if (output.type === "image") {
			const fileId = readString(output.fileId, `skedra-${element.id}`);
			const file = buildImageFile(element, metadata, fileId, now);
			if (file) files[fileId] = file;
		}
		if (generatedTextId) {
			exportedElements.push(
				buildGeneratedTextElement({
					parent: element,
					id: generatedTextId,
					originalToCurrentId,
					now,
				}),
			);
		}
	}

	return {
		type: EXCALIDRAW_FILE_TYPE,
		version: EXCALIDRAW_VERSION,
		source: options.source ?? "https://skedra.app",
		elements: exportedElements,
		appState: {
			gridSize: null,
			viewBackgroundColor: options.canvasBg ?? "#ffffff",
			...(options.viewport
				? {
						scrollX: options.viewport.x,
						scrollY: options.viewport.y,
						zoom: { value: options.viewport.zoom },
					}
				: {}),
		},
		files,
	};
}

export function serializeExcalidrawFile(file: ExcalidrawSceneFile): string {
	return JSON.stringify(file, null, 2);
}

function createExcalidrawClipboardPayload(
	elements: Iterable<CanvasElement>,
	options: ExcalidrawExportOptions = {},
): Record<string, unknown> {
	const scene = createExcalidrawFile(elements, options);
	return {
		type: EXCALIDRAW_CLIPBOARD_TYPE,
		elements: scene.elements,
		files: scene.files,
	};
}

/** Serializes a selection in Excalidraw's native clipboard JSON shape. */
export function serializeExcalidrawClipboard(
	elements: Iterable<CanvasElement>,
	options: ExcalidrawExportOptions = {},
): string {
	return JSON.stringify(createExcalidrawClipboardPayload(elements, options));
}

/** Serializes Skedra's native, lossless clipboard JSON shape. */
export function serializeSkedraClipboard(
	elements: Iterable<CanvasElement>,
): string {
	return JSON.stringify({
		type: SKEDRA_CLIPBOARD_TYPE,
		version: 1,
		elements: Array.from(elements),
	});
}
