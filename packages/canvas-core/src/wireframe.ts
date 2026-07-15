import {
	type CanvasElementFactoryDefaults,
	createBaseCanvasElement,
} from "./element-factory";
import type { CanvasElement } from "./types";

export const WIREFRAME_SCREEN_TYPE = "wireframe-screen";
export const WIREFRAME_NODE_TYPE = "wireframe-node";
export const WIREFRAME_VERSION = 2;
const LEGACY_WIREFRAME_VERSION = 1;

export type WireframeViewport = "desktop" | "tablet" | "mobile";
export type WireframeChrome = "browser" | "mobile" | "none";

export const WIREFRAME_COMPONENT_IDS = [
	"navbar",
	"topbar",
	"sidebar",
	"hero",
	"text-block",
	"button",
	"input",
	"textarea",
	"search",
	"checkbox",
	"radio",
	"toggle",
	"select",
	"tabs",
	"breadcrumb",
	"card",
	"image",
	"avatar",
	"list",
	"table",
	"modal",
	"pagination",
	"bottom-nav",
	"divider",
	"skeleton",
] as const;

export type WireframeComponentId = (typeof WIREFRAME_COMPONENT_IDS)[number];

export type WireframeComponentCategory =
	| "layout"
	| "content"
	| "forms"
	| "data";

/**
 * Stable product catalog for host UIs. Keeping the grouping next to the
 * canonical ids lets Community, the SDK and future hosts build the same
 * component picker without maintaining their own lists.
 */
export const WIREFRAME_COMPONENT_CATEGORIES = {
	layout: ["navbar", "topbar", "sidebar", "bottom-nav", "divider"],
	content: [
		"hero",
		"text-block",
		"card",
		"image",
		"avatar",
		"list",
		"skeleton",
	],
	forms: [
		"button",
		"input",
		"textarea",
		"search",
		"checkbox",
		"radio",
		"toggle",
		"select",
	],
	data: ["tabs", "breadcrumb", "table", "pagination", "modal"],
} as const satisfies Record<
	WireframeComponentCategory,
	readonly WireframeComponentId[]
>;

export interface WireframeTemplateOptions {
	x: number;
	y: number;
	defaults: CanvasElementFactoryDefaults;
	text?: (key: string) => string;
	fontFamily?: string;
}

export interface WireframeElementMeta {
	skedraType: typeof WIREFRAME_SCREEN_TYPE | typeof WIREFRAME_NODE_TYPE;
	wireframeVersion: typeof LEGACY_WIREFRAME_VERSION | typeof WIREFRAME_VERSION;
	wireframeViewport: WireframeViewport;
	wireframeRole: string;
	/** Derived from the frame element id or the node's canonical frameId. */
	wireframeScreenId: string | null;
	wireframeComponent?: WireframeComponentId;
	wireframePreset?: string;
}

export interface WireframeScreenOptions extends WireframeTemplateOptions {
	viewport: WireframeViewport;
	width?: number;
	height?: number;
	label?: string;
	chrome?: WireframeChrome;
}

export interface WireframeComponentOptions extends WireframeTemplateOptions {
	component: WireframeComponentId;
	viewport?: WireframeViewport;
	frameId?: string;
}

export interface WireframeInsertionTarget {
	frameId?: string;
	viewport?: WireframeViewport;
	point: { x: number; y: number } | null;
}

interface WireframeBuilder {
	elements: CanvasElement[];
	options: WireframeTemplateOptions;
}

interface WireframeNodeOptions {
	viewport: WireframeViewport;
	screenId?: string;
	role: string;
	groupId: string;
	component?: WireframeComponentId;
	preset?: string;
	element: Partial<CanvasElement> & { type: CanvasElement["type"] };
}

const COLORS = {
	page: "#FFFFFF",
	surface: "#F8FAFC",
	muted: "#E2E8F0",
	mutedStrong: "#CBD5E1",
	stroke: "#64748B",
	text: "#334155",
	textStrong: "#0F172A",
};

const FALLBACK_TEXT: Record<string, string> = {
	"wireframe.desktopLabel": "Desktop · Landing page",
	"wireframe.tabletLabel": "Tablet · Wireframe",
	"wireframe.mobileLabel": "Mobile · Landing page",
	"wireframe.brand": "BRAND",
	"wireframe.navigation": "Features     Pricing     About",
	"wireframe.heroTitle": "A clear headline for your product",
	"wireframe.heroBody":
		"Explain the problem you solve in one or two short lines.",
	"wireframe.primaryAction": "Get started",
	"wireframe.secondaryAction": "Learn more",
	"wireframe.imagePlaceholder": "Image / product preview",
	"wireframe.benefitOne": "First benefit",
	"wireframe.benefitTwo": "Second benefit",
	"wireframe.benefitThree": "Third benefit",
	"wireframe.benefitBody": "Short supporting copy goes here.",
	"wireframe.footer": "Footer links and legal information",
	"wireframe.placeholderTitle": "Section title",
	"wireframe.placeholderBody": "Supporting copy and useful context go here.",
	"wireframe.button": "Button",
	"wireframe.label": "Label",
	"wireframe.inputPlaceholder": "Enter text…",
	"wireframe.searchPlaceholder": "Search…",
	"wireframe.option": "Option",
	"wireframe.tabOne": "Overview",
	"wireframe.tabTwo": "Details",
	"wireframe.tabThree": "Activity",
	"wireframe.breadcrumb": "Home  /  Products  /  Current",
	"wireframe.cardTitle": "Card title",
	"wireframe.listItem": "List item",
	"wireframe.tableHeader": "Name          Status          Owner",
	"wireframe.tableRow": "Item          Active          Team",
	"wireframe.modalTitle": "Dialog title",
	"wireframe.modalBody": "Explain what happens next.",
	"wireframe.previous": "Previous",
	"wireframe.next": "Next",
	"wireframe.home": "Home",
	"wireframe.explore": "Explore",
	"wireframe.profile": "Profile",
};

