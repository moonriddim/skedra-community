import type { ResolvedTheme } from "@/stores/theme";
import type {
	ArrowHead,
	ArrowMode,
	RoughFillStyle,
	StrokeStyle,
} from "@skedra/canvas-core";
import {
	CANVAS_PATH_DRAW_MODE_OPTIONS,
	CANVAS_PATH_MODE_OPTIONS,
} from "@skedra/canvas-editor";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import type { ReactNode } from "react";

export function getStrokeColors(theme: ResolvedTheme): string[] {
	return theme === "dark"
		? ["#e2e8f0", "#ffa8a8", "#69db7c", "#74c0fc", "#ffd43b", "#b197fc"]
		: ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00", "#6741d9"];
}

export const BG_COLORS = [
	"transparent",
	"#ffc9c9",
	"#b2f2bb",
	"#a5d8ff",
	"#ffec99",
	"#d0bfff",
];

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

export const STROKE_WIDTHS = [
	{ value: 1, labelKey: "thin" },
	{ value: 2, labelKey: "medium" },
	{ value: 4, labelKey: "thick" },
];

export const STROKE_STYLES: {
	value: StrokeStyle;
	labelKey: string;
	preview: ReactNode;
}[] = [
	{
		value: "solid",
		labelKey: "solid",
		preview: <div className="h-0.5 w-6 bg-current" />,
	},
	{
		value: "dashed",
		labelKey: "dashed",
		preview: (
			<div className="h-0.5 w-6 border-current border-t-2 border-dashed" />
		),
	},
	{
		value: "dotted",
		labelKey: "dotted",
		preview: (
			<div className="h-0.5 w-6 border-current border-t-2 border-dotted" />
		),
	},
];

/** Füllungsmuster für Formen mit Hintergrund und Skizzenstil (rough.js) */
export const ROUGH_FILL_STYLES: {
	value: RoughFillStyle;
	labelKey: string;
	preview: ReactNode;
}[] = [
	{
		value: "solid",
		labelKey: "fillSolid",
		preview: <div className="h-3.5 w-3.5 rounded-sm bg-current opacity-80" />,
	},
	{
		value: "hachure",
		labelKey: "fillHachure",
		preview: (
			<svg
				aria-hidden="true"
				viewBox="0 0 14 14"
				className="h-3.5 w-3.5 text-current"
			>
				<rect
					x="1"
					y="1"
					width="12"
					height="12"
					fill="none"
					stroke="currentColor"
					strokeWidth="1"
				/>
				<line
					x1="2"
					y1="12"
					x2="12"
					y2="2"
					stroke="currentColor"
					strokeWidth="1"
				/>
				<line
					x1="4"
					y1="12"
					x2="12"
					y2="4"
					stroke="currentColor"
					strokeWidth="1"
				/>
				<line
					x1="6"
					y1="12"
					x2="12"
					y2="6"
					stroke="currentColor"
					strokeWidth="1"
				/>
			</svg>
		),
	},
	{
		value: "cross-hatch",
		labelKey: "fillCrossHatch",
		preview: (
			<svg
				aria-hidden="true"
				viewBox="0 0 14 14"
				className="h-3.5 w-3.5 text-current"
			>
				<rect
					x="1"
					y="1"
					width="12"
					height="12"
					fill="none"
					stroke="currentColor"
					strokeWidth="1"
				/>
				<line
					x1="2"
					y1="12"
					x2="12"
					y2="2"
					stroke="currentColor"
					strokeWidth="0.75"
				/>
				<line
					x1="2"
					y1="2"
					x2="12"
					y2="12"
					stroke="currentColor"
					strokeWidth="0.75"
				/>
			</svg>
		),
	},
	{
		value: "dashed",
		labelKey: "fillDashed",
		preview: (
			<svg
				aria-hidden="true"
				viewBox="0 0 14 14"
				className="h-3.5 w-3.5 text-current"
			>
				<rect
					x="1"
					y="1"
					width="12"
					height="12"
					fill="none"
					stroke="currentColor"
					strokeWidth="1"
				/>
				<line
					x1="2"
					y1="10"
					x2="5"
					y2="7"
					stroke="currentColor"
					strokeWidth="1"
					strokeDasharray="2 2"
				/>
				<line
					x1="6"
					y1="12"
					x2="9"
					y2="9"
					stroke="currentColor"
					strokeWidth="1"
					strokeDasharray="2 2"
				/>
				<line
					x1="10"
					y1="12"
					x2="12"
					y2="10"
					stroke="currentColor"
					strokeWidth="1"
					strokeDasharray="2 2"
				/>
			</svg>
		),
	},
	{
		value: "dots",
		labelKey: "fillDots",
		preview: (
			<svg
				aria-hidden="true"
				viewBox="0 0 14 14"
				className="h-3.5 w-3.5 text-current"
			>
				<rect
					x="1"
					y="1"
					width="12"
					height="12"
					fill="none"
					stroke="currentColor"
					strokeWidth="1"
				/>
				<circle cx="4" cy="4" r="0.8" fill="currentColor" />
				<circle cx="8" cy="4" r="0.8" fill="currentColor" />
				<circle cx="4" cy="8" r="0.8" fill="currentColor" />
				<circle cx="8" cy="8" r="0.8" fill="currentColor" />
			</svg>
		),
	},
];

/** Kanten-Presets als Anteil der maximalen Abrundung (halbe Kurzseite) */
export const CORNER_RADIUS_PRESETS = [
	{ percent: 0, labelKey: "square" },
	{ percent: 25, labelKey: "rounded" },
	{ percent: 50, labelKey: "strong" },
	{ percent: 100, labelKey: "pill" },
];

