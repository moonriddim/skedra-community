import assert from "node:assert/strict";
import test from "node:test";
import type { KanbanChecklistItem } from "@skedra/canvas-core";
import { Window } from "happy-dom";

test("adding a checkpoint focuses its input; Enter continues the list and empty rows are discarded", async () => {
	const browser = new Window({ url: "http://localhost" });
	for (const [key, value] of Object.entries({
		window: browser,
		document: browser.document,
		navigator: browser.navigator,
		HTMLElement: browser.HTMLElement,
		Element: browser.Element,
		Node: browser.Node,
		Event: browser.Event,
		localStorage: browser.localStorage,
	}))
		Object.defineProperty(globalThis, key, { configurable: true, value });
	const React = await import("react");
	Object.defineProperty(globalThis, "React", {
		configurable: true,
		value: React,
	});
	const { createElement: h } = React;
	const { createRoot } = await import("react-dom/client");
	const { flushSync } = await import("react-dom");
	const { KanbanChecklistEditor } = await import("./kanban-checklist-editor");
	const { I18nProvider, loadI18nMessages } = await import("@/lib/i18n");
	await loadI18nMessages("de");
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	let items: KanbanChecklistItem[] = [];
	const render = () =>
		root.render(
			h(
				I18nProvider,
				null,
				h(KanbanChecklistEditor, {
					items,
					hideCompleted: false,
					onChange: (next) => {
						items = next;
						render();
					},
				}),
			),
		);
	try {
		flushSync(render);
		const add = host.querySelector("button");
		assert.ok(add);
		flushSync(() => add.click());
		assert.equal(items.length, 1);
		assert.equal(
			document.activeElement?.getAttribute("placeholder"),
			"Punkt beschreiben…",
		);
		items = [{ ...items[0], text: "First task" }];
		flushSync(render);
		const first = document.activeElement;
		assert.ok(first);
		flushSync(() =>
			first.dispatchEvent(
				new browser.KeyboardEvent("keydown", {
					bubbles: true,
					key: "Enter",
				}) as unknown as Event,
			),
		);
		assert.equal(items.length, 2);
		assert.equal(
			document.activeElement?.getAttribute("aria-label"),
			"Checkliste 2",
		);
		const empty = document.activeElement;
		assert.ok(empty);
		flushSync(() =>
			empty.dispatchEvent(
				new browser.KeyboardEvent("keydown", {
					bubbles: true,
					key: "Enter",
				}) as unknown as Event,
			),
		);
		assert.deepEqual(
			items.map((item) => item.text),
			["First task"],
		);
	} finally {
		flushSync(() => root.unmount());
		await browser.happyDOM.close();
	}
});