function resolveText(options: WireframeTemplateOptions, key: string) {
	return options.text?.(key) ?? FALLBACK_TEXT[key] ?? key;
}

function addNode(
	builder: WireframeBuilder,
	options: WireframeNodeOptions,
): CanvasElement {
	const { customData, ...element } = options.element;
	const created = createBaseCanvasElement(builder.options.defaults, {
		...element,
		...(options.screenId ? { frameId: options.screenId } : {}),
		groupId: options.groupId,
		customData: {
			...customData,
			skedraType: WIREFRAME_NODE_TYPE,
			wireframeVersion: WIREFRAME_VERSION,
			wireframeViewport: options.viewport,
			wireframeRole: options.role,
			...(options.component ? { wireframeComponent: options.component } : {}),
			...(options.preset ? { wireframePreset: options.preset } : {}),
		},
	});
	builder.elements.push(created);
	return created;
}

function addRectangle(
	builder: WireframeBuilder,
	meta: Omit<WireframeNodeOptions, "element">,
	geometry: Pick<CanvasElement, "x" | "y" | "width" | "height"> &
		Partial<CanvasElement>,
) {
	return addNode(builder, {
		...meta,
		element: {
			type: "rectangle",
			fill: COLORS.surface,
			stroke: COLORS.stroke,
			strokeWidth: 1.5,
			cornerRadius: 8,
			...geometry,
		},
	});
}

function addText(
	builder: WireframeBuilder,
	meta: Omit<WireframeNodeOptions, "element">,
	geometry: Pick<CanvasElement, "x" | "y" | "width" | "height" | "text"> &
		Partial<CanvasElement>,
) {
	return addNode(builder, {
		...meta,
		element: {
			type: "text",
			fill: "transparent",
			stroke: COLORS.text,
			strokeWidth: 1,
			fontSize: 14,
			fontFamily:
				builder.options.fontFamily ?? builder.options.defaults.fontFamily,
			...geometry,
		},
	});
}

function addLine(
	builder: WireframeBuilder,
	meta: Omit<WireframeNodeOptions, "element">,
	geometry: Pick<CanvasElement, "x" | "y" | "width" | "height" | "points"> &
		Partial<CanvasElement>,
) {
	return addNode(builder, {
		...meta,
		element: {
			type: "line",
			fill: "transparent",
			stroke: COLORS.stroke,
			strokeWidth: 1.5,
			...geometry,
		},
	});
}

function addScreen(
	builder: WireframeBuilder,
	viewport: WireframeViewport,
	x: number,
	y: number,
	width: number,
	height: number,
	configuration: { label?: string; chrome?: WireframeChrome } = {},
): CanvasElement {
	const labelKey =
		viewport === "desktop"
			? "wireframe.desktopLabel"
			: viewport === "tablet"
				? "wireframe.tabletLabel"
				: "wireframe.mobileLabel";
	const screen = createBaseCanvasElement(builder.options.defaults, {
		type: "frame",
		x,
		y,
		width,
		height,
		fill: "transparent",
		stroke: COLORS.stroke,
		strokeWidth: 1.5,
		frameLabel: configuration.label ?? resolveText(builder.options, labelKey),
		customData: {
			skedraType: WIREFRAME_SCREEN_TYPE,
			wireframeVersion: WIREFRAME_VERSION,
			wireframeViewport: viewport,
			wireframeRole: "screen",
		},
	});
	builder.elements.push(screen);

	addRectangle(
		builder,
		{
			viewport,
			screenId: screen.id,
			role: "page-background",
			groupId: builder.options.defaults.createId(),
		},
		{
			x: x + 1,
			y: y + 1,
			width: width - 2,
			height: height - 2,
			fill: COLORS.page,
			stroke: COLORS.stroke,
			cornerRadius: 4,
		},
	);
	const chrome = configuration.chrome ?? "browser";
	if (chrome === "browser") {
		addBrowserChrome(builder, viewport, screen.id, x, y, width);
	} else if (chrome === "mobile") {
		addMobileChrome(builder, viewport, screen.id, x, y, width);
	}
	return screen;
}

function addBrowserChrome(
	builder: WireframeBuilder,
	viewport: WireframeViewport,
	screenId: string,
	x: number,
	y: number,
	width: number,
) {
	const chromeGroup = builder.options.defaults.createId();
	const chromeMeta = {
		viewport,
		screenId,
		role: "browser-chrome",
		groupId: chromeGroup,
	};
	addRectangle(builder, chromeMeta, {
		x: x + 1,
		y: y + 1,
		width: width - 2,
		height: 40,
		fill: COLORS.surface,
		cornerRadius: 4,
	});
	for (let index = 0; index < 3; index++) {
		addNode(builder, {
			...chromeMeta,
			element: {
				type: "ellipse",
				x: x + 14 + index * 16,
				y: y + 15,
				width: 8,
				height: 8,
				fill: COLORS.mutedStrong,
				stroke: COLORS.stroke,
				strokeWidth: 1,
			},
		});
	}
	addRectangle(builder, chromeMeta, {
		x: x + (viewport === "desktop" ? 166 : 80),
		y: y + 10,
		width: viewport === "desktop" ? width - 332 : width - 104,
		height: 20,
		fill: COLORS.page,
		stroke: COLORS.mutedStrong,
		cornerRadius: 10,
	});
}

