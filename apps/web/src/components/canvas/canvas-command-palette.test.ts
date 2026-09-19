import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

test("a closed command palette survives rapid canvas pan updates in production React", async () => {
	// Development React only warns about some update loops. The reported #185
	// crashes the production root, so exercise that exact renderer here.
	process.env.NODE_ENV = "production";
	const browser = new Window({ url: "http://localhost" });
	const globals = {
		window: browser,
		document: browser.document,
		navigator: browser.navigator,
		HTMLElement: browser.HTMLElement,
		Element: browser.Element,
		Node: browser.Node,
		DocumentFragment: browser.DocumentFragment,
		MutationObserver: browser.MutationObserver,
		CustomEvent: browser.CustomEvent,
		Event: browser.Event,
		localStorage: browser.localStorage,
		getComputedStyle: browser.getComputedStyle.bind(browser),
		requestAnimationFrame: browser.requestAnimationFrame.bind(browser),
		cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser),
	};
	for (const [key, value] of Object.entries(globals)) {
		Object.defineProperty(globalThis, key, {
			configurable: true,
			value,
		});
	}
	const { createElement } = await import("react");
	const { createRoot } = await import("react-dom/client");
	const { flushSync } = await import("react-dom");
	const { CanvasCommandPalette } = await import("./canvas-command-palette");
	const { CANVAS_COMMAND_DEFINITIONS } = await import(
		"./canvas-command-registry"
	);
	const { create } = await import("zustand");
	const useCanvasStore = create<{ x: number; pan: (dx: number) => void }>(
		(set) => ({
			x: 0,
			pan: (dx) => set((state) => ({ x: state.x + dx })),
		}),
	);
	const { I18nProvider, loadI18nMessages } = await import("@/lib/i18n");
	await loadI18nMessages("de");
	const errors: unknown[] = [];
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container, {
		onUncaughtError: (error) => errors.push(error),
	});
	function Canvas() {
		const x = useCanvasStore((state) => state.x);
		// The real canvas recreates commands when its viewport/store changes.
		const commands = CANVAS_COMMAND_DEFINITIONS.map((command) => ({
			...command,
			run: () => {},
		}));
		return createElement(
			"main",
			{ "data-x": x },
			createElement(CanvasCommandPalette, {
				open: false,
				onOpenChange: () => {},
				commands,
			}),
		);
	}
	try {
		flushSync(() =>
			root.render(createElement(I18nProvider, null, createElement(Canvas))),
		);
		await new Promise((resolve) => setTimeout(resolve, 20));
		for (let i = 0; i < 1_000 && errors.length === 0; i++) {
			useCanvasStore.getState().pan(1);
			await Promise.resolve();
		}
		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.deepEqual(
			errors.map(String),
			[],
			"panning must not trigger React #185",
		);
		assert.equal(
			container.querySelector("main")?.getAttribute("data-x"),
			"1000",
		);
		assert.equal(document.querySelector('[role="dialog"]'), null);
	} finally {
		flushSync(() => root.unmount());
		await browser.happyDOM.close();
	}
});
