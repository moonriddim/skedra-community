import {
	decodeCanvasElements,
	encodeCanvasElements,
} from "@/lib/canvas/canvas-codecs";
import type {
	CanvasElement,
	SavedCanvasView,
	Viewport,
} from "@skedra/canvas-core";
import { getBBox } from "@skedra/canvas-core";
import {
	type PresentationFrameContent,
	type PresentationRelativeCamera,
	presentationFrameContentSchema,
} from "@skedra/shared";

type ViewportSize = { width: number; height: number };
const UUID_SOURCE =
	"[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const STORED_ASSET_PATH_PATTERN = new RegExp(
	`(?:/api/assets/|/images/)(${UUID_SOURCE})`,
	"giu",
);

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function copyVisibleScalar(
	source: Record<string, unknown>,
	target: Record<string, unknown>,
	key: string,
	maxStringLength = 500,
) {
	const value = source[key];
	if (typeof value === "string") {
		target[key] = value.slice(0, maxStringLength);
	} else if (typeof value === "number" && Number.isFinite(value)) {
		target[key] = value;
	} else if (typeof value === "boolean") {
		target[key] = value;
	}
}

/** Apply presenter-only draft elements over the synced scene before sanitizing. */
export function mergePresentationFrameElements(
	elements: Iterable<CanvasElement>,
	previews: Iterable<CanvasElement | null | undefined>,
): CanvasElement[] {
	const merged = new Map<string, CanvasElement>();
	for (const element of elements) merged.set(element.id, element);
	for (const preview of previews) {
		if (preview) merged.set(preview.id, preview);
	}
	return Array.from(merged.values());
}

/** Remove editor-only metadata while retaining what the read-only renderer shows. */
export function sanitizePresentationElement(
	element: CanvasElement,
): CanvasElement {
	const { link: _hiddenLink, customData, ...base } = element;
	if (!customData) return base;
	const visible: Record<string, unknown> = {};
	for (const key of [
		"skedraType",
		"imageSrc",
		"imageAlt",
		"naturalWidth",
		"naturalHeight",
		"stickyNoteMode",
		"templateAccent",
		"arrowTextOrientation",
		"arrowTextSide",
		"excalidrawImport",
		"excalidrawSeed",
		"headerImageSrc",
		"priority",
		"startDate",
		"dueDate",
		"dueComplete",
		"assigneeName",
		"roleName",
		"groupName",
		"roleColor",
		"groupColor",
	]) {
		copyVisibleScalar(customData, visible, key, 1_000);
	}
	if (typeof customData.description === "string") {
		visible.description = customData.description.slice(0, 300);
	}
	if (isRecord(customData.imageCrop)) {
		const imageCrop = customData.imageCrop;
		visible.imageCrop = Object.fromEntries(
			["x", "y", "width", "height"].flatMap((key) => {
				const value = imageCrop[key];
				return typeof value === "number" && Number.isFinite(value)
					? [[key, value]]
					: [];
			}),
		);
	}
	if (isRecord(customData.headerImageFocus)) {
		visible.headerImageFocus = {
			x: customData.headerImageFocus.x,
			y: customData.headerImageFocus.y,
		};
	}
	if (isRecord(customData.coverImage)) {
		const src = customData.coverImage.src;
		if (typeof src === "string") {
			visible.coverImage = {
				id: "presentation-cover",
				src,
				name:
					typeof customData.coverImage.name === "string"
						? customData.coverImage.name.slice(0, 300)
						: "",
				width:
					typeof customData.coverImage.width === "number"
						? customData.coverImage.width
						: 0,
				height:
					typeof customData.coverImage.height === "number"
						? customData.coverImage.height
						: 0,
			};
		}
	}
	if (Array.isArray(customData.checklist)) {
		visible.checklist = customData.checklist
			.slice(0, 500)
			.map((item, index) => {
				const record = isRecord(item) ? item : {};
				return {
					id: `presentation-check-${index}`,
					text:
						index < 3 && typeof record.text === "string"
							? record.text.slice(0, 240)
							: "",
					completed: record.completed === true,
				};
			});
	}
	if (Array.isArray(customData.stickyChecklist)) {
		visible.stickyChecklist = customData.stickyChecklist
			.slice(0, 12)
			.map((item, index) => {
				const record = isRecord(item) ? item : {};
				return {
					id: `presentation-sticky-${index}`,
					text:
						typeof record.text === "string" ? record.text.slice(0, 240) : "",
					completed: record.completed === true,
				};
			});
	}
	if (Array.isArray(customData.attachments)) {
		visible.attachments = customData.attachments
			.slice(0, 500)
			.map((_, index) => ({
				id: `presentation-attachment-${index}`,
				src: "presentation:attachment",
				name: "",
				width: 0,
				height: 0,
			}));
	}
	return { ...base, customData: visible };
}