function addMobileChrome(
	builder: WireframeBuilder,
	viewport: WireframeViewport,
	screenId: string,
	x: number,
	y: number,
	width: number,
) {
	const chromeGroup = builder.options.defaults.createId();
	const meta = {
		viewport,
		screenId,
		role: "mobile-chrome",
		groupId: chromeGroup,
	};
	addText(builder, meta, {
		x: x + 18,
		y: y + 12,
		width: 42,
		height: 16,
		text: "9:41",
		fontSize: 11,
		fontWeight: "bold",
		stroke: COLORS.textStrong,
	});
	addRectangle(builder, meta, {
		x: x + width - 56,
		y: y + 14,
		width: 34,
		height: 12,
		fill: COLORS.muted,
		cornerRadius: 5,
	});
	addRectangle(builder, meta, {
		x: x + width / 2 - 46,
		y: y + 8,
		width: 92,
		height: 20,
		fill: COLORS.textStrong,
		stroke: COLORS.textStrong,
		cornerRadius: 10,
	});
}

const SCREEN_DEFAULTS: Record<
	WireframeViewport,
	{ width: number; height: number; chrome: WireframeChrome }
> = {
	desktop: { width: 960, height: 680, chrome: "browser" },
	tablet: { width: 768, height: 920, chrome: "browser" },
	mobile: { width: 390, height: 844, chrome: "mobile" },
};

/** Creates a blank device screen from canonical frame and child elements. */
export function createWireframeScreenElements(
	options: WireframeScreenOptions,
): CanvasElement[] {
	const defaults = SCREEN_DEFAULTS[options.viewport];
	const width = options.width ?? defaults.width;
	const height = options.height ?? defaults.height;
	const builder: WireframeBuilder = { elements: [], options };
	addScreen(
		builder,
		options.viewport,
		options.x - width / 2,
		options.y - height / 2,
		width,
		height,
		{ label: options.label, chrome: options.chrome ?? defaults.chrome },
	);
	return builder.elements;
}

/**
 * Creates a reusable wireframe library item. Every part shares one groupId;
 * frameId is the sole persisted screen relationship when a target is supplied.
 */
