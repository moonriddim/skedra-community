import { getRuntimeConfigValue } from "@/lib/runtime-config";

/** Basis-URL der Katalog-Site (libraries.skedra.xyz). */
export function getLibrariesSiteUrl() {
	const configured =
		getRuntimeConfigValue("LIBRARIES_URL") ||
		import.meta.env.VITE_LIBRARIES_URL?.trim();
	if (configured) return configured.replace(/\/$/, "");
	if (typeof window !== "undefined") {
		return window.location.origin;
	}
	return "http://localhost:5175";
}
