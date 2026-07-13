import { getRuntimeConfigValue } from "@/lib/runtime-config";

function normalizeBaseUrl(value: string | null | undefined) {
	return value?.trim().replace(/\/+$/u, "") ?? "";
}

export function resolveApiBaseUrl(
	runtimeValue: string | null | undefined,
	buildTimeValue: string | null | undefined,
) {
	return normalizeBaseUrl(runtimeValue) || normalizeBaseUrl(buildTimeValue);
}

export function joinApiUrl(baseUrl: string, path: string) {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
}

export function toWebSocketUrl(httpUrl: string, pageOrigin: string) {
	const url = new URL(httpUrl, pageOrigin);
	if (url.protocol === "https:") url.protocol = "wss:";
	else if (url.protocol === "http:") url.protocol = "ws:";
	else throw new Error(`Unsupported API protocol: ${url.protocol}`);
	return url.toString();
}

export function getApiBaseUrl() {
	return resolveApiBaseUrl(
		getRuntimeConfigValue("API_URL"),
		import.meta.env?.VITE_API_URL,
	);
}

export function getAbsoluteApiBaseUrl() {
	return new URL(getApiBaseUrl() || "/", window.location.origin)
		.toString()
		.replace(/\/$/u, "");
}

export function getApiUrl(path: string) {
	return joinApiUrl(getApiBaseUrl(), path);
}

export function getApiWebSocketUrl(path: string) {
	return toWebSocketUrl(getApiUrl(path), window.location.origin);
}