export function createWireframeComponentElements(
	options: WireframeComponentOptions,
): CanvasElement[] {
	const builder: WireframeBuilder = { elements: [], options };
	const viewport = options.viewport ?? "desktop";
	const groupId = options.defaults.createId();
	const meta = {
		viewport,
		screenId: options.frameId,
		role: "component",
		groupId,
		component: options.component,
	};
	const rectangle = (
		geometry: Pick<CanvasElement, "x" | "y" | "width" | "height"> &
			Partial<CanvasElement>,
	) => addRectangle(builder, meta, geometry);
	const text = (
		geometry: Pick<CanvasElement, "x" | "y" | "width" | "height" | "text"> &
			Partial<CanvasElement>,
	) => addText(builder, meta, geometry);
	const line = (
		geometry: Pick<CanvasElement, "x" | "y" | "width" | "height" | "points"> &
			Partial<CanvasElement>,
	) => addLine(builder, meta, geometry);
	const ellipse = (
		geometry: Pick<CanvasElement, "x" | "y" | "width" | "height"> &
			Partial<CanvasElement>,
	) =>
		addNode(builder, {
			...meta,
			element: {
				type: "ellipse",
				fill: COLORS.surface,
				stroke: COLORS.stroke,
				strokeWidth: 1.5,
				...geometry,
			},
		});
	const title = (x: number, y: number, width: number, value: string) =>
		text({
			x,
			y,
			width,
			height: 24,
			text: value,
			stroke: COLORS.textStrong,
			fontSize: 16,
			fontWeight: "bold",
		});
	const body = (x: number, y: number, width: number, value: string) =>
		text({
			x,
			y,
			width,
			height: 36,
			text: value,
			stroke: COLORS.stroke,
			fontSize: 12,
		});
	const x = options.x;
	const y = options.y;

	switch (options.component) {
		case "navbar": {
			const left = x - 260;
			const top = y - 28;
			rectangle({
				x: left,
				y: top,
				width: 520,
				height: 56,
				fill: COLORS.page,
				cornerRadius: 6,
			});
			rectangle({
				x: left + 18,
				y: top + 14,
				width: 78,
				height: 28,
				fill: COLORS.muted,
				text: resolveText(options, "wireframe.brand"),
				textColor: COLORS.textStrong,
				fontSize: 11,
				fontWeight: "bold",
				textAlign: "center",
			});
			text({
				x: left + 194,
				y: top + 18,
				width: 210,
				height: 20,
				text: resolveText(options, "wireframe.navigation"),
				fontSize: 12,
				textAlign: "right",
			});
			rectangle({
				x: left + 422,
				y: top + 11,
				width: 80,
				height: 34,
				fill: COLORS.textStrong,
				stroke: COLORS.textStrong,
				text: resolveText(options, "wireframe.button"),
				textColor: COLORS.page,
				fontSize: 12,
				textAlign: "center",
			});
			break;
		}
		case "topbar": {
			const left = x - 240;
			const top = y - 26;
			rectangle({
				x: left,
				y: top,
				width: 480,
				height: 52,
				fill: COLORS.page,
				cornerRadius: 6,
			});
			title(
				left + 18,
				top + 14,
				180,
				resolveText(options, "wireframe.placeholderTitle"),
			);
			rectangle({
				x: left + 316,
				y: top + 11,
				width: 104,
				height: 30,
				fill: COLORS.surface,
				cornerRadius: 15,
			});
			ellipse({
				x: left + 438,
				y: top + 10,
				width: 32,
				height: 32,
				fill: COLORS.muted,
			});
			break;
		}
		case "sidebar": {
			const left = x - 100;
			const top = y - 190;
			rectangle({
				x: left,
				y: top,
				width: 200,
				height: 380,
				fill: COLORS.surface,
				cornerRadius: 8,
			});
			rectangle({
				x: left + 20,
				y: top + 20,
				width: 86,
				height: 30,
				fill: COLORS.muted,
			});
			for (let index = 0; index < 5; index++) {
				rectangle({
					x: left + 16,
					y: top + 76 + index * 48,
					width: 168,
					height: 34,
					fill: index === 0 ? COLORS.muted : COLORS.page,
					stroke: index === 0 ? COLORS.mutedStrong : "transparent",
					cornerRadius: 6,
				});
			}
			break;
		}
		case "hero": {
			const left = x - 270;
			const top = y - 125;
			rectangle({
				x: left,
				y: top,
				width: 540,
				height: 250,
				fill: COLORS.page,
				cornerRadius: 10,
			});
			text({
				x: left + 28,
				y: top + 34,
				width: 300,
				height: 64,
				text: resolveText(options, "wireframe.heroTitle"),
				stroke: COLORS.textStrong,
				fontSize: 26,
				fontWeight: "bold",
			});
			body(
				left + 28,
				top + 108,
				290,
				resolveText(options, "wireframe.heroBody"),
			);
			rectangle({
				x: left + 28,
				y: top + 174,
				width: 116,
				height: 38,
				fill: COLORS.textStrong,
				stroke: COLORS.textStrong,
				text: resolveText(options, "wireframe.primaryAction"),
				textColor: COLORS.page,
				fontSize: 12,
				textAlign: "center",
			});
			rectangle({
				x: left + 354,
				y: top + 32,
				width: 158,
				height: 186,
				fill: COLORS.surface,
				strokeStyle: "dashed",
				cornerRadius: 8,
			});
			line({
				x: left + 354,
				y: top + 32,
				width: 158,
				height: 186,
				points: [
					[0, 0],
					[158, 186],
				],
				stroke: COLORS.mutedStrong,
			});
			break;
		}
		case "text-block": {
			const left = x - 170;
			const top = y - 52;
			title(left, top, 340, resolveText(options, "wireframe.placeholderTitle"));
			body(
				left,
				top + 34,
				340,
				resolveText(options, "wireframe.placeholderBody"),
			);
			break;
		}
		case "button": {
			rectangle({
				x: x - 66,
				y: y - 21,
				width: 132,
				height: 42,
				fill: COLORS.textStrong,
				stroke: COLORS.textStrong,
				text: resolveText(options, "wireframe.button"),
				textColor: COLORS.page,
				fontSize: 13,
				fontWeight: "bold",
				textAlign: "center",
			});
			break;
		}
		case "input":
		case "textarea":
		case "select": {
			const width = 300;
			const fieldHeight = options.component === "textarea" ? 92 : 44;
			const left = x - width / 2;
			const top = y - (fieldHeight + 28) / 2;
			text({
				x: left,
				y: top,
				width,
				height: 18,
				text: resolveText(options, "wireframe.label"),
				fontSize: 12,
				fontWeight: "bold",
			});
			rectangle({
				x: left,
				y: top + 26,
				width,
				height: fieldHeight,
				fill: COLORS.page,
				cornerRadius: 6,
			});
			text({
				x: left + 14,
				y: top + 39,
				width: width - 46,
				height: 20,
				text:
					options.component === "select"
						? resolveText(options, "wireframe.option")
						: resolveText(options, "wireframe.inputPlaceholder"),
				fontSize: 12,
				stroke: COLORS.stroke,
			});
			if (options.component === "select") {
				text({
					x: left + width - 30,
					y: top + 37,
					width: 16,
					height: 20,
					text: "⌄",
					fontSize: 14,
					textAlign: "center",
				});
			}
			break;
		}
		case "search": {
			const left = x - 160;
			rectangle({
				x: left,
				y: y - 22,
				width: 320,
				height: 44,
				fill: COLORS.page,
				cornerRadius: 22,
			});
			ellipse({
				x: left + 16,
				y: y - 8,
				width: 14,
				height: 14,
				fill: "transparent",
			});
			line({
				x: left + 27,
				y: y + 4,
				width: 7,
				height: 7,
				points: [
					[0, 0],
					[7, 7],
				],
			});
			text({
				x: left + 44,
				y: y - 9,
				width: 250,
				height: 20,
				text: resolveText(options, "wireframe.searchPlaceholder"),
				fontSize: 12,
			});
			break;
		}
		case "checkbox":
		case "radio": {
			const left = x - 82;
			if (options.component === "checkbox") {
				rectangle({
					x: left,
					y: y - 10,
					width: 20,
					height: 20,
					fill: COLORS.page,
					cornerRadius: 3,
				});
			} else {
				ellipse({
					x: left,
					y: y - 10,
					width: 20,
					height: 20,
					fill: COLORS.page,
				});
			}
			text({
				x: left + 32,
				y: y - 10,
				width: 132,
				height: 20,
				text: resolveText(options, "wireframe.option"),
				fontSize: 13,
			});
			break;
		}
		case "toggle": {
			rectangle({
				x: x - 26,
				y: y - 14,
				width: 52,
				height: 28,
				fill: COLORS.mutedStrong,
				cornerRadius: 14,
			});
			ellipse({
				x: x - 22,
				y: y - 10,
				width: 20,
				height: 20,
				fill: COLORS.page,
			});
			break;
		}
		case "tabs": {
			const left = x - 180;
			const labels = [
				"wireframe.tabOne",
				"wireframe.tabTwo",
				"wireframe.tabThree",
			];
			for (let index = 0; index < labels.length; index++) {
				text({
					x: left + index * 120,
					y: y - 18,
					width: 112,
					height: 24,
					text: resolveText(options, labels[index]),
					fontSize: 13,
					fontWeight: index === 0 ? "bold" : "normal",
					textAlign: "center",
				});
			}
			line({
				x: left,
				y: y + 14,
				width: 360,
				height: 1,
				points: [
					[0, 0],
					[360, 0],
				],
				stroke: COLORS.mutedStrong,
			});
			line({
				x: left,
				y: y + 14,
				width: 112,
				height: 2,
				points: [
					[0, 0],
					[112, 0],
				],
				stroke: COLORS.textStrong,
				strokeWidth: 3,
			});
			break;
		}
		case "breadcrumb": {
			text({
				x: x - 180,
				y: y - 10,
				width: 360,
				height: 20,
				text: resolveText(options, "wireframe.breadcrumb"),
				fontSize: 12,
			});
			break;
		}
		case "card": {
			const left = x - 130;
			const top = y - 100;
			rectangle({
				x: left,
				y: top,
				width: 260,
				height: 200,
				fill: COLORS.page,
				cornerRadius: 10,
			});
			rectangle({
				x: left + 14,
				y: top + 14,
				width: 232,
				height: 92,
				fill: COLORS.surface,
				strokeStyle: "dashed",
			});
			title(
				left + 16,
				top + 122,
				228,
				resolveText(options, "wireframe.cardTitle"),
			);
			body(
				left + 16,
				top + 152,
				228,
				resolveText(options, "wireframe.placeholderBody"),
			);
			break;
		}
		case "image": {
			const left = x - 150;
			const top = y - 95;
			rectangle({
				x: left,
				y: top,
				width: 300,
				height: 190,
				fill: COLORS.surface,
				strokeStyle: "dashed",
				cornerRadius: 8,
			});
			line({
				x: left,
				y: top,
				width: 300,
				height: 190,
				points: [
					[0, 0],
					[300, 190],
				],
				stroke: COLORS.mutedStrong,
			});
			line({
				x: left,
				y: top,
				width: 300,
				height: 190,
				points: [
					[300, 0],
					[0, 190],
				],
				stroke: COLORS.mutedStrong,
			});
			break;
		}
		case "avatar": {
			ellipse({
				x: x - 34,
				y: y - 34,
				width: 68,
				height: 68,
				fill: COLORS.muted,
			});
			break;
		}
		case "list": {
			const left = x - 170;
			const top = y - 100;
			for (let index = 0; index < 4; index++) {
				rectangle({
					x: left,
					y: top + index * 52,
					width: 340,
					height: 44,
					fill: COLORS.page,
					cornerRadius: 6,
				});
				ellipse({
					x: left + 12,
					y: top + 10 + index * 52,
					width: 24,
					height: 24,
					fill: COLORS.muted,
				});
				text({
					x: left + 50,
					y: top + 12 + index * 52,
					width: 210,
					height: 20,
					text: `${resolveText(options, "wireframe.listItem")} ${index + 1}`,
					fontSize: 12,
				});
			}
			break;
		}
		case "table": {
			const left = x - 230;
			const top = y - 100;
			rectangle({
				x: left,
				y: top,
				width: 460,
				height: 200,
				fill: COLORS.page,
				cornerRadius: 6,
			});
			rectangle({
				x: left,
				y: top,
				width: 460,
				height: 44,
				fill: COLORS.muted,
				cornerRadius: 6,
			});
			text({
				x: left + 16,
				y: top + 12,
				width: 428,
				height: 20,
				text: resolveText(options, "wireframe.tableHeader"),
				fontSize: 12,
				fontWeight: "bold",
			});
			for (let index = 0; index < 3; index++) {
				text({
					x: left + 16,
					y: top + 58 + index * 46,
					width: 428,
					height: 20,
					text: resolveText(options, "wireframe.tableRow"),
					fontSize: 12,
				});
				if (index < 2) {
					line({
						x: left + 16,
						y: top + 88 + index * 46,
						width: 428,
						height: 1,
						points: [
							[0, 0],
							[428, 0],
						],
						stroke: COLORS.mutedStrong,
					});
				}
			}
			break;
		}
		case "modal": {
			const left = x - 180;
			const top = y - 120;
			rectangle({
				x: left,
				y: top,
				width: 360,
				height: 240,
				fill: COLORS.page,
				strokeWidth: 2,
				cornerRadius: 12,
			});
			title(
				left + 24,
				top + 24,
				280,
				resolveText(options, "wireframe.modalTitle"),
			);
			text({
				x: left + 322,
				y: top + 20,
				width: 18,
				height: 20,
				text: "×",
				fontSize: 18,
				textAlign: "center",
			});
			body(
				left + 24,
				top + 72,
				312,
				resolveText(options, "wireframe.modalBody"),
			);
			rectangle({
				x: left + 212,
				y: top + 176,
				width: 124,
				height: 40,
				fill: COLORS.textStrong,
				stroke: COLORS.textStrong,
				text: resolveText(options, "wireframe.button"),
				textColor: COLORS.page,
				fontSize: 12,
				textAlign: "center",
			});
			break;
		}
		case "pagination": {
			const left = x - 166;
			const labels = [
				resolveText(options, "wireframe.previous"),
				"1",
				"2",
				"3",
				resolveText(options, "wireframe.next"),
			];
			const widths = [82, 36, 36, 36, 62];
			let cursor = left;
			for (let index = 0; index < labels.length; index++) {
				rectangle({
					x: cursor,
					y: y - 18,
					width: widths[index],
					height: 36,
					fill: index === 1 ? COLORS.textStrong : COLORS.page,
					stroke: index === 1 ? COLORS.textStrong : COLORS.stroke,
					text: labels[index],
					textColor: index === 1 ? COLORS.page : COLORS.textStrong,
					fontSize: 11,
					textAlign: "center",
					cornerRadius: 6,
				});
				cursor += widths[index] + 8;
			}
			break;
		}
		case "bottom-nav": {
			const left = x - 180;
			rectangle({
				x: left,
				y: y - 34,
				width: 360,
				height: 68,
				fill: COLORS.page,
				cornerRadius: 10,
			});
			const labels = [
				"wireframe.home",
				"wireframe.explore",
				"wireframe.profile",
			];
			for (let index = 0; index < 3; index++) {
				ellipse({
					x: left + 49 + index * 120,
					y: y - 21,
					width: 18,
					height: 18,
					fill: index === 0 ? COLORS.textStrong : COLORS.muted,
				});
				text({
					x: left + 18 + index * 120,
					y: y + 5,
					width: 82,
					height: 18,
					text: resolveText(options, labels[index]),
					fontSize: 10,
					fontWeight: index === 0 ? "bold" : "normal",
					textAlign: "center",
				});
			}
			break;
		}
		case "divider": {
			line({
				x: x - 180,
				y,
				width: 360,
				height: 1,
				points: [
					[0, 0],
					[360, 0],
				],
				stroke: COLORS.mutedStrong,
			});
			break;
		}
		case "skeleton": {
			const left = x - 160;
			rectangle({
				x: left,
				y: y - 58,
				width: 220,
				height: 22,
				fill: COLORS.mutedStrong,
				stroke: "transparent",
				cornerRadius: 6,
			});
			for (let index = 0; index < 3; index++) {
				rectangle({
					x: left,
					y: y - 18 + index * 32,
					width: index === 2 ? 230 : 320,
					height: 14,
					fill: COLORS.muted,
					stroke: "transparent",
					cornerRadius: 5,
				});
			}
			break;
		}
	}

	const maxWidth =
		viewport === "mobile" ? 340 : viewport === "tablet" ? 640 : null;
	if (!maxWidth || builder.elements.length === 0) return builder.elements;
	const minX = Math.min(...builder.elements.map((element) => element.x));
	const minY = Math.min(...builder.elements.map((element) => element.y));
	const maxX = Math.max(
		...builder.elements.map((element) => element.x + element.width),
	);
	const maxY = Math.max(
		...builder.elements.map((element) => element.y + element.height),
	);
	const factor = Math.min(1, maxWidth / Math.max(maxX - minX, 1));
	if (factor === 1) return builder.elements;
	const centerX = (minX + maxX) / 2;
	const centerY = (minY + maxY) / 2;
	return builder.elements.map((element) => ({
		...element,
		x: centerX + (element.x - centerX) * factor,
		y: centerY + (element.y - centerY) * factor,
		width: element.width * factor,
		height: element.height * factor,
		...(element.points
			? {
					points: element.points.map(
						([pointX, pointY]) =>
							[pointX * factor, pointY * factor] as [number, number],
					),
				}
			: {}),
		...(element.fontSize ? { fontSize: element.fontSize * factor } : {}),
		...(element.cornerRadius
			? { cornerRadius: element.cornerRadius * factor }
			: {}),
		strokeWidth: element.strokeWidth * factor,
	}));
}

