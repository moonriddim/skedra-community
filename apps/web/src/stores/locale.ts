import type { Locale } from "@/lib/i18n";
import { getPublicPathLocale, localizePublicPath } from "@/lib/public-path";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LocaleStore {
	locale: Locale;
	setLocale: (locale: Locale) => void;
}

export function detectBrowserLocale(
	languages: readonly string[] = typeof navigator === "undefined"
		? []
		: navigator.languages?.length
			? navigator.languages
			: [navigator.language],
): Locale {
	return /^de(?:-|$)/i.test(languages[0] ?? "") ? "de" : "en";
}

export const useLocaleStore = create<LocaleStore>()(
	persist(
		(set) => ({
			locale: detectBrowserLocale(),
			setLocale: (locale) => {
				set({ locale });
				document.documentElement.lang = locale;
			},
		}),
		{ name: "skedra-locale" },
	),
);

export function getCurrentLocale() {
	return useLocaleStore.getState().locale;
}

export function initLocale() {
	const { pathname, search, hash } = window.location;
	if (pathname === "/") {
		// The entry URL follows the saved preference or browser language.
		const localizedPath = localizePublicPath(pathname, getCurrentLocale());
		if (localizedPath !== pathname) {
			window.history.replaceState(
				window.history.state,
				"",
				`${localizedPath}${search}${hash}`,
			);
		}
	} else {
		// Direct links to localized public pages keep their explicit language.
		const pathLocale = getPublicPathLocale(pathname);
		if (pathLocale) useLocaleStore.getState().setLocale(pathLocale);
	}
	document.documentElement.lang = getCurrentLocale();
}
