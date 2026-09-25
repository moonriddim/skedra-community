import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

test("saved views default to hidden and retain explicit visibility across remounts", async () => {
	const browser = new Window({ url: "http://localhost" });
	for (const [key, value] of Object.entries({
		window: browser,
		document: browser.document,
		navigator: browser.navigator,
		HTMLElement: browser.HTMLElement,
		Element: browser.Element,
		Node: browser.Node,
		Event: browser.Event,
		IS_REACT_ACT_ENVIRONMENT: true,
	}))
		Object.defineProperty(globalThis, key, { configurable: true, value });
	const React = await import("react");
	Object.defineProperty(globalThis, "React", {
		configurable: true,
		value: React,
	});
	const { createRoot } = await import("react-dom/client");
	const { CanvasEditorSavedViewsBar } = await import("@skedra/canvas-editor");
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	const noop = () => {};
	let mount = 0;
	const render = async (presentationMode = false) => {
		await React.act(async () =>
			root.render(
				React.createElement(CanvasEditorSavedViewsBar, {
					key: ++mount,
					canUndo: false,
					canRedo: false,
					presentationMode,
					presenterMode: presentationMode,
					onUndo: noop,
					onRedo: noop,
					onFitViewport: noop,
					onZoomBy: noop,
					zoom: 1,
					views: [
						{
							id: "view",
							name: "Planning",
							x: 0,
							y: 0,
							width: 400,
							height: 225,
							createdAt: 1,
							updatedAt: 1,
						},
					],
					elements: new Map(),
					activeViewId: null,
					editingViewId: null,
					isCapturingView: false,
					onStartCaptureView: noop,
					onCancelCaptureView: noop,
					onSelectView: noop,
					onStartEditView: noop,
					onStopEditView: noop,
					onDeleteView: noop,
					onDuplicateView: noop,
					onMoveView: noop,
					onRenameView: noop,
					renderPreview: () => null,
				}),
			),
		);
	};
	const toggle = () => {
		const button = host.querySelector<HTMLButtonElement>(
			'[data-control="toggle-views"]',
		);
		assert.ok(button);
		return button;
	};
	const assertVisible = (visible: boolean) => {
		assert.equal(toggle().getAttribute("aria-pressed"), String(visible));
		assert.equal(host.textContent?.includes("Planning"), visible);
	};
	try {
		await render();
		assertVisible(false);
		await React.act(async () => toggle().click());
		assertVisible(true);
		await render();
		assertVisible(true);
		await React.act(async () => toggle().click());
		assertVisible(false);
		await render();
		assertVisible(false);
		// Presentation visibility must not overwrite the ordinary canvas preference.
		await render(true);
		assert.ok(host.textContent?.includes("Planning"));
		await render();
		assertVisible(false);
		// Creating a view opens the rail temporarily without changing the user's choice.
		const capture = host.querySelector<HTMLButtonElement>(
			'[data-control="save-view"]',
		);
		assert.ok(capture);
		await React.act(async () => capture.click());
		assertVisible(true);
		await render();
		assertVisible(false);
		Object.defineProperty(browser, "localStorage", {
			configurable: true,
			get() {
				throw new Error("Storage blocked");
			},
		});
		await render();
		assertVisible(false);
		await React.act(async () => toggle().click());
		assertVisible(true);
	} finally {
		await React.act(async () => root.unmount());
		await browser.happyDOM.close();
	}
});