function addImagePlaceholder(
	builder: WireframeBuilder,
	options: {
		viewport: WireframeViewport;
		screenId: string;
		x: number;
		y: number;
		width: number;
		height: number;
	},
) {
	const groupId = builder.options.defaults.createId();
	const meta = {
		viewport: options.viewport,
		screenId: options.screenId,
		role: "image-placeholder",
		groupId,
	};
	addRectangle(builder, meta, {
		x: options.x,
		y: options.y,
		width: options.width,
		height: options.height,
		fill: COLORS.surface,
		strokeStyle: "dashed",
		cornerRadius: 12,
	});
	addLine(builder, meta, {
		x: options.x,
		y: options.y,
		width: options.width,
		height: options.height,
		points: [
			[0, 0],
			[options.width, options.height],
		],
		stroke: COLORS.mutedStrong,
	});
	addLine(builder, meta, {
		x: options.x,
		y: options.y,
		width: options.width,
		height: options.height,
		points: [
			[options.width, 0],
			[0, options.height],
		],
		stroke: COLORS.mutedStrong,
	});
	addText(builder, meta, {
		x: options.x + 18,
		y: options.y + options.height / 2 - 10,
		width: options.width - 36,
		height: 20,
		text: resolveText(builder.options, "wireframe.imagePlaceholder"),
		fontSize: 13,
		textAlign: "center",
		stroke: COLORS.stroke,
	});
}

