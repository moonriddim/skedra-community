import { getApiUrl } from "@/lib/api-url";
import { base64UrlToBytes, bytesToBase64Url } from "@/lib/e2ee";
import type { EncryptedAssetReference } from "@skedra/canvas-core";
import { isCanvasAttachmentMimeType } from "@skedra/canvas-core";

export interface AssetAccessTokens {
	presentationShareToken?: string;
	collabShareToken?: string;
	embedShareToken?: string;
}

const API_ASSET_PATH_PREFIX = "/api/assets/";
const ENCRYPTED_ASSET_FRAGMENT_KEY = "skedraAsset";
const UUID_PATTERN =
	"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const LEGACY_OBJECT_ASSET_PATTERN = new RegExp(
	`/whiteboards/[^/]+/images/(${UUID_PATTERN})(?:-|\\.|$)`,
	"i",
);
const localEncryptedAssetPreviews = new Map<string, string>();

export function hasAssetAccessTokens(tokens?: AssetAccessTokens | null) {
	return Boolean(
		tokens?.presentationShareToken ||
			tokens?.collabShareToken ||
			tokens?.embedShareToken,
	);
}

function createAssetProxyUrl(src: string) {
	const appOrigin = window.location.origin;
	const apiOrigin = new URL(getApiUrl("/"), appOrigin).origin;
	let url: URL;
	try {
		url = new URL(src, apiOrigin);
	} catch {
		return null;
	}
	if (
		/^https?:\/\//iu.test(src) &&
		url.origin !== appOrigin &&
		url.origin !== apiOrigin
	) {
		return null;
	}

	if (url.pathname.startsWith(API_ASSET_PATH_PREFIX)) {
		return url;
	}

	const legacyAssetId = url.pathname.match(LEGACY_OBJECT_ASSET_PATTERN)?.[1];
	if (!legacyAssetId) return null;
	const proxyUrl = new URL(
		`${API_ASSET_PATH_PREFIX}${legacyAssetId}`,
		apiOrigin,
	);
	proxyUrl.hash = url.hash;
	return proxyUrl;
}

export function withAssetAccessParams(
	src: string,
	tokens?: AssetAccessTokens | null,
) {
	if (!src) return src;
	const url = createAssetProxyUrl(src);
	if (!url) return src;
	if (tokens?.collabShareToken) {
		url.searchParams.set("collabShareToken", tokens.collabShareToken);
	}
	if (tokens?.presentationShareToken) {
		url.searchParams.set(
			"presentationShareToken",
			tokens.presentationShareToken,
		);
	}
	if (tokens?.embedShareToken) {
		url.searchParams.set("embedShareToken", tokens.embedShareToken);
	}
	return url.origin === window.location.origin
		? `${url.pathname}${url.search}${url.hash}`
		: url.toString();
}

export function buildEncryptedAssetReference(
	url: string,
	reference: EncryptedAssetReference,
) {
	const parsedUrl = new URL(
		url,
		new URL(getApiUrl("/"), window.location.origin),
	);
	const hash = new URLSearchParams(parsedUrl.hash.replace(/^#/u, ""));
	hash.set(
		ENCRYPTED_ASSET_FRAGMENT_KEY,
		bytesToBase64Url(new TextEncoder().encode(JSON.stringify(reference))),
	);
	parsedUrl.hash = hash.toString();
	return parsedUrl.origin === window.location.origin
		? `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
		: parsedUrl.toString();
}

export function parseEncryptedAssetReference(src: string): {
	url: string;
	reference: EncryptedAssetReference;
} | null {
	let url: URL;
	try {
		url = new URL(src, window.location.origin);
	} catch {
		return null;
	}
	const encoded = new URLSearchParams(url.hash.replace(/^#/u, "")).get(
		ENCRYPTED_ASSET_FRAGMENT_KEY,
	);
	if (!encoded) return null;
	try {
		const parsed = JSON.parse(
			new TextDecoder().decode(base64UrlToBytes(encoded)),
		) as Partial<EncryptedAssetReference>;
		if (
			parsed.v !== 1 ||
			typeof parsed.assetId !== "string" ||
			!new RegExp(`^${UUID_PATTERN}$`, "i").test(parsed.assetId) ||
			typeof parsed.iv !== "string" ||
			typeof parsed.mimeType !== "string" ||
			!isCanvasAttachmentMimeType(parsed.mimeType) ||
			(parsed.key !== undefined && typeof parsed.key !== "string")
		) {
			return null;
		}
		url.hash = "";
		return {
			url: url.toString(),
			reference: parsed as EncryptedAssetReference,
		};
	} catch {
		return null;
	}
}

/** SVG kann Skripte enthalten; siehe `createDecryptedAssetUrl`. */
export function isSvgMimeType(mimeType: string) {
	return mimeType.split(";")[0].trim().toLowerCase() === "image/svg+xml";
}

function bytesToBase64(bytes: Uint8Array) {
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
	}
	return btoa(binary);
}

/**
 * Erzeugt die lokale Anzeige-URL für ein entschlüsseltes Asset.
 *
 * Rasterbilder bekommen eine blob:-URL (speicherschonend). SVGs bekommen eine
 * data:-URL: Eine blob:-URL erbt die Origin der App. Würde jemand ein
 * präpariertes SVG über „Bild in neuem Tab öffnen“ direkt aufrufen, liefen
 * dessen Skripte mit Zugriff auf die Sitzung. data:-URLs haben eine eigene,
 * undurchsichtige Origin, und Browser blockieren die direkte Navigation dorthin.
 * Als <img>/<image> eingebunden führt ein SVG ohnehin keine Skripte aus.
 * `URL.revokeObjectURL` ist für data:-URLs ein harmloser No-op.
 */
export function createDecryptedAssetUrl(
	plaintext: ArrayBuffer,
	mimeType: string,
) {
	if (isSvgMimeType(mimeType)) {
		return `data:image/svg+xml;base64,${bytesToBase64(new Uint8Array(plaintext))}`;
	}
	return URL.createObjectURL(new Blob([plaintext], { type: mimeType }));
}

export function registerLocalEncryptedAssetPreview(src: string, file: File) {
	// Keine same-origin-blob:-URL für SVGs (siehe `createDecryptedAssetUrl`);
	// die Anzeige entschlüsselt das hochgeladene Asset dann regulär.
	if (isSvgMimeType(file.type)) return;
	const previous = localEncryptedAssetPreviews.get(src);
	if (previous) URL.revokeObjectURL(previous);
	localEncryptedAssetPreviews.set(src, URL.createObjectURL(file));
}

export function getLocalEncryptedAssetPreview(src: string) {
	return localEncryptedAssetPreviews.get(src) ?? null;
}

export function releaseLocalEncryptedAssetPreview(src: string) {
	const preview = localEncryptedAssetPreviews.get(src);
	if (!preview) return;
	URL.revokeObjectURL(preview);
	localEncryptedAssetPreviews.delete(src);
}
