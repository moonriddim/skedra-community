/**
 * URLs für den Katalog (libraries.skedra.xyz) und Deep-Links in die Skedra-App.
 */

import {
	buildPublicLibraryDownloadUrl as buildLibraryDownloadUrl,
	normalizeLibrarySlug,
} from "@skedra/shared";
import { getRuntimeConfigValue } from "./runtime-config";

function resolveEnvUrl(
	envValue: string | undefined,
	fallback: string | (() => string),
): string {
	const configured = envValue?.trim();
	if (configured) return configured.replace(/\/$/, "");
	return typeof fallback === "function" ? fallback() : fallback;
}

function getApiBaseUrl() {
	return resolveEnvUrl(
		getRuntimeConfigValue("API_URL") || import.meta.env.VITE_API_URL,
		typeof window !== "undefined" ? () => window.location.origin : "",
	);
}

export function getLibrariesSiteUrl() {
	return resolveEnvUrl(
		getRuntimeConfigValue("LIBRARIES_URL") ||
			import.meta.env.VITE_LIBRARIES_URL,
		typeof window !== "undefined" ? () => window.location.origin : "",
	);
}

export function getSkedraAppUrl() {
	return resolveEnvUrl(
		getRuntimeConfigValue("APP_URL") || import.meta.env.VITE_APP_URL,
		"http://localhost:5174",
	);
}

export function buildPublicLibraryDownloadUrl(slug: string) {
	return buildLibraryDownloadUrl(getApiBaseUrl(), slug);
}

export function buildAddToSkedraUrl(
	slug: string,
	options?: { referrer?: string },
) {
	const app = getSkedraAppUrl();
	const params = new URLSearchParams({ library: normalizeLibrarySlug(slug) });
	if (options?.referrer) {
		params.set("referrer", options.referrer);
	}
	return `${app}/?${params.toString()}`;
}

export function buildLibraryCatalogEntryUrl(slug: string) {
	const params = new URLSearchParams({ library: normalizeLibrarySlug(slug) });
	return `${getLibrariesSiteUrl()}/?${params.toString()}`;
}

export function buildPublishInAppUrl() {
	return `${getSkedraAppUrl()}/login?redirect=${encodeURIComponent("/library")}`;
}