function addFeatureCard(
	builder: WireframeBuilder,
	options: {
		viewport: WireframeViewport;
		screenId: string;
		x: number;
		y: number;
		width: number;
		height: number;
		titleKey: string;
		compact?: boolean;
	},
) {
	const groupId = builder.options.defaults.createId();
	const meta = {
		viewport: options.viewport,
		screenId: options.screenId,
		role: "feature-card",
		groupId,
	};
	addRectangle(builder, meta, {
		x: options.x,
		y: options.y,
		width: options.width,
		height: options.height,
		fill: COLORS.page,
		stroke: COLORS.mutedStrong,
		cornerRadius: 10,
	});
	const iconSize = options.compact ? 32 : 38;
	addRectangle(builder, meta, {
		x: options.x + 16,
		y: options.y + 16,
		width: iconSize,
		height: iconSize,
		fill: COLORS.muted,
		stroke: COLORS.stroke,
		cornerRadius: 6,
	});
	addText(builder, meta, {
		x: options.x + (options.compact ? 62 : 16),
		y: options.y + (options.compact ? 15 : 68),
		width: options.width - (options.compact ? 78 : 32),
		height: 22,
		text: resolveText(builder.options, options.titleKey),
		stroke: COLORS.textStrong,
		fontSize: options.compact ? 15 : 16,
		fontWeight: "bold",
	});
	addText(builder, meta, {
		x: options.x + (options.compact ? 62 : 16),
		y: options.y + (options.compact ? 40 : 96),
		width: options.width - (options.compact ? 78 : 32),
		height: options.compact ? 28 : 38,
		text: resolveText(builder.options, "wireframe.benefitBody"),
		stroke: COLORS.stroke,
		fontSize: 12,
	});
}

