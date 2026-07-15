import type { ResolvedTheme } from "@/stores/theme";

export function getStrokeColors(theme: ResolvedTheme): string[] {
	return theme === "dark"
		? ["#e2e8f0", "#ffa8a8", "#69db7c", "#74c0fc", "#ffd43b", "#b197fc"]
		: ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00", "#6741d9"];
}

export const CANVAS_BG_LIGHT = [
	"",
	"#ffffff",
	"#f8f9fa",
	"#fff5f5",
	"#f0fdf4",
	"#eff6ff",
	"#fffbeb",
	"#faf5ff",
];

export const CANVAS_BG_DARK = [
	"",
	"#0f172a",
	"#1a1a2e",
	"#1a1020",
	"#0a1929",
	"#132a13",
	"#2a1a0a",
	"#1e1030",
];
