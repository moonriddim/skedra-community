import type { Locale } from "@/lib/i18n";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LocaleStore {
	locale: Locale;
	setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleStore>()(
	persist(
		(set) => ({
			locale: "de",
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
	document.documentElement.lang = getCurrentLocale();
}