function addDesktopContent(builder: WireframeBuilder, screen: CanvasElement) {
	const x = screen.x;
	const y = screen.y;
	const viewport = "desktop" as const;
	const component = (role: string) => ({
		viewport,
		screenId: screen.id,
		role,
		groupId: builder.options.defaults.createId(),
	});

	addRectangle(builder, component("brand"), {
		x: x + 48,
		y: y + 65,
		width: 88,
		height: 28,
		fill: COLORS.muted,
		text: resolveText(builder.options, "wireframe.brand"),
		textColor: COLORS.textStrong,
		fontSize: 12,
		fontWeight: "bold",
		textAlign: "center",
		fontFamily:
			builder.options.fontFamily ?? builder.options.defaults.fontFamily,
	});
	addText(builder, component("navigation"), {
		x: x + 520,
		y: y + 69,
		width: 260,
		height: 22,
		text: resolveText(builder.options, "wireframe.navigation"),
		textAlign: "right",
		fontSize: 13,
	});
	addRectangle(builder, component("navigation-action"), {
		x: x + 798,
		y: y + 63,
		width: 74,
		height: 30,
		fill: COLORS.textStrong,
		stroke: COLORS.textStrong,
		text: resolveText(builder.options, "wireframe.primaryAction"),
		textColor: COLORS.page,
		fontSize: 11,
		fontWeight: "bold",
		textAlign: "center",
		fontFamily:
			builder.options.fontFamily ?? builder.options.defaults.fontFamily,
	});
	addLine(builder, component("navigation-divider"), {
		x: x + 48,
		y: y + 106,
		width: 824,
		height: 1,
		points: [
			[0, 0],
			[824, 0],
		],
		stroke: COLORS.mutedStrong,
	});

	addText(builder, component("hero-title"), {
		x: x + 48,
		y: y + 154,
		width: 390,
		height: 84,
		text: resolveText(builder.options, "wireframe.heroTitle"),
		stroke: COLORS.textStrong,
		fontSize: 32,
		fontWeight: "bold",
	});
	addText(builder, component("hero-body"), {
		x: x + 48,
		y: y + 250,
		width: 370,
		height: 48,
		text: resolveText(builder.options, "wireframe.heroBody"),
		stroke: COLORS.stroke,
		fontSize: 16,
	});
	addRectangle(builder, component("primary-action"), {
		x: x + 48,
		y: y + 320,
		width: 132,
		height: 42,
		fill: COLORS.textStrong,
		stroke: COLORS.textStrong,
		text: resolveText(builder.options, "wireframe.primaryAction"),
		textColor: COLORS.page,
		fontSize: 14,
		fontWeight: "bold",
		textAlign: "center",
		fontFamily:
			builder.options.fontFamily ?? builder.options.defaults.fontFamily,
	});
	addRectangle(builder, component("secondary-action"), {
		x: x + 194,
		y: y + 320,
		width: 124,
		height: 42,
		fill: COLORS.page,
		text: resolveText(builder.options, "wireframe.secondaryAction"),
		textColor: COLORS.textStrong,
		fontSize: 14,
		fontWeight: "bold",
		textAlign: "center",
		fontFamily:
			builder.options.fontFamily ?? builder.options.defaults.fontFamily,
	});
	addImagePlaceholder(builder, {
		viewport,
		screenId: screen.id,
		x: x + 492,
		y: y + 136,
		width: 380,
		height: 246,
	});

	const cardWidth = 250;
	const cardY = y + 430;
	[
		"wireframe.benefitOne",
		"wireframe.benefitTwo",
		"wireframe.benefitThree",
	].forEach((titleKey, index) => {
		addFeatureCard(builder, {
			viewport,
			screenId: screen.id,
			x: x + 48 + index * (cardWidth + 37),
			y: cardY,
			width: cardWidth,
			height: 148,
			titleKey,
		});
	});
	addText(builder, component("footer"), {
		x: x + 48,
		y: y + 630,
		width: 824,
		height: 20,
		text: resolveText(builder.options, "wireframe.footer"),
		stroke: COLORS.stroke,
		fontSize: 12,
		textAlign: "center",
	});
}

