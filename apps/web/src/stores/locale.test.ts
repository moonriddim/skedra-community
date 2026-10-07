import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

test("first visits use the browser language and preserve saved choices and localized links", async (t) => {
	const browser = new Window({ url: "https://skedra.xyz/?invite=abc#canvas" });
	const values = {
		window: browser,
		document: browser.document,
		navigator: { language: "da-DK", languages: ["da-DK", "en", "de"] },
		localStorage: browser.localStorage,
	};
	const previous = new Map(
		Object.keys(values).map((key) => [
			key,
			Object.getOwnPropertyDescriptor(globalThis, key),
		]),
	);
	for (const [key, value] of Object.entries(values)) {
		Object.defineProperty(globalThis, key, {
			value,
			configurable: true,
			writable: true,
		});
	}
	t.after(() => {
		for (const [key, descriptor] of previous) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
		void browser.happyDOM.close();
	});

	const { detectBrowserLocale, getCurrentLocale, initLocale, useLocaleStore } =
		await import("./locale");
	for (const language of ["de", "de-DE", "de-CH", "de-AT", "DE-de"]) {
		assert.equal(detectBrowserLocale([language]), "de", language);
	}
	for (const language of ["da-DK", "en-US", "fr-CH", "it-CH", "nl-NL"]) {
		assert.equal(detectBrowserLocale([language, "de"]), "en", language);
	}
	assert.equal(detectBrowserLocale([]), "en");
	assert.equal(detectBrowserLocale(), "en");
	assert.equal(detectBrowserLocale(["de-CH", "en"]), "de");

	assert.equal(getCurrentLocale(), "en");
	initLocale();
	assert.equal(browser.document.documentElement.lang, "en");
	assert.equal(browser.location.pathname, "/en");
	assert.equal(browser.location.search, "?invite=abc");
	assert.equal(browser.location.hash, "#canvas");

	// A manual choice survives reopening the neutral entry URL.
	useLocaleStore.getState().setLocale("de");
	const savedPreference = browser.localStorage.getItem("skedra-locale");
	assert.ok(savedPreference);
	useLocaleStore.setState({ locale: "en" });
	browser.localStorage.setItem("skedra-locale", savedPreference);
	await useLocaleStore.persist.rehydrate();
	browser.history.replaceState(null, "", "/");
	initLocale();
	assert.equal(getCurrentLocale(), "de");
	assert.equal(browser.location.pathname, "/");
	assert.equal(browser.document.documentElement.lang, "de");

	useLocaleStore.getState().setLocale("en");
	await useLocaleStore.persist.rehydrate();
	browser.history.replaceState(null, "", "/");
	initLocale();
	assert.equal(browser.location.pathname, "/en");

	for (const [path, locale] of [
		["/whiteboard", "de"],
		["/en/whiteboard", "en"],
		["/en", "en"],
	] as const) {
		browser.history.replaceState(null, "", path);
		initLocale();
		assert.equal(getCurrentLocale(), locale);
		assert.equal(browser.document.documentElement.lang, locale);
		assert.equal(browser.location.pathname, path);
	}

	browser.history.replaceState(null, "", "/login");
	initLocale();
	assert.equal(getCurrentLocale(), "en");
	assert.equal(browser.location.pathname, "/login");
});
