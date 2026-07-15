import { getAbsoluteApiBaseUrl } from "./api-url";
import { createHttpRequestError } from "./request-errors";

export const PROFILE_IMAGE_INPUT_MAX_BYTES = 15 * 1024 * 1024;
export const PROFILE_IMAGE_OUTPUT_MAX_BYTES = 512 * 1024;
const PROFILE_IMAGE_SIZE = 512;
const ACCEPTED_PROFILE_IMAGE_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
]);

export type ProfileImageProcessingErrorCode =
	| "unsupported"
	| "tooLarge"
	| "decode"
	| "compress";

export class ProfileImageProcessingError extends Error {
	constructor(readonly code: ProfileImageProcessingErrorCode) {
		super(code);
		this.name = "ProfileImageProcessingError";
	}
}

async function loadImage(file: File) {
	if ("createImageBitmap" in window) {
		try {
			return await createImageBitmap(file, { imageOrientation: "from-image" });
		} catch {
			// The HTMLImageElement fallback covers browsers/codecs not handled here.
		}
	}

	const objectUrl = URL.createObjectURL(file);
	try {
		const image = new Image();
		image.decoding = "async";
		image.src = objectUrl;
		await image.decode();
		return image;
	} catch {
		throw new ProfileImageProcessingError("decode");
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

function canvasBlob(
	canvas: HTMLCanvasElement,
	type: "image/webp" | "image/jpeg",
	quality: number,
) {
	return new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, type, quality),
	);
}

export async function prepareProfileImage(file: File) {
	if (!ACCEPTED_PROFILE_IMAGE_TYPES.has(file.type)) {
		throw new ProfileImageProcessingError("unsupported");
	}
	if (file.size > PROFILE_IMAGE_INPUT_MAX_BYTES) {
		throw new ProfileImageProcessingError("tooLarge");
	}

	const image = await loadImage(file);
	const width = image.width;
	const height = image.height;
	if (!width || !height) {
		if ("close" in image) image.close();
		throw new ProfileImageProcessingError("decode");
	}

	const canvas = document.createElement("canvas");
	canvas.width = PROFILE_IMAGE_SIZE;
	canvas.height = PROFILE_IMAGE_SIZE;
	const context = canvas.getContext("2d");
	if (!context) {
		if ("close" in image) image.close();
		throw new ProfileImageProcessingError("compress");
	}

	const sourceSize = Math.min(width, height);
	const sourceX = (width - sourceSize) / 2;
	const sourceY = (height - sourceSize) / 2;
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = "high";
	context.drawImage(
		image,
		sourceX,
		sourceY,
		sourceSize,
		sourceSize,
		0,
		0,
		PROFILE_IMAGE_SIZE,
		PROFILE_IMAGE_SIZE,
	);
	if ("close" in image) image.close();

	for (const quality of [0.88, 0.78, 0.68, 0.58]) {
		const blob = await canvasBlob(canvas, "image/webp", quality);
		if (
			blob &&
			blob.type === "image/webp" &&
			blob.size <= PROFILE_IMAGE_OUTPUT_MAX_BYTES
		) {
			return new File([blob], "profile.webp", { type: blob.type });
		}
	}

	// WebP is broadly available, but JPEG keeps the upload usable in older engines.
	context.globalCompositeOperation = "destination-over";
	context.fillStyle = "#ffffff";
	context.fillRect(0, 0, canvas.width, canvas.height);
	for (const quality of [0.82, 0.7, 0.58]) {
		const blob = await canvasBlob(canvas, "image/jpeg", quality);
		if (blob && blob.size <= PROFILE_IMAGE_OUTPUT_MAX_BYTES) {
			return new File([blob], "profile.jpg", { type: "image/jpeg" });
		}
	}

	throw new ProfileImageProcessingError("compress");
}

async function readJsonResponse(response: Response) {
	const payload = await response.json().catch(() => null);
	if (!response.ok) {
		throw createHttpRequestError(
			response.status,
			payload,
			"Profile image request failed",
		);
	}
	return payload as { image: string | null };
}

export async function uploadProfileImage(file: File) {
	const formData = new FormData();
	formData.set("file", file);
	const response = await fetch(`${getAbsoluteApiBaseUrl()}/api/profile-image`, {
		method: "POST",
		credentials: "include",
		body: formData,
	});
	return readJsonResponse(response);
}

export async function deleteProfileImage() {
	const response = await fetch(`${getAbsoluteApiBaseUrl()}/api/profile-image`, {
		method: "DELETE",
		credentials: "include",
	});
	return readJsonResponse(response);
}
