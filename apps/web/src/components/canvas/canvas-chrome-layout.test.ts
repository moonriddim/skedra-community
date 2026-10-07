import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

test("canvas insets follow wrapped chrome, board header movement and mode changes", async () => {
	const browser = new Window({ url: "http://localhost" });
	const observers: Array<{ callback: () => void; disconnected: boolean }> = [];
	class ResizeObserverMock {
		state: { callback: () => void; disconnected: boolean };
		constructor(callback: () => void) {
			this.state = { callback, disconnected: false };
			observers.push(this.state);
		}
		observe() {}
		disconnect() {
			this.state.disconnected = true;
		}
	}
	for (const [key, value] of Object.entries({
		window: browser,
		document: browser.document,
		navigator: browser.navigator,
		HTMLElement: browser.HTMLElement,
		Element: browser.Element,
		Node: browser.Node,
		MutationObserver: browser.MutationObserver,
		ResizeObserver: ResizeObserverMock,
		IS_REACT_ACT_ENVIRONMENT: true,
	}))
		Object.defineProperty(globalThis, key, { configurable: true, value });
	const React = await import("react");
	const { createRoot } = await import("react-dom/client");
	const { useCanvasChromeInset } = await import("./use-canvas-chrome-inset");
	const page = document.createElement("div");
	page.className = "skedra-canvas-page";
	const canvas = document.createElement("div");
	canvas.className = "canvas-editor";
	page.append(canvas);
	document.body.append(page);
	let dockBottom = 180;
	let dockTop = 60;
	let canvasBottom = 800;
	const rect = (top: number, bottom: number) =>
		({
			top,
			bottom,
			left: 0,
			right: 300,
			width: 300,
			height: bottom - top,
			x: 0,
			y: top,
			toJSON: () => ({}),
		}) as DOMRect;
	canvas.getBoundingClientRect = () => rect(20, canvasBottom);
	let edge: "top" | "presenter" = "top";
	function Dock({ active }: { active: boolean }) {
		const ref = useCanvasChromeInset(edge, active);
		return React.createElement(
			"div",
			{
				ref: (element: HTMLDivElement | null) => {
					ref.current = element;
					if (element)
						element.getBoundingClientRect = () => rect(dockTop, dockBottom);
				},
			},
			"Live participants and controls",
		);
	}
	const root = createRoot(canvas);
	const inset = (name = "top") =>
		canvas.style.getPropertyValue(`--skedra-canvas-${name}-inset`);
	try {
		await React.act(async () =>
			root.render(React.createElement(Dock, { active: true })),
		);
		assert.equal(inset(), "172px");
		dockBottom = 240;
		for (const observer of observers.filter((o) => !o.disconnected))
			observer.callback();
		assert.equal(
			inset(),
			"232px",
			"wrapped participants reserve their increased height",
		);
		dockBottom = 300;
		page.style.setProperty("--skedra-board-header-inset", "120px");
		await browser.happyDOM.waitUntilComplete();
		assert.equal(
			inset(),
			"292px",
			"a wrapped board header also moves the dock reservation",
		);
		await React.act(async () =>
			root.render(React.createElement(Dock, { active: false })),
		);
		assert.equal(
			inset(),
			"",
			"hidden chrome releases the reserved canvas area",
		);
		edge = "presenter";
		dockTop = 560;
		dockBottom = 680;
		await React.act(async () =>
			root.render(React.createElement(Dock, { active: true })),
		);
		assert.equal(inset("presenter"), "252px");
		canvasBottom = 700;
		for (const observer of observers.filter((o) => !o.disconnected))
			observer.callback();
		assert.equal(
			inset("presenter"),
			"152px",
			"resizing keeps notes above presenter controls",
		);
	} finally {
		await React.act(async () => root.unmount());
		await browser.happyDOM.abort();
	}
	assert.equal(inset("presenter"), "");
	assert(observers.every((o) => o.disconnected));
});
