/**
 * Standard-Bildschirm- und Formatgroessen fuer Frames (Design-Presets).
 * Host-neutral in canvas-core, damit Web-App und SDK dieselbe Liste nutzen.
 */

export type FrameSizePresetCategory =
	| "phone"
	| "tablet"
	| "desktop"
	| "print"
	| "social";

export interface FrameSizePreset {
	id: string;
	/** Anzeigename, wird beim Platzieren auch als Frame-Label uebernommen. */
	name: string;
	width: number;
	height: number;
	category: FrameSizePresetCategory;
}

/** Reihenfolge der Kategorien fuer die Anzeige im Panel. */
export const FRAME_SIZE_PRESET_CATEGORIES: readonly FrameSizePresetCategory[] =
	["phone", "tablet", "desktop", "print", "social"];

export const FRAME_SIZE_PRESETS: readonly FrameSizePreset[] = [
	/* Smartphones (logische Punkte, Portrait) */
	{
		id: "iphone-15-pro",
		name: "iPhone 15 Pro",
		width: 393,
		height: 852,
		category: "phone",
	},
	{
		id: "iphone-15-pro-max",
		name: "iPhone 15 Pro Max",
		width: 430,
		height: 932,
		category: "phone",
	},
	{
		id: "iphone-se",
		name: "iPhone SE",
		width: 375,
		height: 667,
		category: "phone",
	},
	{
		id: "android-small",
		name: "Android Small",
		width: 360,
		height: 640,
		category: "phone",
	},
	{
		id: "android-large",
		name: "Android Large",
		width: 412,
		height: 915,
		category: "phone",
	},
	/* Tablets */
	{
		id: "ipad-mini",
		name: "iPad Mini",
		width: 744,
		height: 1133,
		category: "tablet",
	},
	{
		id: "ipad-pro-11",
		name: 'iPad Pro 11"',
		width: 834,
		height: 1194,
		category: "tablet",
	},
	{
		id: "ipad-pro-129",
		name: 'iPad Pro 12.9"',
		width: 1024,
		height: 1366,
		category: "tablet",
	},
	/* Desktop */
	{
		id: "desktop",
		name: "Desktop",
		width: 1440,
		height: 1024,
		category: "desktop",
	},
	{
		id: "macbook-air",
		name: "MacBook Air",
		width: 1280,
		height: 832,
		category: "desktop",
	},
	{
		id: "macbook-pro-14",
		name: 'MacBook Pro 14"',
		width: 1512,
		height: 982,
		category: "desktop",
	},
	{
		id: "full-hd",
		name: "Full HD",
		width: 1920,
		height: 1080,
		category: "desktop",
	},
	/* Druckformate (72 dpi Punkte) */
	{ id: "a4", name: "A4", width: 595, height: 842, category: "print" },
	{ id: "a3", name: "A3", width: 842, height: 1191, category: "print" },
	{
		id: "letter",
		name: "Letter",
		width: 612,
		height: 792,
		category: "print",
	},
	/* Social Media */
	{
		id: "instagram-post",
		name: "Instagram Post",
		width: 1080,
		height: 1080,
		category: "social",
	},
	{
		id: "instagram-story",
		name: "Instagram Story",
		width: 1080,
		height: 1920,
		category: "social",
	},
	{
		id: "x-post",
		name: "X / Twitter Post",
		width: 1200,
		height: 675,
		category: "social",
	},
	{
		id: "youtube-thumbnail",
		name: "YouTube Thumbnail",
		width: 1280,
		height: 720,
		category: "social",
	},
];

/** Presets einer Kategorie in Anzeige-Reihenfolge. */
export function getFrameSizePresetsByCategory(
	category: FrameSizePresetCategory,
): FrameSizePreset[] {
	return FRAME_SIZE_PRESETS.filter((preset) => preset.category === category);
}