export function getPresentationFrameAssetIds(frame: PresentationFrameContent) {
	const ids = new Set<string>();
	for (const match of JSON.stringify(frame.elements).matchAll(
		STORED_ASSET_PATH_PATTERN,
	)) {
		ids.add(match[1].toLowerCase());
	}
	return Array.from(ids);
}

export function elementIntersectsSlide(
	element: CanvasElement,
	slide: SavedCanvasView,
) {
	const bounds = getBBox(element);
	return (
		bounds.x < slide.x + slide.width &&
		bounds.x + bounds.width > slide.x &&
		bounds.y < slide.y + slide.height &&
		bounds.y + bounds.height > slide.y
	);
}

export function createPresentationRelativeCamera(
	viewport: Viewport,
	viewportSize: ViewportSize,
	slide: SavedCanvasView,
): PresentationRelativeCamera {
	const safeWidth = Math.max(slide.width, 1);
	const safeHeight = Math.max(slide.height, 1);
	const centerCanvasX = (viewportSize.width / 2 - viewport.x) / viewport.zoom;
	const centerCanvasY = (viewportSize.height / 2 - viewport.y) / viewport.zoom;
	return {
		centerX: (centerCanvasX - slide.x) / safeWidth,
		centerY: (centerCanvasY - slide.y) / safeHeight,
		visibleWidth: viewportSize.width / viewport.zoom / safeWidth,
		visibleHeight: viewportSize.height / viewport.zoom / safeHeight,
	};
}

export function viewportFromPresentationCamera(
	camera: PresentationRelativeCamera,
	viewportSize: ViewportSize,
	slide: SavedCanvasView,
): Viewport {
	const visibleCanvasWidth = Math.max(slide.width * camera.visibleWidth, 1);
	const visibleCanvasHeight = Math.max(slide.height * camera.visibleHeight, 1);
	const zoom = Math.min(
		viewportSize.width / visibleCanvasWidth,
		viewportSize.height / visibleCanvasHeight,
	);
	const centerCanvasX = slide.x + slide.width * camera.centerX;
	const centerCanvasY = slide.y + slide.height * camera.centerY;
	return {
		x: viewportSize.width / 2 - centerCanvasX * zoom,
		y: viewportSize.height / 2 - centerCanvasY * zoom,
		zoom,
	};
}

export function createPresentationFrameContent(input: {
	slide: SavedCanvasView;
	slideIndex: number;
	totalSlides: number;
	elements: Iterable<CanvasElement>;
	viewport: Viewport;
	viewportSize: ViewportSize;
}): PresentationFrameContent {
	const visibleElements = Array.from(input.elements)
		.filter((element) => elementIntersectsSlide(element, input.slide))
		.map(sanitizePresentationElement);
	return presentationFrameContentSchema.parse({
		version: 1,
		slide: {
			id: input.slide.id,
			name: input.slide.name,
			index: input.slideIndex,
			total: input.totalSlides,
			x: input.slide.x,
			y: input.slide.y,
			width: input.slide.width,
			height: input.slide.height,
			aspectRatio: input.slide.aspectRatio,
		},
		elements: encodeCanvasElements(visibleElements),
		camera: createPresentationRelativeCamera(
			input.viewport,
			input.viewportSize,
			input.slide,
		),
	});
}

export function decodePresentationFrameContent(value: unknown) {
	const parsed = presentationFrameContentSchema.parse(value);
	const elements = decodeCanvasElements(parsed.elements);
	if (elements.length !== parsed.elements.length) {
		throw new Error("Presentation frame contains invalid elements");
	}
	const view: SavedCanvasView = {
		id: parsed.slide.id,
		name: parsed.slide.name,
		x: parsed.slide.x,
		y: parsed.slide.y,
		width: parsed.slide.width,
		height: parsed.slide.height,
		createdAt: 0,
		updatedAt: 0,
		order: parsed.slide.index,
		aspectRatio: parsed.slide.aspectRatio,
	};
	return { ...parsed, elements, view };
}
