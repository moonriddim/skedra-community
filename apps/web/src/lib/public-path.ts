import type { Locale } from "@/lib/i18n";

const deToEnPath = new Map([
	["/", "/en"],
	["/whiteboard", "/en/whiteboard"],
	["/pricing", "/en/pricing"],
	["/about", "/en/about"],
	["/guides", "/en/guides"],
	["/online-whiteboard-ohne-anmeldung", "/en/online-whiteboard-without-signup"],
	["/verschluesseltes-online-whiteboard", "/en/encrypted-online-whiteboard"],
	[
		"/open-source-whiteboard-self-hosted",
		"/en/open-source-whiteboard-self-hosted",
	],
	["/infinite-canvas", "/en/infinite-canvas"],
	["/skedra-vs-excalidraw", "/en/skedra-vs-excalidraw"],
]);

const enToDePath = new Map(
	Array.from(deToEnPath, ([dePath, enPath]) => [enPath, dePath]),
);

/** Returns the locale encoded in an indexable public URL. */
export function getPublicPathLocale(pathname: string): Locale | null {
	if (enToDePath.has(pathname)) return "en";
	return deToEnPath.has(pathname) ? "de" : null;
}

/** Keeps public navigation inside the selected language URL namespace. */
export function localizePublicPath(pathname: string, locale: Locale) {
	const dePath = enToDePath.get(pathname) ?? pathname;
	if (!deToEnPath.has(dePath)) return pathname;
	return locale === "de" ? dePath : (deToEnPath.get(dePath) ?? pathname);
}
