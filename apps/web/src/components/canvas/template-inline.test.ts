import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

test("template add and double-click actions create notes without opening section text; previews and locked sections are passive", async () => {
	const browser = new Window({ url: "http://localhost" });
	for (const [key, value] of Object.entries({
		window: browser,
		document: browser.document,
		navigator: browser.navigator,
		HTMLElement: browser.HTMLElement,
		Element: browser.Element,
		Node: browser.Node,
		Event: browser.Event,
	}))
		Object.defineProperty(globalThis, key, { configurable: true, value });
	const React = await import("react");
	Object.defineProperty(globalThis, "React", {
		configurable: true,
		value: React,
	});
	const { createRoot } = await import("react-dom/client");
	const { flushSync } = await import("react-dom");
	const {
		CanvasScene,
		createCanvasTemplateElements,
		createCanvasTemplateStickyNote,
	} = await import("@skedra/canvas-core");
	const { CanvasRenderer } = await import("@skedra/canvas-react");
	let id = 0;
	const defaults = { createId: () => String(id++), stroke: "#111" };
	const section = createCanvasTemplateElements({
		id: "retrospective",
		x: 0,
		y: 0,
		defaults,
	}).find((element) => element.type === "frame");
	assert.ok(section);
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	let additions = 0;
	let canvasDoubleClicks = 0;
	const render = (interactive = true, filled = false) => {
		const note = filled
			? createCanvasTemplateStickyNote({
					defaults,
					section,
					existingElements: [],
					text: "An idea",
				})
			: null;
		flushSync(() =>
			root.render(
				React.createElement(
					"svg",
					{ onDoubleClick: () => canvasDoubleClicks++ },
					React.createElement(CanvasRenderer, {
						scene: CanvasScene.from(note ? [section, note] : [section]),
						selectedIds: new Set<string>(),
						config: {
							interactive,
							actions: {
								addTemplateSticky: (sectionId) => {
									assert.equal(sectionId, section.id);
									additions++;
								},
							},
						},
					}),
				),
			),
		);
	};
	try {
		render();
		const button = container.querySelector("button");
		assert.ok(button);
		button.dispatchEvent(
			new browser.MouseEvent("click", { bubbles: true }) as unknown as Event,
		);
		assert.equal(additions, 1);
		const hitArea = container.querySelector("rect > title")?.parentElement;
		assert.ok(hitArea);
		hitArea.dispatchEvent(
			new browser.MouseEvent("dblclick", { bubbles: true }) as unknown as Event,
		);
		assert.equal(additions, 2);
		assert.equal(canvasDoubleClicks, 0);
		assert.ok(container.textContent?.includes("What went well?"));
		render(true, true);
		assert.equal(container.textContent?.includes("What went well?"), false);
		assert.ok(container.textContent?.includes("1 notes"));
		render(false);
		assert.equal(container.querySelector("button"), null);
		section.locked = true;
		render();
		assert.equal(container.querySelector("button"), null);
	} finally {
		flushSync(() => root.unmount());
		browser.happyDOM.abort();
	}
});
