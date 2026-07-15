import type { CanvasElementFactoryDefaults } from "./element-factory";
import type { CanvasElement } from "./types";
import {
	type WireframeComponentId,
	type WireframeViewport,
	createWireframeComponentElements,
	createWireframeScreenElements,
	createWireframeTemplateElements,
} from "./wireframe";

export const WIREFRAME_PRESET_IDS = [
	"responsive-landing",
	"blank-desktop",
	"blank-tablet",
	"blank-mobile",
	"dashboard",
	"mobile-app",
	"login",
	"ecommerce",
	"settings",
] as const;

export type WireframePresetId = (typeof WIREFRAME_PRESET_IDS)[number];

export const WIREFRAME_BLANK_PRESET_IDS = [
	"blank-desktop",
	"blank-tablet",
	"blank-mobile",
] as const satisfies readonly WireframePresetId[];

export const WIREFRAME_STARTER_PRESET_IDS = [
	"responsive-landing",
	"dashboard",
	"mobile-app",
	"login",
	"ecommerce",
	"settings",
] as const satisfies readonly WireframePresetId[];

export interface WireframePresetOptions {
	preset: WireframePresetId;
	x: number;
	y: number;
	defaults: CanvasElementFactoryDefaults;
	text?: (key: string) => string;
	fontFamily?: string;
}

function translatedLabel(
	options: WireframePresetOptions,
	key: string,
	fallback: string,
) {
	return options.text?.(key) ?? fallback;
}

function tagPreset(
	elements: CanvasElement[],
	preset: WireframePresetId,
): CanvasElement[] {
	return elements.map((element) => ({
		...element,
		customData: {
			...element.customData,
			wireframePreset: preset,
		},
	}));
}

function screenFrame(elements: CanvasElement[]) {
	const frame = elements.find(
		(element) => element.customData?.skedraType === "wireframe-screen",
	);
	if (!frame) throw new Error("Wireframe screen preset must contain a frame");
	return frame;
}

function addComponent(
	elements: CanvasElement[],
	options: WireframePresetOptions,
	frame: CanvasElement,
	component: WireframeComponentId,
	x: number,
	y: number,
	viewport: WireframeViewport = "desktop",
) {
	elements.push(
		...createWireframeComponentElements({
			component,
			x,
			y,
			viewport,
			frameId: frame.id,
			defaults: options.defaults,
			text: options.text,
			fontFamily: options.fontFamily,
		}),
	);
}

function blankScreen(
	options: WireframePresetOptions,
	viewport: WireframeViewport,
	label: string,
) {
	return createWireframeScreenElements({
		x: options.x,
		y: options.y,
		viewport,
		label,
		defaults: options.defaults,
		text: options.text,
		fontFamily: options.fontFamily,
	});
}

function dashboardPreset(options: WireframePresetOptions) {
	const elements = createWireframeScreenElements({
		x: options.x,
		y: options.y,
		viewport: "desktop",
		width: 1120,
		height: 720,
		label: translatedLabel(
			options,
			"wireframe.dashboardLabel",
			"Desktop · Dashboard",
		),
		defaults: options.defaults,
		text: options.text,
		fontFamily: options.fontFamily,
	});
	const frame = screenFrame(elements);
	const left = frame.x;
	const top = frame.y;
	addComponent(elements, options, frame, "sidebar", left + 125, top + 390);
	addComponent(elements, options, frame, "topbar", left + 760, top + 82);
	addComponent(elements, options, frame, "breadcrumb", left + 690, top + 132);
	addComponent(elements, options, frame, "card", left + 390, top + 286);
	addComponent(elements, options, frame, "card", left + 675, top + 286);
	addComponent(elements, options, frame, "card", left + 960, top + 286);
	addComponent(elements, options, frame, "table", left + 680, top + 548);
	return elements;
}

function mobileAppPreset(options: WireframePresetOptions) {
	const elements = createWireframeScreenElements({
		x: options.x,
		y: options.y,
		viewport: "mobile",
		label: translatedLabel(options, "wireframe.mobileAppLabel", "Mobile · App"),
		defaults: options.defaults,
		text: options.text,
		fontFamily: options.fontFamily,
	});
	const frame = screenFrame(elements);
	const center = frame.x + frame.width / 2;
	const top = frame.y;
	addComponent(
		elements,
		options,
		frame,
		"text-block",
		center,
		top + 98,
		"mobile",
	);
	addComponent(elements, options, frame, "search", center, top + 184, "mobile");
	addComponent(elements, options, frame, "card", center, top + 344, "mobile");
	addComponent(elements, options, frame, "list", center, top + 586, "mobile");
	addComponent(
		elements,
		options,
		frame,
		"bottom-nav",
		center,
		top + 792,
		"mobile",
	);
	return elements;
}

