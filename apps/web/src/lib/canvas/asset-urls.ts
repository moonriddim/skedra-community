import { base64UrlToBytes, bytesToBase64Url } from "@/lib/e2ee";
import type { EncryptedAssetReference } from "@skedra/canvas-core";

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
	let url: URL;
	try {
		url = new URL(src, "https://skedra.local");
	} catch {
		return null;
	}
	if (/^https?:\/\//iu.test(src) && url.origin !== window.location.origin) {
		return null;
	}

	if (url.pathname.startsWith(API_ASSET_PATH_PREFIX)) {
		return url;
	}

	const legacyAssetId = url.pathname.match(LEGACY_OBJECT_ASSET_PATTERN)?.[1];
	if (!legacyAssetId) return null;
	const proxyUrl = new URL(
		`${API_ASSET_PATH_PREFIX}${legacyAssetId}`,
		"https://skedra.local",
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
	return `${url.pathname}${url.search}${url.hash}`;
}

export function buildEncryptedAssetReference(
	url: string,
	reference: EncryptedAssetReference,
) {
	const parsedUrl = new URL(url, window.location.origin);
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
			!parsed.mimeType.startsWith("image/") ||
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

export function registerLocalEncryptedAssetPreview(src: string, file: File) {
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
