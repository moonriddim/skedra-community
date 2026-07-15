import {
	type CanvasElementFactoryDefaults,
	createBaseCanvasElement,
} from "./element-factory";
import type { CanvasElement } from "./types";

export const WIREFRAME_SCREEN_TYPE = "wireframe-screen";
export const WIREFRAME_NODE_TYPE = "wireframe-node";
export const WIREFRAME_VERSION = 1;

export type WireframeViewport = "desktop" | "mobile";

export interface WireframeTemplateOptions {
	x: number;
	y: number;
	defaults: CanvasElementFactoryDefaults;
	text?: (key: string) => string;
	fontFamily?: string;
}

export interface WireframeElementMeta {
	skedraType: typeof WIREFRAME_SCREEN_TYPE | typeof WIREFRAME_NODE_TYPE;
	wireframeVersion: typeof WIREFRAME_VERSION;
	wireframeViewport: WireframeViewport;
	wireframeRole: string;
	wireframeScreenId: string;
}

interface WireframeBuilder {
	elements: CanvasElement[];
	options: WireframeTemplateOptions;
}

interface WireframeNodeOptions {
	viewport: WireframeViewport;
	screenId: string;
	role: string;
	groupId: string;
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
		frameId: options.screenId,
		groupId: options.groupId,
		customData: {
			...customData,
			skedraType: WIREFRAME_NODE_TYPE,
			wireframeVersion: WIREFRAME_VERSION,
			wireframeViewport: options.viewport,
			wireframeRole: options.role,
			wireframeScreenId: options.screenId,
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
): CanvasElement {
	const labelKey =
		viewport === "desktop" ? "wireframe.desktopLabel" : "wireframe.mobileLabel";
	const screen = createBaseCanvasElement(builder.options.defaults, {
		type: "frame",
		x,
		y,
		width,
		height,
		fill: "transparent",
		stroke: COLORS.stroke,
		strokeWidth: 1.5,
		frameLabel: resolveText(builder.options, labelKey),
		customData: {
			skedraType: WIREFRAME_SCREEN_TYPE,
			wireframeVersion: WIREFRAME_VERSION,
			wireframeViewport: viewport,
			wireframeRole: "screen",
			wireframeScreenId: "",
		},
	});
	screen.customData = {
		...screen.customData,
		wireframeScreenId: screen.id,
	};
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
	addBrowserChrome(builder, viewport, screen.id, x, y, width);
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
		data.wireframeVersion !== WIREFRAME_VERSION ||
		(data.wireframeViewport !== "desktop" &&
			data.wireframeViewport !== "mobile") ||
		typeof data.wireframeRole !== "string" ||
		typeof data.wireframeScreenId !== "string"
	) {
		return null;
	}
	return data as unknown as WireframeElementMeta;
}
