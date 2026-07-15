import assert from "node:assert/strict";
import { test } from "node:test";
import {
	WIREFRAME_COMPONENT_IDS,
	WIREFRAME_PRESET_IDS,
} from "@skedra/canvas-core";
import { deMessages } from "../i18n/messages.de";
import { enMessages } from "../i18n/messages.en";
import { TEMPLATES } from "./index";

function resolve(tree: Record<string, unknown>, path: string): unknown {
	return path.split(".").reduce<unknown>((value, key) => {
		if (!value || typeof value !== "object") return undefined;
		return (value as Record<string, unknown>)[key];
	}, tree);
}

test("every home template has German and English name and description", () => {
	for (const template of TEMPLATES) {
		for (const locale of [deMessages, enMessages]) {
			assert.equal(
				typeof resolve(locale, `templates.${template.id}.name`),
				"string",
			);
			assert.equal(
				typeof resolve(locale, `templates.${template.id}.description`),
				"string",
			);
		}
	}
});

test("wireframe library labels cover every built-in preset and component", () => {
	for (const locale of [deMessages, enMessages]) {
		for (const preset of WIREFRAME_PRESET_IDS) {
			assert.equal(
				typeof resolve(locale, `wireframePanel.presets.${preset}`),
				"string",
				preset,
			);
		}
		for (const component of WIREFRAME_COMPONENT_IDS) {
			assert.equal(
				typeof resolve(locale, `wireframePanel.components.${component}`),
				"string",
				component,
			);
		}
	}
});
