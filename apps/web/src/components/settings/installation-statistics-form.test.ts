import assert from "node:assert/strict";
import test from "node:test";
import {
	type HTMLButtonElement as TestButton,
	type HTMLInputElement as TestInput,
	Window,
} from "happy-dom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

test("setup requires an explicit choice; saving and failed saves preserve the selected choice", async () => {
	const window = new Window({ url: "http://localhost" });
	const values = {
		window,
		document: window.document,
		navigator: window.navigator,
		HTMLElement: window.HTMLElement,
		localStorage: window.localStorage,
		IS_REACT_ACT_ENVIRONMENT: true,
	};
	const previous = new Map(
		Object.keys(values).map((key) => [
			key,
			Object.getOwnPropertyDescriptor(globalThis, key),
		]),
	);
	for (const [key, value] of Object.entries(values))
		Object.defineProperty(globalThis, key, {
			value,
			configurable: true,
			writable: true,
		});
	const container = window.document.createElement("div");
	window.document.body.append(container);
	const root = createRoot(container as unknown as HTMLElement);
	try {
		const { InstallationStatisticsForm } = await import(
			"./installation-statistics-form"
		);
		const { I18nProvider, loadI18nMessages } = await import("../../lib/i18n");
		await loadI18nMessages("de");
		const saved: boolean[] = [];
		const render = async (
			pending = false,
			error = false,
			initialChoice: boolean | null = null,
			key = "setup",
		) =>
			act(async () => {
				root.render(
					createElement(
						I18nProvider,
						null,
						createElement(InstallationStatisticsForm, {
							key,
							initialChoice,
							pending,
							error,
							setup: true,
							onSave: (enabled) => saved.push(enabled),
						}),
					),
				);
			});
		await render();
		const radios = () => [
			...container.querySelectorAll<TestInput>('input[type="radio"]'),
		];
		const submit = () => {
			const button = container.querySelector<TestButton>(
				'button[type="submit"]',
			);
			assert.ok(button);
			return button;
		};
		assert.deepEqual(
			radios().map((input) => input.checked),
			[false, false],
		);
		assert.equal(submit().disabled, true);
		assert.deepEqual(saved, []);
		await act(async () => radios()[1].click());
		assert.deepEqual(
			radios().map((input) => input.checked),
			[false, true],
		);
		assert.equal(submit().disabled, false);
		await act(async () => submit().click());
		assert.deepEqual(saved, [false]);
		await render(true);
		assert.equal(submit().disabled, true);
		assert.equal(container.querySelector("fieldset")?.disabled, true);
		await render(false, true);
		assert.ok(
			container
				.querySelector('[role="alert"]')
				?.textContent.includes("nicht gespeichert"),
		);
		assert.equal(radios()[1].checked, true);
		await act(async () => radios()[0].click());
		await act(async () => submit().click());
		assert.deepEqual(saved, [false, true]);
		await render(false, false, false, "saved-setting");
		assert.deepEqual(
			radios().map((input) => input.checked),
			[false, true],
		);
	} finally {
		await act(async () => root.unmount());
		await window.happyDOM.close();
		for (const [key, descriptor] of previous) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
	}
});