function addMobileContent(builder: WireframeBuilder, screen: CanvasElement) {
	const x = screen.x;
	const y = screen.y;
	const viewport = "mobile" as const;
	const component = (role: string) => ({
		viewport,
		screenId: screen.id,
		role,
		groupId: builder.options.defaults.createId(),
	});

	addRectangle(builder, component("brand"), {
		x: x + 28,
		y: y + 61,
		width: 74,
		height: 26,
		fill: COLORS.muted,
		text: resolveText(builder.options, "wireframe.brand"),
		textColor: COLORS.textStrong,
		fontSize: 11,
		fontWeight: "bold",
		textAlign: "center",
		fontFamily:
			builder.options.fontFamily ?? builder.options.defaults.fontFamily,
	});
	const menuMeta = component("mobile-menu");
	for (let index = 0; index < 3; index++) {
		addLine(builder, menuMeta, {
			x: x + 266,
			y: y + 66 + index * 7,
			width: 25,
			height: 1,
			points: [
				[0, 0],
				[25, 0],
			],
			stroke: COLORS.textStrong,
			strokeWidth: 2,
		});
	}
	addText(builder, component("hero-title"), {
		x: x + 28,
		y: y + 112,
		width: 264,
		height: 64,
		text: resolveText(builder.options, "wireframe.heroTitle"),
		stroke: COLORS.textStrong,
		fontSize: 23,
		fontWeight: "bold",
		textAlign: "center",
	});
	addText(builder, component("hero-body"), {
		x: x + 36,
		y: y + 184,
		width: 248,
		height: 46,
		text: resolveText(builder.options, "wireframe.heroBody"),
		stroke: COLORS.stroke,
		fontSize: 13,
		textAlign: "center",
	});
	addRectangle(builder, component("primary-action"), {
		x: x + 70,
		y: y + 244,
		width: 180,
		height: 40,
		fill: COLORS.textStrong,
		stroke: COLORS.textStrong,
		text: resolveText(builder.options, "wireframe.primaryAction"),
		textColor: COLORS.page,
		fontSize: 13,
		fontWeight: "bold",
		textAlign: "center",
		fontFamily:
			builder.options.fontFamily ?? builder.options.defaults.fontFamily,
	});
	addImagePlaceholder(builder, {
		viewport,
		screenId: screen.id,
		x: x + 28,
		y: y + 310,
		width: 264,
		height: 134,
	});
	addFeatureCard(builder, {
		viewport,
		screenId: screen.id,
		x: x + 28,
		y: y + 470,
		width: 264,
		height: 78,
		titleKey: "wireframe.benefitOne",
		compact: true,
	});
	addFeatureCard(builder, {
		viewport,
		screenId: screen.id,
		x: x + 28,
		y: y + 562,
		width: 264,
		height: 78,
		titleKey: "wireframe.benefitTwo",
		compact: true,
	});
}

/**
 * Builds a low-fidelity responsive wireframe exclusively from canonical
 * CanvasElement records. The screen frames own their child elements through
 * frameId, while component groups remain independently editable.
 */
export function createWireframeTemplateElements(
	options: WireframeTemplateOptions,
): CanvasElement[] {
	const builder: WireframeBuilder = { elements: [], options };
	const desktopWidth = 920;
	const mobileWidth = 320;
	const gap = 64;
	const height = 680;
	const left = options.x - (desktopWidth + gap + mobileWidth) / 2;
	const top = options.y - height / 2;
	const desktop = addScreen(
		builder,
		"desktop",
		left,
		top,
		desktopWidth,
		height,
	);
	const mobile = addScreen(
		builder,
		"mobile",
		left + desktopWidth + gap,
		top,
		mobileWidth,
		height,
	);
	addDesktopContent(builder, desktop);
	addMobileContent(builder, mobile);
	return builder.elements;
}

export function getWireframeElementMeta(
	element: CanvasElement | null | undefined,
): WireframeElementMeta | null {
	if (!element || !element.customData) return null;
	const data = element.customData;
	if (
		(data.skedraType !== WIREFRAME_SCREEN_TYPE &&
			data.skedraType !== WIREFRAME_NODE_TYPE) ||
		(data.wireframeVersion !== WIREFRAME_VERSION &&
			data.wireframeVersion !== LEGACY_WIREFRAME_VERSION) ||
		(data.wireframeViewport !== "desktop" &&
			data.wireframeViewport !== "tablet" &&
			data.wireframeViewport !== "mobile") ||
		typeof data.wireframeRole !== "string"
	) {
		return null;
	}
	return {
		...(data as Omit<WireframeElementMeta, "wireframeScreenId">),
		wireframeScreenId:
			data.skedraType === WIREFRAME_SCREEN_TYPE
				? element.id
				: (element.frameId ?? null),
	};
}

/**
 * Resolves the canonical screen target for component insertion. This is
 * intentionally host-neutral so every UI inserts into selected wireframes in
 * the same way.
 */
export function resolveWireframeInsertionTarget(
	elements: ReadonlyMap<string, CanvasElement>,
	selectedElements: Iterable<CanvasElement>,
): WireframeInsertionTarget | null {
	for (const element of selectedElements) {
		const meta = getWireframeElementMeta(element);
		if (!meta) continue;
		const frameId =
			meta.skedraType === WIREFRAME_SCREEN_TYPE ? element.id : element.frameId;
		const frame = frameId ? elements.get(frameId) : undefined;
		return {
			frameId,
			viewport: meta.wireframeViewport,
			point: frame
				? {
						x: frame.x + frame.width / 2,
						y: frame.y + frame.height / 2,
					}
				: null,
		};
	}
	return null;
}
