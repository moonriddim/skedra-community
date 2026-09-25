import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

test("kanban controls edit on the card, retain drafts and leave previews and locked cards passive", async () => {
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
	const { createElement: h } = React;
	const { createRoot } = await import("react-dom/client");
	const { flushSync } = await import("react-dom");
	const { CanvasScene, createKanbanCardElement } = await import(
		"@skedra/canvas-core"
	);
	const { CanvasRenderer } = await import("@skedra/canvas-react");
	const card = createKanbanCardElement(
		{ createId: () => "card", stroke: "#111" },
		{ x: 0, y: 0, title: "Original" },
	);
	card.customData = {
		...card.customData,
		dueDate: "2026-10-01T14:30",
		checklist: [{ id: "task", text: "Test task", completed: false }],
	};
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const edits: unknown[] = [];
	let details = 0;
	let canvasPointers = 0;
	const render = (interactive = true) =>
		flushSync(() =>
			root.render(
				h(
					"svg",
					{ onPointerDown: () => canvasPointers++ },
					h(CanvasRenderer, {
						scene: CanvasScene.from([card]),
						selectedIds: new Set<string>(),
						config: {
							interactive,
							actions: {
								updateKanbanCard: (_id, changes) => edits.push(changes),
								openKanbanCard: () => details++,
							},
						},
					}),
				),
			),
		);
	const click = (element: Element) =>
		flushSync(() =>
			element.dispatchEvent(
				new browser.MouseEvent("click", { bubbles: true }) as unknown as Event,
			),
		);
	const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
	try {
		render();
		const title = container.querySelector(
			'button[aria-label="Edit card title"]',
		);
		assert.ok(title);
		click(title);
		const input = container.querySelector("textarea");
		assert.ok(input);
		assert.equal(document.activeElement, input);
		// A remote title change must not reset the active draft.
		card.text = "Remote update";
		render();
		assert.equal(input.value, "Original");
		flushSync(() =>
			input.dispatchEvent(
				new browser.KeyboardEvent("keydown", {
					bubbles: true,
					key: "Escape",
				}) as unknown as Event,
			),
		);
		assert.deepEqual(edits, []);
		assert.equal(container.querySelector("textarea"), null);
		const check = container.querySelector('input[type="checkbox"]');
		assert.ok(check);
		click(check);
		assert.deepEqual(edits, [{ toggleChecklistItem: "task" }]);
		const select = container.querySelector("select");
		assert.ok(select);
		select.value = "urgent";
		flushSync(() =>
			select.dispatchEvent(
				new browser.Event("change", { bubbles: true }) as unknown as Event,
			),
		);
		assert.deepEqual(edits.at(-1), { priority: "urgent" });
		const titleAgain = container.querySelector(
			'button[aria-label="Edit card title"]',
		);
		assert.ok(titleAgain);
		click(titleAgain);
		const draft = container.querySelector("textarea");
		assert.ok(draft);
		// Blurring immediately after input must commit the latest DOM value.
		draft.value = "Latest typed title";
		flushSync(() => draft.blur());
		assert.deepEqual(edits.at(-1), { title: "Latest typed title" });
		const detail = container.querySelector('button[aria-label="Details"]');
		assert.ok(detail);
		click(detail);
		assert.equal(details, 1);
		flushSync(() =>
			check.dispatchEvent(
				new browser.PointerEvent("pointerdown", {
					bubbles: true,
					pointerType: "touch",
				}) as unknown as Event,
			),
		);
		assert.equal(canvasPointers, 0);
		for (const passive of ["preview", "locked"]) {
			card.locked = passive === "locked";
			render(passive !== "preview");
			await tick();
			assert.equal(
				container.querySelector("button, input, select, textarea"),
				null,
			);
			const shape = container.querySelector("foreignObject");
			assert.ok(shape);
			flushSync(() =>
				shape.dispatchEvent(
					new browser.PointerEvent("pointerdown", {
						bubbles: true,
					}) as unknown as Event,
				),
			);
		}
		assert.equal(canvasPointers, 2);
	} finally {
		flushSync(() => root.unmount());
		await browser.happyDOM.close();
	}
});
