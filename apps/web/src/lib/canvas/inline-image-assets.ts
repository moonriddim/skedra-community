/**
 * Lagert direkt im Board gespeicherte Bilder (data:-URLs) als Assets aus.
 *
 * Bilder aus SVG-Dateien, Excalidraw-Importen, Paste oder Bibliotheken kommen
 * als base64-data:-URL. Im Board-Dokument kostet das rund 33 % mehr als die
 * Datei selbst, landet in jedem Update, jedem Snapshot und jedem Seitenladen.
 * Hochgeladene Assets stehen dagegen nur als kurzer, verschlüsselter Verweis im
 * Board (ähnlich wie Excalidraw Bilder als separate „files“ speichert).
 *
 * Alles hier ist best effort: Scheitert ein Upload (kein Speicher, Limit,
 * Netzwerk), bleibt das Bild wie bisher inline erhalten.
 */

import type { CanvasElement } from "@skedra/canvas-core";
import {
	type ImageUploadOptions,
	uploadEncryptedCanvasAsset,
} from "./image-utils";

/**
 * Kleinere Bilder (Icons) bleiben inline: Ein eigener Request pro Mini-Grafik
 * kostet mehr, als er spart, und würde das Upload-Rate-Limit belasten.
 */
export const INLINE_IMAGE_UPLOAD_MIN_CHARS = 16 * 1024;

/** Gleichzeitige Uploads beim Import vieler Bilder. */
const UPLOAD_CONCURRENCY = 3;

type UploadFn = typeof uploadEncryptedCanvasAsset;

/** Liest `customData.imageSrc`, das Feld, in dem Bild-Elemente ihre Quelle tragen. */
function readImageSrc(element: CanvasElement) {
	const src = (element.customData as Record<string, unknown> | undefined)
		?.imageSrc;
	return typeof src === "string" ? src : null;
}

/** True für data:-URLs von Bildern, die groß genug zum Auslagern sind. */
export function isExternalizableImageSrc(src: string | null | undefined) {
	return (
		typeof src === "string" &&
		src.length >= INLINE_IMAGE_UPLOAD_MIN_CHARS &&
		/^data:image\//i.test(src)
	);
}

/** Enthält die Liste Bild-Elemente, die sich auszulagern lohnen? */
export function hasExternalizableInlineImages(elements: CanvasElement[]) {
	return elements.some(
		(element) =>
			element.type === "image" &&
			isExternalizableImageSrc(readImageSrc(element)),
	);
}

/**
 * Wandelt eine data:-URL (base64 oder prozentkodiert) in eine Datei um.
 * Gibt `null` für ungültige oder nicht-bildliche URLs zurück.
 */
export function dataUrlToFile(dataUrl: string, name = "image") {
	const comma = dataUrl.indexOf(",");
	if (!dataUrl.startsWith("data:") || comma < 0) return null;
	const header = dataUrl.slice(5, comma);
	const [mimeType = "", ...params] = header.split(";");
	if (!/^image\/[a-z0-9.+-]+$/i.test(mimeType)) return null;
	const payload = dataUrl.slice(comma + 1);
	try {
		const bytes = params.some((param) => param.toLowerCase() === "base64")
			? Uint8Array.from(atob(payload), (char) => char.charCodeAt(0))
			: new TextEncoder().encode(decodeURIComponent(payload));
		const extension = mimeType.split("/")[1]?.split("+")[0] ?? "img";
		return new File([bytes], `${name}.${extension}`, {
			type: mimeType.toLowerCase(),
		});
	} catch {
		return null;
	}
}

/**
 * Lädt eine einzelne data:-URL als Asset hoch.
 * Rückgabe `null`, wenn kein Speicher aktiv ist, die URL nicht passt oder der
 * Upload scheitert – dann bleibt die data:-URL in Gebrauch.
 */
export async function externalizeInlineImageSrc(
	src: string,
	options: ImageUploadOptions | undefined,
	upload: UploadFn = uploadEncryptedCanvasAsset,
) {
	if (!options?.objectStorageEnabled || !isExternalizableImageSrc(src)) {
		return null;
	}
	const file = dataUrlToFile(src);
	if (!file) return null;
	if (options.maxImageBytes && file.size > options.maxImageBytes) return null;
	try {
		return await upload(file, options);
	} catch {
		return null;
	}
}

/**
 * Ersetzt große Inline-Bilder in Elementen durch Asset-Verweise, bevor die
 * Elemente ins Board geschrieben werden. Gleiche Bilder werden nur einmal
 * hochgeladen (wie Excalidraws fileId-Deduplizierung). Nach dem ersten
 * gescheiterten Upload wird nicht weiter versucht (meist Limit/kein Netz).
 */
export async function externalizeInlineImageElements(
	elements: CanvasElement[],
	options: ImageUploadOptions | undefined,
	upload: UploadFn = uploadEncryptedCanvasAsset,
): Promise<CanvasElement[]> {
	if (!options?.objectStorageEnabled) return elements;
	const sources = [
		...new Set(
			elements
				.filter((element) => element.type === "image")
				.map(readImageSrc)
				.filter(isExternalizableImageSrc),
		),
	] as string[];
	if (sources.length === 0) return elements;

	const uploaded = new Map<string, { src: string; assetId: string }>();
	let failed = false;
	let next = 0;
	const worker = async () => {
		while (!failed && next < sources.length) {
			const source = sources[next++];
			const result = await externalizeInlineImageSrc(source, options, upload);
			if (result) uploaded.set(source, result);
			else failed = true;
		}
	};
	await Promise.all(
		Array.from(
			{ length: Math.min(UPLOAD_CONCURRENCY, sources.length) },
			worker,
		),
	);
	if (uploaded.size === 0) return elements;

	return elements.map((element) => {
		const src = readImageSrc(element);
		const asset = element.type === "image" && src ? uploaded.get(src) : null;
		if (!asset) return element;
		return {
			...element,
			customData: {
				...(element.customData ?? {}),
				imageSrc: asset.src,
				assetId: asset.assetId,
			},
		};
	});
}
