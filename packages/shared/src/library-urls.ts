import { SKEDRA_LIB_EXTENSION } from "./skedra-library";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

/** Slug für URLs und DB (Kleinbuchstaben, Bindestriche, max. 64 Zeichen). */
export function normalizeLibrarySlug(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/\.skedralib$/i, "")
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);
}

export function isValidLibrarySlug(slug: string): boolean {
	return SLUG_PATTERN.test(slug);
}

/** Relativer Pfad zur veröffentlichten Bibliothek. */
export function buildPublicLibraryApiPath(slug: string): string {
	const safe = normalizeLibrarySlug(slug);
	return `/api/libraries/${safe}.${SKEDRA_LIB_EXTENSION}`;
}

/** Absolute Download-URL (API-Basis ohne trailing slash). */
export function buildPublicLibraryDownloadUrl(
	apiBaseUrl: string,
	slug: string,
): string {
	const base = apiBaseUrl.replace(/\/$/, "");
	return `${base}${buildPublicLibraryApiPath(slug)}`;
}
