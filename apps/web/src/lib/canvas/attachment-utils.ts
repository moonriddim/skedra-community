import {
	canvasBlobToDataUrl,
	loadCanvasImageBlobDimensions,
} from "@skedra/canvas-io/browser-images";
import {
	type ImageUploadOptions,
	uploadEncryptedCanvasAsset,
} from "./image-utils";

import { getCanvasAttachmentMimeType } from "@skedra/canvas-core";

export async function readCanvasAttachmentFile(
	file: File,
	options?: ImageUploadOptions,
) {
	if (file.size > (options?.maxImageBytes ?? 10 * 1024 * 1024))
		throw new Error("ATTACHMENT_TOO_LARGE");
	const mimeType = getCanvasAttachmentMimeType({
		name: file.name,
		mimeType: file.type,
	});
	const normalized = new File([file], file.name, { type: mimeType });
	const dimensions = mimeType.startsWith("image/")
		? await loadCanvasImageBlobDimensions(normalized)
		: { width: 0, height: 0 };
	const uploaded = await uploadEncryptedCanvasAsset(normalized, options);
	return {
		src: uploaded?.src ?? (await canvasBlobToDataUrl(normalized)),
		name: file.name,
		...dimensions,
		mimeType,
		sizeBytes: file.size,
	};
}

/** Data URLs cannot be navigated reliably on mobile; use a typed Blob URL. */
export function createAttachmentBlobUrl(src: string, mimeType: string): string {
	const comma = src.indexOf(",");
	if (!src.startsWith("data:") || comma < 0)
		throw new Error("INVALID_ATTACHMENT");
	const header = src.slice(0, comma);
	const encoded = src.slice(comma + 1);
	const bytes = /;base64$/i.test(header)
		? Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
		: new TextEncoder().encode(decodeURIComponent(encoded));
	return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}
