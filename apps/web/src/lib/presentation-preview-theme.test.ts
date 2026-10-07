import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { clonePresentationPreviewSvg } from "./presentation-preview-theme";

test("standalone preview retains custom Kanban colors without pinning the live theme", (t) => {
	const browser = new Window();
	const original = Object.getOwnPropertyDescriptor(
		globalThis,
		"getComputedStyle",
	);
	Object.defineProperty(globalThis, "getComputedStyle", {
		configurable: true,
		value: browser.getComputedStyle.bind(browser),
	});
	t.after(() => {
		if (original)
			Object.defineProperty(globalThis, "getComputedStyle", original);
		else Reflect.deleteProperty(globalThis, "getComputedStyle");
		void browser.happyDOM.close();
	});
	browser.document.body.innerHTML =
		'<style>:root { --background: #fff; --kanban-card-bg: #ffffff; --kanban-card-text: #111111; } :root.dark { --background: #111; --kanban-card-bg: #2a2e36; --kanban-card-text: #ffffff; }</style><svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:var(--kanban-card-bg)"/></svg>';
	const svg = browser.document.querySelector("svg");
	assert.ok(svg);
	// happy-dom does not resolve inherited custom properties on SVG elements.
	svg.style.setProperty("--kanban-card-bg", "#ffffff");
	svg.style.setProperty("--kanban-card-text", "#111111");
	const light = clonePresentationPreviewSvg(svg as unknown as SVGSVGElement);
	assert.equal(light.style.getPropertyValue("--kanban-card-bg"), "#ffffff");
	assert.equal(svg.style.getPropertyValue("--kanban-card-bg"), "#ffffff");
	svg.style.setProperty("--kanban-card-bg", "#2a2e36");
	svg.style.setProperty("--kanban-card-text", "#ffffff");
	const dark = clonePresentationPreviewSvg(svg as unknown as SVGSVGElement);
	assert.equal(dark.style.getPropertyValue("--kanban-card-bg"), "#2a2e36");
	assert.equal(dark.style.getPropertyValue("--kanban-card-text"), "#ffffff");
	assert.equal(light.style.getPropertyValue("--kanban-card-bg"), "#ffffff");
});
