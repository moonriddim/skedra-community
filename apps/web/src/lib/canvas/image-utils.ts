/**
 * Hilfsfunktionen fuer Bilder im Canvas und in Kanban-Dialogen.
 */

import { encryptImageAsset } from "@skedra/canvas-core";
import {
	buildEncryptedAssetReference,
	registerLocalEncryptedAssetPreview,
} from "./asset-urls";

export interface PickedImage {
	src: string;
	assetId?: string;
	width: number;
	height: number;
	name: string;
	sizeBytes?: number;
	storage?: "inline" | "object";
}

export interface ImageUploadOptions {
	whiteboardId?: string;
	objectStorageEnabled?: boolean;
	maxImageBytes?: number;
	e2eeKey?: string | null;
	encryptionMode?: "server" | "e2ee";
	collabShareToken?: string;
}

export function fitImageSize(
	width: number,
	height: number,
	maxWidth: number,
	maxHeight: number,
): { width: number; height: number } {
	if (width <= 0 || height <= 0) return { width: maxWidth, height: maxHeight };
	const scale = Math.min(maxWidth / width, maxHeight / height, 1);
	return {
		width: Math.round(width * scale),
		height: Math.round(height * scale),
	};
}

export async function pickImageFile(
	uploadOptions?: ImageUploadOptions,
): Promise<PickedImage | null> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.style.display = "none";
		document.body.appendChild(input);

		const cleanup = () => {
			input.value = "";
			document.body.removeChild(input);
		};

		input.addEventListener(
			"change",
			async () => {
				const file = input.files?.[0];
				if (!file) {
					cleanup();
					resolve(null);
					return;
				}

				try {
					const result = await readImageFile(file, uploadOptions);
					cleanup();
					resolve(result);
				} catch {
					cleanup();
					resolve(null);
				}
			},
			{ once: true },
		);

		input.click();
	});
}

export async function pickImageFiles(
	uploadOptions?: ImageUploadOptions,
): Promise<PickedImage[]> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.multiple = true;
		input.style.display = "none";
		document.body.appendChild(input);

		const cleanup = () => {
			input.value = "";
			document.body.removeChild(input);
		};

		input.addEventListener(
			"change",
			async () => {
				const files = Array.from(input.files ?? []);
				if (files.length === 0) {
					cleanup();
					resolve([]);
					return;
				}

				try {
					const result = await Promise.all(
						files.map((file) => readImageFile(file, uploadOptions)),
					);
					cleanup();
					resolve(result);
				} catch {
					cleanup();
					resolve([]);
				}
			},
			{ once: true },
		);

		input.click();
	});
}

async function readImageFile(
	file: File,
	uploadOptions?: ImageUploadOptions,
): Promise<PickedImage> {
	if (
		uploadOptions?.objectStorageEnabled &&
		uploadOptions.maxImageBytes &&
		file.size > uploadOptions.maxImageBytes
	) {
		throw new Error("IMAGE_TOO_LARGE");
	}
	const dimensions = await loadImageFileDimensions(file);
	const uploaded = await uploadEncryptedImageAsset(file, uploadOptions);
	if (uploaded) {
		return {
			src: uploaded.src,
			assetId: uploaded.assetId,
			width: dimensions.width,
			height: dimensions.height,
			name: file.name,
			sizeBytes: file.size,
			storage: "object",
		};
	}
	const src = await fileToDataUrl(file);
	return {
		src,
		width: dimensions.width,
		height: dimensions.height,
		name: file.name,
		sizeBytes: file.size,
		storage: "inline",
	};
}

async function uploadEncryptedImageAsset(
	file: File,
	options?: ImageUploadOptions,
): Promise<{ src: string; assetId: string } | null> {
	if (
		!options?.objectStorageEnabled ||
		!options.whiteboardId ||
		(options.encryptionMode !== "server" && !options.e2eeKey)
	) {
		return null;
	}
	const assetId = crypto.randomUUID();
	const encrypted = await encryptImageAsset({
		file,
		boardKey: options.encryptionMode === "server" ? null : options.e2eeKey,
		whiteboardId: options.whiteboardId,
		assetId,
	});
	const formData = new FormData();
	formData.set("assetId", assetId);
	formData.set("whiteboardId", options.whiteboardId);
	formData.set("plaintextSize", String(file.size));
	formData.set("encryptionVersion", String(encrypted.reference.v));
	if (options.collabShareToken) {
		formData.set("collabShareToken", options.collabShareToken);
	}
	formData.set(
		"file",
		new File([encrypted.ciphertext], `${assetId}.e2ee`, {
			type: "application/octet-stream",
		}),
	);

	const response = await fetch("/api/assets/images", {
		method: "POST",
		body: formData,
		credentials: "include",
	});
	if (!response.ok) throw new Error("IMAGE_UPLOAD_FAILED");
	const uploaded = (await response.json()) as { id: string; url: string };
	const src = buildEncryptedAssetReference(uploaded.url, encrypted.reference);
	registerLocalEncryptedAssetPreview(src, file);
	return {
		assetId: uploaded.id,
		src,
	};
}

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error);
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.readAsDataURL(file);
	});
}

function loadImageDimensions(
	src: string,
): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () =>
			resolve({ width: image.naturalWidth, height: image.naturalHeight });
		image.onerror = reject;
		image.src = src;
	});
}

function loadImageFileDimensions(
	file: File,
): Promise<{ width: number; height: number }> {
	const url = URL.createObjectURL(file);
	return loadImageDimensions(url).finally(() => URL.revokeObjectURL(url));
}
