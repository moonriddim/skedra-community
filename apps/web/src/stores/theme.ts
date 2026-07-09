import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeStore {
	theme: Theme;
	resolvedTheme: ResolvedTheme;
	setTheme: (theme: Theme) => void;
	syncResolvedTheme: () => void;
}

/** Theme-Store mit Persistierung im localStorage */
export const useThemeStore = create<ThemeStore>()(
	persist(
		(set, get) => ({
			theme: "system",
			resolvedTheme: "light",
			setTheme: (theme) => {
				const resolvedTheme = resolveTheme(theme);
				applyThemeToDocument(resolvedTheme);
				set({ theme, resolvedTheme });
			},
			syncResolvedTheme: () => {
				const resolvedTheme = resolveTheme(get().theme);
				applyThemeToDocument(resolvedTheme);
				set({ resolvedTheme });
			},
		}),
		{
			name: "skedra-theme",
			partialize: (state) => ({ theme: state.theme }),
		},
	),
);

function resolveTheme(theme: Theme): ResolvedTheme {
	if (theme === "dark" || theme === "light") return theme;
	if (typeof window === "undefined") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

/** Wendet das aufgeloeste Theme auf das HTML-Element an */
function applyThemeToDocument(theme: ResolvedTheme) {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	if (theme === "dark") {
		root.classList.add("dark");
	} else {
		root.classList.remove("dark");
	}
}

/** Theme beim Laden initialisieren */
export function initTheme() {
	useThemeStore.getState().syncResolvedTheme();

	// Bei System-Einstellung auf Aenderungen reagieren
	window
		.matchMedia("(prefers-color-scheme: dark)")
		.addEventListener("change", (e) => {
			if (useThemeStore.getState().theme === "system") {
				document.documentElement.classList.toggle("dark", e.matches);
				useThemeStore.setState({
					resolvedTheme: e.matches ? "dark" : "light",
				});
			}
		});
}
