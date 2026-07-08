import type { CanvasElement } from "./types";

export interface ImageCropRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface ImageCropMeta {
	naturalWidth: number;
	naturalHeight: number;
	crop: ImageCropRect;
}

const DEFAULT_CROP: ImageCropRect = { x: 0, y: 0, width: 1, height: 1 };

function getImageCropMeta(element: CanvasElement): ImageCropMeta | null {
	if (element.type !== "image") return null;
	const custom = element.customData ?? {};
	const naturalWidth = Number(custom.naturalWidth) || element.width;
	const naturalHeight = Number(custom.naturalHeight) || element.height;
	const rawCrop = custom.imageCrop as Partial<ImageCropRect> | undefined;
	const crop: ImageCropRect = {
		x: rawCrop?.x ?? 0,
		y: rawCrop?.y ?? 0,
		width: rawCrop?.width ?? 1,
		height: rawCrop?.height ?? 1,
	};
	return { naturalWidth, naturalHeight, crop };
}

export function clampCropRect(crop: ImageCropRect): ImageCropRect {
	const width = Math.max(0.05, Math.min(1, crop.width));
	const height = Math.max(0.05, Math.min(1, crop.height));
	const x = Math.max(0, Math.min(1 - width, crop.x));
	const y = Math.max(0, Math.min(1 - height, crop.y));
	return { x, y, width, height };
}

export function getCropBoundsInElementSpace(
	element: CanvasElement,
): ImageCropRect {
	const meta = getImageCropMeta(element);
	if (!meta) return DEFAULT_CROP;
	return {
		x: meta.crop.x * element.width,
		y: meta.crop.y * element.height,
		width: meta.crop.width * element.width,
		height: meta.crop.height * element.height,
	};
}

export function buildCroppedImageUpdate(
	element: CanvasElement,
	crop: ImageCropRect,
): Partial<CanvasElement> {
	const meta = getImageCropMeta(element);
	if (!meta) return {};

	const nextCrop = clampCropRect(crop);
	const cropPixelW = nextCrop.width * meta.naturalWidth;
	const cropPixelH = nextCrop.height * meta.naturalHeight;
	const aspect = cropPixelW / Math.max(1, cropPixelH);
	const displayHeight = element.height * nextCrop.height;
	const displayWidth = displayHeight * aspect;

	return {
		x: element.x + nextCrop.x * element.width,
		y: element.y + nextCrop.y * element.height,
		width: Math.max(24, displayWidth),
		height: Math.max(24, displayHeight),
		customData: {
			...(element.customData ?? {}),
			naturalWidth: meta.naturalWidth,
			naturalHeight: meta.naturalHeight,
			imageCrop: nextCrop,
		},
	};
}

export function getImageRenderGeometry(element: CanvasElement) {
	const meta = getImageCropMeta(element);
	const src =
		(typeof element.customData?.imageSrc === "string"
			? element.customData.imageSrc
			: "") ?? "";
	if (!meta || !src) {
		return {
			src,
			x: element.x,
			y: element.y,
			width: element.width,
			height: element.height,
			clipId: null as string | null,
			clipRect: null as {
				x: number;
				y: number;
				width: number;
				height: number;
			} | null,
			imageX: element.x,
			imageY: element.y,
			imageWidth: element.width,
			imageHeight: element.height,
		};
	}

	const crop = meta.crop;
	if (crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1) {
		return {
			src,
			x: element.x,
			y: element.y,
			width: element.width,
			height: element.height,
			clipId: null,
			clipRect: null,
			imageX: element.x,
			imageY: element.y,
			imageWidth: element.width,
			imageHeight: element.height,
		};
	}

	const scaleX = element.width / (crop.width * meta.naturalWidth);
	const scaleY = element.height / (crop.height * meta.naturalHeight);
	const imageWidth = meta.naturalWidth * scaleX;
	const imageHeight = meta.naturalHeight * scaleY;

	return {
		src,
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
		clipId: `crop-${element.id}`,
		clipRect: {
			x: element.x,
			y: element.y,
			width: element.width,
			height: element.height,
		},
		imageX: element.x - crop.x * meta.naturalWidth * scaleX,
		imageY: element.y - crop.y * meta.naturalHeight * scaleY,
		imageWidth,
		imageHeight,
	};
}