function loginPreset(options: WireframePresetOptions) {
	const elements = createWireframeScreenElements({
		x: options.x,
		y: options.y,
		viewport: "desktop",
		label: translatedLabel(options, "wireframe.loginLabel", "Desktop · Login"),
		defaults: options.defaults,
		text: options.text,
		fontFamily: options.fontFamily,
	});
	const frame = screenFrame(elements);
	const left = frame.x;
	const top = frame.y;
	addComponent(elements, options, frame, "image", left + 260, top + 360);
	addComponent(elements, options, frame, "text-block", left + 705, top + 178);
	addComponent(elements, options, frame, "input", left + 705, top + 306);
	addComponent(elements, options, frame, "input", left + 705, top + 400);
	addComponent(elements, options, frame, "checkbox", left + 638, top + 466);
	addComponent(elements, options, frame, "button", left + 705, top + 526);
	return elements;
}

function ecommercePreset(options: WireframePresetOptions) {
	const elements = createWireframeScreenElements({
		x: options.x,
		y: options.y,
		viewport: "desktop",
		width: 1120,
		height: 720,
		label: translatedLabel(
			options,
			"wireframe.ecommerceLabel",
			"Desktop · Product",
		),
		defaults: options.defaults,
		text: options.text,
		fontFamily: options.fontFamily,
	});
	const frame = screenFrame(elements);
	const left = frame.x;
	const top = frame.y;
	addComponent(elements, options, frame, "navbar", left + 560, top + 90);
	addComponent(elements, options, frame, "breadcrumb", left + 560, top + 140);
	addComponent(elements, options, frame, "image", left + 310, top + 340);
	addComponent(elements, options, frame, "text-block", left + 820, top + 225);
	addComponent(elements, options, frame, "select", left + 820, top + 350);
	addComponent(elements, options, frame, "button", left + 820, top + 440);
	addComponent(elements, options, frame, "tabs", left + 560, top + 586);
	return elements;
}

function settingsPreset(options: WireframePresetOptions) {
	const elements = createWireframeScreenElements({
		x: options.x,
		y: options.y,
		viewport: "desktop",
		width: 1040,
		height: 720,
		label: translatedLabel(
			options,
			"wireframe.settingsLabel",
			"Desktop · Settings",
		),
		defaults: options.defaults,
		text: options.text,
		fontFamily: options.fontFamily,
	});
	const frame = screenFrame(elements);
	const left = frame.x;
	const top = frame.y;
	addComponent(elements, options, frame, "sidebar", left + 125, top + 390);
	addComponent(elements, options, frame, "topbar", left + 730, top + 82);
	addComponent(elements, options, frame, "tabs", left + 640, top + 168);
	addComponent(elements, options, frame, "input", left + 540, top + 280);
	addComponent(elements, options, frame, "input", left + 820, top + 280);
	addComponent(elements, options, frame, "textarea", left + 680, top + 410);
	addComponent(elements, options, frame, "toggle", left + 430, top + 522);
	addComponent(elements, options, frame, "button", left + 850, top + 590);
	return elements;
}

/** Creates complete starter screens while keeping every object editable. */
export function createWireframePresetElements(
	options: WireframePresetOptions,
): CanvasElement[] {
	let elements: CanvasElement[];
	switch (options.preset) {
		case "responsive-landing":
			elements = createWireframeTemplateElements(options);
			break;
		case "blank-desktop":
			elements = blankScreen(
				options,
				"desktop",
				translatedLabel(
					options,
					"wireframe.blankDesktopLabel",
					"Desktop · Blank",
				),
			);
			break;
		case "blank-tablet":
			elements = blankScreen(
				options,
				"tablet",
				translatedLabel(
					options,
					"wireframe.blankTabletLabel",
					"Tablet · Blank",
				),
			);
			break;
		case "blank-mobile":
			elements = blankScreen(
				options,
				"mobile",
				translatedLabel(
					options,
					"wireframe.blankMobileLabel",
					"Mobile · Blank",
				),
			);
			break;
		case "dashboard":
			elements = dashboardPreset(options);
			break;
		case "mobile-app":
			elements = mobileAppPreset(options);
			break;
		case "login":
			elements = loginPreset(options);
			break;
		case "ecommerce":
			elements = ecommercePreset(options);
			break;
		case "settings":
			elements = settingsPreset(options);
			break;
	}
	return tagPreset(elements, options.preset);
}
