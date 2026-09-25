import assert from "node:assert/strict";
import test from "node:test";
import {
	type CanvasElement,
	applyCanvasMutationPlan,
	getSequenceDiagramSummaries,
} from "@skedra/canvas-core";
import { Window } from "happy-dom";

test("sequence builder creates immediately and uses one form to reply, edit and delete", async () => {
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
		ResizeObserver: browser.ResizeObserver,
	}))
		Object.defineProperty(globalThis, key, { configurable: true, value });
	const React = await import("react");
	Object.defineProperty(globalThis, "React", {
		configurable: true,
		value: React,
	});
	const { createRoot } = await import("react-dom/client");
	const { flushSync } = await import("react-dom");
	const { SequenceDiagramPanel } = await import("./sequence-diagram-panel");
	const { I18nProvider, loadI18nMessages } = await import("@/lib/i18n");
	await loadI18nMessages("de");
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	let elements = new Map<string, CanvasElement>();
	let historyBoundaries = 0;
	const render = () =>
		root.render(
			React.createElement(
				I18nProvider,
				null,
				React.createElement(SequenceDiagramPanel, {
					elements,
					selectedElements: [],
					onInsertElements: () =>
						assert.fail("Live creation must not enter placement mode"),
					onApplyMutationPlan: (plan) => {
						elements = new Map(
							applyCanvasMutationPlan([...elements.values()], plan).map(
								(element) => [element.id, element],
							),
						);
						render();
					},
					onHistoryBoundary: () => {
						historyBoundaries++;
					},
					onSelectIds: () => {},
					onFitElements: () => {},
					getViewportCenter: () => ({ x: 0, y: 0 }),
					onClose: () => assert.fail("Adding a step must keep the panel open"),
				}),
			),
		);
	const click = (selector: string) => {
		const button = host.querySelector<HTMLButtonElement>(selector);
		assert.ok(button, selector);
		assert.equal(button.disabled, false, selector);
		flushSync(() => button.click());
	};
	const fill = (selector: string, value: string) => {
		const input = host.querySelector<HTMLInputElement>(selector);
		assert.ok(input, selector);
		const setter = Object.getOwnPropertyDescriptor(
			browser.HTMLInputElement.prototype,
			"value",
		)?.set;
		assert.ok(setter);
		flushSync(() => {
			setter.call(input, value);
			input.dispatchEvent(
				new browser.Event("input", { bubbles: true }) as unknown as Event,
			);
		});
	};
	const messages = () =>
		getSequenceDiagramSummaries(elements.values())[0].messages;
	const composer = ".canvas-editor__sequence-sentence-composer";
	const submit =
		".canvas-editor__sequence-panel-composer-actions > button:first-child";
	try {
		flushSync(render);
		assert.equal(
			host.querySelector("textarea"),
			null,
			"Description is optional and collapsed",
		);
		fill(".canvas-editor__sequence-participant-form input", "Kunde");
		click(".canvas-editor__sequence-participant-form button");
		click(".canvas-editor__sequence-participant-chips > button");
		fill(".canvas-editor__sequence-participant-form input", "Service");
		click(".canvas-editor__sequence-participant-form button");
		assert.equal(elements.size, 0);
		fill(`${composer} input`, "Bestellung senden");
		click(submit);
		assert.equal(messages().length, 1);
		assert.equal(getSequenceDiagramSummaries(elements.values()).length, 1);
		assert.equal(historyBoundaries, 2, "Creation is one undoable operation");
		assert.equal(host.querySelectorAll(composer).length, 1);
		assert.equal(
			host.querySelector(".canvas-editor__sequence-quick-builder"),
			null,
		);
		const request = messages()[0];
		click('[aria-label="Antwort hinzufügen"]');
		assert.equal(
			host.querySelector<HTMLSelectElement>('[aria-label="Von"]')?.value,
			request.toParticipantId,
		);
		assert.equal(
			host.querySelector<HTMLSelectElement>('[aria-label="An"]')?.value,
			request.fromParticipantId,
		);
		fill(`${composer} input`, "Bestätigt");
		click(submit);
		assert.equal(messages().length, 2);
		assert.equal(messages()[1].kind, "return");
		const originalOrder = messages().map((message) => message.label);
		click('[aria-label="Schritt nach unten"]');
		assert.deepEqual(
			messages().map((message) => message.label),
			[...originalOrder].reverse(),
		);
		assert.equal(
			host.querySelector<HTMLButtonElement>('[aria-label="Schritt nach oben"]')
				?.disabled,
			true,
		);
		click(
			'.canvas-editor__sequence-step-list > li:last-child [aria-label="Schritt nach oben"]',
		);
		assert.deepEqual(
			messages().map((message) => message.label),
			originalOrder,
		);
		const beforeEdit = new Map(elements);
		click('[aria-label="Bearbeiten"]');
		assert.equal(host.querySelectorAll(composer).length, 1);
		fill(`${composer} input`, "Bestellung prüfen");
		click(submit);
		assert.equal(messages().length, 2);
		assert.equal(messages()[0].label, "Bestellung prüfen");
		click('[aria-label="Löschen"]');
		assert.equal(messages().length, 1);
		assert.equal(messages()[0].label, "Bestätigt");
		// An undo restores the host's document without creating another diagram.
		elements = beforeEdit;
		flushSync(render);
		assert.equal(messages().length, 2);
		assert.equal(
			host.querySelectorAll(".canvas-editor__sequence-step-list > li").length,
			2,
		);
		assert.equal(getSequenceDiagramSummaries(elements.values()).length, 1);
		click(".canvas-editor__sequence-structure-disclosure > button");
		fill('[aria-label="Beschreibung des Abschnitts"]', "gesund");
		click(".canvas-editor__sequence-structure-disclosure form button");
		assert.equal(
			getSequenceDiagramSummaries(elements.values())[0].fragments.length,
			1,
		);
		const messagesBeforeDeletion = messages();
		const boundariesBeforeDeletion = historyBoundaries;
		click('[aria-label="Abschnitt löschen: alt [gesund]"]');
		assert.equal(historyBoundaries, boundariesBeforeDeletion + 2);
		assert.equal(
			getSequenceDiagramSummaries(elements.values())[0].fragments.length,
			0,
		);
		assert.deepEqual(messages(), messagesBeforeDeletion);
		assert.equal(
			host.querySelector(".canvas-editor__sequence-fragments"),
			null,
		);
	} finally {
		flushSync(() => root.unmount());
		await browser.happyDOM.close();
	}
});