export const ROUGHNESS_LEVELS: {
	value: number;
	labelKey: string;
	icon: ReactNode;
}[] = [
	{
		value: 0,
		labelKey: "exact",
		icon: (
			<svg aria-hidden="true" viewBox="0 0 20 12" className="h-3 w-5">
				<line
					x1="2"
					y1="6"
					x2="18"
					y2="6"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
			</svg>
		),
	},
	{
		value: 1,
		labelKey: "light",
		icon: (
			<svg aria-hidden="true" viewBox="0 0 20 12" className="h-3 w-5">
				<path
					d="M2 7 Q6 4, 10 6 T18 5"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
			</svg>
		),
	},
	{
		value: 2,
		labelKey: "strong",
		icon: (
			<svg aria-hidden="true" viewBox="0 0 20 12" className="h-3 w-5">
				<path
					d="M2 8 Q5 2, 8 7 T14 4 T18 6"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
			</svg>
		),
	},
];

export const ARROW_MODES: {
	value: ArrowMode;
	labelKey: string;
	icon: ReactNode;
}[] = CANVAS_PATH_MODE_OPTIONS.map((value) => {
	const presentation: Record<ArrowMode, { labelKey: string; icon: ReactNode }> =
		{
			straight: {
				labelKey: "straight",
				icon: (
					<svg aria-hidden="true" viewBox="0 0 20 12" className="h-3 w-5">
						<polyline
							points="2,9 7,3 12,9 18,3"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinejoin="round"
						/>
					</svg>
				),
			},
			curve: {
				labelKey: "curve",
				icon: (
					<svg aria-hidden="true" viewBox="0 0 20 12" className="h-3 w-5">
						<path
							d="M2 9 C6 1 11 1 18 7"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
						/>
					</svg>
				),
			},
			elbow: {
				labelKey: "elbow",
				icon: (
					<svg aria-hidden="true" viewBox="0 0 20 12" className="h-3 w-5">
						<polyline
							points="2,2 10,2 10,10 18,10"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinejoin="round"
						/>
					</svg>
				),
			},
		};
	return { value, ...presentation[value] };
});

export const ARROW_HEAD_OPTIONS: {
	value: ArrowHead;
	labelKey: string;
	icon: ReactNode;
}[] = [
	{
		value: "none",
		labelKey: "none",
		icon: (
			<svg aria-hidden="true" viewBox="0 0 20 12" className="h-3 w-5">
				<line
					x1="4"
					y1="6"
					x2="16"
					y2="6"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
				/>
			</svg>
		),
	},
	{
		value: "arrow",
		labelKey: "open",
		icon: (
			<svg aria-hidden="true" viewBox="0 0 20 12" className="h-3 w-5">
				<line
					x1="2"
					y1="6"
					x2="15"
					y2="6"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
				<path
					d="M 11 2.5 L 17 6 L 11 9.5"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		),
	},
	{
		value: "triangle",
		labelKey: "triangle",
		icon: (
			<svg aria-hidden="true" viewBox="0 0 20 12" className="h-3 w-5">
				<line
					x1="2"
					y1="6"
					x2="13"
					y2="6"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
				<polygon points="18,6 12,2 12,10" fill="currentColor" />
			</svg>
		),
	},
	{
		value: "dot",
		labelKey: "dot",
		icon: (
			<svg aria-hidden="true" viewBox="0 0 20 12" className="h-3 w-5">
				<line
					x1="2"
					y1="6"
					x2="12"
					y2="6"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
				<circle cx="15" cy="6" r="3" fill="currentColor" />
			</svg>
		),
	},
];

export const FONT_FAMILIES = [
	{ value: "system-ui, sans-serif", label: "Sans Serif" },
	{ value: "Georgia, Cambria, Times New Roman, Times, serif", label: "Serif" },
	{
		value: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
		label: "Monospace",
	},
	{
		value: '"Kalam", "Architects Daughter", "Segoe Print", cursive',
		label: "Handschrift",
	},
	{
		value: '"Comic Neue", "Comic Sans MS", cursive',
		label: "Comic",
	},
	{ value: "Comic Sans MS, Comic Sans, cursive", label: "Comic Sans" },
	{
		value: "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
		label: "Impact",
	},
	{
		value: "Trebuchet MS, Lucida Grande, Lucida Sans, sans-serif",
		label: "Trebuchet",
	},
	{ value: "Verdana, Geneva, sans-serif", label: "Verdana" },
	{ value: "Courier New, Courier, monospace", label: "Courier New" },
	{
		value: "Palatino Linotype, Palatino, Book Antiqua, serif",
		label: "Palatino",
	},
	{
		value: "Garamond, Baskerville, Baskerville Old Face, serif",
		label: "Garamond",
	},
	{ value: "Arial, Helvetica, sans-serif", label: "Arial" },
];

export const FONT_SIZES = [
	{ value: 14, label: "S" },
	{ value: 18, label: "M" },
	{ value: 24, label: "L" },
	{ value: 32, label: "XL" },
];

export const TEXT_ALIGNS: {
	value: "left" | "center" | "right";
	labelKey: string;
	icon: ReactNode;
}[] = [
	{
		value: "left",
		labelKey: "left",
		icon: <AlignLeft className="h-3.5 w-3.5" />,
	},
	{
		value: "center",
		labelKey: "center",
		icon: <AlignCenter className="h-3.5 w-3.5" />,
	},
	{
		value: "right",
		labelKey: "right",
		icon: <AlignRight className="h-3.5 w-3.5" />,
	},
];

export const PATH_DRAW_MODES = CANVAS_PATH_DRAW_MODE_OPTIONS.map((value) => ({
	value,
	labelKey: value === "normal" ? "pathDrawNormal" : "pathDrawMulti",
}));
